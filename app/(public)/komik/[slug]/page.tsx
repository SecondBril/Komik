'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getComicBySlug } from '@/lib/queries/comics';
import { getComicChapters } from '@/lib/queries/chapters';
import { Comic, Chapter } from '@/lib/types';
import { TypeBadge, StatusBadge, PriceBadge } from '@/components/ui/Badge';
import { getReadChapterIds, getReadChapterNumbers, getLastReadChapter } from '@/lib/queries/history';
import { formatRelativeTime } from '@/lib/utils/relative-time';
import {
  ArrowLeft,
  BookOpen,
  Star,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Compass,
} from 'lucide-react';

export default function ComicDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [comic, setComic] = useState<Comic | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
  const [chapterSearch, setChapterSearch] = useState('');
  const [lastReadChapterNo, setLastReadChapterNo] = useState<number | null>(null);
  const [readChapterIds, setReadChapterIds] = useState<Set<string>>(new Set());
  const [readChapterNumbers, setReadChapterNumbers] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function loadData() {
      if (!slug) return;
      const comicData = await getComicBySlug(slug);
      setComic(comicData);

      const chapterList = await getComicChapters(slug);
      setChapters(chapterList);

      // Check reading history (Track all read chapters)
      const comicIdOrSlug = comicData?.id || slug;
      const readIds = getReadChapterIds(comicIdOrSlug);
      const readNums = getReadChapterNumbers(comicIdOrSlug);
      setReadChapterIds(readIds);
      setReadChapterNumbers(readNums);

      const lastRead = getLastReadChapter(comicIdOrSlug);
      if (lastRead) {
        setLastReadChapterNo(lastRead.chapter.chapter_number);
      }
    }
    loadData();
  }, [slug]);

  // Sorted chapters descending
  const sortedChapters = useMemo(() => {
    return [...chapters].sort((a, b) => b.chapter_number - a.chapter_number);
  }, [chapters]);

  // Filtered chapters by search input
  const filteredChapters = useMemo(() => {
    if (!chapterSearch.trim()) return sortedChapters;
    const q = chapterSearch.trim().toLowerCase();
    return sortedChapters.filter(
      (ch) =>
        String(ch.chapter_number).includes(q) ||
        (ch.title && ch.title.toLowerCase().includes(q))
    );
  }, [sortedChapters, chapterSearch]);

  const nextChapters = sortedChapters.slice(0, 8);
  const firstChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;

  if (!comic) {
    return (
      <div className="min-h-[70vh] bg-[#F7F2E6] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#2E7D6E] border-t-transparent animate-spin mb-4" />
        <p className="font-black text-sm text-[#1A1A1A]">Memuat detail komik...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#F7F2E6] pb-24 overflow-x-hidden">
      {/* Background Decorative Circles (Positioned neatly outside content) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-20 -left-12 w-32 h-32 rounded-full bg-[#E96379]/30 border-2 border-[#1A1A1A]/30" />
        <div className="absolute top-[45%] -right-16 w-40 h-40 rounded-full bg-[#F6C945]/30 border-2 border-[#1A1A1A]/30" />
        <div className="absolute bottom-10 -left-10 w-28 h-28 rounded-full bg-[#9086F4]/30 border-2 border-[#1A1A1A]/30" />
      </div>

      {/* Main Responsive Container */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 flex flex-col gap-6 z-10">

        {/* 1. Curved Teal Header Bar */}
        <div className="relative w-full bg-[#2E7D6E] py-4 px-5 sm:px-8 rounded-3xl sm:rounded-[36px] border-[3px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] flex items-center justify-between gap-4">
          <Link
            href="/browse"
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] hover:bg-[#FAF7F0] active:translate-x-[1px] active:translate-y-[1px] transition-all text-xs font-black tracking-tight"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5] shrink-0" />
            <span>Kembali ke Katalog</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs font-black text-white/90 uppercase">
              {comic.type} • {comic.status}
            </span>
            <Link
              href="/browse"
              className="flex items-center gap-1 text-xs font-black text-[#F6C945] hover:underline"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Semua Kategori</span>
            </Link>
          </div>
        </div>

        {/* 2. Main Comic Card with min-w-0 and w-full to guarantee NO overflow */}
        <div className="w-full bg-white rounded-[32px] sm:rounded-[40px] border-[3px] border-[#1A1A1A] shadow-[6px_6px_0px_#1A1A1A] p-5 sm:p-8 flex flex-col md:flex-row items-start gap-6 sm:gap-8 overflow-hidden box-border">

          {/* Left Column: Comic Cover Poster */}
          <div className="mx-auto md:mx-0 shrink-0 flex flex-col items-center gap-3 w-full md:w-auto">
            <div className="relative w-48 sm:w-56 md:w-64 aspect-[2/3] rounded-[24px] overflow-hidden bg-[#FAF7F0] p-2 border-[3px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A]">
              <div className="relative w-full h-full rounded-[16px] overflow-hidden bg-[#FAF7F0]">
                <Image
                  src={comic.cover_url}
                  alt={comic.title}
                  fill
                  priority
                  className="object-cover"
                />
                <div className="absolute top-2.5 left-2.5">
                  <TypeBadge type={comic.type} />
                </div>
              </div>
            </div>

            {/* Author label */}
            <span className="text-xs font-bold text-[#7A756D] text-center max-w-[240px]">
              Author: <span className="text-[#1A1A1A] font-black">{comic.author || 'Unknown Author'}</span>
            </span>

            {/* Genre tags */}
            {comic.genres && comic.genres.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-[240px] pt-1">
                {comic.genres.map((g) => (
                  <Link
                    key={g.id}
                    href={`/browse?genre=${g.slug}`}
                    className="px-2.5 py-1 rounded-full bg-[#FAF7F0] border border-[#1A1A1A] text-[10px] font-black text-[#1A1A1A] hover:bg-[#F6C945] transition-colors"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: min-w-0 ensures flex child never exceeds parent card width */}
          <div className="flex-1 min-w-0 w-full flex flex-col gap-4 overflow-hidden">

            {/* Title & Badges */}
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#1A1A1A] tracking-tight leading-snug break-words">
                {comic.title}
              </h1>

              {/* Badges Row */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#FAF7F0] border-2 border-[#1A1A1A] shadow-sm text-xs font-black text-[#1A1A1A]">
                  <Star className="w-3.5 h-3.5 fill-[#F6C945] stroke-[#1A1A1A]" />
                  <span>{comic.rating.toFixed(2)}</span>
                </div>
                <StatusBadge status={comic.status} />
              </div>
            </div>

            {/* Synopsis Box with strict max-w-full and break-words */}
            <div className="w-full max-w-full text-xs sm:text-sm text-[#555] leading-relaxed bg-[#FAF7F0] p-4 rounded-2xl border-2 border-[#1A1A1A] box-border">
              <p className={`break-words ${isSynopsisExpanded ? '' : 'line-clamp-3'}`}>
                {comic.synopsis || 'Komik terjemahan Bahasa Indonesia terbaru.'}
              </p>
              <button
                onClick={() => setIsSynopsisExpanded(!isSynopsisExpanded)}
                className="mt-2 font-black text-[#1A1A1A] underline hover:text-[#2E7D6E] transition-colors inline-flex items-center gap-1"
              >
                <span>{isSynopsisExpanded ? 'view less' : 'view more'}</span>
                {isSynopsisExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Primary Action Button: "Mulai Baca" */}
            {firstChapter && (
              <div className="pt-1 w-full">
                <Link
                  href={`/komik/${comic.slug}/${lastReadChapterNo || firstChapter.chapter_number}`}
                  className="w-full py-4 px-6 rounded-2xl bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] font-black text-sm sm:text-base tracking-wide border-[3px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#1A1A1A] transition-all text-center flex items-center justify-center gap-3 box-border"
                >
                  <BookOpen className="w-5 h-5 stroke-[2.5]" />
                  <span className="truncate">
                    {lastReadChapterNo
                      ? `Lanjut Membaca (Chapter ${lastReadChapterNo})`
                      : `Mulai Baca Chapter Pertama (Ch. ${firstChapter.chapter_number})`}
                  </span>
                </Link>
              </div>
            )}

            {/* Next chapters Carousel with strict w-full overflow-hidden */}
            <section className="mt-4 flex flex-col gap-3 w-full max-w-full overflow-hidden">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-black text-[#1A1A1A] tracking-tight">
                  Next chapters
                </h2>
                <span className="text-xs font-bold text-[#7A756D]">
                  {chapters.length} Chapters
                </span>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none w-full max-w-full">
                {nextChapters.map((ch) => {
                  return (
                    <Link
                      key={ch.id}
                      href={`/komik/${comic.slug}/${ch.chapter_number}`}
                      className="shrink-0 w-24 sm:w-28 group flex flex-col gap-1.5"
                    >
                      <div className="relative w-24 sm:w-28 h-32 sm:h-36 rounded-2xl overflow-hidden bg-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] group-hover:shadow-[4px_4px_0px_#1A1A1A] group-hover:-translate-y-0.5 transition-all">
                        <Image
                          src={comic.cover_url}
                          alt={`Chapter ${ch.chapter_number}`}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                        <span className="absolute bottom-2 left-2 right-2 text-center text-[10px] font-black text-white bg-[#1A1A1A]/85 py-0.5 rounded-lg px-1">
                          Ch. {ch.chapter_number}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-[#7A756D] truncate text-center">
                        {formatRelativeTime(ch.released_at)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        {/* 3. Complete Chapter List with Search Chapter Input */}
        <div className="w-full bg-white rounded-[32px] sm:rounded-[40px] border-[3px] border-[#1A1A1A] shadow-[6px_6px_0px_#1A1A1A] p-5 sm:p-8 flex flex-col gap-4 overflow-hidden box-border">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-[#1A1A1A]">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[#1A1A1A] tracking-tight">
                Daftar Semua Chapter
              </h2>
              <span className="text-xs font-bold text-[#7A756D]">
                Total {sortedChapters.length} chapter terbit
              </span>
            </div>

            {/* Chapter Search Box */}
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={chapterSearch}
                onChange={(e) => setChapterSearch(e.target.value)}
                placeholder="Cari nomor chapter... misal: 45"
                className="w-full py-2 pl-9 pr-8 rounded-2xl bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-bold text-[#1A1A1A] placeholder-[#8C8C8C] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#1A1A1A] stroke-[2.5]" />
              {chapterSearch && (
                <button
                  onClick={() => setChapterSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C8C8C] hover:text-[#1A1A1A]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {chapterSearch && (
            <div className="text-xs font-bold text-[#2E7D6E]">
              Menampilkan {filteredChapters.length} dari {sortedChapters.length} chapter
            </div>
          )}

          {/* Chapters Grid / List */}
          <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredChapters.length === 0 ? (
              <div className="py-10 text-center bg-[#FAF7F0] rounded-2xl border-2 border-[#1A1A1A] p-4 font-bold text-xs text-[#7A756D]">
                Tidak ditemukan chapter dengan nomor &quot;{chapterSearch}&quot;
              </div>
            ) : (
              filteredChapters.map((ch) => {
                const isRead = readChapterIds.has(ch.id) || readChapterNumbers.has(ch.chapter_number);
                return (
                  <Link
                    key={ch.id}
                    href={`/komik/${comic.slug}/${ch.chapter_number}`}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] transition-all hover:bg-[#F6C945]/15 active:translate-x-[1px] active:translate-y-[1px] ${isRead ? 'bg-[#FAF7F0]' : 'bg-white'
                      }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] flex items-center justify-center font-black text-xs text-[#1A1A1A] shadow-sm shrink-0">
                        {ch.chapter_number}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-black text-[#1A1A1A] truncate">
                          Chapter {ch.chapter_number}
                        </span>
                        <span className="text-[10px] text-[#7A756D]">
                          {formatRelativeTime(ch.released_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isRead && (
                        <span className="text-[10px] font-bold text-[#2E7D6E] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Sudah Dibaca
                        </span>
                      )}
                      <span className="px-3.5 py-1.5 rounded-full bg-[#2E7D6E] text-white text-[10px] font-black border border-[#1A1A1A] shadow-sm">
                        Baca
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
