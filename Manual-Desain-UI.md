# Manual Desain UI
## Website Baca Komik (Manga, Manhwa, Manhua)

Dokumen ini adalah panduan desain antarmuka untuk tim desain/front-end, diturunkan dari PRD v1.0. Fokus utama: **cepat, mobile-first, minim distraksi saat membaca**.

---

## 1. Prinsip Desain

1. **Mobile-first, bukan mobile-adapted.** Desain dimulai dari layar 375px, baru dilebarkan ke tablet/desktop.
2. **Gambar adalah konten utama.** UI di sekitar viewer harus sekecil dan sesedikit mungkin agar tidak menutupi komik.
3. **Persepsi kecepatan > kecepatan aktual.** Skeleton loading, blur placeholder, dan progressive image lebih penting daripada animasi dekoratif.
4. **Continue reading adalah fitur retensi utama** — harus terlihat jelas dan mudah diakses dari mana saja (navbar & homepage).
5. **Dark by default.** Mayoritas pembaca komik membaca di jam istirahat/malam; latar gelap mengurangi silau dan menghemat baterai di layar OLED.

---

## 2. Design System / Foundations

### 2.1 Palet Warna

Tema utama **dark**, dengan opsi light mode di fase berikutnya (tidak wajib MVP).

| Token | Hex | Penggunaan |
|---|---|---|
| `bg/base` | `#0F1115` | Latar belakang utama aplikasi |
| `bg/surface` | `#171A21` | Card, panel, navbar |
| `bg/surface-raised` | `#1F232C` | Modal, dropdown, elemen mengambang |
| `border/subtle` | `#2A2F3A` | Garis pembatas antar elemen |
| `text/primary` | `#F2F3F5` | Judul, teks utama |
| `text/secondary` | `#9AA0AC` | Metadata, caption, timestamp |
| `text/disabled` | `#5B616D` | Elemen non-aktif |
| `accent/primary` | `#7C5CFC` | Tombol utama, link aktif, highlight |
| `accent/primary-hover` | `#6A47F0` | Hover/pressed state |
| `status/ongoing` | `#3DDC84` | Badge status "Ongoing" |
| `status/completed` | `#5B8DEF` | Badge status "Completed" |
| `status/error` | `#F0554A` | Error, badge "Gagal" (dashboard admin) |
| `type/manga` | `#5B8DEF` | Badge tipe Manga |
| `type/manhwa` | `#7C5CFC` | Badge tipe Manhwa |
| `type/manhua` | `#F0A64E` | Badge tipe Manhua |

Reader viewer selalu dark (`#0B0C0F`) terlepas dari tema global, agar transisi gambar-ke-UI konsisten.

### 2.2 Tipografi

- **Font UI:** `Inter` (atau font sistem sejenis) — jelas dibaca di ukuran kecil, tersedia gratis.
- **Skala:**

| Token | Ukuran | Penggunaan |
|---|---|---|
| `text-xs` | 12px | Timestamp, caption, badge |
| `text-sm` | 14px | Body sekunder, deskripsi kartu |
| `text-base` | 16px | Body utama |
| `text-lg` | 18px | Sub-judul, judul kartu komik |
| `text-xl` | 22px | Judul halaman/section |
| `text-2xl` | 28px | Judul komik di halaman detail |

- Line-height body: 1.5. Judul: 1.2.
- Hindari font decorative untuk body teks; boleh dipakai hanya untuk logo/wordmark.

### 2.3 Spacing & Grid

- Skala spacing berbasis 4px: `4, 8, 12, 16, 24, 32, 48, 64`.
- Container max-width desktop: `1280px`, padding horizontal `16px` (mobile) / `32px` (desktop).
- Grid kartu komik: 2 kolom (mobile) → 3 (tablet) → 5–6 (desktop).

### 2.4 Breakpoints

| Nama | Lebar | Catatan |
|---|---|---|
| `base` | < 640px | Target utama, desain dari sini dulu |
| `sm` | ≥ 640px | Tablet portrait |
| `md` | ≥ 768px | Tablet landscape |
| `lg` | ≥ 1024px | Desktop |
| `xl` | ≥ 1280px | Desktop lebar |

### 2.5 Radius, Shadow, Ikon

- Radius: `8px` untuk card/tombol, `4px` untuk badge/chip, `999px` untuk avatar & pill filter.
- Shadow minim — gunakan elevasi lewat perbedaan warna surface, bukan drop shadow berat (hemat repaint di HP low-end).
- Ikon: gunakan icon set outline konsisten (mis. Lucide/Feather), ukuran standar 20px/24px.

---

## 3. Komponen UI

### 3.1 Navbar (Sticky Top)

```
┌─────────────────────────────────────────────┐
│ [Logo]   [🔍 Cari judul komik...]   [Avatar]│
└─────────────────────────────────────────────┘
```
- Mobile: logo diperkecil jadi ikon, search bar full-width bisa di-expand lewat ikon kaca pembesar.
- Avatar: jika belum login → tombol "Masuk dengan Google". Jika sudah login → avatar → dropdown (History Saya, Logout).
- Selalu sticky di top saat scroll di halaman non-reader.

### 3.2 Comic Card

```
┌───────────────┐
│               │  ← cover (rasio 2:3)
│    COVER      │
│               │
├───────────────┤
│ [Manhwa]      │  ← badge tipe (warna sesuai token type/*)
│ Judul Komik   │  ← 1-2 baris, truncate
│ Ch. 142 · 5m  │  ← chapter terbaru + relative time
└───────────────┘
```
- State hover (desktop): sedikit scale-up (1.02) + tampilkan sinopsis singkat di tooltip/overlay.
- State loading: skeleton abu-abu dengan shimmer, mempertahankan rasio 2:3 agar tidak ada layout shift.

### 3.3 Badge & Chip

- **Badge Tipe** (Manga/Manhwa/Manhua): pill kecil, warna solid sesuai token `type/*`, teks putih.
- **Badge Status** (Ongoing/Completed): pill outline, warna sesuai token `status/*`.
- **Genre Chip** (untuk filter): pill dengan border, state aktif = filled `accent/primary`.
- **Badge "Chapter Baru"**: dot merah kecil atau pill "Baru" di pojok kartu History.

### 3.4 Filter Panel

- Mobile: filter dibuka lewat bottom sheet (tombol "Filter" di atas grid hasil).
- Desktop: sidebar kiri, sticky.
- Struktur:
  - Grup **Tipe Komik** — chip single/multi toggle (Manga/Manhwa/Manhua).
  - Grup **Status** — toggle (Ongoing/Completed/Semua).
  - Grup **Genre** — chip multi-select, scrollable jika genre banyak, ada search kecil jika daftar genre > 15.
  - Tombol "Terapkan Filter" (mobile) / auto-apply (desktop).
  - Tombol "Reset".

### 3.5 Search Bar

- Placeholder: "Cari judul komik...".
- Debounce 300–400ms sebelum query jalan.
- Dropdown hasil cepat (maks 5 hasil) muncul saat mengetik, dengan thumbnail kecil + judul.
- Enter atau klik "Lihat semua hasil" → ke halaman `/cari?q=...`.

### 3.6 Pagination / Infinite Scroll

- Gunakan **infinite scroll** untuk grid komik & homepage (lebih natural di mobile).
- Tampilkan skeleton card saat fetch batch berikutnya.
- Sediakan tombol "Muat lebih banyak" sebagai fallback jika observer/JS gagal (progressive enhancement).

### 3.7 Reading Viewer Controls

```
┌─────────────────────────────┐
│ ← Kembali   Ch. 12 ▾   ⋮    │  ← header tipis, auto-hide saat scroll ke bawah
│                              │
│         [ GAMBAR ]          │
│         [ GAMBAR ]          │
│         [ GAMBAR ]          │
│                              │
├─────────────────────────────┤
│ [◀ Sebelumnya] [Selanjutnya ▶] │ ← floating bar, selalu terlihat
└─────────────────────────────┘
```
- Header: judul chapter + dropdown "jump to chapter" (buka list chapter tanpa keluar viewer), tombol menu (⋮) untuk toggle mode baca (scroll/page) khusus Manga/Manhua.
- Floating bottom bar navigasi chapter: selalu visible (fixed), tidak auto-hide (ini yang paling sering dipakai user).
- Background viewer: hitam/near-black penuh, tanpa iklan atau elemen dekoratif di antara halaman.
- Indikator progres membaca (opsional): thin progress bar di paling atas layar.

### 3.8 History Card

```
┌───────────────────────────────────────────┐
│ [cover] Judul Komik              [Baru!]  │
│         Terakhir: Ch. 12 · 2 hari lalu    │
│         [ Lanjut Baca → ]      [ 🗑 ]     │
└───────────────────────────────────────────┘
```
- Tombol "Lanjut Baca" langsung membuka viewer di chapter+posisi terakhir.
- Ikon hapus per-item + tombol "Hapus Semua" di header halaman History.
- Badge "Baru!" muncul jika `chapters.released_at` terbaru komik ini > `reading_history.last_read_at`.

### 3.9 Komponen Pendukung Lain

- **Toast notification**: untuk konfirmasi aksi (mis. "Dihapus dari history"), posisi bottom-center di mobile.
- **Empty state**: ilustrasi sederhana + copy singkat (mis. "Belum ada riwayat baca" + tombol "Mulai baca komik").
- **Skeleton loading**: dipakai di semua list (grid komik, chapter list, history) — hindari spinner polos karena terasa lebih lambat secara persepsi.

---

## 4. Struktur Halaman

### 4.1 Homepage (`/`)

```
[ Navbar ]
[ Hero/Section: Latest Update ]  ← grid card, auto-refresh via ISR
[ Section: Populer Minggu Ini ]  ← horizontal scroll di mobile
[ Section: Rekomendasi ]
[ Section: Baru Ditambahkan ]
[ Footer ]
```
- "Latest Update" adalah section paling atas & paling sering di-refresh (sesuai FR-4.1–4.3).
- Section lain di-render sebagai horizontal scroll carousel di mobile untuk hemat ruang vertikal.

### 4.2 Halaman Browse / Filter / Search (`/cari`, `/browse`)

```
[ Navbar ]
[ Search bar (persist query) ]
[ Filter bar (chip ringkas + tombol "Filter" untuk bottom sheet) ]
[ Grid hasil (infinite scroll) ]
```
- Filter aktif ditampilkan sebagai chip yang bisa di-dismiss satu-satu.
- Jika hasil kosong → empty state dengan saran ("Coba kata kunci lain" / tombol reset filter).

### 4.3 Halaman Detail Komik (`/komik/[slug]`)

```
[ Navbar ]
[ Cover besar | Judul, judul alternatif, author, badge tipe+status, rating ]
[ Genre chips ]
[ Sinopsis (expand/collapse jika panjang) ]
[ Tombol utama: "Baca dari Awal" / "Lanjut Baca" (jika ada history) ]
[ Daftar Chapter — list terurut terbaru→terlama, infinite scroll/pagination ]
```
- Tombol utama berubah kontekstual: user baru → "Baca Chapter 1", user dengan history → "Lanjut Baca Ch. X".
- Setiap item chapter di list menampilkan nomor, judul (jika ada), tanggal rilis, dan indikator "sudah dibaca" (redup/centang) vs "belum dibaca".

### 4.4 Reading Viewer (`/komik/[slug]/[chapter]`)

**Mode Vertical Scroll (default untuk Manhwa, opsi untuk Manga/Manhua):**
- Gambar disusun vertikal penuh lebar, tanpa gap besar antar halaman.
- Lazy-load: hanya render 2–3 halaman ke depan dari posisi scroll saat ini.
- Saat mendekati akhir chapter → tampilkan card kecil "Lanjut ke Chapter berikutnya?" sebelum floating bar diklik.

**Mode Page-by-Page (opsi untuk Manga/Manhua):**
- Satu halaman penuh layar, swipe/tap kiri-kanan untuk pindah halaman.
- Indikator halaman "12 / 24" di header.

**Umum:**
- Progress baca tersimpan otomatis (chapter + opsional posisi scroll/halaman) — trigger saat user pindah chapter atau setiap interval scroll tertentu (throttled), sesuai FR-5.6.
- Full width, minim UI, dark background di semua breakpoint (FR-5.7).

### 4.5 Halaman History Saya (`/history`)

```
[ Navbar ]
[ Judul halaman + tombol "Hapus Semua" ]
[ List History Card, urut last_read_at terbaru→terlama ]
[ Empty state jika belum ada history ]
```
- Guest (belum login): tampilkan pesan bahwa history tidak tersimpan permanen + ajakan login Google, sesuai FR-1.4.

### 4.6 Login

- Tidak perlu halaman penuh — cukup **modal/tombol "Masuk dengan Google"** yang dipicu dari navbar atau saat guest mencoba aksi yang butuh login (mis. buka History).
- Setelah OAuth berhasil, redirect kembali ke halaman asal (bukan selalu ke homepage).

### 4.7 Dashboard Admin (Internal, `/admin`)

Tidak untuk end-user, styling boleh lebih sederhana (utilitarian), prioritaskan kejelasan data:

```
[ Navbar Admin ]
[ Tab: Queue Status | Sumber (Sources) | Log Error ]

Queue Status:
┌──────────────────────────────────────────────┐
│ Chapter          Status     Progress   Aksi   │
│ One Piece Ch.1100 processing  8/20 hal  [Retry]│
│ Solo Leveling Ch.5 failed     -         [Retry]│
└──────────────────────────────────────────────┘

Sources:
[ Tabel daftar sumber + tombol "Tambah Sumber Baru" ]

Log Error:
[ Tabel timestamp | source | pesan error ]
```
- Tabel dengan status berwarna (`pending` abu, `processing` biru, `published` hijau, `failed` merah).
- Tombol "Retry" per-item untuk chapter yang gagal.

---

## 5. Interaksi & UX Detail

- **Lazy-load gambar**: gunakan `next/image` dengan `loading="lazy"` + blur placeholder dari cover/thumbnail kecil.
- **Preload terbatas**: hanya 2–3 halaman ke depan yang di-preload saat scroll di viewer, bukan seluruh chapter (FR-5.5, hemat kuota data pembaca).
- **Auto-hide header di viewer**: header atas viewer menghilang saat scroll ke bawah, muncul lagi saat scroll ke atas — tapi floating bottom bar navigasi chapter **tidak** auto-hide.
- **Debounce search**: 300–400ms, cancel request sebelumnya jika user masih mengetik.
- **Optimistic UI** untuk aksi ringan (hapus history) — hilangkan item dari UI dulu, rollback jika request gagal.
- **Relative time** ("5 menit lalu", "2 hari lalu") dihitung di client agar tidak perlu refresh untuk update.

---

## 6. Aksesibilitas & Responsif

- Kontras teks minimal WCAG AA terhadap latar dark (`text/secondary` di atas `bg/base` sudah dicek ≥ 4.5:1).
- Semua tombol navigasi chapter & kontrol viewer harus punya target sentuh minimal 44×44px.
- Alt text otomatis untuk gambar chapter: `"{judul komik} - Chapter {n} - Halaman {p}"` (membantu SEO & aksesibilitas, sesuai kebutuhan SSR/ISR di NFR).
- Uji layout di lebar 320px (HP kecil) sebagai batas bawah, bukan hanya 375px.

---

## 7. Yang Sengaja Tidak Dibuat di v1

Selaras dengan Non-Goals PRD: tidak ada UI komentar/forum, tidak ada UI pembayaran/premium, tidak ada layout khusus aplikasi native (cukup web responsif). Jangan sediakan ruang kosong di layout untuk fitur ini agar tidak terlihat "belum selesai".
