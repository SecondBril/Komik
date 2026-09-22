import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { execSync } from 'child_process';
import { fetchComicMetadata, syncWorkerComicGenres } from '../workers/lib/comic-metadata.ts';

// If running locally without preloaded env, load .env.local if present
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && fs.existsSync('.env.local')) {
  try {
    const envLines = fs.readFileSync('.env.local', 'utf8').split('\n');
    for (const line of envLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {}
}

// Load Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials missing! Ensure NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getChromeExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  if (process.platform !== 'win32') {
    try {
      const whichChrome = execSync('which google-chrome || which google-chrome-stable || which chromium', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
      if (whichChrome && fs.existsSync(whichChrome)) return whichChrome;
    } catch {}
  }
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];
  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

async function fetchComicChapters(browser, slug) {
  const page = await browser.newPage();
  try {
    const url = `https://v1.westmanga.my/comic/${slug}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    try {
      await page.waitForSelector('a[href*="/view/"]', { timeout: 5000 });
    } catch {}

    const html = await page.content();
    const $ = cheerio.load(html);
    const chapters = [];
    const seenCh = new Set();

    $('a[href*="/view/"]').each((_, a) => {
      const txt = $(a).text().trim();
      const href = $(a).attr('href') || '';
      const match = txt.match(/(?:chapter|ch\.?)\s*(\d+(?:[\.-]\d+)?)/i) || href.match(/chapter-(\d+(?:[\.-]\d+)?)/i);
      if (match) {
        const chNum = parseFloat(match[1].replace('-', '.'));
        if (!seenCh.has(chNum)) {
          seenCh.add(chNum);
          chapters.push({
            chapter_number: chNum,
            title: `Chapter ${chNum}`,
          });
        }
      }
    });

    return chapters;
  } catch (err) {
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

async function fetchChapterPages(browser, comicSlug, chapterNumber) {
  if (!browser) return [];
  const page = await browser.newPage();
  const capturedImages = [];
  const seenUrls = new Set();

  try {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      const type = req.resourceType();
      if (
        type === 'font' ||
        url.includes('google') ||
        url.includes('cloudflareinsights') ||
        url.includes('histats') ||
        url.includes('0ads')
      ) {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });

    page.on('response', async (res) => {
      const url = res.url();
      if (
        res.status() === 200 &&
        res.request().method() === 'GET' &&
        url.includes('data.mantweh.online/api/v/')
      ) {
        try {
          const json = await res.json();
          if (json.data?.images && Array.isArray(json.data.images)) {
            json.data.images.forEach((imgUrl) => {
              if (
                imgUrl &&
                typeof imgUrl === 'string' &&
                imgUrl.includes('storage.westmanga.blog/west/') &&
                !imgUrl.includes('/0ads/') &&
                !imgUrl.includes('logo') &&
                !seenUrls.has(imgUrl)
              ) {
                seenUrls.add(imgUrl);
                capturedImages.push(imgUrl);
              }
            });
          }
        } catch {}
      }
    });

    const candidateSlugs = [
      `${comicSlug}-chapter-${chapterNumber}`,
      `${comicSlug}-chapter-${String(chapterNumber).padStart(2, '0')}`,
      `${comicSlug}-chapter-${chapterNumber}-bahasa-indonesia`,
      `${comicSlug}-chapter-${String(chapterNumber).padStart(2, '0')}-bahasa-indonesia`,
    ];

    for (const chSlug of candidateSlugs) {
      const targetUrl = `https://v1.westmanga.my/view/${chSlug}`;
      try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const start = Date.now();
        while (capturedImages.length === 0 && Date.now() - start < 3500) {
          await new Promise((r) => setTimeout(r, 150));
        }
        if (capturedImages.length > 0) break;

        const domImages = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('img'))
            .map((img) => img.src || img.getAttribute('data-src') || '')
            .filter((src) => src.includes('storage.westmanga.blog/west/'));
        });

        if (domImages.length > 0) {
          domImages.forEach((imgUrl) => {
            if (!seenUrls.has(imgUrl) && !imgUrl.includes('/0ads/') && !imgUrl.includes('logo')) {
              seenUrls.add(imgUrl);
              capturedImages.push(imgUrl);
            }
          });
          if (capturedImages.length > 0) break;
        }
      } catch {}
    }

    return capturedImages;
  } catch (err) {
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

async function saveChapterPagesToDb(supabase, chapterId, images) {
  if (!images || images.length === 0) return 0;
  const pageRows = images.map((url, idx) => ({
    chapter_id: chapterId,
    page_number: idx + 1,
    image_url: url,
  }));
  const { error } = await supabase.from('chapter_pages').upsert(pageRows, { onConflict: 'chapter_id,page_number' });
  if (error) {
    console.warn(`       ⚠️ Gagal menyimpan chapter_pages:`, error.message);
    return 0;
  }
  return pageRows.length;
}

async function runCliSync() {
  console.log('=====================================================');
  console.log('  WESTMANGA AUTO-SYNC (CATALOG, CHAPTERS & IMAGES)   ');
  console.log('  MENYIMPAN GAMBAR ASLI KE Supabase (chapter_pages)  ');
  console.log('=====================================================\n');

  const chromePath = getChromeExecutablePath();
  let browser = null;
  if (chromePath) {
    try {
      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
      });
      console.log('Browser engine Puppeteer ready.');
    } catch (e) {
      console.warn('Browser launch skipped:', e.message);
    }
  }

  // Support argument: node scripts/sync-catalog-cli.mjs 1000 or env SYNC_MAX_PAGES
  // Defaults to 300 pages (covers full 270 pages on Westmanga)
  const maxRequestedPages = parseInt(process.argv[2] || process.env.SYNC_MAX_PAGES || '300', 10);
  console.log(`Batas maksimal scanning: hingga ${maxRequestedPages} halaman.`);

  let newComics = 0;
  let newChapters = 0;
  let totalDetectedPages = 270; // Westmanga catalog total is 270 pages (6,742 comics)

  try {
    for (let page = 1; page <= maxRequestedPages; page++) {
      if (page > totalDetectedPages) {
        console.log(`\nSudah mencapai halaman terakhir katalog (${totalDetectedPages}). Selesai.`);
        break;
      }

      const url = `https://v1.westmanga.my/contents?page=${page}`;
      console.log(`\n[Halaman ${page}/${Math.min(maxRequestedPages, totalDetectedPages)}] Scanning ${url}...`);

      let html = '';
      if (browser) {
        const bPage = await browser.newPage();
        try {
          await bPage.goto(url, { waitUntil: 'networkidle2', timeout: 35000 }).catch(() => {});
          try {
            await bPage.waitForSelector('a[href*="/comic/"]', { timeout: 10000 });
          } catch {
            await new Promise((r) => setTimeout(r, 2500));
          }

          // Delay for hydration
          await new Promise((r) => setTimeout(r, 2000));
          html = await bPage.content();
        } finally {
          await bPage.close().catch(() => {});
        }
      }

      if (!html) continue;

      const $ = cheerio.load(html);
      const items = [];
      const seen = new Set();

      // Robust extraction of ALL 30 comics per page (main grid + new projects)
      $('a[href*="/comic/"]').each((_, a) => {
        const href = $(a).attr('href') || '';
        const m = href.match(/\/comic\/([a-zA-Z0-9_-]+)/i);
        if (!m) return;
        const slug = m[1];
        if (seen.has(slug)) return;
        seen.add(slug);

        const card = $(a).closest('div.group, div.relative.rounded-md, div.flex.items-start, div.space-y-1').parent();

        let title = card.find('p.font-medium, p.font-semibold, p.text-sm').first().text().trim();
        if (!title) {
          title = card.find('img[alt]').first().attr('alt')?.trim() || '';
        }
        if (!title || title.startsWith('JP') || title.startsWith('CN') || title.startsWith('KR')) {
          title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }

        let coverUrl = card.find('img.object-fill, img[src*="storage.westmanga"], img').first().attr('src') || '';
        if (coverUrl.includes('flagcdn')) {
          card.find('img').each((_, img) => {
            const src = $(img).attr('src') || '';
            if (src && !src.includes('flagcdn') && !coverUrl.includes('storage.westmanga')) {
              coverUrl = src;
            }
          });
        }

        let type = 'manhwa';
        const flag = card.find('img[src*="flagcdn"]').first().attr('src') || '';
        if (flag.includes('/cn.')) type = 'manhua';
        else if (flag.includes('/jp.')) type = 'manga';

        let latestChapter = undefined;
        const chEl = card.find('a[href*="/view/"]').first();
        if (chEl.length) {
          const chText = chEl.text().trim();
          const chMatch = chText.match(/(?:chapter|ch\.?)\s*(\d+(?:[\.-]\d+)?)/i);
          if (chMatch) {
            latestChapter = {
              chapterNumber: parseFloat(chMatch[1].replace('-', '.')),
              title: `Chapter ${chMatch[1]}`,
            };
          }
        }

        items.push({
          title,
          slug,
          coverUrl,
          type,
          latestChapter,
        });
      });

      if (items.length === 0) {
        console.log(`Halaman ${page} tidak memiliki komik. Menghentikan scanning.`);
        break;
      }

      console.log(`-> Ditemukan ${items.length} komik di halaman ${page}`);

      for (const item of items) {
        const { data: existing } = await supabase
          .from('comics')
          .select('id, title, slug')
          .eq('slug', item.slug)
          .maybeSingle();

        let comicId = existing?.id;

        if (!existing) {
          console.log(`   + Komik baru terdeteksi: "${item.title}" (${item.slug})`);

          // Cari metadata ke AniList/API dengan exact title matching
          const meta = await fetchComicMetadata(item.title);
          if (meta) {
            console.log(`     ✓ Ditemukan di ${meta.sourceApi.toUpperCase()}: Author="${meta.author}", Genres=${meta.genres.length}`);
          } else {
            console.log(`     - Tidak ada judul yang sama persis di AniList/API. Tetap disimpan dengan data Westmanga.`);
          }

          // Judul komik jangan dirubah (tetap gunakan item.title dari Westmanga)
          const finalTitle = item.title;
          const finalSlug = item.slug;
          const finalType = meta?.type || item.type || 'manhwa';
          const finalSynopsis =
            meta?.synopsis ||
            `Baca komik ${item.title} Bahasa Indonesia di Westmanga.`;
          const finalCover =
            meta?.cover_url ||
            item.coverUrl ||
            'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';
          const finalAuthor = meta?.author || 'Unknown Author';
          const finalRating = meta?.rating || 4.5;
          const finalStatus = meta?.status || 'ongoing';
          const finalAltTitles = meta?.alt_titles || [];

          const { data: newComic, error: insErr } = await supabase
            .from('comics')
            .insert({
              slug: finalSlug,
              title: finalTitle,
              type: finalType,
              synopsis: finalSynopsis,
              cover_url: finalCover,
              author: finalAuthor,
              rating: finalRating,
              status: finalStatus,
              alt_titles: finalAltTitles,
            })
            .select('id, title, slug')
            .single();

          if (!insErr && newComic) {
            newComics++;
            comicId = newComic.id;

            // Sync genre jika ditemukan dari metadata API
            if (meta?.genres && meta.genres.length > 0) {
              await syncWorkerComicGenres(supabase, comicId, meta.genres);
            }

            // Ambil SEMUA daftar chapter komik agar seluruh chapter tampil di web
            let chapters = [];
            if (browser) {
              chapters = await fetchComicChapters(browser, item.slug);
            }

            if (chapters.length > 0) {
              const rows = chapters.map((ch) => ({
                comic_id: comicId,
                chapter_number: ch.chapter_number,
                title: ch.title,
                status: 'published',
                released_at: new Date().toISOString(),
              }));
              const { data: insertedChs } = await supabase
                .from('chapters')
                .upsert(rows, { onConflict: 'comic_id,chapter_number' })
                .select('id, chapter_number');
              newChapters += chapters.length;
              console.log(`     ✓ Mendaftarkan ${chapters.length} chapter (semua chapter tampil di web).`);

              // Ekstrak gambar asli untuk chapter terbaru agar pembaca langsung bisa membaca
              const targetCh = item.latestChapter?.chapterNumber || chapters[0]?.chapter_number;
              const matchingCh = (insertedChs || []).find((c) => c.chapter_number === targetCh) || insertedChs?.[0];
              if (matchingCh && browser) {
                const images = await fetchChapterPages(browser, item.slug, matchingCh.chapter_number);
                if (images.length > 0) {
                  await saveChapterPagesToDb(supabase, matchingCh.id, images);
                  console.log(`     ✓ Menyimpan ${images.length} gambar asli ke chapter_pages untuk Chapter ${matchingCh.chapter_number}`);
                }
              }
            } else if (item.latestChapter?.chapterNumber) {
              const { data: newCh } = await supabase.from('chapters').insert({
                comic_id: comicId,
                chapter_number: item.latestChapter.chapterNumber,
                title: item.latestChapter.title || `Chapter ${item.latestChapter.chapterNumber}`,
                status: 'published',
                released_at: new Date().toISOString(),
              }).select('id, chapter_number').single();
              newChapters++;
              console.log(`     ✓ Chapter terbaru didaftarkan: Chapter ${item.latestChapter.chapterNumber}`);

              if (newCh && browser) {
                const images = await fetchChapterPages(browser, item.slug, newCh.chapter_number);
                if (images.length > 0) {
                  await saveChapterPagesToDb(supabase, newCh.id, images);
                  console.log(`     ✓ Menyimpan ${images.length} gambar asli ke chapter_pages untuk Chapter ${newCh.chapter_number}`);
                }
              }
            }
          }
        } else {
          // Komik sudah ada di database:
          // 1. Auto-enrich jika data masih default / Unknown Author (tetap pertahankan judul asli)
          const { data: fullComic } = await supabase
            .from('comics')
            .select('id, title, author, synopsis, cover_url')
            .eq('id', existing.id)
            .single();

          if (fullComic) {
            const isUnknownAuthor = !fullComic.author || /unknown/i.test(fullComic.author);
            const isDefaultSynopsis =
              !fullComic.synopsis ||
              fullComic.synopsis.includes('terjemahan Bahasa Indonesia') ||
              fullComic.synopsis.includes('di Westmanga');

            if (isUnknownAuthor || isDefaultSynopsis) {
              const meta = await fetchComicMetadata(fullComic.title);
              if (meta) {
                const updatePayload = {
                  type: meta.type,
                  status: meta.status,
                  rating: meta.rating,
                  alt_titles: meta.alt_titles,
                  updated_at: new Date().toISOString(),
                };
                if (meta.synopsis) updatePayload.synopsis = meta.synopsis;
                if (meta.author && meta.author !== 'Unknown Author') updatePayload.author = meta.author;
                if (meta.cover_url && (!fullComic.cover_url || fullComic.cover_url.includes('unsplash'))) {
                  updatePayload.cover_url = meta.cover_url;
                }
                await supabase.from('comics').update(updatePayload).eq('id', fullComic.id);
                if (meta.genres?.length) {
                  await syncWorkerComicGenres(supabase, fullComic.id, meta.genres);
                }
                console.log(`   ✓ Data komik "${fullComic.title}" diperkaya dari ${meta.sourceApi.toUpperCase()}.`);
              }
            }
          }

          // 2. Jika komik di DB hanya punya 0 atau 1 chapter, lengkapi semua chapternya agar tampil di web
          if (browser) {
            const { count } = await supabase
              .from('chapters')
              .select('id', { count: 'exact', head: true })
              .eq('comic_id', existing.id);

            if (!count || count <= 1) {
              const chapters = await fetchComicChapters(browser, item.slug);
              if (chapters.length > 1) {
                const rows = chapters.map((ch) => ({
                  comic_id: existing.id,
                  chapter_number: ch.chapter_number,
                  title: ch.title,
                  status: 'published',
                  released_at: new Date().toISOString(),
                }));
                await supabase.from('chapters').upsert(rows, { onConflict: 'comic_id,chapter_number' });
                newChapters += (chapters.length - (count || 0));
                console.log(`   + Memperbarui daftar chapter "${existing.title}": ${chapters.length} chapter sekarang lengkap.`);
              }
            }
          }

          // 3. Cek apakah ada chapter baru dari card
          if (item.latestChapter?.chapterNumber) {
            const chNum = item.latestChapter.chapterNumber;
            const { data: chExist } = await supabase
              .from('chapters')
              .select('id')
              .eq('comic_id', existing.id)
              .eq('chapter_number', chNum)
              .maybeSingle();

            if (!chExist) {
              console.log(`   + Chapter baru untuk "${existing.title}": Chapter ${chNum}`);
              const { data: newCh } = await supabase.from('chapters').insert({
                comic_id: existing.id,
                chapter_number: chNum,
                title: item.latestChapter.title || `Chapter ${chNum}`,
                status: 'published',
                released_at: new Date().toISOString(),
              }).select('id').single();
              newChapters++;
              await supabase.from('comics').update({ updated_at: new Date().toISOString() }).eq('id', existing.id);

              if (newCh?.id && browser) {
                const images = await fetchChapterPages(browser, item.slug, chNum);
                if (images.length > 0) {
                  await saveChapterPagesToDb(supabase, newCh.id, images);
                  console.log(`     ✓ Menyimpan ${images.length} gambar asli ke chapter_pages untuk Chapter ${chNum}`);
                }
              }
            } else if (browser) {
              // Auto-backfill: jika chapter sudah ada di DB tapi gambar di chapter_pages masih 0
              const { count: pagesCount } = await supabase
                .from('chapter_pages')
                .select('id', { count: 'exact', head: true })
                .eq('chapter_id', chExist.id);

              if (!pagesCount || pagesCount === 0) {
                const images = await fetchChapterPages(browser, item.slug, chNum);
                if (images.length > 0) {
                  await saveChapterPagesToDb(supabase, chExist.id, images);
                  console.log(`     ✓ Auto-backfill: Menyimpan ${images.length} gambar asli ke chapter_pages untuk Chapter ${chNum}`);
                }
              }
            }
          }
        }

        // Delay kecil agar ramah API AniList/Kitsu
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  } catch (err) {
    console.error('Sync error:', err);
  } finally {
    if (browser) await browser.close();
  }

  console.log('\n=======================================');
  console.log(` Selesai!`);
  console.log(` Komik baru ditambahkan  : ${newComics}`);
  console.log(` Chapter baru ditambahkan: ${newChapters}`);
  console.log('=======================================\n');
}

runCliSync();
