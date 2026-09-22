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
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});
    try {
      await page.waitForSelector('a[href*="/view/"]', { timeout: 6000 });
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
    console.warn(`Could not load chapters for ${slug}:`, err.message);
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

async function runCliSync() {
  console.log('=====================================================');
  console.log('  WESTMANGA AUTO-SYNC (METADATA & NEW CHAPTERS ONLY) ');
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

  const maxPages = parseInt(process.env.SYNC_MAX_PAGES || '2', 10);
  let newComics = 0;
  let newChapters = 0;

  try {
    for (let page = 1; page <= maxPages; page++) {
      const url = `https://v1.westmanga.my/contents?page=${page}`;
      console.log(`\nScanning ${url}...`);

      let html = '';
      if (browser) {
        const bPage = await browser.newPage();
        try {
          await bPage.goto(url, { waitUntil: 'networkidle2', timeout: 35000 }).catch(() => {});
          try {
            await bPage.waitForSelector('a[href*="/comic/"]', { timeout: 10000 });
          } catch {
            await new Promise((r) => setTimeout(r, 3000));
          }
          html = await bPage.content();
        } finally {
          await bPage.close().catch(() => {});
        }
      }

      if (!html) continue;

      const $ = cheerio.load(html);
      const items = [];
      const seen = new Set();

      // Scoped card extraction to prevent mixing cards
      $('div.flex.items-start.gap-2').each((_, el) => {
        const card = $(el);
        const link = card.find('a[href*="/comic/"]').first();
        const href = link.attr('href') || '';
        const match = href.match(/\/comic\/([a-zA-Z0-9_-]+)/i);
        if (!match) return;
        const slug = match[1];
        if (seen.has(slug)) return;
        seen.add(slug);

        let title = card.find('div.flex-col a[href*="/comic/"] p').first().text().trim() ||
                    card.find('p.font-medium, p.font-semibold, p.text-sm').first().text().trim();
        if (!title) {
          title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        }

        let coverUrl = card.find('img[src*="storage.westmanga"], img.object-fill, img').first().attr('src') || '';
        if (coverUrl.includes('flagcdn')) coverUrl = '';

        let type = 'manhwa';
        const flag = card.find('img[src*="flagcdn"]').first().attr('src') || '';
        if (flag.includes('/cn.')) type = 'manhua';
        else if (flag.includes('/jp.')) type = 'manga';

        items.push({
          title,
          slug,
          coverUrl,
          type,
        });
      });

      console.log(`Ditemukan ${items.length} komik di halaman ${page}`);

      for (const item of items) {
        // Cek apakah komik sudah ada di DB
        const { data: existing } = await supabase
          .from('comics')
          .select('id, title, slug')
          .eq('slug', item.slug)
          .maybeSingle();

        let comicId = existing?.id;

        if (!existing) {
          console.log(`-> Komik baru: "${item.title}" (${item.slug})`);

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
          }
        }

        if (comicId && browser) {
          // Cek apakah komik ini belum punya chapter di DB atau perlu disinkronkan
          const { count } = await supabase
            .from('chapters')
            .select('id', { count: 'exact', head: true })
            .eq('comic_id', comicId);

          if (!count || count === 0) {
            console.log(`   Mengambil daftar chapter awal untuk "${item.title}"...`);
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
              console.log(`   + ${chapters.length} chapter ditambahkan.`);
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
