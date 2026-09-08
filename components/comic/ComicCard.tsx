'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Comic } from '@/lib/types';
import { TypeBadge, StatusBadge } from '@/components/ui/Badge';
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
      className="group flex flex-col rounded-2xl overflow-hidden bg-white border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] hover:shadow-[5px_5px_0px_#1A1A1A] hover:-translate-y-0.5 transition-all duration-150"
    >
      {/* Cover Image Container (2:3 aspect ratio) */}
      <div className="relative w-full aspect-[2/3] overflow-hidden bg-[#FAF7F0] border-b-2 border-[#1A1A1A]">
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
        
        {/* Top Badges (Type on left, Status on right) */}
        <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 right-1.5 sm:right-2 flex items-center justify-between gap-1 z-10 pointer-events-none">
          <TypeBadge type={comic.type} size="sm" />
          {comic.status && (
            <StatusBadge status={comic.status} size="sm" />
          )}
        </div>

        {/* Rating overlay badge in Yellow Pill */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F6C945] border border-[#1A1A1A] text-[11px] font-extrabold text-[#1A1A1A] shadow-sm">
          <Star className="w-3 h-3 fill-[#1A1A1A] stroke-none" />
          <span>{comic.rating.toFixed(1)}</span>
        </div>
      </div>

      {/* Comic Content Info */}
      <div className="p-3 flex flex-col justify-between flex-grow gap-2">
        <h3 className="text-sm font-extrabold text-[#1A1A1A] line-clamp-2 leading-snug group-hover:text-[#2E7D6E] transition-colors">
          {comic.title}
        </h3>

        <div className="flex items-center justify-between text-xs text-[#7A756D] pt-1.5 border-t border-[#E8E3D7]">
          <span className="font-bold text-[#1A1A1A] bg-[#F7F2E6] px-2 py-0.5 rounded-full border border-[#D9D3C5] text-[11px]">
            {comic.latest_chapter ? `Ch. ${comic.latest_chapter.chapter_number}` : 'Ch. 1'}
          </span>
          <span className="text-[11px] font-medium">
            {comic.latest_chapter ? formatRelativeTime(comic.latest_chapter.released_at) : 'Baru'}
          </span>
        </div>
      </div>
    </Link>
  );
};
