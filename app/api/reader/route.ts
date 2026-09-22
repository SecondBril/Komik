import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkDailyRateLimit } from '@/lib/rate-limiter';
import { scrapeLiveChapterPages } from '@/lib/scraper/live-chapter-scraper';
import { MOCK_COMICS, MOCK_CHAPTERS, MOCK_PAGES } from '@/lib/mock-data';

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

  const supabase = createAdminClient();
  let comic: any = null;
  let currentChapter: any = null;
  let allChapters: any[] = [];
  let adaptation: any = null;

  if (supabase) {
    try {
      // 2. Ambil metadata komik dari database Postgres
      const { data: comicData, error: comicErr } = await supabase
        .from('comics')
        .select('id, title, slug, type, author, cover_url, synopsis, rating, status')
        .eq('slug', slug)
        .maybeSingle();

      if (comicData && !comicErr) {
        comic = comicData;

        // 3. Ambil daftar chapter dan informasi adaptasi
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

  // 4. ON-DEMAND LIVE SCRAPING GAMBAR DARI WESTMANGA (TIDAK DISIMPAN DI DATABASE)
  let pages = await scrapeLiveChapterPages(slug, chapterNumber, currentChapter.id);

  // Fallback 1: Jika live scraping tidak mengembalikan hasil, cek apakah ada di tabel legacy chapter_pages
  if (pages.length === 0 && supabase && currentChapter?.id) {
    try {
      const { data: legacyPages } = await supabase
        .from('chapter_pages')
        .select('id, chapter_id, page_number, image_url, width, height')
        .eq('chapter_id', currentChapter.id)
        .order('page_number', { ascending: true });

      if (legacyPages && legacyPages.length > 0) {
        pages = legacyPages as any;
      }
    } catch {
      // Abaikan fallback error
    }
  }

  // Fallback 2: Mock data jika di environment lokal/test
  if (pages.length === 0) {
    const mockPages = MOCK_PAGES[currentChapter.id] || MOCK_PAGES['ch-101'] || [];
    pages = mockPages;
  }

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
