import { MatureChapter, ChapterPage } from '../types';
import { MOCK_MATURE_CHAPTERS, MOCK_MATURE_PAGES, MOCK_MATURE_COMICS } from '../mock-data-mature';
import { createServerSupabaseClient } from '../supabase/server';
import { createClient } from '../supabase/client';

function getSupabaseClient() {
  if (typeof window !== 'undefined') {
    return createClient();
  }
  return createServerSupabaseClient();
}

export async function getLatestMatureChapters(limit = 12): Promise<MatureChapter[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('mature_chapters')
        .select(`
          *,
          comic:mature_comics(*)
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
  const allChapters: MatureChapter[] = [];
  Object.keys(MOCK_MATURE_CHAPTERS).forEach((slug) => {
    const comic = MOCK_MATURE_COMICS.find((c) => c.slug === slug);
    MOCK_MATURE_CHAPTERS[slug].forEach((ch) => {
      allChapters.push({ ...ch, comic });
    });
  });

  return allChapters
    .sort((a, b) => new Date(b.released_at).getTime() - new Date(a.released_at).getTime())
    .slice(0, limit);
}

export async function getMatureComicChapters(comicSlug: string): Promise<MatureChapter[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data: comic } = await supabase
        .from('mature_comics')
        .select('id')
        .eq('slug', comicSlug)
        .single();

      if (comic) {
        const { data, error } = await supabase
          .from('mature_chapters')
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

  return MOCK_MATURE_CHAPTERS[comicSlug] || [];
}

export async function getMatureChapterPages(chapterId: string): Promise<ChapterPage[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('mature_chapter_pages')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('page_number', { ascending: true });

      if (!error && data && data.length > 0) return data;
    } catch {
      // Fallback
    }
  }

  return MOCK_MATURE_PAGES.default || [];
}
