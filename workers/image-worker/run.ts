import { getWorkerSupabaseClient } from '../lib/supabase-client';
import { convertToWebP, validateImageBuffer } from './convert';
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
    console.log('[Image Worker] Simulation completed (No DB connection provided).');
    return;
  }

  try {
    // 1. Fetch pending or processing chapters from queue
    const { data: pendingChapters, error } = await supabase
      .from('chapters')
      .select('*, comic:comics(*)')
      .in('status', ['pending', 'processing'])
      .limit(5);

    if (error || !pendingChapters || pendingChapters.length === 0) {
      console.log('[Image Worker] No pending chapter jobs in queue.');
      return;
    }

    const limit = pLimit(3); // Concurrency limit 3 parallel downloads/conversions for network stability

    for (const chapter of pendingChapters) {
      console.log(`[Image Worker] Processing Chapter ${chapter.chapter_number} (ID: ${chapter.id})...`);

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

            const keyPath = `comics/${chapter.comic.slug}/${chapter.chapter_number}/${page.page_number}.webp`;

            // Case A: Page is ALREADY uploaded to ImageKit CDN
            if (page.image_url.includes('ik.imagekit.io')) {
              return;
            }

            // Case B: Page was saved locally as fallback (e.g. /comics/...)
            if (page.image_url.startsWith('/comics/') || page.image_url.includes('/comics/')) {
              const rawRel = page.image_url.replace(/^\//, '');
              const possibleLocalPaths = [
                path.resolve(process.cwd(), '../public', rawRel),
                path.resolve(process.cwd(), '../public/comics', rawRel.replace(/^comics\//, '')),
                path.resolve(process.cwd(), '../public', rawRel.replace(/^comics\/comics\//, 'comics/')),
              ];

              let foundLocalPath: string | null = null;
              for (const p of possibleLocalPaths) {
                if (fs.existsSync(p)) {
                  foundLocalPath = p;
                  break;
                }
              }

              if (foundLocalPath) {
                console.log(`[Image Worker] Found local WebP file for page ${page.page_number} (${foundLocalPath}). Uploading to ImageKit...`);
                const localBuffer = fs.readFileSync(foundLocalPath);
                const cdnUrl = await uploadImageToR2(localBuffer, keyPath);
                if (cdnUrl.startsWith('http')) {
                  await supabase.from('chapter_pages').update({ image_url: cdnUrl }).eq('id', page.id);
                }
                return;
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

            // Convert to WebP format
            const webpBuffer = await convertToWebP(originalBuffer, 80);

            // Upload to ImageKit / local: comics/{comic_slug}/{chapter_no}/{page_no}.webp
            const cdnUrl = await uploadImageToR2(webpBuffer, keyPath);

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
    }

    console.log('[Image Worker] Processing completed.');
  } catch (err) {
    console.error('[Image Worker] Error running image worker:', err);
  }
}

runImageWorker();
