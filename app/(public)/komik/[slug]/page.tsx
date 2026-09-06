'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getComicBySlug } from '@/lib/queries/comics';
import { getComicChapters } from '@/lib/queries/chapters';
import { Comic, Chapter } from '@/lib/types';
import { TypeBadge, StatusBadge } from '@/components/ui/Badge';
import { GenreChip } from '@/components/comic/GenreChip';
import { getGuestHistory } from '@/lib/queries/history';
import { formatRelativeTime } from '@/lib/utils/relative-time';
import { Star, Play, BookOpen, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

export default function ComicDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [comic, setComic] = useState<Comic | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
  const [lastReadChapterNo, setLastReadChapterNo] = useState<number | null>(null);
  const [readChapterIds, setReadChapterIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadData() {
      if (!slug) return;
      const comicData = await getComicBySlug(slug);
      setComic(comicData);

      const chapterList = await getComicChapters(slug);
      setChapters(chapterList);

      // Check reading history
      const history = getGuestHistory();
      if (comicData) {
        const foundHistory = history.find((h) => h.comic_id === comicData.id);
        if (foundHistory) {
          setLastReadChapterNo(foundHistory.chapter.chapter_number);
          setReadChapterIds(new Set([foundHistory.chapter_id]));
        }
      }
    }
    loadData();
  }, [slug]);

  if (!comic) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#9AA0AC]">
        <BookOpen className="w-12 h-12 mb-3 text-[#5B616D] stroke-[1.5]" />
        <p className="text-sm font-semibold">Memuat detail komik...</p>
      </div>
    );
  }

  const firstChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;

  return (
    <div className="flex flex-col gap-8">
      
      {/* Top Banner / Hero Meta Container */}
      <div className="flex flex-col md:flex-row gap-6 p-6 rounded-2xl bg-[#171A21] border border-[#2A2F3A] shadow-xl relative overflow-hidden">
        
        {/* Cover Large */}
        <div className="relative w-44 sm:w-52 aspect-[2/3] rounded-xl overflow-hidden shrink-0 mx-auto md:mx-0 shadow-2xl border border-[#2A2F3A] bg-[#1F232C]">
          <Image
            src={comic.cover_url}
            alt={comic.title}
            fill
            priority
            className="object-cover"
          />
        </div>

        {/* Metadata Details */}
        <div className="flex flex-col justify-between flex-1 gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={comic.type} />
              <StatusBadge status={comic.status} />
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/30 text-xs font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400 stroke-none" />
                <span>{comic.rating.toFixed(2)}</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F2F3F5] tracking-tight leading-tight">
              {comic.title}
            </h1>

            {comic.alt_titles && comic.alt_titles.length > 0 && (
              <p className="text-xs text-[#9AA0AC]">
                Judul Lain: {comic.alt_titles.join(', ')}
              </p>
            )}

            <p className="text-xs text-[#9AA0AC] pt-1">
              Penulis / Artist: <span className="text-[#F2F3F5] font-medium">{comic.author}</span>
            </p>
          </div>

          {/* Genre Chips */}
          <div className="flex flex-wrap gap-1.5">
            {comic.genres?.map((genre) => (
              <GenreChip key={genre.id} label={genre.name} />
            ))}
          </div>

          {/* Synopsis */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-[#2A2F3A]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#9AA0AC]">Sinopsis</h3>
            <p className={`text-xs sm:text-sm text-[#F2F3F5]/90 leading-relaxed ${!isSynopsisExpanded ? 'line-clamp-3' : ''}`}>
              {comic.synopsis}
            </p>
            {comic.synopsis && comic.synopsis.length > 180 && (
              <button
                type="button"
                onClick={() => setIsSynopsisExpanded(!isSynopsisExpanded)}
                className="text-xs font-semibold text-[#7C5CFC] hover:underline flex items-center gap-1 self-start pt-1"
              >
                {isSynopsisExpanded ? (
                  <>
                    Sembunyikan <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    Baca Selengkapnya <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>

          {/* Primary Action Button (Contextual: Baca Ch.1 vs Lanjut Baca) */}
          <div className="pt-2">
            {lastReadChapterNo ? (
              <Link
                href={`/komik/${comic.slug}/${lastReadChapterNo}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#7C5CFC] hover:bg-[#6A47F0] text-white font-bold text-sm transition-all shadow-lg shadow-[#7C5CFC]/20"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Lanjut Baca Chapter {lastReadChapterNo}</span>
              </Link>
            ) : firstChapter ? (
              <Link
                href={`/komik/${comic.slug}/${firstChapter.chapter_number}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#7C5CFC] hover:bg-[#6A47F0] text-white font-bold text-sm transition-all shadow-lg shadow-[#7C5CFC]/20"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Baca Dari Awal (Ch. {firstChapter.chapter_number})</span>
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* Chapters List Section */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[#2A2F3A] pb-3">
          <h2 className="text-lg font-bold text-[#F2F3F5] flex items-center gap-2">
            Daftar Chapter
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#1F232C] text-[#9AA0AC] border border-[#2A2F3A]">
              {chapters.length} Chapter
            </span>
          </h2>
        </div>

        <div className="flex flex-col divide-y divide-[#2A2F3A] bg-[#171A21] border border-[#2A2F3A] rounded-2xl overflow-hidden">
          {chapters.map((ch) => {
            const isRead = readChapterIds.has(ch.id) || lastReadChapterNo === ch.chapter_number;
            return (
              <Link
                key={ch.id}
                href={`/komik/${comic.slug}/${ch.chapter_number}`}
                className={`p-4 flex items-center justify-between hover:bg-[#1F232C] transition-colors ${
                  isRead ? 'opacity-60 bg-[#0F1115]/50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {isRead && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  <span className={`text-sm font-semibold ${isRead ? 'text-[#9AA0AC]' : 'text-[#F2F3F5]'}`}>
                    Chapter {ch.chapter_number}
                    {ch.title && <span className="font-normal text-[#9AA0AC] ml-2">— {ch.title}</span>}
                  </span>
                </div>

                <span className="text-xs text-[#9AA0AC] shrink-0">
                  {formatRelativeTime(ch.released_at)}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
