import { Chapter, ChapterPage } from '../types';
import { MOCK_CHAPTERS, MOCK_PAGES, MOCK_COMICS } from '../mock-data';
import { createServerSupabaseClient } from '../supabase/server';
import { createClient } from '../supabase/client';

function getSupabaseClient() {
  if (typeof window !== 'undefined') {
    return createClient();
  }
  return createServerSupabaseClient();
}

export async function getLatestChapters(limit = 12): Promise<Chapter[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('chapters')
        .select(`
          *,
          comic:comics(*)
        `)
        .eq('status', 'published')
        .order('released_at', { ascending: false })
        .limit(limit);

      if (!error && data) return data;
    } catch {
      // Fallback
    }
  }

  // Fallback using mock data
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

export async function getComicChapters(comicSlug: string): Promise<Chapter[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data: comic } = await supabase.from('comics').select('id').eq('slug', comicSlug).single();
      if (comic) {
        const { data, error } = await supabase
          .from('chapters')
          .select('*')
          .eq('comic_id', comic.id)
          .eq('status', 'published')
          .order('chapter_number', { ascending: false });

        if (!error && data) return data;
      }
    } catch {
      // Fallback
    }
  }

  const chapters = MOCK_CHAPTERS[comicSlug] || [];
  return [...chapters].sort((a, b) => b.chapter_number - a.chapter_number);
}

export async function getChapterByNumber(comicSlug: string, chapterNumber: number): Promise<Chapter | null> {
  const chapters = await getComicChapters(comicSlug);
  return chapters.find((ch) => ch.chapter_number === chapterNumber) || null;
}

export async function getChapterPages(chapterId: string): Promise<ChapterPage[]> {
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

  return MOCK_PAGES[chapterId] || MOCK_PAGES['ch-101'] || [];
}
