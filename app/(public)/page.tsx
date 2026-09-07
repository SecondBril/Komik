import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getComics, getGenresWithCounts } from '@/lib/queries/comics';
import { ComicCard } from '@/components/comic/ComicCard';
import { ChameleonMascot } from '@/components/ui/ChameleonMascot';
import { DecorativeBlobs } from '@/components/ui/DecorativeBlobs';
import { Sparkles, Flame, Clock, ChevronRight, Compass, ArrowRight, Star } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [comics, allGenresWithCounts] = await Promise.all([
    getComics(),
    getGenresWithCounts(),
  ]);

  const latestComics = [...comics].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  const popularComics = [...comics].sort((a, b) => b.rating - a.rating);
  const featuredComic = popularComics[0] || comics[0];

  // Sort genres by actual comic count from database descending, take top 6
  const categoriesWithCounts = [...allGenresWithCounts]
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 6);

  return (
    <div className="relative min-h-screen pb-16 px-4 sm:px-6 lg:px-8 pt-3 flex flex-col gap-8 max-w-6xl mx-auto">
      <DecorativeBlobs variant="general" />

      {/* 1. Brand Hero / Mascot Welcome Banner */}
      <div className="relative w-full bg-[#2E7D6E] rounded-[28px] sm:rounded-[36px] border-[3px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] sm:shadow-[5px_5px_0px_#1A1A1A] p-4 sm:p-8 flex flex-row items-center justify-between gap-3 sm:gap-6 overflow-hidden z-10">

        {/* Kolom Teks (Kiri) */}
        <div className="flex flex-col items-start text-left gap-1.5 sm:gap-2 z-10 flex-1 min-w-0">
          <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] text-[10px] sm:text-xs font-black text-[#1A1A1A] shadow-sm">
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="truncate">Baca Komik Cepat & Hemat Data</span>
          </div>

          <h1 className="text-lg sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
            Chameleon Comics
          </h1>

          <p className="text-[11px] sm:text-sm text-white/90 max-w-md font-medium line-clamp-2 sm:line-clamp-none">
            Jelajahi ribuan chapter komik favoritmu dengan format WebP super cepat dan visual neo-comic paling seru!
          </p>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1 sm:pt-2">
            <Link
              href="/browse"
              className="px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] font-black text-[10px] sm:text-xs border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Jelajahi Kategori</span>
            </Link>
            <Link
              href="/history"
              className="px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-full bg-white hover:bg-[#FAF7F0] text-[#1A1A1A] font-extrabold text-[10px] sm:text-xs border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all"
            >
              Riwayat Baca
            </Link>
          </div>
        </div>

        {/* Kolom Maskot (Kanan) */}
        <div className="relative shrink-0 z-10 drop-shadow-md flex items-center justify-center scale-75 sm:scale-100 origin-right">
          <ChameleonMascot variant="full" size={140} brandText="Chameleon Comics" />
        </div>
      </div>

      {/* 2. Featured Comic Hero Card */}
      {featuredComic && (
        <section className="relative z-10">
          <Link
            href={`/komik/${featuredComic.slug}`}
            className="group block relative w-full aspect-[16/9] sm:aspect-[21/9] lg:aspect-[24/8] rounded-[28px] sm:rounded-[36px] overflow-hidden border-[3px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] bg-[#1A1A1A]"
          >
            <Image
              src={featuredComic.cover_url}
              alt={featuredComic.title}
              fill
              priority
              className="object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

            <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-8 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#F6C945] border border-[#1A1A1A] text-[10px] font-black text-[#1A1A1A] uppercase">
                  Pilihan Editor
                </span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-bold">
                  <Star className="w-3 h-3 fill-[#F6C945] stroke-none" />
                  {featuredComic.rating.toFixed(2)}
                </span>
              </div>
              <h2 className="text-white text-lg sm:text-2xl lg:text-3xl font-black tracking-tight drop-shadow-md line-clamp-2">
                {featuredComic.title}
              </h2>
              <p className="text-white/80 text-xs sm:text-sm line-clamp-1 max-w-xl hidden sm:block">
                {featuredComic.synopsis}
              </p>
            </div>
          </Link>
        </section>
      )}

      {/* 3. Section "Categories" (Teal Cards with Real Comic Counts) */}
      <section className="flex flex-col gap-3.5 z-10">
        <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-2">
          <h2 className="text-xl sm:text-2xl font-black text-[#1A1A1A] tracking-tight">
            Categories
          </h2>
          <Link
            href="/browse"
            className="text-xs font-black text-[#2E7D6E] hover:underline flex items-center gap-1"
          >
            Lihat Semua Genre <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Selalu 3 Kolom di HP maupun PC */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
          {categoriesWithCounts.map((cat) => (
            <Link
              key={cat.name}
              href={`/browse?genre=${cat.slug}`}
              className="py-1.5 px-2 sm:py-3.5 sm:px-4 rounded-xl sm:rounded-2xl bg-[#2E7D6E] hover:bg-[#246559] border-[1.5px] sm:border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] sm:shadow-[3px_3px_0px_#1A1A1A] flex items-center justify-between transition-all active:translate-x-[1px] active:translate-y-[1px] min-w-0"
            >
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-2 min-w-0 pr-1">
                <span className="text-[11px] sm:text-base font-extrabold text-white truncate leading-tight">
                  {cat.name}
                </span>
                <span className="text-[9px] sm:text-xs font-medium text-white/80 shrink-0">
                  ({cat.count})
                </span>
              </div>
              <div className="w-4 h-4 sm:w-7 sm:h-7 rounded-full bg-white border border-[#1A1A1A] flex items-center justify-center shrink-0 shadow-sm">
                <ArrowRight className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-[#1A1A1A] stroke-[3]" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. Populer Minggu Ini (Horizontal Scroll Carousel) */}
      <section className="flex flex-col gap-3.5 z-10">
        <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-[#F6C945] border border-[#1A1A1A]">
              <Flame className="w-4 h-4 text-[#1A1A1A]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#1A1A1A] tracking-tight">
              Populer Minggu Ini
            </h2>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin">
          {popularComics.map((comic) => (
            <div key={comic.id} className="w-40 sm:w-48 shrink-0 snap-start">
              <ComicCard comic={comic} />
            </div>
          ))}
        </div>
      </section>

      {/* 5. Latest Updates Grid */}
      <section className="flex flex-col gap-3.5 z-10">
        <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-[#2A4FCB] border border-[#1A1A1A] text-white">
              <Clock className="w-4 h-4" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#1A1A1A] tracking-tight">
              Latest Updates
            </h2>
          </div>
          <Link
            href="/browse?sort=latest"
            className="text-xs font-black text-[#2E7D6E] hover:underline flex items-center gap-1"
          >
            Katalog Lengkap <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
          {latestComics.slice(0, 18).map((comic, index) => (
            <ComicCard key={comic.id} comic={comic} priority={index < 6} />
          ))}
        </div>
      </section>
    </div>
  );
}
