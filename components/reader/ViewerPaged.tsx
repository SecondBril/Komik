'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ChapterPage } from '@/lib/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

  if (!pages || pages.length === 0) {
    return <div className="text-center py-12 text-[#9AA0AC]">Tidak ada halaman gambar.</div>;
  }

  const currentPage = pages[currentPageIndex];

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[80vh] py-4 bg-[#0B0C0F]">
      {/* Page indicator pill */}
      <div className="mb-3 px-3 py-1 rounded-full bg-[#171A21] border border-[#2A2F3A] text-xs font-semibold text-[#F2F3F5]">
        Halaman {currentPageIndex + 1} / {pages.length}
      </div>

      {/* Main Single Page Image */}
      <div
        className="relative w-full max-w-2xl aspect-[2/3] bg-[#0F1115] rounded-lg overflow-hidden cursor-pointer shadow-2xl"
        onClick={handleNextPage}
      >
        <Image
          src={currentPage.image_url}
          alt={`${comicTitle} - Chapter ${chapterNumber} - Halaman ${currentPage.page_number}`}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, 800px"
          priority
          onError={(e: any) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80';
          }}
          className="object-contain"
        />
      </div>

      {/* Page controls */}
      <div className="flex items-center gap-4 mt-6">
        <button
          type="button"
          onClick={handlePrevPage}
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
          onClick={handleNextPage}
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
