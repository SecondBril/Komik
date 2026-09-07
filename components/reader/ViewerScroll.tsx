'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChapterPage } from '@/lib/types';
import { ImageOff, RefreshCw, AlertTriangle } from 'lucide-react';

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
  const [failedPages, setFailedPages] = useState<Record<number, boolean>>({});
  const [retryKeys, setRetryKeys] = useState<Record<number, number>>({});
  const [reloadingPages, setReloadingPages] = useState<Record<number, boolean>>({});

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

  const handleImageError = (index: number) => {
    setFailedPages((prev) => ({ ...prev, [index]: true }));
    setReloadingPages((prev) => ({ ...prev, [index]: false }));
  };

  const handleImageLoad = (index: number) => {
    setFailedPages((prev) => ({ ...prev, [index]: false }));
    setReloadingPages((prev) => ({ ...prev, [index]: false }));
  };

  const handleReloadPage = (index: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReloadingPages((prev) => ({ ...prev, [index]: true }));
    setFailedPages((prev) => ({ ...prev, [index]: false }));
    setRetryKeys((prev) => ({ ...prev, [index]: Date.now() }));
  };

  return (
    <div
      ref={containerRef}
      className={`w-full ${widthClass} mx-auto flex flex-col items-center bg-[#0B0C0F] min-h-screen py-2 transition-all duration-300`}
    >
      {pages.map((page, index) => {
        const isPriority = index < 2;
        const hasError = failedPages[index];
        const isReloading = reloadingPages[index];
        const retryTimestamp = retryKeys[index];

        // Build image source with cache buster if retried
        let imageSrc = page.image_url;
        if (retryTimestamp) {
          const separator = imageSrc.includes('?') ? '&' : '?';
          imageSrc = `${imageSrc}${separator}retry=${retryTimestamp}`;
        }

        return (
          <div
            key={`${page.id || page.page_number}-${retryTimestamp || 0}`}
            id={`reader-page-${index}`}
            className="w-full relative flex justify-center bg-[#0B0C0F] min-h-[300px] sm:min-h-[500px]"
          >
            {hasError ? (
              /* Fallback box with Reload button when image fails to load */
              <div className="w-full max-w-md my-8 mx-4 p-6 sm:p-8 rounded-3xl bg-[#F7F2E6] border-[3px] border-[#1A1A1A] shadow-[6px_6px_0px_#1A1A1A] flex flex-col items-center text-center gap-3 z-10">
                <div className="w-14 h-14 rounded-2xl bg-[#FFEAEA] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center text-[#C53030]">
                  <ImageOff className="w-7 h-7 stroke-[2.5]" />
                </div>

                <div className="px-3 py-1 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] text-[11px] font-black text-[#1A1A1A] shadow-sm">
                  Halaman {page.page_number}
                </div>

                <div>
                  <h4 className="text-sm sm:text-base font-black text-[#1A1A1A]">
                    Gambar Gagal Dimuat
                  </h4>
                  <p className="text-xs text-[#7A756D] font-medium mt-1 leading-relaxed max-w-xs">
                    Koneksi terputus atau gambar tidak muncul dari server. Silakan muat ulang gambar ini.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleReloadPage(index, e)}
                  disabled={isReloading}
                  className="mt-2 px-5 py-2.5 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] font-black text-xs border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#1A1A1A] transition-all flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin' : ''}`} />
                  <span>{isReloading ? 'Memuat Ulang...' : 'Muat Ulang Gambar'}</span>
                </button>
              </div>
            ) : (
              <img
                src={imageSrc}
                alt={`${comicTitle} - Chapter ${chapterNumber} - Halaman ${page.page_number}`}
                loading={isPriority ? 'eager' : 'lazy'}
                decoding="async"
                // @ts-ignore fetchpriority attribute for modern browsers
                fetchpriority={isPriority ? 'high' : 'auto'}
                onLoad={() => handleImageLoad(index)}
                onError={() => handleImageError(index)}
                className="w-full h-auto block object-contain select-none transition-opacity duration-200"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
