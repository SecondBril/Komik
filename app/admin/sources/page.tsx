'use client';
import React, { useState, useEffect } from 'react';
import { MOCK_SOURCES } from '@/lib/mock-data';
import { Source } from '@/lib/types';
import { DiscoveredComicSource } from '@/lib/scrapers/westmanga-contents';
import {
  Globe,
  Plus,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  AlertTriangle,
  X,
  RefreshCw,
  Sparkles,
  Search,
  Check,
  Layers,
  Code,
  ExternalLink,
} from 'lucide-react';
import { Toast } from '@/components/ui/Toast';
import Image from 'next/image';

export default function AdminSourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<Source | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-Discover States
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);
  const [discoverUrl, setDiscoverUrl] = useState('https://v1.westmanga.my/contents');
  const [discoverPage, setDiscoverPage] = useState(1);
  const [discoverEndPage, setDiscoverEndPage] = useState<number | ''>('');
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [discoverInputTab, setDiscoverInputTab] = useState<'live' | 'paste'>('live');
  const [rawHtmlInput, setRawHtmlInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredList, setDiscoveredList] = useState<DiscoveredComicSource[]>([]);
  const [isSavingDiscovered, setIsSavingDiscovered] = useState(false);
  const [scanSummary, setScanSummary] = useState<{ total: number; newCount: number; existing: number } | null>(null);

  const [toastMessage, setToastMessage] = useState('');
  const [isToastOpen, setIsToastOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setIsToastOpen(true);
  };

  // Fetch sources from Supabase API on mount
  const loadSources = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sources');
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        setSources(json.data);
      } else {
        setSources(MOCK_SOURCES);
      }
    } catch (err) {
      setSources(MOCK_SOURCES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) return;

    setIsAdding(true);
    const payload = {
      name: newSourceName.trim(),
      base_url: newSourceUrl.trim(),
      scraping_config: { selector_title: '.entry-title', selector_images: '#readerarea img' },
    };

    try {
      const res = await fetch('/api/admin/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        setNewSourceName('');
        setNewSourceUrl('');
        setIsAddModalOpen(false);
        showToast('Sumber scraping baru berhasil tersimpan di database!');
        loadSources();
      } else {
        alert('Gagal menyimpan: ' + (json.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('Gagal terhubung ke API admin: ' + err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await fetch('/api/admin/sources', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentStatus }),
      });
      setSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: !currentStatus } : s))
      );
      showToast(`Status sumber berhasil diubah.`);
    } catch (err) {
      console.error('Error toggling source active status:', err);
    }
  };

  const confirmDeleteSource = async () => {
    if (!sourceToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/sources?id=${sourceToDelete.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setSources((prev) => prev.filter((s) => s.id !== sourceToDelete.id));
        showToast(`Sumber "${sourceToDelete.name}" berhasil dihapus.`);
      } else {
        alert(`Gagal menghapus: ${json.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err?.message || err}`);
    } finally {
      setIsDeleting(false);
      setSourceToDelete(null);
    }
  };

  const handleScanContents = async () => {
    setIsScanning(true);
    setScanSummary(null);

    const payload: any = {
      url: discoverUrl.trim() || 'https://v1.westmanga.my/contents',
      page: discoverPage,
      autoSave: false,
    };

    if (isRangeMode && discoverEndPage) {
      payload.endPage = Number(discoverEndPage);
    }

    if (discoverInputTab === 'paste' && rawHtmlInput.trim()) {
      payload.html = rawHtmlInput.trim();
    }

    try {
      const res = await fetch('/api/admin/sources/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success && Array.isArray(json.comics)) {
        setDiscoveredList(json.comics);
        setScanSummary({
          total: json.totalFound,
          newCount: json.newCount,
          existing: json.existingCount,
        });
        showToast(`Scan selesai: Ditemukan ${json.totalFound} komik (${json.newCount} baru).`);
      } else {
        alert('Gagal scan: ' + (json.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('Error saat scan: ' + (err.message || err));
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveAllNewDiscovered = async () => {
    const newItems = discoveredList.filter((c) => !c.isAlreadySource);
    if (newItems.length === 0) {
      alert('Semua komik yang terdeteksi sudah terdaftar di sumber scraping.');
      return;
    }

    setIsSavingDiscovered(true);
    try {
      const payload: any = {
        url: discoverUrl.trim() || 'https://v1.westmanga.my/contents',
        page: discoverPage,
        autoSave: true,
      };

      if (isRangeMode && discoverEndPage) {
        payload.endPage = Number(discoverEndPage);
      }

      if (discoverInputTab === 'paste' && rawHtmlInput.trim()) {
        payload.html = rawHtmlInput.trim();
      }

      const res = await fetch('/api/admin/sources/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        showToast(`Sukses! ${json.savedCount || newItems.length} sumber komik baru berhasil tersimpan.`);
        setDiscoveredList((prev) =>
          prev.map((item) => ({ ...item, isAlreadySource: true }))
        );
        if (scanSummary) {
          setScanSummary({
            ...scanSummary,
            newCount: 0,
            existing: scanSummary.total,
          });
        }
        loadSources();
      } else {
        alert('Gagal menyimpan sumber: ' + (json.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('Error saat menyimpan: ' + (err.message || err));
    } finally {
      setIsSavingDiscovered(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[4px_4px_0px_#1A1A1A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#2A4FCB] text-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center shrink-0">
            <Globe className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-[#1A1A1A] tracking-tight">
                Kelola Sumber Scraping
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#F6C945] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-sm">
                {sources.length} Sumber
              </span>
            </div>
            <p className="text-xs text-[#7A756D] font-medium mt-0.5">
              Konfigurasi situs komik target dan pipeline ekstraksi scraper otomatis.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setIsDiscoverModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#2E7D6E] hover:bg-[#25685B] text-white border-2 border-[#1A1A1A] text-xs font-black shadow-[3px_3px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#1A1A1A] transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Auto-Discover WestManga</span>
          </button>

          <button
            type="button"
            onClick={loadSources}
            className="p-2.5 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all"
            title="Refresh Sumber"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] border-2 border-[#1A1A1A] text-xs font-black shadow-[3px_3px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#1A1A1A] transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Tambah Sumber Manual</span>
          </button>
        </div>
      </div>

      {/* Sources Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#7A756D] gap-3 bg-white rounded-3xl border-2 border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A]">
          <Loader2 className="w-6 h-6 animate-spin text-[#2E7D6E]" />
          <span className="text-xs font-bold">Memuat daftar sumber scraping...</span>
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-2xl sm:rounded-3xl border-2 border-[#1A1A1A] bg-white shadow-[4px_4px_0px_#1A1A1A] overflow-hidden">
          <table className="w-full text-left text-xs font-bold text-[#1A1A1A] border-collapse">
            <thead className="bg-[#FAF7F0] text-[#1A1A1A] uppercase font-black tracking-wider text-[11px] border-b-2 border-[#1A1A1A]">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Nama Sumber</th>
                <th className="py-3.5 px-4 sm:px-6">Base URL</th>
                <th className="py-3.5 px-4 sm:px-6">Status</th>
                <th className="py-3.5 px-4 sm:px-6">Scraping Config</th>
                <th className="py-3.5 px-4 sm:px-6">Dibuat Tanggal</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#1A1A1A]/10">
              {sources.map((src) => (
                <tr key={src.id} className="hover:bg-[#FAF7F0]/60 transition-colors">
                  <td className="py-3.5 px-4 sm:px-6 font-black text-sm text-[#1A1A1A]">
                    {src.name}
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 text-[#2A4FCB] font-mono break-all">
                    {src.base_url}
                  </td>
                  <td className="py-3.5 px-4 sm:px-6">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(src.id, src.is_active)}
                      className="cursor-pointer"
                      title="Klik untuk ubah status aktif"
                    >
                      {src.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#E6F4EA] text-[#137333] border-2 border-[#1A1A1A] shadow-sm">
                          <CheckCircle className="w-3.5 h-3.5" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#FAF7F0] text-[#7A756D] border-2 border-[#1A1A1A] shadow-sm">
                          <XCircle className="w-3.5 h-3.5" /> Non-Aktif
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 font-mono text-[11px] text-[#7A756D] max-w-xs truncate">
                    {JSON.stringify(src.scraping_config)}
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 text-[#7A756D]">
                    {new Date(src.created_at).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 text-right">
                    <button
                      type="button"
                      onClick={() => setSourceToDelete(src)}
                      className="p-2 rounded-full bg-[#FFEAEA] hover:bg-[#FFD6D6] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#C53030] active:translate-x-[1px] active:translate-y-[1px] transition-all ml-auto"
                      title="Hapus Sumber Scraping"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Tambah Sumber Baru */}
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
              <div className="p-2.5 rounded-xl bg-[#2A4FCB] text-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]">
                <Globe className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#1A1A1A]">Tambah Sumber Scraping</h3>
                <p className="text-xs text-[#7A756D] font-medium">
                  Konfigurasi alamat situs komik target.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddSource} className="flex flex-col gap-3.5 mt-2">
              <div>
                <label className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider mb-1 block">
                  Nama Sumber <span className="text-[#E96379]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Kiryuu Engine, WestManga"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3.5 py-2 text-xs font-bold text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                />
              </div>

              <div>
                <label className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider mb-1 block">
                  Base URL / Direktori Komik <span className="text-[#E96379]">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://kiryuu.id/manga/..."
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  className="w-full bg-white border-2 border-[#1A1A1A] rounded-xl px-3.5 py-2 text-xs font-bold text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E] font-mono"
                />
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
                  disabled={isAdding || !newSourceName.trim() || !newSourceUrl.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#2A4FCB] hover:bg-[#203EA5] text-white border-2 border-[#1A1A1A] text-xs font-black shadow-[2px_2px_0px_#1A1A1A] disabled:opacity-50"
                >
                  {isAdding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Sumber
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Hapus Sumber */}
      {sourceToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#F7F2E6] border-[3px] border-[#1A1A1A] rounded-3xl p-6 max-w-md w-full flex flex-col gap-4 shadow-[8px_8px_0px_#1A1A1A]">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-[#FFEAEA] text-[#C53030] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] shrink-0">
                <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#1A1A1A]">Hapus Sumber Scraping?</h3>
                <p className="text-xs text-[#7A756D] font-medium mt-1">
                  Apakah Anda yakin ingin menghapus sumber scraping <strong>&quot;{sourceToDelete.name}&quot;</strong> ({sourceToDelete.base_url})?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setSourceToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-sm"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteSource}
                disabled={isDeleting}
                className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#E96379] hover:bg-[#D44E64] text-white border-2 border-[#1A1A1A] text-xs font-black shadow-[2px_2px_0px_#1A1A1A]"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Ya, Hapus Sumber
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Auto-Discover Sumber Komik dari WestManga Contents */}
      {isDiscoverModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-[#F7F2E6] border-[3px] border-[#1A1A1A] rounded-3xl p-5 sm:p-6 max-w-4xl w-full max-h-[92vh] flex flex-col gap-4 shadow-[8px_8px_0px_#1A1A1A] relative overflow-hidden">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsDiscoverModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#1A1A1A] hover:bg-[#FAF7F0] transition-transform active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-start gap-3.5 pr-10">
              <div className="p-3 rounded-2xl bg-[#2E7D6E] text-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] shrink-0">
                <Sparkles className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-[#1A1A1A] tracking-tight">
                  Auto-Discover Sumber Komik WestManga
                </h3>
                <p className="text-xs text-[#7A756D] font-medium mt-0.5">
                  Ekstrak seluruh komik dari halaman katalog/contents secara otomatis dan daftarkan base URL-nya ke tabel sumber scraping.
                </p>
              </div>
            </div>

            {/* Configuration Tabs: Live Scan vs Paste HTML */}
            <div className="flex items-center gap-2 border-b-2 border-[#1A1A1A]/10 pb-2">
              <button
                type="button"
                onClick={() => setDiscoverInputTab('live')}
                className={`px-4 py-1.5 rounded-full text-xs font-black border-2 border-[#1A1A1A] transition-all ${
                  discoverInputTab === 'live'
                    ? 'bg-[#2E7D6E] text-white shadow-[2px_2px_0px_#1A1A1A]'
                    : 'bg-white text-[#1A1A1A] hover:bg-[#FAF7F0]'
                }`}
              >
                🌐 Live Web Scan (Puppeteer)
              </button>
              <button
                type="button"
                onClick={() => setDiscoverInputTab('paste')}
                className={`px-4 py-1.5 rounded-full text-xs font-black border-2 border-[#1A1A1A] transition-all ${
                  discoverInputTab === 'paste'
                    ? 'bg-[#2E7D6E] text-white shadow-[2px_2px_0px_#1A1A1A]'
                    : 'bg-white text-[#1A1A1A] hover:bg-[#FAF7F0]'
                }`}
              >
                📋 Paste HTML Mentah (Instan)
              </button>
            </div>

            {/* Form Controls */}
            <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl p-4 shadow-[3px_3px_0px_#1A1A1A] flex flex-col gap-3">
              {discoverInputTab === 'live' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Base URL */}
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-black uppercase text-[#1A1A1A] tracking-wider mb-1 block">
                        URL Katalog Contents
                      </label>
                      <input
                        type="url"
                        value={discoverUrl}
                        onChange={(e) => setDiscoverUrl(e.target.value)}
                        placeholder="https://v1.westmanga.my/contents"
                        className="w-full bg-[#FAF7F0] border-2 border-[#1A1A1A] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] outline-none font-mono"
                      />
                    </div>

                    {/* Pagination page number */}
                    <div>
                      <label className="text-[11px] font-black uppercase text-[#1A1A1A] tracking-wider mb-1 block">
                        Halaman (Pagination)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={discoverPage}
                          onChange={(e) => setDiscoverPage(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full bg-[#FAF7F0] border-2 border-[#1A1A1A] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] outline-none text-center font-mono"
                        />
                        {isRangeMode && (
                          <>
                            <span className="text-xs font-black text-[#7A756D]">s/d</span>
                            <input
                              type="number"
                              min={discoverPage}
                              max={discoverPage + 10}
                              placeholder="Akhir"
                              value={discoverEndPage}
                              onChange={(e) => setDiscoverEndPage(parseInt(e.target.value, 10) || '')}
                              className="w-full bg-[#FAF7F0] border-2 border-[#1A1A1A] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] outline-none text-center font-mono"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-[#7A756D] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isRangeMode}
                        onChange={(e) => setIsRangeMode(e.target.checked)}
                        className="rounded border-[#1A1A1A] text-[#2E7D6E] focus:ring-0"
                      />
                      <span>Scan rentang multi-halaman (misal: halaman 1 sampai 3)</span>
                    </label>

                    <div className="text-[11px] font-mono text-gray-500">
                      Target: {discoverUrl}?page={discoverPage}
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-black uppercase text-[#1A1A1A] tracking-wider block">
                      Cuplikan HTML dari Halaman Katalog Westmanga
                    </label>
                    <span className="text-[11px] text-[#7A756D]">
                      Salin elemen &lt;div class=&quot;grid ...&quot;&gt; dari Inspect Element
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={rawHtmlInput}
                    onChange={(e) => setRawHtmlInput(e.target.value)}
                    placeholder="<div class=&quot;grid grid-cols-3 ...&quot;><div class=&quot;overflow-hidden&quot;><a href=&quot;/comic/...&quot;>...</div>"
                    className="w-full bg-[#FAF7F0] border-2 border-[#1A1A1A] rounded-xl p-3 text-xs font-mono text-[#1A1A1A] outline-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-xs text-[#7A756D] font-medium">
                  {isScanning
                    ? 'Sedang memindai katalog & menunggu render JavaScript...'
                    : discoveredList.length > 0
                    ? `Ditemukan ${discoveredList.length} komik di halaman ini.`
                    : 'Klik "Mulai Scan" untuk mendeteksi komik secara otomatis.'}
                </span>

                <button
                  type="button"
                  onClick={handleScanContents}
                  disabled={isScanning || (discoverInputTab === 'paste' && !rawHtmlInput.trim())}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] border-2 border-[#1A1A1A] text-xs font-black shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 transition-all"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sedang Memindai...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 stroke-[2.5]" />
                      <span>Mulai Scan Komik</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Results Preview List */}
            {discoveredList.length > 0 && (
              <div className="flex-1 flex flex-col gap-2.5 overflow-hidden">
                {/* Summary Banner */}
                {scanSummary && (
                  <div className="bg-[#EBF7F4] border-2 border-[#2E7D6E] rounded-xl px-4 py-2 flex flex-wrap items-center justify-between text-xs font-bold text-[#1A1A1A]">
                    <div className="flex items-center gap-3">
                      <span>Total: <strong>{scanSummary.total}</strong> Komik</span>
                      <span className="text-emerald-700">Baru: <strong>{scanSummary.newCount}</strong></span>
                      <span className="text-gray-500">Sudah Ada: <strong>{scanSummary.existing}</strong></span>
                    </div>
                    {scanSummary.newCount > 0 && (
                      <span className="text-[11px] text-emerald-800 font-extrabold bg-white px-2 py-0.5 rounded-md border border-emerald-400">
                        Siap disimpan ke database
                      </span>
                    )}
                  </div>
                )}

                {/* Comics Cards Container */}
                <div className="flex-1 overflow-y-auto max-h-[320px] pr-1 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {discoveredList.map((comic) => (
                      <div
                        key={comic.slug}
                        className={`p-3 rounded-xl border-2 flex items-start justify-between gap-3 transition-all ${
                          comic.isAlreadySource
                            ? 'bg-white/60 border-gray-300 opacity-75'
                            : 'bg-white border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          {/* Cover Thumbnail */}
                          <div className="w-10 h-14 rounded-lg bg-gray-200 border border-black/20 overflow-hidden relative shrink-0">
                            {comic.coverUrl ? (
                              <img
                                src={comic.coverUrl}
                                alt={comic.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-400 font-bold">
                                NO IMG
                              </div>
                            )}
                          </div>

                          {/* Comic Details */}
                          <div className="flex flex-col min-w-0 flex-1">
                            <h4 className="font-black text-xs text-[#1A1A1A] truncate" title={comic.title}>
                              {comic.title}
                            </h4>

                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                  comic.type === 'manhwa'
                                    ? 'bg-blue-100 text-blue-800'
                                    : comic.type === 'manhua'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {comic.type}
                              </span>

                              {comic.latestChapter?.chapterNumber && (
                                <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-1.5 rounded">
                                  Ch. {comic.latestChapter.chapterNumber}
                                </span>
                              )}

                              {comic.latestChapter?.relativeTime && (
                                <span className="text-[9px] text-gray-400">
                                  {comic.latestChapter.relativeTime}
                                </span>
                              )}
                            </div>

                            <a
                              href={comic.comicUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-[#2A4FCB] hover:underline truncate mt-1 flex items-center gap-1 font-mono"
                            >
                              <span>{comic.comicUrl.replace('https://v1.westmanga.my', '')}</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            </a>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {comic.isAlreadySource ? (
                            <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-bold border border-gray-300">
                              Sudah Terdaftar
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-[#EBF7F4] text-emerald-800 text-[10px] font-black border border-emerald-400 shadow-xs">
                              ✨ Sumber Baru
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t-2 border-[#1A1A1A]/10 mt-auto">
              <button
                type="button"
                onClick={() => setIsDiscoverModalOpen(false)}
                className="px-4 py-2 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]"
              >
                Tutup
              </button>

              {discoveredList.some((c) => !c.isAlreadySource) && (
                <button
                  type="button"
                  onClick={handleSaveAllNewDiscovered}
                  disabled={isSavingDiscovered}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#2E7D6E] hover:bg-[#25685B] text-white border-2 border-[#1A1A1A] text-xs font-black shadow-[3px_3px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 transition-all"
                >
                  {isSavingDiscovered ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Database...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>
                        Simpan {discoveredList.filter((c) => !c.isAlreadySource).length} Sumber Baru ke Database
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Toast message={toastMessage} isOpen={isToastOpen} onClose={() => setIsToastOpen(false)} />
    </div>
  );
}
