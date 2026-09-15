'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Skull, AlertTriangle, ShieldAlert, ArrowRight, X } from 'lucide-react';

export function SecretEightClickListener() {
  const router = useRouter();
  const pathname = usePathname();
  const [clickCount, setClickCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isAlreadyInMature = pathname?.startsWith('/mature');

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // Don't count clicks inside the modal itself
      if ((e.target as HTMLElement)?.closest('#secret-mature-modal')) {
        return;
      }

      setClickCount((prev) => {
        const next = prev + 1;

        // Reset timer on each click
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        // Auto reset after 3.5 seconds of inactivity
        timerRef.current = setTimeout(() => {
          setClickCount(0);
        }, 3500);

        if (next >= 8) {
          // Trigger secret unlock!
          try {
            // Optional ominous synth buzz with Web Audio API
            if (typeof window !== 'undefined' && 'AudioContext' in window) {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(110, ctx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.3);
              gain.gain.setValueAtTime(0.15, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.3);
            }
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate([40, 60, 40]);
            }
          } catch {
            // Ignore audio context restrictions
          }

          setIsOpen(true);
          return 0; // reset count
        }

        return next;
      });
    };

    // Use capture phase so clicks on interactive elements still count
    window.addEventListener('click', handleGlobalClick, true);

    return () => {
      window.removeEventListener('click', handleGlobalClick, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleEnterMature = () => {
    try {
      localStorage.setItem('mature_unlocked', 'true');
      localStorage.setItem('mature_age_verified', 'true');
    } catch {
      // Ignore
    }
    setIsOpen(false);
    router.push('/mature');
  };

  const handleReturnNormal = () => {
    setIsOpen(false);
    router.push('/');
  };

  return (
    <>
      {/* Easter Egg Click Pulse / Progress Pill (Appears at 4+ clicks) */}
      {clickCount >= 4 && !isOpen && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none animate-bounce">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1A0B0E] border-2 border-[#E53E3E] text-[#E53E3E] text-xs font-black shadow-[0_0_20px_rgba(229,62,62,0.6)]">
            <span className="w-2 h-2 rounded-full bg-[#E53E3E] animate-ping" />
            <span>KODE RAHASIA: {clickCount} / 8 KLIK</span>
          </div>
        </div>
      )}

      {/* Secret Access Modal */}
      {isOpen && (
        <div
          id="secret-mature-modal"
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-md bg-[#0F1117] border-2 border-[#E53E3E] rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(229,62,62,0.35)] text-white flex flex-col gap-5 overflow-hidden">
            {/* Background Red Ambient Glow */}
            <div className="absolute -top-16 -right-16 w-40 h-40 bg-[#E53E3E]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-[#7F1D1D]/30 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-start justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#E53E3E]/20 border border-[#E53E3E]/50 flex items-center justify-center text-[#E53E3E] shadow-inner">
                  {isAlreadyInMature ? (
                    <ShieldAlert className="w-6 h-6" />
                  ) : (
                    <Skull className="w-6 h-6 animate-pulse" />
                  )}
                </div>
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#E53E3E] text-[#0A0A0A] font-black text-[10px] tracking-wider uppercase mb-1">
                    SEKTOR 18+ RAHASIA
                  </span>
                  <h3 className="text-xl font-black text-white tracking-tight">
                    {isAlreadyInMature ? 'Keluar Mode 18+?' : 'Akses Terbuka: Sektor 18+'}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning Description */}
            <div className="bg-[#1A0C10] border border-[#E53E3E]/30 rounded-2xl p-4 flex flex-col gap-2 relative z-10 text-xs sm:text-sm text-gray-300 leading-relaxed">
              <div className="flex items-center gap-2 text-[#EF4444] font-bold text-xs uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Peringatan Konten Ekstrem (Gore & Mature)</span>
              </div>
              <p>
                Anda membuka portal tersembunyi untuk membaca komik khusus usia <strong>18 tahun ke atas</strong>. Halaman ini memuat tema kekerasan eksplisit (gore), mutilasi, adegan sadis, kanibalisme, dan psikologis gelap.
              </p>
              <p className="text-[11px] text-gray-400">
                Apakah Anda menyatakan telah berusia 18 tahun ke atas dan setuju masuk ke portal Dark Mode 18+?
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 relative z-10 pt-2">
              {isAlreadyInMature ? (
                <>
                  <button
                    type="button"
                    onClick={handleReturnNormal}
                    className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#2E7D6E] to-[#236357] text-white font-extrabold text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <span>Kembali ke Chameleon Biasa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-full sm:w-auto py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 font-bold text-sm transition-colors"
                  >
                    Tetap di Sini
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleEnterMature}
                    className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#E53E3E] to-[#991B1B] text-white font-extrabold text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(229,62,62,0.4)]"
                  >
                    <span>Masuk ke Area 18+</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-full sm:w-auto py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 font-bold text-sm transition-colors"
                  >
                    Batal
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
