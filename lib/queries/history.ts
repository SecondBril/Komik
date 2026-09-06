import { ReadingHistoryItem } from '../types';
import { MOCK_COMICS, MOCK_CHAPTERS } from '../mock-data';
import { createClient } from '../supabase/client';

const GUEST_HISTORY_KEY = 'komikindo_guest_reading_history';

export function getGuestHistory(): ReadingHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GUEST_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

let lastHistorySaveTime = 0;
let lastHistorySaveKey = '';

/**
 * Unified Reading History Saver:
 * 1. Saves to local storage cache for instant offline/guest reading
 * 2. If logged in, sends POST /api/history to save permanently in Supabase Cloud DB (Throttled 10s per chapter)
 */
export async function saveReadingHistory(item: {
  comic_id: string;
  chapter_id: string;
  scroll_position?: number;
}): Promise<void> {
  // Always update guest/local cache first for instant responsiveness
  saveGuestHistory(item);

  // If user is authenticated via Supabase, post to Cloud DB
  if (typeof window !== 'undefined') {
    const currentKey = `${item.comic_id}_${item.chapter_id}`;
    const now = Date.now();

    // Strict Throttle: Max 1 network request per 10 seconds for the same comic chapter
    if (currentKey === lastHistorySaveKey && now - lastHistorySaveTime < 10000) {
      return;
    }
    lastHistorySaveKey = currentKey;
    lastHistorySaveTime = now;

    try {
      const supabase = createClient();
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              comic_id: item.comic_id,
              chapter_id: item.chapter_id,
              scroll_position: item.scroll_position || 0,
            }),
          });
        }
      }
    } catch (err) {
      console.warn('Cloud reading history sync skipped:', err);
    }
  }
}

export function saveGuestHistory(item: {
  comic_id: string;
  chapter_id: string;
  scroll_position?: number;
}): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getGuestHistory();
    const comic = MOCK_COMICS.find((c) => c.id === item.comic_id || c.slug === item.comic_id);

    const chapters = comic ? (MOCK_CHAPTERS[comic.slug] || []) : [];
    const chapter = chapters.find((ch) => ch.id === item.chapter_id || ch.chapter_number === Number(item.chapter_id));

    const comicId = comic ? comic.id : item.comic_id;
    const chapterId = chapter ? chapter.id : item.chapter_id;

    const existingIndex = history.findIndex((h) => h.comic_id === comicId);
    const updatedItem: ReadingHistoryItem = {
      id: `gh-${comicId}`,
      comic_id: comicId,
      chapter_id: chapterId,
      scroll_position: item.scroll_position || 0,
      last_read_at: new Date().toISOString(),
      comic: comic || {
        id: comicId,
        slug: comicId,
        title: 'Komik Bacaan',
        alt_titles: [],
        type: 'manhwa',
        synopsis: '',
        cover_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
        author: 'Unknown Author',
        status: 'ongoing',
        rating: 4.8,
        source_id: '1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      chapter: chapter || {
        id: chapterId,
        comic_id: comicId,
        chapter_number: 1,
        title: 'Chapter Read',
        status: 'published',
        retry_count: 0,
        released_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
      has_new_chapter: false,
    };

    if (existingIndex >= 0) {
      history[existingIndex] = updatedItem;
    } else {
      history.unshift(updatedItem);
    }

    localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Error saving guest reading history:', err);
  }
}

export function removeGuestHistoryItem(comicId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getGuestHistory();
    const filtered = history.filter((item) => item.comic_id !== comicId);
    localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Error deleting guest history item:', err);
  }
}

export function clearGuestHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GUEST_HISTORY_KEY);
  } catch (err) {
    console.error('Error clearing guest history:', err);
  }
}
