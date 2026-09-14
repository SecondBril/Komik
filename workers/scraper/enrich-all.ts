import { getWorkerSupabaseClient } from '../lib/supabase-client';
import {
  fetchComicMetadata,
  syncWorkerComicGenres,
} from '../lib/comic-metadata';

async function enrichAllExistingComics() {
  console.log('====================================================');
  console.log('  ENRICH ALL EXISTING COMICS IN DATABASE (ENGLISH)  ');
  console.log('====================================================\n');

  const supabase = getWorkerSupabaseClient();
  if (!supabase) {
    console.error('❌ Supabase service credentials missing!');
    process.exit(1);
  }

  // 1. Fetch all comics from database
  const { data: comics, error } = await supabase
    .from('comics')
    .select('id, title, slug, type, author, status, rating, synopsis, cover_url, alt_titles')
    .order('title', { ascending: true });

  if (error || !comics) {
    console.error('❌ Failed to fetch comics from database:', error?.message);
    process.exit(1);
  }

  console.log(`Found ${comics.length} total comics in database.\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < comics.length; i++) {
    const c = comics[i];
    const indexStr = `[${i + 1}/${comics.length}]`;

    console.log(`\n${indexStr} Checking "${c.title}"...`);

    try {
      // Search metadata from AniList (with Kitsu fallback)
      const meta = await fetchComicMetadata(c.title);

      if (!meta) {
        console.warn(`⚠️  ${indexStr} No metadata found for "${c.title}". Skipping.`);
        skippedCount++;
        continue;
      }

      console.log(`   Found match on ${meta.sourceApi.toUpperCase()}: "${meta.title}" (${meta.type})`);
      console.log(`   Author: ${meta.author} | Rating: ${meta.rating} | Status: ${meta.status}`);

      // Build update payload
      const updateData: Record<string, any> = {
        type: meta.type,
        status: meta.status,
        rating: meta.rating,
        updated_at: new Date().toISOString(),
      };

      // Update synopsis if current is default or shorter
      if (!c.synopsis || c.synopsis.includes('terjemahan Bahasa Indonesia') || c.synopsis.length < 50) {
        if (meta.synopsis) updateData.synopsis = meta.synopsis;
      }

      // Update author if current is unknown
      if (!c.author || /unknown/i.test(c.author)) {
        if (meta.author && meta.author !== 'Unknown Author') {
          updateData.author = meta.author;
        }
      }

      // Update alt_titles
      const currentAlts = Array.isArray(c.alt_titles) ? c.alt_titles : [];
      const mergedAlts = Array.from(new Set([...currentAlts, ...meta.alt_titles])).filter(
        (t) => t && t !== c.title
      );
      if (mergedAlts.length > 0) {
        updateData.alt_titles = mergedAlts.slice(0, 10);
      }

      // Update cover if current cover is default/unsplash placeholder
      if (
        !c.cover_url ||
        c.cover_url.includes('unsplash') ||
        c.cover_url.includes('placeholder')
      ) {
        if (meta.cover_url) updateData.cover_url = meta.cover_url;
      }

      // Execute update in Supabase
      const { error: updateErr } = await supabase
        .from('comics')
        .update(updateData)
        .eq('id', c.id);

      if (updateErr) {
        console.error(`❌ ${indexStr} Failed to update comic "${c.title}":`, updateErr.message);
        failedCount++;
        continue;
      }

      // Sync genres
      if (meta.genres && meta.genres.length > 0) {
        await syncWorkerComicGenres(supabase, c.id, meta.genres);
        console.log(`   Synced ${meta.genres.length} genres: ${meta.genres.join(', ')}`);
      }

      console.log(`✅ ${indexStr} Successfully enriched "${c.title}"!`);
      updatedCount++;
    } catch (err: any) {
      console.error(`❌ ${indexStr} Error enriching "${c.title}":`, err?.message);
      failedCount++;
    }

    // Delay to respect API rate limits (350ms)
    await new Promise((r) => setTimeout(r, 350));
  }

  console.log('\n====================================================');
  console.log('              ENRICHMENT COMPLETED!                 ');
  console.log(`  Total: ${comics.length}`);
  console.log(`  Updated: ${updatedCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Failed: ${failedCount}`);
  console.log('====================================================\n');
}

enrichAllExistingComics();
