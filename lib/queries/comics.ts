import { Comic, FilterState, Genre } from '../types';
import { MOCK_COMICS, MOCK_GENRES } from '../mock-data';
import { createServerSupabaseClient } from '../supabase/server';
import { createClient } from '../supabase/client';
import { getTursoClient } from '../turso';
import {
  getTursoGenres,
  getTursoGenresWithCounts,
  getTursoLatestComics,
  getTursoPopularComics,
  getTursoComicBySlug,
  getTursoComics,
} from './turso-comics';

function getSupabaseClient() {
  if (typeof window !== 'undefined') {
    return createClient();
  }
  return createServerSupabaseClient();
}

// In-memory cache for genre counts to avoid expensive DB scans on every request
let cachedGenresWithCounts: (Genre & { count: number })[] | null = null;
let lastGenresFetchedAt = 0;
const GENRES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getGenres(): Promise<Genre[]> {
  // 1. Try Turso first if configured
  if (getTursoClient()) {
    const tursoGenres = await getTursoGenres();
    if (tursoGenres && tursoGenres.length > 0) return tursoGenres;
  }

  // 2. Fallback to Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('genres').select('*').order('name');
      if (!error && data && data.length > 0) return data;
    } catch (err) {
      console.error('[getGenres] Error fetching genres from Supabase:', err);
    }
  }

  return !supabase && !getTursoClient() ? MOCK_GENRES : [];
}

export async function getGenresWithCounts(): Promise<(Genre & { count: number })[]> {
  const now = Date.now();
  if (cachedGenresWithCounts && now - lastGenresFetchedAt < GENRES_CACHE_TTL_MS) {
    return cachedGenresWithCounts;
  }

  // 1. Try Turso first if configured (ultra-fast GROUP BY)
  if (getTursoClient()) {
    const tursoCounts = await getTursoGenresWithCounts();
    if (tursoCounts && tursoCounts.length > 0) {
      cachedGenresWithCounts = tursoCounts;
      lastGenresFetchedAt = now;
      return tursoCounts;
    }
  }

  // 2. Fallback to Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data: genresData, error: genresError } = await supabase
        .from('genres')
        .select('id, name, slug')
        .order('name');

      if (!genresError && genresData && genresData.length > 0) {
        const { data: comicGenres, error: cgError } = await supabase
          .from('comic_genres')
          .select('genre_id');

        const counts: Record<number, number> = {};
        if (!cgError && comicGenres) {
          comicGenres.forEach((cg: any) => {
            counts[cg.genre_id] = (counts[cg.genre_id] || 0) + 1;
          });
        }

        const result = genresData.map((g: any) => ({
          id: g.id,
          name: g.name,
          slug: g.slug,
          count: counts[g.id] || 0,
        }));

        cachedGenresWithCounts = result;
        lastGenresFetchedAt = now;
        return result;
      }
    } catch (err) {
      console.error('[getGenresWithCounts] Supabase Error:', err);
    }
  }

  if (!supabase && !getTursoClient()) {
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

  return [];
}

/**
 * Helper to batch-attach latest chapter to comics when using Supabase.
 */
async function attachLatestChapters(supabase: any, comics: any[]): Promise<Comic[]> {
  if (!comics || comics.length === 0) return [];
  const comicIds = comics.map((c) => c.id).filter(Boolean);
  if (comicIds.length === 0) return comics;

  try {
    const { data: chapters, error } = await supabase
      .from('chapters')
      .select('id, comic_id, chapter_number, released_at')
      .in('comic_id', comicIds)
      .order('chapter_number', { ascending: false });

    const latestChapterMap: Record<string, any> = {};
    if (!error && chapters) {
      for (const ch of chapters) {
        if (!latestChapterMap[ch.comic_id]) {
          latestChapterMap[ch.comic_id] = {
            id: ch.id,
            chapter_number: Number(ch.chapter_number),
            released_at: ch.released_at,
          };
        }
      }
    }

    return comics.map((item) => ({
      ...item,
      genres: item.genres?.map((g: any) => g.genres).filter(Boolean) || [],
      latest_chapter: latestChapterMap[item.id] || undefined,
    }));
  } catch (err) {
    console.error('[attachLatestChapters] Error:', err);
    return comics.map((item) => ({
      ...item,
      genres: item.genres?.map((g: any) => g.genres).filter(Boolean) || [],
    }));
  }
}

/**
 * Fast targeted query for latest updated comics (e.g. 18 for Homepage).
 */
export async function getLatestComics(limit = 18): Promise<Comic[]> {
  // 1. Try Turso
  if (getTursoClient()) {
    const comics = await getTursoLatestComics(limit);
    if (comics && comics.length > 0) return comics;
  }

  // 2. Fallback to Supabase
  const supabase = getSupabaseClient();
  if (!supabase) return MOCK_COMICS.slice(0, limit);

  try {
    const { data, error } = await supabase
      .from('comics')
      .select(`
        id, title, slug, type, status, cover_url, rating, synopsis, author, updated_at,
        genres:comic_genres(genres(id, name, slug))
      `)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[getLatestComics] Supabase error:', error);
      return [];
    }

    return await attachLatestChapters(supabase, data || []);
  } catch (err) {
    console.error('[getLatestComics] Exception:', err);
    return [];
  }
}

/**
 * Fast targeted query for highest rated / popular comics (e.g. 10 for Homepage Carousel).
 */
export async function getPopularComics(limit = 10): Promise<Comic[]> {
  // 1. Try Turso
  if (getTursoClient()) {
    const comics = await getTursoPopularComics(limit);
    if (comics && comics.length > 0) return comics;
  }

  // 2. Fallback to Supabase
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [...MOCK_COMICS].sort((a, b) => b.rating - a.rating).slice(0, limit);
  }

  try {
    const { data, error } = await supabase
      .from('comics')
      .select(`
        id, title, slug, type, status, cover_url, rating, synopsis, author, updated_at,
        genres:comic_genres(genres(id, name, slug))
      `)
      .order('rating', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[getPopularComics] Database error:', error);
      return [];
    }

    return await attachLatestChapters(supabase, data || []);
  } catch (err) {
    console.error('[getPopularComics] Exception:', err);
    return [];
  }
}

/**
 * Fast targeted query for the Featured Editor Pick comic on Homepage.
 */
export async function getFeaturedComic(): Promise<Comic | null> {
  const popular = await getPopularComics(1);
  return popular[0] || null;
}

/**
 * General bounded comics query with filtering and pagination.
 */
export async function getComics(
  filters?: FilterState,
  options?: { page?: number; limit?: number }
): Promise<Comic[]> {
  // 1. Try Turso
  if (getTursoClient()) {
    const comics = await getTursoComics(filters, options);
    if (comics && comics.length > 0) return comics;
  }

  // 2. Fallback to Supabase
  const supabase = getSupabaseClient();
  if (!supabase) {
    let result = [...MOCK_COMICS];
    if (filters?.type && filters.type !== 'all') {
      result = result.filter((c) => c.type === filters.type);
    }
    if (filters?.status && filters.status !== 'all') {
      result = result.filter((c) => c.status === filters.status);
    }
    return result.slice(0, options?.limit || 24);
  }

  const limit = Math.min(100, Math.max(1, options?.limit || 24));
  const page = Math.max(1, options?.page || 1);
  const offset = (page - 1) * limit;

  try {
    let query = supabase.from('comics').select(`
      id, title, slug, type, status, cover_url, rating, synopsis, author, updated_at,
      genres:comic_genres(genres(id, name, slug))
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

    if (filters?.sort === 'popular' || filters?.sort === 'rating') {
      query = query.order('rating', { ascending: false });
    } else if (filters?.sort === 'title') {
      query = query.order('title', { ascending: true });
    } else {
      query = query.order('updated_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('[getComics] Query error:', error);
      return [];
    }

    return await attachLatestChapters(supabase, data || []);
  } catch (err) {
    console.error('[getComics] Exception:', err);
    return [];
  }
}

export async function getComicBySlug(slug: string): Promise<Comic | null> {
  // 1. Try Turso
  if (getTursoClient()) {
    const comic = await getTursoComicBySlug(slug);
    if (comic) return comic;
  }

  // 2. Fallback to Supabase
  const supabase = getSupabaseClient();
  if (!supabase) {
    return MOCK_COMICS.find((c) => c.slug === slug) || null;
  }

  try {
    const { data, error } = await supabase
      .from('comics')
      .select(`
        id, title, slug, type, status, cover_url, rating, synopsis, author, updated_at,
        genres:comic_genres(genres(id, name, slug))
      `)
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const comicsWithChapter = await attachLatestChapters(supabase, [data]);
    return comicsWithChapter[0] || null;
  } catch (err) {
    console.error('[getComicBySlug] Exception:', err);
    return null;
  }
}
