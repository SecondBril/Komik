'use client';

import React, { useState, useEffect } from 'react';
import { MOCK_SOURCES } from '@/lib/mock-data';
import { Source } from '@/lib/types';
import { Globe, Plus, CheckCircle, XCircle, Loader2, Trash2, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { Toast } from '@/components/ui/Toast';

export default function AdminSourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<Source | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

        <div className="flex items-center gap-2 sm:gap-3">
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
            <span>Tambah Sumber Baru</span>
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

      <Toast message={toastMessage} isOpen={isToastOpen} onClose={() => setIsToastOpen(false)} />
    </div>
  );
}
