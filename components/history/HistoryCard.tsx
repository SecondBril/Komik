'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ReadingHistoryItem } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils/relative-time';
import { ArrowRight, Trash2, Sparkles } from 'lucide-react';

interface HistoryCardProps {
  item: ReadingHistoryItem;
  onRemove: (comicId: string) => void;
}

export const HistoryCard: React.FC<HistoryCardProps> = ({ item, onRemove }) => {
  const { comic, chapter, last_read_at, has_new_chapter } = item;

  return (
    <div className="relative flex items-center gap-4 p-4 rounded-xl bg-[#171A21] border border-[#2A2F3A] hover:border-[#7C5CFC]/40 transition-all">
      {/* Cover Image */}
      <Link href={`/komik/${comic.slug}`} className="relative w-16 h-24 rounded-lg overflow-hidden shrink-0 bg-[#1F232C]">
        <Image src={comic.cover_url} alt={comic.title} fill className="object-cover" />
      </Link>

      {/* Info details */}
      <div className="flex flex-col justify-between flex-1 min-w-0 gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/komik/${comic.slug}`} className="text-sm sm:text-base font-bold text-[#F2F3F5] hover:text-[#7C5CFC] truncate transition-colors">
            {comic.title}
          </Link>

          {/* Badge Chapter Baru! */}
          {has_new_chapter && (
            <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold animate-pulse">
              <Sparkles className="w-3 h-3" />
              Baru!
            </span>
          )}
        </div>

        <p className="text-xs text-[#9AA0AC]">
          Terakhir: <span className="text-[#F2F3F5] font-semibold">Ch. {chapter.chapter_number}</span> · {formatRelativeTime(last_read_at)}
        </p>

        {/* Action Controls */}
        <div className="flex items-center gap-3 pt-2">
          <Link
            href={`/komik/${comic.slug}/${chapter.chapter_number}`}
            className="px-3.5 py-1.5 rounded-lg bg-[#7C5CFC] hover:bg-[#6A47F0] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-[#7C5CFC]/20"
          >
            <span>Lanjut Baca</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <button
            type="button"
            onClick={() => onRemove(comic.id)}
            className="p-1.5 rounded-lg text-[#5B616D] hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="Hapus dari Riwayat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
