import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { execSync } from 'child_process';

// Load Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials missing! Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
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

  const maxPages = 2;
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

      $('a[href*="/comic/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const match = href.match(/\/comic\/([a-zA-Z0-9_-]+)/i);
        if (!match) return;
        const slug = match[1];
        if (seen.has(slug)) return;
        seen.add(slug);

        const cardScope = $(el).closest('.group, .space-y-1, .overflow-hidden, div[data-slot="card"]');
        
        let title = $(el).find('p').first().text().trim();
        if (!title && cardScope.length > 0) {
          title = cardScope.find('p.font-medium, p.font-semibold').first().text().trim();
        }
        if (!title) {
          title = $(el).attr('title') || $(el).text().trim();
        }
        if (!title || title.length < 2) {
          title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        }

        let coverUrl = cardScope.find('img.object-fill, img[src*="storage.westmanga"]').first().attr('src') ||
                       cardScope.find('img').first().attr('src') || '';
        if (coverUrl.includes('flagcdn')) coverUrl = '';

        // Tipe komik dari flag
        let type = 'manhwa';
        const flag = cardScope.find('img[src*="flagcdn"]').first().attr('src') || '';
        if (flag.includes('/cn.')) type = 'manhua';
        else if (flag.includes('/jp.')) type = 'manga';

        // Chapter terbaru
        const chEl = cardScope.find('a[href*="/view/"]').first();
        let chNum = undefined;
        let chTitle = '';
        if (chEl.length > 0) {
          chTitle = chEl.text().trim();
          const chMatch = chTitle.match(/(?:chapter|ch\.?)\s*(\d+(?:[\.-]\d+)?)/i);
          if (chMatch) chNum = parseFloat(chMatch[1].replace('-', '.'));
        }

        items.push({
          title,
          slug,
          coverUrl,
          type,
          latestChapter: chNum ? { chapterNumber: chNum, title: chTitle } : undefined,
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
            if (item.latestChapter?.chapterNumber) {
              await supabase.from('chapters').insert({
                comic_id: newComic.id,
                chapter_number: item.latestChapter.chapterNumber,
                title: item.latestChapter.title || `Chapter ${item.latestChapter.chapterNumber}`,
                status: 'published',
                released_at: new Date().toISOString(),
              });
              newChapters++;
            }
          }
        } else {
          // Cek chapter baru
          if (item.latestChapter?.chapterNumber) {
            const chNum = item.latestChapter.chapterNumber;
            const { data: chExist } = await supabase
              .from('chapters')
              .select('id')
              .eq('comic_id', existing.id)
              .eq('chapter_number', chNum)
              .maybeSingle();

            if (!chExist) {
              console.log(`-> Chapter baru untuk "${existing.title}": Chapter ${chNum}`);
              const { error: insChErr } = await supabase.from('chapters').insert({
                comic_id: existing.id,
                chapter_number: chNum,
                title: item.latestChapter.title || `Chapter ${chNum}`,
                status: 'published',
                released_at: new Date().toISOString(),
              });

              if (!insChErr) {
                newChapters++;
                await supabase
                  .from('comics')
                  .update({ updated_at: new Date().toISOString() })
                  .eq('id', existing.id);
              }
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
