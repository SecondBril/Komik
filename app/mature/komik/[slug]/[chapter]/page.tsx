'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { getMatureComicBySlug } from '@/lib/queries/mature-comics';
import { getMatureComicChapters, getMatureChapterPages } from '@/lib/queries/mature-chapters';
import { MatureComic, MatureChapter, ChapterPage } from '@/lib/types';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  RotateCcw,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Skull,
  ShieldAlert,
} from 'lucide-react';

export default function MatureReadingViewerPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const chapterNo = Number(params?.chapter);

  const [comic, setComic] = useState<MatureComic | null>(null);
  const [currentChapter, setCurrentChapter] = useState<MatureChapter | null>(null);
  const [allChapters, setAllChapters] = useState<MatureChapter[]>([]);
  const [pages, setPages] = useState<ChapterPage[]>([]);
  const [loading, setLoading] = useState(true);

  // Reader Settings
  const [readMode, setReadMode] = useState<'scroll' | 'paged'>('scroll');
  const [containerWidth, setContainerWidth] = useState<'normal' | 'large' | 'full'>('large');
  const [pagedIndex, setPagedIndex] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(3); // sec per screen

  useEffect(() => {
    async function load() {
      if (!slug || isNaN(chapterNo)) return;
      setLoading(true);

      const [cData, chList] = await Promise.all([
        getMatureComicBySlug(slug),
        getMatureComicChapters(slug),
      ]);

      setComic(cData);
      setAllChapters(chList);

      const foundCh = chList.find((c) => Number(c.chapter_number) === chapterNo);
      setCurrentChapter(foundCh || null);

      if (foundCh) {
        const pageList = await getMatureChapterPages(foundCh.id);
        setPages(pageList);
      } else {
        // Fallback default pages
        const pageList = await getMatureChapterPages('default');
        setPages(pageList);
      }

      setLoading(false);
      setPagedIndex(0);
      setIsAutoScrolling(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    load();
  }, [slug, chapterNo]);

  // Smooth Auto-scroll
  useEffect(() => {
    if (!isAutoScrolling || pages.length === 0 || readMode !== 'scroll') return;

    let animId: number;
    let lastTime: number | null = null;

    const step = (now: number) => {
      if (!lastTime) {
        lastTime = now;
        animId = requestAnimationFrame(step);
        return;
      }
      const delta = Math.min(now - lastTime, 100);
      lastTime = now;

      const vh = window.innerHeight || 800;
      const pxPerSec = vh / Math.max(1, autoScrollSpeed);
      const move = (pxPerSec * delta) / 1000;

      window.scrollBy(0, move);

      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50) {
        setIsAutoScrolling(false);
        return;
      }

      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isAutoScrolling, autoScrollSpeed, pages.length, readMode]);

  // Sorted chapters ascending for next/prev
  const sortedChaptersAsc = [...allChapters].sort(
    (a, b) => Number(a.chapter_number) - Number(b.chapter_number)
  );
  const currentIndex = sortedChaptersAsc.findIndex(
    (ch) => Number(ch.chapter_number) === chapterNo
  );
  const prevChapter = currentIndex > 0 ? sortedChaptersAsc[currentIndex - 1] : null;
  const nextChapter =
    currentIndex >= 0 && currentIndex < sortedChaptersAsc.length - 1
      ? sortedChaptersAsc[currentIndex + 1]
      : null;

  const getMaxWidthClass = () => {
    switch (containerWidth) {
      case 'normal':
        return 'max-w-2xl';
      case 'large':
        return 'max-w-4xl';
      case 'full':
        return 'max-w-none';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-red-950 border border-[#E53E3E] text-[#EF4444] flex items-center justify-center animate-spin">
          <Skull className="w-6 h-6" />
        </div>
        <p className="text-xs font-bold text-gray-400">Menyiapkan halaman komik 18+...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050608] text-gray-100 flex flex-col selection:bg-[#E53E3E]/50 selection:text-white">
      {/* 1. Sticky Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full bg-[#08090C]/95 backdrop-blur-md border-b border-[#231216] px-4 py-2.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Back to Comic Detail */}
          <Link
            href={`/mature/komik/${slug}`}
            className="flex items-center gap-2 text-xs font-bold text-gray-300 hover:text-white transition-colors truncate max-w-[200px] sm:max-w-md"
          >
            <ArrowLeft className="w-4 h-4 shrink-0 text-[#EF4444]" />
            <span className="truncate">{comic?.title || 'Kembali'}</span>
          </Link>

          {/* Chapter Selector & Controls */}
          <div className="flex items-center gap-2">
            {/* Chapter Jump Selector */}
            <select
              value={chapterNo}
              onChange={(e) =>
                router.push(`/mature/komik/${slug}/${e.target.value}`)
              }
              className="py-1.5 px-2.5 rounded-xl bg-[#141620] border border-[#2E151A] text-white text-xs font-bold outline-none cursor-pointer hover:border-[#E53E3E] transition-colors"
            >
              {allChapters.map((ch) => (
                <option key={ch.id} value={ch.chapter_number}>
                  Ch. {ch.chapter_number} {ch.title ? `— ${ch.title}` : ''}
                </option>
              ))}
            </select>

            {/* Read Mode Toggle */}
            <div className="hidden sm:flex items-center bg-[#141620] rounded-xl border border-[#2E151A] p-0.5">
              <button
                type="button"
                onClick={() => setReadMode('scroll')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  readMode === 'scroll'
                    ? 'bg-[#E53E3E] text-black shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Scroll
              </button>
              <button
                type="button"
                onClick={() => setReadMode('paged')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  readMode === 'paged'
                    ? 'bg-[#E53E3E] text-black shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Slide
              </button>
            </div>

            {/* Auto Scroll Toggle (Scroll mode only) */}
            {readMode === 'scroll' && (
              <button
                type="button"
                onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  isAutoScrolling
                    ? 'bg-[#E53E3E] text-black border-[#E53E3E] shadow-[0_0_15px_rgba(229,62,62,0.4)]'
                    : 'bg-[#141620] text-gray-300 border-[#2E151A] hover:text-white'
                }`}
              >
                {isAutoScrolling ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isAutoScrolling ? 'Berhenti' : 'Auto Scroll'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Reader Body */}
      <main className="flex-1 flex flex-col items-center justify-start w-full py-4">
        {readMode === 'scroll' ? (
          /* Webtoon Scroll View */
          <div className={`w-full ${getMaxWidthClass()} mx-auto flex flex-col items-center`}>
            {pages.map((p, idx) => (
              <div
                key={p.id || idx}
                className="relative w-full aspect-[2/3] max-w-full bg-[#090A0D] border-b border-black/20"
              >
                <Image
                  src={p.image_url}
                  alt={`Halaman ${p.page_number}`}
                  fill
                  priority={idx < 2}
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 900px"
                />
              </div>
            ))}
          </div>
        ) : (
          /* Manga Slide / Paged View */
          <div className="flex flex-col items-center gap-4 w-full max-w-3xl mx-auto px-4">
            <div className="relative w-full aspect-[2/3] bg-[#090A0D] rounded-2xl overflow-hidden border border-[#231216] shadow-[0_0_30px_rgba(0,0,0,0.8)]">
              {pages[pagedIndex] && (
                <Image
                  src={pages[pagedIndex].image_url}
                  alt={`Halaman ${pages[pagedIndex].page_number}`}
                  fill
                  priority
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 800px"
                />
              )}
            </div>

            {/* Paged Navigation Bar */}
            <div className="flex items-center justify-between w-full max-w-sm gap-4 py-2">
              <button
                type="button"
                disabled={pagedIndex === 0}
                onClick={() => setPagedIndex((prev) => Math.max(0, prev - 1))}
                className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#141620] border border-[#2E151A] text-xs font-bold disabled:opacity-30 hover:bg-[#1E2232] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </button>

              <span className="text-xs font-bold text-gray-400">
                <strong className="text-white">{pagedIndex + 1}</strong> / {pages.length}
              </span>

              <button
                type="button"
                disabled={pagedIndex >= pages.length - 1}
                onClick={() => setPagedIndex((prev) => Math.min(pages.length - 1, prev + 1))}
                className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#141620] border border-[#2E151A] text-xs font-bold disabled:opacity-30 hover:bg-[#1E2232] transition-colors"
              >
                <span>Selanjutnya</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 3. Bottom Chapter Navigation Bar */}
        <div className="w-full max-w-2xl mx-auto px-4 py-10 flex flex-col items-center gap-6">
          <div className="flex items-center justify-between w-full gap-3">
            {prevChapter ? (
              <Link
                href={`/mature/komik/${slug}/${prevChapter.chapter_number}`}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[#13151F] hover:bg-[#1C202F] border border-[#2E151A] text-gray-200 text-xs sm:text-sm font-bold transition-all active:scale-[0.98]"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Ch. {prevChapter.chapter_number}</span>
              </Link>
            ) : (
              <div className="flex-1 py-3.5 text-center text-xs text-gray-600 border border-white/5 rounded-2xl">
                Chapter Pertama
              </div>
            )}

            <Link
              href={`/mature/komik/${slug}`}
              className="px-4 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-bold text-gray-300"
              title="Daftar Chapter"
            >
              <BookOpen className="w-4 h-4" />
            </Link>

            {nextChapter ? (
              <Link
                href={`/mature/komik/${slug}/${nextChapter.chapter_number}`}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#E53E3E] to-[#991B1B] text-white text-xs sm:text-sm font-black hover:brightness-110 shadow-[0_0_20px_rgba(229,62,62,0.3)] transition-all active:scale-[0.98]"
              >
                <span>Ch. {nextChapter.chapter_number}</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <div className="flex-1 py-3.5 text-center text-xs text-gray-600 border border-white/5 rounded-2xl">
                Chapter Terakhir
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-500 text-center">
            Anda membaca di Sektor 18+ Chameleon Comics. Gunakan tombol kembali di kiri atas untuk ke katalog.
          </p>
        </div>
      </main>
    </div>
  );
}
