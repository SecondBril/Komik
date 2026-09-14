'use client';

import React, { useState } from 'react';
import { ComicAdaptation } from '@/lib/types';
import { Film, BookOpen, ChevronDown, ChevronUp, Sparkles, X, Info } from 'lucide-react';

interface AdaptationBannerProps {
  adaptation: ComicAdaptation | null;
  chapterNumber: number;
  comicTitle: string;
}

export function AdaptationBanner({
  adaptation,
  chapterNumber,
  comicTitle,
}: AdaptationBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (!adaptation || isDismissed) return null;

  const hasAnime = Boolean(adaptation.anime_episode_range || adaptation.anime_season);
  const hasNovel = Boolean(adaptation.novel_chapter_range || adaptation.novel_volume);

  if (!hasAnime && !hasNovel) return null;

  return (
    <div
      className="w-full max-w-3xl mx-auto px-4 my-3 z-30 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-[#FAF7F0] border-2 border-[#1A1A1A] rounded-2xl shadow-[3px_3px_0px_#1A1A1A] text-[#1A1A1A] overflow-hidden transition-all">
        {/* Top Summary Bar */}
        <div className="p-3 sm:px-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="w-6 h-6 rounded-lg bg-[#2E7D6E] text-white flex items-center justify-center shrink-0 border border-[#1A1A1A] shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
            </span>

            <div className="flex items-center gap-2 flex-wrap truncate text-xs font-black text-[#1A1A1A]">
              <span className="text-[#2E7D6E] font-black uppercase text-[10px] tracking-wider">
                Relasi Adaptasi
              </span>

              {/* Anime Quick Tag */}
              {hasAnime && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EBF3FE] border border-[#1A1A1A] text-[10px] text-[#2A4FCB]">
                  <Film className="w-3 h-3" />
                  <span>
                    {adaptation.anime_season ? `${adaptation.anime_season} ` : ''}
                    {adaptation.anime_episode_range || 'Anime'}
                  </span>
                </span>
              )}

              {/* Novel Quick Tag */}
              {hasNovel && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F6C945]/40 border border-[#1A1A1A] text-[10px] text-[#1A1A1A]">
                  <BookOpen className="w-3 h-3" />
                  <span>
                    {adaptation.novel_volume ? `${adaptation.novel_volume} ` : ''}
                    {adaptation.novel_chapter_range ? `Novel ${adaptation.novel_chapter_range}` : 'Novel'}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg hover:bg-black/5 text-[#1A1A1A] text-xs font-bold flex items-center gap-1 transition-colors"
              title={isExpanded ? 'Tutup rincian' : 'Lihat rincian adaptasi'}
            >
              <span className="text-[10px] hidden sm:inline">
                {isExpanded ? 'Sembunyikan' : 'Detail'}
              </span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1.5 rounded-lg hover:bg-[#FFEAEA] text-[#7A756D] hover:text-[#C53030] transition-colors"
              title="Tutup banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Expandable Details Section */}
        {isExpanded && (
          <div className="px-4 pb-4 pt-2 border-t-2 border-[#1A1A1A]/10 bg-white/70 flex flex-col gap-3 text-xs">
            {adaptation.arc_title && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#FAF7F0] border border-[#1A1A1A]/30 font-black text-[10px] uppercase text-[#7A756D]">
                  Arc Cerita
                </span>
                <span className="font-black text-[#1A1A1A]">{adaptation.arc_title}</span>
                <span className="text-[10px] text-[#7A756D] font-mono">
                  (Manga Ch. {adaptation.start_chapter} - {adaptation.end_chapter})
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Anime Box */}
              {hasAnime && (
                <div className="p-2.5 rounded-xl bg-[#EBF3FE]/60 border border-[#2A4FCB]/30 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-black text-[11px] text-[#2A4FCB]">
                    <Film className="w-3.5 h-3.5" />
                    <span>Versi Anime</span>
                  </div>
                  <p className="text-[11px] font-bold text-[#1A1A1A]">
                    {adaptation.anime_season ? `${adaptation.anime_season}: ` : ''}
                    {adaptation.anime_episode_range || 'Tersedia di anime'}
                  </p>
                </div>
              )}

              {/* Novel Box */}
              {hasNovel && (
                <div className="p-2.5 rounded-xl bg-[#F6C945]/20 border border-[#B38300]/30 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-black text-[11px] text-[#8C6200]">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Versi Novel Asli</span>
                  </div>
                  <p className="text-[11px] font-bold text-[#1A1A1A]">
                    {adaptation.novel_volume ? `${adaptation.novel_volume} ` : ''}
                    {adaptation.novel_chapter_range || 'Tersedia di novel'}
                  </p>
                </div>
              )}
            </div>

            {adaptation.note && (
              <div className="flex items-start gap-1.5 text-[11px] text-[#7A756D] italic">
                <Info className="w-3.5 h-3.5 text-[#2E7D6E] shrink-0 mt-0.5" />
                <span>{adaptation.note}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
