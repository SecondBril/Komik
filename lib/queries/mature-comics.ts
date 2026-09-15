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

export async function getMatureGenres(): Promise<MatureGenre[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('mature_genres').select('*').order('name');
      if (!error && data && data.length > 0) return data;
    } catch {
      // Fallback
    }
  }
  return MOCK_MATURE_GENRES;
}

export async function getMatureGenresWithCounts(): Promise<(MatureGenre & { count: number })[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data: genresData, error: genresError } = await supabase
        .from('mature_genres')
        .select('id, name, slug, description')
        .order('name');

      if (!genresError && genresData && genresData.length > 0) {
        const { data: comicGenres } = await supabase
          .from('mature_comic_genres')
          .select('genre_id, mature_comics(id)');

        const counts: Record<number, number> = {};
        if (comicGenres) {
          comicGenres.forEach((cg: any) => {
            if (cg.mature_comics) {
              counts[cg.genre_id] = (counts[cg.genre_id] || 0) + 1;
            }
          });
        }

        return genresData.map((g: any) => ({
          ...g,
          count: counts[g.id] || 0,
        }));
      }
    } catch {
      // Fallback
    }
  }

  // Fallback calculation from MOCK_MATURE_COMICS
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

export async function getMatureComics(filters?: MatureFilterState): Promise<MatureComic[]> {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      let query = supabase.from('mature_comics').select(`
        *,
        genres:mature_comic_genres(mature_genres(*)),
        chapters:mature_chapters(id, chapter_number, title, released_at)
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

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (!error && data && data.length > 0) {
        let comics = data.map((item: any) => {
          const sortedChapters = item.chapters?.sort(
            (a: any, b: any) => (b.chapter_number ?? 0) - (a.chapter_number ?? 0)
          );
          return {
            ...item,
            genres: item.genres?.map((g: any) => g.mature_genres).filter(Boolean),
            latest_chapter: sortedChapters?.[0] || undefined,
          };
        });

        if (filters?.genres && filters.genres.length > 0) {
          comics = comics.filter((c: MatureComic) =>
            filters.genres.every((genreId) => c.genres?.some((g) => g.id === genreId))
          );
        }

        return comics;
      }
    } catch {
      // Fallback
    }
  }

  // Fallback to MOCK_MATURE_COMICS
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
        c.alt_titles?.some((alt) => alt.toLowerCase().includes(q))
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

export async function getMatureComicBySlug(slug: string): Promise<MatureComic | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('mature_comics')
        .select(`
          *,
          genres:mature_comic_genres(mature_genres(*))
        `)
        .eq('slug', slug)
        .single();

      if (!error && data) {
        return {
          ...data,
          genres: data.genres?.map((g: any) => g.mature_genres).filter(Boolean),
        };
      }
    } catch {
      // Fallback
    }
  }

  return MOCK_MATURE_COMICS.find((c) => c.slug === slug) || null;
}
