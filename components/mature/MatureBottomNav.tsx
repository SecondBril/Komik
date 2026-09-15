'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Compass, Clock, LogOut, Skull } from 'lucide-react';

export function MatureBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isHome = pathname === '/mature';
  const isBrowse = pathname?.startsWith('/mature/browse');
  const isHistory = pathname?.startsWith('/history');

  const handleExitToNormal = () => {
    try {
      localStorage.removeItem('mature_unlocked');
    } catch {
      // Ignore
    }
    router.push('/');
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#090A0D]/95 backdrop-blur-xl border-t border-[#2E151A] px-3 py-2 shadow-[0_-5px_25px_rgba(0,0,0,0.8)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Beranda 18+ */}
        <Link
          href="/mature"
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
            isHome ? 'text-[#EF4444]' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <div className={`p-1 rounded-lg ${isHome ? 'bg-[#E53E3E]/20 text-[#EF4444]' : ''}`}>
            <Home className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black">Beranda 18+</span>
        </Link>

        {/* Jelajahi Gore */}
        <Link
          href="/mature/browse"
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
            isBrowse ? 'text-[#EF4444]' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <div className={`p-1 rounded-lg ${isBrowse ? 'bg-[#E53E3E]/20 text-[#EF4444]' : ''}`}>
            <Compass className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black">Katalog Gore</span>
        </Link>

        {/* Riwayat */}
        <Link
          href="/history"
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
            isHistory ? 'text-[#EF4444]' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <div className={`p-1 rounded-lg ${isHistory ? 'bg-[#E53E3E]/20 text-[#EF4444]' : ''}`}>
            <Clock className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black">Riwayat</span>
        </Link>

        {/* Keluar Mode 18+ */}
        <button
          type="button"
          onClick={handleExitToNormal}
          className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-gray-400 hover:text-emerald-400 transition-all"
        >
          <div className="p-1 rounded-lg hover:bg-white/10">
            <LogOut className="w-5 h-5 text-emerald-400" />
          </div>
          <span className="text-[10px] font-bold text-emerald-400">Normal</span>
        </button>
      </div>
    </div>
  );
}
