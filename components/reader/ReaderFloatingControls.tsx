'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronsUp,
  ChevronsDown,
  Play,
  Pause,
  Timer,
  Plus,
  Minus,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

interface ReaderFloatingControlsProps {
  onScrollToTop: () => void;
  onScrollToBottom: () => void;
  isAutoScrolling: boolean;
  onToggleAutoScroll: () => void;
  scrollSpeedSeconds: number;
  onChangeSpeedSeconds: (seconds: number) => void;
  readMode: 'scroll' | 'paged';
  currentPage?: number;
  totalPages?: number;
}

export const ReaderFloatingControls: React.FC<ReaderFloatingControlsProps> = ({
  onScrollToTop,
  onScrollToBottom,
  isAutoScrolling,
  onToggleAutoScroll,
  scrollSpeedSeconds,
  onChangeSpeedSeconds,
  readMode,
  currentPage,
  totalPages,
}) => {
  const [isSpeedOpen, setIsSpeedOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close speed popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsSpeedOpen(false);
      }
    };

    if (isSpeedOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSpeedOpen]);

  const presetSpeeds = [1, 2, 3, 5, 8, 10];

  const handleDecreaseSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scrollSpeedSeconds > 1) {
      onChangeSpeedSeconds(scrollSpeedSeconds - 1);
    }
  };

  const handleIncreaseSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scrollSpeedSeconds < 15) {
      onChangeSpeedSeconds(scrollSpeedSeconds + 1);
    }
  };

  return (
    <aside
      aria-label="Kontrol Navigasi & Auto-Scroll Pembaca"
      className="fixed right-3 sm:right-6 bottom-20 sm:bottom-24 z-40 flex flex-col items-center select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Speed Configuration Popover */}
      {isSpeedOpen && (
        <div
          ref={popoverRef}
          className="absolute right-14 bottom-0 w-64 sm:w-72 bg-[#F7F2E6] text-[#1A1A1A] border-[3px] border-[#1A1A1A] rounded-[24px] p-4 shadow-[5px_5px_0px_#1A1A1A] animate-in fade-in slide-in-from-right-2 duration-150 z-50 flex flex-col gap-3"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2 border-b-2 border-[#1A1A1A]">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-[#F6C945] border border-[#1A1A1A] flex items-center justify-center">
                <Timer className="w-3.5 h-3.5 text-[#1A1A1A]" />
              </div>
              <span className="text-xs font-black tracking-tight text-[#1A1A1A]">
                Kecepatan Auto-Scroll
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsSpeedOpen(false)}
              className="w-6 h-6 rounded-full bg-white hover:bg-[#FAF7F0] border border-[#1A1A1A] flex items-center justify-center text-[#1A1A1A] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Stepper Display */}
          <div className="flex items-center justify-between bg-white border-2 border-[#1A1A1A] rounded-2xl p-2 shadow-inner">
            <button
              type="button"
              onClick={handleDecreaseSpeed}
              disabled={scrollSpeedSeconds <= 1}
              className="w-8 h-8 rounded-xl bg-[#F7F2E6] hover:bg-[#FAF7F0] border border-[#1A1A1A] flex items-center justify-center font-black disabled:opacity-30 disabled:cursor-not-allowed shadow-[1px_1px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px]"
              title="Kurang 1 detik"
            >
              <Minus className="w-4 h-4 stroke-[3]" />
            </button>

            <div className="flex flex-col items-center">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-[#1A1A1A]">
                  {scrollSpeedSeconds}
                </span>
                <span className="text-[11px] font-bold text-[#7A756D]">
                  detik
                </span>
              </div>
              <span className="text-[9px] font-bold text-[#2E7D6E]">
                {readMode === 'scroll' ? 'detik / layar (smooth)' : 'detik / halaman'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleIncreaseSpeed}
              disabled={scrollSpeedSeconds >= 15}
              className="w-8 h-8 rounded-xl bg-[#F7F2E6] hover:bg-[#FAF7F0] border border-[#1A1A1A] flex items-center justify-center font-black disabled:opacity-30 disabled:cursor-not-allowed shadow-[1px_1px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px]"
              title="Tambah 1 detik"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
            </button>
          </div>

          {/* Preset Chips */}
          <div>
            <span className="text-[10px] font-black text-[#7A756D] uppercase tracking-wider block mb-1.5">
              Pilihan Cepat:
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {presetSpeeds.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onChangeSpeedSeconds(sec)}
                  className={`py-1.5 px-2 rounded-xl border-2 border-[#1A1A1A] text-xs font-black transition-all flex items-center justify-center gap-1 ${
                    scrollSpeedSeconds === sec
                      ? 'bg-[#F6C945] shadow-[2px_2px_0px_#1A1A1A] -translate-y-0.5'
                      : 'bg-white hover:bg-[#FAF7F0] shadow-sm'
                  }`}
                >
                  <span>{sec}s</span>
                  {scrollSpeedSeconds === sec && <Check className="w-3 h-3 stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Hint */}
          <div className="px-2.5 py-1.5 rounded-xl bg-[#E6F4EA] border border-[#1A1A1A] text-[10px] font-bold text-[#2E7D6E] flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 shrink-0" />
            <span>
              {readMode === 'scroll'
                ? 'Scroll continuous halus dan konstan tanpa patah-patah.'
                : 'Halaman akan berbalik otomatis setiap interval detik.'}
            </span>
          </div>
        </div>
      )}

      {/* Main Floating Action Pill / Dock */}
      <div className="bg-[#F7F2E6] border-[3px] border-[#1A1A1A] rounded-[26px] p-1.5 sm:p-2 shadow-[4px_4px_0px_#1A1A1A] flex flex-col items-center gap-2">
        {/* 1. Jump to First Image Button */}
        <button
          type="button"
          onClick={onScrollToTop}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-[#1A1A1A] flex items-center justify-center shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#1A1A1A] transition-all group relative"
          title="Menuju Gambar Pertama (Awal)"
          aria-label="Menuju Gambar Pertama"
        >
          <ChevronsUp className="w-5 h-5 stroke-[2.5] group-hover:-translate-y-0.5 transition-transform" />
          {/* Mini tooltip badge on hover */}
          <span className="sr-only">Gambar Pertama</span>
        </button>

        {/* 2. Auto Scroll Play/Pause Button */}
        <div className="relative flex flex-col items-center">
          <button
            type="button"
            onClick={onToggleAutoScroll}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl border-2 border-[#1A1A1A] flex items-center justify-center shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#1A1A1A] transition-all group relative ${
              isAutoScrolling
                ? 'bg-[#2E7D6E] text-white ring-2 ring-[#2E7D6E]/50'
                : 'bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A]'
            }`}
            title={
              isAutoScrolling
                ? 'Jeda Auto-Scroll'
                : `Mulai Auto-Scroll (Setiap ${scrollSpeedSeconds} detik)`
            }
            aria-label={isAutoScrolling ? 'Jeda Auto Scroll' : 'Mulai Auto Scroll'}
          >
            {isAutoScrolling ? (
              <Pause className="w-5 h-5 fill-white stroke-[2.5]" />
            ) : (
              <Play className="w-5 h-5 fill-[#1A1A1A] stroke-[2.5] ml-0.5" />
            )}
          </button>

          {/* Active pulse dot */}
          {isAutoScrolling && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2E7D6E] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#2E7D6E] border border-white"></span>
            </span>
          )}
        </div>

        {/* 3. Speed Adjuster Pill */}
        <button
          type="button"
          onClick={() => setIsSpeedOpen(!isSpeedOpen)}
          className={`px-2 py-1 rounded-xl border-2 border-[#1A1A1A] text-[10px] font-black shadow-[1px_1px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-0.5 ${
            isSpeedOpen
              ? 'bg-[#F6C945] text-[#1A1A1A]'
              : 'bg-white hover:bg-[#FAF7F0] text-[#1A1A1A]'
          }`}
          title="Atur Detik Kecepatan Auto-Scroll"
          aria-label="Atur Kecepatan Auto Scroll"
        >
          <Timer className="w-2.5 h-2.5" />
          <span>{scrollSpeedSeconds}s</span>
        </button>

        {/* 4. Jump to Last Image Button */}
        <button
          type="button"
          onClick={onScrollToBottom}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-[#1A1A1A] flex items-center justify-center shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#1A1A1A] transition-all group relative"
          title="Menuju Gambar Terakhir (Selesai)"
          aria-label="Menuju Gambar Terakhir"
        >
          <ChevronsDown className="w-5 h-5 stroke-[2.5] group-hover:translate-y-0.5 transition-transform" />
          <span className="sr-only">Gambar Terakhir</span>
        </button>
      </div>
    </aside>
  );
};
