'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getMatureComicBySlug } from '@/lib/queries/mature-comics';
import { getMatureComicChapters } from '@/lib/queries/mature-chapters';
import { MatureComic, MatureChapter } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils/relative-time';
import {
  ArrowLeft,
  BookOpen,
  Star,
  Skull,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle2,
  Clock,
  Compass,
} from 'lucide-react';

export default function MatureComicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [comic, setComic] = useState<MatureComic | null>(null);
  const [chapters, setChapters] = useState<MatureChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
  const [chapterSearch, setChapterSearch] = useState('');

  useEffect(() => {
    async function load() {
      if (!slug) return;
      setLoading(true);
      const [cData, chList] = await Promise.all([
        getMatureComicBySlug(slug),
        getMatureComicChapters(slug),
      ]);
      setComic(cData);
      setChapters(chList);
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[#E53E3E]/20 border border-[#E53E3E] text-[#EF4444] flex items-center justify-center animate-spin">
          <Skull className="w-6 h-6" />
        </div>
        <p className="text-xs font-bold text-gray-400">Memuat data komik 18+...</p>
      </div>
    );
  }

  if (!comic) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-950/40 border border-red-900 text-red-400 flex items-center justify-center">
          <Skull className="w-8 h-8 opacity-60" />
        </div>
        <h2 className="text-xl font-black text-white">Komik 18+ Tidak Ditemukan</h2>
        <p className="text-xs text-gray-400 max-w-sm">
          Judul yang Anda tuju tidak terdaftar di database komik mature.
        </p>
        <Link
          href="/mature/browse"
          className="px-5 py-2.5 rounded-xl bg-[#E53E3E] text-black font-black text-xs hover:brightness-110 transition-all"
        >
          Kembali ke Katalog Gore
        </Link>
      </div>
    );
  }

  const filteredChapters = chapters.filter((ch) => {
    if (!chapterSearch.trim()) return true;
    const q = chapterSearch.toLowerCase();
    return (
      String(ch.chapter_number).includes(q) ||
      ch.title?.toLowerCase().includes(q)
    );
  });

  const firstChapter = chapters[chapters.length - 1];
  const latestChapter = chapters[0];

  return (
    <div className="flex flex-col gap-8 pt-6">
      {/* Top Breadcrumb & Return */}
      <div className="flex items-center justify-between">
        <Link
          href="/mature/browse"
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Katalog 18+</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-md bg-[#7F1D1D] text-red-200 text-[10px] font-black uppercase border border-red-500/50">
            {comic.gore_level} Gore
          </span>
          <span className="px-2 py-0.5 rounded-md bg-[#E53E3E] text-black text-[10px] font-black uppercase">
            18+
          </span>
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="relative rounded-3xl overflow-hidden border border-[#2B1419] bg-[#11131C] p-6 sm:p-8 flex flex-col md:flex-row gap-6 sm:gap-8 shadow-[0_8px_35px_rgba(0,0,0,0.7)]">
        {/* Cover Image */}
        <div className="relative w-40 sm:w-52 aspect-[2/3] shrink-0 rounded-2xl overflow-hidden border-2 border-[#E53E3E]/60 shadow-[0_4px_25px_rgba(229,62,62,0.3)] mx-auto md:mx-0">
          <Image
            src={comic.cover_url}
            alt={comic.title}
            fill
            priority
            className="object-cover"
          />
        </div>

        {/* Info Column */}
        <div className="flex-1 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-black/60 text-gray-300 text-xs font-bold uppercase border border-white/10">
                {comic.type}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase border ${
                  comic.status === 'ongoing'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                    : 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                }`}
              >
                {comic.status === 'ongoing' ? 'Ongoing' : 'Tamat'}
              </span>
              <div className="flex items-center gap-1 text-amber-400 bg-black/60 px-2 py-0.5 rounded-md border border-amber-500/30 text-xs font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{Number(comic.rating).toFixed(2)}</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              {comic.title}
            </h1>

            {comic.alt_titles && comic.alt_titles.length > 0 && (
              <p className="text-xs text-gray-400">
                {comic.alt_titles.join(' • ')}
              </p>
            )}

            <p className="text-xs text-gray-400 mt-1">
              Pengarang: <strong className="text-gray-200">{comic.author}</strong>
            </p>

            {/* Genre Pills */}
            {comic.genres && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {comic.genres.map((g) => (
                  <Link
                    key={g.id}
                    href={`/mature/browse?genre=${g.id}`}
                    className="text-xs font-semibold text-gray-300 bg-white/5 hover:bg-[#E53E3E] hover:text-black px-2.5 py-1 rounded-lg border border-white/5 transition-colors"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {latestChapter && (
              <Link
                href={`/mature/komik/${comic.slug}/${latestChapter.chapter_number}`}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#E53E3E] to-[#991B1B] text-white font-black text-xs sm:text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(229,62,62,0.4)]"
              >
                <BookOpen className="w-4 h-4" />
                <span>Baca Chapter Terbaru ({latestChapter.chapter_number})</span>
              </Link>
            )}

            {firstChapter && firstChapter.chapter_number !== latestChapter?.chapter_number && (
              <Link
                href={`/mature/komik/${comic.slug}/${firstChapter.chapter_number}`}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-gray-200 font-bold text-xs sm:text-sm border border-white/10 transition-colors"
              >
                Mulai dari Awal (Ch. {firstChapter.chapter_number})
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Content Warning Card */}
      {comic.content_warnings && comic.content_warnings.length > 0 && (
        <div className="bg-[#180B0F] border border-[#E53E3E]/40 rounded-2xl p-4 sm:p-5 flex flex-col gap-2.5 shadow-sm">
          <div className="flex items-center gap-2 text-[#EF4444] font-black text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Peringatan Konten Sensitif & Trigger Warnings</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            Komik ini memuat adegan grafis intens yang mungkin tidak nyaman bagi sebagian pembaca:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {comic.content_warnings.map((warn, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-md bg-[#2B0E14] border border-[#E53E3E]/40 text-red-200 text-xs font-bold"
              >
                ⚠️ {warn}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Synopsis Section */}
      <div className="bg-[#11131C] border border-[#2B1419] rounded-2xl p-5 sm:p-6 flex flex-col gap-3">
        <h2 className="font-black text-base text-white uppercase tracking-wide">
          Sinopsis Komik
        </h2>
        <div className="relative">
          <p
            className={`text-xs sm:text-sm text-gray-300 leading-relaxed ${
              !isSynopsisExpanded ? 'line-clamp-4' : ''
            }`}
          >
            {comic.synopsis}
          </p>
          {comic.synopsis && comic.synopsis.length > 250 && (
            <button
              type="button"
              onClick={() => setIsSynopsisExpanded(!isSynopsisExpanded)}
              className="mt-2 text-xs font-bold text-[#EF4444] hover:underline flex items-center gap-1"
            >
              <span>{isSynopsisExpanded ? 'Sembunyikan' : 'Baca Selengkapnya'}</span>
              {isSynopsisExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Chapter List Section */}
      <div className="bg-[#11131C] border border-[#2B1419] rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#EF4444]" />
            <h2 className="text-lg font-black text-white">
              Daftar Chapter ({chapters.length})
            </h2>
          </div>

          {/* Search Chapter */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={chapterSearch}
              onChange={(e) => setChapterSearch(e.target.value)}
              placeholder="Cari nomor chapter..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#171A25] border border-white/10 text-white text-xs placeholder-gray-500 outline-none focus:border-[#E53E3E]"
            />
          </div>
        </div>

        {/* Chapters Grid / List */}
        {filteredChapters.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredChapters.map((ch) => (
              <Link
                key={ch.id}
                href={`/mature/komik/${comic.slug}/${ch.chapter_number}`}
                className="flex items-center justify-between p-3 rounded-xl bg-[#151824] hover:bg-[#1E2333] border border-white/5 hover:border-[#E53E3E]/60 transition-all group"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="w-7 h-7 rounded-lg bg-black/50 text-[#EF4444] font-black text-xs flex items-center justify-center shrink-0 border border-white/5">
                    {ch.chapter_number}
                  </span>
                  <div className="flex flex-col truncate">
                    <span className="font-bold text-xs text-gray-200 group-hover:text-white truncate">
                      Chapter {ch.chapter_number}
                    </span>
                    {ch.title && (
                      <span className="text-[11px] text-gray-400 truncate">
                        {ch.title}
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-[10px] text-gray-500 shrink-0 ml-2">
                  {formatRelativeTime(ch.released_at)}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-gray-500 italic">
            Tidak ada chapter yang sesuai pencarian "{chapterSearch}".
          </div>
        )}
      </div>
    </div>
  );
}
