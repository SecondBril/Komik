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
  const tables = ['genres', 'comics', 'comic_genres', 'chapters', 'chapter_pages'];
  console.log('--- TURSO DATABASE SUMMARY ---');
  for (const t of tables) {
    const res = await client.execute(`SELECT COUNT(*) as c FROM ${t};`);
    console.log(`${t.padEnd(16)}: ${Number(res.rows[0].c).toLocaleString('id-ID')} rows`);
  }

  // Quick test: fetch sample pages of a chapter that has pages
  const samplePage = await client.execute('SELECT chapter_id FROM chapter_pages LIMIT 1;');
  const chId = samplePage.rows[0].chapter_id;
  const start = Date.now();
  const pages = await client.execute({
    sql: 'SELECT * FROM chapter_pages WHERE chapter_id = ? ORDER BY page_number ASC;',
    args: [chId],
  });
  console.log(`\nTest Reader Query for chapter [${chId}]: ${pages.rows.length} pages retrieved in ${Date.now() - start}ms`);
  if (pages.rows.length > 0) {
    console.log(`Sample image URL: ${pages.rows[0].image_url}`);
  }
}

verify().catch(console.error);
