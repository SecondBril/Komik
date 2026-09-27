import { createClient } from '@/lib/supabase/client';
import { ComicAdaptation } from '@/lib/types';
import { getTursoClient } from '@/lib/turso';
import { getTursoComicAdaptations, getTursoChapterAdaptation } from './turso-comics';

/**
 * Fetch all adaptation ranges for a comic, sorted by start_chapter ascending
 */
export async function getComicAdaptations(comicId: string): Promise<ComicAdaptation[]> {
  if (!comicId) return [];

  // 1. Prioritaskan Turso (super cepat, 0 beban Supabase)
  if (getTursoClient()) {
    try {
      const tursoData = await getTursoComicAdaptations(comicId);
      if (tursoData) return tursoData;
    } catch (tErr) {
      console.warn('[getComicAdaptations] Turso query error:', tErr);
    }
  }

  // 2. Fallback ke Supabase jika Turso tidak aktif
  const supabase = createClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('comic_adaptations')
      .select('*')
      .eq('comic_id', comicId)
      .order('start_chapter', { ascending: true });

    if (error) {
      console.warn('[getComicAdaptations] Query warning:', error.message);
      return [];
    }

    return (data || []).map((row) => ({
      ...row,
      start_chapter: Number(row.start_chapter),
      end_chapter: Number(row.end_chapter),
    }));
  } catch (err) {
    console.warn('[getComicAdaptations] Failed:', err);
    return [];
  }
}

/**
 * Find the adaptation info corresponding to a specific chapter number
 */
export async function getChapterAdaptation(
  comicId: string,
  chapterNumber: number
): Promise<ComicAdaptation | null> {
  if (!comicId || isNaN(chapterNumber)) return null;

  // 1. Prioritaskan Turso
  if (getTursoClient()) {
    try {
      const tursoData = await getTursoChapterAdaptation(comicId, chapterNumber);
      if (tursoData) return tursoData;
    } catch (tErr) {
      console.warn('[getChapterAdaptation] Turso query error:', tErr);
    }
  }

  // 2. Fallback ke Supabase jika Turso tidak aktif
  const supabase = createClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('comic_adaptations')
      .select('*')
      .eq('comic_id', comicId)
      .lte('start_chapter', chapterNumber)
      .gte('end_chapter', chapterNumber)
      .order('start_chapter', { ascending: false })
      .maybeSingle();

    if (error || !data) return null;

    return {
      ...data,
      start_chapter: Number(data.start_chapter),
      end_chapter: Number(data.end_chapter),
    };
  } catch (err) {
    console.warn('[getChapterAdaptation] Failed:', err);
    return null;
  }
}
