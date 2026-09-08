import { getWorkerSupabaseClient } from '../lib/supabase-client';
import { processOptimalImage, validateImageBuffer } from './convert';
import { uploadImageToR2 } from './upload-r2';
import fetch from 'node-fetch';
import pLimit from 'p-limit';
import fs from 'fs';
import path from 'path';
import https from 'https';

const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

/**
 * Downloads remote image buffer with automatic retry logic (up to 3 retries)
 */
async function fetchRemoteImageWithRetry(url: string, referer: string, maxRetries = 3): Promise<Buffer> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      attempt++;
      const res = await fetch(url, {
        agent: (parsedUrl: any) => (parsedUrl.protocol === 'https:' ? httpsAgent : undefined),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': referer,
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (!validateImageBuffer(buffer)) {
        throw new Error(`Invalid image buffer`);
      }

      return buffer;
    } catch (err: any) {
      if (attempt < maxRetries) {
        const waitTime = attempt * 800;
        console.warn(`[Image Worker] Download retry ${attempt}/${maxRetries} for ${url} in ${waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Failed to download ${url} after ${maxRetries} attempts`);
}

async function runImageWorker() {
  console.log('[Image Worker] Starting image processing queue run...');
  const supabase = getWorkerSupabaseClient();

  if (!supabase) {
    if (process.env.CI || process.env.GITHUB_ACTIONS) {
      console.error(
        '[Image Worker] ERROR: Missing Supabase credentials! Please ensure SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are set in GitHub Secrets.'
      );
      process.exit(1);
    }
    console.log('[Image Worker] Simulation completed (No DB connection provided).');
    return;
  }

  try {
    // Batch size: process up to BATCH_SIZE chapters per run (default: 50, or all if 0)
    // Set IMAGE_WORKER_BATCH_SIZE=0 to process all pending chapters
    const batchSize = parseInt(process.env.IMAGE_WORKER_BATCH_SIZE || '50', 10);

    // Safety: stop processing if we've been running for more than MAX_RUNTIME_MS
    // GitHub Actions jobs timeout at 6h; we stop at 5.5h to leave time for cleanup
    const maxRuntimeMs = parseInt(process.env.IMAGE_WORKER_MAX_RUNTIME_MS || '19800000', 10); // 5.5 hours
    const startTime = Date.now();

    // 1. Fetch pending/processing chapters from queue
    let query = supabase
      .from('chapters')
      .select('*, comic:comics(*)')
      .in('status', ['pending', 'processing'])
      .order('chapter_number', { ascending: true }); // process oldest chapters first

    if (batchSize > 0) {
      query = query.limit(batchSize);
    }

    const { data: pendingChapters, error } = await query;

    if (error || !pendingChapters || pendingChapters.length === 0) {
      console.log('[Image Worker] No pending chapter jobs in queue.');
      return;
    }

    console.log(`[Image Worker] Found ${pendingChapters.length} chapter(s) in queue to process.`);


    const limit = pLimit(3); // Concurrency limit 3 parallel downloads/conversions for network stability

    let processedCount = 0;
    for (const chapter of pendingChapters) {
      // Safety: stop if we are approaching the max runtime
      const elapsed = Date.now() - startTime;
      if (elapsed >= maxRuntimeMs) {
        console.warn(`[Image Worker] Max runtime (${Math.round(maxRuntimeMs / 60000)}m) reached. Stopping early. Processed ${processedCount}/${pendingChapters.length} chapters this run.`);
        break;
      }

      console.log(`[Image Worker] Processing Chapter ${chapter.chapter_number} (ID: ${chapter.id})... [${processedCount + 1}/${pendingChapters.length}]`);


      // Update chapter status to 'processing'
      await supabase.from('chapters').update({ status: 'processing' }).eq('id', chapter.id);

      const { data: pages } = await supabase
        .from('chapter_pages')
        .select('*')
        .eq('chapter_id', chapter.id)
        .order('page_number', { ascending: true });

      if (!pages || pages.length === 0) {
        console.warn(`[Image Worker] Chapter ${chapter.id} has no pages to process.`);
        continue;
      }

      let hasError = false;

      const pagePromises = pages.map((page) =>
        limit(async () => {
          try {
            if (!page.image_url || typeof page.image_url !== 'string') {
              throw new Error(`Empty image URL for page ${page.page_number}`);
            }

            // Case A: Page is ALREADY uploaded to Cloud Storage (OneDrive or ImageKit CDN)
            if (page.image_url.includes('ik.imagekit.io') || page.image_url.includes('/api/storage/onedrive')) {
              return;
            }

            // Case B: Page was saved locally as fallback (e.g. /comics/...)
            if (page.image_url.startsWith('/comics/') || page.image_url.includes('/comics/')) {
              const rawRel = page.image_url.replace(/^\//, '');
              const cleanRel = rawRel.replace(/^comics\//, '');
              const candidateBases = [
                path.resolve(process.cwd(), 'public'),
                path.resolve(process.cwd(), '../public'),
                path.resolve(__dirname, '../../public'),
              ];

              const possibleLocalPaths: string[] = [];
              for (const base of candidateBases) {
                possibleLocalPaths.push(path.resolve(base, rawRel));
                possibleLocalPaths.push(path.resolve(base, 'comics', cleanRel));
                possibleLocalPaths.push(path.resolve(base, 'comics/comics', cleanRel));
              }

              let foundLocalPath: string | null = null;
              for (const p of possibleLocalPaths) {
                if (fs.existsSync(p)) {
                  foundLocalPath = p;
                  break;
                }
              }

              if (foundLocalPath) {
                const ext = path.extname(foundLocalPath) || '.webp';
                const localKeyPath = `comics/${chapter.comic.slug}/${chapter.chapter_number}/${page.page_number}${ext}`;
                console.log(`[Image Worker] Found local file for page ${page.page_number} (${foundLocalPath}). Uploading to Storage...`);
                const localBuffer = fs.readFileSync(foundLocalPath);
                const cdnUrl = await uploadImageToR2(localBuffer, localKeyPath);
                if (cdnUrl.startsWith('http') || cdnUrl.startsWith('/api/storage/')) {
                  await supabase.from('chapter_pages').update({ image_url: cdnUrl }).eq('id', page.id);
                }
                return;
              } else {
                console.warn(`[Image Worker] Local file missing on disk for page ${page.page_number}: ${page.image_url}`);
                throw new Error(`File lokal tidak ditemukan di folder public: ${page.image_url}`);
              }
            }

            // Case C: Remote HTTP image URL (standard scraping flow)
            let refererHeader = 'https://v1.westmanga.my/';
            try {
              if (page.image_url.startsWith('http')) {
                refererHeader = `${new URL(page.image_url).origin}/`;
              }
            } catch (e) {
              // Fallback
            }

            const originalBuffer = await fetchRemoteImageWithRetry(page.image_url, refererHeader, 3);

            // Convert to optimal format (WebP for normal pages, Progressive MozJPEG for strips > 16383px)
            const { buffer: processedBuffer, extension, contentType } = await processOptimalImage(originalBuffer, 80);

            const keyPath = `comics/${chapter.comic.slug}/${chapter.chapter_number}/${page.page_number}.${extension}`;

            // Upload to OneDrive / ImageKit / local: comics/{comic_slug}/{chapter_no}/{page_no}.{extension}
            const cdnUrl = await uploadImageToR2(processedBuffer, keyPath, contentType);

            // Update page image_url with final CDN URL
            await supabase
              .from('chapter_pages')
              .update({ image_url: cdnUrl })
              .eq('id', page.id);

          } catch (err: any) {
            console.error(`[Image Worker] Failed page ${page.page_number}:`, err?.message || err);
            hasError = true;
            await supabase.from('ingest_logs').insert({
              chapter_id: chapter.id,
              level: 'error',
              message: `Page ${page.page_number} error: ${err?.message || err}`,
            });
          }
        })
      );

      await Promise.all(pagePromises);

      if (hasError) {
        const nextRetry = (chapter.retry_count || 0) + 1;
        const newStatus = nextRetry >= 5 ? 'failed' : 'pending';
        await supabase
          .from('chapters')
          .update({ status: newStatus, retry_count: nextRetry })
          .eq('id', chapter.id);
        console.warn(`[Image Worker] Chapter ${chapter.id} finished with errors. Status set to '${newStatus}'.`);
      } else {
        await supabase
          .from('chapters')
          .update({ status: 'published' })
          .eq('id', chapter.id);
        console.log(`[Image Worker] Chapter ${chapter.id} successfully processed and marked as 'published'!`);
      }

      processedCount++;
    }

    const remaining = pendingChapters.length - processedCount;
    console.log(`[Image Worker] Processing completed. Processed: ${processedCount} chapter(s).${remaining > 0 ? ` ${remaining} chapter(s) remain in queue (will be processed on next run).` : ' Queue cleared!'}`);

  } catch (err) {
    console.error('[Image Worker] Error running image worker:', err);
    if (process.env.CI || process.env.GITHUB_ACTIONS) {
      process.exit(1);
    }
  }
}

runImageWorker().catch((err) => {
  console.error('[Image Worker] Fatal error:', err);
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    process.exit(1);
  }
});
