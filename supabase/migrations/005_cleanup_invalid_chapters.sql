-- ============================================================
-- 005_cleanup_invalid_chapters.sql
-- Membersihkan data chapter yang tidak valid (chapter_number < 1, misalnya 0 atau 0.5)
-- ============================================================

-- 1. Hapus riwayat baca yang terhubung ke chapter tidak valid
DELETE FROM reading_history 
WHERE chapter_id IN (
  SELECT id FROM chapters WHERE chapter_number < 1
);

-- 2. Hapus halaman gambar (chapter_pages) yang terhubung ke chapter tidak valid
DELETE FROM chapter_pages 
WHERE chapter_id IN (
  SELECT id FROM chapters WHERE chapter_number < 1
);

-- 3. Hapus chapter yang tidak valid (< 1)
DELETE FROM chapters 
WHERE chapter_number < 1;

-- ============================================================
-- (OPSIONAL) Query jika ingin reset / hapus seluruh chapter dari komik tertentu 
-- untuk di-scraping ulang dari awal:
--
-- DELETE FROM reading_history WHERE comic_id IN (SELECT id FROM comics WHERE slug = 'SLUG-KOMIK-ANDA');
-- DELETE FROM chapter_pages WHERE chapter_id IN (SELECT id FROM chapters WHERE comic_id IN (SELECT id FROM comics WHERE slug = 'SLUG-KOMIK-ANDA'));
-- DELETE FROM chapters WHERE comic_id IN (SELECT id FROM comics WHERE slug = 'SLUG-KOMIK-ANDA');
-- ============================================================
