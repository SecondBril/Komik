'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Upload,
  BookOpen,
  PlusCircle,
  FolderPlus,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Zap,
  ArrowRight,
  Loader2,
  FileImage,
} from 'lucide-react';

interface ComicOption {
  id: string;
  title: string;
  slug: string;
  type: string;
  cover_url: string;
  status: string;
}

export default function AdminUploadPage() {
  const [isNewComic, setIsNewComic] = useState(true);
  const [existingComics, setExistingComics] = useState<ComicOption[]>([]);
  const [loadingComics, setLoadingComics] = useState(false);

  // Form Fields - New Comic
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState('manhwa');
  const [synopsis, setSynopsis] = useState('');
  const [author, setAuthor] = useState('');
  const [comicStatus, setComicStatus] = useState('ongoing');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Form Fields - Existing Comic
  const [selectedComicId, setSelectedComicId] = useState('');

  // Form Fields - Chapter Info
  const [chapterNumber, setChapterNumber] = useState('1');
  const [chapterTitle, setChapterTitle] = useState('');

  // Form Fields - Page Images
  const [pageFiles, setPageFiles] = useState<File[]>([]);
  const [pagePreviews, setPagePreviews] = useState<string[]>([]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    comicSlug: string;
    chapterNumber: string | number;
    message: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch Existing Comics
  useEffect(() => {
    async function fetchComics() {
      setLoadingComics(true);
      try {
        const res = await fetch('/api/admin/comics');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setExistingComics(data.data);
          if (data.data.length > 0) {
            setSelectedComicId(data.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load comics list:', err);
      } finally {
        setLoadingComics(false);
      }
    }

    fetchComics();
  }, []);

  // Auto-generate slug when title changes
  const handleTitleChange = (val: string) => {
    setTitle(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    setSlug(generatedSlug);
  };

  // Cover Image Selection
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  // Multiple Page Files Selection
  const handlePageFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      // Sort files naturally by filename (01.jpg, 02.jpg, ...)
      selectedFiles.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );

      const newPreviews = selectedFiles.map((file) => URL.createObjectURL(file));
      setPageFiles((prev) => [...prev, ...selectedFiles]);
      setPagePreviews((prev) => [...prev, ...newPreviews]);
    }
  };

  // Remove Page Image
  const handleRemovePage = (index: number) => {
    setPageFiles((prev) => prev.filter((_, i) => i !== index));
    setPagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Clear All Pages
  const handleClearPages = () => {
    setPageFiles([]);
    setPagePreviews([]);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessResult(null);

    if (isNewComic && !title.trim()) {
      setErrorMessage('Judul komik wajib diisi.');
      return;
    }

    if (!isNewComic && !selectedComicId) {
      setErrorMessage('Silakan pilih komik yang sudah ada terlebih dahulu.');
      return;
    }

    if (pageFiles.length === 0) {
      setErrorMessage('Unggah setidaknya 1 gambar halaman chapter komik.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('isNewComic', isNewComic ? 'true' : 'false');

      if (isNewComic) {
        formData.append('title', title);
        formData.append('slug', slug);
        formData.append('type', type);
        formData.append('synopsis', synopsis);
        formData.append('author', author);
        formData.append('status', comicStatus);
        if (coverFile) {
          formData.append('coverFile', coverFile);
        }
      } else {
        formData.append('comicId', selectedComicId);
      }

      formData.append('chapterNumber', chapterNumber);
      formData.append('chapterTitle', chapterTitle);

      pageFiles.forEach((file) => {
        formData.append('pageFiles', file);
      });

      const res = await fetch('/api/admin/manual-upload', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Terjadi kesalahan saat mengunggah komik.');
      }

      setSuccessResult({
        comicSlug: result.comicSlug || slug || 'solo-leveling',
        chapterNumber: result.chapterNumber || chapterNumber,
        message: result.message || 'Komik & Chapter berhasil diproses dan dikonversi ke WebP!',
      });

      // Reset Page Files
      setPageFiles([]);
      setPagePreviews([]);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal terhubung ke server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div className="bg-[#171A21] border border-[#2A2F3A] rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Input Komik & Chapter Manual</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Auto WebP Converter
              </span>
            </div>
            <p className="text-xs text-[#9AA0AC] mt-0.5">
              Unggah file gambar komik (.png/.jpg/.jpeg). Server akan mengonversinya secara otomatis ke format <strong>WebP (Quality 80)</strong> untuk kecepatan loading tinggi.
            </p>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successResult && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-emerald-200">Upload & Konversi Berhasil!</h3>
              <p className="text-xs text-emerald-300/80 mt-1">{successResult.message}</p>
            </div>
          </div>
          <Link
            href={`/komik/${successResult.comicSlug}/${successResult.chapterNumber}`}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-slate-950 transition-colors flex items-center gap-1.5 shrink-0"
          >
            Baca Chapter Now
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-xs font-medium">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Comic & Chapter Metadata */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Mode Selector */}
          <div className="bg-[#171A21] border border-[#2A2F3A] rounded-2xl p-5 flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#9AA0AC]">Mode Input</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsNewComic(true)}
                className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-bold transition-all ${
                  isNewComic
                    ? 'bg-[#7C5CFC]/10 border-[#7C5CFC] text-[#7C5CFC]'
                    : 'bg-[#1F232C] border-[#2A2F3A] text-[#9AA0AC] hover:text-white'
                }`}
              >
                <PlusCircle className="w-5 h-5" />
                Buat Komik Baru
              </button>
              <button
                type="button"
                onClick={() => setIsNewComic(false)}
                className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-bold transition-all ${
                  !isNewComic
                    ? 'bg-[#7C5CFC]/10 border-[#7C5CFC] text-[#7C5CFC]'
                    : 'bg-[#1F232C] border-[#2A2F3A] text-[#9AA0AC] hover:text-white'
                }`}
              >
                <FolderPlus className="w-5 h-5" />
                Pilih Existing
              </button>
            </div>
          </div>

          {/* New Comic Information */}
          {isNewComic ? (
            <div className="bg-[#171A21] border border-[#2A2F3A] rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9AA0AC] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-400" /> Information Komik Baru
              </h3>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-[#9AA0AC] mb-1.5">Judul Komik *</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Solo Leveling Ragnarok"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#5A606E] focus:outline-none focus:border-[#7C5CFC]"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs font-semibold text-[#9AA0AC] mb-1.5">Slug URL</label>
                <input
                  type="text"
                  required
                  placeholder="solo-leveling-ragnarok"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3.5 py-2.5 text-xs text-amber-400 font-mono focus:outline-none focus:border-[#7C5CFC]"
                />
              </div>

              {/* Type & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#9AA0AC] mb-1.5">Tipe Komik</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7C5CFC]"
                  >
                    <option value="manhwa">Manhwa (Korea)</option>
                    <option value="manga">Manga (Jepang)</option>
                    <option value="manhua">Manhua (China)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#9AA0AC] mb-1.5">Status</label>
                  <select
                    value={comicStatus}
                    onChange={(e) => setComicStatus(e.target.value)}
                    className="w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7C5CFC]"
                  >
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Author */}
              <div>
                <label className="block text-xs font-semibold text-[#9AA0AC] mb-1.5">Pengarang / Author</label>
                <input
                  type="text"
                  placeholder="Misal: Chugong / DUBU"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#5A606E] focus:outline-none focus:border-[#7C5CFC]"
                />
              </div>

              {/* Synopsis */}
              <div>
                <label className="block text-xs font-semibold text-[#9AA0AC] mb-1.5">Sinopsis</label>
                <textarea
                  rows={3}
                  placeholder="Deskripsi singkat mengenai jalan cerita komik..."
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl p-3 text-xs text-white placeholder-[#5A606E] focus:outline-none focus:border-[#7C5CFC] resize-none"
                />
              </div>

              {/* Cover Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-[#9AA0AC] mb-1.5">Gambar Cover Komik</label>
                <div className="flex items-center gap-3">
                  {coverPreview ? (
                    <div className="relative w-16 h-20 rounded-lg overflow-hidden border border-[#2A2F3A] shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverPreview} alt="Cover Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-20 rounded-lg border border-dashed border-[#2A2F3A] bg-[#0F1115] flex flex-col items-center justify-center shrink-0 text-[#9AA0AC]">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <label className="flex-1 cursor-pointer bg-[#0F1115] hover:bg-[#1F232C] border border-[#2A2F3A] rounded-xl p-3 text-center transition-colors">
                    <span className="text-xs text-[#7C5CFC] font-semibold block">Pilih Gambar Cover</span>
                    <span className="text-[10px] text-[#9AA0AC]">JPG, PNG, WebP</span>
                    <input type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          ) : (
            /* Select Existing Comic */
            <div className="bg-[#171A21] border border-[#2A2F3A] rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9AA0AC]">Pilih Komik</h3>
              {loadingComics ? (
                <div className="flex items-center justify-center py-6 text-xs text-[#9AA0AC] gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#7C5CFC]" /> Memuat daftar komik...
                </div>
              ) : existingComics.length === 0 ? (
                <p className="text-xs text-amber-400 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                  Belum ada komik di database. Silakan pilih mode &quot;Buat Komik Baru&quot;.
                </p>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-[#9AA0AC] mb-1.5">Pilih dari Database</label>
                  <select
                    value={selectedComicId}
                    onChange={(e) => setSelectedComicId(e.target.value)}
                    className="w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#7C5CFC]"
                  >
                    {existingComics.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Chapter Information */}
          <div className="bg-[#171A21] border border-[#2A2F3A] rounded-2xl p-5 flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#9AA0AC]">Informasi Chapter</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#9AA0AC] mb-1.5">Nomor Chapter *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="1"
                  value={chapterNumber}
                  onChange={(e) => setChapterNumber(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#7C5CFC]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#9AA0AC] mb-1.5">Judul Chapter</label>
                <input
                  type="text"
                  placeholder="Awal Petualangan"
                  value={chapterTitle}
                  onChange={(e) => setChapterTitle(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#2A2F3A] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#7C5CFC]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Multiple Chapter Page Dropzone & Preview */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-[#171A21] border border-[#2A2F3A] rounded-2xl p-6 flex flex-col gap-6 flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-[#7C5CFC]" /> Upload Halaman Gambar Chapter
                </h3>
                <p className="text-xs text-[#9AA0AC] mt-0.5">
                  Pilih beberapa gambar halaman chapter sekaligus. Gambar akan diurutkan berdasarkan nama file secara otomatis.
                </p>
              </div>
              {pageFiles.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearPages}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-red-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus Semua
                </button>
              )}
            </div>

            {/* Dropzone Area */}
            <label className="cursor-pointer bg-[#0F1115] hover:bg-[#151821] border-2 border-dashed border-[#2A2F3A] hover:border-[#7C5CFC] rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all group">
              <div className="p-4 rounded-2xl bg-[#171A21] border border-[#2A2F3A] text-[#7C5CFC] group-hover:scale-110 transition-transform mb-3">
                <Upload className="w-8 h-8" />
              </div>
              <span className="text-sm font-bold text-white mb-1">
                Pilih atau Drag & Drop Gambar Halaman Chapter
              </span>
              <span className="text-xs text-[#9AA0AC] mb-4">
                Dukungan format `.png`, `.jpg`, `.jpeg`, `.webp` (Multi-select diizinkan)
              </span>
              <span className="px-4 py-2 rounded-xl bg-[#7C5CFC] hover:bg-[#6846F9] text-xs font-bold text-white shadow-lg shadow-purple-500/20 transition-all">
                Pilih File Gambar
              </span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handlePageFilesSelect}
                className="hidden"
              />
            </label>

            {/* Selected Page Files Grid */}
            {pageFiles.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between text-xs font-semibold text-[#9AA0AC] border-b border-[#2A2F3A] pb-3">
                  <span>Daftar Halaman ({pageFiles.length} Gambar)</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Auto WebP Compression Active
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[420px] overflow-y-auto pr-1">
                  {pagePreviews.map((src, idx) => (
                    <div
                      key={idx}
                      className="group relative bg-[#0F1115] border border-[#2A2F3A] rounded-xl overflow-hidden flex flex-col"
                    >
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`Page ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] font-bold text-white backdrop-blur-md">
                          Hal. {idx + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePage(idx)}
                          className="absolute top-2 right-2 p-1.5 rounded-md bg-red-500/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="p-2 text-[10px] text-[#9AA0AC] truncate bg-[#171A21]">
                        {pageFiles[idx]?.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button & Progress Indicator */}
            <div className="pt-4 border-t border-[#2A2F3A] flex items-center justify-end gap-4">
              <button
                type="submit"
                disabled={isSubmitting || pageFiles.length === 0}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                  isSubmitting || pageFiles.length === 0
                    ? 'bg-[#2A2F3A] text-[#5A606E] cursor-not-allowed'
                    : 'bg-[#7C5CFC] hover:bg-[#6846F9] text-white shadow-purple-500/20'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mengonversi & Mengunggah WebP...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    Proses & Simpan Komik (Auto-WebP)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
