'use client';

import React, { useState, useEffect } from 'react';
import { ChapterPage } from '@/lib/types';
import { ChevronLeft, ChevronRight, Loader2, Sparkles, ImageOff, RefreshCw } from 'lucide-react';

interface ViewerPagedProps {
  pages: ChapterPage[];
  comicTitle: string;
  chapterNumber: number;
  currentPageIndex?: number;
  onPageChange?: (index: number) => void;
}

export const ViewerPaged: React.FC<ViewerPagedProps> = ({
  pages,
  comicTitle,
  chapterNumber,
  currentPageIndex: controlledPageIndex,
  onPageChange,
}) => {
  const [internalPageIndex, setInternalPageIndex] = useState(0);
  const currentPageIndex = controlledPageIndex !== undefined ? controlledPageIndex : internalPageIndex;

  const updatePageIndex = (newIdx: number) => {
    if (onPageChange) {
      onPageChange(newIdx);
    } else {
      setInternalPageIndex(newIdx);
    }
  };

  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [retryTimestamp, setRetryTimestamp] = useState<number | null>(null);

  // Reset states when changing page index
  useEffect(() => {
    setIsImageLoaded(false);
    setHasError(false);
    setIsReloading(false);
    setRetryTimestamp(null);
  }, [currentPageIndex]);

  // Intelligent preloader
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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        handleNextPage();
      } else if (e.key === 'ArrowLeft') {
        handlePrevPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPageIndex, pages.length]);

  if (!pages || pages.length === 0) {
    return null;
  }

  const currentPage = pages[currentPageIndex] || pages[0];

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      updatePageIndex(currentPageIndex - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    if (currentPageIndex < pages.length - 1) {
      updatePageIndex(currentPageIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleReload = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsReloading(true);
    setHasError(false);
    setIsImageLoaded(false);
    setRetryTimestamp(Date.now());
  };

  // Build current image source with retry timestamp if active
  let currentImageSrc = currentPage.image_url;
  if (retryTimestamp) {
    const separator = currentImageSrc.includes('?') ? '&' : '?';
    currentImageSrc = `${currentImageSrc}${separator}retry=${retryTimestamp}`;
  }

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[85vh] py-6 select-none">
      {/* Neo-Comic Page Indicator Pill */}
      <div className="mb-4 px-4 py-1.5 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>
          Halaman {currentPageIndex + 1} dari {pages.length}
        </span>
      </div>

      {/* Main Single Page Image Container */}
      <div
        className="relative w-full flex justify-center items-center cursor-pointer min-h-[500px]"
        onClick={handleNextPage}
      >
        {/* Loading Spinner */}
        {!isImageLoaded && !hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/10 rounded-2xl gap-2">
            <Loader2 className="w-8 h-8 text-[#F6C945] animate-spin" />
            <span className="text-xs font-bold text-white/80">
              {isReloading ? 'Memuat ulang gambar...' : 'Memuat halaman...'}
            </span>
          </div>
        )}

        {/* Failed image fallback box */}
        {hasError ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md my-8 mx-4 p-6 sm:p-8 rounded-3xl bg-[#F7F2E6] border-[3px] border-[#1A1A1A] shadow-[6px_6px_0px_#1A1A1A] flex flex-col items-center text-center gap-3 z-10"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#FFEAEA] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center text-[#C53030]">
              <ImageOff className="w-7 h-7 stroke-[2.5]" />
            </div>

            <div className="px-3 py-1 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] text-[11px] font-black text-[#1A1A1A] shadow-sm">
              Halaman {currentPage.page_number}
            </div>

            <div>
              <h4 className="text-sm sm:text-base font-black text-[#1A1A1A]">
                Gambar Gagal Dimuat
              </h4>
              <p className="text-xs text-[#7A756D] font-medium mt-1 leading-relaxed max-w-xs">
                Gambar halaman ini tidak muncul dari server. Silakan muat ulang.
              </p>
            </div>

            <button
              type="button"
              onClick={handleReload}
              disabled={isReloading}
              className="mt-2 px-5 py-2.5 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] font-black text-xs border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#1A1A1A] transition-all flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin' : ''}`} />
              <span>{isReloading ? 'Memuat Ulang...' : 'Muat Ulang Gambar'}</span>
            </button>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden border-[3px] border-[#1A1A1A] shadow-[6px_6px_0px_#1A1A1A] bg-white">
            <img
              key={`${currentPage.image_url}-${retryTimestamp || 0}`}
              src={currentImageSrc}
              alt={`${comicTitle} - Chapter ${chapterNumber} - Halaman ${currentPage.page_number}`}
              decoding="async"
              // @ts-ignore fetchpriority is valid in modern browsers
              fetchpriority="high"
              onLoad={() => {
                setIsImageLoaded(true);
                setHasError(false);
                setIsReloading(false);
              }}
              onError={() => {
                setHasError(true);
                setIsImageLoaded(false);
                setIsReloading(false);
              }}
              className={`max-h-[85vh] w-auto max-w-full h-auto object-contain transition-opacity duration-150 ${
                isImageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </div>
        )}
      </div>

      {/* Neo-Comic Page Controls */}
      <div className="flex items-center gap-3 sm:gap-4 mt-6">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handlePrevPage();
          }}
          disabled={currentPageIndex === 0}
          className="px-4 sm:px-5 py-2.5 rounded-full bg-white border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] hover:bg-[#FAF7F0] disabled:opacity-40 disabled:cursor-not-allowed shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] flex items-center gap-1.5 transition-all"
        >
          <ChevronLeft className="w-4 h-4 stroke-[3]" />
          <span>Sebelumnya</span>
        </button>

        <span className="px-3.5 py-1.5 rounded-full bg-white border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-sm">
          {currentPageIndex + 1} / {pages.length}
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleNextPage();
          }}
          disabled={currentPageIndex === pages.length - 1}
          className="px-4 sm:px-5 py-2.5 rounded-full bg-[#2E7D6E] hover:bg-[#236357] text-white border-2 border-[#1A1A1A] text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] flex items-center gap-1.5 transition-all"
        >
          <span>Selanjutnya</span>
          <ChevronRight className="w-4 h-4 stroke-[3]" />
        </button>
      </div>
    </div>
  );
};
