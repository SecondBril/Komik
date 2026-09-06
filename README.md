# Product Requirements Document (PRD)
## Website Baca Komik (Manga, Manhwa, Manhua) — Terjemahan Bahasa Indonesia

| | |
|---|---|
| **Versi** | 1.0 |
| **Tanggal** | 6 September 2026 |
| **Status** | Draft |
| **Pemilik Produk** | (isi nama) |
| **Tech Stack** | Next.js, Supabase, Vercel |
| **Constraint Budget** | Full free-tier — target $0/bulan (lihat Bagian 7.5) |

---

## 1. Ringkasan Eksekutif

Website ini adalah platform baca komik daring yang menyediakan ribuan judul **Manga, Manhwa, dan Manhua** yang diterjemahkan ke Bahasa Indonesia. Produk ini menargetkan pembaca komik Indonesia yang ingin membaca chapter terbaru dengan pengalaman baca cepat, nyaman di HP, dan tetap lancar meski koneksi internet lambat.

Value utama produk:
1. **Kecepatan load gambar** — jadi pembeda utama dibanding kompetitor, dicapai lewat konversi WebP otomatis + CDN.
2. **Update chapter cepat** — lewat sistem scraping & ingest otomatis dari sumber lain.
3. **Reading experience** yang dioptimalkan untuk format webtoon (scroll vertikal).

---

## 2. Latar Belakang & Masalah

- Situs baca komik pada umumnya lambat karena gambar chapter di-load dalam format asli (JPG/PNG) berukuran besar, terutama untuk pengguna dengan koneksi lambat (mayoritas mobile user Indonesia).
- Proses upload chapter manual memakan waktu lama sehingga update sering telat dibanding situs sumber.
- Dibutuhkan sistem otomatis untuk mengambil (scrape) konten chapter dari sumber lain, memprosesnya (convert ke WebP), lalu menayangkannya dengan cepat ke pembaca.

---

## 3. Tujuan Produk (Goals)

| Goal | Deskripsi |
|---|---|
| G1 | Menyediakan pengalaman baca komik yang cepat walau di internet lambat |
| G2 | Mendukung 3 tipe komik: Manga, Manhwa, Manhua dalam satu platform |
| G3 | Update chapter baru secara (semi-)otomatis dari sumber eksternal |
| G4 | Retensi pembaca lewat fitur history bacaan & continue reading |
| G5 | Login mudah tanpa friction (Google OAuth) |

### Non-Goals (di luar scope v1)
- Tidak ada fitur komentar/forum komunitas (dipertimbangkan di fase berikutnya)
- Tidak ada sistem monetisasi (donasi/premium chapter) di MVP
- Tidak ada aplikasi mobile native (v1 fokus web responsif)

---

## 4. Target Pengguna

**Persona utama:** "Andi", 18–30 tahun, membaca komik dari HP di sela waktu luang, koneksi data seluler kadang lambat/terbatas kuota, ingin lanjut baca dari chapter terakhir tanpa ribet cari manual.

**Persona sekunder (internal):** Admin/Operator konten yang bertugas memantau proses scraping otomatis dan menambahkan sumber komik baru.

---

## 5. Functional Requirements

### 5.1 Autentikasi
| ID | Requirement |
|---|---|
| FR-1.1 | User login/register hanya melalui **Google OAuth** (via Supabase Auth) |
| FR-1.2 | Setelah login, sistem membuat/mengaitkan `user_id` dengan data Supabase `auth.users` |
| FR-1.3 | User bisa logout dari mana saja (header/navbar) |
| FR-1.4 | Guest (belum login) tetap bisa membaca komik, tapi history bacaan tidak tersimpan permanen (opsional: simpan sementara di local storage/cookie) |

### 5.2 Koleksi & Kategorisasi Komik
| ID | Requirement |
|---|---|
| FR-2.1 | Setiap komik memiliki tipe: `manga`, `manhwa`, atau `manhua` |
| FR-2.2 | Setiap komik punya metadata: judul, judul alternatif, sinopsis, cover, author/artist, tahun rilis, status (`ongoing`/`completed`), rating, daftar genre |
| FR-2.3 | Setiap komik memiliki daftar chapter terurut dengan nomor & tanggal rilis |

### 5.3 Filter & Pencarian
| ID | Requirement |
|---|---|
| FR-3.1 | User dapat mem-filter komik berdasarkan **genre** (multi-select) |
| FR-3.2 | User dapat mem-filter berdasarkan **tipe komik** (Manga/Manhwa/Manhua) |
| FR-3.3 | User dapat mem-filter berdasarkan **status** (Ongoing/Completed) |
| FR-3.4 | Kombinasi filter bisa digabung sekaligus (genre + tipe + status) |
| FR-3.5 | Ada pencarian judul (search bar) dengan hasil real-time/debounced |
| FR-3.6 | Hasil filter/pencarian mendukung pagination atau infinite scroll |

### 5.4 Homepage — Latest Updates
| ID | Requirement |
|---|---|
| FR-4.1 | Homepage menampilkan daftar chapter yang baru saja rilis, diurutkan dari paling baru |
| FR-4.2 | Setiap kartu update menampilkan: cover, judul komik, nomor chapter baru, waktu rilis (relative time, misal "5 menit lalu") |
| FR-4.3 | Data ter-update otomatis tanpa reload manual (revalidasi berkala / ISR) |
| FR-4.4 | Section tambahan: Populer minggu ini, Rekomendasi, Baru ditambahkan |

### 5.5 Reading Viewer (Mode Baca)
| ID | Requirement |
|---|---|
| FR-5.1 | Mode scroll vertikal berkelanjutan (webtoon style) sebagai mode utama untuk Manhwa |
| FR-5.2 | Untuk Manga/Manhua (format halaman per-halaman), sediakan opsi mode: vertical scroll atau page-by-page |
| FR-5.3 | Tombol navigasi "Chapter Selanjutnya" / "Chapter Sebelumnya" selalu terlihat (sticky/floating) |
| FR-5.4 | Dropdown pemilih chapter cepat (jump to chapter) tanpa kembali ke halaman detail komik |
| FR-5.5 | Gambar dimuat secara **lazy-load** (progressive), hanya beberapa halaman ke depan yang di-preload |
| FR-5.6 | Progress baca (chapter + posisi scroll opsional) otomatis tersimpan ke history |
| FR-5.7 | Reader-friendly di mobile: full width, minim UI, dark background |

### 5.6 History Bacaan
| ID | Requirement |
|---|---|
| FR-6.1 | Sistem mencatat setiap komik & chapter yang telah dibaca user (timestamp terakhir dibaca) |
| FR-6.2 | Halaman "History Saya" menampilkan daftar komik terakhir dibaca, urut dari paling baru |
| FR-6.3 | Setiap item history menampilkan tombol "Lanjut Baca" langsung ke chapter/posisi terakhir |
| FR-6.4 | User dapat menghapus item dari history (individual atau clear all) |
| FR-6.5 | Badge "Chapter Baru" muncul di item history jika komik tersebut ada update chapter baru sejak terakhir dibaca |

### 5.7 Sistem Ingest Otomatis (Scraper + Image Pipeline)
Fitur internal (bukan untuk end-user), untuk mengambil chapter dari situs sumber lain, mengonversi gambar ke WebP, lalu menyajikannya di platform.

| ID | Requirement |
|---|---|
| FR-7.1 | Scraper Worker mengambil daftar chapter baru dari situs sumber terdaftar secara terjadwal (cron) |
| FR-7.2 | Scraper mengekstrak metadata chapter (judul, nomor, daftar URL gambar halaman) |
| FR-7.3 | Metadata chapter disimpan ke database sebelum proses gambar dimulai (status: `pending`) |
| FR-7.4 | Setiap URL gambar dimasukkan ke **Image Queue** untuk diproses satu per satu/paralel |
| FR-7.5 | Image Worker mengunduh gambar asli, melakukan validasi (ukuran, korup, dsb.) |
| FR-7.6 | Gambar dikonversi dari JPG/PNG/JPEG format asli → **WebP** (menggunakan library seperti `sharp`) |
| FR-7.7 | Gambar hasil konversi disimpan ke Object Storage/CDN dengan struktur path konsisten, misal: `comics/{comic_slug}/{chapter_no}/{page_no}.webp` |
| FR-7.8 | Setelah semua halaman selesai diproses, status chapter berubah menjadi `published` dan otomatis muncul di homepage "Latest Update" |
| FR-7.9 | Sistem mencatat log/error jika scraping atau konversi gagal (retry mechanism) |
| FR-7.10 | Dashboard internal sederhana untuk memantau status antrian (queue), chapter gagal, dan menambah sumber baru |

---

## 6. Non-Functional Requirements

| Kategori | Requirement |
|---|---|
| **Performa** | Waktu load halaman gambar chapter < 2 detik pada koneksi 3G/4G lambat (target LCP < 2.5s) |
| **Skalabilitas** | Sistem harus tahan terhadap ribuan judul & puluhan ribu chapter/gambar |
| **Ketersediaan** | Uptime target 99.5% |
| **Keamanan** | Auth via Supabase (OAuth token, RLS aktif di semua tabel sensitif seperti history user) |
| **SEO** | Halaman komik & chapter di-render SSR/ISR agar terindeks mesin pencari |
| **Responsif** | Mobile-first, karena mayoritas trafik diperkirakan dari HP |
| **Legal/Hak Cipta** | Lihat bagian Risiko (Bagian 9) |

---

## 7. Arsitektur Sistem & Tech Stack

### 7.1 Stack Utama (Full Free Tier)
- **Frontend/Framework:** Next.js (App Router, SSR + ISR untuk halaman list & detail komik) — open source, gratis
- **Hosting/Deploy:** Vercel **Hobby (free plan)** — cukup untuk frontend & API routes ringan
- **Database & Auth:** Supabase **Free Plan** (Postgres + Auth Google OAuth + Row Level Security)
- **Storage/CDN gambar:** Cloudflare R2 **Free Tier** (10 GB storage, tanpa biaya egress) + Cloudflare CDN (gratis) di depannya — lihat 7.4 untuk alasan kenapa bukan Supabase Storage
- **Image processing:** `sharp` (Node.js, open-source) untuk konversi ke WebP
- **Queue/Worker runner:** GitHub Actions (scheduled workflow) — gratis, jadi tidak perlu sewa VPS/Railway/Fly.io — lihat 7.3
- **OAuth Provider:** Google Cloud OAuth Client — gratis

### 7.2 Skema Data (Ringkas)

```
comics
 ├─ id, slug, title, alt_titles, type (manga|manhwa|manhua)
 ├─ synopsis, cover_url, author, status (ongoing|completed)
 ├─ source_id (referensi ke tabel sources), created_at, updated_at

genres
 ├─ id, name

comic_genres (junction)
 ├─ comic_id, genre_id

chapters
 ├─ id, comic_id, chapter_number, title
 ├─ status (pending|processing|published|failed)
 ├─ released_at, created_at

chapter_pages
 ├─ id, chapter_id, page_number, image_url (webp), width, height

reading_history
 ├─ id, user_id, comic_id, chapter_id
 ├─ last_read_at, scroll_position (opsional)

sources (untuk scraper)
 ├─ id, name, base_url, scraping_config (JSON)
```

### 7.3 Arsitektur Pipeline Scraping & Konversi Gambar

```
[Situs Sumber Komik]
        │
        ▼
[Scraper Worker] ──► ambil daftar chapter & URL gambar
        │
        ▼
[Simpan metadata chapter] (status: pending)
        │
        ▼
[Image Queue] ──► satu job per halaman gambar
        │
        ▼
[Image Worker]
  ├─ Download gambar asli
  ├─ Validasi (format, korup, ukuran)
  ├─ Convert → WebP (sharp, quality ~75-80)
  └─ Upload ke Object Storage/CDN
        │
        ▼
[Update status chapter → published]
        │
        ▼
[Website Reader] ──► tampil di homepage & viewer
```

**Catatan teknis penting (versi $0/bulan):** Vercel Hobby membatasi durasi eksekusi function dan tidak menyediakan background worker jangka panjang, jadi proses scraping/konversi gambar **tidak** dijalankan di dalam Vercel function. Setup yang sepenuhnya gratis:
- **Runner:** GitHub Actions dengan trigger `schedule` (cron). Repo publik dapat menit runner tanpa batas; repo privat dapat kuota menit gratis/bulan (biasanya cukup untuk job terjadwal beberapa kali sehari). Workflow menjalankan script Node.js: scrape → download → convert ke WebP (`sharp`) → upload ke Cloudflare R2 → update status di Supabase.
- **Queue:** cukup pakai **tabel Postgres di Supabase** (`status: pending/processing/done/failed`) sebagai antrian sederhana yang di-poll oleh workflow — tidak perlu layanan queue berbayar tambahan. (Opsional ke depan: Upstash Redis, yang juga punya free tier kalau butuh queue lebih real-time.)
- **Trigger tambahan:** Vercel Cron Jobs (gratis, tapi di plan Hobby dibatasi maksimal 1x per hari) bisa dipakai memicu endpoint ringan untuk menambah job ke antrian — bukan untuk menjalankan proses beratnya.

### 7.4 Strategi Kecepatan Load Gambar (poin krusial produk ini)
- Semua gambar chapter disajikan dalam **WebP** (kompresi lebih kecil ~25-35% dari JPG di kualitas visual sama).
- **Storage gambar pakai Cloudflare R2, bukan Supabase Storage** — free tier Supabase Storage cuma menyediakan 2 GB bandwidth/bulan, gampang habis untuk situs komik dengan trafik baca tinggi. R2 free tier tidak mengenakan biaya egress sama sekali, jadi jauh lebih aman untuk dipakai gratis dalam jangka panjang.
- Pasang **Cloudflare CDN (gratis)** di depan R2 untuk caching & mempercepat load ke pembaca.
- Gunakan `next/image` dengan lazy loading otomatis + blur placeholder.
- Preload hanya 2–3 halaman ke depan saat user scroll, bukan seluruh chapter sekaligus.
- Cache-Control header agresif untuk gambar chapter yang sudah published (immutable) — selain mempercepat load, ini juga menghemat kuota gratis.

### 7.5 Batas Free Tier & Implikasinya

| Layanan | Batas gratis (cek ulang saat implementasi, kebijakan bisa berubah) | Implikasi |
|---|---|---|
| **Vercel Hobby** | ± 100 GB bandwidth/bulan, execution time function terbatas, cron job maksimal 1x/hari | Cukup untuk MVP trafik kecil–menengah; trafik besar butuh upgrade ke Pro |
| **Supabase Free** | 500 MB database, project auto-pause jika 7 hari tanpa aktivitas | Cukup untuk metadata (comics, chapters, history) skala ribuan judul; jangan simpan gambar di sini |
| **Cloudflare R2 Free** | 10 GB storage, jutaan operasi/bulan, **tanpa biaya egress** | Cocok untuk ribuan halaman gambar; kalau koleksi besar sekali, 10 GB bisa terlampaui → biaya tambahan storage sangat murah (~$0.015/GB/bulan) |
| **GitHub Actions** | Repo publik: menit tanpa batas. Repo privat: kuota menit gratis/bulan (terbatas) | Pertimbangkan repo publik untuk worker kalau mau benar-benar $0 tanpa batas menit |
| **Google OAuth** | Gratis, tidak ada batas praktis di skala ini | — |

**Catatan jujur:** "gratis" di sini artinya **$0 di awal dengan batas kuota**, bukan gratis tanpa batas selamanya. Untuk pemakaian pribadi/skala kecil-menengah, kombinasi di atas realistis $0/bulan. Kalau nanti koleksi atau trafik tumbuh signifikan, biasanya ada satu titik (paling sering storage atau bandwidth) yang perlu upgrade ke paid tier — dan itu pun umumnya masih murah (kisaran $5–25/bulan), bukan lompatan besar.

---

## 8. User Flow Utama

**Alur baca komik:**
1. User membuka homepage → lihat "Latest Update" atau cari via filter/search.
2. Klik komik → halaman detail (sinopsis, daftar chapter).
3. Klik chapter → masuk Reading Viewer.
4. Scroll vertikal membaca halaman → sistem otomatis catat ke history saat X% chapter terbaca atau saat pindah chapter.
5. Klik "Chapter Selanjutnya" → lanjut tanpa keluar viewer.

**Alur ingest chapter baru (internal):**
1. Cron trigger → Scraper Worker cek sumber terdaftar.
2. Chapter baru terdeteksi → metadata disimpan (`pending`).
3. Gambar masuk antrian → diproses satu per satu jadi WebP.
4. Semua halaman selesai → status `published` → otomatis tampil di homepage.

---

## 9. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| **Legal/Hak Cipta**: mengambil konten dari situs lain tanpa izin berpotensi melanggar hak cipta pemegang lisensi resmi | Ini adalah risiko bisnis/hukum yang signifikan dan perlu ditinjau terpisah dengan penasihat hukum sebelum go-live; PRD ini hanya membahas aspek teknis produk |
| Struktur HTML situs sumber berubah → scraper gagal | Buat scraping config per-source yang mudah diupdate, monitoring & alert saat gagal |
| Beban worker tinggi saat banyak chapter baru sekaligus | Queue dengan concurrency limit & retry, scaling worker terpisah dari web app |
| Biaya bandwidth storage/CDN membengkak seiring koleksi bertambah | Evaluasi Cloudflare R2 (tanpa egress fee) dibanding Supabase Storage native untuk skala besar |
| Gambar sumber berkualitas rendah/watermark | Validasi otomatis (ukuran minimum) + opsi review manual admin sebelum publish (opsional fase 2) |
| Batas kuota free tier (bandwidth/storage/database) terlampaui saat koleksi atau trafik tumbuh | Pantau usage dashboard tiap layanan secara berkala; pilih storage berbasis S3-compatible API (R2) agar mudah upgrade/migrasi tanpa refactor besar |

---

## 10. Metrik Keberhasilan (KPI)

- Rata-rata waktu load halaman chapter (Largest Contentful Paint)
- Jumlah chapter baru ter-publish per hari (kecepatan ingest)
- Retention rate: % user yang kembali lewat fitur History dalam 7 hari
- Rata-rata jumlah chapter dibaca per sesi
- Error rate proses scraping/konversi gambar

---

## 11. Roadmap Pengembangan

**Fase 1 — MVP**
- Auth Google, koleksi komik, filter dasar, homepage latest update, reading viewer, history bacaan
- Pipeline scraping & konversi WebP untuk 1 sumber awal

**Fase 2**
- Multi-source scraping, dashboard admin untuk monitoring queue
- Optimasi lanjutan: multiple image resolution, prefetch chapter berikutnya

**Fase 3**
- Rekomendasi personalisasi, notifikasi chapter baru (push/email), bookmark/favorit terpisah dari history

---

## 12. Pertanyaan Terbuka

- Apakah perlu fitur "Favorit/Bookmark" terpisah dari History bacaan?
- Berapa jumlah sumber (source website) yang perlu didukung di MVP?
- Apakah dibutuhkan review manual sebelum chapter hasil scraping tayang, atau full otomatis?
- Kebijakan retensi hukum: bagaimana proses takedown jika ada klaim hak cipta dari pemegang lisensi resmi?
