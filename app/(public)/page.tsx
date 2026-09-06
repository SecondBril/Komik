import React from 'react';
import Link from 'next/link';
import { getComics } from '@/lib/queries/comics';
import { ComicCard } from '@/components/comic/ComicCard';
import { Sparkles, Flame, ThumbsUp, Clock, ChevronRight } from 'lucide-react';

export const revalidate = 60; // ISR 60s

export default async function HomePage() {
  const comics = await getComics();

  const latestComics = [...comics].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  const popularComics = [...comics].sort((a, b) => b.rating - a.rating);
  const recommendedComics = comics.filter((c) => c.type === 'manhwa');
  const newlyAddedComics = [...comics].reverse();

  return (
    <div className="flex flex-col gap-10">
      
      {/* 1. Hero / Latest Updates Section (Primary Section) */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[#2A2F3A] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#7C5CFC]/10 text-[#7C5CFC]">
              <Clock className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F2F3F5]">
              Latest Updates
            </h1>
          </div>
          <Link
            href="/browse?sort=latest"
            className="text-xs font-semibold text-[#7C5CFC] hover:underline flex items-center gap-1"
          >
            Lihat Semua <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
          {latestComics.slice(0, 12).map((comic, index) => (
            <ComicCard key={comic.id} comic={comic} priority={index < 4} />
          ))}
        </div>
      </section>

      {/* 2. Populer Minggu Ini (Horizontal Scroll Carousel on Mobile) */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[#2A2F3A] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Flame className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#F2F3F5]">
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

      {/* 3. Rekomendasi Choice */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[#2A2F3A] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ThumbsUp className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#F2F3F5]">
              Rekomendasi Pilihan Editor
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {recommendedComics.map((comic) => (
            <ComicCard key={comic.id} comic={comic} />
          ))}
        </div>
      </section>

      {/* 4. Baru Ditambahkan */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[#2A2F3A] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#F2F3F5]">
              Baru Ditambahkan
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {newlyAddedComics.map((comic) => (
            <ComicCard key={comic.id} comic={comic} />
          ))}
        </div>
      </section>
    </div>
  );
}
