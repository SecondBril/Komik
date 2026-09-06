-- ========================================================
-- 001_initial_schema.sql
-- Database DDL for Website Baca Komik (Manga, Manhwa, Manhua)
-- Target: Supabase Postgres
-- ========================================================

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- Enum Types
create type comic_type as enum ('manga', 'manhwa', 'manhua');
create type comic_status as enum ('ongoing', 'completed');
create type chapter_status as enum ('pending', 'processing', 'published', 'failed');

-- Table: sources (Scraping source configuration)
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_url text not null,
  scraping_config jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Table: comics
create table if not exists comics (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  alt_titles text[] default '{}',
  type comic_type not null,
  synopsis text,
  cover_url text,
  author text,
  status comic_status not null default 'ongoing',
  rating numeric(3,2) default 4.5,
  source_id uuid references sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for comics
create index if not exists idx_comics_type on comics(type);
create index if not exists idx_comics_status on comics(status);
create index if not exists idx_comics_title_trgm on comics using gin (title gin_trgm_ops);

-- Table: genres
create table if not exists genres (
  id serial primary key,
  name text unique not null,
  slug text unique not null
);

-- Table: comic_genres (Junction table)
create table if not exists comic_genres (
  comic_id uuid references comics(id) on delete cascade,
  genre_id int references genres(id) on delete cascade,
  primary key (comic_id, genre_id)
);

-- Table: chapters
create table if not exists chapters (
  id uuid primary key default gen_random_uuid(),
  comic_id uuid references comics(id) on delete cascade,
  chapter_number numeric(10,2) not null,
  title text,
  status chapter_status not null default 'pending',
  retry_count int not null default 0,
  released_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (comic_id, chapter_number)
);

-- Indexes for chapters
create index if not exists idx_chapters_status on chapters(status);
create index if not exists idx_chapters_comic_released on chapters(comic_id, released_at desc);
create index if not exists idx_chapters_released_published on chapters(released_at desc) where status = 'published';

-- Table: chapter_pages
create table if not exists chapter_pages (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid references chapters(id) on delete cascade,
  page_number int not null,
  image_url text not null,
  width int,
  height int,
  unique (chapter_id, page_number)
);

-- Table: reading_history (User reading progress)
create table if not exists reading_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  comic_id uuid references comics(id) on delete cascade,
  chapter_id uuid references chapters(id) on delete cascade,
  scroll_position numeric default 0,
  last_read_at timestamptz not null default now(),
  unique (user_id, comic_id)
);

create index if not exists idx_history_user_lastread on reading_history(user_id, last_read_at desc);

-- Table: ingest_logs (Queue execution & error monitoring)
create table if not exists ingest_logs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id) on delete set null,
  chapter_id uuid references chapters(id) on delete set null,
  level text not null check (level in ('info', 'warning', 'error')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ingest_logs_level_time on ingest_logs(level, created_at desc);

-- Automatic updated_at trigger function
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_comics_updated_at
    before update on comics
    for each row
    execute function update_updated_at_column();
