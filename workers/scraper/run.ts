import { getWorkerSupabaseClient } from '../lib/supabase-client';
import {
  getSharedPuppeteerBrowser,
  getComicDetailWithPuppeteer,
  scrapeChapterPageWithPuppeteer,
} from './parse-source';

async function runScraperWorker() {
  console.log('[Scraper Worker] Starting ingestion run...');
  const supabase = getWorkerSupabaseClient();

  if (!supabase) {
    console.log('[Scraper Worker] Simulation completed (No DB connection provided).');
    return;
  }

  const browser = await getSharedPuppeteerBrowser();
  if (!browser) {
    console.error('[Scraper Worker] Failed to start Chrome Puppeteer engine. Exiting.');
    return;
  }

  try {
    // 1. Get active sources
    const { data: sources, error } = await supabase
      .from('sources')
      .select('*')
      .eq('is_active', true);

    if (error || !sources || sources.length === 0) {
      console.log('[Scraper Worker] No active sources found.');
      return;
    }

    for (const source of sources) {
      console.log(`\n==================================================`);
      console.log(`[Scraper Worker] Checking source: ${source.name} (${source.base_url})`);

      // Discover comic details & all available chapters on the page
      const comicDetail = await getComicDetailWithPuppeteer(browser, source.base_url);
      if (!comicDetail || comicDetail.chapters.length === 0) {
        console.warn(`[Scraper Worker] Could not extract chapter list from ${source.base_url}. Skipping.`);
        continue;
      }

      // 2. Find or Auto-Create Comic in Supabase
      let { data: comic } = await supabase
        .from('comics')
        .select('id, title, slug')
        .eq('slug', comicDetail.comicSlug)
        .single();

      if (!comic) {
        console.log(`[Scraper Worker] Comic "${comicDetail.comicTitle}" not found in DB. Auto-creating comic...`);
        const coverUrl =
          comicDetail.coverUrl ||
          'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

        const { data: newComic, error: comicErr } = await supabase
          .from('comics')
          .insert({
            slug: comicDetail.comicSlug,
            title: comicDetail.comicTitle,
            type: 'manhwa',
            synopsis: `Komik ${comicDetail.comicTitle} terjemahan Bahasa Indonesia terbaru.`,
            cover_url: coverUrl,
            author: 'Unknown Author',
            status: 'ongoing',
            rating: 4.8,
            source_id: source.id,
          })
          .select('id, title, slug')
          .single();

        if (comicErr || !newComic) {
          console.error(`[Scraper Worker] Failed to auto-create comic "${comicDetail.comicTitle}":`, comicErr);
          continue;
        }
        comic = newComic;
        console.log(`[Scraper Worker] Successfully created comic "${comic.title}" (ID: ${comic.id}).`);
      }

      // 3. DB-FIRST CHECK: Fetch ALL existing chapter numbers for this comic from Supabase
      const { data: existingChapters } = await supabase
        .from('chapters')
        .select('chapter_number')
        .eq('comic_id', comic.id);

      const existingChapterNumbers = new Set(
        (existingChapters || []).map((ch) => ch.chapter_number)
      );

      console.log(
        `[Scraper Worker] Comic "${comic.title}" has ${existingChapterNumbers.size} existing chapters in DB. Total chapters available on site: ${comicDetail.chapters.length}.`
      );

      // 4. Iterate over ALL chapters discovered on site
      for (const chItem of comicDetail.chapters) {
        // IDEMPOTENCY CHECK BEFORE OPENING PUPPETEER READER PAGE
        if (existingChapterNumbers.has(chItem.chapterNumber)) {
          console.log(
            `[Scraper Worker] -> Chapter ${chItem.chapterNumber} for "${comic.title}" ALREADY EXISTS in DB. SKIPPING.`
          );
          continue;
        }

        // NEW CHAPTER DETECTED! Scrape images using Puppeteer
        console.log(
          `[Scraper Worker] -> NEW Chapter ${chItem.chapterNumber} detected for "${comic.title}"! Scraping images...`
        );

        const chapterData = await scrapeChapterPageWithPuppeteer(
          browser,
          chItem.url,
          comicDetail.comicTitle,
          comicDetail.comicSlug,
          chItem.chapterNumber
        );

        if (!chapterData || chapterData.rawImageUrls.length === 0) {
          console.warn(
            `[Scraper Worker] Could not extract images for Chapter ${chItem.chapterNumber}. Skipping.`
          );
          continue;
        }

        // 5. Insert new chapter into DB as 'pending'
        const { data: newChapter, error: insertErr } = await supabase
          .from('chapters')
          .insert({
            comic_id: comic.id,
            chapter_number: chapterData.chapterNumber,
            title: chapterData.chapterTitle,
            status: 'pending',
            released_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertErr || !newChapter) {
          console.error(`[Scraper Worker] Failed to insert chapter:`, insertErr);
          continue;
        }

        console.log(
          `[Scraper Worker] Inserted Chapter ${chapterData.chapterNumber} for "${comic.title}" (ID: ${newChapter.id}) as 'pending'.`
        );

        // 6. Insert raw image URLs into chapter_pages
        const pagesToInsert = chapterData.rawImageUrls.map((url, idx) => ({
          chapter_id: newChapter.id,
          page_number: idx + 1,
          image_url: url,
        }));

        const { error: pageErr } = await supabase.from('chapter_pages').insert(pagesToInsert);
        if (pageErr) {
          console.error(`[Scraper Worker] Error inserting chapter pages:`, pageErr);
        } else {
          console.log(
            `[Scraper Worker] Successfully added ${pagesToInsert.length} page URLs to DB queue.`
          );
          // Mark as existing so we don't repeat in same run
          existingChapterNumbers.add(chItem.chapterNumber);
        }
      }
    }

    console.log('\n[Scraper Worker] Ingestion run completed successfully.');
  } catch (err) {
    console.error('[Scraper Worker] Error executing scraper worker:', err);
  } finally {
    await browser.close();
  }
}

runScraperWorker();
