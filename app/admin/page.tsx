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
    <div className="flex flex-col gap-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[#7A756D] uppercase font-black tracking-wider">Antrian Pending</p>
            <p className="text-2xl sm:text-3xl font-black text-[#1A1A1A] mt-1">{pendingCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#FAF7F0] border-2 border-[#1A1A1A] shadow-sm flex items-center justify-center text-[#7A756D]">
            <Clock className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[#2A4FCB] uppercase font-black tracking-wider">Sedang Diproses</p>
            <p className="text-2xl sm:text-3xl font-black text-[#2A4FCB] mt-1">{processingCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#EBF3FE] border-2 border-[#1A1A1A] shadow-sm flex items-center justify-center text-[#2A4FCB]">
            <RefreshCw className={`w-6 h-6 stroke-[2.5] ${processingCount > 0 ? 'animate-spin' : ''}`} />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[#C53030] uppercase font-black tracking-wider">Gagal Ingest</p>
            <p className="text-2xl sm:text-3xl font-black text-[#C53030] mt-1">{failedCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#FFEAEA] border-2 border-[#1A1A1A] shadow-sm flex items-center justify-center text-[#C53030]">
            <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* Queue Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between bg-white border-2 border-[#1A1A1A] rounded-2xl p-4 shadow-[3px_3px_0px_#1A1A1A]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#F6C945] border-2 border-[#1A1A1A]">
              <ListOrdered className="w-4 h-4 text-[#1A1A1A] stroke-[2.5]" />
            </div>
            <h2 className="text-sm sm:text-base font-black text-[#1A1A1A]">
              Antrian Ingest Pipeline Aktif
            </h2>
          </div>
          <button
            type="button"
            onClick={loadQueue}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#FAF7F0] text-xs font-black text-[#1A1A1A] transition-all border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-16 text-[#7A756D] gap-3 bg-white rounded-3xl border-2 border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A]">
            <Loader2 className="w-6 h-6 animate-spin text-[#2E7D6E]" />
            <span className="text-xs font-bold">Memuat antrian dari Supabase...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl border-2 border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] gap-3">
            <AlertTriangle className="w-10 h-10 text-[#C53030]" />
            <div>
              <p className="text-sm font-black text-[#1A1A1A]">Gagal Memuat Antrian</p>
              <p className="text-xs text-[#7A756D] mt-1">{error}</p>
            </div>
            <button
              onClick={loadQueue}
              className="px-4 py-2 rounded-full bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-sm hover:bg-white"
            >
              Coba Lagi
            </button>
          </div>
        ) : queueItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center bg-white rounded-3xl border-2 border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] gap-3">
            <div className="p-4 rounded-3xl bg-[#E6F4EA] border-2 border-[#1A1A1A] text-[#137333] shadow-sm">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-base font-black text-[#1A1A1A]">Antrian Ingest Kosong</p>
              <p className="text-xs text-[#7A756D] mt-1 max-w-sm">
                Semua chapter telah diproses dan dipublikasikan. Tidak ada chapter pending atau gagal saat ini.
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
