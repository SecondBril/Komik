'use client';

import React from 'react';
import { ComicAdaptation } from '@/lib/types';
import { Film, BookOpen, Sparkles, Layers, ArrowRight, Info } from 'lucide-react';

interface AdaptationTimelineProps {
  adaptations: ComicAdaptation[];
  comicTitle: string;
}

export function AdaptationTimeline({
  adaptations,
  comicTitle,
}: AdaptationTimelineProps) {
  if (!adaptations || adaptations.length === 0) return null;

  return (
    <section className="w-full bg-white rounded-[32px] sm:rounded-[40px] border-[3px] border-[#1A1A1A] shadow-[6px_6px_0px_#1A1A1A] p-5 sm:p-7 flex flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-[#1A1A1A]/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#2E7D6E] text-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center shrink-0">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#1A1A1A] tracking-tight flex items-center gap-2">
              <span>Linimasa Adaptasi Anime &amp; Novel</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#F6C945] text-[#1A1A1A] border border-[#1A1A1A]">
                {adaptations.length} Bagian
              </span>
            </h2>
            <p className="text-xs text-[#7A756D] font-medium mt-0.5">
              Panduan bab komik vs episode anime dan bab novel aslinya.
            </p>
          </div>
        </div>
      </div>

      {/* Timeline Roadmap Cards / Table */}
      <div className="flex flex-col gap-3">
        {adaptations.map((item, idx) => (
          <div
            key={item.id || idx}
            className="bg-[#FAF7F0] border-2 border-[#1A1A1A] rounded-2xl p-4 shadow-[3px_3px_0px_#1A1A1A] flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#F6C945]/10 transition-colors"
          >
            {/* Left: Comic Chapter Range & Arc */}
            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] text-white flex flex-col items-center justify-center shrink-0 font-black text-xs shadow-xs">
                <span className="text-[8px] text-[#F6C945] uppercase">Ch</span>
                <span>{item.start_chapter}</span>
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-black text-[#1A1A1A]">
                    Chapter {item.start_chapter} &ndash; {item.end_chapter}
                  </span>
                  {item.arc_title && (
                    <span className="px-2 py-0.5 rounded-full bg-white border border-[#1A1A1A] text-[10px] font-black text-[#2E7D6E]">
                      {item.arc_title}
                    </span>
                  )}
                </div>
                {item.note && (
                  <p className="text-[11px] text-[#7A756D] mt-0.5 truncate">
                    {item.note}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Anime & Novel Badges */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap shrink-0">
              {/* Anime Info */}
              {(item.anime_episode_range || item.anime_season) && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EBF3FE] border-2 border-[#1A1A1A] text-xs font-bold text-[#2A4FCB] shadow-xs">
                  <Film className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {item.anime_season ? `${item.anime_season} ` : ''}
                    ({item.anime_episode_range || 'Anime'})
                  </span>
                </div>
              )}

              {/* Novel Info */}
              {(item.novel_chapter_range || item.novel_volume) && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FFF8E1] border-2 border-[#1A1A1A] text-xs font-bold text-[#8C6200] shadow-xs">
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {item.novel_volume ? `${item.novel_volume} ` : ''}
                    {item.novel_chapter_range ? `Ch. ${item.novel_chapter_range}` : 'Novel'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
