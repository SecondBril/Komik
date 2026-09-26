import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTursoClient } from '@/lib/turso';
import { getTursoGenresWithCounts } from '@/lib/queries/turso-comics';

export const dynamic = 'force-dynamic';

let cachedGenresPayload: any = null;
let lastCachedAt = 0;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export async function GET() {
  const now = Date.now();
  if (cachedGenresPayload && now - lastCachedAt < CACHE_DURATION_MS) {
    return NextResponse.json({ success: true, data: cachedGenresPayload });
  }

  // 1. Try Turso first (ultra-fast GROUP BY, 0 Supabase usage)
  if (getTursoClient()) {
    try {
      const tursoData = await getTursoGenresWithCounts();
      if (tursoData && tursoData.length > 0) {
        cachedGenresPayload = tursoData;
        lastCachedAt = now;
        return NextResponse.json({ success: true, data: tursoData });
      }
    } catch (err) {
      console.warn('[API Genres] Turso query failed, falling back:', err);
    }
  }

  const supabase = createAdminClient();

  if (!supabase) {
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }

  try {
    const { data: genresData, error: genresError } = await supabase
      .from('genres')
      .select('id, name, slug')
      .order('name', { ascending: true });

    if (genresError || !genresData || genresData.length === 0) {
      return NextResponse.json({ success: false, error: genresError?.message || 'No genres found' }, { status: 500 });
    }

    // Fetch comic counts from comic_genres fast without expensive table join
    const { data: comicGenres, error: cgError } = await supabase
      .from('comic_genres')
      .select('genre_id');

    const counts: Record<number, number> = {};
    if (!cgError && comicGenres) {
      comicGenres.forEach((cg: any) => {
        counts[cg.genre_id] = (counts[cg.genre_id] || 0) + 1;
      });
    }

    const dataWithCounts = genresData.map((g: any) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      count: counts[g.id] || 0,
    }));

    cachedGenresPayload = dataWithCounts;
    lastCachedAt = now;

    return NextResponse.json({ success: true, data: dataWithCounts });
  } catch (err: any) {
    console.error('[API Genres] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
