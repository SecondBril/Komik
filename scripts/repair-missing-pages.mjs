import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { execSync } from 'child_process';

// 1. Load Environment Variables from .env.local
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials missing from .env.local or process.env!');
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

/**
 * Blokir request berat seperti iklan, tracker, dan font agar navigasi super cepat
 */
async function setupPageInterception(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const rt = req.resourceType();
    const url = req.url().toLowerCase();

    if (
      ['font', 'media'].includes(rt) ||
      url.includes('google') ||
      url.includes('histats') ||
      url.includes('/0ads/') ||
      url.includes('cloudflareinsights') ||
      url.includes('doubleclick') ||
      url.includes('facebook') ||
      url.includes('adnxs') ||
      url.includes('syndication') ||
      url.includes('analytics')
    ) {
      req.abort();
    } else {
      req.continue();
    }
  });
}

function isComicImage(url) {
  return (
    url &&
    typeof url === 'string' &&
    url.includes('storage.westmanga.blog/west/') &&
    !url.includes('/0ads/') &&
    !url.includes('logo') &&
    !url.includes('avatar') &&
    !url.includes('reaction') &&
    !url.includes('icon')
  );
}

/**
 * Ekstrak nomor chapter dari teks atau URL
 * Mendukung format desimal (contoh: 5.2 -> 'chapter-05-2') dan integer (contoh: 211 -> 'chapter-211')
 */
function extractChapterNumber(text, href) {
  const cleanHref = href || '';
  const cleanText = text || '';

  // 1. Cek dari pola href Westmanga: /view/...-chapter-(\d+(?:-\d+)?)
  const hrefMatch = cleanHref.match(/chapter-(\d+(?:-\d+)?)(?:-bahasa-indonesia)?(?:[/?#]|$)/i);
  if (hrefMatch) {
    const raw = hrefMatch[1].replace('-', '.');
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) return parsed;
  }

  // 2. Cek dari pola text: Chapter 05.2, Chapter 5-2, Ch 211, dll
  const textMatch = cleanText.match(/(?:chapter|ch\.?)\s*(\d+(?:[\.-]\d+)?)/i);
  if (textMatch) {
    const raw = textMatch[1].replace('-', '.');
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) return parsed;
  }

  return null;
}

/**
 * Buat daftar URL alternatif jika chapter tidak ditemukan di map DOM
 */
function getCandidateChapterUrls(slug, chapterNumber) {
  const num = Number(chapterNumber);
  const isDecimal = num % 1 !== 0;
  const urls = [];

  if (isDecimal) {
    const [intPart, decPart] = String(num).split('.');
    const padInt = intPart.padStart(2, '0');
    // Format Westmanga untuk sub-chapter: chapter-05-2 atau chapter-5-2
    urls.push(`https://v1.westmanga.my/view/${slug}-chapter-${padInt}-${decPart}-bahasa-indonesia`);
    urls.push(`https://v1.westmanga.my/view/${slug}-chapter-${padInt}-${decPart}`);
    urls.push(`https://v1.westmanga.my/view/${slug}-chapter-${intPart}-${decPart}-bahasa-indonesia`);
    urls.push(`https://v1.westmanga.my/view/${slug}-chapter-${intPart}-${decPart}`);
    urls.push(`https://v1.westmanga.my/view/${slug}-chapter-${padInt}.${decPart}`);
    urls.push(`https://v1.westmanga.my/view/${slug}-chapter-${intPart}.${decPart}`);
  } else {
    const padNum = String(num).padStart(2, '0');
    const rawNum = String(num);
    // Format Westmanga untuk integer: chapter-01 / chapter-211
    urls.push(`https://v1.westmanga.my/view/${slug}-chapter-${padNum}-bahasa-indonesia`);
    urls.push(`https://v1.westmanga.my/view/${slug}-chapter-${padNum}`);
    urls.push(`https://v1.westmanga.my/view/${slug}-chapter-${rawNum}-bahasa-indonesia`);
    urls.push(`https://v1.westmanga.my/view/${slug}-chapter-${rawNum}`);
  }

  return urls;
}

async function scrapeComicChaptersPages(browser, comic, maxChapters = 0) {
  console.log(`\n======================================================`);
  console.log(`📖 Memproses Komik: "${comic.title}" (${comic.slug})`);
  console.log(`======================================================`);

  // 1. Ambil semua chapter di DB beserta status gambarnya via nested select efisien
  const { data: dbChapters, error: chErr } = await supabase
    .from('chapters')
    .select('id, chapter_number, title, chapter_pages(id)')
    .eq('comic_id', comic.id)
    .order('chapter_number', { ascending: true });

  if (chErr || !dbChapters || dbChapters.length === 0) {
    console.log(`   ⚠️ Tidak ada chapter terdaftar di database untuk komik ini.`);
    return 0;
  }

  let missingChapters = dbChapters.filter(
    (ch) => !ch.chapter_pages || ch.chapter_pages.length === 0
  );

  if (missingChapters.length === 0) {
    console.log(`   ✅ Semua ${dbChapters.length} chapter sudah memiliki gambar lengkap!`);
    return 0;
  }

  if (maxChapters > 0 && missingChapters.length > maxChapters) {
    console.log(`   ⚡ Dibatasi ${maxChapters} chapter terbaru (dari total ${missingChapters.length} chapter tanpa gambar).`);
    missingChapters = missingChapters.sort((a, b) => b.chapter_number - a.chapter_number).slice(0, maxChapters);
  }

  console.log(`   ⚠️ Memproses ${missingChapters.length} chapter yang belum punya gambar...`);

  // 2. Kunjungi halaman komik di Westmanga untuk memetakan tautan chapter yang aktif
  const mapPage = await browser.newPage();
  await setupPageInterception(mapPage);

  console.log(`   ⏳ Mengambil mapping URL chapter dari Westmanga...`);
  const comicUrl = `https://v1.westmanga.my/comic/${comic.slug}`;

  let chapterUrlMap = {};
  try {
    await mapPage.goto(comicUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

    // Tunggu React SPA me-render link chapter ke dalam DOM
    await mapPage.waitForFunction(
      () => Array.from(document.querySelectorAll('a')).some((a) => (a.href || '').includes('/view/')),
      { timeout: 20000 }
    );

    const extractedLinks = await mapPage.evaluate(() => {
      const allA = Array.from(document.querySelectorAll('a[href*="/view/"]'));
      return allA.map((a) => ({ href: a.href || '', text: a.innerText.trim() }));
    });

    for (const item of extractedLinks) {
      const num = extractChapterNumber(item.text, item.href);
      if (num !== null && !isNaN(num)) {
        chapterUrlMap[num] = item.href;
        chapterUrlMap[String(num)] = item.href;
        chapterUrlMap[num.toFixed(1)] = item.href;
      }
    }

    console.log(`   ✓ Ditemukan ${Object.keys(chapterUrlMap).length} tautan chapter aktif di Westmanga.`);
  } catch (err) {
    console.warn(`   ⚠️ Gagal memetakan daftar chapter dari Westmanga:`, err.message);
  } finally {
    await mapPage.close().catch(() => {});
  }

  // 3. Gunakan SATU page yang reusable untuk mengambil gambar tiap chapter (super hemat memori & cepat)
  const chPage = await browser.newPage();
  await chPage.setRequestInterception(true);

  let apiImages = [];
  let interceptedImages = [];

  chPage.on('request', (req) => {
    const rt = req.resourceType();
    const url = req.url();

    if (isComicImage(url) && !interceptedImages.includes(url)) {
      interceptedImages.push(url);
    }

    if (
      ['font', 'media'].includes(rt) ||
      url.includes('google') ||
      url.includes('histats') ||
      url.includes('/0ads/') ||
      url.includes('cloudflareinsights') ||
      url.includes('doubleclick') ||
      url.includes('facebook') ||
      url.includes('analytics')
    ) {
      req.abort();
    } else {
      req.continue();
    }
  });

  chPage.on('response', async (res) => {
    const url = res.url();
    if (url.includes('data.mantweh.online/api/v/') && res.request().method() === 'GET') {
      try {
        const json = await res.json();
        if (json.data?.images && Array.isArray(json.data.images)) {
          const valid = json.data.images.filter(isComicImage);
          if (valid.length > 0) {
            apiImages = valid;
          }
        }
      } catch {}
    }
  });

  let restoredChaptersCount = 0;

  for (const ch of missingChapters) {
    const mappedUrl =
      chapterUrlMap[ch.chapter_number] ||
      chapterUrlMap[String(ch.chapter_number)] ||
      chapterUrlMap[Number(ch.chapter_number)];

    const candidateUrls = mappedUrl
      ? [mappedUrl]
      : getCandidateChapterUrls(comic.slug, ch.chapter_number);

    let capturedForChapter = [];

    for (const targetUrl of candidateUrls) {
      console.log(`   ⏳ Mengambil Ch. ${ch.chapter_number} -> ${targetUrl}`);
      apiImages = [];
      interceptedImages = [];

      try {
        await chPage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

        const waitStart = Date.now();
        while (apiImages.length === 0 && interceptedImages.length === 0 && Date.now() - waitStart < 4000) {
          await new Promise((r) => setTimeout(r, 150));
        }

        // Jika gambar via request sudah masuk, tunggu 500ms agar respon API canonical sempat diterima
        if (apiImages.length === 0 && interceptedImages.length > 0) {
          const extraWait = Date.now();
          while (apiImages.length === 0 && Date.now() - extraWait < 800) {
            await new Promise((r) => setTimeout(r, 100));
          }
        }

        let result = apiImages.length > 0 ? apiImages : interceptedImages;

        // Fallback DOM jika API terhalang
        if (result.length === 0) {
          const domImgs = await chPage.evaluate(() => {
            return Array.from(document.querySelectorAll('img'))
              .map((i) => i.src || i.getAttribute('data-src') || '')
              .filter((s) => s && s.includes('storage.westmanga.blog/west/') && !s.includes('/0ads/'));
          });
          result = domImgs.filter(isComicImage);
        }

        if (result.length > 0) {
          capturedForChapter = result;
          break; // Sukses menemukan gambar, tidak perlu cek kandidat URL berikutnya
        }
      } catch (navErr) {
        console.warn(`      ⚠️ Error navigasi: ${navErr.message}`);
      }
    }

    if (capturedForChapter.length > 0) {
      const rows = capturedForChapter.map((imgUrl, idx) => ({
        chapter_id: ch.id,
        page_number: idx + 1,
        image_url: imgUrl,
      }));

      const { error: insErr } = await supabase
        .from('chapter_pages')
        .upsert(rows, { onConflict: 'chapter_id,page_number' });

      if (insErr) {
        console.error(`      ❌ Gagal simpan ke DB untuk Ch ${ch.chapter_number}:`, insErr.message);
      } else {
        console.log(`      ✅ Sukses! ${rows.length} halaman tersimpan di database.`);
        await supabase.from('chapters').update({ status: 'published', retry_count: 0 }).eq('id', ch.id);
        restoredChaptersCount++;
      }
    } else {
      console.warn(`      ⚠️ Tidak ada gambar ditemukan untuk Ch ${ch.chapter_number}.`);
    }

    // Jeda kecil antar chapter agar stabil
    await new Promise((r) => setTimeout(r, 200));
  }

  await chPage.close().catch(() => {});
  return restoredChaptersCount;
}

async function main() {
  const targetSlug = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
  const shardIndex = parseInt(process.env.SHARD_INDEX || '0', 10);
  const totalShards = parseInt(process.env.TOTAL_SHARDS || '1', 10);
  const maxChaptersPerComic = parseInt(process.env.MAX_CHAPTERS_PER_COMIC || '0', 10);
  const limitCount = parseInt(process.env.REPAIR_LIMIT || '0', 10); // 0 = all comics in this shard

  const chromePath = getChromeExecutablePath();
  if (!chromePath) {
    console.error('❌ Google Chrome tidak ditemukan di sistem!');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    if (targetSlug) {
      const { data: comic } = await supabase
        .from('comics')
        .select('id, title, slug')
        .eq('slug', targetSlug)
        .maybeSingle();

      if (!comic) {
        console.error(`❌ Komik "${targetSlug}" tidak ditemukan di database.`);
        process.exit(1);
      }

      await scrapeComicChaptersPages(browser, comic, maxChaptersPerComic);
    } else {
      console.log(`\n======================================================`);
      console.log(`🚀 REPAIR RUNNER [Shard ${shardIndex + 1}/${totalShards}]`);
      if (maxChaptersPerComic > 0) {
        console.log(`⚡ Batas chapter per komik: ${maxChaptersPerComic} chapter terbaru`);
      }
      console.log(`======================================================\n`);

      // Ambil semua komik di database
      const { data: allComics, error: cErr } = await supabase
        .from('comics')
        .select('id, title, slug')
        .order('id', { ascending: true });

      if (cErr || !allComics || allComics.length === 0) {
        console.log('Tidak ada komik ditemukan di database.');
        return;
      }

      // Bagi beban komik secara merata ke shard ini
      const myComics = totalShards > 1
        ? allComics.filter((_, idx) => idx % totalShards === shardIndex)
        : allComics;

      console.log(`📊 Shard ini menangani ${myComics.length} komik (dari total ${allComics.length} komik di database).\n`);

      let processedCount = 0;
      let repairedCount = 0;

      for (let i = 0; i < myComics.length; i++) {
        if (limitCount > 0 && repairedCount >= limitCount) {
          console.log(`\nSudah mencapai batas limit repair (${limitCount} komik).`);
          break;
        }

        const comic = myComics[i];
        console.log(`\n[${i + 1}/${myComics.length}] Memeriksa: "${comic.title}" (${comic.slug})`);

        const restored = await scrapeComicChaptersPages(browser, comic, maxChaptersPerComic);
        if (restored > 0) {
          repairedCount++;
          await supabase
            .from('comics')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', comic.id);
        }
        processedCount++;
      }

      console.log(`\n======================================================`);
      console.log(`🎉 [Shard ${shardIndex + 1}/${totalShards}] Selesai!`);
      console.log(`   Komik diperiksa  : ${processedCount}`);
      console.log(`   Komik diperbaiki : ${repairedCount}`);
      console.log(`======================================================\n`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
