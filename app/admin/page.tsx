'use client';

import React, { useState, useEffect } from 'react';
import { QueueTable } from '@/components/admin/QueueTable';
import { MOCK_INGEST_QUEUE } from '@/lib/mock-data';
import { Toast } from '@/components/ui/Toast';
import { ListOrdered, Clock, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';

export default function AdminQueuePage() {
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [isToastOpen, setIsToastOpen] = useState(false);

  async function loadQueue() {
    try {
      const res = await fetch('/api/admin/queue');
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        setQueueItems(json.data);
      } else {
        setQueueItems(MOCK_INGEST_QUEUE);
      }
    } catch {
      setQueueItems(MOCK_INGEST_QUEUE);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#171A21] border border-[#2A2F3A] flex items-center justify-between">
          <div>
            <p className="text-xs text-[#9AA0AC] uppercase font-bold">Pending Queue</p>
            <p className="text-2xl font-black text-[#F2F3F5] mt-1">{pendingCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-gray-500/10 text-gray-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#171A21] border border-[#2A2F3A] flex items-center justify-between">
          <div>
            <p className="text-xs text-[#9AA0AC] uppercase font-bold">Sedang Diproses</p>
            <p className="text-2xl font-black text-blue-400 mt-1">{processingCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#171A21] border border-[#2A2F3A] flex items-center justify-between">
          <div>
            <p className="text-xs text-[#9AA0AC] uppercase font-bold">Gagal (Needs Admin)</p>
            <p className="text-2xl font-black text-red-400 mt-1">{failedCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-red-500/10 text-red-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Queue Status Table */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#F2F3F5] flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-[#7C5CFC]" />
            Daftar Antrian Ingest Real-Time
          </h2>

          <button
            type="button"
            onClick={loadQueue}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F232C] hover:bg-[#2A2F3A] text-xs font-semibold text-[#9AA0AC] hover:text-white transition-colors border border-[#2A2F3A]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Queue
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12 text-[#9AA0AC] gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#7C5CFC]" />
            <span className="text-xs">Memuat antrian dari Supabase...</span>
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
