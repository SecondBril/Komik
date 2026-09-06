'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import { ChapterPage } from '@/lib/types';

interface ViewerScrollProps {
  pages: ChapterPage[];
  comicTitle: string;
  chapterNumber: number;
  onScrollProgress?: (progressPercent: number) => void;
}

export const ViewerScroll: React.FC<ViewerScrollProps> = ({
  pages,
  comicTitle,
  chapterNumber,
  onScrollProgress,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) return;
      const currentProgress = Math.min(100, Math.max(0, (window.scrollY / totalHeight) * 100));
      if (onScrollProgress) {
        onScrollProgress(currentProgress);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [onScrollProgress]);

  return (
    <div
      ref={containerRef}
      className="w-full max-w-3xl mx-auto flex flex-col items-center bg-[#0B0C0F] min-h-screen py-4"
    >
      {pages.map((page, index) => (
        <div
          key={page.id || page.page_number}
          className="relative w-full aspect-[2/3] max-w-2xl bg-[#0B0C0F]"
        >
          <Image
            src={page.image_url}
            alt={`${comicTitle} - Chapter ${chapterNumber} - Halaman ${page.page_number}`}
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, 800px"
            loading={index < 3 ? 'eager' : 'lazy'}
            priority={index < 2}
            onError={(e: any) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80';
            }}
            className="object-contain"
          />
        </div>
      ))}
    </div>
  );
};
