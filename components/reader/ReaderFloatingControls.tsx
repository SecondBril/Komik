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
  GripVertical,
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

  // ── Drag state (Pointer Events — responsive with capture) ──────────────────
  const [pos, setPos] = useState<{ right: number; bottom: number }>({ right: 16, bottom: 88 });
  // Store mutable drag state in a ref so event handlers never go stale
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startRight: 16,
    startBottom: 88,
  });

  // Grip: pointerdown — capture pointer so we never lose events
  const handleGripPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startRight: pos.right,
      startBottom: pos.bottom,
    };
  };

  // Grip: pointermove — runs even while captured outside element
  const handleGripPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const newRight = Math.max(8, Math.min(window.innerWidth - 70, dragRef.current.startRight - dx));
    // Dragging up (dy < 0) increases distance from bottom.
    // Dock is ~270px tall, so maxBottom ensures the top of the dock stays on-screen with margin.
    const maxBottom = Math.max(16, window.innerHeight - 280);
    const newBottom = Math.max(16, Math.min(maxBottom, dragRef.current.startBottom - dy));
    setPos({ right: newRight, bottom: newBottom });
  };

  // Grip: pointerup / pointercancel — end drag
  const handleGripPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false;
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
  };


  // ── Close speed popover on click outside ───────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsSpeedOpen(false);
      }
    };
    if (isSpeedOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, [isSpeedOpen]);

  // Close speed panel when auto scroll starts
  useEffect(() => {
    if (isAutoScrolling) setIsSpeedOpen(false);
  }, [isAutoScrolling]);

  const presetSpeeds = [1, 2, 3, 5, 8, 10];

  // If dock is in the upper ~45% of screen (high pos.bottom), flip popover downwards ("rada bawah")
  // so it stays clearly visible and never gets clipped at the top of the viewport
  const popoverFlipsDown =
    typeof window !== 'undefined' && pos.bottom > window.innerHeight * 0.45;

  // If dock is dragged to the left half of the screen, open popover to the right instead of left
  const popoverOpensLeft =
    typeof window === 'undefined' || pos.right <= window.innerWidth * 0.5;

  const handleDecreaseSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scrollSpeedSeconds > 1) onChangeSpeedSeconds(scrollSpeedSeconds - 1);
  };

  const handleIncreaseSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scrollSpeedSeconds < 15) onChangeSpeedSeconds(scrollSpeedSeconds + 1);
  };

  return (
    <aside
      aria-label="Kontrol Navigasi & Auto-Scroll Pembaca"
      style={{ right: pos.right, bottom: pos.bottom }}
      className="fixed z-40 flex flex-col items-center select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Speed Configuration Popover — only when NOT auto-scrolling */}
      {isSpeedOpen && !isAutoScrolling && (
        <div
          ref={popoverRef}
          className={`absolute w-64 sm:w-72 bg-[#F7F2E6] text-[#1A1A1A] border-[3px] border-[#1A1A1A] rounded-[24px] p-4 shadow-[5px_5px_0px_#1A1A1A] duration-150 z-50 flex flex-col gap-3 max-h-[85vh] overflow-y-auto ${
            popoverOpensLeft
              ? 'right-14 sm:right-16 slide-in-from-right-2'
              : 'left-14 sm:left-16 slide-in-from-left-2'
          } ${
            popoverFlipsDown
              ? 'top-4 sm:top-6 animate-in fade-in'
              : 'bottom-0 animate-in fade-in'
          }`}
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
            <button type="button" onClick={handleDecreaseSpeed} disabled={scrollSpeedSeconds <= 1}
              className="w-8 h-8 rounded-xl bg-[#F7F2E6] hover:bg-[#FAF7F0] border border-[#1A1A1A] flex items-center justify-center font-black disabled:opacity-30 disabled:cursor-not-allowed shadow-[1px_1px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px]"
              title="Kurang 1 detik">
              <Minus className="w-4 h-4 stroke-[3]" />
            </button>
            <div className="flex flex-col items-center">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-[#1A1A1A]">{scrollSpeedSeconds}</span>
                <span className="text-[11px] font-bold text-[#7A756D]">detik</span>
              </div>
              <span className="text-[9px] font-bold text-[#2E7D6E]">
                {readMode === 'scroll' ? 'detik / layar (smooth)' : 'detik / halaman'}
              </span>
            </div>
            <button type="button" onClick={handleIncreaseSpeed} disabled={scrollSpeedSeconds >= 15}
              className="w-8 h-8 rounded-xl bg-[#F7F2E6] hover:bg-[#FAF7F0] border border-[#1A1A1A] flex items-center justify-center font-black disabled:opacity-30 disabled:cursor-not-allowed shadow-[1px_1px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px]"
              title="Tambah 1 detik">
              <Plus className="w-4 h-4 stroke-[3]" />
            </button>
          </div>

          {/* Preset Chips */}
          <div>
            <span className="text-[10px] font-black text-[#7A756D] uppercase tracking-wider block mb-1.5">Pilihan Cepat:</span>
            <div className="grid grid-cols-3 gap-1.5">
              {presetSpeeds.map((sec) => (
                <button key={sec} type="button" onClick={() => onChangeSpeedSeconds(sec)}
                  className={`py-1.5 px-2 rounded-xl border-2 border-[#1A1A1A] text-xs font-black transition-all flex items-center justify-center gap-1 ${
                    scrollSpeedSeconds === sec
                      ? 'bg-[#F6C945] shadow-[2px_2px_0px_#1A1A1A] -translate-y-0.5'
                      : 'bg-white hover:bg-[#FAF7F0] shadow-sm'
                  }`}>
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

      {/* ── Main Floating Dock ─────────────────────────────────────────────── */}
      <div
        className={`bg-[#F7F2E6] border-[3px] border-[#1A1A1A] rounded-[26px] shadow-[4px_4px_0px_#1A1A1A] flex flex-col items-center transition-all duration-300 ease-in-out ${
          isAutoScrolling ? 'p-1.5 gap-0' : 'p-1.5 sm:p-2 gap-2'
        }`}
      >
        {/* Drag Handle — pointer events attached directly for capture-based dragging */}
        <div
          onPointerDown={handleGripPointerDown}
          onPointerMove={handleGripPointerMove}
          onPointerUp={handleGripPointerUp}
          onPointerCancel={handleGripPointerUp}
          className="w-full flex justify-center pt-1 pb-1.5 cursor-grab active:cursor-grabbing touch-none select-none"
          title="Geser untuk memindahkan"
        >
          <GripVertical className="w-5 h-5 text-[#BFBAB0]" />
        </div>

        {/* ── COLLAPSED (playing): only Pause button ── */}
        {isAutoScrolling ? (
          <div className="relative flex flex-col items-center pb-1">
            <button
              type="button"
              onClick={onToggleAutoScroll}
              className="w-11 h-11 rounded-2xl bg-[#2E7D6E] text-white border-2 border-[#1A1A1A] flex items-center justify-center shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#1A1A1A] ring-2 ring-[#2E7D6E]/40 transition-all"
              title="Jeda Auto-Scroll"
              aria-label="Jeda Auto Scroll"
            >
              <Pause className="w-5 h-5 fill-white stroke-[2.5]" />
            </button>
            {/* Pulse indicator */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2E7D6E] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#2E7D6E] border border-white" />
            </span>
          </div>
        ) : (
          /* ── EXPANDED (stopped): all buttons ── */
          <>
            {/* 1. Jump to Top */}
            <button
              type="button"
              onClick={onScrollToTop}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-[#1A1A1A] flex items-center justify-center shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#1A1A1A] transition-all group"
              title="Menuju Gambar Pertama (Awal)"
              aria-label="Menuju Gambar Pertama"
            >
              <ChevronsUp className="w-5 h-5 stroke-[2.5] group-hover:-translate-y-0.5 transition-transform" />
            </button>

            {/* 2. Play button */}
            <button
              type="button"
              onClick={onToggleAutoScroll}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl border-2 border-[#1A1A1A] bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] flex items-center justify-center shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#1A1A1A] transition-all"
              title={`Mulai Auto-Scroll (Setiap ${scrollSpeedSeconds} detik)`}
              aria-label="Mulai Auto Scroll"
            >
              <Play className="w-5 h-5 fill-[#1A1A1A] stroke-[2.5] ml-0.5" />
            </button>

            {/* 3. Speed Pill */}
            <button
              type="button"
              onClick={() => setIsSpeedOpen(!isSpeedOpen)}
              className={`px-2 py-1 rounded-xl border-2 border-[#1A1A1A] text-[10px] font-black shadow-[1px_1px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-0.5 ${
                isSpeedOpen ? 'bg-[#F6C945] text-[#1A1A1A]' : 'bg-white hover:bg-[#FAF7F0] text-[#1A1A1A]'
              }`}
              title="Atur Kecepatan Auto-Scroll"
              aria-label="Atur Kecepatan Auto Scroll"
            >
              <Timer className="w-2.5 h-2.5" />
              <span>{scrollSpeedSeconds}s</span>
            </button>

            {/* 4. Jump to Bottom */}
            <button
              type="button"
              onClick={onScrollToBottom}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-[#1A1A1A] flex items-center justify-center shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#1A1A1A] transition-all group"
              title="Menuju Gambar Terakhir (Selesai)"
              aria-label="Menuju Gambar Terakhir"
            >
              <ChevronsDown className="w-5 h-5 stroke-[2.5] group-hover:translate-y-0.5 transition-transform" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
};
