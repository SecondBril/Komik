'use client';

import React, { useState } from 'react';
import {
  RotateCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  RotateCcw,
  Info,
  ChevronDown,
  ChevronUp,
  Trash2,
  ExternalLink,
} from 'lucide-react';

export interface QueueItem {
  id: string;
  chapter_title: string;
  comic_title: string;
  comic_slug?: string;
  chapter_number?: number;
  status: 'pending' | 'processing' | 'published' | 'failed';
  progress_pages: number;
  total_pages: number;
  missing_pages?: number;
  retry_count: number;
  last_error?: string | null;
  updated_at: string;
}

interface QueueTableProps {
  queueItems: QueueItem[];
  onRetry: (chapterId: string) => void;
  onReingest?: (chapterId: string) => void;
}

export const QueueTable: React.FC<QueueTableProps> = ({ queueItems, onRetry, onReingest }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

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

  const handleAction = async (actionFn?: (id: string) => Promise<void> | void, id?: string) => {
    if (!actionFn || !id) return;
    setActionLoadingId(id);
    try {
      await actionFn(id);
    } finally {
      setActionLoadingId(null);
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
            <th className="py-3.5 px-4 sm:px-6">Progres Upload</th>
            <th className="py-3.5 px-4 sm:px-6">Diagnosa Masalah</th>
            <th className="py-3.5 px-4 sm:px-6 text-center">Retry</th>
            <th className="py-3.5 px-4 sm:px-6 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-[#1A1A1A]/10">
          {queueItems.map((item) => {
            const isExpanded = expandedId === item.id;
            const isLoading = actionLoadingId === item.id;

            return (
              <React.Fragment key={item.id}>
                <tr className="hover:bg-[#FAF7F0]/60 transition-colors">
                  <td className="py-3.5 px-4 sm:px-6 font-black text-[#1A1A1A] whitespace-nowrap">
                    {item.chapter_title}
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 text-[#7A756D] max-w-[160px] truncate">
                    {item.comic_title}
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">{getStatusBadge(item.status)}</td>
                  <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className="w-20 h-2.5 rounded-full bg-[#FAF7F0] border border-[#1A1A1A] overflow-hidden">
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
                  <td className="py-3.5 px-4 sm:px-6">
                    {item.last_error ? (
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="flex items-center gap-1.5 text-left group"
                      >
                        <span className="text-[11px] text-[#C53030] font-mono line-clamp-1 bg-[#FFEAEA] px-2 py-0.5 rounded-md border border-[#C53030]/30 max-w-[220px]">
                          {item.last_error}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-[#C53030] shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-[#C53030] shrink-0 opacity-60 group-hover:opacity-100" />
                        )}
                      </button>
                    ) : item.status === 'pending' ? (
                      <span className="text-[11px] text-[#7A756D] font-mono">
                        {item.progress_pages === 0
                          ? 'Menunggu antrean worker'
                          : `Tersisa ${item.total_pages - item.progress_pages} gambar belum terunggah`}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#7A756D] font-mono">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#FAF7F0] border border-[#1A1A1A]/20 text-[11px] font-mono">
                      {item.retry_count}x
                    </span>
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {/* Retry Button */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleAction(onRetry, item.id)}
                        title="Coba unggah ulang gambar yang gagal/tertunda"
                        className="px-3 py-1.5 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] font-black text-xs border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5"
                      >
                        <RotateCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                        Retry
                      </button>

                      {/* Hapus & Upload Ulang (Re-ingest) Button */}
                      {onReingest && (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => {
                            if (
                              confirm(
                                `Hapus semua halaman lama untuk Chapter ${item.chapter_title} (${item.comic_title}) dan ambil ulang halaman fresh dari sumber?`
                              )
                            ) {
                              handleAction(onReingest, item.id);
                            }
                          }}
                          title="Hapus data halaman corrupt dan scrape ulang fresh dari sumber"
                          className="px-3 py-1.5 rounded-full bg-[#FFEAEA] hover:bg-[#FFD7D7] text-[#C53030] font-black text-xs border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Hapus &amp; Re-ingest
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Expanded Details Row */}
                {isExpanded && (
                  <tr className="bg-[#FAF7F0]/80">
                    <td colSpan={7} className="p-4 sm:p-5 border-y-2 border-[#1A1A1A]/10">
                      <div className="flex flex-col gap-2.5 bg-white p-4 rounded-2xl border-2 border-[#1A1A1A] shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-[#C53030]" />
                            <span className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider">
                              Diagnosa Detail Kegagalan Chapter
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-[#7A756D]">
                            ID: {item.id}
                          </span>
                        </div>
                        <div className="p-3 bg-[#FFEAEA]/60 rounded-xl border border-[#C53030]/20 font-mono text-xs text-[#C53030] break-words">
                          {item.last_error || 'Tidak ada catatan error terperinci.'}
                        </div>
                        <div className="flex items-center justify-between text-xs text-[#7A756D] pt-1">
                          <span>
                            Total Halaman: <b>{item.total_pages}</b> | Terunggah:{' '}
                            <b className="text-[#2E7D6E]">{item.progress_pages}</b> | Belum Terunggah:{' '}
                            <b className="text-[#C53030]">{item.total_pages - item.progress_pages}</b>
                          </span>
                          <span className="font-mono text-[11px]">
                            Terakhir diperbarui: {new Date(item.updated_at).toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
