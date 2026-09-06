'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Chapter } from '@/lib/types';
import { ChevronLeft, ChevronRight, ArrowLeft, MoreVertical, ListOrdered, Smartphone, LayoutList } from 'lucide-react';

interface ChapterNavProps {
  comicSlug: string;
  comicTitle: string;
  currentChapterNumber: number;
  allChapters: Chapter[];
  readMode: 'scroll' | 'paged';
  onToggleReadMode: (mode: 'scroll' | 'paged') => void;
}

export const ChapterNav: React.FC<ChapterNavProps> = ({
  comicSlug,
  comicTitle,
  currentChapterNumber,
  allChapters,
  readMode,
  onToggleReadMode,
}) => {
  const router = useRouter();
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isJumpModalOpen, setIsJumpModalOpen] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Auto-hide header on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 80 && currentScrollY > lastScrollY) {
        setIsHeaderVisible(false);
      } else {
        setIsHeaderVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Find previous and next chapters
  const sortedChapters = [...allChapters].sort((a, b) => a.chapter_number - b.chapter_number);
  const currentIndex = sortedChapters.findIndex((ch) => ch.chapter_number === currentChapterNumber);

  const prevChapter = currentIndex > 0 ? sortedChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < sortedChapters.length - 1 ? sortedChapters[currentIndex + 1] : null;

  return (
    <>
      {/* Auto-Hiding Top Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 bg-[#171A21]/95 backdrop-blur-md border-b border-[#2A2F3A] transition-transform duration-300 ${
          isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3 text-[#F2F3F5]">
          <Link
            href={`/komik/${comicSlug}`}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#9AA0AC] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Kembali</span>
          </Link>

          {/* Title & Quick Jump Selector */}
          <div className="flex items-center gap-2 max-w-[60%]">
            <h1 className="text-xs sm:text-sm font-bold truncate">{comicTitle}</h1>
            <button
              type="button"
              onClick={() => setIsJumpModalOpen(!isJumpModalOpen)}
              className="px-2.5 py-1 rounded-lg bg-[#1F232C] border border-[#2A2F3A] text-xs font-bold text-[#7C5CFC] hover:bg-[#7C5CFC]/10 transition-colors flex items-center gap-1 shrink-0"
            >
              Ch. {currentChapterNumber}
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Menu Options (Read Mode Toggle) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1.5 rounded-lg text-[#9AA0AC] hover:text-white hover:bg-[#1F232C] transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-10 w-52 bg-[#171A21] border border-[#2A2F3A] rounded-xl shadow-2xl py-2 z-50 animate-fade-in">
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#9AA0AC]">
                  Mode Baca
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onToggleReadMode('scroll');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${
                    readMode === 'scroll' ? 'text-[#7C5CFC] font-bold bg-[#1F232C]' : 'text-[#9AA0AC] hover:text-white'
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
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${
                    readMode === 'paged' ? 'text-[#7C5CFC] font-bold bg-[#1F232C]' : 'text-[#9AA0AC] hover:text-white'
                  }`}
                >
                  <LayoutList className="w-4 h-4" />
                  Page-by-Page (Manga)
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Quick Jump Modal */}
      {isJumpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#171A21] border border-[#2A2F3A] rounded-2xl w-full max-w-sm max-h-[70vh] flex flex-col p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A2F3A]">
              <h3 className="text-sm font-bold text-[#F2F3F5]">Pilih Chapter</h3>
              <button
                type="button"
                onClick={() => setIsJumpModalOpen(false)}
                className="text-xs text-[#9AA0AC] hover:text-white"
              >
                Tutup
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[#2A2F3A] my-2 pr-1">
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
                    className={`w-full text-left py-2.5 px-2 flex items-center justify-between text-xs transition-colors ${
                      ch.chapter_number === currentChapterNumber
                        ? 'text-[#7C5CFC] font-bold bg-[#7C5CFC]/10 rounded-lg'
                        : 'text-[#9AA0AC] hover:text-white'
                    }`}
                  >
                    <span>Chapter {ch.chapter_number}</span>
                    {ch.title && <span className="text-[11px] text-[#5B616D] truncate max-w-[150px]">{ch.title}</span>}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Always Visible Fixed Floating Bottom Navigation Bar */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-[#171A21]/95 border border-[#2A2F3A] backdrop-blur-md rounded-full shadow-2xl px-4 py-2 flex items-center gap-3 text-[#F2F3F5]">
        {prevChapter ? (
          <Link
            href={`/komik/${comicSlug}/${prevChapter.chapter_number}`}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#1F232C] hover:bg-[#7C5CFC] hover:text-white text-xs font-semibold text-[#9AA0AC] transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Ch. {prevChapter.chapter_number}</span>
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-xs text-[#5B616D] cursor-not-allowed">Ch. Awal</span>
        )}

        <span className="text-xs font-bold text-[#7C5CFC] px-1">Ch. {currentChapterNumber}</span>

        {nextChapter ? (
          <Link
            href={`/komik/${comicSlug}/${nextChapter.chapter_number}`}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[#7C5CFC] hover:bg-[#6A47F0] text-white text-xs font-bold transition-all shadow-md shadow-[#7C5CFC]/20"
          >
            <span>Ch. {nextChapter.chapter_number}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-xs text-[#5B616D] cursor-not-allowed">Ch. Terbaru</span>
        )}
      </nav>
    </>
  );
};
