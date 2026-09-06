'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Search,
  Trash2,
  List,
  Plus,
  AlertTriangle,
  X,
  Loader2,
  ExternalLink,
  Layers,
  FileText,
} from 'lucide-react';
import { Toast } from '@/components/ui/Toast';

interface AdminComic {
  id: string;
  title: string;
  slug: string;
  type: string;
  cover_url: string;
  status: string;
  author: string;
  total_chapters: number;
  created_at: string;
}

interface AdminChapter {
  id: string;
  chapter_number: number;
  title: string;
  status: string;
  total_pages: number;
  released_at: string;
}

export default function AdminComicsPage() {
  const [comics, setComics] = useState<AdminComic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Selected Comic for Chapter Management Drawer
  const [selectedComic, setSelectedComic] = useState<AdminComic | null>(null);
  const [chapters, setChapters] = useState<AdminChapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);

  // Deletion Modal States
  const [comicToDelete, setComicToDelete] = useState<AdminComic | null>(null);
  const [chapterToDelete, setChapterToDelete] = useState<AdminChapter | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [isToastOpen, setIsToastOpen] = useState(false);

  // Fetch Comics
  const fetchComics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/comics');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setComics(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch comics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComics();
  }, []);

  // Fetch Chapters when a comic is selected
  const fetchChapters = async (comicId: string) => {
    setLoadingChapters(true);
    try {
      const res = await fetch(`/api/admin/chapters?comicId=${comicId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setChapters(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch chapters:', err);
    } finally {
      setLoadingChapters(false);
    }
  };

  const handleOpenChapters = (comic: AdminComic) => {
    setSelectedComic(comic);
    fetchChapters(comic.id);
  };

  // Handle Delete Comic
  const confirmDeleteComic = async () => {
    if (!comicToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/comics?id=${comicToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(`Komik "${comicToDelete.title}" berhasil dihapus.`);
        setIsToastOpen(true);
        setComics((prev) => prev.filter((c) => c.id !== comicToDelete.id));
        if (selectedComic?.id === comicToDelete.id) {
          setSelectedComic(null);
        }
      } else {
        alert(`Gagal menghapus komik: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err?.message || err}`);
    } finally {
      setIsDeleting(false);
      setComicToDelete(null);
    }
  };

  // Handle Delete Chapter
  const confirmDeleteChapter = async () => {
    if (!chapterToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/chapters?id=${chapterToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(`Chapter ${chapterToDelete.chapter_number} berhasil dihapus.`);
        setIsToastOpen(true);
        setChapters((prev) => prev.filter((ch) => ch.id !== chapterToDelete.id));
        // Refresh total chapters count in main comic list
        setComics((prev) =>
          prev.map((c) =>
            c.id === selectedComic?.id ? { ...c, total_chapters: Math.max(0, c.total_chapters - 1) } : c
          )
        );
      } else {
        alert(`Gagal menghapus chapter: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err?.message || err}`);
    } finally {
      setIsDeleting(false);
      setChapterToDelete(null);
    }
  };

  // Filtered comics
  const filteredComics = comics.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header Bar */}
      <div className="bg-[#171A21] border border-[#2A2F3A] rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-[#7C5CFC]/10 text-[#7C5CFC] border border-[#7C5CFC]/20">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Manajemen Komik & Chapter</h2>
            <p className="text-xs text-[#9AA0AC] mt-0.5">
              Kelola komik di database, lihat daftar chapter per komik, dan hapus komik/chapter bila diperlukan.
            </p>
          </div>
        </div>

        <Link
          href="/admin/upload"
          className="px-4 py-2.5 rounded-xl bg-[#7C5CFC] hover:bg-[#6846F9] text-white text-xs font-bold transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Input Komik Baru
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#171A21] border border-[#2A2F3A] rounded-2xl p-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#9AA0AC] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari judul komik..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-[#5A606E] focus:outline-none focus:border-[#7C5CFC]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {['all', 'manhwa', 'manga', 'manhua'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                typeFilter === t
                  ? 'bg-[#7C5CFC] text-white'
                  : 'bg-[#0F1115] text-[#9AA0AC] border border-[#2A2F3A] hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Comics Table */}
      <div className="bg-[#171A21] border border-[#2A2F3A] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#9AA0AC] gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#7C5CFC]" />
            <span className="text-xs">Memuat data komik dari database...</span>
          </div>
        ) : filteredComics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center p-6">
            <BookOpen className="w-12 h-12 text-[#5B616D] mb-3 stroke-[1.5]" />
            <h3 className="text-sm font-bold text-white">Komik Tidak Ditemukan</h3>
            <p className="text-xs text-[#9AA0AC] mt-1">
              {searchQuery ? `Tidak ada komik yang cocok dengan "${searchQuery}".` : 'Belum ada komik terdaftar di database.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2A2F3A] text-[11px] font-bold uppercase tracking-wider text-[#9AA0AC] bg-[#0F1115]/50">
                  <th className="py-3.5 px-4">Komik</th>
                  <th className="py-3.5 px-4">Tipe</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Total Chapter</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2F3A] text-xs">
                {filteredComics.map((c) => (
                  <tr key={c.id} className="hover:bg-[#1F232C]/50 transition-colors">
                    {/* Comic Title & Cover */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-14 rounded-lg overflow-hidden border border-[#2A2F3A] shrink-0 bg-black/40">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.cover_url} alt={c.title} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <Link
                            href={`/komik/${c.slug}`}
                            target="_blank"
                            className="font-bold text-white hover:text-[#7C5CFC] transition-colors flex items-center gap-1 group"
                          >
                            {c.title}
                            <ExternalLink className="w-3 h-3 text-[#9AA0AC] group-hover:text-[#7C5CFC] opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                          <p className="text-[11px] text-[#9AA0AC] font-mono mt-0.5">slug: {c.slug}</p>
                        </div>
                      </div>
                    </td>

                    {/* Type Tag */}
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {c.type}
                      </span>
                    </td>

                    {/* Status Tag */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                          c.status === 'completed'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>

                    {/* Total Chapters */}
                    <td className="py-3.5 px-4 text-center font-semibold text-white">
                      <span className="px-2.5 py-1 rounded-lg bg-[#0F1115] border border-[#2A2F3A] text-xs">
                        {c.total_chapters} Chapter
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenChapters(c)}
                          className="px-3 py-1.5 rounded-lg bg-[#7C5CFC]/10 hover:bg-[#7C5CFC]/20 text-[#7C5CFC] border border-[#7C5CFC]/30 text-xs font-bold transition-colors flex items-center gap-1.5"
                        >
                          <List className="w-3.5 h-3.5" />
                          Kelola Chapter
                        </button>
                        <button
                          type="button"
                          onClick={() => setComicToDelete(c)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors"
                          title="Hapus Komik"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chapter Drawer / Modal */}
      {selectedComic && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-[#171A21] border-l border-[#2A2F3A] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#2A2F3A] flex items-center justify-between bg-[#0F1115]/60">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-12 rounded-lg overflow-hidden border border-[#2A2F3A] shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedComic.cover_url} alt={selectedComic.title} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedComic.title}</h3>
                  <p className="text-xs text-[#9AA0AC]">Daftar Chapter Terdaftar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedComic(null)}
                className="p-2 rounded-xl bg-[#1F232C] hover:bg-[#2A2F3A] text-[#9AA0AC] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chapter List */}
            <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-3">
              {loadingChapters ? (
                <div className="flex items-center justify-center py-12 text-[#9AA0AC] gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#7C5CFC]" />
                  <span className="text-xs">Memuat daftar chapter...</span>
                </div>
              ) : chapters.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Layers className="w-10 h-10 text-[#5B616D] mb-2 stroke-[1.5]" />
                  <p className="text-xs text-[#9AA0AC]">Belum ada chapter untuk komik ini.</p>
                </div>
              ) : (
                chapters.map((ch) => (
                  <div
                    key={ch.id}
                    className="p-3.5 rounded-xl bg-[#0F1115] border border-[#2A2F3A] flex items-center justify-between gap-4 hover:border-[#7C5CFC]/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Chapter {ch.chapter_number}</span>
                        {ch.title && <span className="text-xs text-[#9AA0AC]">- {ch.title}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[#9AA0AC] mt-1">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-[#7C5CFC]" /> {ch.total_pages} Halaman
                        </span>
                        <span>•</span>
                        <span
                          className={`font-semibold ${
                            ch.status === 'published' ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {ch.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/komik/${selectedComic.slug}/${ch.chapter_number}`}
                        target="_blank"
                        className="px-2.5 py-1 rounded-lg bg-[#1F232C] hover:bg-[#2A2F3A] text-xs text-[#9AA0AC] hover:text-white font-medium transition-colors"
                      >
                        Lihat
                      </Link>
                      <button
                        type="button"
                        onClick={() => setChapterToDelete(ch)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors"
                        title="Hapus Chapter"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation Delete Comic */}
      {comicToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#171A21] border border-[#2A2F3A] rounded-2xl p-6 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-red-500/10 text-red-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Hapus Komik?</h3>
                <p className="text-xs text-[#9AA0AC] mt-1">
                  Apakah Anda yakin ingin menghapus komik <strong>&quot;{comicToDelete.title}&quot;</strong>? Semua chapter dan lembar halaman gambar komik ini di database akan ikut terhapus.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setComicToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-[#1F232C] hover:bg-[#2A2F3A] text-xs font-bold text-[#9AA0AC] hover:text-white transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteComic}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors flex items-center gap-2"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Ya, Hapus Komik
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation Delete Chapter */}
      {chapterToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#171A21] border border-[#2A2F3A] rounded-2xl p-6 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-red-500/10 text-red-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Hapus Chapter {chapterToDelete.chapter_number}?</h3>
                <p className="text-xs text-[#9AA0AC] mt-1">
                  Apakah Anda yakin ingin menghapus Chapter {chapterToDelete.chapter_number}? Halaman gambar chapter ini di database akan dihapus secara permanen.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setChapterToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-[#1F232C] hover:bg-[#2A2F3A] text-xs font-bold text-[#9AA0AC] hover:text-white transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteChapter}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors flex items-center gap-2"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Ya, Hapus Chapter
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toastMessage} isOpen={isToastOpen} onClose={() => setIsToastOpen(false)} />
    </div>
  );
}
