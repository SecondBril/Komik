'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ReadingHistoryItem } from '@/lib/types';
import { getGuestHistory, removeGuestHistoryItem, clearGuestHistory } from '@/lib/queries/history';
import { formatRelativeTime } from '@/lib/utils/relative-time';
import { History, Trash2, BookOpen, Compass, Clock, CheckCircle2 } from 'lucide-react';
import { DecorativeBlobs } from '@/components/ui/DecorativeBlobs';

export default function HistoryPage() {
  const [historyItems, setHistoryItems] = useState<ReadingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const historyData = getGuestHistory();
    setHistoryItems(historyData);
    setLoading(false);
  }, []);

  const handleRemoveHistory = (comicId: string) => {
    removeGuestHistoryItem(comicId);
    setHistoryItems((prev) => prev.filter((item) => item.comic_id !== comicId));
  };

  const handleClearHistory = () => {
    if (confirm('Yakin ingin menghapus semua riwayat baca?')) {
      clearGuestHistory();
      setHistoryItems([]);
    }
  };

  return (
    <div className="relative min-h-[80vh] max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-24 flex flex-col gap-6">
      <DecorativeBlobs variant="general" />

      {/* Header Bar */}
      <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F6C945] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center">
            <History className="w-5 h-5 text-[#1A1A1A] stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#1A1A1A] tracking-tight">
              Riwayat Baca
            </h1>
            <p className="text-xs text-[#7A756D] font-medium">
              Daftar chapter komik yang baru saja kamu baca
            </p>
          </div>
        </div>

        {historyItems.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black text-[#E96379] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus Semua</span>
          </button>
        )}
      </div>

      {/* History Items Container */}
      <div className="z-10">
        {loading ? (
          <div className="py-16 text-center text-[#7A756D] font-bold">Memuat riwayat...</div>
        ) : historyItems.length === 0 ? (
          <div className="py-16 px-6 text-center bg-white rounded-[32px] border-[3px] border-[#1A1A1A] shadow-[5px_5px_0px_#1A1A1A] flex flex-col items-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-[#E6F4EA] border-2 border-[#1A1A1A] flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-[#2E7D6E] stroke-[2]" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-[#1A1A1A]">Belum Ada Riwayat Baca</h2>
            <p className="text-xs text-[#7A756D] font-medium mt-1 max-w-sm">
              Kamu belum membaca komik apapun. Buka katalog Chameleon Comics dan temukan komik seru untuk mulai membaca!
            </p>
            <Link
              href="/browse"
              className="mt-5 px-6 py-3 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-2"
            >
              <Compass className="w-4 h-4 stroke-[2.5]" />
              <span>Jelajahi Komik Sekarang</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {historyItems.map((item) => (
              <div
                key={item.comic_id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] hover:shadow-[4px_4px_0px_#1A1A1A] transition-all gap-3 group"
              >
                <Link
                  href={`/komik/${item.comic.slug}/${item.chapter.chapter_number}`}
                  className="flex items-center gap-3.5 flex-1 min-w-0"
                >
                  <div className="relative w-14 sm:w-16 aspect-[2/3] rounded-xl overflow-hidden shrink-0 border-2 border-[#1A1A1A] bg-[#FAF7F0]">
                    <Image
                      src={item.comic.cover_url}
                      alt={item.comic.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0 gap-1">
                    <h2 className="text-sm font-black text-[#1A1A1A] truncate group-hover:text-[#2E7D6E] transition-colors">
                      {item.comic.title}
                    </h2>
                    <div className="inline-flex items-center gap-1 text-xs font-black text-[#2E7D6E]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Chapter {item.chapter.chapter_number}</span>
                    </div>
                    <span className="text-[11px] text-[#7A756D] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(item.last_read_at)}
                    </span>
                  </div>
                </Link>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/komik/${item.comic.slug}/${item.chapter.chapter_number}`}
                    className="px-4 py-2 rounded-full bg-[#2E7D6E] hover:bg-[#246559] text-white text-xs font-black border border-[#1A1A1A] shadow-sm transition-all active:scale-95"
                  >
                    Lanjut
                  </Link>
                  <button
                    onClick={() => handleRemoveHistory(item.comic_id)}
                    className="p-2 text-[#8C8C8C] hover:text-[#E96379] hover:bg-[#FAF7F0] rounded-full transition-colors"
                    title="Hapus dari riwayat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
