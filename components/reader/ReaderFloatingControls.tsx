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
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';

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
  isVisible?: boolean;
}

const STORAGE_KEY = 'chameleon_reader_controller_pos';
const DOCK_WIDTH = 58;
const DOCK_HEIGHT_STOPPED = 280;
const DOCK_HEIGHT_PLAYING = 126;

const clampPosition = (
  right: number,
  top: number,
  isPlaying: boolean,
  windowWidth: number,
  windowHeight: number
) => {
  const dockHeight = isPlaying ? DOCK_HEIGHT_PLAYING : DOCK_HEIGHT_STOPPED;
  const minRight = 12;
  const maxRight = Math.max(minRight, windowWidth - DOCK_WIDTH - 12);
  const minTop = 64; // Under top ChapterNav
  const maxTop = Math.max(minTop, windowHeight - dockHeight - 16);

  return {
    x: Math.max(minRight, Math.min(maxRight, right)),
    y: Math.max(minTop, Math.min(maxTop, top)),
  };
};

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
  isVisible = true,
}) => {
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 16, y: 140 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSpeedOpen, setIsSpeedOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const asideRef = useRef<HTMLElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const justDraggedRef = useRef(false);

  const dragDataRef = useRef({
    isDown: false,
    hasMoved: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    initialX: 16,
    initialY: 140,
    currentX: 16,
    currentY: 140,
    rafId: 0,
  });

  // ── Load saved position from localStorage or calculate default ─────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const clamped = clampPosition(
            parsed.x,
            parsed.y,
            isAutoScrolling,
            window.innerWidth,
            window.innerHeight
          );
          setPos(clamped);
          dragDataRef.current.currentX = clamped.x;
          dragDataRef.current.currentY = clamped.y;
          return;
        }
      }
    } catch {
      // ignore
    }

    // Default position: bottom-right area thumb friendly
    const defaultTop = Math.max(80, window.innerHeight - DOCK_HEIGHT_STOPPED - 70);
    const initialClamped = clampPosition(16, defaultTop, isAutoScrolling, window.innerWidth, window.innerHeight);
    setPos(initialClamped);
    dragDataRef.current.currentX = initialClamped.x;
    dragDataRef.current.currentY = initialClamped.y;
  }, []);

  // ── Auto-adjust bounds when collapsing / expanding on play state change ────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPos((prev) => {
      const clamped = clampPosition(
        prev.x,
        prev.y,
        isAutoScrolling,
        window.innerWidth,
        window.innerHeight
      );
      if (clamped.x !== prev.x || clamped.y !== prev.y) {
        dragDataRef.current.currentX = clamped.x;
        dragDataRef.current.currentY = clamped.y;
        return clamped;
      }
      return prev;
    });
  }, [isAutoScrolling]);

  // ── Handle window resize / orientation changes ─────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setPos((prev) => {
        const clamped = clampPosition(
          prev.x,
          prev.y,
          isAutoScrolling,
          window.innerWidth,
          window.innerHeight
        );
        dragDataRef.current.currentX = clamped.x;
        dragDataRef.current.currentY = clamped.y;
        return clamped;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAutoScrolling]);

  // ── Close speed popover if controls hidden and not auto-scrolling ──────────
  useEffect(() => {
    if (!isVisible && !isAutoScrolling) {
      setIsSpeedOpen(false);
    }
  }, [isVisible, isAutoScrolling]);

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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSpeedOpen]);

  // ── Clean up pending rAF on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (dragDataRef.current.rafId) {
        cancelAnimationFrame(dragDataRef.current.rafId);
      }
    };
  }, []);

  // ── High-Performance Drag Physics (120 FPS / Zero lag) ─────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left click or primary touch only
    e.stopPropagation();

    dragDataRef.current = {
      isDown: true,
      hasMoved: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initialX: pos.x,
      initialY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
      rafId: 0,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const data = dragDataRef.current;
    if (!data.isDown) return;

    const dx = e.clientX - data.startX;
    const dy = e.clientY - data.startY;
    const distance = Math.hypot(dx, dy);

    // Filter minor finger trembles (< 5px) to preserve crisp button clicks
    if (!data.hasMoved) {
      if (distance < 5) return;
      data.hasMoved = true;
      setIsDragging(true);

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    if (typeof window === 'undefined') return;

    const targetX = data.initialX - dx;
    const targetY = data.initialY + dy;
    const clamped = clampPosition(
      targetX,
      targetY,
      isAutoScrolling,
      window.innerWidth,
      window.innerHeight
    );

    data.currentX = clamped.x;
    data.currentY = clamped.y;

    // Use requestAnimationFrame for direct 120fps GPU transformation without React re-render lag
    if (!data.rafId) {
      data.rafId = requestAnimationFrame(() => {
        if (asideRef.current) {
          asideRef.current.style.right = `${data.currentX}px`;
          asideRef.current.style.top = `${data.currentY}px`;
        }
        data.rafId = 0;
      });
    }
  };

  const endDrag = (currentTarget: HTMLDivElement | null, pointerId: number) => {
    const data = dragDataRef.current;
    if (!data.isDown) return;

    if (data.rafId) {
      cancelAnimationFrame(data.rafId);
      data.rafId = 0;
    }

    if (currentTarget && pointerId >= 0) {
      try {
        if (currentTarget.hasPointerCapture(pointerId)) {
          currentTarget.releasePointerCapture(pointerId);
        }
      } catch {
        // ignore
      }
    }

    if (data.hasMoved) {
      justDraggedRef.current = true;
      const finalPos = { x: data.currentX, y: data.currentY };
      setPos(finalPos);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalPos));
      } catch {
        // ignore
      }

      // Suppress accidental button click triggered by drag release
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 150);
    }

    data.isDown = false;
    data.hasMoved = false;
    setIsDragging(false);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    endDrag(e.currentTarget, e.pointerId);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    endDrag(e.currentTarget, e.pointerId);
  };

  // Safe click wrapper to prevent triggering clicks after dragging
  const createClickHandler = (fn?: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (justDraggedRef.current) return;
    fn?.();
  };

  const presetSpeeds = [1, 2, 3, 5, 8, 10];

  const handleDecreaseSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scrollSpeedSeconds > 1) onChangeSpeedSeconds(scrollSpeedSeconds - 1);
  };

  const handleIncreaseSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scrollSpeedSeconds < 15) onChangeSpeedSeconds(scrollSpeedSeconds + 1);
  };

  const shouldShow = isAutoScrolling || isVisible;

  // Popover positioning relative to screen boundaries
  const popoverFlipsDown =
    typeof window !== 'undefined' && pos.y <= window.innerHeight * 0.45;
  const popoverOpensLeft =
    typeof window === 'undefined' || pos.x <= window.innerWidth * 0.5;

  return (
    <aside
      ref={asideRef}
      aria-label="Kontrol Navigasi & Auto-Scroll Pembaca"
      style={{
        right: `${pos.x}px`,
        top: `${pos.y}px`,
      }}
      className={`fixed z-40 flex flex-col items-center select-none touch-none ${
        isDragging
          ? 'pointer-events-auto transition-none'
          : 'transition-all duration-300 ease-out'
      } ${
        shouldShow
          ? 'opacity-100 scale-100 pointer-events-auto'
          : 'opacity-0 scale-90 pointer-events-none'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Speed Configuration Popover ─────────────────────────────────── */}
      {isSpeedOpen && (
        <div
          ref={popoverRef}
          onPointerDown={(e) => e.stopPropagation()}
          className={`absolute w-64 sm:w-72 bg-[#F7F2E6] dark:bg-[#181A20] text-[#1A1A1A] dark:text-[#F2F3F5] border-[3px] border-[#1A1A1A] dark:border-[#2D323E] rounded-[24px] p-4 shadow-[5px_5px_0px_#1A1A1A] dark:shadow-[5px_5px_0px_#000000] duration-150 z-50 flex flex-col gap-3 max-h-[85vh] overflow-y-auto ${
            popoverOpensLeft
              ? 'right-14 sm:right-16 slide-in-from-right-2'
              : 'left-14 sm:left-16 slide-in-from-left-2'
          } ${
            popoverFlipsDown
              ? 'top-0 sm:top-2 animate-in fade-in'
              : 'bottom-0 animate-in fade-in'
          }`}
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2 border-b-2 border-[#1A1A1A] dark:border-[#2D323E]">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-[#F6C945] border border-[#1A1A1A] dark:border-[#2D323E] flex items-center justify-center">
                <Timer className="w-3.5 h-3.5 text-[#1A1A1A]" />
              </div>
              <span className="text-xs font-black tracking-tight text-[#1A1A1A] dark:text-[#F2F3F5]">
                Kecepatan Auto-Scroll
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsSpeedOpen(false)}
              className="w-6 h-6 rounded-full bg-white dark:bg-[#222530] hover:bg-[#FAF7F0] dark:hover:bg-[#2A2E3D] border border-[#1A1A1A] dark:border-[#2D323E] flex items-center justify-center text-[#1A1A1A] dark:text-[#F2F3F5] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Stepper Display */}
          <div className="flex items-center justify-between bg-white dark:bg-[#121316] border-2 border-[#1A1A1A] dark:border-[#2D323E] rounded-2xl p-2 shadow-inner">
            <button
              type="button"
              onClick={handleDecreaseSpeed}
              disabled={scrollSpeedSeconds <= 1}
              className="w-8 h-8 rounded-xl bg-[#F7F2E6] dark:bg-[#222530] hover:bg-[#FAF7F0] dark:hover:bg-[#2A2E3D] border border-[#1A1A1A] dark:border-[#2D323E] text-[#1A1A1A] dark:text-[#F2F3F5] flex items-center justify-center font-black disabled:opacity-30 disabled:cursor-not-allowed shadow-[1px_1px_0px_#1A1A1A] dark:shadow-[1px_1px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px]"
              title="Kurang 1 detik"
            >
              <Minus className="w-4 h-4 stroke-[3]" />
            </button>
            <div className="flex flex-col items-center">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-[#1A1A1A] dark:text-[#F2F3F5]">
                  {scrollSpeedSeconds}
                </span>
                <span className="text-[11px] font-bold text-[#7A756D] dark:text-[#9CA3AF]">
                  detik
                </span>
              </div>
              <span className="text-[9px] font-bold text-[#2E7D6E] dark:text-[#38D9A9]">
                {readMode === 'scroll' ? 'detik / layar (smooth)' : 'detik / halaman'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleIncreaseSpeed}
              disabled={scrollSpeedSeconds >= 15}
              className="w-8 h-8 rounded-xl bg-[#F7F2E6] dark:bg-[#222530] hover:bg-[#FAF7F0] dark:hover:bg-[#2A2E3D] border border-[#1A1A1A] dark:border-[#2D323E] text-[#1A1A1A] dark:text-[#F2F3F5] flex items-center justify-center font-black disabled:opacity-30 disabled:cursor-not-allowed shadow-[1px_1px_0px_#1A1A1A] dark:shadow-[1px_1px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px]"
              title="Tambah 1 detik"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
            </button>
          </div>

          {/* Preset Chips */}
          <div>
            <span className="text-[10px] font-black text-[#7A756D] dark:text-[#9CA3AF] uppercase tracking-wider block mb-1.5">
              Pilihan Cepat:
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {presetSpeeds.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onChangeSpeedSeconds(sec)}
                  className={`py-1.5 px-2 rounded-xl border-2 border-[#1A1A1A] dark:border-[#2D323E] text-xs font-black transition-all flex items-center justify-center gap-1 ${
                    scrollSpeedSeconds === sec
                      ? 'bg-[#F6C945] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] dark:shadow-[2px_2px_0px_#000000] -translate-y-0.5'
                      : 'bg-white dark:bg-[#222530] hover:bg-[#FAF7F0] dark:hover:bg-[#2A2E3D] text-[#1A1A1A] dark:text-[#F2F3F5] shadow-sm'
                  }`}
                >
                  <span>{sec}s</span>
                  {scrollSpeedSeconds === sec && <Check className="w-3 h-3 stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Hint */}
          <div className="px-2.5 py-1.5 rounded-xl bg-[#E6F4EA] dark:bg-[#1B3830] border border-[#1A1A1A] dark:border-[#2D323E] text-[10px] font-bold text-[#2E7D6E] dark:text-[#38D9A9] flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 shrink-0" />
            <span>
              {readMode === 'scroll'
                ? 'Scroll continuous halus dan konstan tanpa patah-patah.'
                : 'Halaman akan berbalik otomatis setiap interval detik.'}
            </span>
          </div>
        </div>
      )}

      {/* ── Main Floating Controller Dock ────────────────────────────────── */}
      <div
        ref={dockRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className={`bg-[#F7F2E6] dark:bg-[#181A20] border-[3px] border-[#1A1A1A] dark:border-[#2D323E] rounded-[26px] flex flex-col items-center select-none touch-none ${
          isDragging
            ? 'shadow-[6px_6px_0px_#1A1A1A] dark:shadow-[6px_6px_0px_#000000] scale-[1.03] ring-2 ring-[#F6C945] cursor-grabbing'
            : 'shadow-[4px_4px_0px_#1A1A1A] dark:shadow-[4px_4px_0px_#000000] hover:shadow-[5px_5px_0px_#1A1A1A] dark:hover:shadow-[5px_5px_0px_#000000] transition-all duration-200 cursor-grab'
        } ${
          isAutoScrolling ? 'p-1.5 gap-1.5' : 'p-1.5 sm:p-2 gap-2'
        }`}
        title="Tahan & geser untuk memindahkan posisi kontroler"
      >
        {/* 1. Drag Grabber Handle */}
        <div
          className="w-full flex items-center justify-center pt-1 pb-1 cursor-grab active:cursor-grabbing touch-none select-none group"
          title="Tahan & geser untuk memindahkan posisi"
        >
          <div
            className={`w-7 h-1.5 rounded-full transition-colors ${
              isDragging
                ? 'bg-[#F6C945]'
                : 'bg-[#BFBAB0] dark:bg-[#525866] group-hover:bg-[#F6C945]'
            }`}
          />
        </div>

        {/* 2. Play / Pause Button (Anchored in same position so it NEVER jumps) */}
        <div className="relative flex flex-col items-center">
          <button
            type="button"
            onClick={createClickHandler(onToggleAutoScroll)}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl border-2 border-[#1A1A1A] dark:border-[#2D323E] flex items-center justify-center shadow-[2px_2px_0px_#1A1A1A] dark:shadow-[2px_2px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] transition-all ${
              isAutoScrolling
                ? 'bg-[#2E7D6E] hover:bg-[#25685B] text-white ring-2 ring-[#2E7D6E]/40'
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

          {/* Active status pulse in play mode */}
          {isAutoScrolling && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3 pointer-events-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2E7D6E] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#2E7D6E] border-2 border-white dark:border-[#181A20]" />
            </span>
          )}
        </div>

        {/* 3. Speed Pill (Accessible in both Stopped & Playing modes) */}
        <button
          type="button"
          onClick={createClickHandler(() => setIsSpeedOpen((prev) => !prev))}
          className={`px-2 py-1 rounded-xl border-2 border-[#1A1A1A] dark:border-[#2D323E] text-[10px] font-black shadow-[1px_1px_0px_#1A1A1A] dark:shadow-[1px_1px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-0.5 ${
            isSpeedOpen
              ? 'bg-[#F6C945] text-[#1A1A1A]'
              : 'bg-white dark:bg-[#222530] hover:bg-[#FAF7F0] dark:hover:bg-[#2A2E3D] text-[#1A1A1A] dark:text-[#F2F3F5]'
          }`}
          title="Atur Kecepatan Auto-Scroll"
          aria-label="Atur Kecepatan Auto Scroll"
        >
          <Timer className="w-2.5 h-2.5" />
          <span>{scrollSpeedSeconds}s</span>
        </button>

        {/* 4. Secondary Navigation Buttons (Collapsed in play mode to minimize screen occlusion) */}
        {!isAutoScrolling && (
          <div className="flex flex-col items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Jump to First Image */}
            <button
              type="button"
              onClick={createClickHandler(onScrollToTop)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white dark:bg-[#222530] hover:bg-[#FAF7F0] dark:hover:bg-[#2A2E3D] border-2 border-[#1A1A1A] dark:border-[#2D323E] text-[#1A1A1A] dark:text-[#F2F3F5] flex items-center justify-center shadow-[2px_2px_0px_#1A1A1A] dark:shadow-[2px_2px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] transition-all group"
              title="Menuju Gambar Pertama (Awal)"
              aria-label="Menuju Gambar Pertama"
            >
              <ChevronsUp className="w-5 h-5 stroke-[2.5] group-hover:-translate-y-0.5 transition-transform" />
            </button>

            {/* Jump to Last Image */}
            <button
              type="button"
              onClick={createClickHandler(onScrollToBottom)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white dark:bg-[#222530] hover:bg-[#FAF7F0] dark:hover:bg-[#2A2E3D] border-2 border-[#1A1A1A] dark:border-[#2D323E] text-[#1A1A1A] dark:text-[#F2F3F5] flex items-center justify-center shadow-[2px_2px_0px_#1A1A1A] dark:shadow-[2px_2px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] transition-all group"
              title="Menuju Gambar Terakhir (Selesai)"
              aria-label="Menuju Gambar Terakhir"
            >
              <ChevronsDown className="w-5 h-5 stroke-[2.5] group-hover:translate-y-0.5 transition-transform" />
            </button>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={createClickHandler(toggleTheme)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white dark:bg-[#222530] hover:bg-[#FAF7F0] dark:hover:bg-[#2A2E3D] border-2 border-[#1A1A1A] dark:border-[#2D323E] text-[#1A1A1A] dark:text-[#F2F3F5] flex items-center justify-center shadow-[2px_2px_0px_#1A1A1A] dark:shadow-[2px_2px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] transition-all"
              title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
              aria-label="Ganti Tema"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#F6C945] stroke-[2.5]" />
              ) : (
                <Moon className="w-4 h-4 text-[#1A1A1A] stroke-[2.5]" />
              )}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
