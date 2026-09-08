/**
 * lib/queries/history.ts
 *
 * Manajemen riwayat baca komik:
 * - User LOGIN  → disimpan ke Supabase via /api/history (per chapter)
 * - User GUEST  → disimpan ke browser cookie (max 50 item, expire 30 hari)
 *
 * Tidak ada lagi ketergantungan pada MOCK_COMICS / MOCK_CHAPTERS.
 */

import { ReadingHistoryItem, Comic, Chapter } from '../types';
import { createClient } from '../supabase/client';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// COOKIE HELPERS (Guest)
// ─────────────────────────────────────────────────────────────────────────────

const COOKIE_KEY = 'komik_history';
const COOKIE_MAX_ITEMS = 50; // Cookie ~4KB limit
const COOKIE_EXPIRE_DAYS = 30;

/** Ambil cookie history guest dari document.cookie */
export function getCookieHistory(): ReadingHistoryItem[] {
  if (typeof document === 'undefined') return [];
  try {
    const match = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${COOKIE_KEY}=`));
    if (!match) return [];
    const raw = decodeURIComponent(match.split('=').slice(1).join('='));
    return JSON.parse(raw) as ReadingHistoryItem[];
  } catch {
    return [];
  }
}

/** Simpan array history guest ke cookie */
function saveCookieHistory(items: ReadingHistoryItem[]): void {
  if (typeof document === 'undefined') return;
  try {
    const trimmed = items.slice(0, COOKIE_MAX_ITEMS);
    const expires = new Date();
    expires.setDate(expires.getDate() + COOKIE_EXPIRE_DAYS);
    const encoded = encodeURIComponent(JSON.stringify(trimmed));
    // Periksa ukuran (cookie max ~4096 byte)
    if (encoded.length > 3800) {
      // Kurangi item sampai muat
      return saveCookieHistory(items.slice(0, Math.floor(items.length * 0.7)));
    }
    document.cookie = `${COOKIE_KEY}=${encoded}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  } catch (err) {
    console.warn('[History] Gagal menyimpan cookie history:', err);
  }
}

/** Hapus cookie history guest */
function clearCookieHistory(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

// ─────────────────────────────────────────────────────────────────────────────
// THROTTLE untuk cloud sync
// ─────────────────────────────────────────────────────────────────────────────

let lastSaveKey = '';
let lastSaveTime = 0;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: saveReadingHistory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simpan riwayat baca:
 * 1. Selalu simpan ke cookie (guest / fallback lokal)
 * 2. Jika user login, sync ke Supabase via /api/history (throttled 10 detik per chapter)
 */
export async function saveReadingHistory(item: SaveReadingHistoryParams): Promise<void> {
  // Bangun objek ReadingHistoryItem dari data real yang dikirim reader
  const comicId = item.comic_id;
  const chapterId = item.chapter_id;
  const chapterNumber = item.chapter?.chapter_number ?? 1;

  const comicObj: Comic = {
    id: comicId,
    slug: item.comic?.slug || comicId,
    title: item.comic?.title || 'Komik',
    alt_titles: [],
    type: (item.comic?.type as any) || 'manhwa',
    synopsis: '',
    cover_url:
      item.comic?.cover_url ||
      'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    author: item.comic?.author || 'Unknown Author',
    status: 'ongoing',
    rating: 4.8,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const chapterObj: Chapter = {
    id: chapterId,
    comic_id: comicId,
    chapter_number: chapterNumber,
    title: item.chapter?.title || `Chapter ${chapterNumber}`,
    status: 'published',
    retry_count: 0,
    released_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const newItem: ReadingHistoryItem = {
    id: `h-${comicId}-${chapterId}`,
    comic_id: comicId,
    chapter_id: chapterId,
    scroll_position: item.scroll_position || 0,
    last_read_at: new Date().toISOString(),
    comic: comicObj,
    chapter: chapterObj,
    has_new_chapter: false,
  };

  // 1. Simpan ke cookie (selalu — sebagai local cache)
  const existing = getCookieHistory();
  const filtered = existing.filter(
    (h) =>
      !(
        (h.comic_id === comicId || h.comic?.slug === comicObj.slug) &&
        h.chapter?.chapter_number === chapterNumber
      )
  );
  filtered.unshift(newItem);
  saveCookieHistory(filtered);

  // 2. Jika login, sync ke Supabase (throttled per chapter)
  if (typeof window === 'undefined') return;
  const currentKey = `${comicId}_${chapterId}`;
  const now = Date.now();
  if (currentKey === lastSaveKey && now - lastSaveTime < 10000) return;
  lastSaveKey = currentKey;
  lastSaveTime = now;

  try {
    const supabase = createClient();
    if (!supabase) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comic_id: comicId,
        chapter_id: chapterId,
        comic_slug: item.comic?.slug || comicObj.slug,
        chapter_number: item.chapter?.chapter_number ?? chapterNumber,
        scroll_position: item.scroll_position || 0,
      }),
    });
  } catch (err) {
    console.warn('[History] Cloud sync skipped:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GUEST HISTORY HELPERS (baca dari cookie)
// ─────────────────────────────────────────────────────────────────────────────

/** Alias publik agar history page bisa baca cookie guest */
export function getGuestHistory(): ReadingHistoryItem[] {
  return getCookieHistory();
}

/** Set ID chapter yang sudah dibaca untuk komik tertentu (dari cookie) */
export function getReadChapterIds(comicIdOrSlug: string): Set<string> {
  const history = getCookieHistory();
  const readIds = new Set<string>();
  history.forEach((h) => {
    if (h.comic_id === comicIdOrSlug || h.comic?.slug === comicIdOrSlug) {
      if (h.chapter_id) readIds.add(h.chapter_id);
    }
  });
  return readIds;
}

/** Set nomor chapter yang sudah dibaca untuk komik tertentu (dari cookie) */
export function getReadChapterNumbers(comicIdOrSlug: string): Set<number> {
  const history = getCookieHistory();
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

/** Chapter terakhir yang dibaca untuk komik tertentu */
export function getLastReadChapter(comicIdOrSlug: string): ReadingHistoryItem | null {
  const history = getCookieHistory();
  return (
    history.find(
      (h) => h.comic_id === comicIdOrSlug || h.comic?.slug === comicIdOrSlug
    ) || null
  );
}

/** Apakah chapter tertentu sudah dibaca? */
export function isChapterRead(chapterIdOrNum: string | number, comicIdOrSlug?: string): boolean {
  const history = getCookieHistory();
  return history.some((h) => {
    if (comicIdOrSlug && h.comic_id !== comicIdOrSlug && h.comic?.slug !== comicIdOrSlug) {
      return false;
    }
    if (typeof chapterIdOrNum === 'number') {
      return h.chapter?.chapter_number === chapterIdOrNum;
    }
    return (
      h.chapter_id === chapterIdOrNum ||
      h.chapter?.chapter_number === Number(chapterIdOrNum)
    );
  });
}

/** Riwayat per komik (grouped) dari cookie */
export function getHistoryGroupedByComic(): GroupedComicHistory[] {
  const history = getCookieHistory();
  const map = new Map<string, GroupedComicHistory>();

  for (const item of history) {
    const key = item.comic_id || item.comic?.slug || '';
    if (!key) continue;
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
      // Update latestChapter jika chapter number lebih besar
      if (item.chapter.chapter_number > existing.latestChapter.chapter_number) {
        existing.latestChapter = item.chapter;
      }
    }
  }

  return Array.from(map.values());
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Hapus 1 item dari cookie guest history */
export function removeGuestHistoryItem(historyIdOrChapterId: string): void {
  const history = getCookieHistory();
  const filtered = history.filter(
    (item) => item.id !== historyIdOrChapterId && item.chapter_id !== historyIdOrChapterId
  );
  saveCookieHistory(filtered);
}

/** Hapus semua chapter dari 1 komik di cookie guest history */
export function removeComicHistory(comicIdOrSlug: string): void {
  const history = getCookieHistory();
  const filtered = history.filter(
    (item) => item.comic_id !== comicIdOrSlug && item.comic?.slug !== comicIdOrSlug
  );
  saveCookieHistory(filtered);
}

/** Hapus seluruh cookie guest history */
export function clearGuestHistory(): void {
  clearCookieHistory();
}

// ─────────────────────────────────────────────────────────────────────────────
// MERGE: Ketika guest login, push cookie history ke Supabase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saat user baru login, ambil cookie history dan sync semuanya ke Supabase secara bulk.
 * Dipanggil dari auth callback / login success handler / navbar session listener / history page.
 */
export async function mergeGuestHistoryToSupabase(): Promise<void> {
  const cookieItems = getCookieHistory();
  if (!cookieItems || cookieItems.length === 0) return;

  try {
    const supabase = createClient();
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Siapkan payload bulk
    const payload = cookieItems.map((item) => ({
      comic_id: item.comic_id,
      chapter_id: item.chapter_id,
      comic_slug: item.comic?.slug,
      chapter_number: item.chapter?.chapter_number,
      scroll_position: item.scroll_position || 0,
      last_read_at: item.last_read_at || new Date().toISOString(),
    }));

    const res = await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: payload }),
    });

    if (res.ok) {
      const json = await res.json();
      console.log(`[History] Berhasil merge ${cookieItems.length} guest chapters ke Supabase cloud:`, json);
    }
  } catch (err) {
    console.warn('[History] mergeGuestHistoryToSupabase failed:', err);
  }
}

/**
 * Menggabungkan riwayat dari cloud (Supabase) dan lokal (Cookie).
 * Jika ada item yang sama (chapter yang sama pada komik yang sama),
 * ambil yang memiliki timestamp last_read_at paling baru.
 */
export function mergeHistoryArrays(
  cloudItems: ReadingHistoryItem[],
  cookieItems: ReadingHistoryItem[]
): ReadingHistoryItem[] {
  const map = new Map<string, ReadingHistoryItem>();

  const getItemKey = (item: ReadingHistoryItem): string => {
    if (item.chapter_id && item.chapter_id.length > 10) {
      return item.chapter_id;
    }
    const comicKey = item.comic?.slug || item.comic_id || '';
    const chNum = item.chapter?.chapter_number ?? '';
    return `${comicKey}_ch_${chNum}`;
  };

  for (const item of cloudItems) {
    const key = getItemKey(item);
    map.set(key, item);
  }

  for (const item of cookieItems) {
    const key = getItemKey(item);
    if (!map.has(key)) {
      map.set(key, item);
    } else {
      const existing = map.get(key)!;
      const existingTime = new Date(existing.last_read_at || 0).getTime();
      const itemTime = new Date(item.last_read_at || 0).getTime();
      if (itemTime > existingTime) {
        map.set(key, {
          ...existing,
          scroll_position: item.scroll_position ?? existing.scroll_position,
          last_read_at: item.last_read_at,
        });
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.last_read_at || 0).getTime() - new Date(a.last_read_at || 0).getTime()
  );
}
