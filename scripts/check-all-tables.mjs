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

async function check() {
  console.log('--- TURSO TABLES & COUNTS ---');
  const tTables = await turso.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
  for (const row of tTables.rows) {
    const tName = row.name;
    if (tName.startsWith('sqlite_') || tName.startsWith('_litestream')) continue;
    try {
      const cnt = await turso.execute(`SELECT COUNT(*) as c FROM ${tName};`);
      console.log(`Turso ${tName}: ${cnt.rows[0].c} rows`);
    } catch(e) {
      console.log(`Turso ${tName}: error (${e.message})`);
    }
  }

  console.log('\n--- SUPABASE TABLES CHECK ---');
  const candidates = [
    'comics', 'chapters', 'chapter_pages', 'genres', 'comic_genres',
    'reading_history', 'comic_adaptations', 'sources', 'ingest_logs',
    'mature_comics', 'mature_genres', 'mature_chapters', 'mature_comic_genres'
  ];
  for (const c of candidates) {
    try {
      const { count, error } = await supa.from(c).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`Supabase ${c}: error (${error.message})`);
      } else {
        console.log(`Supabase ${c}: ${count} rows`);
      }
    } catch (e) {
      console.log(`Supabase ${c}: exception (${e.message})`);
    }
  }
}

check().catch(console.error);
