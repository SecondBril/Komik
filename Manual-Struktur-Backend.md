# Manual Struktur Backend
## Website Baca Komik (Manga, Manhwa, Manhua)

Dokumen ini adalah panduan teknis implementasi backend, database, dan pipeline ingest, diturunkan dari PRD v1.0 (Next.js + Supabase + Vercel, target $0/bulan).

---

## 1. Overview Arsitektur

```
┌────────────┐      ┌──────────────────┐      ┌───────────────────┐
│  Browser   │◄────►│  Next.js (Vercel)│◄────►│ Supabase (Postgres │
│  (User)    │      │  App Router      │      │ + Auth + RLS)      │
└────────────┘      └──────────────────┘      └───────────────────┘
                              │                          ▲
                              │ image URL (CDN)           │ update status
                              ▼                          │
                     ┌──────────────────┐        ┌───────────────────┐
                     │ Cloudflare R2     │◄───────│ GitHub Actions     │
                     │ + Cloudflare CDN  │ upload │ (Scraper + Image   │
                     └──────────────────┘         │  Worker, cron)     │
                                                   └───────────────────┘
                                                             ▲
                                                             │ scrape
                                                    ┌───────────────────┐
                                                    │ Situs Sumber Komik │
                                                    └───────────────────┘
```

**Prinsip pemisahan tanggung jawab:**
- **Next.js di Vercel** hanya melayani request web (SSR/ISR halaman, API ringan untuk history & auth). Tidak menjalankan proses berat/panjang (scraping, konversi gambar) karena limitasi durasi function di Vercel Hobby.
- **GitHub Actions** menjalankan proses berat secara terjadwal, independen dari deployment web.
- **Supabase Postgres** menjadi satu-satunya sumber kebenaran data (metadata komik, chapter, history, antrian ingest) — juga dipakai sebagai *queue sederhana* lewat kolom `status`.
- **Cloudflare R2 + CDN** menyimpan dan menyajikan seluruh gambar chapter (bukan Supabase Storage), demi menghindari batas bandwidth free tier dan biaya egress.

---

## 2. Struktur Folder Proyek

```
/app
  /(public)
    page.tsx                          # Homepage
    /browse/page.tsx                  # Filter & search
    /komik/[slug]/page.tsx            # Detail komik
    /komik/[slug]/[chapter]/page.tsx  # Reading viewer
    /history/page.tsx                 # History Saya
  /admin
    page.tsx                          # Dashboard queue
    /sources/page.tsx                 # Kelola sumber scraping
    /logs/page.tsx                    # Log error ingest
  /api
    /history/route.ts                 # GET/POST/DELETE reading_history milik user
    /admin/sources/route.ts           # CRUD sumber (auth admin)
    /admin/retry/route.ts             # Trigger ulang chapter gagal (auth admin)
    /auth/callback/route.ts           # Callback Supabase OAuth

/components
  /comic/comic-card.tsx
  /comic/genre-chip.tsx
  /comic/type-badge.tsx
  /filters/filter-panel.tsx
  /reader/viewer-scroll.tsx
  /reader/viewer-paged.tsx
  /reader/chapter-nav.tsx
  /history/history-card.tsx
  /admin/queue-table.tsx

/lib
  /supabase/client.ts                 # Supabase client (browser, anon key)
  /supabase/server.ts                 # Supabase client (server component, cookies)
  /supabase/admin.ts                  # Supabase client (service role, hanya di server/worker)
  /queries/comics.ts                  # Query list/detail/filter komik
  /queries/chapters.ts
  /queries/history.ts
  /utils/relative-time.ts
  /utils/slugify.ts

/workers                              # Dijalankan oleh GitHub Actions, TIDAK dideploy ke Vercel
  /scraper/
    run.ts                            # Entry point: cek semua source aktif
    parse-source.ts                   # Ekstrak metadata & daftar URL gambar per-source
  /image-worker/
    run.ts                            # Ambil job pending dari tabel queue, proses paralel terbatas
    convert.ts                        # sharp: convert ke WebP
    upload-r2.ts                      # Upload hasil ke Cloudflare R2
  /lib/
    supabase-client.ts                # Pakai service role key
    retry.ts                          # Logic retry & backoff

.github/workflows/
  ingest.yml                          # Cron job: scraper + image worker
```

**Catatan:** `/workers` bisa berupa package Node.js terpisah (bukan bagian dari build Next.js) agar tidak menambah bundle size aplikasi web dan agar dependency seperti `sharp` (native binding) tidak ikut ter-deploy ke Vercel function.

---

## 3. Skema Database (Supabase Postgres)

### 3.1 DDL Inti

```sql
-- Tipe komik & status sebagai enum agar konsisten
create type comic_type as enum ('manga', 'manhwa', 'manhua');
create type comic_status as enum ('ongoing', 'completed');
create type chapter_status as enum ('pending', 'processing', 'published', 'failed');

create table sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_url text not null,
  scraping_config jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table comics (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  alt_titles text[] default '{}',
  type comic_type not null,
  synopsis text,
  cover_url text,
  author text,
  status comic_status not null default 'ongoing',
  rating numeric(3,2),
  source_id uuid references sources(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_comics_type on comics(type);
create index idx_comics_status on comics(status);
create index idx_comics_title_trgm on comics using gin (title gin_trgm_ops); -- butuh extension pg_trgm, untuk search

create table genres (
  id serial primary key,
  name text unique not null
);

create table comic_genres (
  comic_id uuid references comics(id) on delete cascade,
  genre_id int references genres(id) on delete cascade,
  primary key (comic_id, genre_id)
);

create table chapters (
  id uuid primary key default gen_random_uuid(),
  comic_id uuid references comics(id) on delete cascade,
  chapter_number numeric(10,2) not null,   -- numeric agar support "12.5"
  title text,
  status chapter_status not null default 'pending',
  retry_count int not null default 0,
  released_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (comic_id, chapter_number)
);
create index idx_chapters_status on chapters(status);
create index idx_chapters_comic_released on chapters(comic_id, released_at desc);
-- index ini yang dipakai query "Latest Update" di homepage:
create index idx_chapters_released_published on chapters(released_at desc) where status = 'published';

create table chapter_pages (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid references chapters(id) on delete cascade,
  page_number int not null,
  image_url text not null,     -- URL final di Cloudflare CDN/R2
  width int,
  height int,
  unique (chapter_id, page_number)
);

create table reading_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  comic_id uuid references comics(id) on delete cascade,
  chapter_id uuid references chapters(id) on delete cascade,
  scroll_position numeric,
  last_read_at timestamptz not null default now(),
  unique (user_id, comic_id)   -- satu baris per komik per user, di-upsert tiap kali baca
);
create index idx_history_user_lastread on reading_history(user_id, last_read_at desc);

-- Log untuk monitoring pipeline ingest (FR-7.9, FR-7.10)
create table ingest_logs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id),
  chapter_id uuid references chapters(id),
  level text not null check (level in ('info', 'warning', 'error')),
  message text not null,
  created_at timestamptz not null default now()
);
create index idx_ingest_logs_level_time on ingest_logs(level, created_at desc);
```

### 3.2 Catatan Desain Skema

- **`chapter_number` bertipe numeric**, bukan integer — banyak komik punya chapter selingan seperti "12.5".
- **`reading_history` unique per (user_id, comic_id)** — histori disimpan sebagai *progress terakhir per komik*, bukan log setiap chapter yang pernah dibaca, sesuai kebutuhan "Lanjut Baca" (upsert, bukan insert terus-menerus).
- **Partial index** `idx_chapters_released_published` mempercepat query homepage "Latest Update" karena hanya meng-index baris berstatus `published`.
- **`retry_count`** dipakai worker untuk membatasi percobaan ulang otomatis sebelum ditandai perlu campur tangan admin.
- Pertimbangkan **`pg_trgm` extension** untuk pencarian judul yang lebih toleran typo (`ilike` + trigram index), atau gunakan Supabase Full Text Search (`tsvector`) jika volume judul besar.

---

## 4. Row Level Security (RLS)

Semua tabel **wajib RLS aktif**. Prinsip: data komik publik boleh dibaca siapa saja, data user hanya boleh diakses pemiliknya, data internal (sources, ingest_logs) tidak boleh diakses dari client sama sekali.

```sql
alter table comics enable row level security;
alter table genres enable row level security;
alter table comic_genres enable row level security;
alter table chapters enable row level security;
alter table chapter_pages enable row level security;
alter table reading_history enable row level security;
alter table sources enable row level security;
alter table ingest_logs enable row level security;

-- Baca publik untuk data komik (anon + authenticated)
create policy "public read comics" on comics for select using (true);
create policy "public read genres" on genres for select using (true);
create policy "public read comic_genres" on comic_genres for select using (true);
create policy "public read published chapters" on chapters
  for select using (status = 'published');
create policy "public read chapter_pages of published chapters" on chapter_pages
  for select using (
    exists (select 1 from chapters c where c.id = chapter_id and c.status = 'published')
  );
-- Tidak ada policy insert/update/delete untuk role anon/authenticated pada tabel di atas
-- → hanya bisa diubah lewat service role key (dipakai worker & admin API route).

-- reading_history: user hanya boleh akses baris miliknya sendiri
create policy "user select own history" on reading_history
  for select using (auth.uid() = user_id);
create policy "user insert own history" on reading_history
  for insert with check (auth.uid() = user_id);
create policy "user update own history" on reading_history
  for update using (auth.uid() = user_id);
create policy "user delete own history" on reading_history
  for delete using (auth.uid() = user_id);

-- sources & ingest_logs: TIDAK ada policy sama sekali untuk anon/authenticated
-- → default RLS = deny all, hanya bisa diakses via service role key (server-side saja).
```

**Penting:** `SUPABASE_SERVICE_ROLE_KEY` (yang melewati RLS) **tidak pernah** dikirim ke browser — hanya dipakai di API route admin (dengan pengecekan tambahan email admin) dan di worker GitHub Actions (disimpan sebagai GitHub Secret).

---

## 5. API & Data Access Layer

Pendekatan hybrid, sesuai kebutuhan SSR/ISR untuk SEO:

| Kebutuhan | Pendekatan |
|---|---|
| Homepage, detail komik, list chapter (baca publik) | **Server Component** query langsung ke Supabase (anon key) + `revalidate` (ISR) — tidak perlu API route terpisah |
| Reading viewer (ambil `chapter_pages`) | Server Component, cache lama (immutable, chapter published tidak berubah) |
| Reading history (butuh auth per-user, ada mutasi) | **API Route** (`/api/history`) — GET (list), POST (upsert progress), DELETE |
| Search/filter dinamis | Server Component + `searchParams`, atau API route jika butuh client-side fetch (infinite scroll) |
| Aksi admin (retry chapter, tambah source) | **API Route** dengan service role key + cek allowlist email admin |

### 5.1 Endpoint Ringkas

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/api/comics` | Publik | List + filter (genre, type, status) + pagination |
| GET | `/api/comics/[slug]` | Publik | Detail komik + daftar chapter |
| GET | `/api/comics/[slug]/chapters/[no]` | Publik | Halaman gambar 1 chapter |
| GET | `/api/history` | User login | List history milik user, urut `last_read_at desc` |
| POST | `/api/history` | User login | Upsert progress baca `{comic_id, chapter_id, scroll_position}` |
| DELETE | `/api/history/[id]` | User login | Hapus 1 item history |
| DELETE | `/api/history` | User login | Hapus semua history user |
| GET | `/api/admin/queue` | Admin | Status antrian ingest (pending/processing/failed) |
| POST | `/api/admin/retry/[chapterId]` | Admin | Reset status chapter ke `pending` untuk diproses ulang |
| POST | `/api/admin/sources` | Admin | Tambah sumber scraping baru |

Autentikasi admin: cek `session.user.email` terhadap daftar allowlist (env var atau tabel kecil `admin_users`), **bukan** role Supabase bawaan, karena tidak ada kebutuhan multi-level role di v1.

---

## 6. Pipeline Ingest (Scraper + Image Worker)

### 6.1 Alur Detail

```
1. GitHub Actions cron trigger (mis. tiap 30-60 menit)
        │
2. scraper/run.ts
   - Ambil semua row `sources` where is_active = true
   - Untuk tiap source: parse-source.ts → daftar chapter baru + URL gambar mentah
   - Cek: chapter_number ini sudah ada di DB untuk comic_id ini? skip jika sudah ada
   - Insert baris baru ke `chapters` (status: pending)
   - Insert baris ke `chapter_pages` per halaman (image_url sementara = URL sumber asli,
     akan di-overwrite setelah upload ke R2)
        │
3. image-worker/run.ts
   - Query chapter_pages yang terkait chapter berstatus pending/processing
   - Set status chapter → processing
   - Untuk tiap halaman (paralel terbatas, mis. limit 5 concurrent):
        a. Download gambar asli dari URL sumber
        b. Validasi: cek content-type gambar valid, ukuran file > threshold minimum (deteksi korup/placeholder)
        c. convert.ts → sharp().webp({ quality: 75-80 })
        d. upload-r2.ts → upload ke path `comics/{comic_slug}/{chapter_no}/{page_no}.webp`
        e. Update chapter_pages.image_url → URL CDN final
   - Jika semua halaman sukses → update chapters.status = 'published'
   - Jika ada halaman gagal setelah N kali retry → chapters.status = 'failed',
     tulis detail ke `ingest_logs` (level: error)
        │
4. Chapter published otomatis muncul di homepage lewat ISR revalidation
   (tag/path revalidation, atau ISR interval singkat pada halaman homepage)
```

### 6.2 Contoh Workflow GitHub Actions

```yaml
# .github/workflows/ingest.yml
name: Comic Ingest Pipeline
on:
  schedule:
    - cron: "*/30 * * * *"   # tiap 30 menit
  workflow_dispatch: {}       # bisa dipicu manual dari tab Actions

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci --prefix workers
      - run: npm run scrape --prefix workers
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      - run: npm run process-images --prefix workers
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          R2_ACCOUNT_ID: ${{ secrets.R2_ACCOUNT_ID }}
          R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          R2_BUCKET_NAME: ${{ secrets.R2_BUCKET_NAME }}
```

- Jalankan sebagai **2 step terpisah** (scrape lalu proses gambar) agar mudah di-retry sebagian jika salah satu gagal, dan agar log GitHub Actions lebih mudah dibaca per tahap.
- Gunakan `workflow_dispatch` supaya admin bisa memicu ingest manual dari GitHub UI tanpa menunggu jadwal cron.

### 6.3 Retry & Concurrency

- **Retry per-halaman**: jika download/convert/upload gagal, retry maks 3x dengan exponential backoff (mis. 2s, 8s, 20s) sebelum halaman itu ditandai gagal.
- **Retry per-chapter**: jika chapter berstatus `failed`, `retry_count` bertambah tiap kali admin klik "Retry" di dashboard; setelah > 5x gagal, tampilkan warning khusus di dashboard agar dicek manual (kemungkinan struktur situs sumber berubah — lihat Bagian 9 Risiko PRD).
- **Concurrency limit**: gunakan library seperti `p-limit` untuk membatasi jumlah download/convert paralel (mis. 5), agar tidak membebani runner GitHub Actions maupun situs sumber.
- **Idempotensi**: proses scraping harus aman dijalankan berulang — cek `unique(comic_id, chapter_number)` sebelum insert agar cron yang tumpang tindih tidak membuat data duplikat.

---

## 7. Storage & CDN (Cloudflare R2)

- Struktur path bucket: `comics/{comic_slug}/{chapter_number}/{page_number}.webp`
- Bucket **public read** (lewat custom domain Cloudflare CDN di depannya), **write hanya lewat credential R2 di GitHub Actions** (tidak pernah dari client).
- Header `Cache-Control: public, max-age=31536000, immutable` untuk gambar chapter yang sudah published (gambar tidak pernah berubah setelah publish).
- Cover komik disimpan terpisah, mis. `covers/{comic_slug}.webp`, dengan cache lebih pendek karena bisa di-update sewaktu-waktu (mis. `max-age=86400`).

---

## 8. Environment Variables

| Variable | Dipakai di | Catatan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Next.js (client+server) | Publik, aman di-expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Next.js (client+server) | Publik, tunduk ke RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | API route admin, worker | **Rahasia**, bypass RLS, jangan pernah di `NEXT_PUBLIC_*` |
| `ADMIN_EMAIL_ALLOWLIST` | API route admin | Daftar email yang boleh akses `/admin` |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` | worker | Rahasia, disimpan sebagai GitHub Secrets |
| `R2_PUBLIC_CDN_URL` | Next.js + worker | Base URL publik untuk membentuk `image_url` |
| `GOOGLE_OAUTH_CLIENT_ID` / `SECRET` | Dikonfigurasi di dashboard Supabase Auth, bukan di kode app | — |

---

## 9. Deployment Flow

1. **Push ke branch `main`** → Vercel auto-build & deploy Next.js (frontend + API routes ringan).
2. **Cron GitHub Actions** berjalan independen dari deployment Vercel — tidak terpengaruh proses build/deploy web.
3. **Migrasi database**: kelola lewat Supabase CLI/migration files di repo (`supabase/migrations/*.sql`), dijalankan manual atau lewat GitHub Actions terpisah saat ada perubahan skema — jangan andalkan perubahan skema manual lewat dashboard Supabase agar histori migrasi tetap tercatat di git.
4. **Preview deployment** Vercel (per pull request) memakai project Supabase yang sama untuk MVP — pertimbangkan project Supabase terpisah untuk staging jika tim sudah lebih dari 1 orang.

---

## 10. Monitoring & Observability (Ringan, Sesuai Budget $0)

- Tabel `ingest_logs` menjadi sumber utama debugging pipeline — ditampilkan di dashboard admin (Bagian 7 Manual UI).
- Dashboard admin menghitung ringkasan sederhana secara langsung dari query SQL (jumlah `pending`/`processing`/`failed` per hari), tidak perlu tool observability berbayar tambahan di MVP.
- Opsional fase 2: kirim notifikasi ke Discord/Telegram webhook (gratis) saat ada chapter `failed` berturut-turut, tanpa perlu layanan alerting berbayar.

---

## 11. Keamanan

- RLS aktif di semua tabel (Bagian 4) — ini pertahanan utama, bukan hanya validasi di level aplikasi.
- `SUPABASE_SERVICE_ROLE_KEY` hanya hidup di server (API route) dan di GitHub Secrets — tidak pernah dikirim ke bundle client.
- Endpoint admin selalu memverifikasi sesi + allowlist email di server, meski route sudah "tersembunyi" di `/admin` (security by obscurity tidak cukup).
- Rate limiting dasar pada endpoint publik yang menerima query bebas (search/filter) untuk mencegah abuse, bisa memakai penghitung sederhana per-IP di Postgres/Upstash (opsional, sesuai kebutuhan saat trafik nyata terlihat).
- Untuk isu legal/hak cipta terkait konten hasil scraping: ini eksplisit di luar cakupan teknis PRD (lihat Bagian 9 Risiko PRD) dan perlu ditinjau terpisah dengan penasihat hukum sebelum go-live.
