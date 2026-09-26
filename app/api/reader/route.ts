import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTursoClient } from '@/lib/turso';
import { getTursoChapterPages, saveTursoChapterPages } from '@/lib/queries/turso-comics';
import { checkDailyRateLimit } from '@/lib/rate-limiter';
import { scrapeLiveChapterPages } from '@/lib/scraper/live-chapter-scraper';
import { MOCK_COMICS, MOCK_CHAPTERS } from '@/lib/mock-data';

// GET /api/reader?slug=xxx&chapter=1
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const chapterNumber = Number(searchParams.get('chapter'));

  if (!slug || isNaN(chapterNumber)) {
    return NextResponse.json(
      { success: false, error: 'Parameter slug dan chapter wajib diisi' },
      { status: 400 }
    );
  }

  // 1. Cek Batas Kuota Harian (Maksimal 10.000 request/hari per user atau IP)
  const rateLimit = await checkDailyRateLimit(req);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        quotaExceeded: true,
        error: 'Batas 10.000 request harian Anda telah habis. Akses membaca Anda akan dibuka kembali besok pada pukul 00:00 WIB.',
        limit: rateLimit.limit,
        count: rateLimit.count,
        remaining: 0,
        resetAt: rateLimit.resetAt,
        resetSeconds: rateLimit.resetSeconds,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimit.resetAt,
          'Retry-After': String(rateLimit.resetSeconds),
        },
      }
    );
  }

  const turso = getTursoClient();
  const supabase = createAdminClient();
  let comic: any = null;
  let currentChapter: any = null;
  let allChapters: any[] = [];
  let adaptation: any = null;

  // 2. Prioritaskan query ke Turso (5-15ms, hemat kuota Supabase)
  if (turso) {
    try {
      const comicRes = await turso.execute({
        sql: `SELECT id, title, slug, type, author, cover_url, synopsis, rating, status FROM comics WHERE slug = ? LIMIT 1;`,
        args: [slug],
      });

      if (comicRes.rows.length > 0) {
        comic = {
          id: String(comicRes.rows[0].id),
          title: String(comicRes.rows[0].title),
          slug: String(comicRes.rows[0].slug),
          type: String(comicRes.rows[0].type || 'manhwa'),
          author: String(comicRes.rows[0].author || 'Unknown'),
          cover_url: String(comicRes.rows[0].cover_url || ''),
          synopsis: String(comicRes.rows[0].synopsis || ''),
          rating: Number(comicRes.rows[0].rating || 4.5),
          status: String(comicRes.rows[0].status || 'ongoing'),
        };

        const [currChRes, allChRes] = await Promise.all([
          turso.execute({
            sql: `SELECT id, chapter_number, title, released_at, status FROM chapters WHERE comic_id = ? AND chapter_number = ? LIMIT 1;`,
            args: [comic.id, chapterNumber],
          }),
          turso.execute({
            sql: `SELECT id, chapter_number, title, released_at, status FROM chapters WHERE comic_id = ? ORDER BY chapter_number ASC;`,
            args: [comic.id],
          }),
        ]);

        if (currChRes.rows.length > 0) {
          const r = currChRes.rows[0];
          currentChapter = {
            id: String(r.id),
            comic_id: comic.id,
            chapter_number: Number(r.chapter_number),
            title: String(r.title || `Chapter ${r.chapter_number}`),
            released_at: String(r.released_at),
            status: String(r.status || 'published'),
          };
        }

        allChapters = allChRes.rows.map((r: any) => ({
          id: String(r.id),
          comic_id: comic.id,
          chapter_number: Number(r.chapter_number),
          title: String(r.title || `Chapter ${r.chapter_number}`),
          released_at: String(r.released_at),
          status: String(r.status || 'published'),
        }));
      }
    } catch (err: any) {
      console.warn('[Reader API] Turso query error:', err?.message);
    }
  }

  // 3. Fallback ke Supabase jika Turso belum memiliki data komik tersebut
  if (!comic && supabase) {
    try {
      const { data: comicData, error: comicErr } = await supabase
        .from('comics')
        .select('id, title, slug, type, author, cover_url, synopsis, rating, status')
        .eq('slug', slug)
        .maybeSingle();

      if (comicData && !comicErr) {
        comic = comicData;

        const [chapterRes, allChaptersRes, adaptationRes] = await Promise.all([
          supabase
            .from('chapters')
            .select('id, chapter_number, title, released_at, status')
            .eq('comic_id', comic.id)
            .eq('chapter_number', chapterNumber)
            .maybeSingle(),
          supabase
            .from('chapters')
            .select('id, chapter_number, title, released_at, status')
            .eq('comic_id', comic.id)
            .order('chapter_number', { ascending: true }),
          supabase
            .from('comic_adaptations')
            .select('*')
            .eq('comic_id', comic.id)
            .lte('start_chapter', chapterNumber)
            .gte('end_chapter', chapterNumber)
            .order('start_chapter', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        currentChapter = chapterRes.data;
        allChapters = allChaptersRes.data || [];
        adaptation = adaptationRes?.data
          ? {
              ...adaptationRes.data,
              start_chapter: Number(adaptationRes.data.start_chapter),
              end_chapter: Number(adaptationRes.data.end_chapter),
            }
          : null;
      }
    } catch (err: any) {
      console.warn('[Reader API] Supabase query error:', err?.message);
    }
  }

  // Jika komik belum ada di database, coba gunakan data mock jika slug cocok
  if (!comic) {
    comic = MOCK_COMICS.find((c) => c.slug === slug) || null;
    allChapters = (MOCK_CHAPTERS[slug] || []).sort((a, b) => a.chapter_number - b.chapter_number);
    currentChapter = allChapters.find((ch) => ch.chapter_number === chapterNumber) || null;
  }

  // Jika masih belum ada data komik atau chapter, bentuk representasi minimal
  if (!currentChapter) {
    currentChapter = {
      id: `${slug}-ch${chapterNumber}`,
      comic_id: comic?.id || slug,
      chapter_number: chapterNumber,
      title: `Chapter ${chapterNumber}`,
      released_at: new Date().toISOString(),
      status: 'published',
    };
  }

  // 4. Ambil gambar asli (coba Turso dulu, lalu Supabase)
  let pages: any[] = [];
  if (turso && currentChapter?.id && !String(currentChapter.id).startsWith('mock-')) {
    try {
      pages = await getTursoChapterPages(currentChapter.id);
    } catch (err: any) {
      console.warn('[Reader API] Error fetching pages from Turso:', err?.message);
    }
  }

  if (pages.length === 0 && supabase && currentChapter?.id && !String(currentChapter.id).startsWith('mock-')) {
    try {
      const { data: dbPages, error: dbPagesErr } = await supabase
        .from('chapter_pages')
        .select('id, chapter_id, page_number, image_url, width, height')
        .eq('chapter_id', currentChapter.id)
        .order('page_number', { ascending: true });

      if (dbPages && dbPages.length > 0 && !dbPagesErr) {
        pages = dbPages;
      }
    } catch (err: any) {
      console.warn('[Reader API] Error fetching chapter_pages from DB:', err?.message);
    }
  }

  // 5. On-Demand Live Scraping: Jika di database belum ada gambar, ambil dari Westmanga
  if (pages.length === 0) {
    try {
      const livePages = await scrapeLiveChapterPages(slug, chapterNumber, currentChapter.id);
      if (livePages && livePages.length > 0) {
        pages = livePages;

        // Auto-cache ke Turso (prioritas utama)
        if (turso && currentChapter?.id && !String(currentChapter.id).startsWith('mock-')) {
          try {
            await saveTursoChapterPages(currentChapter.id, livePages);
            console.log(`[Reader API] Auto-cached ${livePages.length} pages to Turso for chapter ${currentChapter.id}`);
          } catch (tursoSaveErr: any) {
            console.warn('[Reader API] Failed to auto-cache pages to Turso:', tursoSaveErr?.message);
          }
        }

        // Auto-cache juga ke Supabase jika tersedia
        if (supabase && currentChapter?.id && !String(currentChapter.id).startsWith('mock-')) {
          try {
            const rowsToInsert = livePages.map((p, idx) => ({
              chapter_id: currentChapter.id,
              page_number: p.page_number || idx + 1,
              image_url: p.image_url,
            }));
            await supabase.from('chapter_pages').upsert(rowsToInsert, { onConflict: 'chapter_id,page_number' });
          } catch (cacheErr: any) {
            console.warn('[Reader API] Failed to auto-cache pages to Supabase:', cacheErr?.message);
          }
        }
      }
    } catch (scrapeErr: any) {
      console.warn('[Reader API] Live scraping error:', scrapeErr?.message);
    }
  }

  // CATATAN: Fallback MOCK_PAGES (gambar dummy Unsplash) telah DIHAPUS.
  // Jika gambar belum ada, pages akan tetap [] agar UI menampilkan state kosong yang bersih dan valid.

  // Berikan respons dengan header rate limiting
  return NextResponse.json(
    {
      success: true,
      comic,
      currentChapter,
      pages,
      allChapters,
      adaptation,
      rateLimit: {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        count: rateLimit.count,
        resetAt: rateLimit.resetAt,
      },
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
        'X-RateLimit-Reset': rateLimit.resetAt,
      },
    }
  );
}
