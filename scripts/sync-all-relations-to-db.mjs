import fs from 'fs';
import path from 'path';
import { createClient as createTurso } from '@libsql/client';

// Load .env.local
const env = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
const envVars = {};
for (const l of env.split('\n')) {
  const m = l.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (m) envVars[m[1]] = (m[2] || '').trim().replace(/^"|"$/g, '');
}

const turso = createTurso({
  url: envVars.TURSO_DATABASE_URL,
  authToken: envVars.TURSO_AUTH_TOKEN,
});

// Import multi-source relations aggregator
import { fetchFullComicRelations } from '../lib/adaptation-service.ts';

async function syncAll() {
  console.log('=== SYNC ALL COMIC RELATIONS TO TURSO ===\n');

  const res = await turso.execute('SELECT id, title, slug FROM comics ORDER BY title ASC;');
  const comics = res.rows;

  console.log(`Found ${comics.length} comics in Turso.`);

  let synced = 0;
  let skipped = 0;

  for (let i = 0; i < comics.length; i++) {
    const c = comics[i];
    console.log(`[${i + 1}/${comics.length}] Checking "${c.title}" (${c.slug})...`);

    // Check if already in cache
    const existing = await turso.execute({
      sql: 'SELECT id, updated_at FROM comic_relations_cache WHERE comic_id = ? LIMIT 1;',
      args: [c.id],
    });

    if (existing.rows.length > 0) {
      console.log(`  ✓ Already in database cache (Synced at ${existing.rows[0].updated_at}). Skipping.`);
      skipped++;
      continue;
    }

    try {
      console.log(`  → Fetching from multi-source APIs (AniList + MangaUpdates)...`);
      const result = await fetchFullComicRelations(String(c.title));

      const now = new Date().toISOString();
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rel_${Date.now()}`;

      await turso.execute({
        sql: `
          INSERT INTO comic_relations_cache (id, comic_id, franchise_relations, recommendations, characters, sources_used, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(comic_id) DO UPDATE SET
            franchise_relations = excluded.franchise_relations,
            recommendations = excluded.recommendations,
            characters = excluded.characters,
            sources_used = excluded.sources_used,
            updated_at = excluded.updated_at;
        `,
        args: [
          id,
          c.id,
          JSON.stringify(result.franchiseRelations || []),
          JSON.stringify(result.recommendations || []),
          JSON.stringify(result.characters || []),
          JSON.stringify(result.sourcesUsed || []),
          now,
        ],
      });

      console.log(
        `  ✓ Saved to Turso! (${result.franchiseRelations.length} relations, ${result.recommendations.length} recs, ${result.characters.length} characters)`
      );
      synced++;
    } catch (err) {
      console.error(`  ✗ Error syncing ${c.title}:`, err.message);
    }

    // Gentle throttle
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(`\n=== SUMMARY: ${synced} synced to Turso, ${skipped} already up to date ===`);
}

syncAll().catch(console.error);
