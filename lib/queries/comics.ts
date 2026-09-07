import { Comic, FilterState, Genre } from '../types';
import { MOCK_COMICS, MOCK_GENRES } from '../mock-data';
import { createServerSupabaseClient } from '../supabase/server';
import { createClient } from '../supabase/client';

function getSupabaseClient() {
  if (typeof window !== 'undefined') {
    return createClient();
  }
  return createServerSupabaseClient();
}

export async function getGenres(): Promise<Genre[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('genres').select('*').order('name');
      if (!error && data && data.length > 0) return data;
    } catch {
      // Fallback
    }
  }
  return MOCK_GENRES;
}

export async function getGenresWithCounts(): Promise<(Genre & { count: number })[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data: genresData, error: genresError } = await supabase
        .from('genres')
        .select('id, name, slug')
        .order('name');

      if (!genresError && genresData && genresData.length > 0) {
        const { data: comicGenres } = await supabase
          .from('comic_genres')
          .select('genre_id, comics(id)');

        const counts: Record<number, number> = {};
        if (comicGenres) {
          comicGenres.forEach((cg: any) => {
            if (cg.comics) {
              counts[cg.genre_id] = (counts[cg.genre_id] || 0) + 1;
            }
          });
        }

        return genresData.map((g: any) => ({
          id: g.id,
          name: g.name,
          slug: g.slug,
          count: counts[g.id] || 0,
        }));
      }
    } catch {
      // Fallback
    }
  }

  // Fallback calculation from MOCK_COMICS
  const fallbackCounts: Record<number, number> = {};
  MOCK_COMICS.forEach((c) => {
    c.genres?.forEach((g) => {
      fallbackCounts[g.id] = (fallbackCounts[g.id] || 0) + 1;
    });
  });

  return MOCK_GENRES.map((g) => ({
    ...g,
    count: fallbackCounts[g.id] || 0,
  }));
}

export async function getComics(filters?: FilterState): Promise<Comic[]> {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    try {
      let query = supabase.from('comics').select(`
        *,
        genres:comic_genres(genres(*)),
        chapters(id, chapter_number, title, released_at)
      `);

      if (filters?.type && filters.type !== 'all') {
        query = query.eq('type', filters.type);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.query) {
        query = query.ilike('title', `%${filters.query}%`);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (!error && data) {
        return data.map((item: any) => {
          const sortedChapters = item.chapters?.sort(
            (a: any, b: any) => new Date(b.released_at).getTime() - new Date(a.released_at).getTime()
          );
          return {
            ...item,
            genres: item.genres?.map((g: any) => g.genres).filter(Boolean),
            latest_chapter: sortedChapters?.[0] || undefined,
          };
        });
      }
    } catch {
      // Fallback
    }
  }

  // Fallback to MOCK_COMICS with in-memory filtering
  let result = [...MOCK_COMICS];

  if (filters?.type && filters.type !== 'all') {
    result = result.filter((c) => c.type === filters.type);
  }

  if (filters?.status && filters.status !== 'all') {
    result = result.filter((c) => c.status === filters.status);
  }

  if (filters?.genres && filters.genres.length > 0) {
    result = result.filter((c) =>
      filters.genres.every((genreId) => c.genres?.some((g) => g.id === genreId))
    );
  }

  if (filters?.query) {
    const q = filters.query.toLowerCase();
    result = result.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.alt_titles.some((alt) => alt.toLowerCase().includes(q))
    );
  }

  if (filters?.sort === 'popular') {
    result.sort((a, b) => b.rating - a.rating);
  } else if (filters?.sort === 'rating') {
    result.sort((a, b) => b.rating - a.rating);
  } else if (filters?.sort === 'title') {
    result.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  return result;
}

export async function getComicBySlug(slug: string): Promise<Comic | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('comics')
        .select(`
          *,
          genres:comic_genres(genres(*))
        `)
        .eq('slug', slug)
        .single();

      if (!error && data) {
        return {
          ...data,
          genres: data.genres?.map((g: any) => g.genres).filter(Boolean),
        };
      }
    } catch {
      // Fallback
    }
  }

  return MOCK_COMICS.find((c) => c.slug === slug) || null;
}
