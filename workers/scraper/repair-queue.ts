import { getWorkerSupabaseClient } from '../lib/supabase-client';

async function repairQueue() {
  console.log('===============================================================');
  console.log('[Repair Queue] Starting Ingestion Queue Diagnostics & Repair...');
  console.log('===============================================================\n');

  const supabase = getWorkerSupabaseClient();
  if (!supabase) {
    console.error('[Repair Queue] ERROR: Missing Supabase credentials! Check environment variables.');
    process.exit(1);
  }

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

    // Case A: Completely bogus foreign chapter (e.g. all pages belong to another comic, like Ch 187 in a comic that only has 137 chs)
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

    // Case C: Reset status to 'pending' with clean retry_count = 0 so fixed image worker can upload valid buffer
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
  console.log(`  - Chapters Reset to Queue : ${resetCount}`);
  console.log('===============================================================');
  console.log('Next step: Run `npm run process-images` to process the clean pending queue!\n');
}

repairQueue().catch((err) => {
  console.error('[Repair Queue] Fatal error:', err);
  process.exit(1);
});
