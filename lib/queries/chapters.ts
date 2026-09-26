import { Chapter, ChapterPage } from '../types';
import { MOCK_CHAPTERS, MOCK_COMICS } from '../mock-data';
import { createServerSupabaseClient } from '../supabase/server';
import { createClient } from '../supabase/client';
import { getTursoClient } from '../turso';
import {
  getTursoComicChapters,
  getTursoChapterByNumber,
  getTursoChapterPages,
} from './turso-comics';

function getSupabaseClient() {
  if (typeof window !== 'undefined') {
    return createClient();
  }
  return createServerSupabaseClient();
}

export async function getLatestChapters(limit = 12): Promise<Chapter[]> {
  const turso = getTursoClient();
  if (turso) {
    try {
      const res = await turso.execute({
        sql: `
          SELECT ch.id, ch.comic_id, ch.chapter_number, ch.title, ch.status, ch.released_at, ch.created_at,
                 c.id as c_id, c.slug as c_slug, c.title as c_title, c.cover_url as c_cover
          FROM chapters ch
          JOIN comics c ON c.id = ch.comic_id
          ORDER BY ch.released_at DESC
          LIMIT ?;
        `,
        args: [limit],
      });
      if (res.rows.length > 0) {
        return res.rows.map((r: any) => ({
          id: String(r.id),
          comic_id: String(r.comic_id),
          chapter_number: Number(r.chapter_number),
          title: String(r.title || `Chapter ${r.chapter_number}`),
          status: (r.status || 'published') as any,
          retry_count: 0,
          released_at: String(r.released_at),
          created_at: String(r.created_at),
          comic: {
            id: String(r.c_id),
            slug: String(r.c_slug),
            title: String(r.c_title),
            cover_url: String(r.c_cover),
          } as any,
        }));
      }
    } catch (err) {
      console.error('[getLatestChapters] Turso error:', err);
    }
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('chapters')
        .select(`
          *,
          comic:comics(*)
        `)
        .order('released_at', { ascending: false })
        .limit(limit);

      if (!error && data) return data;
    } catch {
      // Fallback
    }
  }

  // Fallback using mock data only if no DB is available
  if (!supabase && !turso) {
    const allChapters: Chapter[] = [];
    Object.keys(MOCK_CHAPTERS).forEach((slug) => {
      const comic = MOCK_COMICS.find((c) => c.slug === slug);
      MOCK_CHAPTERS[slug].forEach((ch) => {
        allChapters.push({ ...ch, comic });
      });
    });

    return allChapters
      .sort((a, b) => new Date(b.released_at).getTime() - new Date(a.released_at).getTime())
      .slice(0, limit);
  }

  return [];
}

export async function getComicChapters(comicSlug: string): Promise<Chapter[]> {
  // 1. Try Turso
  if (getTursoClient()) {
    const chapters = await getTursoComicChapters(comicSlug);
    if (chapters && chapters.length > 0) return chapters;
  }

  // 2. Fallback to Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data: comic } = await supabase.from('comics').select('id').eq('slug', comicSlug).single();
      if (comic) {
        const { data, error } = await supabase
          .from('chapters')
          .select('*')
          .eq('comic_id', comic.id)
          .order('chapter_number', { ascending: false });

        if (!error && data) return data;
      }
    } catch {
      // Fallback
    }
  }

  if (!supabase && !getTursoClient()) {
    const chapters = MOCK_CHAPTERS[comicSlug] || [];
    return [...chapters].sort((a, b) => b.chapter_number - a.chapter_number);
  }

  return [];
}

export async function getChapterByNumber(comicSlug: string, chapterNumber: number): Promise<Chapter | null> {
  // 1. Try Turso
  if (getTursoClient()) {
    const chapter = await getTursoChapterByNumber(comicSlug, chapterNumber);
    if (chapter) return chapter;
  }

  // 2. Fallback
  const chapters = await getComicChapters(comicSlug);
  return chapters.find((ch) => ch.chapter_number === chapterNumber) || null;
}

export async function getChapterPages(chapterId: string): Promise<ChapterPage[]> {
  // 1. Try Turso
  if (getTursoClient()) {
    const pages = await getTursoChapterPages(chapterId);
    if (pages && pages.length > 0) return pages;
  }

  // 2. Fallback to Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('chapter_pages')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('page_number', { ascending: true });

      if (!error && data && data.length > 0) return data;
    } catch {
      // Fallback
    }
  }

  return [];
}
