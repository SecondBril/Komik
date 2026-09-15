'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MatureNavbar } from '@/components/mature/MatureNavbar';
import { MatureBottomNav } from '@/components/mature/MatureBottomNav';
import { Skull, ShieldAlert, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function MatureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  // Check if current route is a chapter reader page (e.g., /mature/komik/slug/47)
  const isReaderPage = pathname ? /^\/mature\/komik\/[^\/]+\/[^\/]+\/?$/.test(pathname) : false;

  useEffect(() => {
    try {
      const unlocked = localStorage.getItem('mature_unlocked');
      const verified = localStorage.getItem('mature_age_verified');
      if (unlocked === 'true' || verified === 'true') {
        setIsVerified(true);
      } else {
        setIsVerified(false);
      }
    } catch {
      setIsVerified(true);
    }
  }, []);

  const handleConfirmAge = () => {
    try {
      localStorage.setItem('mature_unlocked', 'true');
      localStorage.setItem('mature_age_verified', 'true');
    } catch {
      // Ignore
    }
    setIsVerified(true);
  };

  const handleReturnHome = () => {
    router.push('/');
  };

  // Reader mode layout (pure full screen dark)
  if (isReaderPage) {
    return (
      <div className="min-h-screen bg-[#000000] text-[#F3F4F6] selection:bg-[#E53E3E]/40 selection:text-white">
        {children}
      </div>
    );
  }

  // Age Gate Barrier if not yet verified/unlocked
  if (isVerified === false) {
    return (
      <div className="min-h-screen bg-[#07080B] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0F1118] border-2 border-[#E53E3E]/70 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(229,62,62,0.3)] flex flex-col gap-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#E53E3E]/20 border border-[#E53E3E] text-[#EF4444] flex items-center justify-center mx-auto shadow-inner">
            <Skull className="w-8 h-8 animate-pulse" />
          </div>

          <div className="flex flex-col gap-1">
            <span className="px-3 py-1 rounded-full bg-[#E53E3E] text-black font-black text-xs uppercase tracking-wider mx-auto">
              SEKTOR 18+ TERPROTEKSI
            </span>
            <h1 className="text-2xl font-black text-white mt-2">
              Konfirmasi Usia 18+
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1 leading-relaxed">
              Anda memasuki portal komik khusus dewasa dengan konten kekerasan eksplisit (gore), mutilasi, dan adegan psikologis gelap.
            </p>
          </div>

          <div className="bg-[#190C10] border border-[#E53E3E]/30 rounded-2xl p-4 text-xs text-left text-gray-300 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 font-bold text-red-400">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Ketentuan Akses:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-gray-400 text-[11px]">
              <li>Berusia minimal 18 tahun secara legal</li>
              <li>Memahami dan menyetujui materi kekerasan grafis & gore</li>
              <li>Tidak diperuntukkan bagi yang sensitif terhadap darah</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleConfirmAge}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#E53E3E] to-[#991B1B] text-white font-extrabold text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(229,62,62,0.4)]"
            >
              Saya Berusia 18+ (Masuk)
            </button>
            <button
              type="button"
              onClick={handleReturnHome}
              className="w-full sm:w-auto py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 font-bold text-sm transition-colors"
            >
              Kembali
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0A0B0E] text-[#F3F4F6] selection:bg-[#E53E3E]/40 selection:text-white overflow-x-clip font-sans">
      <MatureNavbar />

      <main className="flex-1 w-full max-w-6xl mx-auto pb-20 relative px-4 sm:px-6">
        {children}
      </main>

      {/* Footer in Dark Mode */}
      <footer className="bg-[#07080B] border-t border-[#231216] py-8 text-center text-xs text-gray-400 mb-16 sm:mb-0">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-1">
            <p className="font-extrabold text-gray-200">
              Chameleon Comics — 18+ Gore & Mature Dark Vault.
            </p>
            <p className="text-[11px] text-gray-500">
              Seluruh komik di sektor ini ditujukan secara ketat bagi pembaca dewasa 18 tahun ke atas.
            </p>
          </div>
          <div className="flex items-center gap-4 font-bold text-gray-300">
            <Link href="/mature" className="hover:text-[#EF4444] transition-colors">Beranda 18+</Link>
            <Link href="/mature/browse" className="hover:text-[#EF4444] transition-colors">Katalog Gore</Link>
            <Link href="/" className="hover:text-emerald-400 transition-colors">Kembali ke Mode Normal</Link>
          </div>
        </div>
      </footer>

      {/* Floating Bottom Nav for Mobile */}
      <MatureBottomNav />
    </div>
  );
}
