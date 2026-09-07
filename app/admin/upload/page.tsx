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
  ChevronDown,
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

    if (pageFiles.length === 0) {
      setErrorMessage('Pilih minimal 1 gambar halaman untuk diunggah.');
      return;
    }

    if (isNewComic) {
      if (!title.trim()) {
        setErrorMessage('Judul komik wajib diisi.');
        return;
      }
      if (!coverFile) {
        setErrorMessage('File gambar cover komik wajib dipilih.');
        return;
      }
    } else {
      if (!selectedComicId) {
        setErrorMessage('Pilih komik terlebih dahulu.');
        return;
      }
    }

    if (!chapterNumber) {
      setErrorMessage('Nomor chapter wajib diisi.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('isNewComic', String(isNewComic));

      if (isNewComic) {
        formData.append('title', title);
        formData.append('slug', slug);
        formData.append('type', type);
        formData.append('synopsis', synopsis);
        formData.append('author', author);
        formData.append('comicStatus', comicStatus);
        if (coverFile) {
          formData.append('coverFile', coverFile);
        }
      } else {
        formData.append('selectedComicId', selectedComicId);
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

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengunggah chapter komik.');
      }

      setSuccessResult({
        comicSlug: data.comicSlug,
        chapterNumber: data.chapterNumber,
        message: data.message || 'Chapter berhasil diunggah dan dioptimasi ke WebP!',
      });

      // Increment chapter number for convenience
      const currentNum = parseFloat(chapterNumber);
      if (!isNaN(currentNum)) {
        setChapterNumber(String(currentNum + 1));
      }
      setChapterTitle('');

      // Refresh existing comics list
      fetch('/api/admin/comics')
        .then((r) => r.json())
        .then((json) => {
          if (json.success && Array.isArray(json.data)) {
            setExistingComics(json.data);
          }
        });

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
      <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[4px_4px_0px_#1A1A1A] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#F6C945] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center shrink-0">
            <Upload className="w-6 h-6 text-[#1A1A1A] stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-[#1A1A1A] tracking-tight">
                Input Komik &amp; Chapter Manual
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#2E7D6E] text-white border-2 border-[#1A1A1A] shadow-sm flex items-center gap-1">
                <Zap className="w-3 h-3 fill-current" /> Auto WebP
              </span>
            </div>
            <p className="text-xs text-[#7A756D] font-medium mt-0.5">
              Unggah file gambar komik. Server akan mengonversinya secara otomatis ke format <strong>WebP (Quality 80)</strong> untuk kecepatan loading tinggi.
            </p>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successResult && (
        <div className="p-4 rounded-2xl bg-[#E6F4EA] border-2 border-[#1A1A1A] text-[#137333] shadow-[3px_3px_0px_#1A1A1A] flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#137333] mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-black text-[#137333]">Upload &amp; Konversi Berhasil!</h3>
              <p className="text-xs text-[#137333]/90 mt-0.5 font-medium">{successResult.message}</p>
            </div>
          </div>
          <Link
            href={`/komik/${successResult.comicSlug}/${successResult.chapterNumber}`}
            className="px-4 py-1.5 rounded-full bg-[#137333] hover:bg-[#0e5726] text-xs font-black text-white border-2 border-[#1A1A1A] shadow-sm flex items-center gap-1.5 shrink-0"
          >
            Baca Chapter
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-[#FFEAEA] border-2 border-[#1A1A1A] text-[#C53030] shadow-[3px_3px_0px_#1A1A1A] flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#C53030] shrink-0" />
          <p className="text-xs font-bold">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Comic & Chapter Metadata */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Mode Selector */}
          <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl sm:rounded-3xl p-5 shadow-[3px_3px_0px_#1A1A1A] flex flex-col gap-3">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-[#7A756D]">
              Pilih Mode Input
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsNewComic(true)}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border-2 text-xs font-black transition-all ${
                  isNewComic
                    ? 'bg-[#F6C945] text-[#1A1A1A] border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                    : 'bg-[#FAF7F0] border-[#1A1A1A]/20 text-[#7A756D] hover:text-[#1A1A1A]'
                }`}
              >
                <PlusCircle className="w-5 h-5" />
                <span>Buat Komik Baru</span>
              </button>
              <button
                type="button"
                onClick={() => setIsNewComic(false)}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border-2 text-xs font-black transition-all ${
                  !isNewComic
                    ? 'bg-[#F6C945] text-[#1A1A1A] border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                    : 'bg-[#FAF7F0] border-[#1A1A1A]/20 text-[#7A756D] hover:text-[#1A1A1A]'
                }`}
              >
                <FolderPlus className="w-5 h-5" />
                <span>Pilih Existing</span>
              </button>
            </div>
          </div>

          {/* New Comic Information */}
          {isNewComic ? (
            <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl sm:rounded-3xl p-5 shadow-[3px_3px_0px_#1A1A1A] flex flex-col gap-4">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-[#1A1A1A] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#2E7D6E]" /> Informasi Komik Baru
              </h3>

              {/* Title */}
              <div>
                <label className="block text-xs font-black text-[#1A1A1A] mb-1">Judul Komik *</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Solo Leveling Ragnarok"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3.5 py-2 text-xs font-bold text-[#1A1A1A] placeholder-[#8C8C8C] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs font-black text-[#1A1A1A] mb-1">Slug URL</label>
                <input
                  type="text"
                  required
                  placeholder="solo-leveling-ragnarok"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full bg-[#FAF7F0] border-2 border-[#1A1A1A] rounded-xl px-3.5 py-2 text-xs text-[#1A1A1A] font-mono focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                />
              </div>

              {/* Type & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-[#1A1A1A] mb-1">Tipe Komik</label>
                  <div className="relative">
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E] appearance-none pr-8 capitalize"
                    >
                      <option value="manhwa">Manhwa</option>
                      <option value="manga">Manga</option>
                      <option value="manhua">Manhua</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#1A1A1A] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-[#1A1A1A] mb-1">Status</label>
                  <div className="relative">
                    <select
                      value={comicStatus}
                      onChange={(e) => setComicStatus(e.target.value)}
                      className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E] appearance-none pr-8 capitalize"
                    >
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#1A1A1A] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Author */}
              <div>
                <label className="block text-xs font-black text-[#1A1A1A] mb-1">Author / Pengarang</label>
                <input
                  type="text"
                  placeholder="Misal: Chugong / DUBU"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3.5 py-2 text-xs font-bold text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                />
              </div>

              {/* Synopsis */}
              <div>
                <label className="block text-xs font-black text-[#1A1A1A] mb-1">Sinopsis</label>
                <textarea
                  rows={3}
                  placeholder="Deskripsi cerita komik..."
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl p-3 text-xs font-bold text-[#1A1A1A] placeholder-[#8C8C8C] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E] resize-none"
                />
              </div>

              {/* Cover Image Upload */}
              <div>
                <label className="block text-xs font-black text-[#1A1A1A] mb-1">Cover Komik *</label>
                <div className="flex items-center gap-3">
                  {coverPreview ? (
                    <div className="relative w-16 h-22 rounded-xl overflow-hidden border-2 border-[#1A1A1A] shadow-sm shrink-0 bg-[#FAF7F0]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverPreview} alt="Cover Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-22 rounded-xl border-2 border-dashed border-[#1A1A1A] bg-[#FAF7F0] flex flex-col items-center justify-center shrink-0 text-[#7A756D]">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}
                  <label className="flex-1 cursor-pointer bg-[#FAF7F0] hover:bg-[#F6C945] border-2 border-[#1A1A1A] rounded-xl p-3 text-center transition-all shadow-sm">
                    <span className="text-xs font-black text-[#1A1A1A] block">Pilih Gambar Cover</span>
                    <span className="text-[10px] text-[#7A756D] font-bold">JPG, PNG, WebP</span>
                    <input type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          ) : (
            /* Select Existing Comic */
            <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl sm:rounded-3xl p-5 shadow-[3px_3px_0px_#1A1A1A] flex flex-col gap-4">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-[#1A1A1A]">Pilih Komik</h3>
              {loadingComics ? (
                <div className="flex items-center justify-center py-6 text-xs font-bold text-[#7A756D] gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#2E7D6E]" /> Memuat daftar komik...
                </div>
              ) : existingComics.length === 0 ? (
                <p className="text-xs font-bold text-[#C53030] bg-[#FFEAEA] p-3 rounded-2xl border-2 border-[#1A1A1A]">
                  Belum ada komik di database. Silakan pilih mode &quot;Buat Komik Baru&quot;.
                </p>
              ) : (
                <div>
                  <label className="block text-xs font-black text-[#1A1A1A] mb-1">Pilih dari Database</label>
                  <div className="relative">
                    <select
                      value={selectedComicId}
                      onChange={(e) => setSelectedComicId(e.target.value)}
                      className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl p-3 text-xs font-bold text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E] appearance-none pr-8"
                    >
                      {existingComics.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.type.toUpperCase()})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#1A1A1A] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chapter Information */}
          <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl sm:rounded-3xl p-5 shadow-[3px_3px_0px_#1A1A1A] flex flex-col gap-4">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-[#1A1A1A]">Informasi Chapter</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-[#1A1A1A] mb-1">Nomor Chapter *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="1"
                  value={chapterNumber}
                  onChange={(e) => setChapterNumber(e.target.value)}
                  className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3.5 py-2 text-xs font-bold text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-[#1A1A1A] mb-1">Judul Chapter</label>
                <input
                  type="text"
                  placeholder="Awal Petualangan"
                  value={chapterTitle}
                  onChange={(e) => setChapterTitle(e.target.value)}
                  className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3.5 py-2 text-xs font-bold text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Multiple Chapter Page Dropzone & Preview */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl sm:rounded-3xl p-6 shadow-[4px_4px_0px_#1A1A1A] flex flex-col gap-6 flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-[#1A1A1A] flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-[#2E7D6E]" /> Upload Halaman Gambar Chapter
                </h3>
                <p className="text-xs text-[#7A756D] font-medium mt-0.5">
                  Pilih beberapa gambar halaman chapter sekaligus. Gambar otomatis diurutkan berdasarkan nama file.
                </p>
              </div>
              {pageFiles.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearPages}
                  className="px-3.5 py-1.5 rounded-full bg-[#FFEAEA] hover:bg-[#FFD6D6] text-[#C53030] text-xs font-black flex items-center gap-1.5 transition-colors border-2 border-[#1A1A1A] shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus Semua
                </button>
              )}
            </div>

            {/* Dropzone Area */}
            <label className="cursor-pointer bg-[#FAF7F0] hover:bg-[#FAF7F0]/70 border-2 border-dashed border-[#1A1A1A] rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-[#F6C945] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
                <Upload className="w-7 h-7 text-[#1A1A1A] stroke-[2.5]" />
              </div>
              <span className="text-sm font-black text-[#1A1A1A] mb-1">
                Pilih atau Drag &amp; Drop Gambar Halaman Chapter
              </span>
              <span className="text-xs text-[#7A756D] font-bold mb-4">
                Dukungan format .png, .jpg, .jpeg, .webp (Multi-select)
              </span>
              <span className="px-5 py-2 rounded-full bg-[#2E7D6E] hover:bg-[#256659] text-xs font-black text-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] transition-all">
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
                <div className="flex items-center justify-between text-xs font-black text-[#1A1A1A] border-b-2 border-[#1A1A1A]/10 pb-3">
                  <span>Daftar Halaman ({pageFiles.length} Gambar)</span>
                  <span className="text-[#137333] flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 fill-current" /> Auto WebP Active
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {pagePreviews.map((src, idx) => (
                    <div
                      key={idx}
                      className="group relative bg-[#FAF7F0] border-2 border-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm flex flex-col"
                    >
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#FAF7F0]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`Page ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-[#1A1A1A] text-[10px] font-black text-white border border-white">
                          Hal. {idx + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePage(idx)}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-[#FFEAEA] border border-[#1A1A1A] text-[#C53030] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="p-2 text-[10px] font-bold text-[#7A756D] truncate bg-white border-t border-[#1A1A1A]/20">
                        {pageFiles[idx]?.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4 border-t-2 border-[#1A1A1A]/10 flex items-center justify-end gap-4">
              <button
                type="submit"
                disabled={isSubmitting || pageFiles.length === 0}
                className={`w-full sm:w-auto px-7 py-3 rounded-full text-xs font-black flex items-center justify-center gap-2 transition-all border-2 border-[#1A1A1A] ${
                  isSubmitting || pageFiles.length === 0
                    ? 'bg-[#FAF7F0] text-[#B3ADA0] border-[#1A1A1A]/30 cursor-not-allowed'
                    : 'bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px]'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#1A1A1A]" />
                    Mengonversi &amp; Mengunggah WebP...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    Proses &amp; Simpan Komik (Auto-WebP)
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
