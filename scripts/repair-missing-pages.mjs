import { createClient } from '@supabase/supabase-js';
import { createClient as createTursoClient } from '@libsql/client';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { execSync } from 'child_process';
import {
  ensureCheckpointTables,
  getCheckpoint,
  saveCheckpoint,
  recordHistoryLog,
} from './lib/checkpoint-manager.mjs';

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

const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// 2. Turso client (Database Utama Penyimpanan Komik, Chapter & Halaman)
let turso = null;
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;
if (tursoUrl && tursoToken) {
  try {
    turso = createTursoClient({ url: tursoUrl, authToken: tursoToken });
    console.log('✅ Turso Database terhubung untuk perbaikan chapter/halaman!');
  } catch (tErr) {
    console.error('❌ Gagal inisialisasi Turso:', tErr.message);
    process.exit(1);
  }
} else {
  console.error('\n======================================================');
  console.error('❌ ERROR: TURSO_DATABASE_URL atau TURSO_AUTH_TOKEN BELUM DISET!');
  console.error('======================================================');
  console.error('Semua data komik dan chapter sekarang disimpan di database Turso.');
  console.error('Jika menjalankan di GitHub Actions, Anda HARUS menambahkan Secrets:');
  console.error('  1. Buka Repository GitHub -> Settings -> Secrets and variables -> Actions');
  console.error('  2. Tambahkan Secret: TURSO_DATABASE_URL');
  console.error('  3. Tambahkan Secret: TURSO_AUTH_TOKEN');
  console.error('======================================================\n');
  process.exit(1);
}

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

async function scrapeComicChaptersPages(browser, comic, maxChapters = 0, forceDeepCheck = false) {
  // 0. Cek cepat di Turso: jika seluruh chapter komik ini sudah memiliki gambar lengkap, lewati scraping
  if (turso && !forceDeepCheck) {
    try {
      const chStatusRes = await turso.execute({
        sql: `
          SELECT 
            COUNT(*) as total_chs,
            SUM(CASE WHEN (pages IS NOT NULL AND pages != '[]' AND pages != '') THEN 1 ELSE 0 END) as complete_chs
          FROM chapters WHERE comic_id = ?;
        `,
        args: [comic.id],
      });
      if (chStatusRes.rows.length > 0) {
        const total = Number(chStatusRes.rows[0].total_chs || 0);
        const complete = Number(chStatusRes.rows[0].complete_chs || 0);
        if (total > 0 && total === complete) {
          console.log(`   ✓ [Lengkap] Seluruh ${total} chapter komik "${comic.title}" sudah memiliki gambar di Turso. Melewati scraping.`);
          return 0;
        }
      }
    } catch {}
  }

  console.log(`\n======================================================`);
  console.log(`📖 Memproses Komik: "${comic.title}" (${comic.slug})`);
  console.log(`======================================================`);

  // 1. Kunjungi halaman komik di Westmanga dan tangkap API resmi (Mantweh) untuk mendapatkan 100% chapter akurat
  const mapPage = await browser.newPage();
  await setupPageInterception(mapPage);

  console.log(`   ⏳ Mengambil metadata & daftar chapter resmi dari Westmanga API...`);
  const comicUrl = `https://v1.westmanga.my/comic/${comic.slug}`;

  let chapterUrlMap = {};
  let chapterSlugMap = {};
  let officialChapters = [];

  const comicApiPromise = new Promise((resolve) => {
    const handler = async (res) => {
      const u = res.url();
      if (u.includes('data.mantweh.online/api/comic/' + comic.slug) && res.status() === 200) {
        try {
          const json = await res.json();
          if (json.data?.chapters && Array.isArray(json.data.chapters)) {
            officialChapters = json.data.chapters;
            mapPage.off('response', handler);
            resolve(officialChapters);
          }
        } catch {}
      }
    };
    mapPage.on('response', handler);
    setTimeout(() => {
      mapPage.off('response', handler);
      resolve(null);
    }, 15000);
  });

  try {
    await mapPage.goto(comicUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await comicApiPromise;

    if (officialChapters.length > 0) {
      console.log(`   ✓ Ditemukan ${officialChapters.length} chapter resmi dari Westmanga API.`);
      for (const ch of officialChapters) {
        const num = parseFloat(String(ch.number).replace('-', '.'));
        if (!isNaN(num)) {
          chapterUrlMap[num] = `https://v1.westmanga.my/view/${ch.slug}`;
          chapterUrlMap[String(num)] = `https://v1.westmanga.my/view/${ch.slug}`;
          chapterSlugMap[num] = ch.slug;
          chapterSlugMap[String(num)] = ch.slug;
        }
      }
    } else {
      // Fallback ke DOM parsing jika API tidak tertangkap
      console.log(`   ⏳ Fallback: Mencari link chapter via DOM...`);
      await mapPage.waitForFunction(
        () => Array.from(document.querySelectorAll('a')).some((a) => (a.href || '').includes('/view/')),
        { timeout: 10000 }
      ).catch(() => {});

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
      console.log(`   ✓ Ditemukan ${Object.keys(chapterUrlMap).length} tautan chapter dari DOM.`);
    }
  } catch (err) {
    console.warn(`   ⚠️ Peringatan saat memetakan daftar chapter:`, err.message);
  } finally {
    await mapPage.close().catch(() => {});
  }

  // 2. Sinkronkan chapter resmi yang belum ada di database (misal jika ada chapter baru/terlewat)
  if (officialChapters.length > 0) {
    const { data: existingChs } = await supabase
      .from('chapters')
      .select('chapter_number')
      .eq('comic_id', comic.id);

    const existingNumSet = new Set((existingChs || []).map((c) => Number(c.chapter_number)));
    const missingOfficialChs = officialChapters.filter((ch) => {
      const num = parseFloat(String(ch.number).replace('-', '.'));
      return !isNaN(num) && !existingNumSet.has(num);
    });

    if (missingOfficialChs.length > 0) {
      console.log(`   ⚡ Menambahkan ${missingOfficialChs.length} chapter resmi yang belum tercatat di database...`);
      
      // Deduplikasi baris chapter berdasarkan chapter_number untuk mencegah error ON CONFLICT PostgreSQL
      const seenNum = new Set();
      const newRows = [];
      for (const ch of missingOfficialChs) {
        const num = parseFloat(String(ch.number).replace('-', '.'));
        if (!isNaN(num) && !seenNum.has(num)) {
          seenNum.add(num);
          newRows.push({
            comic_id: comic.id,
            chapter_number: num,
            title: ch.title || `Chapter ${ch.number}`,
            status: 'published',
            released_at: new Date().toISOString(),
          });
        }
      }

      const CHUNK_SIZE = 100;

      // Upsert ke Supabase (hanya jika Turso tidak aktif, agar disk Supabase tidak penuh)
      if (!turso) {
        for (let i = 0; i < newRows.length; i += CHUNK_SIZE) {
          const batch = newRows.slice(i, i + CHUNK_SIZE);
          try {
            await supabase
              .from('chapters')
              .upsert(batch, { onConflict: 'comic_id,chapter_number' });
          } catch {}
        }
      }

      // Upsert ke Turso jika aktif
      if (turso) {
        try {
          const tStmts = newRows.map((r) => ({
            sql: `
              INSERT INTO chapters (id, comic_id, chapter_number, title, status, released_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(comic_id, chapter_number) DO UPDATE SET title = excluded.title;
            `,
            args: [`${r.comic_id}_ch${r.chapter_number}`, r.comic_id, r.chapter_number, r.title, r.status, r.released_at],
          }));
          for (let i = 0; i < tStmts.length; i += CHUNK_SIZE) {
            await turso.batch(tStmts.slice(i, i + CHUNK_SIZE), 'write');
          }
        } catch (tErr) {
          console.warn(`   ⚠️ Gagal upsert chapter baru ke Turso:`, tErr.message);
        }
      }
    }
  }

  // 3. Ambil seluruh chapter terdaftar (prioritas dari Turso, fallback ke Supabase)
  let dbChapters = [];
  if (turso) {
    try {
      const tChs = await turso.execute({
        sql: `SELECT id, chapter_number, title FROM chapters WHERE comic_id = ? ORDER BY chapter_number DESC;`,
        args: [comic.id],
      });
      if (tChs.rows.length > 0) {
        dbChapters = tChs.rows.map((r) => ({
          id: String(r.id),
          chapter_number: Number(r.chapter_number),
          title: String(r.title || `Chapter ${r.chapter_number}`),
        }));
      }
    } catch (tErr) {
      console.warn('   ⚠️ Gagal membaca chapter dari Turso:', tErr.message);
    }
  }

  if (dbChapters.length === 0) {
    const { data: sChapters, error: chErr } = await supabase
      .from('chapters')
      .select('id, chapter_number, title')
      .eq('comic_id', comic.id)
      .order('chapter_number', { ascending: false });

    if (sChapters && sChapters.length > 0) {
      dbChapters = sChapters;
    }
  }

  if (dbChapters.length === 0) {
    console.log(`   ⚠️ Tidak ada chapter terdaftar di database untuk komik ini.`);
    return 0;
  }

  // Cek status gambar di Turso (dari kolom pages dan tabel chapter_pages)
  const tursoPagesMap = new Map();
  if (turso) {
    try {
      // 1. Cek dari kolom JSON pages
      const tRes = await turso.execute({
        sql: `SELECT id, chapter_number, pages FROM chapters WHERE comic_id = ? AND pages IS NOT NULL AND pages != '[]' AND pages != '';`,
        args: [comic.id],
      });
      for (const row of tRes.rows) {
        try {
          const p = JSON.parse(String(row.pages));
          if (Array.isArray(p) && p.length > 0) {
            tursoPagesMap.set(Number(row.chapter_number), p);
          }
        } catch {}
      }

      // 2. Cek juga dari tabel relasional chapter_pages (untuk data lama yang belum ter-cache di kolom JSON)
      const cpRes = await turso.execute({
        sql: `
          SELECT ch.id as chapter_id, ch.chapter_number, cp.image_url
          FROM chapters ch
          JOIN chapter_pages cp ON cp.chapter_id = ch.id
          WHERE ch.comic_id = ?
          ORDER BY ch.chapter_number ASC, cp.page_number ASC;
        `,
        args: [comic.id],
      });

      const cpGrouped = new Map();
      const chIdMap = new Map();
      for (const row of cpRes.rows) {
        const cNum = Number(row.chapter_number);
        if (!cpGrouped.has(cNum)) {
          cpGrouped.set(cNum, []);
          chIdMap.set(cNum, String(row.chapter_id));
        }
        cpGrouped.get(cNum).push(String(row.image_url));
      }

      // Masukkan ke tursoPagesMap dan sekaligus isi cache chapters.pages jika belum ada
      const cacheUpdates = [];
      for (const [cNum, imgs] of cpGrouped.entries()) {
        if (!tursoPagesMap.has(cNum) && imgs.length > 0) {
          tursoPagesMap.set(cNum, imgs);
          const chId = chIdMap.get(cNum);
          if (chId) {
            cacheUpdates.push({
              sql: `UPDATE chapters SET pages = ? WHERE id = ?;`,
              args: [JSON.stringify(imgs), chId],
            });
          }
        }
      }

      if (cacheUpdates.length > 0) {
        // Jalankan background batch update cache JSON di Turso
        for (let i = 0; i < cacheUpdates.length; i += 100) {
          await turso.batch(cacheUpdates.slice(i, i + 100), 'write').catch(() => {});
        }
      }
    } catch (tErr) {
      console.warn('   ⚠️ Gagal membaca halaman chapter dari Turso:', tErr.message);
    }
  }

  // 4. Filter chapter yang BENAR-BENAR belum punya gambar sama sekali di Turso
  let missingChapters = dbChapters.filter((ch) => {
    return !tursoPagesMap.has(Number(ch.chapter_number));
  });

  if (missingChapters.length === 0) {
    console.log(`   ✅ Semua ${dbChapters.length} chapter sudah memiliki gambar lengkap!`);
    return 0;
  }

  if (maxChapters > 0 && missingChapters.length > maxChapters) {
    console.log(`   ⚡ Dibatasi ${maxChapters} chapter terbaru (dari total ${missingChapters.length} chapter tanpa gambar).`);
    missingChapters = missingChapters.slice(0, maxChapters);
  }

  console.log(`   ⚠️ Memproses ${missingChapters.length} chapter yang belum punya gambar...`);

  // 6. Gunakan SATU page reusable dengan response listener terisolasi per-chapter
  const chPage = await browser.newPage();
  await setupPageInterception(chPage);

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

      let apiImages = [];
      const exactSlug = chapterSlugMap[ch.chapter_number] || chapterSlugMap[String(ch.chapter_number)];

      const chPromise = new Promise((resolve) => {
        const handler = async (res) => {
          const u = res.url();
          const matchesUrl = exactSlug ? u.includes(`/api/v/${exactSlug}`) : u.includes('data.mantweh.online/api/v/');
          if (matchesUrl && res.status() === 200 && res.request().method() === 'GET') {
            try {
              const json = await res.json();
              if (json.data?.images && Array.isArray(json.data.images)) {
                const valid = json.data.images.filter(isComicImage);
                if (valid.length > 0) {
                  apiImages = valid;
                  chPage.off('response', handler);
                  resolve(valid);
                }
              }
            } catch {}
          }
        };
        chPage.on('response', handler);
        setTimeout(() => {
          chPage.off('response', handler);
          resolve(null);
        }, 8500);
      });

      try {
        await chPage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await chPromise;

        let result = apiImages;

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
          break; // Berhasil menemukan gambar
        }
      } catch (navErr) {
        console.warn(`      ⚠️ Error navigasi: ${navErr.message}`);
      }
    }

    if (capturedForChapter.length > 0) {
      let savedToTurso = false;

      // 1. Simpan ke Turso (Database Utama Penyimpanan Gambar)
      if (turso) {
        try {
          const tStmts = capturedForChapter.map((imgUrl, idx) => ({
            sql: `
              INSERT INTO chapter_pages (id, chapter_id, page_number, image_url)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(chapter_id, page_number) DO UPDATE SET image_url = excluded.image_url;
            `,
            args: [`${ch.id}_p${idx + 1}`, ch.id, idx + 1, imgUrl],
          }));
          tStmts.push({
            sql: `UPDATE chapters SET pages = ?, status = 'published' WHERE id = ?;`,
            args: [JSON.stringify(capturedForChapter), ch.id],
          });
          await turso.batch(tStmts, 'write');
          console.log(`      ✅ Sukses! ${capturedForChapter.length} halaman tersimpan di Turso.`);
          savedToTurso = true;
          restoredChaptersCount++;
        } catch (tErr) {
          console.warn(`      ⚠️ Gagal simpan ke Turso:`, tErr.message);
        }
      }

      // 2. Jika Turso aktif, JANGAN simpan jutaan gambar ke Supabase chapter_pages
      // (karena disk Supabase Free Tier memiliki batas 500MB -> "No space left on device").
      // Cukup update status chapter di Supabase tanpa menambah baris tabel.
      if (savedToTurso) {
        try {
          await supabase.from('chapters').update({ status: 'published', retry_count: 0 }).eq('id', ch.id);
        } catch {}
      } else {
        // Fallback hanya jika Turso sama sekali tidak aktif
        const rows = capturedForChapter.map((imgUrl, idx) => ({
          chapter_id: ch.id,
          page_number: idx + 1,
          image_url: imgUrl,
        }));

        const { error: insErr } = await supabase
          .from('chapter_pages')
          .upsert(rows, { onConflict: 'chapter_id,page_number' });

        if (insErr) {
          console.warn(`      ⚠️ Gagal simpan ke Supabase untuk Ch ${ch.chapter_number}:`, insErr.message);
        } else {
          await supabase.from('chapters').update({ status: 'published', retry_count: 0 }).eq('id', ch.id);
          restoredChaptersCount++;
        }
      }
    } else {
      console.warn(`      ⚠️ Tidak ada gambar ditemukan untuk Ch ${ch.chapter_number}.`);
    }

    // Jeda kecil antar chapter agar stabil & tidak membebani server
    await new Promise((r) => setTimeout(r, 150));
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
  const maxRuntimeMinutes = parseFloat(process.env.MAX_RUNTIME_MINUTES || '300'); // Default 5 jam (aman dari hard limit 6 jam GitHub)
  const isReset = process.env.RESET_CHECKPOINTS === 'true';
  const sessionRunId = process.env.GITHUB_RUN_ID || `local_${Date.now()}`;
  const taskKey = `repair_images_shard_${shardIndex}_of_${totalShards}`;
  const startTime = Date.now();

  await ensureCheckpointTables(turso);

  if (isReset && turso) {
    await saveCheckpoint(turso, {
      taskKey,
      cursor: 0,
      totalItems: 0,
      processedCount: 0,
      repairedCount: 0,
      status: 'pending',
      sessionRunId,
      continuationCount: 0,
    });
    console.log(`🔄 Checkpoint untuk "${taskKey}" di-reset ke awal.`);
  }

  const existingCheckpoint = (!targetSlug && !isReset && turso) ? await getCheckpoint(turso, taskKey) : null;

  if (existingCheckpoint && existingCheckpoint.status === 'completed' && !targetSlug && !isReset) {
    console.log(`\n======================================================`);
    console.log(`🎉 [Shard ${shardIndex + 1}/${totalShards}] SUDAH SELESAI PADA SESI SEBELUMNYA!`);
    console.log(`   Total komik: ${existingCheckpoint.totalItems}, selesai pada: ${existingCheckpoint.completedAt || existingCheckpoint.lastRunAt}`);
    console.log(`   Melewati runner ini karena tidak ada lagi komik yang perlu diperbaiki.`);
    console.log(`======================================================\n`);
    return;
  }

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
      let comic = null;
      if (turso) {
        try {
          const tRes = await turso.execute({
            sql: `SELECT id, title, slug FROM comics WHERE slug = ? LIMIT 1;`,
            args: [targetSlug],
          });
          if (tRes.rows.length > 0) {
            comic = {
              id: String(tRes.rows[0].id),
              title: String(tRes.rows[0].title),
              slug: String(tRes.rows[0].slug),
            };
          }
        } catch {}
      }

      if (!comic) {
        try {
          const { data: sComic } = await supabase
            .from('comics')
            .select('id, title, slug')
            .eq('slug', targetSlug)
            .maybeSingle();
          comic = sComic;
        } catch {}
      }

      if (!comic) {
        console.error(`❌ Komik "${targetSlug}" tidak ditemukan di database.`);
        process.exit(1);
      }

      const restored = await scrapeComicChaptersPages(browser, comic, maxChaptersPerComic, true);
      console.log(`\n✅ Repair single selesai: ${restored} chapter berhasil dipulihkan.`);

      if (turso) {
        await recordHistoryLog(turso, {
          taskKey: `repair_single_${targetSlug}`,
          sessionRunId,
          shardIndex: 0,
          totalShards: 1,
          cursorStart: 0,
          cursorEnd: 1,
          itemsProcessed: 1,
          itemsRepaired: restored > 0 ? 1 : 0,
          status: 'completed',
          durationSeconds: (Date.now() - startTime) / 1000,
        });
      }
    } else {
      console.log(`\n======================================================`);
      console.log(`🚀 REPAIR RUNNER [Shard ${shardIndex + 1}/${totalShards}]`);
      if (maxChaptersPerComic > 0) {
        console.log(`⚡ Batas chapter per komik: ${maxChaptersPerComic} chapter terbaru`);
      }
      console.log(`⏱️ Batas waktu runner: ${maxRuntimeMinutes} menit (auto-save checkpoint sebelum cutoff)`);
      console.log(`======================================================\n`);

      // Ambil SEMUA komik di database (tidak terpotong limit 1.000 PostgREST) dan prioritaskan komik populer
      console.log(`🔍 Membaca seluruh katalog komik dari database...`);
      let allComics = [];

      if (turso) {
        try {
          const tComicsRes = await turso.execute(`
            SELECT id, title, slug, rating, latest_chapter_number
            FROM comics
            ORDER BY rating DESC, latest_chapter_number DESC;
          `);
          if (tComicsRes.rows.length > 0) {
            allComics = tComicsRes.rows.map(r => ({
              id: String(r.id),
              title: String(r.title),
              slug: String(r.slug),
              rating: Number(r.rating || 0),
              total_chs: Number(r.latest_chapter_number || 0),
            }));
            console.log(`✅ Berhasil membaca ${allComics.length} komik dari Turso (diurutkan berdasarkan popularitas/rating).`);
          }
        } catch (tErr) {
          console.warn(`⚠️ Gagal query Turso untuk allComics:`, tErr.message);
        }
      }

      if (allComics.length === 0) {
        // Fallback Supabase paginated query (tidak terpotong limit 1000)
        let from = 0;
        const PAGE_SIZE = 1000;
        while (true) {
          const { data: batch, error: bErr } = await supabase
            .from('comics')
            .select('id, title, slug, rating')
            .order('rating', { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

          if (bErr || !batch || batch.length === 0) break;
          allComics.push(...batch);
          if (batch.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }
        console.log(`✅ Berhasil membaca ${allComics.length} komik dari Supabase dengan paginasi penuh.`);
      }

      if (allComics.length === 0) {
        console.log('Tidak ada komik ditemukan di database.');
        return;
      }

      // Bagi beban komik secara merata ke shard ini
      const myComics = totalShards > 1
        ? allComics.filter((_, idx) => idx % totalShards === shardIndex)
        : allComics;

      console.log(`📊 Shard ini menangani ${myComics.length} komik (dari total ${allComics.length} komik di database).\n`);

      let startIndex = 0;
      let cumulativeRepaired = 0;
      let cumulativeProcessed = 0;
      let continuationCount = 0;

      if (existingCheckpoint && existingCheckpoint.cursor > 0 && !isReset) {
        startIndex = Math.min(existingCheckpoint.cursor, myComics.length);
        cumulativeRepaired = existingCheckpoint.repairedCount || 0;
        cumulativeProcessed = existingCheckpoint.processedCount || 0;
        continuationCount = (existingCheckpoint.continuationCount || 0) + 1;
        console.log(`📌 Melanjutkan dari checkpoint: Komik ke-${startIndex + 1}/${myComics.length} (Sesi ke-${continuationCount + 1})`);
        console.log(`   Progres sebelumnya: ${cumulativeProcessed} diperiksa, ${cumulativeRepaired} diperbaiki.`);
      } else if (turso) {
        await saveCheckpoint(turso, {
          taskKey,
          cursor: 0,
          totalItems: myComics.length,
          processedCount: 0,
          repairedCount: 0,
          status: 'in_progress',
          sessionRunId,
          continuationCount: 0,
        });
      }

      let sessionProcessed = 0;
      let sessionRepaired = 0;
      let timeBudgetReached = false;

      for (let i = startIndex; i < myComics.length; i++) {
        // Cek batas waktu runner (Time Budget)
        const elapsedMinutes = (Date.now() - startTime) / (60 * 1000);
        if (elapsedMinutes >= maxRuntimeMinutes) {
          console.log(`\n======================================================`);
          console.log(`⏰ BATAS WAKTU RUNNER TERCAPAI (${elapsedMinutes.toFixed(1)} menit >= ${maxRuntimeMinutes} menit)!`);
          console.log(`💾 Menyimpan checkpoint: index ${i}/${myComics.length} (komik: ${myComics[i].slug})...`);
          console.log(`🔄 Shard ini ditandai 'in_progress' untuk dilanjutkan pada sesi action berikutnya.`);
          console.log(`======================================================\n`);
          timeBudgetReached = true;

          if (turso) {
            await saveCheckpoint(turso, {
              taskKey,
              cursor: i,
              lastItemId: myComics[i].slug,
              totalItems: myComics.length,
              processedCount: cumulativeProcessed + sessionProcessed,
              repairedCount: cumulativeRepaired + sessionRepaired,
              status: 'in_progress',
              sessionRunId,
              continuationCount,
              metadata: {
                reason: 'time_budget_reached',
                elapsedMinutes: elapsedMinutes.toFixed(1),
              },
            });

            await recordHistoryLog(turso, {
              taskKey,
              sessionRunId,
              shardIndex,
              totalShards,
              cursorStart: startIndex,
              cursorEnd: i,
              itemsProcessed: sessionProcessed,
              itemsRepaired: sessionRepaired,
              status: 'time_budget_reached',
              durationSeconds: (Date.now() - startTime) / 1000,
            });
          }
          break;
        }

        if (limitCount > 0 && (cumulativeRepaired + sessionRepaired) >= limitCount) {
          console.log(`\nSudah mencapai batas limit repair (${limitCount} komik).`);
          break;
        }

        const comic = myComics[i];
        console.log(`\n[${i + 1}/${myComics.length}] Memeriksa: "${comic.title}" (${comic.slug})`);

        const restored = await scrapeComicChaptersPages(browser, comic, maxChaptersPerComic);
        if (restored > 0) {
          sessionRepaired++;
          await supabase
            .from('comics')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', comic.id);
        }
        sessionProcessed++;

        // Simpan checkpoint secara berkala ke Turso
        if (turso) {
          const isDone = (i + 1 >= myComics.length);
          await saveCheckpoint(turso, {
            taskKey,
            cursor: i + 1,
            lastItemId: comic.slug,
            totalItems: myComics.length,
            processedCount: cumulativeProcessed + sessionProcessed,
            repairedCount: cumulativeRepaired + sessionRepaired,
            status: isDone ? 'completed' : 'in_progress',
            sessionRunId,
            continuationCount,
          });
        }
      }

      const totalProcessedNow = cumulativeProcessed + sessionProcessed;
      const totalRepairedNow = cumulativeRepaired + sessionRepaired;

      if (!timeBudgetReached && (startIndex + sessionProcessed) >= myComics.length) {
        console.log(`\n======================================================`);
        console.log(`🎉 [Shard ${shardIndex + 1}/${totalShards}] SELESAI 100%!`);
        console.log(`   Komik di shard ini selesai diperiksa : ${totalProcessedNow}/${myComics.length}`);
        console.log(`   Komik diperbaiki                    : ${totalRepairedNow}`);
        console.log(`======================================================\n`);

        if (turso) {
          await saveCheckpoint(turso, {
            taskKey,
            cursor: myComics.length,
            lastItemId: myComics[myComics.length - 1]?.slug || null,
            totalItems: myComics.length,
            processedCount: totalProcessedNow,
            repairedCount: totalRepairedNow,
            status: 'completed',
            sessionRunId,
            continuationCount,
          });

          await recordHistoryLog(turso, {
            taskKey,
            sessionRunId,
            shardIndex,
            totalShards,
            cursorStart: startIndex,
            cursorEnd: myComics.length,
            itemsProcessed: sessionProcessed,
            itemsRepaired: sessionRepaired,
            status: 'completed',
            durationSeconds: (Date.now() - startTime) / 1000,
          });
        }
      } else {
        console.log(`\n======================================================`);
        console.log(`📊 [Shard ${shardIndex + 1}/${totalShards}] Sesi Selesai (Progres: ${startIndex + sessionProcessed}/${myComics.length})`);
        console.log(`   Komik diperiksa di sesi ini  : ${sessionProcessed} (Total: ${totalProcessedNow})`);
        console.log(`   Komik diperbaiki di sesi ini : ${sessionRepaired} (Total: ${totalRepairedNow})`);
        console.log(`======================================================\n`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
