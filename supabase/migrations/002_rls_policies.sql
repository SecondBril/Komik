-- ========================================================
-- 002_rls_policies.sql
-- Row Level Security (RLS) policies for Website Baca Komik
-- ========================================================

-- Enable Row Level Security on all core tables
alter table comics enable row level security;
alter table genres enable row level security;
alter table comic_genres enable row level security;
alter table chapters enable row level security;
alter table chapter_pages enable row level security;
alter table reading_history enable row level security;
alter table sources enable row level security;
alter table ingest_logs enable row level security;

-- 1. PUBLIC READ POLICIES (Anon + Authenticated)
create policy "public_read_comics" on comics
  for select using (true);

create policy "public_read_genres" on genres
  for select using (true);

create policy "public_read_comic_genres" on comic_genres
  for select using (true);

create policy "public_read_published_chapters" on chapters
  for select using (status = 'published');

create policy "public_read_chapter_pages" on chapter_pages
  for select using (
    exists (
      select 1 from chapters c
      where c.id = chapter_pages.chapter_id
      and c.status = 'published'
    )
  );

-- 2. USER READING HISTORY POLICIES (Authenticated user only)
create policy "user_select_own_history" on reading_history
  for select using (auth.uid() = user_id);

create policy "user_insert_own_history" on reading_history
  for insert with check (auth.uid() = user_id);

create policy "user_update_own_history" on reading_history
  for update using (auth.uid() = user_id);

create policy "user_delete_own_history" on reading_history
  for delete using (auth.uid() = user_id);

-- 3. ADMIN & INGEST POLICIES (sources & ingest_logs deny all public access by default)
-- Mutation operations on comics, chapters, pages, sources, and logs
-- are restricted strictly to service_role key (used by GitHub Actions workers & Admin API routes).
