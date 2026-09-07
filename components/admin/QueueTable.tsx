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
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-[#E6F4EA] text-[#137333] border-2 border-[#1A1A1A]">
            <CheckCircle className="w-3.5 h-3.5" />
            Published
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-[#EBF3FE] text-[#2A4FCB] border-2 border-[#1A1A1A] animate-pulse">
            <RotateCw className="w-3.5 h-3.5 animate-spin" />
            Processing
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-[#FAF7F0] text-[#7A756D] border-2 border-[#1A1A1A]">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-[#FFEAEA] text-[#C53030] border-2 border-[#1A1A1A]">
            <AlertTriangle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
    }
  };

  return (
    <div className="w-full overflow-x-auto rounded-2xl sm:rounded-3xl border-2 border-[#1A1A1A] bg-white shadow-[4px_4px_0px_#1A1A1A] overflow-hidden">
      <table className="w-full text-left text-xs font-bold text-[#1A1A1A] border-collapse">
        <thead className="bg-[#FAF7F0] text-[#1A1A1A] uppercase font-black tracking-wider text-[11px] border-b-2 border-[#1A1A1A]">
          <tr>
            <th className="py-3.5 px-4 sm:px-6">Chapter</th>
            <th className="py-3.5 px-4 sm:px-6">Komik</th>
            <th className="py-3.5 px-4 sm:px-6">Status</th>
            <th className="py-3.5 px-4 sm:px-6">Progres Halaman</th>
            <th className="py-3.5 px-4 sm:px-6 text-center">Retry</th>
            <th className="py-3.5 px-4 sm:px-6 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-[#1A1A1A]/10">
          {queueItems.map((item) => (
            <tr key={item.id} className="hover:bg-[#FAF7F0]/60 transition-colors">
              <td className="py-3.5 px-4 sm:px-6 font-black text-[#1A1A1A]">{item.chapter_title}</td>
              <td className="py-3.5 px-4 sm:px-6 text-[#7A756D]">{item.comic_title}</td>
              <td className="py-3.5 px-4 sm:px-6">{getStatusBadge(item.status)}</td>
              <td className="py-3.5 px-4 sm:px-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-24 h-2.5 rounded-full bg-[#FAF7F0] border border-[#1A1A1A] overflow-hidden">
                    <div
                      className="h-full bg-[#2E7D6E] transition-all"
                      style={{
                        width: `${item.total_pages > 0 ? (item.progress_pages / item.total_pages) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-black text-[#1A1A1A]">
                    {item.progress_pages}/{item.total_pages}
                  </span>
                </div>
              </td>
              <td className="py-3.5 px-4 sm:px-6 text-center">
                <span className="px-2.5 py-0.5 rounded-md bg-[#FAF7F0] border border-[#1A1A1A]/20 text-[11px] font-mono">
                  {item.retry_count}x
                </span>
              </td>
              <td className="py-3.5 px-4 sm:px-6 text-right">
                <button
                  type="button"
                  onClick={() => onRetry(item.id)}
                  className="px-3.5 py-1.5 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] font-black text-xs border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 ml-auto"
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
