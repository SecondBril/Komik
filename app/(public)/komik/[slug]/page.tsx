import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getComicBySlug } from '@/lib/queries/comics';
import { getComicChapters } from '@/lib/queries/chapters';
import { getComicAdaptations } from '@/lib/queries/adaptations';
import { ComicDetailClient } from '@/components/comic/ComicDetailClient';
import { ChameleonMascot } from '@/components/ui/ChameleonMascot';
import { DecorativeBlobs } from '@/components/ui/DecorativeBlobs';
import { Compass, ArrowLeft } from 'lucide-react';

interface PageProps {
  params: { slug: string } | Promise<{ slug: string }>;
}

export const revalidate = 60; // ISR Edge cache for 60 seconds

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;
  if (!slug) {
    return { title: 'Komik - Chameleon Comics' };
  }

  const comic = await getComicBySlug(slug);
  if (!comic) {
    return {
      title: 'Komik Tidak Ditemukan - Chameleon Comics',
    };
  }

  return {
    title: `${comic.title} - Baca Komik Online Bahasa Indonesia | Chameleon Comics`,
    description:
      comic.synopsis?.slice(0, 160) ||
      `Baca komik ${comic.title} subtitle Indonesia terlengkap dan terupdate di Chameleon Comics.`,
    openGraph: {
      title: `${comic.title} - Chameleon Comics`,
      description:
        comic.synopsis?.slice(0, 160) ||
        `Baca komik ${comic.title} subtitle Indonesia terlengkap dan terupdate di Chameleon Comics.`,
      images: comic.cover_url ? [{ url: comic.cover_url }] : [],
    },
  };
}

export default async function ComicDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;

  if (!slug) {
    notFound();
  }

  const [comic, initialChapters] = await Promise.all([
    getComicBySlug(slug),
    getComicChapters(slug),
  ]);

  if (!comic) {
    return (
      <div className="relative min-h-[70vh] bg-[#F7F2E6] flex flex-col items-center justify-center p-6 text-center">
        <DecorativeBlobs variant="detail" />
        <div className="relative z-10 max-w-md bg-white rounded-[32px] border-[3px] border-[#1A1A1A] shadow-[6px_6px_0px_#1A1A1A] p-8 flex flex-col items-center gap-4">
          <ChameleonMascot size={120} variant="mascotOnly" />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-black text-[#1A1A1A]">Komik Tidak Ditemukan</h1>
            <p className="text-xs text-[#7A756D] font-medium leading-relaxed">
              Komik dengan tautan <code className="bg-[#FAF7F0] px-2 py-0.5 rounded border border-[#1A1A1A] text-[#1A1A1A] font-bold">{slug}</code> belum terdaftar di database kami.
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Link
              href="/browse"
              className="px-5 py-2.5 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] font-black text-xs border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-2"
            >
              <Compass className="w-4 h-4 stroke-[2.5]" />
              <span>Jelajahi Katalog</span>
            </Link>
            <Link
              href="/"
              className="px-4 py-2.5 rounded-full bg-white hover:bg-[#FAF7F0] text-[#1A1A1A] font-black text-xs border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span>Beranda</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const adaptations = await getComicAdaptations(comic.id);

  return (
    <ComicDetailClient
      comic={comic}
      initialChapters={initialChapters}
      adaptations={adaptations}
      slug={slug}
    />
  );
}
