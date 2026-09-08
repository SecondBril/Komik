import { ReadingHistoryItem, Comic, Chapter } from '../types';
import { MOCK_COMICS, MOCK_CHAPTERS } from '../mock-data';
import { createClient } from '../supabase/client';

const GUEST_HISTORY_KEY = 'komikindo_guest_reading_history';

export interface SaveReadingHistoryParams {
  comic_id: string;
  chapter_id: string;
  scroll_position?: number;
  comic?: {
    id?: string;
    slug?: string;
    title?: string;
    cover_url?: string;
    type?: string;
    author?: string;
  };
  chapter?: {
    id?: string;
    chapter_number?: number;
    title?: string;
  };
}

export interface GroupedComicHistory {
  comic_id: string;
  comic: Comic;
  latestChapter: Chapter;
  last_read_at: string;
  totalChaptersRead: number;
  readChapters: ReadingHistoryItem[];
}

/**
 * Mengambil semua daftar chapter yang pernah dibaca oleh user (urut dari paling baru dibaca).
 */
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
 * Menyimpan riwayat bacaan:
 * 1. Simpan setiap chapter ke local storage (menyimpan histori keseluruhan per-chapter).
 * 2. Jika user login, lakukan sync ke Supabase Cloud DB (throttled 10 detik).
 */
export async function saveReadingHistory(item: SaveReadingHistoryParams): Promise<void> {
  // 1. Simpan ke local storage cache untuk responsivitas instan
  saveGuestHistory(item);

  // 2. Jika user login via Supabase, kirim ke backend Cloud DB
  if (typeof window !== 'undefined') {
    const currentKey = `${item.comic_id}_${item.chapter_id}`;
    const now = Date.now();

    // Strict Throttle: Max 1 network request per 10 detik untuk chapter yang sama
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

/**
 * Menyimpan chapter yang dibaca ke LocalStorage.
 * Menyimpan seluruh riwayat chapter (bukan hanya chapter terakhir per komik).
 */
export function saveGuestHistory(item: SaveReadingHistoryParams): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getGuestHistory();

    // Prioritaskan metadata asli yang dikirim dari reader
    const mockComic = MOCK_COMICS.find((c) => c.id === item.comic_id || c.slug === item.comic?.slug || c.slug === item.comic_id);
    const mockChapters = mockComic ? (MOCK_CHAPTERS[mockComic.slug] || []) : [];
    const mockChapter = mockChapters.find((ch) => ch.id === item.chapter_id || ch.chapter_number === item.chapter?.chapter_number);

    const comicId = item.comic_id || item.comic?.id || mockComic?.id || 'unknown';
    const comicSlug = item.comic?.slug || mockComic?.slug || comicId;
    const chapterId = item.chapter_id || item.chapter?.id || mockChapter?.id || 'unknown';
    const chapterNumber = item.chapter?.chapter_number ?? mockChapter?.chapter_number ?? 1;

    const comicObj: Comic = {
      id: comicId,
      slug: comicSlug,
      title: item.comic?.title || mockComic?.title || 'Komik',
      alt_titles: mockComic?.alt_titles || [],
      type: (item.comic?.type as any) || mockComic?.type || 'manhwa',
      synopsis: mockComic?.synopsis || '',
      cover_url: item.comic?.cover_url || mockComic?.cover_url || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
      author: item.comic?.author || mockComic?.author || 'Unknown Author',
      status: mockComic?.status || 'ongoing',
      rating: mockComic?.rating || 4.8,
      source_id: mockComic?.source_id || '1',
      created_at: mockComic?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const chapterObj: Chapter = {
      id: chapterId,
      comic_id: comicId,
      chapter_number: chapterNumber,
      title: item.chapter?.title || mockChapter?.title || `Chapter ${chapterNumber}`,
      status: 'published',
      retry_count: 0,
      released_at: mockChapter?.released_at || new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const historyItemId = `h-${comicId}-${chapterId}`;

    const newHistoryItem: ReadingHistoryItem = {
      id: historyItemId,
      comic_id: comicId,
      chapter_id: chapterId,
      scroll_position: item.scroll_position || 0,
      last_read_at: new Date().toISOString(),
      comic: comicObj,
      chapter: chapterObj,
      has_new_chapter: false,
    };

    // Cari apakah spesifik chapter ini sudah pernah dibaca sebelumnya
    const existingIndex = history.findIndex((h) => {
      const sameComic = h.comic_id === comicId || (comicSlug && h.comic?.slug === comicSlug);
      const sameChapter = h.chapter_id === chapterId || h.chapter?.chapter_number === chapterNumber;
      return sameComic && sameChapter;
    });

    if (existingIndex >= 0) {
      // Hapus item lama dan tempatkan versi terbarunya di posisi paling atas (paling baru dibaca)
      history.splice(existingIndex, 1);
    }

    history.unshift(newHistoryItem);

    // Batasi kapasitas history maksimal 500 chapter agar storage tetap ringan
    const trimmedHistory = history.slice(0, 500);

    localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(trimmedHistory));
  } catch (err) {
    console.error('Error saving reading history:', err);
  }
}

/**
 * Mengambil Set ID chapter yang sudah dibaca untuk komik tertentu.
 */
export function getReadChapterIds(comicIdOrSlug: string): Set<string> {
  const history = getGuestHistory();
  const readIds = new Set<string>();

  history.forEach((h) => {
    if (h.comic_id === comicIdOrSlug || h.comic?.slug === comicIdOrSlug) {
      if (h.chapter_id) readIds.add(h.chapter_id);
    }
  });

  return readIds;
}

/**
 * Mengambil Set nomor chapter yang sudah dibaca untuk komik tertentu.
 */
export function getReadChapterNumbers(comicIdOrSlug: string): Set<number> {
  const history = getGuestHistory();
  const readNumbers = new Set<number>();

  history.forEach((h) => {
    if (h.comic_id === comicIdOrSlug || h.comic?.slug === comicIdOrSlug) {
      if (h.chapter?.chapter_number !== undefined) {
        readNumbers.add(h.chapter.chapter_number);
      }
    }
  });

  return readNumbers;
}

/**
 * Mengecek apakah chapter tertentu sudah pernah dibaca atau belum.
 */
export function isChapterRead(
  chapterIdOrNum: string | number,
  comicIdOrSlug?: string
): boolean {
  const history = getGuestHistory();

  return history.some((h) => {
    if (comicIdOrSlug && h.comic_id !== comicIdOrSlug && h.comic?.slug !== comicIdOrSlug) {
      return false;
    }
    if (typeof chapterIdOrNum === 'number') {
      return h.chapter?.chapter_number === chapterIdOrNum;
    }
    return h.chapter_id === chapterIdOrNum || h.chapter?.chapter_number === Number(chapterIdOrNum);
  });
}

/**
 * Mengambil chapter terakhir yang dibaca untuk komik tertentu (untuk fungsi "Lanjut Baca").
 */
export function getLastReadChapter(comicIdOrSlug: string): ReadingHistoryItem | null {
  const history = getGuestHistory();
  return (
    history.find(
      (h) => h.comic_id === comicIdOrSlug || h.comic?.slug === comicIdOrSlug
    ) || null
  );
}

/**
 * Mengambil riwayat yang dikelompokkan berdasarkan komik (untuk ringkasan progress baca komik).
 */
export function getHistoryGroupedByComic(): GroupedComicHistory[] {
  const history = getGuestHistory();
  const map = new Map<string, GroupedComicHistory>();

  for (const item of history) {
    const key = item.comic_id || item.comic?.slug || item.comic?.title;
    if (!map.has(key)) {
      map.set(key, {
        comic_id: item.comic_id,
        comic: item.comic,
        latestChapter: item.chapter,
        last_read_at: item.last_read_at,
        totalChaptersRead: 1,
        readChapters: [item],
      });
    } else {
      const existing = map.get(key)!;
      existing.totalChaptersRead += 1;
      existing.readChapters.push(item);
    }
  }

  return Array.from(map.values());
}

/**
 * Menghapus 1 entri chapter spesifik dari riwayat baca.
 */
export function removeGuestHistoryItem(historyIdOrChapterId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getGuestHistory();
    const filtered = history.filter(
      (item) => item.id !== historyIdOrChapterId && item.chapter_id !== historyIdOrChapterId
    );
    localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Error deleting history item:', err);
  }
}

/**
 * Menghapus semua riwayat baca untuk satu komik tertentu.
 */
export function removeComicHistory(comicIdOrSlug: string): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getGuestHistory();
    const filtered = history.filter(
      (item) => item.comic_id !== comicIdOrSlug && item.comic?.slug !== comicIdOrSlug
    );
    localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Error deleting comic history:', err);
  }
}

/**
 * Menghapus seluruh riwayat baca.
 */
export function clearGuestHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GUEST_HISTORY_KEY);
  } catch (err) {
    console.error('Error clearing history:', err);
  }
}
