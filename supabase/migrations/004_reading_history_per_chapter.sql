-- ============================================================
-- 004_reading_history_per_chapter.sql
-- Ubah reading_history dari per-komik ke per-chapter
-- ============================================================

-- 1. Hapus constraint unique lama (user_id, comic_id) → per-komik
alter table reading_history drop constraint if exists reading_history_user_id_comic_id_key;

-- 2. Hapus semua baris lama karena skema berubah (opsional, tapi clean)
-- truncate table reading_history;

-- 3. Tambah constraint baru: unique per chapter per user
alter table reading_history
  add constraint reading_history_user_id_chapter_id_key unique (user_id, chapter_id);

-- 4. Tambah index tambahan untuk query per-komik (untuk history page per komik)
create index if not exists idx_history_user_comic on reading_history(user_id, comic_id);

-- 5. Index untuk query semua history user urut waktu terbaca
create index if not exists idx_history_user_time on reading_history(user_id, last_read_at desc);
