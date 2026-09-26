import fs from 'fs';
import { createClient } from '@libsql/client';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
}

const client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

async function verify() {
  await client.execute("CREATE INDEX IF NOT EXISTS idx_comic_genres_genre ON comic_genres(genre_id);");
  const indexes = await client.execute("PRAGMA index_list('comic_genres');");
  console.log('comic_genres indexes:', indexes.rows);
  const tables = ['genres', 'comics', 'comic_genres', 'chapters', 'chapter_pages'];
  console.log('--- TURSO DATABASE SUMMARY ---');
  for (const t of tables) {
    const res = await client.execute(`SELECT COUNT(*) as c FROM ${t};`);
    console.log(`${t.padEnd(16)}: ${Number(res.rows[0].c).toLocaleString('id-ID')} rows`);
  }

  // Benchmark homepage queries
  const t1 = Date.now();
  const res1 = await client.execute(`
    SELECT c.id, c.slug, c.title, c.alt_titles, c.type, c.synopsis, c.cover_url,
      c.author, c.status, c.rating, c.updated_at, c.created_at,
      c.latest_chapter_number, c.latest_chapter_date,
      (SELECT json_group_array(json_object('id', g.id, 'name', g.name, 'slug', g.slug))
       FROM comic_genres cg JOIN genres g ON g.id = cg.genre_id WHERE cg.comic_id = c.id) as genres_json
    FROM comics c ORDER BY c.updated_at DESC LIMIT 18;
  `);
  console.log('q1 (latest comics 18):', Date.now() - t1, 'ms');

  const t2 = Date.now();
  const res2 = await client.execute(`
    SELECT c.id, c.slug, c.title, c.alt_titles, c.type, c.synopsis, c.cover_url,
      c.author, c.status, c.rating, c.updated_at, c.created_at,
      c.latest_chapter_number, c.latest_chapter_date,
      (SELECT json_group_array(json_object('id', g.id, 'name', g.name, 'slug', g.slug))
       FROM comic_genres cg JOIN genres g ON g.id = cg.genre_id WHERE cg.comic_id = c.id) as genres_json
    FROM comics c ORDER BY c.rating DESC LIMIT 10;
  `);
  console.log('q2 (popular comics 10):', Date.now() - t2, 'ms');

  const t3 = Date.now();
  const res3 = await client.execute(`
    SELECT g.id, g.name, g.slug, COUNT(cg.comic_id) as count
    FROM genres g LEFT JOIN comic_genres cg ON cg.genre_id = g.id
    GROUP BY g.id, g.name, g.slug ORDER BY g.name ASC;
  `);
  console.log('q3 (genres with counts):', Date.now() - t3, 'ms');
}

verify().catch(console.error);
