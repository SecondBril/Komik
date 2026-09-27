import fs from 'fs';
import path from 'path';
import { createClient as createTurso } from '@libsql/client';
import { createClient as createSupabase } from '@supabase/supabase-js';

const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[match[1]] = val;
  }
}

const turso = createTurso({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

const supa = createSupabase(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupTables() {
  console.log('--- Setting up Turso Schemas ---');

  // 1. comic_adaptations
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS comic_adaptations (
      id TEXT PRIMARY KEY,
      comic_id TEXT NOT NULL,
      start_chapter REAL NOT NULL,
      end_chapter REAL NOT NULL,
      anime_season TEXT,
      anime_episode_range TEXT,
      novel_volume TEXT,
      novel_chapter_range TEXT,
      arc_title TEXT,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await turso.execute(`CREATE INDEX IF NOT EXISTS idx_adaptations_comic ON comic_adaptations(comic_id);`);
  await turso.execute(`CREATE INDEX IF NOT EXISTS idx_adaptations_ch ON comic_adaptations(comic_id, start_chapter, end_chapter);`);
  console.log('✓ comic_adaptations created');

  // 2. comic_relations_cache
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS comic_relations_cache (
      id TEXT PRIMARY KEY,
      comic_id TEXT NOT NULL UNIQUE,
      franchise_relations TEXT NOT NULL DEFAULT '[]',
      recommendations TEXT NOT NULL DEFAULT '[]',
      characters TEXT NOT NULL DEFAULT '[]',
      sources_used TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await turso.execute(`CREATE INDEX IF NOT EXISTS idx_relations_comic ON comic_relations_cache(comic_id);`);
  console.log('✓ comic_relations_cache created');

  // 3. sources
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      scraping_config TEXT NOT NULL DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✓ sources created');

  // 4. ingest_logs
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS ingest_logs (
      id TEXT PRIMARY KEY,
      source_id TEXT,
      chapter_id TEXT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await turso.execute(`CREATE INDEX IF NOT EXISTS idx_ingest_logs_time ON ingest_logs(created_at DESC);`);
  console.log('✓ ingest_logs created');

  // 5. daily_request_quotas
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS daily_request_quotas (
      id TEXT PRIMARY KEY,
      ip_address TEXT NOT NULL,
      request_date TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ip_address, request_date)
    );
  `);
  console.log('✓ daily_request_quotas created');

  // 6. mature tables
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS mature_genres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT
    );
  `);
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS mature_comics (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      alt_titles TEXT DEFAULT '[]',
      type TEXT NOT NULL,
      synopsis TEXT,
      cover_url TEXT,
      author TEXT,
      status TEXT NOT NULL DEFAULT 'ongoing',
      rating REAL DEFAULT 4.5,
      gore_level TEXT DEFAULT 'Moderate',
      content_warnings TEXT DEFAULT '[]',
      age_restriction INTEGER DEFAULT 18,
      source_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS mature_comic_genres (
      comic_id TEXT NOT NULL,
      genre_id INTEGER NOT NULL,
      PRIMARY KEY (comic_id, genre_id)
    );
  `);
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS mature_chapters (
      id TEXT PRIMARY KEY,
      comic_id TEXT NOT NULL,
      chapter_number REAL NOT NULL,
      title TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      released_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (comic_id, chapter_number)
    );
  `);
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS mature_chapter_pages (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      UNIQUE (chapter_id, page_number)
    );
  `);
  console.log('✓ mature tables created');

  console.log('\n--- Checking & Migrating Small Metadata Tables from Supabase ---');

  // Try migrating sources
  try {
    const { data: supaSources } = await supa.from('sources').select('*');
    if (supaSources && supaSources.length > 0) {
      for (const s of supaSources) {
        await turso.execute({
          sql: `INSERT OR REPLACE INTO sources (id, name, base_url, scraping_config, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?);`,
          args: [
            s.id,
            s.name,
            s.base_url,
            typeof s.scraping_config === 'object' ? JSON.stringify(s.scraping_config) : (s.scraping_config || '{}'),
            s.is_active ? 1 : 0,
            s.created_at || new Date().toISOString()
          ]
        });
      }
      console.log(`Migrated ${supaSources.length} sources to Turso`);
    }
  } catch (e) {
    console.warn('Could not read sources from Supabase:', e.message);
  }

  // Try migrating comic_adaptations
  try {
    const { data: supaAdaptations } = await supa.from('comic_adaptations').select('*');
    if (supaAdaptations && supaAdaptations.length > 0) {
      for (const a of supaAdaptations) {
        await turso.execute({
          sql: `INSERT OR REPLACE INTO comic_adaptations 
                (id, comic_id, start_chapter, end_chapter, anime_season, anime_episode_range, novel_volume, novel_chapter_range, arc_title, note, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          args: [
            a.id,
            a.comic_id,
            a.start_chapter,
            a.end_chapter,
            a.anime_season || null,
            a.anime_episode_range || null,
            a.novel_volume || null,
            a.novel_chapter_range || null,
            a.arc_title || null,
            a.note || null,
            a.created_at || new Date().toISOString(),
            a.updated_at || new Date().toISOString()
          ]
        });
      }
      console.log(`Migrated ${supaAdaptations.length} comic_adaptations to Turso`);
    }
  } catch (e) {
    console.warn('Could not read comic_adaptations from Supabase:', e.message);
  }

  // Try migrating comic_relations_cache
  try {
    const { data: supaRelations } = await supa.from('comic_relations_cache').select('*');
    if (supaRelations && supaRelations.length > 0) {
      for (const r of supaRelations) {
        await turso.execute({
          sql: `INSERT OR REPLACE INTO comic_relations_cache 
                (id, comic_id, franchise_relations, recommendations, characters, sources_used, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?);`,
          args: [
            r.id,
            r.comic_id,
            typeof r.franchise_relations === 'object' ? JSON.stringify(r.franchise_relations) : (r.franchise_relations || '[]'),
            typeof r.recommendations === 'object' ? JSON.stringify(r.recommendations) : (r.recommendations || '[]'),
            typeof r.characters === 'object' ? JSON.stringify(r.characters) : (r.characters || '[]'),
            typeof r.sources_used === 'object' ? JSON.stringify(r.sources_used) : (r.sources_used || '[]'),
            r.updated_at || new Date().toISOString()
          ]
        });
      }
      console.log(`Migrated ${supaRelations.length} comic_relations_cache to Turso`);
    }
  } catch (e) {
    console.warn('Could not read comic_relations_cache from Supabase:', e.message);
  }

  console.log('\nAll Turso table setups completed!');
}

setupTables().catch(console.error);
