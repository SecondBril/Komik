'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MatureComic } from '@/lib/types';
import { Star, Flame, Skull, BookOpen } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils/relative-time';

interface MatureComicCardProps {
  comic: MatureComic;
  priority?: boolean;
}

export function MatureComicCard({ comic, priority = false }: MatureComicCardProps) {
  const latestCh = comic.latest_chapter;

  const getGoreBadgeStyle = (level: string) => {
    switch (level) {
      case 'Extreme':
        return 'bg-[#7F1D1D]/90 text-red-200 border-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
      case 'High':
        return 'bg-[#991B1B]/90 text-red-200 border-red-600/60';
      default:
        return 'bg-[#78350F]/90 text-amber-200 border-amber-500/60';
    }
  };

  return (
    <div className="group relative flex flex-col bg-[#12141C] border border-[#2B1419] hover:border-[#E53E3E] rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(229,62,62,0.2)]">
      {/* Cover Image Container */}
      <Link
        href={`/mature/komik/${comic.slug}`}
        className="relative block w-full aspect-[2/3] overflow-hidden bg-[#0A0B0E]"
      >
        <Image
          src={comic.cover_url}
          alt={comic.title}
          fill
          priority={priority}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500 brightness-95 group-hover:brightness-105"
        />

        {/* Gradient Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#12141C] via-transparent to-black/40 opacity-90 group-hover:opacity-75 transition-opacity" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5 z-10 pointer-events-none">
          {/* Comic Type Badge */}
          <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-black uppercase tracking-wider text-gray-200 border border-white/10">
            {comic.type}
          </span>

          {/* Gore Level Badge */}
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border backdrop-blur-sm flex items-center gap-1 ${getGoreBadgeStyle(
              comic.gore_level
            )}`}
          >
            <Skull className="w-3 h-3" />
            <span>{comic.gore_level} Gore</span>
          </span>
        </div>

        {/* Bottom Rating on Image */}
        <div className="absolute bottom-2 left-2.5 z-10 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm border border-amber-500/30 text-amber-300 text-[11px] font-bold">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span>{Number(comic.rating).toFixed(1)}</span>
        </div>
      </Link>

      {/* Info Body */}
      <div className="p-3 sm:p-3.5 flex flex-col flex-1 justify-between gap-2">
        <div className="flex flex-col gap-1">
          {/* Title */}
          <Link
            href={`/mature/komik/${comic.slug}`}
            className="font-black text-sm text-white group-hover:text-[#EF4444] transition-colors line-clamp-1 leading-snug"
            title={comic.title}
          >
            {comic.title}
          </Link>

          {/* Genres (first 2) */}
          {comic.genres && comic.genres.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {comic.genres.slice(0, 2).map((g) => (
                <span
                  key={g.id}
                  className="text-[10px] font-medium text-gray-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Latest Chapter Bar */}
        {latestCh ? (
          <Link
            href={`/mature/komik/${comic.slug}/${latestCh.chapter_number}`}
            className="mt-1 pt-2 border-t border-white/5 flex items-center justify-between text-xs text-gray-300 hover:text-[#EF4444] transition-colors"
          >
            <div className="flex items-center gap-1 font-bold truncate">
              <BookOpen className="w-3.5 h-3.5 text-[#E53E3E] shrink-0" />
              <span className="truncate">Ch. {latestCh.chapter_number}</span>
            </div>
            <span className="text-[10px] text-gray-500 shrink-0 ml-1">
              {formatRelativeTime(latestCh.released_at)}
            </span>
          </Link>
        ) : (
          <div className="mt-1 pt-2 border-t border-white/5 text-[11px] text-gray-500 italic">
            Belum ada chapter
          </div>
        )}
      </div>
    </div>
  );
}
