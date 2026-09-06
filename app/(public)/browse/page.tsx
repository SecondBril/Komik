'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Comic, FilterState, Genre } from '@/lib/types';
import { MOCK_COMICS, MOCK_GENRES } from '@/lib/mock-data';
import { ComicCard } from '@/components/comic/ComicCard';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { Search, Compass, X, RotateCcw } from 'lucide-react';

function BrowseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const queryParam = searchParams.get('q') || '';
  const typeParam = searchParams.get('type') || 'all';
  const statusParam = searchParams.get('status') || 'all';

  const [genres] = useState<Genre[]>(MOCK_GENRES);
  const [filters, setFilters] = useState<FilterState>({
    type: typeParam as any,
    status: statusParam as any,
    genres: [],
    query: queryParam,
  });

  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, query: queryParam }));
  }, [queryParam]);

  useEffect(() => {
    setLoading(true);
    let result = [...MOCK_COMICS];

    if (filters.type && filters.type !== 'all') {
      result = result.filter((c) => c.type === filters.type);
    }

    if (filters.status && filters.status !== 'all') {
      result = result.filter((c) => c.status === filters.status);
    }

    if (filters.genres && filters.genres.length > 0) {
      result = result.filter((c) =>
        filters.genres.every((genreId) => c.genres?.some((g) => g.id === genreId))
      );
    }

    if (filters.query) {
      const q = filters.query.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.alt_titles.some((alt) => alt.toLowerCase().includes(q))
      );
    }

    setComics(result);
    setLoading(false);
  }, [filters]);

  const handleResetFilters = () => {
    setFilters({
      type: 'all',
      status: 'all',
      genres: [],
      query: '',
    });
    router.push('/browse');
  };

  const removeGenreFilter = (genreId: number) => {
    setFilters((prev) => ({
      ...prev,
      genres: prev.genres.filter((id) => id !== genreId),
    }));
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header Title */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[#7C5CFC]/10 text-[#7C5CFC]">
            <Compass className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F2F3F5]">
            Katalog Komik
          </h1>
        </div>
        <p className="text-xs text-[#9AA0AC]">
          Temukan ribuan Manga, Manhwa, dan Manhua Bahasa Indonesia terlengkap.
        </p>
      </div>

      {/* Active Filter Chips Summary */}
      {(filters.type !== 'all' || filters.status !== 'all' || filters.genres.length > 0 || filters.query) && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-[#171A21] border border-[#2A2F3A]">
          <span className="text-xs font-bold text-[#9AA0AC]">Filter Aktif:</span>

          {filters.query && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#7C5CFC] text-white">
              <Search className="w-3 h-3" />
              &quot;{filters.query}&quot;
              <button
                type="button"
                onClick={() => setFilters((p) => ({ ...p, query: '' }))}
                className="hover:text-red-300"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.type !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#1F232C] text-[#F2F3F5] border border-[#2A2F3A] uppercase">
              Tipe: {filters.type}
              <button
                type="button"
                onClick={() => setFilters((p) => ({ ...p, type: 'all' }))}
                className="hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.status !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#1F232C] text-[#F2F3F5] border border-[#2A2F3A] capitalize">
              Status: {filters.status}
              <button
                type="button"
                onClick={() => setFilters((p) => ({ ...p, status: 'all' }))}
                className="hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.genres.map((gId) => {
            const genreObj = genres.find((g) => g.id === gId);
            return (
              <span
                key={gId}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#7C5CFC]/20 text-[#7C5CFC] border border-[#7C5CFC]/40"
              >
                {genreObj?.name}
                <button
                  type="button"
                  onClick={() => removeGenreFilter(gId)}
                  className="hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}

          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs font-semibold text-red-400 hover:underline ml-auto flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset Semua
          </button>
        </div>
      )}

      {/* Main Layout Grid (Filter Sidebar + Results) */}
      <div className="flex flex-col lg:flex-row gap-6">
        <FilterPanel
          genres={genres}
          initialFilters={filters}
          onFilterChange={setFilters}
          onReset={handleResetFilters}
        />

        <div className="flex-1">
          {comics.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4">
              {comics.map((comic) => (
                <ComicCard key={comic.id} comic={comic} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 bg-[#171A21] border border-[#2A2F3A] rounded-2xl text-center">
              <Compass className="w-12 h-12 text-[#5B616D] mb-3 stroke-[1.5]" />
              <h3 className="text-base font-bold text-[#F2F3F5] mb-1">
                Komik Tidak Ditemukan
              </h3>
              <p className="text-xs text-[#9AA0AC] mb-4 max-w-sm">
                Tidak ada komik yang cocok dengan kombinasi filter atau kata kunci pencarian Anda.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-[#7C5CFC] hover:bg-[#6A47F0] text-white font-semibold text-xs transition-colors"
              >
                Reset Filter & Pencarian
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-[#9AA0AC]">Loading katalog...</div>}>
      <BrowseContent />
    </Suspense>
  );
}
