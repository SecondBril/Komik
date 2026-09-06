'use client';

import React, { useState } from 'react';
import { FilterState, Genre, ComicType, ComicStatus } from '@/lib/types';
import { GenreChip } from '@/components/comic/GenreChip';
import { Filter, RotateCcw, X, Search } from 'lucide-react';

interface FilterPanelProps {
  genres: Genre[];
  initialFilters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onReset: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  genres,
  initialFilters,
  onFilterChange,
  onReset,
}) => {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [genreSearch, setGenreSearch] = useState('');

  const filteredGenres = genres.filter((g) =>
    g.name.toLowerCase().includes(genreSearch.toLowerCase())
  );

  const handleTypeSelect = (type: ComicType | 'all') => {
    onFilterChange({ ...initialFilters, type });
  };

  const handleStatusSelect = (status: ComicStatus | 'all') => {
    onFilterChange({ ...initialFilters, status });
  };

  const handleGenreToggle = (genreId: number) => {
    const current = initialFilters.genres || [];
    const updated = current.includes(genreId)
      ? current.filter((id) => id !== genreId)
      : [...current, genreId];
    onFilterChange({ ...initialFilters, genres: updated });
  };

  const filterContent = (
    <div className="flex flex-col gap-6 text-[#F2F3F5]">
      {/* 1. Tipe Komik */}
      <div className="flex flex-col gap-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-[#9AA0AC]">
          Tipe Komik
        </label>
        <div className="flex flex-wrap gap-2">
          {(['all', 'manga', 'manhwa', 'manhua'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeSelect(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase border transition-all ${
                (initialFilters.type || 'all') === t
                  ? 'bg-[#7C5CFC] text-white border-[#7C5CFC]'
                  : 'bg-[#171A21] text-[#9AA0AC] border-[#2A2F3A] hover:text-white'
              }`}
            >
              {t === 'all' ? 'Semua Tipe' : t}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Status Komik */}
      <div className="flex flex-col gap-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-[#9AA0AC]">
          Status Rilis
        </label>
        <div className="flex flex-wrap gap-2">
          {(['all', 'ongoing', 'completed'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleStatusSelect(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize border transition-all ${
                (initialFilters.status || 'all') === s
                  ? 'bg-[#7C5CFC] text-white border-[#7C5CFC]'
                  : 'bg-[#171A21] text-[#9AA0AC] border-[#2A2F3A] hover:text-white'
              }`}
            >
              {s === 'all' ? 'Semua Status' : s}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Genre Selector */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-[#9AA0AC]">
            Genre Komik
          </label>

          {initialFilters.genres.length > 0 && (
            <span className="text-[11px] text-[#7C5CFC] font-semibold">
              {initialFilters.genres.length} Dipilih
            </span>
          )}
        </div>

        {/* Small Genre Filter Input */}
        {genres.length > 8 && (
          <div className="relative">
            <input
              type="text"
              placeholder="Cari genre..."
              value={genreSearch}
              onChange={(e) => setGenreSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 bg-[#0F1115] border border-[#2A2F3A] rounded-lg text-xs text-[#F2F3F5] placeholder-[#5B616D] focus:outline-none focus:border-[#7C5CFC]"
            />
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-[#5B616D]" />
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
          {filteredGenres.map((genre) => (
            <GenreChip
              key={genre.id}
              label={genre.name}
              isSelected={initialFilters.genres.includes(genre.id)}
              onClick={() => handleGenreToggle(genre.id)}
            />
          ))}
        </div>
      </div>

      {/* Reset Action */}
      <div className="pt-4 border-t border-[#2A2F3A] flex items-center justify-between">
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 text-xs text-[#9AA0AC] hover:text-white transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Filter
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-[#171A21] border border-[#2A2F3A] rounded-xl p-5 h-fit sticky top-20">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#2A2F3A]">
          <Filter className="w-4 h-4 text-[#7C5CFC]" />
          <h2 className="font-bold text-sm text-[#F2F3F5]">Filter Katalog</h2>
        </div>
        {filterContent}
      </aside>

      {/* Mobile Floating Trigger Button */}
      <div className="lg:hidden mb-4">
        <button
          type="button"
          onClick={() => setIsOpenMobile(true)}
          className="w-full h-11 bg-[#171A21] border border-[#2A2F3A] rounded-xl text-sm font-semibold text-[#F2F3F5] flex items-center justify-center gap-2 shadow-md hover:border-[#7C5CFC] transition-colors"
        >
          <Filter className="w-4 h-4 text-[#7C5CFC]" />
          Filter Komik
          {initialFilters.genres.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-[#7C5CFC] text-white text-xs flex items-center justify-center">
              {initialFilters.genres.length}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Bottom Sheet Modal */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-fade-in">
          <div className="bg-[#171A21] border-t border-[#2A2F3A] rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#2A2F3A]">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#7C5CFC]" />
                <h3 className="font-bold text-base text-[#F2F3F5]">Filter Katalog</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpenMobile(false)}
                className="p-1 rounded-lg text-[#9AA0AC] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {filterContent}
            <button
              type="button"
              onClick={() => setIsOpenMobile(false)}
              className="mt-6 w-full h-11 bg-[#7C5CFC] hover:bg-[#6A47F0] text-white font-bold text-sm rounded-xl transition-colors shadow-lg shadow-[#7C5CFC]/20"
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      )}
    </>
  );
};
