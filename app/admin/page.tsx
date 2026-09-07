'use client';

import React, { useState, useEffect } from 'react';
import { QueueTable } from '@/components/admin/QueueTable';
import { Toast } from '@/components/ui/Toast';
import { ListOrdered, Clock, RefreshCw, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';

export default function AdminQueuePage() {
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [isToastOpen, setIsToastOpen] = useState(false);

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/queue');
      const json = await res.json();
      if (json.success) {
        setQueueItems(json.data || []);
      } else {
        setError(json.error || 'Gagal memuat queue');
        setQueueItems([]);
      }
    } catch {
      setError('Gagal terhubung ke server');
      setQueueItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = async (chapterId: string) => {
    try {
      const res = await fetch(`/api/admin/retry/${chapterId}`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setQueueItems((prev) =>
          prev.map((item) =>
            item.id === chapterId
              ? { ...item, status: 'pending' as const, retry_count: item.retry_count + 1 }
              : item
          )
        );
        setToastMessage(`Chapter reset ke status 'pending' di Supabase.`);
        setIsToastOpen(true);
        loadQueue();
      }
    } catch (err: any) {
      alert('Gagal retry chapter: ' + err.message);
    }
  };

  const pendingCount = queueItems.filter((i) => i.status === 'pending').length;
  const processingCount = queueItems.filter((i) => i.status === 'processing').length;
  const failedCount = queueItems.filter((i) => i.status === 'failed').length;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="p-3 md:p-4 rounded-xl bg-[#171A21] border border-[#2A2F3A] flex items-center justify-between">
          <div>
            <p className="text-[10px] md:text-xs text-[#9AA0AC] uppercase font-bold">Pending</p>
            <p className="text-xl md:text-2xl font-black text-[#F2F3F5] mt-1">{pendingCount}</p>
          </div>
          <div className="p-2 md:p-3 rounded-xl bg-gray-500/10 text-gray-400">
            <Clock className="w-5 h-5 md:w-6 md:h-6" />
          </div>
        </div>

        <div className="p-3 md:p-4 rounded-xl bg-[#171A21] border border-[#2A2F3A] flex items-center justify-between">
          <div>
            <p className="text-[10px] md:text-xs text-[#9AA0AC] uppercase font-bold">Proses</p>
            <p className="text-xl md:text-2xl font-black text-blue-400 mt-1">{processingCount}</p>
          </div>
          <div className="p-2 md:p-3 rounded-xl bg-blue-500/10 text-blue-400">
            <RefreshCw className={`w-5 h-5 md:w-6 md:h-6 ${processingCount > 0 ? 'animate-spin' : ''}`} />
          </div>
        </div>

        <div className="p-3 md:p-4 rounded-xl bg-[#171A21] border border-[#2A2F3A] flex items-center justify-between">
          <div>
            <p className="text-[10px] md:text-xs text-[#9AA0AC] uppercase font-bold">Gagal</p>
            <p className="text-xl md:text-2xl font-black text-red-400 mt-1">{failedCount}</p>
          </div>
          <div className="p-2 md:p-3 rounded-xl bg-red-500/10 text-red-400">
            <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />
          </div>
        </div>
      </div>

      {/* Queue Table */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm md:text-base font-bold text-[#F2F3F5] flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-[#7C5CFC]" />
            Antrian Ingest Aktif
          </h2>
          <button
            type="button"
            onClick={loadQueue}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F232C] hover:bg-[#2A2F3A] text-xs font-semibold text-[#9AA0AC] hover:text-white transition-colors border border-[#2A2F3A]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12 text-[#9AA0AC] gap-2 bg-[#171A21] rounded-2xl border border-[#2A2F3A]">
            <Loader2 className="w-5 h-5 animate-spin text-[#7C5CFC]" />
            <span className="text-xs">Memuat antrian dari Supabase...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-[#171A21] rounded-2xl border border-red-500/20 gap-3">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <div>
              <p className="text-sm font-bold text-white">Gagal memuat antrian</p>
              <p className="text-xs text-[#9AA0AC] mt-1">{error}</p>
            </div>
            <button
              onClick={loadQueue}
              className="px-4 py-2 rounded-lg bg-[#1F232C] border border-[#2A2F3A] text-xs text-[#9AA0AC] hover:text-white transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        ) : queueItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-[#171A21] rounded-2xl border border-[#2A2F3A] gap-3">
            <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Antrian Kosong</p>
              <p className="text-xs text-[#9AA0AC] mt-1">
                Tidak ada chapter yang sedang pending, diproses, atau gagal. Semua sudah selesai!
              </p>
            </div>
          </div>
        ) : (
          <QueueTable queueItems={queueItems} onRetry={handleRetry} />
        )}
      </div>

      <Toast
        message={toastMessage}
        isOpen={isToastOpen}
        onClose={() => setIsToastOpen(false)}
      />
    </div>
  );
}
