-- ========================================================
-- 010_performance_indexes.sql
-- Performance Indexes for Ultra-Fast Comic Ingestion & Browsing
-- Target: Supabase Postgres
-- ========================================================

-- 1. Index for comics ordering by updated_at (Used on Homepage & Browse latest updates)
CREATE INDEX IF NOT EXISTS idx_comics_updated_at_desc ON comics (updated_at DESC);

-- 2. Index for comics ordering by rating (Used on Homepage Carousel & Browse popular)
CREATE INDEX IF NOT EXISTS idx_comics_rating_desc ON comics (rating DESC);

-- 3. Composite Index for chapters lookup by comic_id & chapter_number (Used for instant latest_chapter retrieval)
CREATE INDEX IF NOT EXISTS idx_chapters_comic_chapter_desc ON chapters (comic_id, chapter_number DESC);

-- 4. Index for mature comics
CREATE INDEX IF NOT EXISTS idx_mature_comics_updated_at_desc ON mature_comics (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mature_comics_rating_desc ON mature_comics (rating DESC);
CREATE INDEX IF NOT EXISTS idx_mature_chapters_comic_chapter_desc ON mature_chapters (comic_id, chapter_number DESC);
