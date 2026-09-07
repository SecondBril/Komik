import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MOCK_COMICS, MOCK_CHAPTERS, MOCK_PAGES } from '@/lib/mock-data';

// GET /api/reader?slug=xxx&chapter=1
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const chapterNumber = Number(searchParams.get('chapter'));

  if (!slug || isNaN(chapterNumber)) {
    return NextResponse.json({ success: false, error: 'Slug and chapter are required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (supabase) {
    try {
      // 1. Fetch comic metadata
      const { data: comic, error: comicErr } = await supabase
        .from('comics')
        .select('id, title, slug, type, author, cover_url')
        .eq('slug', slug)
        .single();

      if (comic && !comicErr) {
        // 2. Fetch current chapter with its pages AND all chapters in parallel
        const [chapterRes, allChaptersRes] = await Promise.all([
          supabase
            .from('chapters')
            .select(`
              id, chapter_number, title, released_at, status,
              pages:chapter_pages(id, page_number, image_url, width, height)
            `)
            .eq('comic_id', comic.id)
            .eq('chapter_number', chapterNumber)
            .single(),
          supabase
            .from('chapters')
            .select('id, chapter_number, title, released_at, status')
            .eq('comic_id', comic.id)
            .eq('status', 'published')
            .order('chapter_number', { ascending: true }),
        ]);

        if (chapterRes.data) {
          const currentChapter = chapterRes.data;
          const sortedPages = (currentChapter.pages || []).sort(
            (a: any, b: any) => a.page_number - b.page_number
          );

          const allChapters = allChaptersRes.data || [];

          return NextResponse.json(
            {
              success: true,
              comic,
              currentChapter: {
                id: currentChapter.id,
                comic_id: comic.id,
                chapter_number: currentChapter.chapter_number,
                title: currentChapter.title,
                released_at: currentChapter.released_at,
                status: currentChapter.status,
              },
              pages: sortedPages,
              allChapters,
            },
            {
              headers: {
                // Cache for 2 minutes on edge CDN, revalidate in background
                'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
              },
            }
          );
        }
      }
    } catch (err: any) {
      console.warn('[Reader API] Supabase query failed, falling back to mock:', err?.message);
    }
  }

  // Fallback to MOCK data if not in DB
  const mockComic = MOCK_COMICS.find((c) => c.slug === slug);
  const mockAllChapters = (MOCK_CHAPTERS[slug] || []).sort((a, b) => a.chapter_number - b.chapter_number);
  const mockCurrentChapter = mockAllChapters.find((ch) => ch.chapter_number === chapterNumber) || null;
  const mockPages = mockCurrentChapter ? (MOCK_PAGES[mockCurrentChapter.id] || MOCK_PAGES['ch-101'] || []) : [];

  if (!mockComic || !mockCurrentChapter) {
    return NextResponse.json({ success: false, error: 'Chapter not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    comic: mockComic,
    currentChapter: mockCurrentChapter,
    pages: mockPages,
    allChapters: mockAllChapters,
  });
}
