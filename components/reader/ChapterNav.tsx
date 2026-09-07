'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Chapter } from '@/lib/types';
import { ChevronLeft, ChevronRight, ArrowLeft, MoreVertical, ListOrdered, Smartphone, LayoutList, X } from 'lucide-react';

interface ChapterNavProps {
  comicSlug: string;
  comicTitle: string;
  currentChapterNumber: number;
  allChapters: Chapter[];
  readMode: 'scroll' | 'paged';
  onToggleReadMode: (mode: 'scroll' | 'paged') => void;
  containerWidth?: 'normal' | 'large' | 'full';
  onToggleContainerWidth?: (width: 'normal' | 'large' | 'full') => void;
  isVisible?: boolean;
}

export const ChapterNav: React.FC<ChapterNavProps> = ({
  comicSlug,
  comicTitle,
  currentChapterNumber,
  allChapters,
  readMode,
  onToggleReadMode,
  containerWidth = 'large',
  onToggleContainerWidth,
  isVisible: externalIsVisible,
}) => {
  const router = useRouter();
  const [internalIsVisible, setInternalIsVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isJumpModalOpen, setIsJumpModalOpen] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Auto-hide header on scroll down, show on scroll up
  useEffect(() => {
    if (externalIsVisible !== undefined) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 50 && currentScrollY > lastScrollY) {
        setInternalIsVisible(false);
      } else {
        setInternalIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, externalIsVisible]);

  const isNavVisible = externalIsVisible !== undefined ? externalIsVisible : internalIsVisible;

  // Find previous and next chapters
  const sortedChapters = [...allChapters].sort((a, b) => a.chapter_number - b.chapter_number);
  const currentIndex = sortedChapters.findIndex((ch) => ch.chapter_number === currentChapterNumber);

  const prevChapter = currentIndex > 0 ? sortedChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < sortedChapters.length - 1 ? sortedChapters[currentIndex + 1] : null;

  return (
    <>
      {/* Auto-Hiding Top Header in Neo-Comic Style */}
      <header
        onClick={(e) => e.stopPropagation()}
        className={`fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b-2 border-[#1A1A1A] transition-all duration-300 ${
          isNavVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3 text-[#1A1A1A]">
          <Link
            href={`/komik/${comicSlug}`}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F7F2E6] hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black shadow-[2px_2px_0px_#1A1A1A] transition-all active:translate-x-[1px] active:translate-y-[1px]"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Kembali</span>
          </Link>

          {/* Title & Quick Jump Selector */}
          <div className="flex items-center gap-2 max-w-[60%]">
            <h1 className="text-xs sm:text-sm font-black text-[#1A1A1A] truncate">{comicTitle}</h1>
            <button
              type="button"
              onClick={() => setIsJumpModalOpen(!isJumpModalOpen)}
              className="px-2.5 py-1 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] hover:bg-[#EDB72B] transition-all flex items-center gap-1 shrink-0 active:translate-x-[1px] active:translate-y-[1px]"
            >
              <span>Ch. {currentChapterNumber}</span>
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Menu Options (Read Mode & Width Toggle) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1.5 rounded-full bg-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#1A1A1A] hover:bg-[#FAF7F0] transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-10 w-56 bg-white border-2 border-[#1A1A1A] rounded-2xl shadow-[4px_4px_0px_#1A1A1A] py-2 z-50 divide-y divide-[#E8E3D7]">
                <div>
                  <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#7A756D]">
                    Mode Baca
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleReadMode('scroll');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center gap-2 ${
                      readMode === 'scroll' ? 'text-[#2E7D6E] bg-[#E6F4EA]' : 'text-[#1A1A1A] hover:bg-[#FAF7F0]'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    Scroll Vertikal (Webtoon)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleReadMode('paged');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center gap-2 ${
                      readMode === 'paged' ? 'text-[#2E7D6E] bg-[#E6F4EA]' : 'text-[#1A1A1A] hover:bg-[#FAF7F0]'
                    }`}
                  >
                    <LayoutList className="w-4 h-4" />
                    Page-by-Page (Manga)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Chapter Jump Selector Modal */}
      {isJumpModalOpen && (
        <div
          onClick={() => setIsJumpModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[75vh] bg-[#F7F2E6] border-[3px] border-[#1A1A1A] rounded-[32px] p-5 shadow-[6px_6px_0px_#1A1A1A] flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#1A1A1A]">
              <h2 className="text-base font-black text-[#1A1A1A]">Pilih Chapter</h2>
              <button
                type="button"
                onClick={() => setIsJumpModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white border-2 border-[#1A1A1A] flex items-center justify-center text-[#1A1A1A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto my-2 pr-1 flex flex-col gap-1.5">
              {[...allChapters]
                .sort((a, b) => b.chapter_number - a.chapter_number)
                .map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setIsJumpModalOpen(false);
                      router.push(`/komik/${comicSlug}/${ch.chapter_number}`);
                    }}
                    className={`w-full text-left py-2.5 px-3 rounded-xl border-2 border-[#1A1A1A] flex items-center justify-between text-xs font-bold transition-all ${
                      ch.chapter_number === currentChapterNumber
                        ? 'bg-[#F6C945] shadow-[2px_2px_0px_#1A1A1A]'
                        : 'bg-white hover:bg-[#FAF7F0] shadow-sm'
                    }`}
                  >
                    <span>Chapter {ch.chapter_number}</span>
                    {ch.title && <span className="text-[11px] text-[#7A756D] truncate max-w-[150px]">{ch.title}</span>}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Auto-Hiding Floating Bottom Navigation Bar */}
      <nav
        onClick={(e) => e.stopPropagation()}
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white border-2 border-[#1A1A1A] rounded-full shadow-[4px_4px_0px_#1A1A1A] px-4 py-2 flex items-center gap-3 text-[#1A1A1A] transition-all duration-300 ${
          isNavVisible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-24 opacity-0 pointer-events-none'
        }`}
      >
        {prevChapter ? (
          <Link
            href={`/komik/${comicSlug}/${prevChapter.chapter_number}`}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F7F2E6] hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black shadow-[2px_2px_0px_#1A1A1A] transition-all active:translate-x-[1px] active:translate-y-[1px]"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Ch. {prevChapter.chapter_number}</span>
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-xs font-bold text-[#A6A095] cursor-not-allowed">Ch. Awal</span>
        )}

        <span className="text-xs font-black text-[#1A1A1A] px-1 bg-[#F6C945] py-1 rounded-lg border border-[#1A1A1A]">
          Ch. {currentChapterNumber}
        </span>

        {nextChapter ? (
          <Link
            href={`/komik/${comicSlug}/${nextChapter.chapter_number}`}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[#2E7D6E] hover:bg-[#236357] text-white text-xs font-black border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] transition-all active:translate-x-[1px] active:translate-y-[1px]"
          >
            <span>Ch. {nextChapter.chapter_number}</span>
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-xs font-bold text-[#A6A095] cursor-not-allowed">Ch. Terbaru</span>
        )}
      </nav>
    </>
  );
};
