'use client';

import React from 'react';
import { RotateCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface QueueItem {
  id: string;
  chapter_title: string;
  comic_title: string;
  status: 'pending' | 'processing' | 'published' | 'failed';
  progress_pages: number;
  total_pages: number;
  retry_count: number;
  updated_at: string;
}

interface QueueTableProps {
  queueItems: QueueItem[];
  onRetry: (chapterId: string) => void;
}

export const QueueTable: React.FC<QueueTableProps> = ({ queueItems, onRetry }) => {
  const getStatusBadge = (status: QueueItem['status']) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" />
            Published
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse">
            <RotateCw className="w-3 h-3 animate-spin" />
            Processing
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/30">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
            <AlertTriangle className="w-3 h-3" />
            Failed
          </span>
        );
    }
  };

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-[#2A2F3A] bg-[#171A21]">
      <table className="w-full text-left text-xs text-[#9AA0AC]">
        <thead className="bg-[#1F232C] text-[#F2F3F5] uppercase font-bold border-b border-[#2A2F3A]">
          <tr>
            <th className="p-3.5">Chapter</th>
            <th className="p-3.5">Komik</th>
            <th className="p-3.5">Status</th>
            <th className="p-3.5">Progres Halaman</th>
            <th className="p-3.5">Retry Count</th>
            <th className="p-3.5 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2A2F3A]">
          {queueItems.map((item) => (
            <tr key={item.id} className="hover:bg-[#1F232C]/50 transition-colors">
              <td className="p-3.5 font-bold text-[#F2F3F5]">{item.chapter_title}</td>
              <td className="p-3.5">{item.comic_title}</td>
              <td className="p-3.5">{getStatusBadge(item.status)}</td>
              <td className="p-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-[#0F1115] overflow-hidden">
                    <div
                      className="h-full bg-[#7C5CFC] transition-all"
                      style={{
                        width: `${item.total_pages > 0 ? (item.progress_pages / item.total_pages) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span>
                    {item.progress_pages}/{item.total_pages} hal
                  </span>
                </div>
              </td>
              <td className="p-3.5">{item.retry_count}</td>
              <td className="p-3.5 text-right">
                <button
                  type="button"
                  onClick={() => onRetry(item.id)}
                  className="px-3 py-1 rounded-lg bg-[#1F232C] hover:bg-[#7C5CFC] text-[#F2F3F5] font-semibold text-xs border border-[#2A2F3A] hover:border-[#7C5CFC] transition-all flex items-center gap-1.5 ml-auto"
                >
                  <RotateCw className="w-3 h-3" />
                  Retry
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
