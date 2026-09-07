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
  Star,
  Tags,
  Check,
} from 'lucide-react';
import { Toast } from '@/components/ui/Toast';

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface AdminGenre {
  id: number;
  name: string;
  slug: string;
}

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
  genres?: AdminGenre[];
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
  const [availableGenres, setAvailableGenres] = useState<AdminGenre[]>([]);
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
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);
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

  const fetchGenres = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/genres');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAvailableGenres(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch genres:', err);
    }
  }, []);

  useEffect(() => {
    fetchComics();
    fetchGenres();
  }, [fetchComics, fetchGenres]);

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
      status: comic.status || 'ongoing',
      type: comic.type || 'manhwa',
      cover_url: comic.cover_url || '',
      rating: comic.rating ?? 0,
    });
    setSelectedGenreIds(comic.genres?.map((g) => g.id) || []);
  };

  // Toggle Genre in Edit Modal
  const toggleGenre = (genreId: number) => {
    setSelectedGenreIds((prev) =>
      prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]
    );
  };

  // Save edit comic
  const saveEditComic = async () => {
    if (!editingComic) return;
    setIsSavingComic(true);
    try {
      const payload = {
        id: editingComic.id,
        ...editComicForm,
        rating: Number(editComicForm.rating || 0),
        genre_ids: selectedGenreIds,
      };

      const res = await fetch('/api/admin/comics', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Komik "${editComicForm.title}" berhasil diperbarui.`);
        const updatedGenres = availableGenres.filter((g) => selectedGenreIds.includes(g.id));
        setComics((prev) =>
          prev.map((c) =>
            c.id === editingComic.id
              ? ({
                  ...c,
                  ...editComicForm,
                  rating: Number(editComicForm.rating || 0),
                  genres: updatedGenres,
                } as AdminComic)
              : c
          )
        );
        if (selectedComic?.id === editingComic.id) {
          setSelectedComic((prev) =>
            prev
              ? ({
                  ...prev,
                  ...editComicForm,
                  rating: Number(editComicForm.rating || 0),
                  genres: updatedGenres,
                } as AdminComic)
              : null
          );
        }
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
    setReorderedPages
  );

  // Filtered comics
  const filteredComics = comics.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[4px_4px_0px_#1A1A1A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#2E7D6E] text-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-[#1A1A1A] tracking-tight">
                Manajemen Komik &amp; Chapter
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#F6C945] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-sm">
                {comics.length} Judul
              </span>
            </div>
            <p className="text-xs text-[#7A756D] font-medium mt-0.5">
              Kelola komik, edit genre &amp; rating, atur chapter, dan reorder urutan halaman gambar.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              fetchComics();
              fetchGenres();
            }}
            className="p-2.5 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/admin/upload"
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] border-2 border-[#1A1A1A] text-xs font-black shadow-[3px_3px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#1A1A1A] transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Input Komik Baru</span>
          </Link>
        </div>
      </div>

      {/* Search & Filter Pills */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white border-2 border-[#1A1A1A] rounded-2xl p-4 shadow-[3px_3px_0px_#1A1A1A]">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#1A1A1A] stroke-[2.5] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari judul komik, author, slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-[#1A1A1A] rounded-full pl-10 pr-4 py-2 text-xs font-bold text-[#1A1A1A] placeholder-[#8C8C8C] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {['all', 'manhwa', 'manga', 'manhua'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black capitalize border-2 border-[#1A1A1A] transition-all ${
                typeFilter === t
                  ? 'bg-[#F6C945] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                  : 'bg-[#FAF7F0] text-[#7A756D] hover:bg-white hover:text-[#1A1A1A]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Comics Table / Card List */}
      <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl sm:rounded-3xl shadow-[4px_4px_0px_#1A1A1A] overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#7A756D] gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#2E7D6E]" />
            <span className="text-xs font-bold">Memuat daftar komik dari database...</span>
          </div>
        ) : filteredComics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center p-6">
            <BookOpen className="w-12 h-12 text-[#B3ADA0] mb-3 stroke-[1.5]" />
            <h3 className="text-sm font-black text-[#1A1A1A]">Komik Tidak Ditemukan</h3>
            <p className="text-xs text-[#7A756D] mt-1">
              {searchQuery
                ? `Tidak ada komik yang cocok dengan "${searchQuery}".`
                : 'Belum ada komik terdaftar di database.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#1A1A1A] bg-[#FAF7F0] text-[11px] font-black uppercase tracking-wider text-[#1A1A1A]">
                  <th className="py-3.5 px-4 sm:px-6">Komik</th>
                  <th className="py-3.5 px-4">Tipe &amp; Rating</th>
                  <th className="py-3.5 px-4">Status &amp; Genre</th>
                  <th className="py-3.5 px-4 text-center">Chapter</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#1A1A1A]/10 text-xs font-bold">
                {filteredComics.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FAF7F0]/60 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-16 rounded-xl overflow-hidden border-2 border-[#1A1A1A] shadow-sm shrink-0 bg-[#FAF7F0]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.cover_url} alt={c.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/komik/${c.slug}`}
                            target="_blank"
                            className="font-black text-sm text-[#1A1A1A] hover:text-[#2E7D6E] transition-colors flex items-center gap-1.5 group"
                          >
                            <span className="truncate">{c.title}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-[#7A756D] group-hover:text-[#2E7D6E] shrink-0" />
                          </Link>
                          <p className="text-[11px] text-[#7A756D] font-mono mt-0.5">{c.author || 'Unknown'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Tipe & Rating */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FAF7F0] border-2 border-[#1A1A1A] text-[#1A1A1A]">
                          {c.type}
                        </span>
                        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] text-[10px] font-black text-[#1A1A1A]">
                          <Star className="w-3 h-3 fill-[#1A1A1A] stroke-[#1A1A1A]" />
                          <span>{Number(c.rating || 0).toFixed(1)}</span>
                        </div>
                      </div>
                    </td>

                    {/* Status & Genre */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1.5 items-start max-w-xs">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-[#1A1A1A] ${
                            c.status === 'completed'
                              ? 'bg-[#EBF3FE] text-[#2A4FCB]'
                              : 'bg-[#E6F4EA] text-[#137333]'
                          }`}
                        >
                          {c.status || 'ongoing'}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {c.genres && c.genres.length > 0 ? (
                            c.genres.slice(0, 3).map((g) => (
                              <span
                                key={g.id}
                                className="px-2 py-0.5 rounded-md bg-[#FAF7F0] border border-[#1A1A1A]/20 text-[10px] font-bold text-[#1A1A1A]"
                              >
                                {g.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-[#B3ADA0] italic">Belum ada genre</span>
                          )}
                          {c.genres && c.genres.length > 3 && (
                            <span className="text-[10px] font-black text-[#7A756D]">
                              +{c.genres.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Total Chapters */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenChapters(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF7F0] hover:bg-[#F6C945] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-sm transition-all"
                        title="Lihat daftar chapter"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>{c.total_chapters} Ch</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditComic(c)}
                          className="p-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all"
                          title="Edit Komik (Genre, Rating, Status, dll)"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setComicToDelete(c)}
                          className="p-2 rounded-full bg-[#FFEAEA] hover:bg-[#FFD6D6] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#C53030] active:translate-x-[1px] active:translate-y-[1px] transition-all"
                          title="Hapus Komik"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* ═══ Modal: Edit Komik ════════════════════════════════════════════════ */}
      {editingComic && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#F7F2E6] border-[3px] border-[#1A1A1A] rounded-3xl w-full max-w-2xl flex flex-col shadow-[8px_8px_0px_#1A1A1A] max-h-[92vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b-2 border-[#1A1A1A] bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#F6C945] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center">
                  <Pencil className="w-5 h-5 text-[#1A1A1A] stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1A1A1A]">Edit Metadata Komik</h3>
                  <p className="text-xs text-[#7A756D] font-medium">
                    Ubah genre, rating, status rilis, dan informasi komik.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingComic(null)}
                className="p-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Scrollable Content */}
            <div className="overflow-y-auto p-5 sm:p-6 flex flex-col gap-4">
              {/* Cover Preview & URL */}
              <div className="flex items-center gap-4 bg-white border-2 border-[#1A1A1A] rounded-2xl p-3.5 shadow-sm">
                <div className="w-16 h-22 rounded-xl overflow-hidden border-2 border-[#1A1A1A] bg-[#FAF7F0] shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={editComicForm.cover_url || ''}
                    alt="cover"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider block mb-1">
                    Cover URL
                  </label>
                  <input
                    type="url"
                    value={editComicForm.cover_url || ''}
                    onChange={(e) => setEditComicForm((f) => ({ ...f, cover_url: e.target.value }))}
                    className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] placeholder-[#8C8C8C] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Title & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider block mb-1">
                    Judul Komik <span className="text-[#E96379]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editComicForm.title || ''}
                    onChange={(e) => setEditComicForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider block mb-1">
                    Slug URL
                  </label>
                  <input
                    type="text"
                    required
                    value={editComicForm.slug || ''}
                    onChange={(e) => setEditComicForm((f) => ({ ...f, slug: e.target.value }))}
                    className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E] font-mono"
                  />
                </div>
              </div>

              {/* Author, Type, Rating, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider block mb-1">
                    Author / Penulis
                  </label>
                  <input
                    type="text"
                    value={editComicForm.author || ''}
                    onChange={(e) => setEditComicForm((f) => ({ ...f, author: e.target.value }))}
                    className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider block mb-1">
                    Tipe Komik
                  </label>
                  <div className="relative">
                    <select
                      value={editComicForm.type || 'manhwa'}
                      onChange={(e) => setEditComicForm((f) => ({ ...f, type: e.target.value }))}
                      className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E] appearance-none pr-8 capitalize"
                    >
                      {['manhwa', 'manga', 'manhua'].map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#1A1A1A] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Rating Input with live star badge */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider">
                      Rating (0.0 - 10.0)
                    </label>
                    <span className="text-[10px] font-black text-[#F6C945] bg-[#1A1A1A] px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-[#F6C945]" />
                      {Number(editComicForm.rating || 0).toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={editComicForm.rating ?? 0}
                    onChange={(e) =>
                      setEditComicForm((f) => ({ ...f, rating: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                  />
                </div>
              </div>

              {/* Status Selector Pills */}
              <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl p-3.5 shadow-sm">
                <label className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider block mb-2">
                  Status Komik
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'ongoing', label: 'Ongoing (Berjalan)', color: 'bg-[#2E7D6E] text-white' },
                    { id: 'completed', label: 'Completed (Tamat)', color: 'bg-[#2A4FCB] text-white' },
                    { id: 'hiatus', label: 'Hiatus (Jeda)', color: 'bg-[#EDB72B] text-[#1A1A1A]' },
                    { id: 'dropped', label: 'Dropped (Berhenti)', color: 'bg-[#E96379] text-white' },
                  ].map((s) => {
                    const isSelected = editComicForm.status === s.id;
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => setEditComicForm((f) => ({ ...f, status: s.id }))}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-black border-2 border-[#1A1A1A] transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? `${s.color} shadow-[2px_2px_0px_#1A1A1A]`
                            : 'bg-[#FAF7F0] text-[#7A756D] hover:bg-white hover:text-[#1A1A1A]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        <span>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Genre Selector (Add / Remove) */}
              <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl p-3.5 shadow-sm flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1.5">
                    <Tags className="w-3.5 h-3.5 text-[#2E7D6E]" />
                    Pilih Genre Komik (Bisa Tambah &amp; Kurang)
                  </label>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#FAF7F0] border border-[#1A1A1A]/30 text-[#1A1A1A]">
                    {selectedGenreIds.length} Genre Dipilih
                  </span>
                </div>
                <p className="text-[10px] text-[#7A756D] font-medium">
                  Klik pill genre untuk menambahkan atau membatalkan pilihan genre pada komik ini.
                </p>

                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
                  {availableGenres.length === 0 ? (
                    <span className="text-xs text-[#7A756D] italic">Tidak ada genre tersedia.</span>
                  ) : (
                    availableGenres.map((g) => {
                      const isSelected = selectedGenreIds.includes(g.id);
                      return (
                        <button
                          type="button"
                          key={g.id}
                          onClick={() => toggleGenre(g.id)}
                          className={`px-3 py-1 rounded-full text-xs font-bold border-2 border-[#1A1A1A] transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-[#F6C945] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] font-black'
                              : 'bg-[#FAF7F0] text-[#7A756D] hover:bg-white hover:text-[#1A1A1A]'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3] text-[#1A1A1A]" />}
                          <span>{g.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Synopsis */}
              <div>
                <label className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider block mb-1">
                  Sinopsis Komik
                </label>
                <textarea
                  rows={4}
                  value={editComicForm.synopsis || ''}
                  onChange={(e) => setEditComicForm((f) => ({ ...f, synopsis: e.target.value }))}
                  className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] placeholder-[#8C8C8C] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E] resize-none"
                  placeholder="Deskripsi cerita komik..."
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 sm:p-5 border-t-2 border-[#1A1A1A] bg-white flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditingComic(null)}
                disabled={isSavingComic}
                className="px-4 py-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={saveEditComic}
                disabled={isSavingComic || !editComicForm.title?.trim()}
                className="flex items-center gap-2 px-6 py-2 rounded-full bg-[#2E7D6E] hover:bg-[#256659] text-white border-2 border-[#1A1A1A] text-xs font-black shadow-[2px_2px_0px_#1A1A1A] disabled:opacity-50"
              >
                {isSavingComic ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Drawer / Modal: Chapters of Selected Comic ════════════════════════ */}
      {selectedComic && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#F7F2E6] border-[3px] border-[#1A1A1A] rounded-3xl w-full max-w-2xl flex flex-col shadow-[8px_8px_0px_#1A1A1A] max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b-2 border-[#1A1A1A] bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#F6C945] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center">
                  <Layers className="w-5 h-5 text-[#1A1A1A] stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1A1A1A]">
                    Daftar Chapter — {selectedComic.title}
                  </h3>
                  <p className="text-xs text-[#7A756D] font-medium">
                    Total: {chapters.length} chapter terdaftar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedComic(null)}
                className="p-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chapter List */}
            <div className="overflow-y-auto p-5 flex flex-col gap-2.5">
              {loadingChapters ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#7A756D] gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#2E7D6E]" />
                  <span className="text-xs font-bold">Memuat chapter...</span>
                </div>
              ) : chapters.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="w-10 h-10 text-[#B3ADA0] mb-2 stroke-[1.5]" />
                  <p className="text-xs font-bold text-[#1A1A1A]">Belum ada chapter.</p>
                  <Link
                    href="/admin/upload"
                    className="mt-3 px-4 py-1.5 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] text-xs font-black shadow-sm"
                  >
                    Upload Chapter Sekarang
                  </Link>
                </div>
              ) : (
                chapters.map((ch) => (
                  <div
                    key={ch.id}
                    className="p-3.5 rounded-2xl bg-white border-2 border-[#1A1A1A] shadow-sm flex items-center justify-between gap-3 hover:bg-[#FAF7F0] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-[#1A1A1A]">
                          Chapter {ch.chapter_number}
                        </span>
                        {ch.title && (
                          <span className="text-xs text-[#7A756D] truncate">- {ch.title}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[#7A756D] mt-1 font-bold">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-[#2E7D6E]" />
                          {ch.total_pages} Halaman
                        </span>
                        <span
                          className={`px-2 py-0.2 rounded-full border text-[10px] font-black ${
                            ch.status === 'published'
                              ? 'bg-[#E6F4EA] text-[#137333] border-[#137333]/30'
                              : 'bg-[#FFF8E1] text-[#B78103] border-[#B78103]/30'
                          }`}
                        >
                          {ch.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/komik/${selectedComic.slug}/${ch.chapter_number}`}
                        target="_blank"
                        className="p-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#1A1A1A]"
                        title="Baca Chapter di Web"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => openEditChapter(ch)}
                        className="p-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#1A1A1A]"
                        title="Edit Chapter & Reorder Halaman"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setChapterToDelete(ch)}
                        className="p-2 rounded-full bg-[#FFEAEA] hover:bg-[#FFD6D6] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#C53030]"
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

      {/* ═══ Modal: Edit Chapter ══════════════════════════════════════════════ */}
      {editingChapter && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#F7F2E6] border-[3px] border-[#1A1A1A] rounded-3xl w-full max-w-2xl flex flex-col shadow-[8px_8px_0px_#1A1A1A] max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b-2 border-[#1A1A1A] bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#2A4FCB] text-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center">
                  <Pencil className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1A1A1A]">
                    Edit Chapter {editingChapter.chapter_number}
                  </h3>
                  <p className="text-xs text-[#7A756D] font-medium">
                    Ubah metadata &amp; drag-and-drop untuk urutkan ulang halaman
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingChapter(null)}
                className="p-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 flex flex-col">
              {/* Metadata */}
              <div className="p-5 border-b-2 border-[#1A1A1A]/10 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider block mb-1">
                    No. Chapter
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={editChapterForm.chapter_number ?? ''}
                    onChange={(e) =>
                      setEditChapterForm((f) => ({
                        ...f,
                        chapter_number: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider block mb-1">
                    Judul Chapter
                  </label>
                  <input
                    type="text"
                    value={editChapterForm.title || ''}
                    onChange={(e) => setEditChapterForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    placeholder="Nama chapter (opsional)"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider block mb-1">
                    Status
                  </label>
                  <div className="relative">
                    <select
                      value={editChapterForm.status || 'published'}
                      onChange={(e) =>
                        setEditChapterForm((f) => ({ ...f, status: e.target.value as any }))
                      }
                      className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E] appearance-none pr-8 capitalize"
                    >
                      {['published', 'pending', 'failed'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#1A1A1A] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Page Reorder */}
              <div className="p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-[#2E7D6E]" />
                    Urutan Halaman — Drag untuk memindahkan
                  </h4>
                  {loadingPages && <Loader2 className="w-4 h-4 animate-spin text-[#2E7D6E]" />}
                </div>

                {loadingPages ? (
                  <div className="flex items-center justify-center py-8 text-[#7A756D] gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#2E7D6E]" />
                    <span className="text-xs font-bold">Memuat halaman...</span>
                  </div>
                ) : draggablePages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center bg-white border-2 border-[#1A1A1A] rounded-2xl p-6">
                    <ImageIcon className="w-8 h-8 text-[#B3ADA0] mb-2 stroke-[1.5]" />
                    <p className="text-xs font-bold text-[#1A1A1A]">Tidak ada halaman ditemukan.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-80 overflow-y-auto p-1">
                    {draggablePages.map((page, idx) => (
                      <div
                        key={page.id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragEnter={() => handleDragEnter(idx)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        className="relative rounded-xl overflow-hidden border-2 border-[#1A1A1A] shadow-sm cursor-grab active:cursor-grabbing group bg-[#FAF7F0] aspect-[3/4] select-none"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={page.image_url}
                          alt={`Halaman ${idx + 1}`}
                          className="w-full h-full object-cover pointer-events-none"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <GripVertical className="w-6 h-6 text-white" />
                        </div>
                        <div className="absolute bottom-1.5 left-1.5 bg-[#1A1A1A] text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-white">
                          #{idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t-2 border-[#1A1A1A] bg-white flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => fetchChapterPages(editingChapter.id)}
                disabled={loadingPages}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset Urutan
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingChapter(null)}
                  disabled={isSavingChapter}
                  className="px-4 py-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-sm"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={saveEditChapter}
                  disabled={isSavingChapter}
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#2A4FCB] hover:bg-[#203EA5] text-white border-2 border-[#1A1A1A] text-xs font-black shadow-[2px_2px_0px_#1A1A1A]"
                >
                  {isSavingChapter ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Simpan Chapter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal: Konfirmasi Hapus Komik ═══════════════════════════════════ */}
      {comicToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#F7F2E6] border-[3px] border-[#1A1A1A] rounded-3xl p-6 max-w-md w-full flex flex-col gap-4 shadow-[8px_8px_0px_#1A1A1A]">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-[#FFEAEA] text-[#C53030] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] shrink-0">
                <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#1A1A1A]">Hapus Komik?</h3>
                <p className="text-xs text-[#7A756D] font-medium mt-1">
                  Komik <strong>&quot;{comicToDelete.title}&quot;</strong> beserta seluruh chapter, halaman gambar di database, dan aset di ImageKit akan dihapus permanen.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setComicToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-sm"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteComic}
                disabled={isDeleting}
                className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#E96379] hover:bg-[#D44E64] text-white border-2 border-[#1A1A1A] text-xs font-black shadow-[2px_2px_0px_#1A1A1A]"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#F7F2E6] border-[3px] border-[#1A1A1A] rounded-3xl p-6 max-w-md w-full flex flex-col gap-4 shadow-[8px_8px_0px_#1A1A1A]">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-[#FFEAEA] text-[#C53030] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] shrink-0">
                <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#1A1A1A]">
                  Hapus Chapter {chapterToDelete.chapter_number}?
                </h3>
                <p className="text-xs text-[#7A756D] font-medium mt-1">
                  Halaman gambar chapter ini di database dan file di CDN ImageKit akan dihapus permanen.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setChapterToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-sm"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteChapter}
                disabled={isDeleting}
                className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#E96379] hover:bg-[#D44E64] text-white border-2 border-[#1A1A1A] text-xs font-black shadow-[2px_2px_0px_#1A1A1A]"
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
