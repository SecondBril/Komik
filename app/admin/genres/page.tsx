'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Tags,
  Plus,
  Search,
  Trash2,
  Pencil,
  BookOpen,
  AlertTriangle,
  Loader2,
  X,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Toast } from '@/components/ui/Toast';

interface ComicInfo {
  id: string;
  title: string;
  slug: string;
}

interface GenreItem {
  id: number;
  name: string;
  slug: string;
  comic_count: number;
  comics: ComicInfo[];
}

export default function AdminGenresPage() {
  const [genres, setGenres] = useState<GenreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGenreId, setExpandedGenreId] = useState<number | null>(null);

  // Add modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newGenreName, setNewGenreName] = useState('');
  const [newGenreSlug, setNewGenreSlug] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Edit modal state
  const [editingGenre, setEditingGenre] = useState<GenreItem | null>(null);
  const [editGenreName, setEditGenreName] = useState('');
  const [editGenreSlug, setEditGenreSlug] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal state
  const [genreToDelete, setGenreToDelete] = useState<GenreItem | null>(null);
  const [deleteOption, setDeleteOption] = useState<'genre_only' | 'with_comics'>('genre_only');
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [isToastOpen, setIsToastOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setIsToastOpen(true);
  };

  // Fetch genres from API
  const fetchGenres = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/genres');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setGenres(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch genres:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGenres();
  }, [fetchGenres]);

  // Handle Add Genre
  const handleAddGenre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGenreName.trim()) return;

    setIsAdding(true);
    try {
      const res = await fetch('/api/admin/genres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGenreName.trim(),
          slug: newGenreSlug.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Genre "${newGenreName}" berhasil ditambahkan.`);
        setNewGenreName('');
        setNewGenreSlug('');
        setIsAddModalOpen(false);
        fetchGenres();
      } else {
        alert(data.error || 'Gagal menambahkan genre.');
      }
    } catch (err: any) {
      alert(`Error: ${err?.message || err}`);
    } finally {
      setIsAdding(false);
    }
  };

  // Handle Edit Genre
  const openEditModal = (genre: GenreItem) => {
    setEditingGenre(genre);
    setEditGenreName(genre.name);
    setEditGenreSlug(genre.slug);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGenre || !editGenreName.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/genres', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingGenre.id,
          name: editGenreName.trim(),
          slug: editGenreSlug.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Genre "${editGenreName}" berhasil diperbarui.`);
        setEditingGenre(null);
        fetchGenres();
      } else {
        alert(data.error || 'Gagal memperbarui genre.');
      }
    } catch (err: any) {
      alert(`Error: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Genre
  const handleConfirmDelete = async () => {
    if (!genreToDelete) return;

    setIsDeleting(true);
    try {
      const deleteWithComics = deleteOption === 'with_comics';
      const url = `/api/admin/genres?id=${genreToDelete.id}&delete_comics=${deleteWithComics}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        showToast(
          deleteWithComics
            ? `Genre "${genreToDelete.name}" dan ${genreToDelete.comic_count} komik terkait berhasil dihapus.`
            : `Genre "${genreToDelete.name}" berhasil dihapus.`
        );
        setGenreToDelete(null);
        fetchGenres();
      } else {
        alert(data.error || 'Gagal menghapus genre.');
      }
    } catch (err: any) {
      alert(`Error: ${err?.message || err}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Genres
  const filteredGenres = genres.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalComicsLinked = genres.reduce((acc, g) => acc + g.comic_count, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner / Stats Card */}
      <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[4px_4px_0px_#1A1A1A] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#F6C945] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center shrink-0">
            <Tags className="w-6 h-6 text-[#1A1A1A] stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-[#1A1A1A] tracking-tight">
                Manajemen Genre Komik
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#2E7D6E] text-white border-2 border-[#1A1A1A] shadow-sm">
                {genres.length} Genre
              </span>
            </div>
            <p className="text-xs text-[#7A756D] font-medium mt-0.5">
              Tambah genre baru, edit slug/kategori, atau hapus genre beserta komik yang terkait.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={fetchGenres}
            className="p-2.5 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] border-2 border-[#1A1A1A] text-xs font-black shadow-[3px_3px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#1A1A1A] transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Tambah Genre Baru</span>
          </button>
        </div>
      </div>

      {/* Stats Mini Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl p-4 shadow-[3px_3px_0px_#1A1A1A]">
          <span className="text-[11px] font-extrabold uppercase text-[#7A756D] tracking-wider">
            Total Genre Terdaftar
          </span>
          <p className="text-2xl font-black text-[#1A1A1A] mt-1">{genres.length}</p>
        </div>
        <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl p-4 shadow-[3px_3px_0px_#1A1A1A]">
          <span className="text-[11px] font-extrabold uppercase text-[#7A756D] tracking-wider">
            Total Relasi Komik-Genre
          </span>
          <p className="text-2xl font-black text-[#2E7D6E] mt-1">{totalComicsLinked}</p>
        </div>
        <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl p-4 shadow-[3px_3px_0px_#1A1A1A]">
          <span className="text-[11px] font-extrabold uppercase text-[#7A756D] tracking-wider">
            Genre Terpopuler
          </span>
          <p className="text-sm font-black text-[#2A4FCB] mt-1 truncate">
            {genres.length > 0
              ? [...genres].sort((a, b) => b.comic_count - a.comic_count)[0]?.name || '-'
              : '-'}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama genre atau slug..."
          className="w-full bg-white border-2 border-[#1A1A1A] rounded-full py-2.5 pl-10 pr-4 text-xs font-bold text-[#1A1A1A] placeholder-[#8C8C8C] shadow-[2px_2px_0px_#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
        />
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A1A] stroke-[2.5]" />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8C8C8C] hover:text-[#1A1A1A]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Genres Table / Grid */}
      <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl sm:rounded-3xl shadow-[4px_4px_0px_#1A1A1A] overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#7A756D] gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#2E7D6E]" />
            <span className="text-xs font-bold">Memuat daftar genre...</span>
          </div>
        ) : filteredGenres.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center p-6">
            <Tags className="w-12 h-12 text-[#B3ADA0] mb-3 stroke-[1.5]" />
            <h3 className="text-sm font-black text-[#1A1A1A]">Genre Tidak Ditemukan</h3>
            <p className="text-xs text-[#7A756D] mt-1 max-w-xs">
              {searchQuery
                ? `Tidak ada genre yang cocok dengan "${searchQuery}".`
                : 'Belum ada genre di database. Klik "Tambah Genre Baru" di atas.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#1A1A1A] bg-[#FAF7F0] text-[11px] font-black uppercase tracking-wider text-[#1A1A1A]">
                  <th className="py-3.5 px-4 sm:px-6">Nama Genre</th>
                  <th className="py-3.5 px-4 sm:px-6">Slug (URL)</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Jumlah Komik</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#1A1A1A]/10 text-xs font-bold">
                {filteredGenres.map((genre) => {
                  const isExpanded = expandedGenreId === genre.id;
                  return (
                    <React.Fragment key={genre.id}>
                      <tr className="hover:bg-[#FAF7F0]/60 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center gap-2.5">
                            <span className="font-black text-sm text-[#1A1A1A]">{genre.name}</span>
                            {genre.comic_count > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedGenreId(isExpanded ? null : genre.id)}
                                className="p-1 rounded-md hover:bg-black/5 text-[#7A756D]"
                                title="Lihat komik terkait"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-[#2E7D6E]" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 font-mono text-[11px] text-[#7A756D]">
                          <span className="px-2.5 py-1 rounded-md bg-[#FAF7F0] border border-[#1A1A1A]/20">
                            {genre.slug}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border-2 border-[#1A1A1A] text-xs font-black shadow-sm ${
                              genre.comic_count > 0
                                ? 'bg-[#F6C945] text-[#1A1A1A]'
                                : 'bg-[#FAF7F0] text-[#7A756D]'
                            }`}
                          >
                            <BookOpen className="w-3 h-3" />
                            {genre.comic_count} Komik
                          </span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(genre)}
                              className="p-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all"
                              title="Edit Genre"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setGenreToDelete(genre);
                                setDeleteOption('genre_only');
                              }}
                              className="p-2 rounded-full bg-[#FFEAEA] hover:bg-[#FFD6D6] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#C53030] active:translate-x-[1px] active:translate-y-[1px] transition-all"
                              title="Hapus Genre"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable comics row */}
                      {isExpanded && genre.comics && genre.comics.length > 0 && (
                        <tr className="bg-[#FAF7F0]/40">
                          <td colSpan={4} className="py-3 px-6 sm:px-8 border-b-2 border-[#1A1A1A]/10">
                            <div className="flex flex-col gap-2">
                              <span className="text-[11px] font-black uppercase tracking-wider text-[#7A756D]">
                                Komik dengan genre &quot;{genre.name}&quot; ({genre.comics.length}):
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {genre.comics.map((c) => (
                                  <Link
                                    key={c.id}
                                    href={`/komik/${c.slug}`}
                                    target="_blank"
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-xs font-bold text-[#1A1A1A] hover:bg-[#FAF7F0] transition-colors group"
                                  >
                                    <span>{c.title}</span>
                                    <ExternalLink className="w-3 h-3 text-[#7A756D] group-hover:text-[#2E7D6E]" />
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Tambah Genre Baru */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-[#F7F2E6] rounded-3xl border-[3px] border-[#1A1A1A] shadow-[8px_8px_0px_#1A1A1A] p-6 flex flex-col gap-4">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#1A1A1A] hover:bg-[#FAF7F0]"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-[#F6C945] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]">
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#1A1A1A]">Tambah Genre Baru</h3>
                <p className="text-xs text-[#7A756D] font-medium">
                  Buat kategori genre baru untuk komik.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddGenre} className="flex flex-col gap-3.5 mt-2">
              <div>
                <label className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider mb-1 block">
                  Nama Genre <span className="text-[#E96379]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Cyberpunk, Isekai, Romcom"
                  value={newGenreName}
                  onChange={(e) => {
                    setNewGenreName(e.target.value);
                    if (!newGenreSlug || newGenreSlug === newGenreName.toLowerCase().replace(/[^a-z0-9-]/g, '-')) {
                      setNewGenreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                    }
                  }}
                  className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3.5 py-2 text-xs font-bold text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                />
              </div>

              <div>
                <label className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider mb-1 block">
                  Slug URL (Otomatis)
                </label>
                <input
                  type="text"
                  placeholder="cyberpunk"
                  value={newGenreSlug}
                  onChange={(e) => setNewGenreSlug(e.target.value)}
                  className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3.5 py-2 text-xs font-bold text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E] font-mono"
                />
                <p className="text-[10px] text-[#7A756D] mt-1 font-medium">
                  Format URL ramah SEO, huruf kecil tanpa spasi (misal: slice-of-life).
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-3 pt-3 border-t-2 border-[#1A1A1A]/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isAdding || !newGenreName.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#2E7D6E] hover:bg-[#256659] text-white border-2 border-[#1A1A1A] text-xs font-black shadow-[2px_2px_0px_#1A1A1A] disabled:opacity-50"
                >
                  {isAdding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Genre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Genre */}
      {editingGenre && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-[#F7F2E6] rounded-3xl border-[3px] border-[#1A1A1A] shadow-[8px_8px_0px_#1A1A1A] p-6 flex flex-col gap-4">
            <button
              onClick={() => setEditingGenre(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#1A1A1A] hover:bg-[#FAF7F0]"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-[#2A4FCB] text-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]">
                <Pencil className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#1A1A1A]">Edit Genre</h3>
                <p className="text-xs text-[#7A756D] font-medium">
                  Perbarui nama dan slug kategori genre.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-3.5 mt-2">
              <div>
                <label className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider mb-1 block">
                  Nama Genre <span className="text-[#E96379]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editGenreName}
                  onChange={(e) => setEditGenreName(e.target.value)}
                  className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3.5 py-2 text-xs font-bold text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                />
              </div>

              <div>
                <label className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider mb-1 block">
                  Slug URL
                </label>
                <input
                  type="text"
                  required
                  value={editGenreSlug}
                  onChange={(e) => setEditGenreSlug(e.target.value)}
                  className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3.5 py-2 text-xs font-bold text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E] font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-3 pt-3 border-t-2 border-[#1A1A1A]/10">
                <button
                  type="button"
                  onClick={() => setEditingGenre(null)}
                  className="px-4 py-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !editGenreName.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#2A4FCB] hover:bg-[#203EA5] text-white border-2 border-[#1A1A1A] text-xs font-black shadow-[2px_2px_0px_#1A1A1A] disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Hapus Genre & Komik Terkait */}
      {genreToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-[#F7F2E6] rounded-3xl border-[3px] border-[#1A1A1A] shadow-[8px_8px_0px_#1A1A1A] p-6 flex flex-col gap-4">
            <button
              onClick={() => setGenreToDelete(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#1A1A1A] hover:bg-[#FAF7F0]"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-[#FFEAEA] text-[#C53030] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] shrink-0">
                <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#1A1A1A]">
                  Hapus Genre &quot;{genreToDelete.name}&quot;?
                </h3>
                <p className="text-xs text-[#7A756D] font-medium mt-0.5">
                  Terdapat <strong>{genreToDelete.comic_count} komik</strong> yang terhubung dengan
                  genre ini. Pilih metode penghapusan yang diinginkan:
                </p>
              </div>
            </div>

            {/* Option Selection Radio Cards */}
            <div className="flex flex-col gap-2.5 mt-2">
              <label
                onClick={() => setDeleteOption('genre_only')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                  deleteOption === 'genre_only'
                    ? 'bg-white border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A]'
                    : 'bg-[#FAF7F0] border-[#1A1A1A]/20 opacity-80'
                }`}
              >
                <input
                  type="radio"
                  name="deleteOption"
                  checked={deleteOption === 'genre_only'}
                  onChange={() => setDeleteOption('genre_only')}
                  className="mt-1"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-black text-[#1A1A1A]">
                    Hanya Hapus Genre (Aman)
                  </span>
                  <span className="text-[11px] text-[#7A756D] font-medium mt-0.5 leading-relaxed">
                    Hanya menghapus genre ini dari database. Seluruh komik terkait tetap aman dan tidak
                    dihapus.
                  </span>
                </div>
              </label>

              <label
                onClick={() => setDeleteOption('with_comics')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                  deleteOption === 'with_comics'
                    ? 'bg-[#FFEAEA] border-[#C53030] shadow-[3px_3px_0px_#C53030]'
                    : 'bg-[#FAF7F0] border-[#1A1A1A]/20 opacity-80'
                }`}
              >
                <input
                  type="radio"
                  name="deleteOption"
                  checked={deleteOption === 'with_comics'}
                  onChange={() => setDeleteOption('with_comics')}
                  className="mt-1 accent-red-600"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-black text-[#C53030]">
                    Hapus Genre BESERTA Seluruh Komik Terkait ({genreToDelete.comic_count} Komik)
                  </span>
                  <span className="text-[11px] text-[#902A2A] font-medium mt-0.5 leading-relaxed">
                    ⚠️ <strong>PERINGATAN:</strong> Seluruh {genreToDelete.comic_count} komik yang
                    memiliki genre ini akan <strong>dihapus permanen</strong> dari database beserta
                    seluruh chapter dan folder gambar!
                  </span>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 mt-3 pt-3 border-t-2 border-[#1A1A1A]/10">
              <button
                type="button"
                onClick={() => setGenreToDelete(null)}
                className="px-4 py-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#E96379] hover:bg-[#D44E64] text-white border-2 border-[#1A1A1A] text-xs font-black shadow-[2px_2px_0px_#1A1A1A] disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {deleteOption === 'with_comics'
                  ? 'Hapus Genre & Komik Terkait'
                  : 'Hapus Genre Saja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <Toast
        isOpen={isToastOpen}
        onClose={() => setIsToastOpen(false)}
        message={toastMessage}
      />
    </div>
  );
}
