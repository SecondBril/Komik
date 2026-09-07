'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ComicCard } from '@/components/comic/ComicCard';
import { DecorativeBlobs } from '@/components/ui/DecorativeBlobs';
import { Search, ArrowLeft, Settings, ArrowRight, X, Sparkles, Filter, SlidersHorizontal, Check } from 'lucide-react';
import { Genre, Comic } from '@/lib/types';
import { MOCK_COMICS, MOCK_GENRES } from '@/lib/mock-data';

const TYPE_OPTIONS = [
  { label: 'Semua Tipe', value: 'all' },
  { label: 'Manhwa (Korea)', value: 'manhwa' },
  { label: 'Manga (Jepang)', value: 'manga' },
  { label: 'Manhua (China)', value: 'manhua' },
];

const STATUS_OPTIONS = [
  { label: 'Semua Status', value: 'all' },
  { label: 'Ongoing (Berjalan)', value: 'ongoing' },
  { label: 'Completed (Tamat)', value: 'completed' },
];

const SORT_OPTIONS = [
  { label: 'Update Terbaru', value: 'latest' },
  { label: 'Rating Tertinggi', value: 'popular' },
  { label: 'Judul (A-Z)', value: 'title' },
];

function BrowseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const queryParam = searchParams.get('q') || '';
  const typeParam = searchParams.get('type') || 'all';
  const genreParam = searchParams.get('genre') || '';

  const [activeType, setActiveType] = useState(typeParam || 'all');
  const [activeStatus, setActiveStatus] = useState('all');
  const [activeSort, setActiveSort] = useState('latest');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    genreParam ? [genreParam] : []
  );
  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const [genres, setGenres] = useState<{ id: number; name: string; slug: string; count?: number }[]>([]);
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Fetch real genres with actual counts
  useEffect(() => {
    fetch('/api/genres', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data) && d.data.length > 0) {
          setGenres(d.data);
        } else {
          // Fallback with real counts from MOCK_COMICS
          const counts: Record<number, number> = {};
          MOCK_COMICS.forEach((c) => {
            c.genres?.forEach((g) => {
              counts[g.id] = (counts[g.id] || 0) + 1;
            });
          });
          setGenres(
            MOCK_GENRES.map((g) => ({
              ...g,
              count: counts[g.id] || 0,
            }))
          );
        }
      })
      .catch(() => { });
  }, []);

  // Fetch comics with multi-category & detailed filters
  const fetchComics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeType !== 'all') params.set('type', activeType);
      if (activeStatus !== 'all') params.set('status', activeStatus);
      if (activeSort !== 'latest') params.set('sort', activeSort);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (selectedGenres.length > 0) params.set('genres', selectedGenres.join(','));
      params.set('limit', '36');

      const res = await fetch(`/api/browse?${params.toString()}`);
      const data = await res.json();

      if (data.success && data.data) {
        setComics(data.data);
        setTotal(data.total ?? data.data.length);
      } else {
        // Fallback filter on mock
        let filtered = [...MOCK_COMICS];
        if (activeType !== 'all') filtered = filtered.filter((c) => c.type === activeType);
        if (activeStatus !== 'all') filtered = filtered.filter((c) => c.status === activeStatus);
        if (selectedGenres.length > 0) {
          filtered = filtered.filter((c) =>
            selectedGenres.some((slug) => c.genres?.some((g) => g.slug === slug))
          );
        }
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          filtered = filtered.filter(
            (c) =>
              c.title.toLowerCase().includes(q) ||
              c.alt_titles?.some((a) => a.toLowerCase().includes(q))
          );
        }
        if (activeSort === 'popular') {
          filtered.sort((a, b) => b.rating - a.rating);
        } else if (activeSort === 'title') {
          filtered.sort((a, b) => a.title.localeCompare(b.title));
        } else {
          filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        }
        setComics(filtered);
        setTotal(filtered.length);
      }
    } catch {
      setComics(MOCK_COMICS);
      setTotal(MOCK_COMICS.length);
    } finally {
      setLoading(false);
    }
  }, [activeType, activeStatus, activeSort, selectedGenres, searchQuery]);

  useEffect(() => {
    fetchComics();
  }, [fetchComics]);

  // Toggle multi-genre selection
  const handleToggleGenre = (slug: string) => {
    setSelectedGenres((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleResetFilters = () => {
    setActiveType('all');
    setActiveStatus('all');
    setActiveSort('latest');
    setSelectedGenres([]);
    setSearchQuery('');
    setIsFilterDrawerOpen(false);
  };

  const hasActiveFilters =
    activeType !== 'all' ||
    activeStatus !== 'all' ||
    activeSort !== 'latest' ||
    selectedGenres.length > 0 ||
    searchQuery.trim() !== '';

  return (
    <div className="relative min-h-screen bg-[#F7F2E6] pb-24">
      <DecorativeBlobs variant="browse" />

      {/* Responsive Container for Mobile, Tablet, and Desktop */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 flex flex-col gap-6 z-10">

        {/* 1. Hero Banner */}
        <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] lg:aspect-[24/8] min-h-[190px] rounded-[28px] sm:rounded-[36px] overflow-hidden border-[3px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] sm:shadow-[6px_6px_0px_#1A1A1A] bg-[#1A1A1A]">
          <Image
            src="https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1400&auto=format&fit=crop&q=80"
            alt="Katalog Komik Banner"
            fill
            priority
            className="object-cover object-top"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

          {/* Top-Left Floating Pill: "<- Home" */}
          <Link
            href="/"
            className="absolute top-4 left-4 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-[#1A1A1A] border-2 border-[#1A1A1A] text-xs font-black shadow-[2px_2px_0px_#1A1A1A] hover:bg-[#FAF7F0] active:translate-x-[1px] active:translate-y-[1px] transition-all"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Home</span>
          </Link>

          {/* Top-Right Floating Circle: Filter Toggle */}
          <button
            onClick={() => setIsFilterDrawerOpen(true)}
            className={`absolute top-4 right-4 px-3.5 py-1.5 rounded-full border-2 border-[#1A1A1A] flex items-center gap-1.5 text-xs font-black shadow-[2px_2px_0px_#1A1A1A] transition-all active:scale-95 ${hasActiveFilters ? 'bg-[#F6C945] text-[#1A1A1A]' : 'bg-white text-[#1A1A1A] hover:bg-[#FAF7F0]'
              }`}
            title="Filter Lengkap"
          >
            <SlidersHorizontal className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Filter Detail</span>
          </button>

          {/* Hero Title Overlay */}
          <div className="absolute bottom-4 left-5 right-5 sm:bottom-6 sm:left-8">
            <span className="px-3 py-1 rounded-full bg-[#F6C945] border border-[#1A1A1A] text-[10px] font-black text-[#1A1A1A] uppercase tracking-wider shadow-sm">
              Koleksi Manga, Manhwa & Manhua
            </span>
            <h1 className="text-white text-xl sm:text-3xl font-black tracking-tight drop-shadow-md mt-2">
              Katalog & Kategori Komik
            </h1>
            <p className="text-white/80 text-xs sm:text-sm font-medium mt-1 max-w-xl hidden sm:block">
              Filter komik berdasarkan multi-kategori, tipe komik, dan status rilis terlengkap!
            </p>
          </div>
        </div>

        {/* 2. Quick Filter Bar (Type, Sort, and Search Input) */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-3xl border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A]">

          {/* Left: Type pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {TYPE_OPTIONS.map((opt) => {
              const isActive = activeType === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setActiveType(opt.value)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full border-2 border-[#1A1A1A] text-xs font-black tracking-tight transition-all active:translate-x-[1px] active:translate-y-[1px] ${isActive
                      ? 'bg-[#F6C945] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                      : 'bg-[#FAF7F0] text-[#1A1A1A] hover:bg-white'
                    }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Right: Sort selector & Search bar */}
          <div className="flex items-center gap-2">
            <select
              value={activeSort}
              onChange={(e) => setActiveSort(e.target.value)}
              className="py-2 px-3 rounded-2xl bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] focus:outline-none shadow-sm cursor-pointer"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsFilterDrawerOpen(true)}
              className="px-3 py-2 rounded-2xl bg-[#2E7D6E] text-white border-2 border-[#1A1A1A] text-xs font-black flex items-center gap-1.5 shadow-[2px_2px_0px_#1A1A1A] hover:bg-[#236357]"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter ({selectedGenres.length + (activeStatus !== 'all' ? 1 : 0)})</span>
            </button>
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-bold text-[#7A756D]">Filter Aktif:</span>
            {selectedGenres.map((slug) => {
              const genreObj = genres.find((g) => g.slug === slug);
              return (
                <span
                  key={slug}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#F6C945] border border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-sm"
                >
                  {genreObj?.name || slug}
                  <button
                    onClick={() => handleToggleGenre(slug)}
                    className="hover:bg-black/10 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
            {activeType !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-[#1A1A1A] text-xs font-black text-[#1A1A1A]">
                Tipe: {activeType.toUpperCase()}
                <button onClick={() => setActiveType('all')} className="hover:bg-black/10 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {activeStatus !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-[#1A1A1A] text-xs font-black text-[#1A1A1A]">
                Status: {activeStatus.toUpperCase()}
                <button onClick={() => setActiveStatus('all')} className="hover:bg-black/10 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              onClick={handleResetFilters}
              className="text-xs font-bold text-[#E96379] underline hover:text-[#C53030] ml-1"
            >
              Reset Semua
            </button>
          </div>
        )}

        {/* 3. Section "Categories" - Responsive Grid with Real Comic Counts */}
        <section className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-[#1A1A1A] tracking-tight">
                Categories
              </h2>
              <span className="text-[10px] sm:text-xs font-extrabold text-[#7A756D]">
                (Klik untuk memilih multi-kategori)
              </span>
            </div>
            {selectedGenres.length > 0 && (
              <button
                onClick={() => setSelectedGenres([])}
                className="text-xs font-black text-[#2E7D6E] underline shrink-0"
              >
                Hapus Pilihan ({selectedGenres.length})
              </button>
            )}
          </div>

          {/* Terkunci 3 Kolom di Semua Ukuran Layar */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            {genres.map((cat) => {
              const isSelected = selectedGenres.includes(cat.slug);
              return (
                <button
                  key={cat.id || cat.slug}
                  onClick={() => handleToggleGenre(cat.slug)}
                  className={`py-1.5 px-2 sm:py-3 sm:px-4 rounded-xl sm:rounded-2xl border-[1.5px] sm:border-2 border-[#1A1A1A] flex items-center justify-between text-left transition-all active:translate-x-[1px] active:translate-y-[1px] min-w-0 ${isSelected
                      ? 'bg-[#F6C945] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] ring-2 ring-[#1A1A1A]'
                      : 'bg-[#2E7D6E] hover:bg-[#286F62] text-white shadow-[2px_2px_0px_#1A1A1A] sm:shadow-[3px_3px_0px_#1A1A1A]'
                    }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-1.5 truncate pr-1 min-w-0">
                    <span
                      className={`text-[11px] sm:text-base font-black truncate leading-tight ${isSelected ? 'text-[#1A1A1A]' : 'text-white'
                        }`}
                    >
                      {cat.name}
                    </span>
                    <span
                      className={`text-[9px] sm:text-[11px] font-bold shrink-0 leading-none ${isSelected ? 'text-[#1A1A1A]/75' : 'text-white/80'
                        }`}
                    >
                      ({cat.count ?? 0})
                    </span>
                  </div>

                  {/* Circle indicator */}
                  <div
                    className="w-4 h-4 sm:w-7 sm:h-7 rounded-full border border-[#1A1A1A] sm:border-2 flex items-center justify-center shrink-0 shadow-sm bg-white text-[#1A1A1A]"
                  >
                    {isSelected ? (
                      <Check className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 stroke-[3] text-[#2E7D6E]" />
                    ) : (
                      <ArrowRight className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-[#1A1A1A] stroke-[3]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 4. Comics Results List - Responsive Grid */}
        <section className="flex flex-col gap-4 mt-2">
          <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-2">
            <h3 className="text-lg sm:text-xl font-black text-[#1A1A1A] tracking-tight">
              {selectedGenres.length > 0
                ? `Genre: ${selectedGenres.map((s) => genres.find((g) => g.slug === s)?.name || s).join(', ')}`
                : 'Semua Komik'}
            </h3>
            <span className="text-xs font-black text-[#1A1A1A] bg-[#F6C945] px-3.5 py-1 rounded-full border-2 border-[#1A1A1A] shadow-sm">
              {total} Judul Ditemukan
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-2xl bg-white/60 border-2 border-[#1A1A1A] animate-pulse" />
              ))}
            </div>
          ) : comics.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-3xl border-2 border-[#1A1A1A] p-6 shadow-[4px_4px_0px_#1A1A1A]">
              <Sparkles className="w-12 h-12 text-[#F6C945] mx-auto mb-2" />
              <p className="font-extrabold text-base text-[#1A1A1A]">Tidak ada komik yang cocok</p>
              <p className="text-xs text-[#7A756D] mt-1">Coba kurangi kombinasi filter atau pilih kategori genre lain.</p>
              <button
                onClick={handleResetFilters}
                className="mt-4 px-5 py-2 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-sm"
              >
                Reset Semua Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
              {comics.map((comic) => (
                <ComicCard key={comic.id} comic={comic} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Detailed Multi-Filter Drawer / Modal */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#F7F2E6] w-full max-w-lg max-h-[85vh] rounded-[36px] border-[3px] border-[#1A1A1A] p-6 shadow-[8px_8px_0px_#1A1A1A] flex flex-col gap-4 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b-2 border-[#1A1A1A]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-[#1A1A1A]" />
                <h4 className="text-lg font-black text-[#1A1A1A]">Filter Komik Lengkap</h4>
              </div>
              <button
                onClick={() => setIsFilterDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-white border-2 border-[#1A1A1A] flex items-center justify-center text-[#1A1A1A]"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4">
              {/* Tipe Komik */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider">
                  Tipe Komik
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {TYPE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setActiveType(t.value)}
                      className={`py-2 px-3 rounded-xl border-2 border-[#1A1A1A] text-xs font-bold text-left transition-all ${activeType === t.value
                          ? 'bg-[#F6C945] text-[#1A1A1A] shadow-sm'
                          : 'bg-white text-[#1A1A1A] hover:bg-[#FAF7F0]'
                        }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Rilis */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider">
                  Status Rilis
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {STATUS_OPTIONS.map((st) => (
                    <button
                      key={st.value}
                      onClick={() => setActiveStatus(st.value)}
                      className={`py-2 px-2 rounded-xl border-2 border-[#1A1A1A] text-xs font-bold text-center transition-all ${activeStatus === st.value
                          ? 'bg-[#F6C945] text-[#1A1A1A] shadow-sm'
                          : 'bg-white text-[#1A1A1A] hover:bg-[#FAF7F0]'
                        }`}
                    >
                      {st.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Multi-Genre Selection */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider">
                    Pilih Multi-Genre ({selectedGenres.length} terpilih)
                  </span>
                  {selectedGenres.length > 0 && (
                    <button
                      onClick={() => setSelectedGenres([])}
                      className="text-[11px] font-bold text-[#E96379] underline"
                    >
                      Reset Genre
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {genres.map((g) => {
                    const isSel = selectedGenres.includes(g.slug);
                    return (
                      <button
                        key={g.slug}
                        onClick={() => handleToggleGenre(g.slug)}
                        className={`py-2 px-2.5 rounded-xl border-2 border-[#1A1A1A] text-xs font-bold flex items-center justify-between transition-all ${isSel
                            ? 'bg-[#2E7D6E] text-white shadow-sm'
                            : 'bg-white text-[#1A1A1A] hover:bg-[#FAF7F0]'
                          }`}
                      >
                        <span className="truncate">{g.name}</span>
                        <span className="text-[10px] opacity-80">({g.count ?? 0})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2 border-t-2 border-[#1A1A1A]">
              <button
                onClick={handleResetFilters}
                className="flex-1 py-3 rounded-2xl bg-white border-2 border-[#1A1A1A] font-black text-xs text-[#1A1A1A] shadow-sm hover:bg-[#FAF7F0]"
              >
                Reset Semua
              </button>
              <button
                onClick={() => setIsFilterDrawerOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-[#F6C945] border-2 border-[#1A1A1A] font-black text-xs text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] hover:bg-[#EDB72B]"
              >
                Terapkan ({total} Komik)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F2E6] flex items-center justify-center font-bold">Memuat katalog...</div>}>
      <BrowseContent />
    </Suspense>
  );
}
