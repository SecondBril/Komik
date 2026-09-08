import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/browse?type=all&status=all&q=keyword&genres=action,romance&sort=latest&page=1&limit=30
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
    let matchingComicIds: string[] | null = null;

    // Multi-genre filtering (AND logic: comic must match ALL specified genres)
    if (genres) {
      const tokens = genres.split(',').map((g) => g.trim().toLowerCase()).filter(Boolean);
      if (tokens.length > 0) {
        // 1. Fetch all genres to resolve tokens (slugs, IDs, or names)
        const { data: allGenres } = await supabase
          .from('genres')
          .select('id, name, slug');

        const targetGenreIds: number[] = [];
        for (const token of tokens) {
          const matched = allGenres?.find(
            (g) =>
              String(g.id) === token ||
              g.slug?.toLowerCase() === token ||
              g.name?.toLowerCase() === token
          );
          if (matched && !targetGenreIds.includes(matched.id)) {
            targetGenreIds.push(matched.id);
          }
        }

        // If any requested genre doesn't exist in the system, no comic can match all requested genres
        if (targetGenreIds.length < tokens.length) {
          return NextResponse.json({
            success: true,
            data: [],
            total: 0,
            page,
            limit,
          });
        }

        // 2. Query junction table comic_genres
        const { data: cgRows } = await supabase
          .from('comic_genres')
          .select('comic_id, genre_id')
          .in('genre_id', targetGenreIds);

        // 3. Count matches per comic_id: must match ALL target genres (AND filter)
        const comicGenreCount: Record<string, number> = {};
        (cgRows || []).forEach((row: any) => {
          comicGenreCount[row.comic_id] = (comicGenreCount[row.comic_id] || 0) + 1;
        });

        matchingComicIds = Object.keys(comicGenreCount).filter(
          (cid) => comicGenreCount[cid] >= targetGenreIds.length
        );

        // If no comics have ALL requested genres, return empty immediately
        if (matchingComicIds.length === 0) {
          return NextResponse.json({
            success: true,
            data: [],
            total: 0,
            page,
            limit,
          });
        }
      }
    }

    let query = supabase
      .from('comics')
      .select(`
        id, title, slug, type, status, cover_url, rating, author,
        synopsis, updated_at, created_at,
        genres:comic_genres(genres(id, name, slug)),
        chapters:chapters(id, chapter_number, title, released_at)
      `, { count: 'exact' });

    if (matchingComicIds !== null) {
      query = query.in('id', matchingComicIds);
    }
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
        (a: any, b: any) => (b.chapter_number ?? 0) - (a.chapter_number ?? 0)
      );
      return {
        ...item,
        genres: item.genres?.map((g: any) => g.genres).filter(Boolean) || [],
        latest_chapter: sortedChapters?.[0] || null,
        chapters: undefined,
      };
    });

    // Final safety check: ensure every comic has ALL requested genres
    let filteredComics = comics;
    if (genres) {
      const tokens = genres.split(',').map((g) => g.trim().toLowerCase()).filter(Boolean);
      if (tokens.length > 0) {
        filteredComics = comics.filter((c: any) =>
          tokens.every((tok) =>
            c.genres?.some(
              (g: any) =>
                String(g.id) === tok ||
                g.slug?.toLowerCase() === tok ||
                g.name?.toLowerCase() === tok
            )
          )
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
