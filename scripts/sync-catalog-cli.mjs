import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { execSync } from 'child_process';

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

async function runCliSync() {
  console.log('=====================================================');
  console.log('  WESTMANGA AUTO-SYNC (DYNAMIC CATALOG & CHAPTERS)   ');
  console.log('  TIDAK MENYIMPAN GAMBAR CHAPTER DI DATABASE         ');
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
          console.log(`   + Komik baru: "${item.title}" (${item.slug})`);

          const { data: newComic, error: insErr } = await supabase
            .from('comics')
            .insert({
              slug: item.slug,
              title: item.title,
              type: item.type,
              synopsis: `Baca komik ${item.title} Bahasa Indonesia di Westmanga.`,
              cover_url: item.coverUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
              author: 'Unknown Author',
              rating: 4.5,
              status: 'ongoing',
            })
            .select('id, title, slug')
            .single();

          if (!insErr && newComic) {
            newComics++;
            comicId = newComic.id;

            // Masukkan latest chapter langsung jika ada dari card
            if (item.latestChapter?.chapterNumber) {
              await supabase.from('chapters').insert({
                comic_id: comicId,
                chapter_number: item.latestChapter.chapterNumber,
                title: item.latestChapter.title,
                status: 'published',
                released_at: new Date().toISOString(),
              });
              newChapters++;
            }
          }
        } else {
          // Komik sudah ada: cek apakah ada chapter baru dari card
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
              await supabase.from('chapters').insert({
                comic_id: existing.id,
                chapter_number: chNum,
                title: item.latestChapter.title,
                status: 'published',
                released_at: new Date().toISOString(),
              });
              newChapters++;
            }
          }
        }

        // Jika komik baru atau belum punya chapter sama sekali di DB, ambil daftar chapter awal
        if (comicId && browser) {
          const { count } = await supabase
            .from('chapters')
            .select('id', { count: 'exact', head: true })
            .eq('comic_id', comicId);

          if (!count || count === 0) {
            const chapters = await fetchComicChapters(browser, item.slug);
            if (chapters.length > 0) {
              const rows = chapters.map((ch) => ({
                comic_id: comicId,
                chapter_number: ch.chapter_number,
                title: ch.title,
                status: 'published',
                released_at: new Date().toISOString(),
              }));
              await supabase.from('chapters').upsert(rows, { onConflict: 'comic_id,chapter_number' });
              newChapters += chapters.length;
            }
          }
        }
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
