import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getMatureComics, getMatureGenresWithCounts } from '@/lib/queries/mature-comics';
import { MatureComicCard } from '@/components/mature/MatureComicCard';
import {
  Skull,
  Flame,
  Clock,
  Compass,
  ArrowRight,
  ShieldAlert,
  AlertTriangle,
  BookOpen,
  Star,
  Sparkles,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MatureHomePage() {
  const [comics, genresWithCounts] = await Promise.all([
    getMatureComics(),
    getMatureGenresWithCounts(),
  ]);

  const featured = comics[0];
  const popularComics = [...comics].sort((a, b) => b.rating - a.rating);
  const latestComics = [...comics].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return (
    <div className="flex flex-col gap-10 pt-6">
      {/* 1. Hero Spotlight: Featured Mature Title */}
      {featured && (
        <div className="relative w-full rounded-3xl overflow-hidden border-2 border-[#3A171D] bg-gradient-to-r from-[#170B0E] via-[#1F0E13] to-[#0D0F16] p-6 sm:p-10 shadow-[0_10px_40px_rgba(229,62,62,0.15)] flex flex-col md:flex-row items-center gap-8">
          {/* Subtle Ambient Red Glow */}
          <div className="absolute top-0 right-1/4 w-72 h-72 bg-[#E53E3E]/15 rounded-full blur-3xl pointer-events-none" />

          {/* Left Text Column */}
          <div className="flex-1 flex flex-col items-start gap-4 z-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#E53E3E] text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                <Skull className="w-3.5 h-3.5" />
                <span>18+ MATURE SPOTLIGHT</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-[#7F1D1D]/70 border border-red-500/60 text-red-200 font-extrabold text-xs">
                {featured.gore_level} Gore Rating
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              {featured.title}
            </h1>

            <p className="text-gray-300 text-xs sm:text-sm leading-relaxed max-w-xl line-clamp-3">
              {featured.synopsis}
            </p>

            {/* Warning tags */}
            {featured.content_warnings && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {featured.content_warnings.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-semibold text-red-300 bg-red-950/60 border border-red-800/40 px-2.5 py-0.5 rounded-md"
                  >
                    ⚠️ {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-3">
              <Link
                href={`/mature/komik/${featured.slug}`}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#E53E3E] to-[#991B1B] text-white font-black text-xs sm:text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 shadow-[0_0_25px_rgba(229,62,62,0.45)]"
              >
                <BookOpen className="w-4 h-4" />
                <span>Mulai Baca Sekarang</span>
              </Link>
              <Link
                href="/mature/browse"
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-gray-200 font-bold text-xs sm:text-sm transition-colors flex items-center gap-1.5 border border-white/10"
              >
                <Compass className="w-4 h-4" />
                <span>Jelajahi Koleksi 18+</span>
              </Link>
            </div>
          </div>

          {/* Right Cover Preview */}
          <div className="relative w-44 sm:w-56 aspect-[2/3] shrink-0 rounded-2xl overflow-hidden border-2 border-[#E53E3E]/50 shadow-[0_8px_30px_rgba(0,0,0,0.8)] z-10 group">
            <Image
              src={featured.cover_url}
              alt={featured.title}
              fill
              priority
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-bold">
              <span className="bg-black/80 px-2 py-0.5 rounded border border-white/10 uppercase">
                {featured.type}
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                {Number(featured.rating).toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Quick Mature Genres Filter Pill Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skull className="w-4 h-4 text-[#EF4444]" />
            <h2 className="text-sm sm:text-base font-black text-white tracking-wide uppercase">
              Kategori Khusus 18+
            </h2>
          </div>
          <Link
            href="/mature/browse"
            className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <span>Semua Kategori</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <Link
            href="/mature/browse"
            className="shrink-0 px-4 py-2 rounded-xl bg-[#E53E3E] text-black font-black text-xs shadow-md hover:brightness-110 transition-all"
          >
            Semua Komik 18+
          </Link>
          {genresWithCounts.map((g) => (
            <Link
              key={g.id}
              href={`/mature/browse?genre=${g.id}`}
              className="shrink-0 px-4 py-2 rounded-xl bg-[#141620] hover:bg-[#1F2332] border border-[#2B171C] text-gray-300 hover:text-white font-bold text-xs transition-all flex items-center gap-1.5"
            >
              <span>{g.name}</span>
              <span className="text-[10px] text-gray-500 bg-black/40 px-1.5 py-0.2 rounded-full">
                {g.count}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* 3. Popular Mature Comics Grid */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#EF4444]" />
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Komik Gore Paling Dicari
              </h2>
              <p className="text-xs text-gray-400">
                Peringkat tertinggi komik mature dengan alur cerita intens dan grafis brutal
              </p>
            </div>
          </div>
          <Link
            href="/mature/browse?sort=popular"
            className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <span>Lihat Semua</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {popularComics.map((comic) => (
            <MatureComicCard key={comic.id} comic={comic} />
          ))}
        </div>
      </section>

      {/* 4. Latest Update Grid */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#EF4444]" />
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Update Chapter Terbaru 18+
              </h2>
              <p className="text-xs text-gray-400">
                Rilis chapter baru tanpa sensor untuk serial ongoing
              </p>
            </div>
          </div>
          <Link
            href="/mature/browse?sort=latest"
            className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <span>Semua Update</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {latestComics.map((comic) => (
            <MatureComicCard key={comic.id} comic={comic} />
          ))}
        </div>
      </section>

      {/* 5. Responsible Reading & Content Advisory Box */}
      <div className="bg-[#12141D] border border-red-900/40 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800 text-red-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h3 className="font-extrabold text-sm text-white">
              Peringatan Konten & Kebijakan Privasi
            </h3>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              Daftar komik di halaman ini dipisahkan dari katalog reguler. Akses hanya diberikan melalui gesture klik 8 kali atau konfirmasi umur. Harap bijak saat membaca.
            </p>
          </div>
        </div>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 text-xs font-bold shrink-0 border border-white/5 transition-colors"
        >
          Tinggalkan Mode 18+
        </Link>
      </div>
    </div>
  );
}
