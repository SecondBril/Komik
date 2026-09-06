'use client';

import React, { useState, useEffect } from 'react';
import { MOCK_SOURCES } from '@/lib/mock-data';
import { Source } from '@/lib/types';
import { Globe, Plus, CheckCircle, XCircle, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Toast } from '@/components/ui/Toast';

export default function AdminSourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [sourceToDelete, setSourceToDelete] = useState<Source | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const [isToastOpen, setIsToastOpen] = useState(false);

  // Fetch sources from Supabase API on mount
  const loadSources = async () => {
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
    if (!newSourceName || !newSourceUrl) return;

    const payload = {
      name: newSourceName,
      base_url: newSourceUrl,
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
        setToastMessage('Sumber scraping baru berhasil tersimpan di database!');
        setIsToastOpen(true);
        loadSources();
      } else {
        alert('Gagal menyimpan: ' + (json.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('Gagal terhubung ke API admin: ' + err.message);
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
      setToastMessage(`Status sumber berhasil diubah.`);
      setIsToastOpen(true);
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
        setToastMessage(`Sumber "${sourceToDelete.name}" berhasil dihapus.`);
        setIsToastOpen(true);
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
      <div className="flex items-center justify-between border-b border-[#2A2F3A] pb-4">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-[#7C5CFC]" />
          <h2 className="text-lg font-bold text-[#F2F3F5]">Kelola Sumber Scraping</h2>
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-[#7C5CFC] hover:bg-[#6A47F0] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-[#7C5CFC]/20"
        >
          <Plus className="w-4 h-4" />
          Tambah Sumber Baru
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-[#9AA0AC] gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#7C5CFC]" />
          <span className="text-xs">Memuat daftar sumber scraping...</span>
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-xl border border-[#2A2F3A] bg-[#171A21]">
          <table className="w-full text-left text-xs text-[#9AA0AC]">
            <thead className="bg-[#1F232C] text-[#F2F3F5] uppercase font-bold border-b border-[#2A2F3A]">
              <tr>
                <th className="p-3.5">Nama Sumber</th>
                <th className="p-3.5">Base URL</th>
                <th className="p-3.5">Status Active</th>
                <th className="p-3.5">Scraping Config</th>
                <th className="p-3.5">Dibuat Tanggal</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2F3A]">
              {sources.map((src) => (
                <tr key={src.id} className="hover:bg-[#1F232C]/50 transition-colors">
                  <td className="p-3.5 font-bold text-[#F2F3F5]">{src.name}</td>
                  <td className="p-3.5 text-[#7C5CFC] break-all">{src.base_url}</td>
                  <td className="p-3.5">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(src.id, src.is_active)}
                      className="cursor-pointer"
                    >
                      {src.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <CheckCircle className="w-3.5 h-3.5" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-400 font-semibold bg-gray-500/10 px-2 py-0.5 rounded border border-gray-500/20">
                          <XCircle className="w-3.5 h-3.5" /> Non-Aktif
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="p-3.5 font-mono text-[11px] text-gray-400 max-w-xs truncate">
                    {JSON.stringify(src.scraping_config)}
                  </td>
                  <td className="p-3.5">{new Date(src.created_at).toLocaleDateString('id-ID')}</td>
                  <td className="p-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => setSourceToDelete(src)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors"
                      title="Hapus Sumber Scraping"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Source Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Tambah Sumber Scraping Baru"
      >
        <form onSubmit={handleAddSource} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-[#9AA0AC] mb-1 block">Nama Sumber</label>
            <input
              type="text"
              required
              placeholder="Misal: Kiryuu Engine"
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              className="w-full h-10 px-3 bg-[#0F1115] border border-[#2A2F3A] rounded-lg text-xs text-[#F2F3F5] focus:outline-none focus:border-[#7C5CFC]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#9AA0AC] mb-1 block">Base URL / Link Direktori Komik</label>
            <input
              type="url"
              required
              placeholder="https://kiryuu.id atau https://kiryuu.id/manga/solo-leveling"
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              className="w-full h-10 px-3 bg-[#0F1115] border border-[#2A2F3A] rounded-lg text-xs text-[#F2F3F5] focus:outline-none focus:border-[#7C5CFC]"
            />
          </div>
          <button
            type="submit"
            className="w-full h-10 bg-[#7C5CFC] hover:bg-[#6A47F0] text-white font-bold text-xs rounded-lg transition-colors mt-2"
          >
            Simpan Sumber ke Database
          </button>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {sourceToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#171A21] border border-[#2A2F3A] rounded-2xl p-6 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-red-500/10 text-red-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Hapus Sumber Scraping?</h3>
                <p className="text-xs text-[#9AA0AC] mt-1">
                  Apakah Anda yakin ingin menghapus sumber scraping <strong>&quot;{sourceToDelete.name}&quot;</strong> ({sourceToDelete.base_url})?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSourceToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-[#1F232C] hover:bg-[#2A2F3A] text-xs font-bold text-[#9AA0AC] hover:text-white transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteSource}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors flex items-center gap-2"
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
