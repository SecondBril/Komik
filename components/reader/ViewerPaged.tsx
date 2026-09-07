'use client';

import React, { useState, useEffect } from 'react';
import { ChapterPage } from '@/lib/types';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface ViewerPagedProps {
  pages: ChapterPage[];
  comicTitle: string;
  chapterNumber: number;
}

export const ViewerPaged: React.FC<ViewerPagedProps> = ({
  pages,
  comicTitle,
  chapterNumber,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // Intelligent preloader: preloads next 2 pages and previous page into browser RAM/cache
  useEffect(() => {
    if (!pages || pages.length === 0) return;

    const indicesToPreload = [
      currentPageIndex + 1,
      currentPageIndex + 2,
      currentPageIndex - 1,
    ].filter((i) => i >= 0 && i < pages.length);

    indicesToPreload.forEach((idx) => {
      const page = pages[idx];
      if (page?.image_url) {
        const img = new Image();
        img.decoding = 'async';
        img.src = page.image_url;
      }
    });
  }, [currentPageIndex, pages]);

  if (!pages || pages.length === 0) {
    return <div className="text-center py-12 text-[#9AA0AC]">Tidak ada halaman gambar.</div>;
  }

  const currentPage = pages[currentPageIndex];

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setIsImageLoaded(false);
      setCurrentPageIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    if (currentPageIndex < pages.length - 1) {
      setIsImageLoaded(false);
      setCurrentPageIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[85vh] py-4 bg-[#0B0C0F]">
      {/* Page indicator pill */}
      <div className="mb-3 px-3 py-1 rounded-full bg-[#171A21] border border-[#2A2F3A] text-xs font-semibold text-[#F2F3F5]">
        Halaman {currentPageIndex + 1} / {pages.length}
      </div>

      {/* Main Single Page Image Container */}
      <div
        className="relative w-full flex justify-center items-center cursor-pointer min-h-[500px]"
        onClick={handleNextPage}
      >
        {!isImageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#171A21]/30 rounded-md">
            <Loader2 className="w-6 h-6 text-[#7C5CFC] animate-spin" />
          </div>
        )}

        <img
          key={currentPage.image_url}
          src={currentPage.image_url}
          alt={`${comicTitle} - Chapter ${chapterNumber} - Halaman ${currentPage.page_number}`}
          decoding="async"
          // @ts-ignore fetchpriority is valid in modern browsers
          fetchpriority="high"
          onLoad={() => setIsImageLoaded(true)}
          onError={(e: any) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80';
            setIsImageLoaded(true);
          }}
          className={`max-h-[85vh] w-auto max-w-full h-auto object-contain rounded-md shadow-2xl transition-opacity duration-150 ${
            isImageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>

      {/* Page controls */}
      <div className="flex items-center gap-4 mt-6">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handlePrevPage();
          }}
          disabled={currentPageIndex === 0}
          className="px-4 py-2 rounded-xl bg-[#171A21] border border-[#2A2F3A] text-xs font-bold text-[#F2F3F5] hover:border-[#7C5CFC] disabled:opacity-30 disabled:hover:border-[#2A2F3A] flex items-center gap-1 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          Sebelumnya
        </button>

        <span className="text-xs text-[#9AA0AC] font-medium">
          {currentPageIndex + 1} of {pages.length}
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleNextPage();
          }}
          disabled={currentPageIndex === pages.length - 1}
          className="px-4 py-2 rounded-xl bg-[#7C5CFC] text-white text-xs font-bold hover:bg-[#6A47F0] disabled:opacity-30 flex items-center gap-1 transition-all shadow-md shadow-[#7C5CFC]/20"
        >
          Selanjutnya
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
