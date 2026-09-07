'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Pencil,
  GripVertical,
  Save,
  RefreshCw,
  Image as ImageIcon,
  ChevronDown,
} from 'lucide-react';
import { Toast } from '@/components/ui/Toast';

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface AdminComic {
  id: string;
  title: string;
  slug: string;
  type: string;
  cover_url: string;
  status: string;
  author: string;
  synopsis: string;
  rating?: number;
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

interface ChapterPage {
  id: string;
  page_number: number;
  image_url: string;
}

// ─── Drag & Drop hook for page reordering ────────────────────────────────────

function useDragSort<T extends { id: string }>(
  initialItems: T[],
  onReorder: (items: T[]) => void
) {
  const [items, setItems] = useState<T[]>(initialItems);
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const handleDragStart = (index: number) => {
    dragIndex.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverIndex.current = index;
    if (dragIndex.current === null || dragIndex.current === index) return;
    const newItems = [...items];
    const [removed] = newItems.splice(dragIndex.current, 1);
    newItems.splice(index, 0, removed);
    dragIndex.current = index;
    setItems(newItems);
    onReorder(newItems);
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
    dragOverIndex.current = null;
  };

  return { items, handleDragStart, handleDragEnter, handleDragEnd };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminComicsPage() {
  const [comics, setComics] = useState<AdminComic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Chapter drawer
  const [selectedComic, setSelectedComic] = useState<AdminComic | null>(null);
  const [chapters, setChapters] = useState<AdminChapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);

  // Deletion
  const [comicToDelete, setComicToDelete] = useState<AdminComic | null>(null);
  const [chapterToDelete, setChapterToDelete] = useState<AdminChapter | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit Comic Modal
  const [editingComic, setEditingComic] = useState<AdminComic | null>(null);
  const [editComicForm, setEditComicForm] = useState<Partial<AdminComic>>({});
  const [isSavingComic, setIsSavingComic] = useState(false);

  // Edit Chapter Modal
  const [editingChapter, setEditingChapter] = useState<AdminChapter | null>(null);
  const [editChapterForm, setEditChapterForm] = useState<Partial<AdminChapter>>({});
  const [chapterPages, setChapterPages] = useState<ChapterPage[]>([]);
  const [reorderedPages, setReorderedPages] = useState<ChapterPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [isSavingChapter, setIsSavingChapter] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [isToastOpen, setIsToastOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setIsToastOpen(true);
  };

  // ── Fetches ────────────────────────────────────────────────────────────────

  const fetchComics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/comics');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) setComics(data.data);
    } catch (err) {
      console.error('Failed to fetch comics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchComics(); }, [fetchComics]);

  const fetchChapters = async (comicId: string) => {
    setLoadingChapters(true);
    try {
      const res = await fetch(`/api/admin/chapters?comicId=${comicId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) setChapters(data.data);
    } catch (err) {
      console.error('Failed to fetch chapters:', err);
    } finally {
      setLoadingChapters(false);
    }
  };

  const fetchChapterPages = async (chapterId: string) => {
    setLoadingPages(true);
    try {
      const res = await fetch(`/api/admin/chapters/pages?chapterId=${chapterId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setChapterPages(data.data);
        setReorderedPages(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch chapter pages:', err);
    } finally {
      setLoadingPages(false);
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleOpenChapters = (comic: AdminComic) => {
    setSelectedComic(comic);
    fetchChapters(comic.id);
  };

  // Delete comic
  const confirmDeleteComic = async () => {
    if (!comicToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/comics?id=${comicToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(`Komik "${comicToDelete.title}" berhasil dihapus.`);
        setComics((prev) => prev.filter((c) => c.id !== comicToDelete.id));
        if (selectedComic?.id === comicToDelete.id) setSelectedComic(null);
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

  // Delete chapter
  const confirmDeleteChapter = async () => {
    if (!chapterToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/chapters?id=${chapterToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(`Chapter ${chapterToDelete.chapter_number} berhasil dihapus.`);
        setChapters((prev) => prev.filter((ch) => ch.id !== chapterToDelete.id));
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

  // Open edit comic modal
  const openEditComic = (comic: AdminComic) => {
    setEditingComic(comic);
    setEditComicForm({
      title: comic.title,
      slug: comic.slug,
      author: comic.author,
      synopsis: comic.synopsis || '',
      status: comic.status,
      type: comic.type,
      cover_url: comic.cover_url,
      rating: comic.rating,
    });
  };

  // Save edit comic
  const saveEditComic = async () => {
    if (!editingComic) return;
    setIsSavingComic(true);
    try {
      const res = await fetch('/api/admin/comics', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingComic.id, ...editComicForm }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Komik "${editComicForm.title}" berhasil diperbarui.`);
        setComics((prev) =>
          prev.map((c) => (c.id === editingComic.id ? { ...c, ...editComicForm } as AdminComic : c))
        );
        setEditingComic(null);
      } else {
        alert(`Gagal menyimpan: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err?.message}`);
    } finally {
      setIsSavingComic(false);
    }
  };

  // Open edit chapter modal
  const openEditChapter = (chapter: AdminChapter) => {
    setEditingChapter(chapter);
    setEditChapterForm({
      chapter_number: chapter.chapter_number,
      title: chapter.title,
      status: chapter.status,
    });
    setChapterPages([]);
    setReorderedPages([]);
    fetchChapterPages(chapter.id);
  };

  // Save edit chapter
  const saveEditChapter = async () => {
    if (!editingChapter) return;
    setIsSavingChapter(true);
    try {
      // Build page_order with new page numbers based on reorderedPages array index
      const page_order = reorderedPages.map((p, idx) => ({ id: p.id, page_number: idx + 1 }));

      const res = await fetch('/api/admin/chapters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingChapter.id,
          ...editChapterForm,
          page_order,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Chapter ${editChapterForm.chapter_number} berhasil diperbarui.`);
        setChapters((prev) =>
          prev.map((ch) =>
            ch.id === editingChapter.id
              ? { ...ch, ...editChapterForm, chapter_number: Number(editChapterForm.chapter_number) }
              : ch
          )
        );
        setEditingChapter(null);
      } else {
        alert(`Gagal menyimpan: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err?.message}`);
    } finally {
      setIsSavingChapter(false);
    }
  };

  // Drag & drop pages
  const { items: draggablePages, handleDragStart, handleDragEnter, handleDragEnd } = useDragSort(
    chapterPages,
    (newOrder) => setReorderedPages(newOrder)
  );

  // Filtered comics
  const filteredComics = comics.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // ── Status/Type badge helpers ──────────────────────────────────────────────

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      ongoing: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      hiatus: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      dropped: 'bg-red-500/10 text-red-400 border-red-500/20',
      published: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    };
    return `px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${map[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Header Bar */}
      <div className="bg-[#171A21] border border-[#2A2F3A] rounded-2xl p-4 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 md:p-3 rounded-2xl bg-[#7C5CFC]/10 text-[#7C5CFC] border border-[#7C5CFC]/20 shrink-0">
            <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-bold text-white">Manajemen Komik &amp; Chapter</h2>
            <p className="text-xs text-[#9AA0AC] mt-0.5 hidden sm:block">
              Kelola komik di database, lihat daftar chapter per komik, edit dan hapus bila diperlukan.
            </p>
          </div>
        </div>
        <Link
          href="/admin/upload"
          className="px-4 py-2.5 rounded-xl bg-[#7C5CFC] hover:bg-[#6846F9] text-white text-xs font-bold transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2 shrink-0 w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          Input Komik Baru
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#171A21] border border-[#2A2F3A] rounded-2xl p-4">
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
        <div className="flex items-center gap-2 flex-wrap">
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

      {/* Comics — Table (desktop) / Card list (mobile) */}
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
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#2A2F3A] text-[11px] font-bold uppercase tracking-wider text-[#9AA0AC] bg-[#0F1115]/50">
                    <th className="py-3.5 px-4">Komik</th>
                    <th className="py-3.5 px-4">Tipe</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-center">Chapter</th>
                    <th className="py-3.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2F3A] text-xs">
                  {filteredComics.map((c) => (
                    <tr key={c.id} className="hover:bg-[#1F232C]/50 transition-colors">
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
                            <p className="text-[11px] text-[#9AA0AC] font-mono mt-0.5">{c.author}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {c.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={statusBadge(c.status)}>{c.status}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-white">
                        <span className="px-2.5 py-1 rounded-lg bg-[#0F1115] border border-[#2A2F3A] text-xs">
                          {c.total_chapters}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenChapters(c)}
                            className="px-3 py-1.5 rounded-lg bg-[#7C5CFC]/10 hover:bg-[#7C5CFC]/20 text-[#7C5CFC] border border-[#7C5CFC]/30 text-xs font-bold transition-colors flex items-center gap-1.5"
                          >
                            <List className="w-3.5 h-3.5" />
                            Chapter
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditComic(c)}
                            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition-colors"
                            title="Edit Komik"
                          >
                            <Pencil className="w-4 h-4" />
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

            {/* Mobile Card List */}
            <div className="md:hidden flex flex-col divide-y divide-[#2A2F3A]">
              {filteredComics.map((c) => (
                <div key={c.id} className="p-4 flex items-start gap-3">
                  <div className="relative w-12 h-16 rounded-lg overflow-hidden border border-[#2A2F3A] shrink-0 bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.cover_url} alt={c.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{c.title}</p>
                    <p className="text-[11px] text-[#9AA0AC] mt-0.5">{c.author}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {c.type}
                      </span>
                      <span className={statusBadge(c.status)}>{c.status}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#0F1115] text-[#9AA0AC] border border-[#2A2F3A]">
                        {c.total_chapters} Ch
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleOpenChapters(c)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#7C5CFC]/10 text-[#7C5CFC] border border-[#7C5CFC]/30 text-xs font-bold flex items-center gap-1"
                      >
                        <List className="w-3.5 h-3.5" /> Chapter
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditComic(c)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-bold flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setComicToDelete(c)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 text-xs font-bold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ═══ Chapter Drawer ═══════════════════════════════════════════════════ */}
      {selectedComic && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-[#171A21] border-l border-[#2A2F3A] h-full flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="p-4 md:p-5 border-b border-[#2A2F3A] flex items-center justify-between bg-[#0F1115]/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-12 rounded-lg overflow-hidden border border-[#2A2F3A] shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedComic.cover_url} alt={selectedComic.title} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white truncate max-w-[200px]">{selectedComic.title}</h3>
                  <p className="text-xs text-[#9AA0AC]">Daftar Chapter</p>
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
            <div className="flex-1 p-4 md:p-5 overflow-y-auto flex flex-col gap-2.5">
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
                    className="p-3 md:p-3.5 rounded-xl bg-[#0F1115] border border-[#2A2F3A] flex items-center justify-between gap-3 hover:border-[#7C5CFC]/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">Chapter {ch.chapter_number}</span>
                        {ch.title && <span className="text-xs text-[#9AA0AC] truncate">- {ch.title}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[#9AA0AC] mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-[#7C5CFC]" />
                          {ch.total_pages} Hal
                        </span>
                        <span className={`font-semibold ${ch.status === 'published' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {ch.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        href={`/komik/${selectedComic.slug}/${ch.chapter_number}`}
                        target="_blank"
                        className="p-1.5 rounded-lg bg-[#1F232C] hover:bg-[#2A2F3A] text-xs text-[#9AA0AC] hover:text-white transition-colors"
                        title="Lihat"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => openEditChapter(ch)}
                        className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition-colors"
                        title="Edit Chapter"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
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

      {/* ═══ Modal: Edit Komik ════════════════════════════════════════════════ */}
      {editingComic && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#171A21] border border-[#2A2F3A] rounded-2xl w-full max-w-lg flex flex-col gap-0 shadow-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#2A2F3A] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Edit Komik</h3>
                  <p className="text-[11px] text-[#9AA0AC]">Ubah metadata komik</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingComic(null)}
                className="p-2 rounded-xl bg-[#1F232C] hover:bg-[#2A2F3A] text-[#9AA0AC] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="overflow-y-auto p-5 flex flex-col gap-4">
              {/* Cover preview */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-20 rounded-xl overflow-hidden border border-[#2A2F3A] bg-black/40 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={editComicForm.cover_url || ''} alt="cover" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">Cover URL</label>
                  <input
                    type="url"
                    value={editComicForm.cover_url || ''}
                    onChange={(e) => setEditComicForm((f) => ({ ...f, cover_url: e.target.value }))}
                    className="mt-1 w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3 py-2 text-xs text-white placeholder-[#5A606E] focus:outline-none focus:border-[#7C5CFC]"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">Judul</label>
                  <input
                    type="text"
                    value={editComicForm.title || ''}
                    onChange={(e) => setEditComicForm((f) => ({ ...f, title: e.target.value }))}
                    className="mt-1 w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7C5CFC]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">Slug</label>
                  <input
                    type="text"
                    value={editComicForm.slug || ''}
                    onChange={(e) => setEditComicForm((f) => ({ ...f, slug: e.target.value }))}
                    className="mt-1 w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7C5CFC] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">Author</label>
                  <input
                    type="text"
                    value={editComicForm.author || ''}
                    onChange={(e) => setEditComicForm((f) => ({ ...f, author: e.target.value }))}
                    className="mt-1 w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7C5CFC]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">Rating</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={editComicForm.rating || ''}
                    onChange={(e) => setEditComicForm((f) => ({ ...f, rating: parseFloat(e.target.value) }))}
                    className="mt-1 w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7C5CFC]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">Tipe</label>
                  <div className="relative mt-1">
                    <select
                      value={editComicForm.type || ''}
                      onChange={(e) => setEditComicForm((f) => ({ ...f, type: e.target.value }))}
                      className="w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7C5CFC] appearance-none pr-8"
                    >
                      {['manhwa', 'manga', 'manhua'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[#9AA0AC] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">Status</label>
                  <div className="relative mt-1">
                    <select
                      value={editComicForm.status || ''}
                      onChange={(e) => setEditComicForm((f) => ({ ...f, status: e.target.value }))}
                      className="w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7C5CFC] appearance-none pr-8"
                    >
                      {['ongoing', 'completed', 'hiatus', 'dropped'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[#9AA0AC] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">Sinopsis</label>
                <textarea
                  rows={4}
                  value={editComicForm.synopsis || ''}
                  onChange={(e) => setEditComicForm((f) => ({ ...f, synopsis: e.target.value }))}
                  className="mt-1 w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3 py-2 text-xs text-white placeholder-[#5A606E] focus:outline-none focus:border-[#7C5CFC] resize-none"
                  placeholder="Sinopsis komik..."
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-[#2A2F3A] flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditingComic(null)}
                disabled={isSavingComic}
                className="px-4 py-2 rounded-xl bg-[#1F232C] hover:bg-[#2A2F3A] text-xs font-bold text-[#9AA0AC] hover:text-white transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={saveEditComic}
                disabled={isSavingComic}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors flex items-center gap-2"
              >
                {isSavingComic ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal: Edit Chapter ══════════════════════════════════════════════ */}
      {editingChapter && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#171A21] border border-[#2A2F3A] rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#2A2F3A] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Edit Chapter {editingChapter.chapter_number}</h3>
                  <p className="text-[11px] text-[#9AA0AC]">Ubah metadata &amp; urutan halaman</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingChapter(null)}
                className="p-2 rounded-xl bg-[#1F232C] hover:bg-[#2A2F3A] text-[#9AA0AC] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 flex flex-col">
              {/* Metadata */}
              <div className="p-5 border-b border-[#2A2F3A] grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">No. Chapter</label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={editChapterForm.chapter_number ?? ''}
                    onChange={(e) => setEditChapterForm((f) => ({ ...f, chapter_number: parseFloat(e.target.value) }))}
                    className="mt-1 w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7C5CFC]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">Judul Chapter (opsional)</label>
                  <input
                    type="text"
                    value={editChapterForm.title || ''}
                    onChange={(e) => setEditChapterForm((f) => ({ ...f, title: e.target.value }))}
                    className="mt-1 w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7C5CFC]"
                    placeholder="Nama chapter (opsional)"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#9AA0AC] uppercase tracking-wider">Status</label>
                  <div className="relative mt-1">
                    <select
                      value={editChapterForm.status || ''}
                      onChange={(e) => setEditChapterForm((f) => ({ ...f, status: e.target.value }))}
                      className="w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7C5CFC] appearance-none pr-8"
                    >
                      {['published', 'pending', 'failed'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[#9AA0AC] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Page Reorder */}
              <div className="p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#9AA0AC] uppercase tracking-wider flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-[#7C5CFC]" />
                    Urutan Halaman — Drag untuk reorder
                  </h4>
                  {loadingPages && <Loader2 className="w-4 h-4 animate-spin text-[#7C5CFC]" />}
                </div>

                {loadingPages ? (
                  <div className="flex items-center justify-center py-8 text-[#9AA0AC] gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#7C5CFC]" />
                    <span className="text-xs">Memuat halaman...</span>
                  </div>
                ) : draggablePages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <ImageIcon className="w-8 h-8 text-[#5B616D] mb-2 stroke-[1.5]" />
                    <p className="text-xs text-[#9AA0AC]">Tidak ada halaman ditemukan.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-80 overflow-y-auto">
                    {draggablePages.map((page, idx) => (
                      <div
                        key={page.id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragEnter={() => handleDragEnter(idx)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        className="relative rounded-lg overflow-hidden border border-[#2A2F3A] cursor-grab active:cursor-grabbing group bg-black/40 aspect-[3/4] select-none"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={page.image_url}
                          alt={`Halaman ${idx + 1}`}
                          className="w-full h-full object-cover pointer-events-none"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                          <GripVertical className="w-5 h-5 text-white" />
                        </div>
                        <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                          {idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-[#2A2F3A] flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => fetchChapterPages(editingChapter.id)}
                disabled={loadingPages}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1F232C] hover:bg-[#2A2F3A] text-xs text-[#9AA0AC] hover:text-white transition-colors border border-[#2A2F3A]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset Urutan
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingChapter(null)}
                  disabled={isSavingChapter}
                  className="px-4 py-2 rounded-xl bg-[#1F232C] hover:bg-[#2A2F3A] text-xs font-bold text-[#9AA0AC] hover:text-white transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={saveEditChapter}
                  disabled={isSavingChapter}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors flex items-center gap-2"
                >
                  {isSavingChapter ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Simpan Chapter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal: Konfirmasi Hapus Komik ═══════════════════════════════════ */}
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
                  Komik <strong>&quot;{comicToDelete.title}&quot;</strong> beserta seluruh chapter, halaman gambar di database, dan aset di CDN ImageKit akan dihapus permanen.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
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

      {/* ═══ Modal: Konfirmasi Hapus Chapter ═════════════════════════════════ */}
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
                  Halaman gambar chapter ini di database dan aset di CDN ImageKit akan dihapus secara permanen.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
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
