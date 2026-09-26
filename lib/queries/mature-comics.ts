import { MatureComic, MatureFilterState, MatureGenre } from '../types';
import { MOCK_MATURE_COMICS, MOCK_MATURE_GENRES } from '../mock-data-mature';
import { createServerSupabaseClient } from '../supabase/server';
import { createClient } from '../supabase/client';

function getSupabaseClient() {
  if (typeof window !== 'undefined') {
    return createClient();
  }
  return createServerSupabaseClient();
}

let cachedMatureGenresWithCounts: (MatureGenre & { count: number })[] | null = null;
let lastMatureGenresFetchedAt = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000;

export async function getMatureGenres(): Promise<MatureGenre[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('mature_genres').select('*').order('name');
      if (!error && data && data.length > 0) return data;
    } catch (err) {
      console.error('[getMatureGenres] Error:', err);
    }
  }
  return !supabase ? MOCK_MATURE_GENRES : [];
}

export async function getMatureGenresWithCounts(): Promise<(MatureGenre & { count: number })[]> {
  const now = Date.now();
  if (cachedMatureGenresWithCounts && now - lastMatureGenresFetchedAt < CACHE_DURATION_MS) {
    return cachedMatureGenresWithCounts;
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data: genresData, error: genresError } = await supabase
        .from('mature_genres')
        .select('id, name, slug, description')
        .order('name');

      if (!genresError && genresData && genresData.length > 0) {
        const { data: comicGenres, error: cgError } = await supabase
          .from('mature_comic_genres')
          .select('genre_id');

        const counts: Record<number, number> = {};
        if (!cgError && comicGenres) {
          comicGenres.forEach((cg: any) => {
            counts[cg.genre_id] = (counts[cg.genre_id] || 0) + 1;
          });
        }

        const result = genresData.map((g: any) => ({
          ...g,
          count: counts[g.id] || 0,
        }));

        cachedMatureGenresWithCounts = result;
        lastMatureGenresFetchedAt = now;
        return result;
      }
    } catch (err) {
      console.error('[getMatureGenresWithCounts] Error:', err);
    }
  }

  if (!supabase) {
    const fallbackCounts: Record<number, number> = {};
    MOCK_MATURE_COMICS.forEach((c) => {
      c.genres?.forEach((g) => {
        fallbackCounts[g.id] = (fallbackCounts[g.id] || 0) + 1;
      });
    });

    return MOCK_MATURE_GENRES.map((g) => ({
      ...g,
      count: fallbackCounts[g.id] || 0,
    }));
  }

  return [];
}

async function attachLatestMatureChapters(supabase: any, comics: any[]): Promise<MatureComic[]> {
  if (!comics || comics.length === 0) return [];
  const comicIds = comics.map((c) => c.id).filter(Boolean);
  if (comicIds.length === 0) return comics;

  try {
    const { data: chapters, error } = await supabase
      .from('mature_chapters')
      .select('id, comic_id, chapter_number, released_at')
      .in('comic_id', comicIds)
      .order('chapter_number', { ascending: false });

    const latestMap: Record<string, any> = {};
    if (!error && chapters) {
      for (const ch of chapters) {
        if (!latestMap[ch.comic_id]) {
          latestMap[ch.comic_id] = {
            id: ch.id,
            chapter_number: Number(ch.chapter_number),
            released_at: ch.released_at,
          };
        }
      }
    }

    return comics.map((item) => ({
      ...item,
      genres: item.genres?.map((g: any) => g.mature_genres).filter(Boolean) || [],
      latest_chapter: latestMap[item.id] || undefined,
    }));
  } catch (err) {
    console.error('[attachLatestMatureChapters] Error:', err);
    return comics.map((item) => ({
      ...item,
      genres: item.genres?.map((g: any) => g.mature_genres).filter(Boolean) || [],
    }));
  }
}

export async function getLatestMatureComics(limit = 18): Promise<MatureComic[]> {
  return getMatureComics(undefined, { limit });
}

export async function getPopularMatureComics(limit = 10): Promise<MatureComic[]> {
  return getMatureComics({ sort: 'popular' } as any, { limit });
}

export async function getMatureComics(
  filters?: MatureFilterState,
  options?: { page?: number; limit?: number }
): Promise<MatureComic[]> {
  const supabase = getSupabaseClient();
  const limit = Math.min(100, Math.max(1, options?.limit || 24));
  const page = Math.max(1, options?.page || 1);
  const offset = (page - 1) * limit;

  if (supabase) {
    try {
      let query = supabase.from('mature_comics').select(`
        id, title, slug, type, status, gore_level, cover_url, rating, synopsis, author, updated_at,
        genres:mature_comic_genres(mature_genres(id, name, slug))
      `);

      if (filters?.type && filters.type !== 'all') {
        query = query.eq('type', filters.type);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.gore_level && filters.gore_level !== 'all') {
        query = query.eq('gore_level', filters.gore_level);
      }

      if (filters?.query) {
        query = query.ilike('title', `%${filters.query}%`);
      }

      if (filters?.sort === 'popular' || filters?.sort === 'rating') {
        query = query.order('rating', { ascending: false });
      } else if (filters?.sort === 'title') {
        query = query.order('title', { ascending: true });
      } else {
        query = query.order('updated_at', { ascending: false });
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (!error && data) {
        return await attachLatestMatureChapters(supabase, data);
      }
      if (error) {
        console.error('[getMatureComics] Query error:', error);
      }
    } catch (err) {
      console.error('[getMatureComics] Exception:', err);
    }
    return [];
  }

  // Fallback to MOCK_MATURE_COMICS only if DB client is completely unconfigured
  let result = [...MOCK_MATURE_COMICS];

  if (filters?.type && filters.type !== 'all') {
    result = result.filter((c) => c.type === filters.type);
  }

  if (filters?.status && filters.status !== 'all') {
    result = result.filter((c) => c.status === filters.status);
  }

  if (filters?.gore_level && filters.gore_level !== 'all') {
    result = result.filter((c) => c.gore_level === filters.gore_level);
  }

  return result.slice(0, limit);
}

export async function getMatureComicBySlug(slug: string): Promise<MatureComic | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('mature_comics')
        .select(`
          id, title, slug, type, status, gore_level, cover_url, rating, synopsis, author, updated_at,
          genres:mature_comic_genres(mature_genres(id, name, slug))
        `)
        .eq('slug', slug)
        .maybeSingle();

      if (!error && data) {
        const withCh = await attachLatestMatureChapters(supabase, [data]);
        return withCh[0] || null;
      }
    } catch (err) {
      console.error('[getMatureComicBySlug] Error:', err);
    }
    return null;
  }

  return MOCK_MATURE_COMICS.find((c) => c.slug === slug) || null;
}
