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
    if (process.env.CI || process.env.GITHUB_ACTIONS) {
      console.error(
        '[Scraper Worker] ERROR: Missing Supabase credentials! Please ensure SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are set in GitHub Secrets.'
      );
      process.exit(1);
    }
    console.log('[Scraper Worker] Simulation completed (No DB connection provided).');
    return;
  }

  const browser = await getSharedPuppeteerBrowser();
  if (!browser) {
    console.error(
      '[Scraper Worker] ERROR: Failed to start Chrome Puppeteer engine! Check that Chrome is installed or PUPPETEER_EXECUTABLE_PATH is provided.'
    );
    if (process.env.CI || process.env.GITHUB_ACTIONS) {
      process.exit(1);
    }
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

      // 3. DB-FIRST CHECK: Fetch ALL existing chapter records for this comic from Supabase
      const { data: existingChapters } = await supabase
        .from('chapters')
        .select('id, chapter_number, status, retry_count')
        .eq('comic_id', comic.id);

      const existingChapterMap = new Map<number, any>(
        (existingChapters || []).map((ch: any) => [Number(ch.chapter_number), ch])
      );

      console.log(
        `[Scraper Worker] Comic "${comic.title}" has ${existingChapterMap.size} existing chapters in DB. Total chapters available on site: ${comicDetail.chapters.length}.`
      );

      // Helper to check if a page is already successfully uploaded to Cloud Storage
      const isAlreadyUploaded = (url: string | null | undefined) =>
        typeof url === 'string' &&
        (url.includes('ik.imagekit.io') || url.includes('/api/storage/onedrive')) &&
        !url.includes('error');

      // 4. Iterate over ALL chapters discovered on site
      for (const chItem of comicDetail.chapters) {
        const existingChapter = existingChapterMap.get(chItem.chapterNumber);

        if (existingChapter) {
          // If already published, skip (healthy chapter)
          if (existingChapter.status === 'published') {
            continue;
          }

          // If chapter is 'pending' or 'failed', it might have failed or missed one or more images!
          console.log(
            `[Scraper Worker] -> Chapter ${chItem.chapterNumber} is '${existingChapter.status}' in DB. Checking for missing/failed pages...`
          );

          // Fetch existing pages in DB
          const { data: existingPages } = await supabase
            .from('chapter_pages')
            .select('*')
            .eq('chapter_id', existingChapter.id)
            .order('page_number', { ascending: true });

          const dbPages = existingPages || [];
          const dbPageMap = new Map(dbPages.map((p) => [p.page_number, p]));
          const uploadedCount = dbPages.filter((p) => isAlreadyUploaded(p.image_url)).length;

          // Check if all pages are already uploaded and contiguous
          const allDbUploaded =
            dbPages.length >= 3 &&
            dbPages.every((p, idx) => p.page_number === idx + 1 && isAlreadyUploaded(p.image_url));

          if (allDbUploaded) {
            console.log(
              `[Scraper Worker] -> Chapter ${chItem.chapterNumber} already has all ${dbPages.length} pages uploaded. Marking as 'published'.`
            );
            await supabase.from('chapters').update({ status: 'published' }).eq('id', existingChapter.id);
            continue;
          }

          // Chapter has missing or un-uploaded pages: scrape fresh URLs from source reader page
          console.log(
            `[Scraper Worker] -> Chapter ${chItem.chapterNumber} has ${uploadedCount}/${dbPages.length} uploaded pages. Re-fetching source reader to get missing images...`
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
              `[Scraper Worker] Could not re-scrape images for Chapter ${chItem.chapterNumber}. Skipping.`
            );
            continue;
          }

          const sourceImages = chapterData.rawImageUrls;
          let addedCount = 0;
          let updatedCount = 0;

          // Process each page in strict DOM order: index k is page k+1
          for (let idx = 0; idx < sourceImages.length; idx++) {
            const pageNum = idx + 1;
            const sourceUrl = sourceImages[idx];
            const existingPage = dbPageMap.get(pageNum);

            if (!existingPage) {
              // Page is completely missing from DB: insert it with exact matching source URL
              await supabase.from('chapter_pages').insert({
                chapter_id: existingChapter.id,
                page_number: pageNum,
                image_url: sourceUrl,
              });
              addedCount++;
            } else if (!isAlreadyUploaded(existingPage.image_url)) {
              // Page is in DB but NOT uploaded (raw or failed URL): refresh with fresh source URL
              await supabase
                .from('chapter_pages')
                .update({ image_url: sourceUrl })
                .eq('id', existingPage.id);
              updatedCount++;
            }
            // If already uploaded, DO NOT touch or overwrite it!
          }

          console.log(
            `[Scraper Worker] -> Chapter ${chItem.chapterNumber} repair synced: ${addedCount} missing pages added, ${updatedCount} un-uploaded pages refreshed.`
          );

          // Reset status to 'pending' so image worker will upload ONLY the missing/un-uploaded pages
          await supabase
            .from('chapters')
            .update({ status: 'pending' })
            .eq('id', existingChapter.id);

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
          existingChapterMap.set(chItem.chapterNumber, newChapter);
        }
      }
    }

    console.log('\n[Scraper Worker] Ingestion run completed successfully.');
  } catch (err) {
    console.error('[Scraper Worker] Error executing scraper worker:', err);
    if (process.env.CI || process.env.GITHUB_ACTIONS) {
      process.exit(1);
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        // Ignore close error
      }
    }
  }
}

runScraperWorker().catch((err) => {
  console.error('[Scraper Worker] Fatal error:', err);
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    process.exit(1);
  }
});
