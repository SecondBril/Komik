'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ReadingHistoryItem } from '@/lib/types';
import {
  getGuestHistory,
  getHistoryGroupedByComic,
  removeGuestHistoryItem,
  removeComicHistory,
  clearGuestHistory,
  GroupedComicHistory,
} from '@/lib/queries/history';
import { createClient } from '@/lib/supabase/client';
import { formatRelativeTime } from '@/lib/utils/relative-time';
import {
  History,
  Trash2,
  BookOpen,
  Compass,
  Clock,
  CheckCircle2,
  Layers,
  ListFilter,
  ArrowRight,
  CloudOff,
  Cloud,
  Loader2,
  LogIn,
} from 'lucide-react';
import { DecorativeBlobs } from '@/components/ui/DecorativeBlobs';

export default function HistoryPage() {
  const [historyItems, setHistoryItems] = useState<ReadingHistoryItem[]>([]);
  const [groupedComics, setGroupedComics] = useState<GroupedComicHistory[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'grouped'>('all');
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Muat data history: Supabase jika login, cookie jika guest
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          // User login: ambil dari Supabase
          setIsLoggedIn(true);
          const res = await fetch('/api/history', { cache: 'no-store' });
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const items: ReadingHistoryItem[] = json.data;
            setHistoryItems(items);
            buildGrouped(items);
          } else {
            setHistoryItems([]);
            setGroupedComics([]);
          }
          return;
        }
      }

      // Guest: baca dari cookie
      setIsLoggedIn(false);
      const cookieItems = getGuestHistory();
      setHistoryItems(cookieItems);
      setGroupedComics(getHistoryGroupedByComic());
    } catch (err) {
      console.error('[HistoryPage] Gagal memuat history:', err);
      // Fallback ke cookie
      setIsLoggedIn(false);
      const cookieItems = getGuestHistory();
      setHistoryItems(cookieItems);
      setGroupedComics(getHistoryGroupedByComic());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  function buildGrouped(items: ReadingHistoryItem[]) {
    const map = new Map<string, GroupedComicHistory>();
    for (const item of items) {
      if (!item.comic_id) continue;
      if (!map.has(item.comic_id)) {
        map.set(item.comic_id, {
          comic_id: item.comic_id,
          comic: item.comic,
          latestChapter: item.chapter,
          last_read_at: item.last_read_at,
          totalChaptersRead: 1,
          readChapters: [item],
        });
      } else {
        const g = map.get(item.comic_id)!;
        g.totalChaptersRead += 1;
        g.readChapters.push(item);
        if (item.chapter.chapter_number > g.latestChapter.chapter_number) {
          g.latestChapter = item.chapter;
        }
      }
    }
    setGroupedComics(Array.from(map.values()));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE handlers
  // ──────────────────────────────────────────────────────────────────────────

  const handleRemoveSingleItem = async (item: ReadingHistoryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsDeleting(item.id);
    try {
      if (isLoggedIn) {
        await fetch(`/api/history?chapterId=${item.chapter_id}`, { method: 'DELETE' });
      } else {
        removeGuestHistoryItem(item.id);
      }
      await loadHistory();
    } finally {
      setIsDeleting(null);
    }
  };

  const handleRemoveComic = async (group: GroupedComicHistory, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsDeleting(group.comic_id);
    try {
      if (isLoggedIn) {
        await fetch(`/api/history?comicId=${group.comic_id}`, { method: 'DELETE' });
      } else {
        removeComicHistory(group.comic_id);
      }
      await loadHistory();
    } finally {
      setIsDeleting(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Yakin ingin menghapus seluruh riwayat bacaan kamu?')) return;
    setLoading(true);
    try {
      if (isLoggedIn) {
        await fetch('/api/history', { method: 'DELETE' });
      } else {
        clearGuestHistory();
      }
      setHistoryItems([]);
      setGroupedComics([]);
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-[80vh] max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-24 flex flex-col gap-6">
      <DecorativeBlobs variant="general" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-[#1A1A1A] pb-4 gap-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F6C945] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center">
            <History className="w-5 h-5 text-[#1A1A1A] stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#1A1A1A] tracking-tight">
              Riwayat Baca
            </h1>
            <p className="text-xs text-[#7A756D] font-medium flex items-center gap-1.5">
              {isLoggedIn ? (
                <>
                  <Cloud className="w-3 h-3 text-[#2E7D6E]" />
                  <span className="text-[#2E7D6E] font-bold">Tersinkron ke cloud</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3 h-3" />
                  <span>Tersimpan lokal di perangkat ini</span>
                </>
              )}
            </p>
          </div>
        </div>

        {historyItems.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Tab View Switcher */}
            <div className="flex items-center bg-[#FAF7F0] p-1 rounded-2xl border-2 border-[#1A1A1A] shadow-sm">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  activeTab === 'all'
                    ? 'bg-[#2E7D6E] text-white shadow-[1.5px_1.5px_0px_#1A1A1A]'
                    : 'text-[#7A756D] hover:text-[#1A1A1A]'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Semua ({historyItems.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('grouped')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  activeTab === 'grouped'
                    ? 'bg-[#2E7D6E] text-white shadow-[1.5px_1.5px_0px_#1A1A1A]'
                    : 'text-[#7A756D] hover:text-[#1A1A1A]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Per Komik ({groupedComics.length})</span>
              </button>
            </div>

            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black text-[#E96379] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all"
              title="Hapus Semua Riwayat"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hapus Semua</span>
            </button>
          </div>
        )}
      </div>

      {/* Guest Banner: Ajak login */}
      {!isLoggedIn && !loading && (
        <div className="z-10 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#FFF8E1] border-2 border-[#F6C945] shadow-sm">
          <LogIn className="w-5 h-5 text-[#1A1A1A] shrink-0" />
          <p className="text-xs font-bold text-[#5C5500] flex-1">
            Riwayat hanya tersimpan di perangkat ini (cookie). Login untuk menyimpannya ke cloud dan sinkron di semua perangkat.
          </p>
          <Link
            href="/auth/login"
            className="shrink-0 px-4 py-2 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] text-xs font-black border border-[#1A1A1A] shadow-sm transition-all"
          >
            Login
          </Link>
        </div>
      )}

      {/* History Items Container */}
      <div className="z-10">
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3 text-[#7A756D]">
            <Loader2 className="w-8 h-8 animate-spin text-[#2E7D6E]" />
            <span className="text-sm font-bold">Memuat riwayat bacaan...</span>
          </div>
        ) : historyItems.length === 0 ? (
          <div className="py-16 px-6 text-center bg-white rounded-[32px] border-[3px] border-[#1A1A1A] shadow-[5px_5px_0px_#1A1A1A] flex flex-col items-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-[#E6F4EA] border-2 border-[#1A1A1A] flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-[#2E7D6E] stroke-[2]" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-[#1A1A1A]">Belum Ada Riwayat Baca</h2>
            <p className="text-xs text-[#7A756D] font-medium mt-1 max-w-sm">
              Kamu belum membaca komik apapun. Buka katalog dan temukan komik seru!
            </p>
            <Link
              href="/browse"
              className="mt-5 px-6 py-3 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-2"
            >
              <Compass className="w-4 h-4 stroke-[2.5]" />
              <span>Jelajahi Komik Sekarang</span>
            </Link>
          </div>
        ) : activeTab === 'all' ? (
          /* TAB 1: Semua Riwayat (kronologis per chapter) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {historyItems.map((item) => {
              const slug = item.comic?.slug || item.comic_id;
              const chNum = item.chapter?.chapter_number ?? 1;
              const isItemDeleting = isDeleting === item.id;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3.5 rounded-2xl bg-white border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] hover:shadow-[4px_4px_0px_#1A1A1A] transition-all gap-3 group ${
                    isItemDeleting ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <Link
                    href={`/komik/${slug}/${chNum}`}
                    className="flex items-center gap-3.5 flex-1 min-w-0"
                  >
                    <div className="relative w-14 sm:w-16 aspect-[2/3] rounded-xl overflow-hidden shrink-0 border-2 border-[#1A1A1A] bg-[#FAF7F0]">
                      {item.comic?.cover_url ? (
                        <Image
                          src={item.comic.cover_url}
                          alt={item.comic.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#F0EDE4] flex items-center justify-center">
                          <BookOpen className="w-6 h-6 text-[#C0BAB0]" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0 gap-1">
                      <h2 className="text-sm font-black text-[#1A1A1A] truncate group-hover:text-[#2E7D6E] transition-colors">
                        {item.comic?.title || 'Komik'}
                      </h2>
                      <div className="inline-flex items-center gap-1 text-xs font-black text-[#2E7D6E]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Chapter {chNum}</span>
                      </div>
                      <span className="text-[11px] text-[#7A756D] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(item.last_read_at)}
                      </span>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/komik/${slug}/${chNum}`}
                      className="px-4 py-2 rounded-full bg-[#2E7D6E] hover:bg-[#246559] text-white text-xs font-black border border-[#1A1A1A] shadow-sm transition-all active:scale-95"
                    >
                      Baca
                    </Link>
                    <button
                      onClick={(e) => handleRemoveSingleItem(item, e)}
                      className="p-2 text-[#8C8C8C] hover:text-[#E96379] hover:bg-[#FAF7F0] rounded-full transition-colors"
                      title="Hapus chapter ini dari riwayat"
                    >
                      {isItemDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TAB 2: Per Judul Komik */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {groupedComics.map((group) => {
              const slug = group.comic?.slug || group.comic_id;
              const isGroupDeleting = isDeleting === group.comic_id;
              return (
                <div
                  key={group.comic_id}
                  className={`flex items-center justify-between p-4 rounded-2xl bg-white border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] hover:shadow-[4px_4px_0px_#1A1A1A] transition-all gap-3 group ${
                    isGroupDeleting ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <Link href={`/komik/${slug}`} className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="relative w-16 aspect-[2/3] rounded-xl overflow-hidden shrink-0 border-2 border-[#1A1A1A] bg-[#FAF7F0]">
                      {group.comic?.cover_url ? (
                        <Image
                          src={group.comic.cover_url}
                          alt={group.comic.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#F0EDE4] flex items-center justify-center">
                          <BookOpen className="w-6 h-6 text-[#C0BAB0]" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0 gap-1.5">
                      <h2 className="text-sm sm:text-base font-black text-[#1A1A1A] truncate group-hover:text-[#2E7D6E] transition-colors">
                        {group.comic?.title || 'Komik'}
                      </h2>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-[#FAF7F0] border border-[#1A1A1A] text-[10px] font-black text-[#1A1A1A]">
                          {group.totalChaptersRead} Chapter Dibaca
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#2E7D6E]">
                          Terakhir: Ch. {group.latestChapter.chapter_number}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#7A756D] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(group.last_read_at)}
                      </span>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/komik/${slug}/${group.latestChapter.chapter_number}`}
                      className="px-3.5 py-2 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] text-xs font-black border border-[#1A1A1A] shadow-sm transition-all active:scale-95 flex items-center gap-1"
                    >
                      <span>Lanjut</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    <button
                      onClick={(e) => handleRemoveComic(group, e)}
                      className="p-2 text-[#8C8C8C] hover:text-[#E96379] hover:bg-[#FAF7F0] rounded-full transition-colors"
                      title="Hapus komik ini dari riwayat"
                    >
                      {isGroupDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
