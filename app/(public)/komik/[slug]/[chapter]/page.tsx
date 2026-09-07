'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { saveReadingHistory } from '@/lib/queries/history';
import { Comic, Chapter, ChapterPage } from '@/lib/types';
import { ViewerScroll } from '@/components/reader/ViewerScroll';
import { ViewerPaged } from '@/components/reader/ViewerPaged';
import { ChapterNav } from '@/components/reader/ChapterNav';
import { ReaderFloatingControls } from '@/components/reader/ReaderFloatingControls';
import { ChameleonMascot } from '@/components/ui/ChameleonMascot';
import {
  BookOpen,
  ChevronRight,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  ImageOff,
  RefreshCw,
} from 'lucide-react';

export default function ReadingViewerPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const chapterNo = Number(params?.chapter);

  const [comic, setComic] = useState<Comic | null>(null);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [pages, setPages] = useState<ChapterPage[]>([]);
  const [readMode, setReadMode] = useState<'scroll' | 'paged'>('scroll');
  const [containerWidth, setContainerWidth] = useState<'normal' | 'large' | 'full'>('large');
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [loading, setLoading] = useState(true);

  // Auto-scroll and Page Navigation States
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(3); // in seconds
  const [pagedCurrentIndex, setPagedCurrentIndex] = useState(0);

  // Reset auto-scroll and paged index when changing chapter
  useEffect(() => {
    setIsAutoScrolling(false);
    setPagedCurrentIndex(0);
  }, [slug, chapterNo]);

  // Auto-scroll continuous smooth execution (60fps/120fps glide without stutter)
  useEffect(() => {
    if (!isAutoScrolling || pages.length === 0) return;

    if (readMode === 'scroll') {
      let animationFrameId: number;
      let lastTimestamp: number | null = null;
      let accumulatedScroll = 0;

      const step = (timestamp: number) => {
        if (!lastTimestamp) {
          lastTimestamp = timestamp;
          animationFrameId = requestAnimationFrame(step);
          return;
        }

        const deltaMs = Math.min(timestamp - lastTimestamp, 100);
        lastTimestamp = timestamp;

        // Continuous smooth velocity:
        // autoScrollSpeed is seconds per viewport height
        const viewportHeight = window.innerHeight || 800;
        const pixelsPerSecond = viewportHeight / Math.max(1, autoScrollSpeed);
        const deltaPixels = (pixelsPerSecond * deltaMs) / 1000;

        accumulatedScroll += deltaPixels;

        // Check if reached the end of the chapter
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (window.scrollY >= maxScroll - 4) {
          setIsAutoScrolling(false);
          return;
        }

        if (accumulatedScroll >= 1) {
          const toScroll = Math.floor(accumulatedScroll);
          window.scrollBy(0, toScroll);
          accumulatedScroll -= toScroll;
        }

        animationFrameId = requestAnimationFrame(step);
      };

      animationFrameId = requestAnimationFrame(step);

      return () => {
        cancelAnimationFrame(animationFrameId);
      };
    } else {
      // In paged mode: flip page smoothly after autoScrollSpeed seconds
      const interval = setInterval(() => {
        setPagedCurrentIndex((prev) => {
          if (prev < pages.length - 1) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return prev + 1;
          } else {
            setIsAutoScrolling(false);
            return prev;
          }
        });
      }, autoScrollSpeed * 1000);

      return () => clearInterval(interval);
    }
  }, [isAutoScrolling, autoScrollSpeed, readMode, pages.length]);

  const handleScrollToFirst = () => {
    if (readMode === 'scroll') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setPagedCurrentIndex(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleScrollToLast = () => {
    if (readMode === 'scroll') {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth',
      });
    } else {
      setPagedCurrentIndex(pages.length - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Auto-hide navigation on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 50 && currentScrollY > lastScrollY) {
        setIsNavVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setIsNavVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const loadData = async () => {
    if (!slug || isNaN(chapterNo)) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/reader?slug=${encodeURIComponent(slug)}&chapter=${chapterNo}`, {
        cache: 'no-store',
      });
      const data = await res.json();

      if (data.success && data.comic && data.currentChapter) {
        setComic(data.comic);
        setReadMode(data.comic.type === 'manhwa' ? 'scroll' : 'paged');
        setCurrentChapter(data.currentChapter);
        setPages(data.pages || []);
        setAllChapters(data.allChapters || []);

        // Record reading history (Cloud & Local)
        saveReadingHistory({
          comic_id: data.comic.id,
          chapter_id: data.currentChapter.id,
        });
      }
    } catch (err) {
      console.error('[Reader] Failed to load chapter data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [slug, chapterNo]);

  // Loading Screen in Chameleon Neo-Comic Theme
  if (loading || !comic || !currentChapter) {
    return (
      <div className="fixed inset-0 bg-[#F7F2E6] z-50 flex flex-col items-center justify-center p-6 text-center">
        {/* Animated Chameleon Avatar */}
        <div className="mb-4 animate-bounce">
          <ChameleonMascot variant="avatar" size={72} />
        </div>

        {/* Loading Badge */}
        <div className="px-4 py-1.5 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] mb-3 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#1A1A1A]" />
          <span className="text-xs font-black text-[#1A1A1A]">
            Memuat Chapter {chapterNo}...
          </span>
        </div>

        <h2 className="text-lg font-black text-[#1A1A1A] max-w-xs">
          {comic ? comic.title : 'Chameleon Comics'}
        </h2>
        <p className="text-xs text-[#7A756D] font-medium mt-1">
          Menyiapkan gambar WebP hemat data untukmu...
        </p>
      </div>
    );
  }

  // Sorted chapters for next chapter navigation
  const sortedChapters = [...allChapters].sort((a, b) => a.chapter_number - b.chapter_number);
  const currentIndex = sortedChapters.findIndex((ch) => ch.chapter_number === chapterNo);
  const nextChapter = currentIndex < sortedChapters.length - 1 ? sortedChapters[currentIndex + 1] : null;

  return (
    <div
      className="min-h-screen bg-[#18181B] text-white pt-14 pb-20 select-none cursor-pointer"
      onClick={() => setIsNavVisible((prev) => !prev)}
    >
      {/* Neo-Comic Reader Header & Bottom Controls */}
      <ChapterNav
        comicSlug={slug}
        comicTitle={comic.title}
        currentChapterNumber={chapterNo}
        allChapters={allChapters}
        readMode={readMode}
        onToggleReadMode={setReadMode}
        containerWidth={containerWidth}
        onToggleContainerWidth={setContainerWidth}
        isVisible={isNavVisible}
      />

      {/* Main Reading Viewers */}
      <main className="w-full">
        {pages.length === 0 ? (
          /* Empty State: Gambar Tidak Tersedia pada Chapter ini */
          <div
            className="max-w-md mx-auto my-16 px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#F7F2E6] text-[#1A1A1A] rounded-[36px] border-[3px] border-[#1A1A1A] shadow-[8px_8px_0px_#1A1A1A] p-8 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-[#FFEAEA] border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] flex items-center justify-center text-[#C53030]">
                <ImageOff className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div className="px-3.5 py-1 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-sm">
                Chapter {chapterNo}
              </div>

              <div>
                <h3 className="text-xl font-black text-[#1A1A1A]">
                  Gambar Tidak Tersedia
                </h3>
                <p className="text-xs text-[#7A756D] font-medium mt-1.5 leading-relaxed">
                  Chapter ini belum memiliki halaman gambar komik atau gagal dimuat dari server.
                </p>
              </div>

              <div className="flex flex-col w-full gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={loadData}
                  className="w-full py-3 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] font-black text-xs border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Muat Ulang Halaman</span>
                </button>

                <Link
                  href={`/komik/${slug}`}
                  className="w-full py-3 rounded-full bg-white hover:bg-[#FAF7F0] text-[#1A1A1A] font-black text-xs border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Kembali ke Detail Komik</span>
                </Link>
              </div>
            </div>
          </div>
        ) : readMode === 'scroll' ? (
          <ViewerScroll
            pages={pages}
            comicTitle={comic.title}
            chapterNumber={chapterNo}
            containerWidth={containerWidth}
          />
        ) : (
          <ViewerPaged
            pages={pages}
            comicTitle={comic.title}
            chapterNumber={chapterNo}
            currentPageIndex={pagedCurrentIndex}
            onPageChange={setPagedCurrentIndex}
          />
        )}
      </main>

      {/* End of Chapter Neo-Comic Card (Only shown if pages exist) */}
      {pages.length > 0 && (
        <div className="max-w-lg mx-auto px-4 mt-12 mb-6">
          <div className="bg-[#F7F2E6] text-[#1A1A1A] rounded-[32px] border-[3px] border-[#1A1A1A] shadow-[6px_6px_0px_#1A1A1A] p-6 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#E6F4EA] border-2 border-[#1A1A1A] flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-[#2E7D6E] stroke-[2.5]" />
            </div>

            <div>
              <h3 className="text-base font-black text-[#1A1A1A]">
                Selesai Membaca Chapter {chapterNo}
              </h3>
              <p className="text-xs text-[#7A756D] font-medium mt-0.5">
                Riwayat membaca kamu sudah otomatis tersimpan.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full pt-2">
              {nextChapter ? (
                <Link
                  href={`/komik/${slug}/${nextChapter.chapter_number}`}
                  className="w-full py-3 px-4 rounded-2xl bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] font-black text-xs border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center gap-2"
                >
                  <span>Lanjut ke Chapter {nextChapter.chapter_number}</span>
                  <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                </Link>
              ) : (
                <div className="w-full py-3 px-4 rounded-2xl bg-[#FAF7F0] text-[#7A756D] font-black text-xs border-2 border-[#1A1A1A]">
                  Ini adalah chapter terbaru saat ini!
                </div>
              )}

              <Link
                href={`/komik/${slug}`}
                className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-[#FAF7F0] text-[#1A1A1A] font-black text-xs border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Detail Komik</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Neo-Comic Floating Navigation & Auto-Scroll Controls */}
      {pages.length > 0 && (
        <ReaderFloatingControls
          onScrollToTop={handleScrollToFirst}
          onScrollToBottom={handleScrollToLast}
          isAutoScrolling={isAutoScrolling}
          onToggleAutoScroll={() => setIsAutoScrolling((prev) => !prev)}
          scrollSpeedSeconds={autoScrollSpeed}
          onChangeSpeedSeconds={setAutoScrollSpeed}
          readMode={readMode}
          currentPage={readMode === 'paged' ? pagedCurrentIndex + 1 : undefined}
          totalPages={pages.length}
        />
      )}
    </div>
  );
}
