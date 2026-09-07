import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/browse?type=all&status=all&q=keyword&genres=1,2&sort=latest&page=1&limit=30
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'all';
  const status = searchParams.get('status') || 'all';
  const q = searchParams.get('q') || '';
  const genres = searchParams.get('genres') || '';
  const sort = searchParams.get('sort') || 'latest';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(60, parseInt(searchParams.get('limit') || '30', 10));
  const offset = (page - 1) * limit;

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
  }

  try {
    let query = supabase
      .from('comics')
      .select(`
        id, title, slug, type, status, cover_url, rating, author,
        synopsis, updated_at, created_at,
        genres:comic_genres(genres(id, name)),
        chapters:chapters(id, chapter_number, title, released_at)
      `, { count: 'exact' });

    if (type !== 'all') query = query.eq('type', type);
    if (status !== 'all') query = query.eq('status', status);
    if (q) query = query.ilike('title', `%${q}%`);

    // Sorting
    if (sort === 'popular' || sort === 'rating') {
      query = query.order('rating', { ascending: false });
    } else if (sort === 'title') {
      query = query.order('title', { ascending: true });
    } else {
      query = query.order('updated_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const comics = (data || []).map((item: any) => {
      const sortedChapters = item.chapters?.sort(
        (a: any, b: any) => new Date(b.released_at).getTime() - new Date(a.released_at).getTime()
      );
      return {
        ...item,
        genres: item.genres?.map((g: any) => g.genres).filter(Boolean) || [],
        latest_chapter: sortedChapters?.[0] || null,
        chapters: undefined, // remove raw chapters array
      };
    });

    // Genre filter (done post-query for simplicity; move to DB if needed)
    let filteredComics = comics;
    if (genres) {
      const genreIds = genres.split(',').map(Number).filter(Boolean);
      if (genreIds.length > 0) {
        filteredComics = comics.filter((c: any) =>
          genreIds.every((gId) => c.genres?.some((g: any) => g.id === gId))
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: filteredComics,
      total: count ?? filteredComics.length,
      page,
      limit,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
