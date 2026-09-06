'use client';

import React, { useEffect, useRef } from 'react';
import { ChapterPage } from '@/lib/types';

interface ViewerScrollProps {
  pages: ChapterPage[];
  comicTitle: string;
  chapterNumber: number;
  containerWidth?: 'normal' | 'large' | 'full';
  onScrollProgress?: (progressPercent: number) => void;
}

export const ViewerScroll: React.FC<ViewerScrollProps> = ({
  pages,
  comicTitle,
  chapterNumber,
  containerWidth = 'large',
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

  const widthClass = {
    normal: 'max-w-3xl',
    large: 'max-w-5xl',
    full: 'max-w-full px-0',
  }[containerWidth];

  return (
    <div
      ref={containerRef}
      className={`w-full ${widthClass} mx-auto flex flex-col items-center bg-[#0B0C0F] min-h-screen py-2 transition-all duration-300`}
    >
      {pages.map((page, index) => (
        <div
          key={page.id || page.page_number}
          className="w-full relative flex justify-center bg-[#0B0C0F]"
        >
          <img
            src={page.image_url}
            alt={`${comicTitle} - Chapter ${chapterNumber} - Halaman ${page.page_number}`}
            loading={index < 3 ? 'eager' : 'lazy'}
            onError={(e: any) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80';
            }}
            className="w-full h-auto block object-contain select-none transition-opacity duration-200"
          />
        </div>
      ))}
    </div>
  );
};

