'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MatureComic, MatureGenre, ComicType, ComicStatus, GoreLevel } from '@/lib/types';
import { getMatureComics, getMatureGenres } from '@/lib/queries/mature-comics';
import { MatureComicCard } from '@/components/mature/MatureComicCard';
import {
  Search,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  X,
  Check,
  Skull,
  Flame,
  Clock,
  Star,
  BookOpen,
} from 'lucide-react';

function MatureBrowseContent() {
  const searchParams = useSearchParams();
  const initialGenreParam = searchParams.get('genre');
  const initialSortParam = searchParams.get('sort');

  const [comics, setComics] = useState<MatureComic[]>([]);
  const [genres, setGenres] = useState<MatureGenre[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<ComicType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<ComicStatus | 'all'>('all');
  const [selectedGoreLevel, setSelectedGoreLevel] = useState<GoreLevel | 'all'>('all');
  const [selectedGenres, setSelectedGenres] = useState<number[]>(
    initialGenreParam ? [Number(initialGenreParam)] : []
  );
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'rating' | 'title'>(
    initialSortParam === 'popular' ? 'popular' : 'latest'
  );
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const [cData, gData] = await Promise.all([getMatureComics(), getMatureGenres()]);
      setComics(cData);
      setGenres(gData);
      setLoading(false);
    }
    init();
  }, []);

  const handleToggleGenre = (id: number) => {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((gId) => gId !== id) : [...prev, id]
    );
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    setSelectedStatus('all');
    setSelectedGoreLevel('all');
    setSelectedGenres([]);
    setSortBy('latest');
  };

  // Filter & Sort Logic
  const filteredComics = useMemo(() => {
    let result = [...comics];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.alt_titles?.some((alt) => alt.toLowerCase().includes(q)) ||
          c.author?.toLowerCase().includes(q)
      );
    }

    // Type
    if (selectedType !== 'all') {
      result = result.filter((c) => c.type === selectedType);
    }

    // Status
    if (selectedStatus !== 'all') {
      result = result.filter((c) => c.status === selectedStatus);
    }

    // Gore Level
    if (selectedGoreLevel !== 'all') {
      result = result.filter((c) => c.gore_level === selectedGoreLevel);
    }

    // Genres
    if (selectedGenres.length > 0) {
      result = result.filter((c) =>
        selectedGenres.every((gId) => c.genres?.some((cg) => cg.id === gId))
      );
    }

    // Sort
    if (sortBy === 'popular' || sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }

    return result;
  }, [comics, searchQuery, selectedType, selectedStatus, selectedGoreLevel, selectedGenres, sortBy]);

  const activeFilterCount =
    (selectedType !== 'all' ? 1 : 0) +
    (selectedStatus !== 'all' ? 1 : 0) +
    (selectedGoreLevel !== 'all' ? 1 : 0) +
    selectedGenres.length;

  return (
    <div className="flex flex-col gap-6 pt-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Skull className="w-6 h-6 text-[#EF4444]" />
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Katalog Komik 18+ & Gore
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-gray-400">
          Jelajahi seluruh serial komik mature berdarah, horor psikologis, dan survival terlarang dengan filter terinci.
        </p>
      </div>

      {/* Search Bar & Mobile Filter Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul komik gore, mangaka, atau alt title..."
            className="w-full pl-10 pr-10 py-3 rounded-2xl bg-[#12141D] border border-[#2E151A] focus:border-[#E53E3E] text-white text-xs sm:text-sm placeholder-gray-500 outline-none transition-colors shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="py-3 px-3.5 rounded-2xl bg-[#12141D] border border-[#2E151A] text-gray-200 text-xs sm:text-sm font-bold outline-none cursor-pointer hover:border-[#E53E3E] transition-colors"
          >
            <option value="latest">⚡ Update Terbaru</option>
            <option value="popular">🔥 Paling Populer</option>
            <option value="rating">⭐ Rating Tertinggi</option>
            <option value="title">🔤 Judul (A - Z)</option>
          </select>

          {/* Mobile Filter Button */}
          <button
            type="button"
            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
            className={`sm:hidden py-3 px-3.5 rounded-2xl border flex items-center gap-2 text-xs font-bold transition-all ${
              activeFilterCount > 0
                ? 'bg-[#E53E3E] text-black border-[#E53E3E]'
                : 'bg-[#12141D] text-gray-300 border-[#2E151A]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filter {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
          </button>
        </div>
      </div>

      {/* Filter Panel (Desktop Always / Mobile Dropdown) */}
      <div
        className={`bg-[#10121A] border border-[#2B1419] rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm ${
          isFilterPanelOpen ? 'block' : 'hidden sm:flex'
        }`}
      >
        {/* Row 1: Type, Status, Gore Level */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Comic Type */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
              Format Komik
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'manga', 'manhwa', 'manhua'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedType(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                    selectedType === t
                      ? 'bg-[#E53E3E] text-black shadow-sm'
                      : 'bg-[#181B26] text-gray-300 hover:text-white hover:bg-[#222736]'
                  }`}
                >
                  {t === 'all' ? 'Semua' : t}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
              Status Rilis
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'ongoing', 'completed'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedStatus(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                    selectedStatus === s
                      ? 'bg-[#E53E3E] text-black shadow-sm'
                      : 'bg-[#181B26] text-gray-300 hover:text-white hover:bg-[#222736]'
                  }`}
                >
                  {s === 'all' ? 'Semua' : s === 'ongoing' ? 'Ongoing' : 'Tamat'}
                </button>
              ))}
            </div>
          </div>

          {/* Gore Level */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
              Tingkat Intensitas Gore
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'Moderate', 'High', 'Extreme'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelectedGoreLevel(lvl)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                    selectedGoreLevel === lvl
                      ? 'bg-[#E53E3E] text-black shadow-sm'
                      : 'bg-[#181B26] text-gray-300 hover:text-white hover:bg-[#222736]'
                  }`}
                >
                  {lvl === 'all' ? 'Semua' : lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Genre Multi-Select Pills */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
              Kategori Tema Gelap / 18+
            </span>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {genres.map((g) => {
              const isSelected = selectedGenres.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleToggleGenre(g.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#E53E3E] text-black shadow-sm'
                      : 'bg-[#181B26] text-gray-300 hover:text-white hover:bg-[#222736] border border-transparent'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  <span>{g.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400">
          Menampilkan <strong className="text-white">{filteredComics.length}</strong> judul komik 18+
        </span>
        {activeFilterCount > 0 && (
          <span className="text-xs text-red-400 font-bold">
            {activeFilterCount} filter aktif
          </span>
        )}
      </div>

      {/* Comics Grid */}
      {filteredComics.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {filteredComics.map((comic) => (
            <MatureComicCard key={comic.id} comic={comic} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-[#12141D] border border-[#2B1419] rounded-3xl p-10 sm:p-16 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-red-950/40 border border-red-900/60 text-red-400 flex items-center justify-center shadow-inner">
            <Skull className="w-8 h-8 opacity-60" />
          </div>
          <div className="flex flex-col gap-1 max-w-sm">
            <h3 className="font-black text-lg text-white">Tidak ada komik yang cocok</h3>
            <p className="text-xs text-gray-400">
              Kombinasi filter atau kata kunci pencarian Anda tidak menemukan komik 18+ apapun.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-5 py-2.5 rounded-xl bg-[#E53E3E] text-black font-black text-xs hover:brightness-110 transition-all shadow-md"
          >
            Reset Semua Filter
          </button>
        </div>
      )}
    </div>
  );
}

export default function MatureBrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#E53E3E]/20 border border-[#E53E3E] text-[#EF4444] flex items-center justify-center animate-spin">
            <Skull className="w-6 h-6" />
          </div>
          <p className="text-xs font-bold text-gray-400">Memuat katalog komik 18+...</p>
        </div>
      }
    >
      <MatureBrowseContent />
    </Suspense>
  );
}
