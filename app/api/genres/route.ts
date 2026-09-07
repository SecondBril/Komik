import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MOCK_COMICS, MOCK_GENRES } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createAdminClient();

  // Fallback calculation from mock data
  const fallbackCounts: Record<number, number> = {};
  MOCK_COMICS.forEach((c) => {
    c.genres?.forEach((g) => {
      fallbackCounts[g.id] = (fallbackCounts[g.id] || 0) + 1;
    });
  });

  const fallbackData = MOCK_GENRES.map((g) => ({
    ...g,
    count: fallbackCounts[g.id] || 0,
  }));

  if (!supabase) {
    return NextResponse.json({ success: true, data: fallbackData });
  }

  try {
    const { data: genresData, error: genresError } = await supabase
      .from('genres')
      .select('id, name, slug')
      .order('name', { ascending: true });

    if (genresError || !genresData || genresData.length === 0) {
      return NextResponse.json({ success: true, data: fallbackData });
    }

    // Fetch comic counts from comic_genres joining existing comics
    const { data: comicGenres, error: cgError } = await supabase
      .from('comic_genres')
      .select('genre_id, comics(id)');

    const counts: Record<number, number> = {};
    if (!cgError && comicGenres) {
      comicGenres.forEach((cg: any) => {
        // Only count if comic still exists in the comics table
        if (cg.comics) {
          counts[cg.genre_id] = (counts[cg.genre_id] || 0) + 1;
        }
      });
    }

    const dataWithCounts = genresData.map((g: any) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      count: counts[g.id] || 0,
    }));

    return NextResponse.json({ success: true, data: dataWithCounts });
  } catch (err: any) {
    return NextResponse.json({ success: true, data: fallbackData });
  }
}
