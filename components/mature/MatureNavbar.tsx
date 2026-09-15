'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Skull, Compass, Clock, LogOut, ShieldAlert, Sparkles } from 'lucide-react';

export function MatureNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  const isHome = pathname === '/mature';
  const isBrowse = pathname?.startsWith('/mature/browse');
  const isHistory = pathname?.startsWith('/mature/history');

  const handleExitToNormal = () => {
    try {
      localStorage.removeItem('mature_unlocked');
    } catch {
      // Ignore
    }
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#090A0D]/95 backdrop-blur-md border-b border-[#2E151A] shadow-[0_4px_25px_rgba(0,0,0,0.8)]">
      {/* Top Advisory Bar */}
      <div className="bg-gradient-to-r from-[#3B0B11] via-[#5C101B] to-[#3B0B11] py-1 px-4 text-center text-[11px] font-bold text-red-200 flex items-center justify-center gap-2 border-b border-red-900/40">
        <ShieldAlert className="w-3.5 h-3.5 text-[#EF4444] shrink-0 animate-pulse" />
        <span>AREA 18+ KHUSUS DEWASA — MEMUAT KONTEN GORE, HORROR & KEKERASAN INTENS</span>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <Link
          href="/mature"
          className="flex items-center gap-2.5 group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E53E3E] to-[#7F1D1D] flex items-center justify-center text-white border border-[#EF4444]/60 shadow-[0_0_12px_rgba(229,62,62,0.5)] group-hover:scale-105 transition-transform">
            <Skull className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg tracking-tight text-white group-hover:text-[#EF4444] transition-colors">
                CHAMELEON
              </span>
              <span className="px-1.5 py-0.2 rounded bg-[#E53E3E] text-black text-[10px] font-black tracking-wider uppercase">
                18+
              </span>
            </div>
            <span className="text-[10px] font-bold text-red-400/80 -mt-1 tracking-widest uppercase">
              Gore & Dark Vault
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-2">
          <Link
            href="/mature"
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
              isHome
                ? 'bg-[#E53E3E]/15 text-[#EF4444] border border-[#E53E3E]/40 shadow-[0_0_10px_rgba(229,62,62,0.2)]'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Beranda 18+
          </Link>

          <Link
            href="/mature/browse"
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              isBrowse
                ? 'bg-[#E53E3E]/15 text-[#EF4444] border border-[#E53E3E]/40 shadow-[0_0_10px_rgba(229,62,62,0.2)]'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Katalog Gore</span>
          </Link>

          <Link
            href="/history"
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              isHistory
                ? 'bg-[#E53E3E]/15 text-[#EF4444] border border-[#E53E3E]/40'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Riwayat</span>
          </Link>
        </nav>

        {/* Quick Exit to Normal Mode Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExitToNormal}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-[#171A24] hover:bg-[#202534] border border-gray-700 text-gray-200 hover:text-white text-xs font-bold transition-all active:scale-95 shadow-sm"
            title="Keluar dari mode 18+ dan kembali ke situs utama"
          >
            <LogOut className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Keluar ke Mode Normal</span>
            <span className="sm:hidden">Keluar 18+</span>
          </button>
        </div>
      </div>
    </header>
  );
}
