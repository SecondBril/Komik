import { getWorkerSupabaseClient } from '../lib/supabase-client';
import https from 'https';
import fetch from 'node-fetch';

const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

async function checkIs404(url: string): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal as any,
      agent: (parsedUrl: any) => (parsedUrl.protocol === 'https:' ? httpsAgent : undefined),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://v1.westmanga.my/',
      },
    });
    clearTimeout(timer);
    return res.status === 404;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

async function repairQueue() {
  console.log('===============================================================');
  console.log('[Repair Queue] Starting Ingestion Queue Diagnostics & Repair...');
  console.log('===============================================================\n');

  const supabase = getWorkerSupabaseClient();
  if (!supabase) {
    console.error('[Repair Queue] ERROR: Missing Supabase credentials! Check environment variables.');
    process.exit(1);
  }

  const isFromScratch = process.argv.includes('--from-scratch') || process.env.SCRAPE_FROM_SCRATCH === 'true';

  // Helper to check if URL is already uploaded to cloud
  const isAlreadyUploaded = (url: string | null | undefined): boolean => {
    if (!url || typeof url !== 'string') return false;
    return (
      (url.includes('ik.imagekit.io') || url.includes('/api/storage/onedrive')) &&
      !url.includes('error') &&
      !url.includes('undefined')
    );
  };

  // 1. Fetch all pending and failed chapters
  const { data: chapters, error } = await supabase
    .from('chapters')
    .select(`
      id,
      chapter_number,
      title,
      status,
      retry_count,
      created_at,
      comic:comics(id, title, slug),
      pages:chapter_pages(id, page_number, image_url)
    `)
    .in('status', ['failed', 'pending'])
    .order('chapter_number', { ascending: true });

  if (error || !chapters || chapters.length === 0) {
    console.log('[Repair Queue] No pending or failed chapters found in queue. Everything healthy!');
    return;
  }

  console.log(`[Repair Queue] Found ${chapters.length} chapter(s) needing diagnostic check.\n`);

  // Fetch recent error logs for diagnostic reasons
  const chapterIds = chapters.map((c) => c.id);
  const { data: logs } = await supabase
    .from('ingest_logs')
    .select('chapter_id, message, level, created_at')
    .in('chapter_id', chapterIds)
    .order('created_at', { ascending: false });

  const logMap = new Map<string, string>();
  if (logs) {
    for (const log of logs) {
      if (log.chapter_id && !logMap.has(log.chapter_id)) {
        logMap.set(log.chapter_id, log.message);
      }
    }
  }

  let resetCount = 0;
  let publishedCleanedCount = 0;
  let corruptedCleanedCount = 0;
  let foreignChapterDeletedCount = 0;

  for (const ch of chapters as any[]) {
    const comicData = Array.isArray(ch.comic) ? ch.comic[0] : ch.comic;
    const comicTitle = comicData?.title || 'Unknown Comic';
    const comicSlug = comicData?.slug || '';
    const cleanComicSlug = comicSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
    const pages = ch.pages || [];
    const uploadedCount = pages.filter((p: any) => isAlreadyUploaded(p.image_url)).length;
    const missingCount = pages.length - uploadedCount;
    const lastError = logMap.get(ch.id) || 'None recorded';

    console.log(`----------------------------------------------------------------`);
    console.log(`[Diagnostic] "${comicTitle}" - Chapter ${ch.chapter_number} (ID: ${ch.id})`);
    console.log(`  - Status         : ${ch.status.toUpperCase()} (Retry count: ${ch.retry_count || 0})`);
    console.log(`  - Pages In DB    : ${pages.length} total (${uploadedCount} uploaded, ${missingCount} missing/pending)`);
    console.log(`  - Last Log/Error : ${lastError}`);

    // Check for foreign/cross-contaminated pages (e.g. pick-me-up in another comic)
    const foreignPages = pages.filter((p: any) => {
      const url = p.image_url || '';
      // Check if URL points to a different comic slug
      const match = url.match(/storage\.westmanga\.blog\/west\/([^\/]+)\//i);
      if (match) {
        const pathSlug = match[1].toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanComicSlug && pathSlug !== cleanComicSlug && !cleanComicSlug.includes(pathSlug)) {
          return true; // Contaminated from another comic!
        }
      }
      return false;
    });

    // Case A: Completely bogus foreign chapter (e.g. all pages belong to another comic)
    if (foreignPages.length > 0 && foreignPages.length === pages.length && pages.length > 10) {
      console.warn(
        `  -> [CORRUPTION DETECTED] All ${pages.length} pages belong to a completely foreign comic! Deleting bogus chapter record...`
      );
      await supabase.from('chapter_pages').delete().eq('chapter_id', ch.id);
      await supabase.from('chapters').delete().eq('id', ch.id);
      foreignChapterDeletedCount++;
      continue;
    }

    // Case B: Some foreign pages injected at end or middle
    if (foreignPages.length > 0) {
      console.warn(
        `  -> [CORRUPTION DETECTED] Found ${foreignPages.length} foreign page(s) injected into this chapter. Cleaning corrupted pages...`
      );
      const foreignIds = foreignPages.map((p: any) => p.id);
      await supabase.from('chapter_pages').delete().in('id', foreignIds);
      corruptedCleanedCount++;
    }

    // Case C: Check if all pages are already uploaded and consecutive
    const unuploadedPages = pages.filter((p: any) => !isAlreadyUploaded(p.image_url));
    const isConsecutivePrefix = pages
      .filter((p: any) => isAlreadyUploaded(p.image_url))
      .every((p: any, idx: number) => p.page_number === idx + 1);

    if (unuploadedPages.length === 0 && pages.length >= 3 && isConsecutivePrefix) {
      console.log(`  -> [SUCCESS] All ${pages.length} pages are already uploaded! Marking as 'published'.`);
      await supabase.from('chapters').update({ status: 'published', retry_count: 0 }).eq('id', ch.id);
      publishedCleanedCount++;
      continue;
    }

    if (
      unuploadedPages.length > 0 &&
      uploadedCount >= 3 &&
      isConsecutivePrefix &&
      unuploadedPages.every((p: any) => p.page_number > uploadedCount)
    ) {
      console.log(
        `  -> [CHECK] Checking ${unuploadedPages.length} trailing un-uploaded page(s) for HTTP 404 phantom URLs...`
      );
      let allTrailingAre404 = true;
      for (const p of unuploadedPages) {
        const is404 =
          (p.image_url && p.image_url.includes('error.png')) ||
          lastError.includes('404') ||
          (await checkIs404(p.image_url));
        if (!is404) {
          allTrailingAre404 = false;
          break;
        }
      }

      if (allTrailingAre404) {
        console.warn(
          `  -> [AUTO-REPAIR] All ${unuploadedPages.length} trailing page(s) confirmed 404 / phantom on source! Deleting phantom pages...`
        );
        const delIds = unuploadedPages.map((p: any) => p.id);
        await supabase.from('chapter_pages').delete().in('id', delIds);
        await supabase.from('chapters').update({ status: 'published', retry_count: 0 }).eq('id', ch.id);
        console.log(
          `  -> [SUCCESS] Chapter ${ch.chapter_number} all ${uploadedCount} valid pages complete! Marked as 'published'.`
        );
        publishedCleanedCount++;
        continue;
      }
    }

    // Case D: If user requested to re-scrape from scratch (--from-scratch)
    if (isFromScratch && ch.status === 'failed') {
      console.log(`  -> [FROM-SCRATCH] Deleting unuploaded pages to allow clean re-scrape from scratch...`);
      const unuploadedIds = unuploadedPages.map((p: any) => p.id);
      if (unuploadedIds.length > 0) {
        await supabase.from('chapter_pages').delete().in('id', unuploadedIds);
      }
      await supabase.from('chapters').update({ status: 'pending', retry_count: 0 }).eq('id', ch.id);
      resetCount++;
      continue;
    }

    // Case E: Reset status to 'pending' with clean retry_count = 0 so fixed image worker can upload valid buffer
    if (ch.status === 'failed' || ch.retry_count > 0) {
      await supabase
        .from('chapters')
        .update({
          status: 'pending',
          retry_count: 0,
        })
        .eq('id', ch.id);

      console.log(`  -> [ACTION] Reset chapter status to 'pending' (retry_count: 0).`);
      resetCount++;
    }
  }

  console.log('\n===============================================================');
  console.log('[Repair Queue] Diagnostics & Repair Finished!');
  console.log(`  - Chapters Checked        : ${chapters.length}`);
  console.log(`  - Bogus Chapters Deleted  : ${foreignChapterDeletedCount}`);
  console.log(`  - Corrupted Pages Cleaned : ${corruptedCleanedCount}`);
  console.log(`  - Chapters Auto-Published : ${publishedCleanedCount}`);
  console.log(`  - Chapters Reset to Queue : ${resetCount}`);
  console.log('===============================================================');
  console.log('Next step: Run `npm run scrape` or `npm run process-images`.\n');
}

repairQueue().catch((err) => {
  console.error('[Repair Queue] Fatal error:', err);
  process.exit(1);
});
