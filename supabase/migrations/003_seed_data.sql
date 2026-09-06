-- ========================================================
-- 003_seed_data.sql
-- Initial Seed Data for Website Baca Komik
-- ========================================================

-- Insert Sources
insert into sources (id, name, base_url, scraping_config, is_active)
values
  ('11111111-1111-1111-1111-111111111111', 'Kiryuu Engine', 'https://kiryuu.id', '{"selector_title": "h1.entry-title", "selector_images": ".ts-main-image"}', true),
  ('22222222-2222-2222-2222-222222222222', 'Asura Scans ID', 'https://asuracomics.com', '{"selector_title": ".entry-title", "selector_images": "#readerarea img"}', true)
on conflict do nothing;

-- Insert Genres
insert into genres (id, name, slug) values
  (1, 'Action', 'action'),
  (2, 'Adventure', 'adventure'),
  (3, 'Fantasy', 'fantasy'),
  (4, 'System', 'system'),
  (5, 'Romance', 'romance'),
  (6, 'Martial Arts', 'martial-arts'),
  (7, 'Isekai', 'isekai'),
  (8, 'Comedy', 'comedy'),
  (9, 'Drama', 'drama'),
  (10, 'Supernatural', 'supernatural')
on conflict do nothing;

-- Insert Sample Comics
insert into comics (id, slug, title, alt_titles, type, synopsis, cover_url, author, status, rating, source_id, created_at, updated_at)
values
  (
    'a1111111-1111-1111-1111-111111111111',
    'solo-leveling',
    'Solo Leveling',
    ARRAY['Na Honjaman Releveling', 'Only I Level Up'],
    'manhwa',
    '10 tahun yang lalu, setelah "Gerbang" yang menghubungkan dunia nyata dengan dunia monster terbuka, beberapa orang biasa mendapatkan kekuatan untuk berburu monster di dalam Gerbang. Mereka dikenal sebagai "Hunter". Sung Jin-Woo, seorang Hunter peringkat E terlemah, berjuang di dungeon paling berbahaya.',
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    'Chugong / DUBU (REDICE STUDIO)',
    'ongoing',
    4.95,
    '11111111-1111-1111-1111-111111111111',
    now() - interval '10 days',
    now() - interval '5 minutes'
  ),
  (
    'a2222222-2222-2222-2222-222222222222',
    'one-piece',
    'One Piece',
    ARRAY['Wan Pīsu'],
    'manga',
    'Monkey D. Luffy menolak definisi bajak laut biasa. Alih-alih merampok dan menghancurkan, Luffy mencari petualangan menarik yang mempertemukannya dengan orang-orang hebat dan harta karun terbesar dunia, One Piece.',
    'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80',
    'Eiichiro Oda',
    'ongoing',
    4.98,
    '11111111-1111-1111-1111-111111111111',
    now() - interval '20 days',
    now() - interval '12 minutes'
  ),
  (
    'a3333333-3333-3333-3333-333333333333',
    'martial-peak',
    'Martial Peak',
    ARRAY['Wu Lian Dian Feng'],
    'manhua',
    'Perjalanan menuju puncak bela diri adalah perjalanan yang panjang, kesepian, dan penuh tantangan. Kai Yang, seorang murid penyapu di Paviliun Lingxiao, menemukan Kitab Hitam misterius yang mengubah takdirnya.',
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    'Momo',
    'ongoing',
    4.78,
    '22222222-2222-2222-2222-222222222222',
    now() - interval '30 days',
    now() - interval '30 minutes'
  ),
  (
    'a4444444-4444-4444-4444-444444444444',
    'tower-of-god',
    'Tower of God',
    ARRAY['Sin-ui Tap'],
    'manhwa',
    'Apa yang kamu inginkan? Kekayaan? Kehormatan? Wewenang? Kekuatan? Balas dendam? Atau sesuatu yang melampaui itu semua? Apapun yang kamu cari, ada di puncak Menara.',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    'SIU',
    'ongoing',
    4.85,
    '22222222-2222-2222-2222-222222222222',
    now() - interval '15 days',
    now() - interval '2 hours'
  ),
  (
    'a5555555-5555-5555-5555-555555555555',
    'jujutsu-kaisen',
    'Jujutsu Kaisen',
    ARRAY['Sorcery Fight'],
    'manga',
    'Yuji Itadori menelan kutukan tingkat tinggi Ryomen Sukuna untuk menyelamatkan temannya, menjadikannya wadah raja kutukan dan membawanya ke dunia Penyihir Jujutsu.',
    'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80',
    'Gege Akutami',
    'completed',
    4.90,
    '11111111-1111-1111-1111-111111111111',
    now() - interval '40 days',
    now() - interval '1 day'
  )
on conflict do nothing;

-- Map Comic Genres
insert into comic_genres (comic_id, genre_id) values
  ('a1111111-1111-1111-1111-111111111111', 1), -- Solo Leveling: Action
  ('a1111111-1111-1111-1111-111111111111', 3), -- Solo Leveling: Fantasy
  ('a1111111-1111-1111-1111-111111111111', 4), -- Solo Leveling: System
  ('a2222222-2222-2222-2222-222222222222', 1), -- One Piece: Action
  ('a2222222-2222-2222-2222-222222222222', 2), -- One Piece: Adventure
  ('a2222222-2222-2222-2222-222222222222', 8), -- One Piece: Comedy
  ('a3333333-3333-3333-3333-333333333333', 1), -- Martial Peak: Action
  ('a3333333-3333-3333-3333-333333333333', 6), -- Martial Peak: Martial Arts
  ('a4444444-4444-4444-4444-444444444444', 1), -- Tower of God: Action
  ('a4444444-4444-4444-4444-444444444444', 3), -- Tower of God: Fantasy
  ('a5555555-5555-5555-5555-555555555555', 1), -- Jujutsu Kaisen: Action
  ('a5555555-5555-5555-5555-555555555555', 10) -- Jujutsu Kaisen: Supernatural
on conflict do nothing;

-- Insert Sample Chapters
insert into chapters (id, comic_id, chapter_number, title, status, released_at)
values
  ('c1111111-1111-1111-1111-111111111101', 'a1111111-1111-1111-1111-111111111111', 179, 'Kebangkitan Sang Shadow Monarch', 'published', now() - interval '5 minutes'),
  ('c1111111-1111-1111-1111-111111111102', 'a1111111-1111-1111-1111-111111111111', 178, 'Pertempuran Terakhir di Seoul', 'published', now() - interval '1 day'),
  ('c1111111-1111-1111-1111-111111111103', 'a1111111-1111-1111-1111-111111111111', 1, 'Pemburu Terlemah Kelas E', 'published', now() - interval '30 days'),
  ('c2222222-2222-2222-2222-222222222201', 'a2222222-2222-2222-2222-222222222222', 1115, 'Dunia yang Tenggelam', 'published', now() - interval '12 minutes'),
  ('c2222222-2222-2222-2222-222222222202', 'a2222222-2222-2222-2222-222222222222', 1114, 'Pesan Vegapunk Kepada Dunia', 'published', now() - interval '7 days'),
  ('c3333333-3333-3333-3333-333333333301', 'a3333333-3333-3333-3333-333333333333', 3520, 'Terobosan Ranah Kaisar', 'published', now() - interval '30 minutes'),
  ('c4444444-4444-4444-4444-444444444401', 'a4444444-4444-4444-4444-444444444444', 600, 'Kebenaran di Lantai 135', 'published', now() - interval '2 hours')
on conflict do nothing;

-- Insert Sample Chapter Pages for Solo Leveling Ch. 179
insert into chapter_pages (id, chapter_id, page_number, image_url, width, height)
values
  ('p101', 'c1111111-1111-1111-1111-111111111101', 1, 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80', 800, 1200),
  ('p102', 'c1111111-1111-1111-1111-111111111101', 2, 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1000&auto=format&fit=crop&q=80', 800, 1200),
  ('p103', 'c1111111-1111-1111-1111-111111111101', 3, 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1000&auto=format&fit=crop&q=80', 800, 1200),
  ('p104', 'c1111111-1111-1111-1111-111111111101', 4, 'https://images.unsplash.com/photo-1563089145-599997674d42?w=1000&auto=format&fit=crop&q=80', 800, 1200),
  ('p105', 'c1111111-1111-1111-1111-111111111101', 5, 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1000&auto=format&fit=crop&q=80', 800, 1200)
on conflict do nothing;
