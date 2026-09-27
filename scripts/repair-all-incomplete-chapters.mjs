import { createClient } from '@supabase/supabase-js';
import { createClient as createTursoClient } from '@libsql/client';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { execSync } from 'child_process';

// 1. Load .env.local
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
  console.error('❌ Supabase credentials missing!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Turso client
let turso = null;
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;
if (tursoUrl && tursoToken) {
  try {
    turso = createTursoClient({ url: tursoUrl, authToken: tursoToken });
    console.log('✅ Turso Database terhubung!');
  } catch (tErr) {
    console.warn('⚠️ Gagal inisialisasi Turso:', tErr.message);
  }
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

/**
 * Mengambil daftar chapter resmi dari Westmanga via API Mantweh (prioritas utama) atau fallback DOM
 */
async function fetchComicChapters(browser, slug) {
  const page = await browser.newPage();
  await setupPageInterception(page);

  try {
    const cleanSlug = slug.replace(/\/+$/, '').toLowerCase();
    const url = `https://v1.westmanga.my/comic/${cleanSlug}/`;

    let officialChapters = null;

    const apiPromise = new Promise((resolve) => {
      const handler = async (res) => {
        const u = res.url();
        if (u.includes(`data.mantweh.online/api/comic/${cleanSlug}`) && res.status() === 200) {
          try {
            const json = await res.json();
            if (json.data?.chapters && Array.isArray(json.data.chapters)) {
              officialChapters = json.data.chapters;
              page.off('response', handler);
              resolve(officialChapters);
            }
          } catch {}
        }
      };
      page.on('response', handler);
      setTimeout(() => {
        page.off('response', handler);
        resolve(null);
      }, 15000);
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await apiPromise;

    if (officialChapters && officialChapters.length > 0) {
      const seen = new Set();
      const result = [];
      for (const ch of officialChapters) {
        const num = parseFloat(String(ch.number).replace('-', '.'));
        if (!isNaN(num) && num > 0 && !seen.has(num)) {
          seen.add(num);
          result.push({
            chapter_number: num,
            title: ch.title || `Chapter ${ch.number}`,
            slug: ch.slug,
          });
        }
      }
      return result.sort((a, b) => b.chapter_number - a.chapter_number);
    }

    // Fallback: DOM parsing
    try {
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('a')).some((a) => (a.href || '').includes('/view/')),
        { timeout: 8000 }
      );
    } catch {}

    const chapters = await page.evaluate((targetSlug) => {
      const allLinks = Array.from(document.querySelectorAll('a[href*="/view/"]'));
      const seen = new Set();
      const result = [];

      allLinks.forEach((a) => {
        const href = a.href || '';
        const text = a.textContent?.trim() || '';

        const match =
          text.match(/(?:chapter|ch\.?)\s*(\d+(?:[\.-]\d+)?)/i) ||
          href.match(/chapter-(\d+(?:[\.-]\d+)?)/i);
        if (match) {
          const num = parseFloat(match[1].replace('-', '.'));
          if (!seen.has(num) && num > 0) {
            seen.add(num);
            result.push({
              chapter_number: num,
              title: text.replace(/\s+/g, ' ').trim() || `Chapter ${num}`,
            });
          }
        }
      });

      return result.sort((a, b) => b.chapter_number - a.chapter_number);
    }, cleanSlug);

    return chapters;
  } catch (err) {
    console.error(`     [Repair] Gagal fetch detail chapters untuk ${slug}:`, err.message);
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  console.log('🔍 Membaca daftar komik dari database untuk mendeteksi chapter tidak lengkap...');

  let comics = [];
  if (turso) {
    try {
      const tComicsRes = await turso.execute(`
        SELECT id, slug, title, rating FROM comics ORDER BY rating DESC, created_at DESC;
      `);
      if (tComicsRes.rows.length > 0) {
        comics = tComicsRes.rows.map(r => ({
          id: String(r.id),
          slug: String(r.slug),
          title: String(r.title),
        }));
        console.log(`✅ Berhasil membaca ${comics.length} komik dari Turso.`);
      }
    } catch (tErr) {
      console.warn('⚠️ Gagal query Turso untuk comics:', tErr.message);
    }
  }

  if (comics.length === 0) {
    // Fallback Supabase paginated query
    let from = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      const { data: batch, error: bErr } = await supabase
        .from('comics')
        .select('id, slug, title')
        .order('rating', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (bErr || !batch || batch.length === 0) break;
      comics.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    console.log(`✅ Berhasil membaca ${comics.length} komik dari Supabase dengan paginasi penuh.`);
  }

  if (comics.length === 0) {
    console.error('❌ Tidak ada komik yang ditemukan di database.');
    process.exit(1);
  }

  console.log(`📊 Total komik di database: ${comics.length}`);

  const targetSlugArg = process.argv[2];

  let candidates = [];

  if (targetSlugArg) {
    const { data: specificComic } = await supabase
      .from('comics')
      .select('id, slug, title')
      .eq('slug', targetSlugArg)
      .maybeSingle();

    if (!specificComic) {
      console.error(`❌ Komik dengan slug "${targetSlugArg}" tidak ditemukan di database.`);
      process.exit(1);
    }

    const { data: chs } = await supabase
      .from('chapters')
      .select('chapter_number')
      .eq('comic_id', specificComic.id)
      .order('chapter_number', { ascending: false });

    candidates.push({
      comic: specificComic,
      count: chs ? chs.length : 0,
      maxCh: chs && chs.length > 0 ? chs[0].chapter_number : 0,
    });
  } else {
    const BATCH_SIZE = 50;
    for (let i = 0; i < comics.length; i += BATCH_SIZE) {
      const slice = comics.slice(i, i + BATCH_SIZE);
      await Promise.all(
        slice.map(async (comic) => {
          const { data: chs, error: chErr } = await supabase
            .from('chapters')
            .select('chapter_number')
            .eq('comic_id', comic.id)
            .order('chapter_number', { ascending: false });

          if (chErr) return;

          const count = chs ? chs.length : 0;
          const maxCh = count > 0 ? chs[0].chapter_number : 0;

          // Kriteria chapter tidak lengkap / terpotong / berisikan chapter hantu:
          // 1. Chapter count 0 atau <= 6
          // 2. Ada selisih signifikan antara chapter tertinggi terdaftar dengan jumlah chapter di DB
          if (count <= 6 || (maxCh > 15 && count <= 15) || (maxCh - count > 5)) {
            candidates.push({
              comic,
              count,
              maxCh,
            });
          }
        })
      );
    }
  }

  if (candidates.length === 0) {
    console.log('🎉 Semua komik memiliki daftar chapter yang lengkap! Tidak ada komik yang perlu diperbaiki.');
    return;
  }

  console.log(`⚠️ Ditemukan ${candidates.length} komik dengan chapter tidak lengkap / berpotensi chapter hantu:`);
  for (const c of candidates.slice(0, 20)) {
    console.log(`   - "${c.comic.title}" (${c.comic.slug}): ada ${c.count} chapter (max terdaftar: ${c.maxCh})`);
  }
  if (candidates.length > 20) {
    console.log(`   ... dan ${candidates.length - 20} komik lainnya.`);
  }

  const chromePath = getChromeExecutablePath();
  if (!chromePath) {
    console.error('❌ Chrome executable tidak ditemukan di sistem!');
    process.exit(1);
  }

  console.log('\n🚀 Menjalankan headless Chrome untuk memperbaiki komik...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  let totalRestoredChapters = 0;
  let fixedCount = 0;

  try {
    for (const c of candidates) {
      console.log(`\n⏳ Mengambil chapter resmi untuk: "${c.comic.title}" (${c.comic.slug})...`);
      const chapters = await fetchComicChapters(browser, c.comic.slug);

      if (chapters.length === 0) {
        console.log(`   ⚠️ Tidak ditemukan chapter di Westmanga untuk slug: ${c.comic.slug}`);
        continue;
      }

      console.log(`   ✓ Ditemukan ${chapters.length} chapter resmi di Westmanga.`);

      // 1. Hapus chapter fiktif/hantu di DB yang tidak ada di daftar resmi Westmanga
      const validNums = new Set(chapters.map((ch) => ch.chapter_number));
      const { data: dbChs } = await supabase
        .from('chapters')
        .select('id, chapter_number')
        .eq('comic_id', c.comic.id);

      if (dbChs && dbChs.length > 0) {
        const ghostChs = dbChs.filter((ch) => !validNums.has(ch.chapter_number));
        if (ghostChs.length > 0) {
          const ghostIds = ghostChs.map((ch) => ch.id);
          // Hapus dari Supabase
          await supabase.from('chapter_pages').delete().in('chapter_id', ghostIds);
          await supabase.from('chapters').delete().in('id', ghostIds);

          // Hapus dari Turso jika aktif
          if (turso) {
            try {
              const ph = ghostIds.map(() => '?').join(',');
              await turso.execute({ sql: `DELETE FROM chapter_pages WHERE chapter_id IN (${ph});`, args: ghostIds });
              await turso.execute({ sql: `DELETE FROM chapters WHERE id IN (${ph});`, args: ghostIds });
            } catch (tDelErr) {
              console.warn(`   ⚠️ Gagal menghapus ghost chapter di Turso:`, tDelErr.message);
            }
          }
          console.log(`   🗑️ Dihapus ${ghostIds.length} chapter fiktif/hantu (nomor: ${ghostChs.map((g) => g.chapter_number).join(', ')})`);
        }
      }

      // 2. Deduplikasi baris chapter sebelum upsert
      const seenNums = new Set();
      const rows = [];
      for (const ch of chapters) {
        if (!seenNums.has(ch.chapter_number)) {
          seenNums.add(ch.chapter_number);
          rows.push({
            comic_id: c.comic.id,
            chapter_number: ch.chapter_number,
            title: ch.title,
            status: 'published',
            released_at: new Date().toISOString(),
          });
        }
      }

      // 3. Upsert ke Supabase (hanya jika Turso tidak aktif, agar disk Supabase tidak penuh)
      if (!turso) {
        const CHUNK_SIZE = 100;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const batch = rows.slice(i, i + CHUNK_SIZE);
          try {
            await supabase
              .from('chapters')
              .upsert(batch, { onConflict: 'comic_id,chapter_number' });
          } catch {}
        }
      }

      // 4. Upsert ke Turso jika aktif
      if (turso) {
        try {
          const tStmts = rows.map((r) => ({
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
          console.warn(`   ⚠️ Gagal upsert chapter ke Turso:`, tErr.message);
        }
      }

      await supabase.from('comics').update({ updated_at: new Date().toISOString() }).eq('id', c.comic.id);

      // Verifikasi count baru
      const { count: newCount } = await supabase
        .from('chapters')
        .select('*', { count: 'exact', head: true })
        .eq('comic_id', c.comic.id);

      console.log(`   🎉 Berhasil diperbaiki! Total chapter sekarang: ${newCount} (sebelumnya ${c.count})`);
      totalRestoredChapters += (newCount || 0) - c.count;
      fixedCount++;
    }
  } finally {
    await browser.close();
  }

  console.log('\n======================================================');
  console.log(`✅ Selesai! ${fixedCount}/${candidates.length} komik berhasil diperbaiki.`);
  console.log(`📈 Total chapter baru yang ditambahkan: ${totalRestoredChapters}`);
  console.log('======================================================');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
