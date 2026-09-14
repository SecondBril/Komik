-- ========================================================
-- 006_comic_adaptations.sql
-- Table: comic_adaptations (Mapping Comic Chapters to Anime & Novel)
-- ========================================================

create table if not exists comic_adaptations (
  id uuid primary key default gen_random_uuid(),
  comic_id uuid not null references comics(id) on delete cascade,
  start_chapter numeric(10,2) not null,
  end_chapter numeric(10,2) not null,
  anime_season text,             -- e.g. "Season 1"
  anime_episode_range text,      -- e.g. "Episode 1 - 12"
  novel_chapter_range text,      -- e.g. "Chapter 1 - 62"
  novel_volume text,             -- e.g. "Volume 1 - 2"
  arc_title text,                -- e.g. "D-Rank Dungeon & Job Change Arc"
  note text,                     -- e.g. "Episode 7 contains anime-original scenes"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_adaptations_comic on comic_adaptations(comic_id);
create index if not exists idx_adaptations_chapters on comic_adaptations(comic_id, start_chapter, end_chapter);

-- Row Level Security
alter table comic_adaptations enable row level security;

-- Public read access
create policy "public read comic_adaptations" on comic_adaptations
  for select using (true);

-- Trigger for updated_at
create trigger update_comic_adaptations_updated_at
    before update on comic_adaptations
    for each row
    execute function update_updated_at_column();
