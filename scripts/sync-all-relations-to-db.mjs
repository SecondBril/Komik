import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
const env = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
const envVars = {};
for (const l of env.split('\n')) {
  const m = l.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (m) envVars[m[1]] = (m[2] || '').trim().replace(/^"|"$/g, '');
}

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

// Import multi-source relations aggregator
import { fetchFullComicRelations } from '../lib/adaptation-service.ts';

async function syncAll() {
  console.log('=== SYNC ALL COMIC RELATIONS TO SUPABASE (HYBRID PERSISTENCE) ===\n');

  const { data: comics, error } = await supabase
    .from('comics')
    .select('id, title, slug')
    .order('title');

  if (error || !comics) {
    console.error('Failed to fetch comics from DB:', error?.message);
    return;
  }

  console.log(`Found ${comics.length} comics in database.`);

  let synced = 0;
  let skipped = 0;

  for (let i = 0; i < comics.length; i++) {
    const c = comics[i];
    console.log(`[${i + 1}/${comics.length}] Checking "${c.title}" (${c.slug})...`);

    // Check if already in cache
    const { data: existing } = await supabase
      .from('comic_relations_cache')
      .select('id, updated_at')
      .eq('comic_id', c.id)
      .maybeSingle();

    if (existing) {
      console.log(`  ✓ Already in database cache (Synced at ${existing.updated_at}). Skipping.`);
      skipped++;
      continue;
    }

    try {
      console.log(`  → Fetching from multi-source APIs (AniList + MangaUpdates)...`);
      const result = await fetchFullComicRelations(c.title);

      // Save to Supabase
      const { error: upsertErr } = await supabase
        .from('comic_relations_cache')
        .upsert(
          {
            comic_id: c.id,
            franchise_relations: result.franchiseRelations,
            recommendations: result.recommendations,
            characters: result.characters,
            sources_used: result.sourcesUsed,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'comic_id' }
        );

      if (upsertErr) {
        console.error(`  ✗ Failed to save to DB:`, upsertErr.message);
      } else {
        console.log(
          `  ✓ Saved to DB! (${result.franchiseRelations.length} relations, ${result.recommendations.length} recs, ${result.characters.length} characters)`
        );
        synced++;
      }
    } catch (err) {
      console.error(`  ✗ Error syncing ${c.title}:`, err.message);
    }

    // Gentle throttle
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(`\n=== SUMMARY: ${synced} synced to DB, ${skipped} already up to date ===`);
}

syncAll().catch(console.error);
