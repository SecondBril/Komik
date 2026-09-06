'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Comic } from '@/lib/types';
import { TypeBadge } from '@/components/ui/Badge';
import { formatRelativeTime } from '@/lib/utils/relative-time';
import { Star } from 'lucide-react';

interface ComicCardProps {
  comic: Comic;
  priority?: boolean;
}

export const ComicCard: React.FC<ComicCardProps> = ({ comic, priority = false }) => {
  return (
    <Link
      href={`/komik/${comic.slug}`}
      className="group flex flex-col rounded-xl overflow-hidden bg-[#171A21] border border-[#2A2F3A] hover:border-[#7C5CFC]/50 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#7C5CFC]/10"
    >
      {/* Cover Image Container (2:3 aspect ratio) */}
      <div className="relative w-full aspect-[2/3] overflow-hidden bg-[#1F232C]">
        <Image
          src={comic.cover_url}
          alt={`${comic.title} Cover`}
          fill
          unoptimized
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          priority={priority}
          onError={(e: any) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';
          }}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
          <TypeBadge type={comic.type} />
        </div>

        {/* Rating overlay badge */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[11px] font-bold text-amber-400">
          <Star className="w-3 h-3 fill-amber-400 stroke-none" />
          <span>{comic.rating.toFixed(1)}</span>
        </div>
      </div>

      {/* Comic Content Info */}
      <div className="p-3 flex flex-col justify-between flex-grow gap-2">
        <h3 className="text-sm sm:text-base font-semibold text-[#F2F3F5] line-clamp-2 leading-snug group-hover:text-[#7C5CFC] transition-colors">
          {comic.title}
        </h3>

        <div className="flex items-center justify-between text-xs text-[#9AA0AC] pt-1 border-t border-[#2A2F3A]/60">
          <span className="font-medium text-[#F2F3F5]/90">
            {comic.latest_chapter ? `Ch. ${comic.latest_chapter.chapter_number}` : 'Ch. 1'}
          </span>
          <span className="text-[11px]">
            {comic.latest_chapter ? formatRelativeTime(comic.latest_chapter.released_at) : 'Baru'}
          </span>
        </div>
      </div>
    </Link>
  );
};
