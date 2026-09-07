'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ComicCard } from '@/components/comic/ComicCard';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { Search, Compass, X, RotateCcw, Loader2, ChevronDown } from 'lucide-react';
import { Genre, FilterState, Comic } from '@/lib/types';
import { MOCK_GENRES } from '@/lib/mock-data';

function BrowseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const queryParam = searchParams.get('q') || '';
  const typeParam = searchParams.get('type') || 'all';
  const statusParam = searchParams.get('status') || 'all';

  const [genres, setGenres] = useState<Genre[]>(MOCK_GENRES);
  const [filters, setFilters] = useState<FilterState>({
    type: typeParam as any,
    status: statusParam as any,
    genres: [],
    query: queryParam,
  });

  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const LIMIT = 30;
  const hasMore = comics.length < total;

  // Fetch genres from Supabase
  useEffect(() => {
    fetch('/api/genres')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.length > 0) setGenres(d.data);
      })
      .catch(() => {}); // keep mock fallback
  }, []);

  // Sync query param → filters
  useEffect(() => {
    setFilters((prev) => ({ ...prev, query: queryParam }));
  }, [queryParam]);

  // Fetch comics when filters change (reset to page 1)
  const fetchComics = useCallback(async (currentFilters: FilterState, pageNum: number, append: boolean) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (currentFilters.type && currentFilters.type !== 'all') params.set('type', currentFilters.type);
      if (currentFilters.status && currentFilters.status !== 'all') params.set('status', currentFilters.status);
      if (currentFilters.query) params.set('q', currentFilters.query);
      if (currentFilters.genres?.length) params.set('genres', currentFilters.genres.join(','));
      if (currentFilters.sort) params.set('sort', currentFilters.sort);
      params.set('page', String(pageNum));
      params.set('limit', String(LIMIT));

      const res = await fetch(`/api/browse?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setTotal(data.total ?? 0);
        if (append) {
          setComics((prev) => [...prev, ...data.data]);
        } else {
          setComics(data.data);
        }
      } else {
        setError(data.error || 'Gagal memuat data');
      }
    } catch {
      setError('Gagal terhubung ke server');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Refetch on filter change (reset pagination)
  useEffect(() => {
    setPage(1);
    fetchComics(filters, 1, false);
  }, [filters, fetchComics]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchComics(filters, nextPage, true);
  };

  const handleResetFilters = () => {
    setFilters({ type: 'all', status: 'all', genres: [], query: '' });
    router.push('/browse');
  };

  const removeGenreFilter = (genreId: number) => {
    setFilters((prev) => ({ ...prev, genres: prev.genres.filter((id) => id !== genreId) }));
  };

  const activeFilterCount =
    (filters.type !== 'all' ? 1 : 0) +
    (filters.status !== 'all' ? 1 : 0) +
    (filters.genres?.length || 0) +
    (filters.query ? 1 : 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#7C5CFC]/10 text-[#7C5CFC]">
              <Compass className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#F2F3F5]">
              Katalog Komik
            </h1>
          </div>
          {!loading && (
            <span className="text-xs text-[#9AA0AC] bg-[#171A21] border border-[#2A2F3A] px-2.5 py-1 rounded-full">
              {total.toLocaleString()} judul
            </span>
          )}
        </div>
        <p className="text-xs text-[#9AA0AC]">
          Temukan ribuan Manga, Manhwa, dan Manhua Bahasa Indonesia terlengkap.
        </p>
      </div>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-[#171A21] border border-[#2A2F3A]">
          <span className="text-xs font-bold text-[#9AA0AC]">Filter Aktif:</span>

          {filters.query && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#7C5CFC] text-white">
              <Search className="w-3 h-3" />
              &quot;{filters.query}&quot;
              <button type="button" onClick={() => setFilters((p) => ({ ...p, query: '' }))} className="hover:text-red-300">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.type !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#1F232C] text-[#F2F3F5] border border-[#2A2F3A] uppercase">
              Tipe: {filters.type}
              <button type="button" onClick={() => setFilters((p) => ({ ...p, type: 'all' }))} className="hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.status !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#1F232C] text-[#F2F3F5] border border-[#2A2F3A] capitalize">
              Status: {filters.status}
              <button type="button" onClick={() => setFilters((p) => ({ ...p, status: 'all' }))} className="hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.genres.map((gId) => {
            const genreObj = genres.find((g) => g.id === gId);
            return (
              <span key={gId} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#7C5CFC]/20 text-[#7C5CFC] border border-[#7C5CFC]/40">
                {genreObj?.name}
                <button type="button" onClick={() => removeGenreFilter(gId)} className="hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}

          <button type="button" onClick={handleResetFilters} className="text-xs font-semibold text-red-400 hover:underline ml-auto flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Reset Semua
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="flex flex-col lg:flex-row gap-6">
        <FilterPanel
          genres={genres}
          initialFilters={filters}
          onFilterChange={setFilters}
          onReset={handleResetFilters}
        />

        <div className="flex-1 flex flex-col gap-5">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-xl bg-[#171A21] animate-pulse border border-[#2A2F3A]" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-12 bg-[#171A21] border border-red-500/20 rounded-2xl text-center gap-3">
              <Compass className="w-10 h-10 text-red-400 stroke-[1.5]" />
              <p className="text-sm font-bold text-white">Gagal memuat katalog</p>
              <p className="text-xs text-[#9AA0AC]">{error}</p>
              <button onClick={() => fetchComics(filters, 1, false)} className="px-4 py-2 rounded-xl bg-[#1F232C] border border-[#2A2F3A] text-xs text-[#9AA0AC] hover:text-white transition-colors">
                Coba Lagi
              </button>
            </div>
          ) : comics.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-[#171A21] border border-[#2A2F3A] rounded-2xl text-center gap-4">
              <Compass className="w-12 h-12 text-[#5B616D] stroke-[1.5]" />
              <div>
                <h3 className="text-base font-bold text-[#F2F3F5] mb-1">Komik Tidak Ditemukan</h3>
                <p className="text-xs text-[#9AA0AC] max-w-sm">
                  Tidak ada komik yang cocok dengan kombinasi filter atau kata kunci pencarian Anda.
                </p>
              </div>
              <button type="button" onClick={handleResetFilters} className="px-4 py-2 rounded-xl bg-[#7C5CFC] hover:bg-[#6A47F0] text-white font-semibold text-xs transition-colors">
                Reset Filter &amp; Pencarian
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4">
                {comics.map((comic) => (
                  <ComicCard key={comic.id} comic={comic} />
                ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#171A21] hover:bg-[#1F232C] border border-[#2A2F3A] text-sm font-semibold text-[#9AA0AC] hover:text-white transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    {loadingMore ? 'Memuat...' : `Muat Lebih Banyak (${total - comics.length} tersisa)`}
                  </button>
                </div>
              )}

              <p className="text-center text-[11px] text-[#5B616D]">
                Menampilkan {comics.length} dari {total.toLocaleString()} komik
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20 text-[#9AA0AC] gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#7C5CFC]" />
        <span className="text-sm">Memuat katalog...</span>
      </div>
    }>
      <BrowseContent />
    </Suspense>
  );
}
