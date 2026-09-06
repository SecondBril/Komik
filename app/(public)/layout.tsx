import React from 'react';
import { Navbar } from '@/components/navbar/Navbar';
import Link from 'next/link';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#0F1115] text-[#F2F3F5]">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
      <footer className="bg-[#171A21] border-t border-[#2A2F3A] py-8 text-center text-xs text-[#9AA0AC] mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 KomikIndo — Platform Baca Komik Manga, Manhwa, Manhua Bahasa Indonesia.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-white">Beranda</Link>
            <Link href="/browse" className="hover:text-white">Katalog</Link>
            <Link href="/history" className="hover:text-white">Riwayat</Link>
            <Link href="/admin" className="hover:text-amber-400">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
