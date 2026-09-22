import { createAdminClient } from '@/lib/supabase/admin';
import { parseWestmangaContentsHTML } from '@/workers/scraper/westmanga-contents';
import { fetchComicMetadata, syncWorkerComicGenres } from '@/workers/lib/comic-metadata';
import puppeteer, { Browser } from 'puppeteer-core';
import { getChromeExecutablePath } from './live-chapter-scraper';

export interface SyncStats {
  pagesScanned: number;
  comicsFound: number;
  newComicsAdded: number;
  newChaptersAdded: number;
  errors: string[];
}

/**
 * Fetch HTML via standard fetch with fallback
 */
async function fetchHtmlWithHeaders(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) return null;
    return await res.text();
  } catch (e: any) {
    console.warn(`[CatalogSync] Failed to fetch HTML from ${url}:`, e?.message);
    return null;
  }
}

/**
 * Ekstrak detail komik dan semua chapternya dari Westmanga menggunakan Puppeteer headless
 */
async function extractComicDetailWithPuppeteer(
  browser: Browser,
  comicUrl: string,
  slug: string
): Promise<{
  title: string;
  synopsis: string;
  coverUrl?: string;
  type: 'manga' | 'manhwa' | 'manhua';
  chapters: Array<{ chapterNumber: number; title: string }>;
} | null> {
  const page = await browser.newPage();
  try {
    // Intersep request untuk mempercepat loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (type === 'image' || type === 'font' || type === 'stylesheet') {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });

    await page.goto(comicUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    const data = await page.evaluate((targetSlug) => {
      // 1. Ekstrak Judul
      const h1 = document.querySelector('h1')?.textContent?.trim() || '';
      const rawTitle = h1.replace(/\s*-\s*.*$/, '').replace(/Bahasa Indonesia/gi, '').trim();

      // 2. Ekstrak Sinopsis
      const synopsisEl =
        document.querySelector('.synopsis, .entry-content, [itemprop="description"], p.leading-relaxed') ||
        document.querySelector('.space-y-2 p');
      const synopsis = synopsisEl?.textContent?.trim() || '';

      // 3. Ekstrak Cover
      const img = document.querySelector<HTMLImageElement>(
        'img.object-cover, img.object-fill, img[src*="covers"], img[src*="storage.westmanga"]'
      );
      const coverUrl = img?.src || img?.getAttribute('data-src') || '';

      // 4. Ekstrak Semua Chapter
      const chLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/view/"]'));
      const parsedChapters: Array<{ chapterNumber: number; title: string }> = [];
      const seenNums = new Set<number>();

      chLinks.forEach((a) => {
        const href = a.href || '';
        const text = a.textContent?.trim() || '';

        // Match chapter number
        const match =
          text.match(/(?:chapter|ch\.?)\s*(\d+(?:[\.-]\d+)?)/i) ||
          href.match(/chapter-(\d+(?:[\.-]\d+)?)/i);

        if (match) {
          const num = parseFloat(match[1].replace('-', '.'));
          if (!isNaN(num) && num > 0 && !seenNums.has(num)) {
            seenNums.add(num);
            parsedChapters.push({
              chapterNumber: num,
              title: text || `Chapter ${num}`,
            });
          }
        }
      });

      return {
        title: rawTitle,
        synopsis,
        coverUrl,
        chapters: parsedChapters,
      };
    }, slug);

    return {
      title: data.title || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      synopsis: data.synopsis || `Komik ${slug} Bahasa Indonesia di Westmanga.`,
      coverUrl: data.coverUrl || undefined,
      type: 'manhwa',
      chapters: data.chapters.sort((a, b) => a.chapterNumber - b.chapterNumber),
    };
  } catch (err: any) {
    console.warn(`[CatalogSync] Failed extracting detail for ${comicUrl}:`, err?.message);
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Sinkronisasi Otomatis Seluruh Komik dari Westmanga
 * - Menyimpan metadata komik & daftar chapter ke database
 * - TIDAK menyimpan atau mengunggah gambar chapter ke database
 */
export async function syncWestmangaComics(options: { maxPages?: number } = {}): Promise<SyncStats> {
  const maxPages = options.maxPages || 2;
  const stats: SyncStats = {
    pagesScanned: 0,
    comicsFound: 0,
    newComicsAdded: 0,
    newChaptersAdded: 0,
    errors: [],
  };

  const supabase = createAdminClient();
  if (!supabase) {
    stats.errors.push('Supabase Admin Client tidak tersedia');
    return stats;
  }

  const chromePath = getChromeExecutablePath();
  let browser: Browser | null = null;
  if (chromePath) {
    try {
      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
      });
    } catch (e: any) {
      console.warn('[CatalogSync] Failed launching Chrome:', e?.message);
    }
  }

  try {
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const catalogUrl = `https://v1.westmanga.my/contents?page=${pageNum}`;
      console.log(`\n[CatalogSync] Scanning page ${pageNum}: ${catalogUrl}`);

      let html: string | null = '';
      if (browser) {
        const page = await browser.newPage();
        try {
          await page.goto(catalogUrl, { waitUntil: 'networkidle2', timeout: 35000 }).catch(() => {});
          try {
            await page.waitForSelector('a[href*="/comic/"]', { timeout: 10000 });
          } catch {
            await new Promise((r) => setTimeout(r, 3000));
          }
          html = await page.content();
        } finally {
          await page.close().catch(() => {});
        }
      }

      if (!html) {
        html = await fetchHtmlWithHeaders(catalogUrl);
      }

      if (!html) {
        console.warn(`[CatalogSync] Could not get HTML for ${catalogUrl}. Skipping.`);
        continue;
      }

      stats.pagesScanned++;
      const discovered = parseWestmangaContentsHTML(html, 'https://v1.westmanga.my');
      console.log(`[CatalogSync] Found ${discovered.length} comics on page ${pageNum}`);
      stats.comicsFound += discovered.length;

      for (const item of discovered) {
        const slug = item.slug;

        // 1. Cek apakah komik sudah ada di database
        const { data: existingComic } = await supabase
          .from('comics')
          .select('id, title, slug')
          .eq('slug', slug)
          .maybeSingle();

        if (!existingComic) {
          // KOMIK BARU DITEMUKAN!
          console.log(`[CatalogSync] -> NEW COMIC DETECTED: "${item.title}" (${slug})`);

          // Ambil detail komik & chapter
          let detail = browser
            ? await extractComicDetailWithPuppeteer(browser, item.comicUrl, slug)
            : null;

          const meta = await fetchComicMetadata(item.title).catch(() => null);

          const finalTitle = meta?.title || detail?.title || item.title;
          const finalType = (meta?.type as any) || item.type || 'manhwa';
          const finalSynopsis =
            meta?.synopsis ||
            detail?.synopsis ||
            `Baca komik ${finalTitle} Bahasa Indonesia terlengkap dan terupdate di Westmanga.`;
          const finalCover = meta?.cover_url || detail?.coverUrl || item.coverUrl;
          const finalAuthor = meta?.author || 'Unknown Author';
          const finalRating = meta?.rating || 4.5;
          const finalStatus = (meta?.status as any) || 'ongoing';

          // Insert ke tabel comics
          const { data: newComic, error: comicErr } = await supabase
            .from('comics')
            .insert({
              slug,
              title: finalTitle,
              type: finalType,
              synopsis: finalSynopsis,
              cover_url: finalCover,
              author: finalAuthor,
              rating: finalRating,
              status: finalStatus,
            })
            .select('id, title, slug')
            .single();

          if (comicErr || !newComic) {
            console.error(`[CatalogSync] Gagal insert komik "${finalTitle}":`, comicErr?.message);
            stats.errors.push(`Comic insert error (${slug}): ${comicErr?.message}`);
            continue;
          }

          stats.newComicsAdded++;
          console.log(`[CatalogSync] -> Berhasil menambahkan komik "${newComic.title}" (ID: ${newComic.id})`);

          // Sync genre
          if (meta?.genres && meta.genres.length > 0) {
            await syncWorkerComicGenres(supabase, newComic.id, meta.genres).catch(() => {});
          }

          // Daftarkan chapter-chapter yang ditemukan (HANYA METADATA, TANPA GAMBAR)
          const chaptersToInsert: any[] = [];

          if (detail && detail.chapters.length > 0) {
            detail.chapters.forEach((ch) => {
              chaptersToInsert.push({
                comic_id: newComic.id,
                chapter_number: ch.chapterNumber,
                title: ch.title,
                status: 'published',
                released_at: new Date().toISOString(),
              });
            });
          } else if (item.latestChapter?.chapterNumber) {
            // Minimal daftarkan chapter terbaru
            chaptersToInsert.push({
              comic_id: newComic.id,
              chapter_number: item.latestChapter.chapterNumber,
              title: item.latestChapter.title || `Chapter ${item.latestChapter.chapterNumber}`,
              status: 'published',
              released_at: new Date().toISOString(),
            });
          }

          if (chaptersToInsert.length > 0) {
            const { error: chErr } = await supabase.from('chapters').insert(chaptersToInsert);
            if (!chErr) {
              stats.newChaptersAdded += chaptersToInsert.length;
              console.log(`[CatalogSync] -> Berhasil mendaftarkan ${chaptersToInsert.length} chapter untuk "${newComic.title}"`);
            }
          }
        } else {
          // KOMIK SUDAH ADA DI DB: Cek apakah ada chapter baru
          if (item.latestChapter?.chapterNumber) {
            const latestNum = item.latestChapter.chapterNumber;
            const { data: existingCh } = await supabase
              .from('chapters')
              .select('id')
              .eq('comic_id', existingComic.id)
              .eq('chapter_number', latestNum)
              .maybeSingle();

            if (!existingCh) {
              // Chapter baru belum ada di database!
              console.log(
                `[CatalogSync] -> NEW CHAPTER DETECTED: Chapter ${latestNum} untuk "${existingComic.title}"`
              );
              const { error: insertChErr } = await supabase.from('chapters').insert({
                comic_id: existingComic.id,
                chapter_number: latestNum,
                title: item.latestChapter.title || `Chapter ${latestNum}`,
                status: 'published',
                released_at: new Date().toISOString(),
              });

              if (!insertChErr) {
                stats.newChaptersAdded++;
                // Perbarui timestamp updated_at komik
                await supabase
                  .from('comics')
                  .update({ updated_at: new Date().toISOString() })
                  .eq('id', existingComic.id);
              }
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[CatalogSync] Fatal sync error:', err?.message || err);
    stats.errors.push(err?.message || String(err));
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  console.log('\n========================================');
  console.log('       SYNC SUMMARY HASIL SELESAI       ');
  console.log(` Halaman discan      : ${stats.pagesScanned}`);
  console.log(` Komik ditemukan     : ${stats.comicsFound}`);
  console.log(` Komik baru ditambah : ${stats.newComicsAdded}`);
  console.log(` Chapter baru ditambah: ${stats.newChaptersAdded}`);
  console.log('========================================\n');

  return stats;
}

/**
 * Sync single comic details and all chapters on-demand
 */
export async function syncSingleComic(slug: string): Promise<{
  success: boolean;
  comic?: any;
  chaptersCount?: number;
  error?: string;
}> {
  const supabase = createAdminClient();
  if (!supabase) {
    return { success: false, error: 'Database admin connection not available' };
  }

  const chromePath = getChromeExecutablePath();
  if (!chromePath) {
    return { success: false, error: 'Chrome executable not found on server' };
  }

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });

    const comicUrl = `https://v1.westmanga.my/comic/${slug}`;
    const detail = await extractComicDetailWithPuppeteer(browser, comicUrl, slug);
    if (!detail) {
      return { success: false, error: `Comic ${slug} not found on source` };
    }

    // Check or insert comic
    let { data: comic } = await supabase
      .from('comics')
      .select('id, title, slug')
      .eq('slug', slug)
      .maybeSingle();

    if (!comic) {
      const meta = await fetchComicMetadata(detail.title).catch(() => null);
      const { data: newComic, error: createErr } = await supabase
        .from('comics')
        .insert({
          slug,
          title: meta?.title || detail.title,
          type: (meta?.type as any) || detail.type || 'manhwa',
          synopsis: meta?.synopsis || detail.synopsis,
          cover_url: meta?.cover_url || detail.coverUrl,
          author: meta?.author || 'Unknown Author',
          rating: meta?.rating || 4.5,
          status: (meta?.status as any) || 'ongoing',
        })
        .select('id, title, slug')
        .single();

      if (createErr || !newComic) {
        return { success: false, error: createErr?.message || 'Failed creating comic' };
      }
      comic = newComic;

      if (meta?.genres && meta.genres.length > 0) {
        await syncWorkerComicGenres(supabase, comic.id, meta.genres).catch(() => {});
      }
    }

    // Upsert chapters
    if (detail.chapters.length > 0) {
      const chaptersToInsert = detail.chapters.map((ch) => ({
        comic_id: comic.id,
        chapter_number: ch.chapterNumber,
        title: ch.title,
        status: 'published',
        released_at: new Date().toISOString(),
      }));

      await supabase
        .from('chapters')
        .upsert(chaptersToInsert, { onConflict: 'comic_id, chapter_number', ignoreDuplicates: true });
    }

    return {
      success: true,
      comic,
      chaptersCount: detail.chapters.length,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Single comic sync failed' };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

