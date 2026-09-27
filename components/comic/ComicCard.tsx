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

const getOptimizedCoverUrl = (url: string) => {
  if (!url) return 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80';
  if (url.includes('ik.imagekit.io') && !url.includes('tr=')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}tr=w-320,q-80,f-auto`;
  }
  return url;
};

export const ComicCard: React.FC<ComicCardProps> = ({ comic, priority = false }) => {
  const coverSrc = getOptimizedCoverUrl(comic.cover_url);

  return (
    <Link
      href={`/komik/${comic.slug}`}
      className="group flex flex-col rounded-xl sm:rounded-2xl overflow-hidden bg-white border-[1.5px] sm:border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] sm:shadow-[3px_3px_0px_#1A1A1A] hover:shadow-[5px_5px_0px_#1A1A1A] hover:-translate-y-0.5 transition-all duration-150"
    >
      {/* Cover Image Container (2:3 aspect ratio) */}
      <div className="relative w-full aspect-[2/3] overflow-hidden bg-[#FAF7F0] border-b-[1.5px] sm:border-b-2 border-[#1A1A1A]">
        <Image
          src={coverSrc}
          alt={`${comic.title} Cover`}
          fill
          quality={70}
          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 30vw, 180px"
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          decoding="async"
          onError={(e: any) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';
          }}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Top Badges (Type on left, Status on right) */}
        <div className="absolute top-1 sm:top-2 left-1 sm:left-2 right-1 sm:right-2 flex items-center justify-between gap-0.5 sm:gap-1 z-10 pointer-events-none">
          <TypeBadge type={comic.type} size="sm" />
          {comic.status && (
            <StatusBadge status={comic.status} size="sm" className="hidden min-[380px]:inline-flex sm:inline-flex" />
          )}
        </div>

        {/* Rating overlay badge in Yellow Pill */}
        <div className="absolute bottom-1 sm:bottom-2 right-1 sm:right-2 flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-[#F6C945] border border-[#1A1A1A] text-[9px] sm:text-[11px] font-extrabold text-[#1A1A1A] shadow-sm">
          <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-[#1A1A1A] stroke-none" />
          <span>{comic.rating.toFixed(1)}</span>
        </div>
      </div>

      {/* Comic Content Info */}
      <div className="p-1.5 sm:p-3 flex flex-col justify-between flex-grow gap-1 sm:gap-2">
        <h3 className="text-[11px] sm:text-sm font-extrabold text-[#1A1A1A] line-clamp-2 leading-tight sm:leading-snug group-hover:text-[#2E7D6E] transition-colors">
          {comic.title}
        </h3>

        <div className="flex items-center justify-between text-[9px] sm:text-xs text-[#7A756D] pt-1 sm:pt-1.5 border-t border-[#E8E3D7]">
          <span className="font-bold text-[#1A1A1A] bg-[#F7F2E6] px-1 sm:px-2 py-0.5 rounded-full border border-[#D9D3C5] text-[9px] sm:text-[11px] truncate max-w-[55px] sm:max-w-none">
            {comic.latest_chapter ? `Ch. ${comic.latest_chapter.chapter_number}` : 'Ch. 1'}
          </span>
          <span className="text-[9px] sm:text-[11px] font-medium truncate max-w-[45px] sm:max-w-none text-right">
            {comic.latest_chapter ? formatRelativeTime(comic.latest_chapter.released_at) : 'Baru'}
          </span>
        </div>
      </div>
    </Link>
  );
};
