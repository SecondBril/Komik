'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Chapter } from '@/lib/types';
import { ChevronLeft, ChevronRight, ArrowLeft, MoreVertical, ListOrdered, Smartphone, LayoutList, X, Search } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [lastScrollY, setLastScrollY] = useState(0);

  const currentChapterRef = useRef<HTMLButtonElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

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

  // When jump modal opens: reset search and automatically scroll to current chapter
  useEffect(() => {
    if (isJumpModalOpen) {
      setSearchQuery('');
      const timer = setTimeout(() => {
        currentChapterRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isJumpModalOpen]);

  const isNavVisible = externalIsVisible !== undefined ? externalIsVisible : internalIsVisible;

  // Find previous and next chapters
  const sortedChapters = useMemo(() => {
    return [...allChapters].sort((a, b) => a.chapter_number - b.chapter_number);
  }, [allChapters]);

  const currentIndex = sortedChapters.findIndex((ch) => ch.chapter_number === currentChapterNumber);
  const prevChapter = currentIndex > 0 ? sortedChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < sortedChapters.length - 1 ? sortedChapters[currentIndex + 1] : null;

  // Filter chapters based on search input (by chapter number or title)
  const filteredChapters = useMemo(() => {
    const descSorted = [...allChapters].sort((a, b) => b.chapter_number - a.chapter_number);
    if (!searchQuery.trim()) return descSorted;
    const q = searchQuery.toLowerCase().trim();
    return descSorted.filter((ch) => {
      const numStr = ch.chapter_number.toString();
      const matchNum =
        numStr === q ||
        numStr.startsWith(q) ||
        numStr.includes(q) ||
        `ch ${numStr}`.includes(q) ||
        `ch. ${numStr}`.includes(q) ||
        `chapter ${numStr}`.includes(q);
      const matchTitle = ch.title?.toLowerCase().includes(q);
      return matchNum || matchTitle;
    });
  }, [allChapters, searchQuery]);

  return (
    <>
      {/* Auto-Hiding Top Header in Neo-Comic Style */}
      <header
        onClick={(e) => e.stopPropagation()}
        className={`fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b-2 border-[#1A1A1A] transition-all duration-300 ${isNavVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
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
                    className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center gap-2 ${readMode === 'scroll' ? 'text-[#2E7D6E] bg-[#E6F4EA]' : 'text-[#1A1A1A] hover:bg-[#FAF7F0]'
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
                    className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center gap-2 ${readMode === 'paged' ? 'text-[#2E7D6E] bg-[#E6F4EA]' : 'text-[#1A1A1A] hover:bg-[#FAF7F0]'
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
            className="w-full max-w-md max-h-[80vh] bg-[#F7F2E6] border-[3px] border-[#1A1A1A] rounded-[32px] p-5 shadow-[6px_6px_0px_#1A1A1A] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#1A1A1A] shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-[#1A1A1A]">Pilih Chapter</h2>
                <span className="px-2 py-0.5 bg-[#FAF7F0] border border-[#1A1A1A] rounded-full text-[10px] font-black text-[#7A756D]">
                  {allChapters.length} Chapter
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsJumpModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] flex items-center justify-center text-[#1A1A1A] shadow-[1px_1px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Chapter Indicator Banner */}
            <div className="mt-3 flex items-center justify-between px-3 py-2 bg-[#E6F4EA] border-2 border-[#1A1A1A] rounded-2xl text-xs font-bold text-[#1A1A1A] shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[#7A756D]">Sedang dibaca:</span>
                <span className="font-black text-[#2E7D6E]">Chapter {currentChapterNumber}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  currentChapterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="text-[11px] font-black text-[#2E7D6E] hover:underline"
              >
                Kembali Ke Posisi
              </button>
            </div>

            {/* Search Input */}
            <div className="relative my-2.5 shrink-0">
              <Search className="w-4 h-4 text-[#7A756D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nomor chapter atau judul..."
                className="w-full pl-9 pr-8 py-2 bg-white border-2 border-[#1A1A1A] rounded-xl text-xs font-bold text-[#1A1A1A] placeholder:text-[#A6A095] focus:outline-none focus:ring-2 focus:ring-[#F6C945] shadow-[2px_2px_0px_#1A1A1A]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#FAF7F0] hover:bg-[#E8E3D7] border border-[#1A1A1A] flex items-center justify-center text-[#1A1A1A]"
                  title="Hapus pencarian"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Chapters Scrollable List */}
            <div
              ref={listContainerRef}
              className="flex-1 overflow-y-auto my-1 pr-1 flex flex-col gap-1.5 min-h-0"
            >
              {filteredChapters.length > 0 ? (
                filteredChapters.map((ch) => {
                  const isCurrent = ch.chapter_number === currentChapterNumber;
                  return (
                    <button
                      key={ch.id}
                      ref={isCurrent ? currentChapterRef : null}
                      type="button"
                      onClick={() => {
                        setIsJumpModalOpen(false);
                        router.push(`/komik/${comicSlug}/${ch.chapter_number}`);
                      }}
                      className={`w-full text-left py-2.5 px-3 rounded-xl border-2 border-[#1A1A1A] flex items-center justify-between text-xs font-bold transition-all ${isCurrent
                        ? 'bg-[#F6C945] shadow-[2px_2px_0px_#1A1A1A] ring-2 ring-[#1A1A1A]'
                        : 'bg-white hover:bg-[#FAF7F0] shadow-sm'
                        }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-black text-black">Chapter {ch.chapter_number}</span>
                        {ch.title && (
                          <span className="text-[11px] text-[#7A756D] truncate max-w-[140px] sm:max-w-[180px]">
                            {ch.title}
                          </span>
                        )}
                      </div>
                      {isCurrent && (
                        <span className="shrink-0 text-[10px] font-black bg-[#1A1A1A] text-[#F6C945] px-2 py-0.5 rounded-md uppercase tracking-wider">
                          Sedang Dibaca
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs font-bold text-[#7A756D] bg-white rounded-2xl border-2 border-dashed border-[#BFBAB0] my-2">
                  Chapter &quot;{searchQuery}&quot; tidak ditemukan.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Auto-Hiding Floating Bottom Navigation Bar */}
      <nav
        onClick={(e) => e.stopPropagation()}
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white border-2 border-[#1A1A1A] rounded-full shadow-[4px_4px_0px_#1A1A1A] px-4 py-2 flex items-center gap-3 text-[#1A1A1A] transition-all duration-300 ${isNavVisible
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
