import { getWorkerSupabaseClient } from '../lib/supabase-client';
import {
  getSharedPuppeteerBrowser,
  getComicDetailWithPuppeteer,
  scrapeChapterPageWithPuppeteer,
} from './parse-source';
import { fetchComicMetadata, syncWorkerComicGenres } from '../lib/comic-metadata';
import { parseWestmangaContentsHTML } from './westmanga-contents';

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

      // If source points to a catalog/contents listing page (e.g. https://v1.westmanga.my/contents)
      if (source.base_url.includes('/contents')) {
        console.log(`[Scraper Worker] Source is a Catalog/Contents URL! Discovering comics from ${source.base_url}...`);
        try {
          const catPage = await browser.newPage();
          await catPage.goto(source.base_url, { waitUntil: 'networkidle2', timeout: 35000 }).catch(() => {});
          try {
            await catPage.waitForSelector('a[href*="/comic/"]', { timeout: 10000 });
          } catch {
            await new Promise((r) => setTimeout(r, 4000));
          }

          const catHtml = await catPage.content();
          await catPage.close();

          const discovered = parseWestmangaContentsHTML(catHtml, 'https://v1.westmanga.my');
          console.log(`[Scraper Worker] Found ${discovered.length} comics on ${source.base_url}`);

          // Fetch existing sources to avoid duplicates
          const { data: currentSources } = await supabase.from('sources').select('base_url');
          const existingSet = new Set((currentSources || []).map((s) => s.base_url.toLowerCase().replace(/\/$/, '')));

          const newComics = discovered.filter((c) => !existingSet.has(c.comicUrl.toLowerCase().replace(/\/$/, '')));
          if (newComics.length > 0) {
            console.log(`[Scraper Worker] Registering ${newComics.length} new comics as individual sources...`);
            await supabase.from('sources').insert(
              newComics.map((c) => ({
                name: c.title,
                base_url: c.comicUrl,
                is_active: true,
                scraping_config: {
                  comic_slug: c.slug,
                  comic_type: c.type,
                  cover_url: c.coverUrl,
                  latest_chapter: c.latestChapter?.chapterNumber,
                  selector_title: '.entry-title',
                  selector_images: '#readerarea img',
                },
              }))
            );
          } else {
            console.log(`[Scraper Worker] All comics on ${source.base_url} already registered as sources.`);
          }
        } catch (catErr: any) {
          console.error(`[Scraper Worker] Failed to scan catalog ${source.base_url}:`, catErr.message);
        }
        continue; // Catalog processed, proceed to next source
      }

      // Discover comic details & all available chapters on the single comic page
      const comicDetail = await getComicDetailWithPuppeteer(browser, source.base_url);
      if (!comicDetail || comicDetail.chapters.length === 0) {
        console.warn(`[Scraper Worker] Could not extract chapter list from ${source.base_url}. Skipping.`);
        continue;
      }

      // 2. Find or Auto-Create Comic in Supabase
      let { data: comic } = await supabase
        .from('comics')
        .select('id, title, slug, author, synopsis, cover_url')
        .eq('slug', comicDetail.comicSlug)
        .maybeSingle();

      if (!comic) {
        console.log(`[Scraper Worker] Comic "${comicDetail.comicTitle}" not found in DB. Auto-fetching metadata from AniList/Kitsu...`);
        const metadata = await fetchComicMetadata(comicDetail.comicTitle);
        if (metadata) {
          console.log(`[Scraper Worker] Found metadata for "${comicDetail.comicTitle}": Type=${metadata.type}, Author=${metadata.author}, Rating=${metadata.rating}`);
        } else {
          console.log(`[Scraper Worker] No external metadata found for "${comicDetail.comicTitle}". Using fallback defaults.`);
        }

        const coverUrl =
          metadata?.cover_url ||
          comicDetail.coverUrl ||
          'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

        // Judul komik jangan dirubah (tetap gunakan judul asli dari Westmanga)
        const finalTitle = comicDetail.comicTitle;
        const finalType = metadata?.type || 'manhwa';
        const finalSynopsis =
          metadata?.synopsis ||
          `Baca komik ${comicDetail.comicTitle} Bahasa Indonesia di Westmanga.`;
        const finalAuthor = metadata?.author || 'Unknown Author';
        const finalStatus = metadata?.status || 'ongoing';
        const finalRating = metadata?.rating || 4.5;
        const finalAltTitles = metadata?.alt_titles || [];
        if (
          metadata?.title &&
          metadata.title.toLowerCase() !== finalTitle.toLowerCase() &&
          !finalAltTitles.includes(metadata.title)
        ) {
          finalAltTitles.push(metadata.title);
        }

        const { data: newComic, error: comicErr } = await supabase
          .from('comics')
          .insert({
            slug: comicDetail.comicSlug,
            title: finalTitle,
            alt_titles: finalAltTitles,
            type: finalType,
            synopsis: finalSynopsis,
            cover_url: coverUrl,
            author: finalAuthor,
            status: finalStatus,
            rating: finalRating,
            source_id: source.id,
          })
          .select('id, title, slug, author, synopsis, cover_url')
          .single();

        if (comicErr || !newComic) {
          console.error(`[Scraper Worker] Failed to auto-create comic "${comicDetail.comicTitle}":`, comicErr);
          continue;
        }
        comic = newComic;
        console.log(`[Scraper Worker] Successfully created comic "${comic.title}" (ID: ${comic.id}).`);

        // Sync genres from metadata
        if (metadata?.genres && metadata.genres.length > 0) {
          await syncWorkerComicGenres(supabase, comic.id, metadata.genres);
          console.log(`[Scraper Worker] Synced ${metadata.genres.length} genres for "${comic.title}".`);
        }
      } else {
        // If existing comic has default/placeholder data, enrich it automatically (without changing title)
        const isUnknownAuthor = !comic.author || /unknown/i.test(comic.author);
        const isDefaultSynopsis = !comic.synopsis || comic.synopsis.includes('terjemahan Bahasa Indonesia') || comic.synopsis.includes('di Westmanga');
        if (isUnknownAuthor || isDefaultSynopsis) {
          console.log(`[Scraper Worker] Existing comic "${comic.title}" has default data. Auto-enriching from API...`);
          const meta = await fetchComicMetadata(comic.title);
          if (meta) {
            const updateObj: Record<string, any> = {
              type: meta.type,
              status: meta.status,
              rating: meta.rating,
              alt_titles: meta.alt_titles,
            };
            if (meta.synopsis) updateObj.synopsis = meta.synopsis;
            if (meta.author && meta.author !== 'Unknown Author') updateObj.author = meta.author;
            if (comic.cover_url?.includes('unsplash') && meta.cover_url) updateObj.cover_url = meta.cover_url;

            await supabase.from('comics').update(updateObj).eq('id', comic.id);
            if (meta.genres?.length) {
              await syncWorkerComicGenres(supabase, comic.id, meta.genres);
            }
            console.log(`[Scraper Worker] Successfully enriched existing comic "${comic.title}".`);
          }
        }
      }

      // 3. DB-FIRST CHECK: Fetch existing chapter records for this comic from Supabase
      const { data: existingChapters } = await supabase
        .from('chapters')
        .select('id, chapter_number, status, retry_count')
        .eq('comic_id', comic.id);

      const existingChapterMap = new Map<number, any>(
        (existingChapters || []).map((ch: any) => [Number(ch.chapter_number), ch])
      );

      // Helper to check if a page is already successfully uploaded to Cloud Storage
      const isAlreadyUploaded = (url: string | null | undefined) =>
        typeof url === 'string' &&
        (url.includes('ik.imagekit.io') || url.includes('/api/storage/onedrive')) &&
        !url.includes('error');

      // 3. Daftarkan SEMUA chapter metadata ke database agar seluruh chapter tampil di web
      const missingChapters = comicDetail.chapters.filter((ch) => !existingChapterMap.has(ch.chapterNumber));
      if (missingChapters.length > 0) {
        const rowsToInsert = missingChapters.map((ch) => ({
          comic_id: comic.id,
          chapter_number: ch.chapterNumber,
          title: `Chapter ${ch.chapterNumber}`,
          status: 'published',
          released_at: new Date().toISOString(),
        }));
        await supabase.from('chapters').upsert(rowsToInsert, { onConflict: 'comic_id,chapter_number' });
        console.log(
          `[Scraper Worker] Mendaftarkan ${rowsToInsert.length} metadata chapter untuk "${comic.title}" agar tampil di web.`
        );
      }

      // 4. Scrape gambar hanya untuk chapter terbaru
      const sortedChapters = [...comicDetail.chapters].sort((a, b) => b.chapterNumber - a.chapterNumber);
      const chItem = sortedChapters[0];

      if (!chItem) {
        console.log(`[Scraper Worker] Comic "${comic.title}" has no chapters available. Skipping.`);
        continue;
      }

      console.log(
        `[Scraper Worker] Comic "${comic.title}" -> Processing reader images for latest chapter: Chapter ${chItem.chapterNumber}`
      );

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

          // Clean up any trailing orphan/phantom pages in DB that exceed fresh source reader pages and aren't uploaded
          const extraPages = dbPages.filter(
            (p) => p.page_number > sourceImages.length && !isAlreadyUploaded(p.image_url)
          );
          if (extraPages.length > 0) {
            const extraIds = extraPages.map((p) => p.id);
            await supabase.from('chapter_pages').delete().in('id', extraIds);
            console.log(
              `[Scraper Worker] -> Cleaned up ${extraPages.length} phantom/un-uploaded trailing page(s) from DB for Chapter ${chItem.chapterNumber}.`
            );
          }

          console.log(
            `[Scraper Worker] -> Chapter ${chItem.chapterNumber} repair synced: ${addedCount} missing pages added, ${updatedCount} un-uploaded pages refreshed.`
          );

          // Verify if all pages of the chapter in DB are now complete and uploaded
          const { data: updatedPages } = await supabase
            .from('chapter_pages')
            .select('page_number, image_url')
            .eq('chapter_id', existingChapter.id)
            .order('page_number', { ascending: true });

          const allNowUploaded =
            updatedPages &&
            updatedPages.length >= 3 &&
            updatedPages.every((p, idx) => p.page_number === idx + 1 && isAlreadyUploaded(p.image_url));

          if (allNowUploaded) {
            console.log(
              `[Scraper Worker] -> Chapter ${chItem.chapterNumber} all ${updatedPages.length} pages verified complete & uploaded! Marking as 'published'.`
            );
            await supabase
              .from('chapters')
              .update({ status: 'published', retry_count: 0 })
              .eq('id', existingChapter.id);
          } else {
            // Reset status to 'pending' so image worker will upload missing pages
            await supabase
              .from('chapters')
              .update({ status: 'pending' })
              .eq('id', existingChapter.id);
          }

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
