import fs from 'fs';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createTursoClient } from '@libsql/client';

// 1. Load .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const tursoUrl = env.TURSO_DATABASE_URL;
const tursoToken = env.TURSO_AUTH_TOKEN;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials missing in .env.local');
  process.exit(1);
}

if (!tursoUrl || !tursoToken) {
  console.error('❌ Turso credentials (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN) missing in .env.local');
  process.exit(1);
}

const supabase = createSupabaseClient(supabaseUrl, supabaseKey);
const turso = createTursoClient({ url: tursoUrl, authToken: tursoToken });

async function initTursoSchema() {
  console.log('📌 Menyiapkan skema tabel di Turso...');
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS comics (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      alt_titles TEXT,
      type TEXT NOT NULL DEFAULT 'manhwa',
      synopsis TEXT,
      cover_url TEXT,
      author TEXT,
      status TEXT NOT NULL DEFAULT 'ongoing',
      rating REAL DEFAULT 4.5,
      latest_chapter_number REAL,
      latest_chapter_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await turso.execute(`CREATE INDEX IF NOT EXISTS idx_comics_updated_at ON comics (updated_at DESC);`);
  await turso.execute(`CREATE INDEX IF NOT EXISTS idx_comics_rating ON comics (rating DESC);`);
  await turso.execute(`CREATE INDEX IF NOT EXISTS idx_comics_type ON comics (type);`);
  await turso.execute(`CREATE INDEX IF NOT EXISTS idx_comics_status ON comics (status);`);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS genres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL
    );
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS comic_genres (
      comic_id TEXT REFERENCES comics(id) ON DELETE CASCADE,
      genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE,
      PRIMARY KEY (comic_id, genre_id)
    );
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      comic_id TEXT REFERENCES comics(id) ON DELETE CASCADE,
      chapter_number REAL NOT NULL,
      title TEXT,
      status TEXT DEFAULT 'published',
      pages TEXT,
      released_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (comic_id, chapter_number)
    );
  `);

  await turso.execute(`CREATE INDEX IF NOT EXISTS idx_chapters_comic ON chapters (comic_id, chapter_number DESC);`);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS chapter_pages (
      id TEXT PRIMARY KEY,
      chapter_id TEXT REFERENCES chapters(id) ON DELETE CASCADE,
      page_number INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      UNIQUE (chapter_id, page_number)
    );
  `);
  await turso.execute(`CREATE INDEX IF NOT EXISTS idx_chapter_pages_ch ON chapter_pages (chapter_id, page_number ASC);`);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS reading_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      comic_id TEXT REFERENCES comics(id) ON DELETE CASCADE,
      chapter_id TEXT REFERENCES chapters(id) ON DELETE CASCADE,
      scroll_position REAL DEFAULT 0,
      last_read_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, comic_id)
    );
  `);
  console.log('✅ Skema tabel di Turso siap!');
}

async function migrateGenres() {
  console.log('\n--- 1. Migrasi Genres ---');
  const { data: genres, error } = await supabase.from('genres').select('*').order('id');
  if (error || !genres) {
    console.error('Gagal mengambil genres dari Supabase:', error);
    return;
  }

  const stmts = genres.map((g) => ({
    sql: `INSERT OR REPLACE INTO genres (id, name, slug) VALUES (?, ?, ?)`,
    args: [g.id, g.name, g.slug],
  }));

  if (stmts.length > 0) {
    await turso.batch(stmts, 'write');
    console.log(`✓ Berhasil memindahkan ${genres.length} genres ke Turso.`);
  }
}

async function migrateComics() {
  console.log('\n--- 2. Migrasi Comics ---');
  const { count: totalComics } = await supabase.from('comics').select('*', { count: 'exact', head: true });
  console.log(`Total komik di Supabase: ${totalComics}`);

  const batchSize = 250;
  let offset = 0;
  let migrated = 0;

  while (offset < (totalComics || 0)) {
    const { data: comics, error } = await supabase
      .from('comics')
      .select('id, slug, title, alt_titles, type, synopsis, cover_url, author, status, rating, created_at, updated_at')
      .order('id', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error || !comics || comics.length === 0) break;

    const stmts = comics.map((c) => ({
      sql: `INSERT OR REPLACE INTO comics (
        id, slug, title, alt_titles, type, synopsis, cover_url, author, status, rating, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        c.id,
        c.slug,
        c.title,
        JSON.stringify(c.alt_titles || []),
        c.type || 'manhwa',
        c.synopsis || '',
        c.cover_url || '',
        c.author || 'Unknown',
        c.status || 'ongoing',
        c.rating || 4.5,
        c.created_at || new Date().toISOString(),
        c.updated_at || new Date().toISOString(),
      ],
    }));

    await turso.batch(stmts, 'write');
    migrated += comics.length;
    process.stdout.write(`\rMemindahkan komik: ${migrated}/${totalComics} (${Math.round((migrated / totalComics) * 100)}%)`);
    offset += batchSize;
  }
  console.log(`\n✓ Selesai memindahkan ${migrated} komik ke Turso.`);
}

async function migrateComicGenres() {
  console.log('\n--- 3. Migrasi Comic Genres Junction ---');
  const { count: totalRel } = await supabase.from('comic_genres').select('*', { count: 'exact', head: true });
  console.log(`Total relasi comic_genres: ${totalRel}`);

  const batchSize = 500;
  let offset = 0;
  let migrated = 0;

  while (offset < (totalRel || 0)) {
    const { data: rows, error } = await supabase
      .from('comic_genres')
      .select('comic_id, genre_id')
      .range(offset, offset + batchSize - 1);

    if (error || !rows || rows.length === 0) break;

    const stmts = rows.map((r) => ({
      sql: `INSERT OR IGNORE INTO comic_genres (comic_id, genre_id) VALUES (?, ?)`,
      args: [r.comic_id, r.genre_id],
    }));

    await turso.batch(stmts, 'write');
    migrated += rows.length;
    process.stdout.write(`\rMemindahkan relasi genre: ${migrated}/${totalRel} (${Math.round((migrated / totalRel) * 100)}%)`);
    offset += batchSize;
  }
  console.log(`\n✓ Selesai memindahkan ${migrated} relasi genre ke Turso.`);
}

async function migrateChapters() {
  console.log('\n--- 4. Migrasi Chapters (287k+ data) ---');
  const { count: totalChapters } = await supabase.from('chapters').select('*', { count: 'exact', head: true });
  console.log(`Total chapters di Supabase: ${totalChapters}`);

  // Resume from existing count in Turso so we never re-transfer already migrated chapters
  const currentTursoCount = await turso.execute('SELECT COUNT(*) as count FROM chapters;');
  let migrated = Number(currentTursoCount.rows[0]?.count || 0);
  let offset = migrated;
  console.log(`Chapters yang sudah ada di Turso: ${migrated}. Melanjutkan dari offset ${offset}...`);

  const batchSize = 500;

  while (offset < (totalChapters || 0)) {
    let retries = 5;
    let chapters = null;

    while (retries > 0) {
      try {
        const { data, error } = await supabase
          .from('chapters')
          .select('id, comic_id, chapter_number, title, status, released_at, created_at')
          .order('id', { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        chapters = data;
        break;
      } catch (fetchErr) {
        retries--;
        console.warn(`\n[Retry ${5 - retries}/5] Koneksi Supabase terputus di offset ${offset}: ${fetchErr.message}. Menunggu 3 detik...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    if (!chapters || chapters.length === 0) break;

    const stmts = chapters.map((ch) => ({
      sql: `INSERT OR REPLACE INTO chapters (
        id, comic_id, chapter_number, title, status, released_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        ch.id,
        ch.comic_id,
        Number(ch.chapter_number),
        ch.title || `Chapter ${ch.chapter_number}`,
        ch.status || 'published',
        ch.released_at || new Date().toISOString(),
        ch.created_at || new Date().toISOString(),
      ],
    }));

    await turso.batch(stmts, 'write');
    migrated += chapters.length;
    process.stdout.write(`\rMemindahkan chapters: ${migrated}/${totalChapters} (${Math.round((migrated / totalChapters) * 100)}%)`);
    offset += batchSize;
  }
  console.log(`\n✓ Selesai memindahkan ${migrated} chapters ke Turso.`);
}

async function updateLatestChapterColumnsInTurso() {
  console.log('\n--- 5. Denormalisasi Chapter Terbaru ke Tabel Comics di Turso ---');
  console.log('Mengisi kolom latest_chapter_number & latest_chapter_date di Turso untuk query instan 5ms...');
  
  await turso.execute(`
    UPDATE comics
    SET 
      latest_chapter_number = (
        SELECT chapter_number FROM chapters 
        WHERE chapters.comic_id = comics.id 
        ORDER BY chapter_number DESC LIMIT 1
      ),
      latest_chapter_date = (
        SELECT released_at FROM chapters 
        WHERE chapters.comic_id = comics.id 
        ORDER BY chapter_number DESC LIMIT 1
      )
    WHERE EXISTS (
      SELECT 1 FROM chapters WHERE chapters.comic_id = comics.id
    );
  `);
  console.log('✅ Denormalisasi kolom chapter selesai!');
}

async function main() {
  const startTime = Date.now();
  console.log('====================================================');
  console.log('🚀 MEMULAI MIGRASI LENGKAP: SUPABASE -> TURSO (5 GB)');
  console.log('====================================================');

  await initTursoSchema();

  const { rows: gCount } = await turso.execute('SELECT COUNT(*) as c FROM genres;');
  if (Number(gCount[0].c) < 41) {
    await migrateGenres();
  } else {
    console.log(`✓ 1. Genres sudah lengkap (${gCount[0].c}/41), lewati.`);
  }

  const { rows: cCount } = await turso.execute('SELECT COUNT(*) as c FROM comics;');
  if (Number(cCount[0].c) < 5931) {
    await migrateComics();
  } else {
    console.log(`✓ 2. Comics sudah lengkap (${cCount[0].c}/5931), lewati.`);
  }

  const { rows: cgCount } = await turso.execute('SELECT COUNT(*) as c FROM comic_genres;');
  if (Number(cgCount[0].c) < 15522) {
    await migrateComicGenres();
  } else {
    console.log(`✓ 3. Relasi comic_genres sudah lengkap (${cgCount[0].c}/15522), lewati.`);
  }

  await migrateChapters();
  await updateLatestChapterColumnsInTurso();

  const durationMin = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log('\n====================================================');
  console.log(`🎉 MIGRASI SUKSES DALAM ${durationMin} MENIT!`);
  console.log('====================================================\n');
}

main().catch(console.error);
