-- ========================================================
-- 007_comic_relations_cache.sql
-- Hybrid Persistence for Franchise Relations, Recommendations & Characters
-- ========================================================

create table if not exists comic_relations_cache (
  id uuid primary key default gen_random_uuid(),
  comic_id uuid not null references comics(id) on delete cascade unique,
  franchise_relations jsonb not null default '[]',
  recommendations jsonb not null default '[]',
  characters jsonb not null default '[]',
  sources_used text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- Index for fast lookup by comic_id
create index if not exists idx_comic_relations_comic on comic_relations_cache(comic_id);

-- Enable RLS
alter table comic_relations_cache enable row level security;

-- Public read access
create policy "public read comic_relations_cache" on comic_relations_cache
  for select using (true);
