'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/navbar/Navbar';
import { BottomNav } from '@/components/navbar/BottomNav';
import Link from 'next/link';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Check if current route is a chapter reader page (e.g., /komik/slug/47)
  const isReaderPage = pathname ? /^\/komik\/[^\/]+\/\d+$/.test(pathname) : false;

  if (isReaderPage) {
    return (
      <div className="min-h-screen bg-[#F7F2E6] text-[#1A1A1A]">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F2E6] text-[#1A1A1A] selection:bg-[#F6C945] selection:text-[#1A1A1A]">
      <Navbar />
      <main className="flex-1 w-full max-w-5xl mx-auto pb-16">
        {children}
      </main>

      {/* Footer on desktop */}
      <footer className="bg-white border-t-2 border-[#1A1A1A] py-6 text-center text-xs text-[#7A756D] mb-12 sm:mb-0">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-extrabold text-[#1A1A1A]">
            © 2026 Chameleon Comics — Platform Baca Komik & Manga Paling Seru.
          </p>
          <div className="flex items-center gap-4 font-bold text-[#1A1A1A]">
            <Link href="/" className="hover:text-[#2E7D6E]">Beranda</Link>
            <Link href="/browse" className="hover:text-[#2E7D6E]">Categories</Link>
            <Link href="/history" className="hover:text-[#2E7D6E]">Favorites & Bag</Link>
            <Link href="/login" className="hover:text-[#2E7D6E]">Log in</Link>
          </div>
        </div>
      </footer>

      {/* Floating Bottom Navigation Bar for Mobile & Quick Tabs */}
      <BottomNav />
    </div>
  );
}
