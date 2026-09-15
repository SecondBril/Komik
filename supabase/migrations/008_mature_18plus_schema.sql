-- ========================================================
-- 008_mature_18plus_schema.sql
-- Database DDL & Seed Data for 18+ Mature & Gore Comics
-- Target: Supabase Postgres
-- ========================================================

-- 1. Tabel mature_comics
create table if not exists mature_comics (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  alt_titles text[] default '{}',
  type comic_type not null default 'manga',
  synopsis text,
  cover_url text,
  author text,
  status comic_status not null default 'ongoing',
  rating numeric(3,2) default 4.85,
  gore_level text default 'Extreme', -- 'Moderate', 'High', 'Extreme'
  content_warnings text[] default '{}',
  age_restriction int default 18,
  source_id uuid references sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mature_comics_type on mature_comics(type);
create index if not exists idx_mature_comics_status on mature_comics(status);
create index if not exists idx_mature_comics_gore on mature_comics(gore_level);
create index if not exists idx_mature_comics_title_trgm on mature_comics using gin (title gin_trgm_ops);

-- 2. Tabel mature_genres (Khusus genre 18+, Gore, Body Horror, dll)
create table if not exists mature_genres (
  id serial primary key,
  name text unique not null,
  slug text unique not null,
  description text
);

-- 3. Tabel junction mature_comic_genres
create table if not exists mature_comic_genres (
  comic_id uuid references mature_comics(id) on delete cascade,
  genre_id int references mature_genres(id) on delete cascade,
  primary key (comic_id, genre_id)
);

-- 4. Tabel mature_chapters
create table if not exists mature_chapters (
  id uuid primary key default gen_random_uuid(),
  comic_id uuid references mature_comics(id) on delete cascade,
  chapter_number numeric(10,2) not null,
  title text,
  status chapter_status not null default 'published',
  retry_count int not null default 0,
  released_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (comic_id, chapter_number)
);

create index if not exists idx_mature_chapters_status on mature_chapters(status);
create index if not exists idx_mature_chapters_comic_released on mature_chapters(comic_id, released_at desc);
create index if not exists idx_mature_chapters_released_published on mature_chapters(released_at desc) where status = 'published';

-- 5. Tabel mature_chapter_pages
create table if not exists mature_chapter_pages (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid references mature_chapters(id) on delete cascade,
  page_number int not null,
  image_url text not null,
  width int,
  height int,
  unique (chapter_id, page_number)
);

-- 6. Tabel mature_reading_history
create table if not exists mature_reading_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  comic_id uuid references mature_comics(id) on delete cascade,
  chapter_id uuid references mature_chapters(id) on delete cascade,
  scroll_position numeric default 0,
  last_read_at timestamptz not null default now(),
  unique (user_id, comic_id)
);

create index if not exists idx_mature_history_user on mature_reading_history(user_id, last_read_at desc);

-- ========================================================
-- RLS POLICIES FOR 18+ TABLES
-- ========================================================

alter table mature_comics enable row level security;
alter table mature_genres enable row level security;
alter table mature_comic_genres enable row level security;
alter table mature_chapters enable row level security;
alter table mature_chapter_pages enable row level security;
alter table mature_reading_history enable row level security;

create policy "public_read_mature_comics" on mature_comics for select using (true);
create policy "public_read_mature_genres" on mature_genres for select using (true);
create policy "public_read_mature_comic_genres" on mature_comic_genres for select using (true);
create policy "public_read_mature_chapters" on mature_chapters for select using (status = 'published');
create policy "public_read_mature_chapter_pages" on mature_chapter_pages for select using (
  exists (
    select 1 from mature_chapters c
    where c.id = mature_chapter_pages.chapter_id
    and c.status = 'published'
  )
);

create policy "user_select_own_mature_history" on mature_reading_history for select using (auth.uid() = user_id);
create policy "user_insert_own_mature_history" on mature_reading_history for insert with check (auth.uid() = user_id);
create policy "user_update_own_mature_history" on mature_reading_history for update using (auth.uid() = user_id);
create policy "user_delete_own_mature_history" on mature_reading_history for delete using (auth.uid() = user_id);

-- ========================================================
-- SEED DATA 18+ MATURE & GORE
-- ========================================================

insert into mature_genres (id, name, slug, description) values
  (101, 'Gore & Splatter', 'gore-splatter', 'Kekerasan grafis tingkat tinggi, pertumpahan darah ekstrem, dan mutilasi.'),
  (102, 'Psychological Horror', 'psychological-horror', 'Ketegangan mental, kegilaan manusia, dan teror psikologis.'),
  (103, 'Survival Death Game', 'survival-death-game', 'Permainan taruhan nyawa di mana kematian mengintai setiap detik.'),
  (104, 'Dark Fantasy', 'dark-fantasy', 'Dunia fantasi kelam dengan iblis, kutukan, dan keputusasaan.'),
  (105, 'Body Horror', 'body-horror', 'Mutasi tubuh mengerikan, deformitas makhluk, dan parasit parasitik.'),
  (106, 'Revenge & Tragedy', 'revenge-tragedy', 'Pembalasan dendam berdarah yang dingin tanpa ampun.'),
  (107, 'Seinen 18+', 'seinen-18', 'Kisah khusus pembaca dewasa berwawasan matang dan tanpa sensor.'),
  (108, 'Mystery & Thriller', 'mystery-thriller', 'Misteri konspirasi pembunuhan berantai dan investigasi kriminal kelam.')
on conflict (id) do update set name = excluded.name, slug = excluded.slug;

-- Seed Komik 18+
insert into mature_comics (id, slug, title, alt_titles, type, synopsis, cover_url, author, status, rating, gore_level, content_warnings, age_restriction)
values
  (
    'e1111111-1111-1111-1111-111111111111',
    'berserk',
    'Berserk',
    ARRAY['Beruseruku', 'The Black Swordsman'],
    'manga',
    'Guts, sang Pendekar Pedang Hitam, mengembara di dunia yang hancur oleh kebiadaban iblis dan pengkhianatan manusia. Berbekal pedang raksasa Dragon Slayer dan lengan palsu bersenjata meriam, ia memburu God Hand yang telah mengorbankan rekan-rekannya.',
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80',
    'Kentaro Miura / Studio Gaga',
    'ongoing',
    4.99,
    'Extreme',
    ARRAY['Kekerasan Ekstrem', 'Adegan Mutilasi Berat', 'Monster & Kegelapan', 'Trauma Psikologis'],
    18
  ),
  (
    'e2222222-2222-2222-2222-222222222222',
    'juujika-no-rokunin',
    'Juujika no Rokunin',
    ARRAY['Cross of the Six People'],
    'manga',
    'Shun Uruma mengalami siksaan brutal tiada henti oleh sekelompok teman sekelasnya yang psikopat hingga seluruh keluarganya tewas. Dilatih oleh kakeknya yang merupakan mantan tentara regu rahasia PD II, Uruma memulai misi eksekusi dendam berantai tanpa ampun kepada 5 pelaku.',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    'Shiryū Nakatake',
    'ongoing',
    4.82,
    'Extreme',
    ARRAY['Penyiksaan Sadis', 'Dendam Berdarah', 'Karakter Psikopat', 'Kekerasan Grafis'],
    18
  ),
  (
    'e3333333-3333-3333-3333-333333333333',
    'bastard-webtoon',
    'Bastard (Hwang Youngchan)',
    ARRAY['Hurejasik'],
    'manhwa',
    'Jin Seon tampak seperti murid SMA biasa yang lemah. Namun ayahnya adalah seorang eksekutif sukses yang diam-diam merupakan pembunuh berantai berdarah dingin yang menargetkan gadis-gadis muda, dan Jin dipaksa menjadi kaki tangannya. Saat ayahnya menargetkan siswi pindahan Kyun Yoon, Jin memutuskan untuk melawan.',
    'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=600&auto=format&fit=crop&q=80',
    'Carnby Kim / Youngchan Hwang',
    'completed',
    4.91,
    'High',
    ARRAY['Pembunuhan Berantai', 'Manipulasi Mental', 'Teror Rumah Tangga', 'Ketegangan Ekstrem'],
    18
  ),
  (
    'e4444444-4444-4444-4444-444444444444',
    'sweet-home',
    'Sweet Home',
    ARRAY['Seuwiteuhom'],
    'manhwa',
    'Cha Hyun-Soo, seorang penyendiri yang kehilangan keluarganya, pindah ke apartemen kumuh Green Home. Tiba-tiba fenomena monsterisasi melanda manusia, mengubah hasrat tergelap mereka menjadi monster mengerikan pemangsa daging. Bersama penghuni yang tersisa, ia harus bertarung demi bertahan hidup.',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    'Carnby Kim / Youngchan Hwang',
    'completed',
    4.88,
    'High',
    ARRAY['Body Horror', 'Monster Pemakan Daging', 'Pertumpahan Darah', 'Kelangsungan Hidup'],
    18
  ),
  (
    'e5555555-5555-5555-5555-555555555555',
    'tokyo-ghoul-dark',
    'Tokyo Ghoul: Resurgence',
    ARRAY['Tōkyō Gūru'],
    'manga',
    'Ken Kaneki menjadi manusia setengah ghoul setelah transplantasi organ dari seorang pemangsa manusia. Di jalanan gelap Tokyo, ghoul hidup menyamar di antara manusia dan berburu mayat, sementara unit kepolisian CCG membasmi mereka dengan senjata kagune.',
    'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=600&auto=format&fit=crop&q=80',
    'Sui Ishida',
    'completed',
    4.94,
    'High',
    ARRAY['Kanibalisme Ghoul', 'Mutilasi Bertarung', 'Pertarungan Brutal', 'Krisis Eksistensial'],
    18
  ),
  (
    'e6666666-6666-6666-6666-666666666666',
    'dead-tube',
    'Dead Tube',
    ARRAY['Deddo Chūbu'],
    'manga',
    'Tomohiro Machiya, anggota klub film, diajak oleh gadis cantik Mai Mashiro untuk merekam segala tindakannya selama 24 jam. Namun rekaman itu diunggah ke "Dead Tube", situs gelap di mana pembuat video bersaing demi views melalui pembunuhan dan kejahatan brutal.',
    'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80',
    'Mikoto Yamaguchi / Touta Kitakawa',
    'ongoing',
    4.79,
    'Extreme',
    ARRAY['Eksploitasi Gelap', 'Kebrutalan Tanpa Sensor', 'Psikopat Berdarah Dingin', 'Kematian Sadis'],
    18
  )
on conflict (slug) do update set
  title = excluded.title,
  synopsis = excluded.synopsis,
  cover_url = excluded.cover_url,
  gore_level = excluded.gore_level,
  content_warnings = excluded.content_warnings;

-- Junction mature_comic_genres
insert into mature_comic_genres (comic_id, genre_id) values
  ('e1111111-1111-1111-1111-111111111111', 101), -- Berserk: Gore
  ('e1111111-1111-1111-1111-111111111111', 104), -- Berserk: Dark Fantasy
  ('e1111111-1111-1111-1111-111111111111', 107), -- Berserk: Seinen 18+

  ('e2222222-2222-2222-2222-222222222222', 101), -- Juujika: Gore
  ('e2222222-2222-2222-2222-222222222222', 102), -- Juujika: Psychological
  ('e2222222-2222-2222-2222-222222222222', 106), -- Juujika: Revenge

  ('e3333333-3333-3333-3333-333333333333', 102), -- Bastard: Psychological
  ('e3333333-3333-3333-3333-333333333333', 108), -- Bastard: Mystery/Thriller

  ('e4444444-4444-4444-4444-444444444444', 101), -- Sweet Home: Gore
  ('e4444444-4444-4444-4444-444444444444', 105), -- Sweet Home: Body Horror
  ('e4444444-4444-4444-4444-444444444444', 103), -- Sweet Home: Survival

  ('e5555555-5555-5555-5555-555555555555', 101), -- Tokyo Ghoul: Gore
  ('e5555555-5555-5555-5555-555555555555', 104), -- Tokyo Ghoul: Dark Fantasy
  ('e5555555-5555-5555-5555-555555555555', 107), -- Tokyo Ghoul: Seinen 18+

  ('e6666666-6666-6666-6666-666666666666', 101), -- Dead Tube: Gore
  ('e6666666-6666-6666-6666-666666666666', 103), -- Dead Tube: Death Game
  ('e6666666-6666-6666-6666-666666666666', 108)  -- Dead Tube: Thriller
on conflict do nothing;

-- Sample Chapters for Berserk
insert into mature_chapters (id, comic_id, chapter_number, title, status, released_at) values
  ('c1111111-0001-0001-0001-000000000001', 'e1111111-1111-1111-1111-111111111111', 375, 'Kabut Kegelapan yang Merayap', 'published', now() - interval '2 days'),
  ('c1111111-0001-0001-0001-000000000002', 'e1111111-1111-1111-1111-111111111111', 374, 'Bahu Menghadap Badai', 'published', now() - interval '14 days'),
  ('c1111111-0001-0001-0001-000000000003', 'e1111111-1111-1111-1111-111111111111', 373, 'Panggilan Darah dan Besi', 'published', now() - interval '30 days')
on conflict do nothing;

-- Sample Chapters for Juujika no Rokunin
insert into mature_chapters (id, comic_id, chapter_number, title, status, released_at) values
  ('c2222222-0001-0001-0001-000000000001', 'e2222222-2222-2222-2222-222222222222', 172, 'Hukuman Salib Ketiga', 'published', now() - interval '1 day'),
  ('c2222222-0001-0001-0001-000000000002', 'e2222222-2222-2222-2222-222222222222', 171, 'Gemetar di Ruang Bawah Tanah', 'published', now() - interval '8 days')
on conflict do nothing;

-- Sample Chapters for Bastard
insert into mature_chapters (id, comic_id, chapter_number, title, status, released_at) values
  ('c3333333-0001-0001-0001-000000000001', 'e3333333-3333-3333-3333-333333333333', 93, 'Penghakiman Terakhir', 'published', now() - interval '5 days'),
  ('c3333333-0001-0001-0001-000000000002', 'e3333333-3333-3333-3333-333333333333', 92, 'Senyuman Sang Monster', 'published', now() - interval '12 days')
on conflict do nothing;
