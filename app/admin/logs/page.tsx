'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  AlertCircle,
  Info,
  AlertTriangle,
  RefreshCw,
  Search,
  BookOpen,
  Filter,
  Loader2,
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils/relative-time';

interface IngestLog {
  id: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  created_at: string;
  chapter_id: string | null;
  chapter_number: number | null;
  chapter_title: string | null;
  comic_title: string | null;
  comic_slug: string | null;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<IngestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLevel, setActiveLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/admin/logs', window.location.origin);
      if (activeLevel !== 'all') {
        url.searchParams.set('level', activeLevel);
      }
      url.searchParams.set('limit', '100');

      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.success) {
        setLogs(json.data || []);
      } else {
        setError(json.error || 'Gagal memuat log');
      }
    } catch {
      setError('Gagal menghubungi server');
    } finally {
      setLoading(false);
    }
  }, [activeLevel]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#FFEAEA] text-[#C53030] border-2 border-[#1A1A1A] uppercase tracking-wider shrink-0">
            <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" /> Error
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#FFF8E1] text-[#B78103] border-2 border-[#1A1A1A] uppercase tracking-wider shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" /> Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#EBF3FE] text-[#2A4FCB] border-2 border-[#1A1A1A] uppercase tracking-wider shrink-0">
            <Info className="w-3.5 h-3.5 stroke-[2.5]" /> Info
          </span>
        );
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.message.toLowerCase().includes(q) ||
      (log.comic_title && log.comic_title.toLowerCase().includes(q)) ||
      (log.chapter_title && log.chapter_title.toLowerCase().includes(q))
    );
  });

  const errorCount = logs.filter((l) => l.level === 'error').length;
  const warnCount = logs.filter((l) => l.level === 'warning').length;
  const infoCount = logs.filter((l) => l.level === 'info').length;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[4px_4px_0px_#1A1A1A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#2E7D6E] text-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#1A1A1A] tracking-tight">
              Log Ingest &amp; Error Pipeline
            </h2>
            <p className="text-xs text-[#7A756D] font-medium mt-0.5">
              Riwayat diagnostik aktivitas worker, alasan gagal download, dan error buffer per chapter.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-[#FAF7F0] text-xs font-black text-[#1A1A1A] transition-all border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Log
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl sm:rounded-3xl p-4 shadow-[3px_3px_0px_#1A1A1A] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Level Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveLevel('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black border-2 border-[#1A1A1A] transition-all ${
              activeLevel === 'all'
                ? 'bg-[#1A1A1A] text-white shadow-[2px_2px_0px_#7A756D]'
                : 'bg-white text-[#1A1A1A] hover:bg-[#FAF7F0]'
            }`}
          >
            Semua ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveLevel('error')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black border-2 border-[#1A1A1A] transition-all ${
              activeLevel === 'error'
                ? 'bg-[#C53030] text-white shadow-[2px_2px_0px_#1A1A1A]'
                : 'bg-[#FFEAEA] text-[#C53030] hover:bg-[#FFD7D7]'
            }`}
          >
            Error ({errorCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveLevel('warning')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black border-2 border-[#1A1A1A] transition-all ${
              activeLevel === 'warning'
                ? 'bg-[#B78103] text-white shadow-[2px_2px_0px_#1A1A1A]'
                : 'bg-[#FFF8E1] text-[#B78103] hover:bg-[#FFEFB8]'
            }`}
          >
            Warning ({warnCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveLevel('info')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black border-2 border-[#1A1A1A] transition-all ${
              activeLevel === 'info'
                ? 'bg-[#2A4FCB] text-white shadow-[2px_2px_0px_#1A1A1A]'
                : 'bg-[#EBF3FE] text-[#2A4FCB] hover:bg-[#D5E6FD]'
            }`}
          >
            Info ({infoCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A756D]" />
          <input
            type="text"
            placeholder="Cari pesan atau nama komik..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-[#FAF7F0] border-2 border-[#1A1A1A] rounded-full text-xs font-bold text-[#1A1A1A] focus:outline-none focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="w-full overflow-x-auto rounded-2xl sm:rounded-3xl border-2 border-[#1A1A1A] bg-white shadow-[4px_4px_0px_#1A1A1A] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-16 text-[#7A756D] gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#2E7D6E]" />
            <span className="text-xs font-bold">Memuat riwayat log dari Supabase...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center gap-3">
            <AlertTriangle className="w-10 h-10 text-[#C53030]" />
            <p className="text-sm font-black text-[#1A1A1A]">{error}</p>
            <button
              onClick={fetchLogs}
              className="px-4 py-2 rounded-full bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-black"
            >
              Coba Lagi
            </button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center text-[#7A756D] gap-2">
            <Info className="w-8 h-8 text-[#7A756D]/60" />
            <p className="text-sm font-black text-[#1A1A1A]">Tidak Ada Log Terdaftar</p>
            <p className="text-xs text-[#7A756D]">
              {searchQuery ? 'Tidak ada pesan yang cocok dengan kata kunci pencarian.' : 'Belum ada log aktivitas untuk level ini.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs font-bold text-[#1A1A1A] border-collapse">
            <thead className="bg-[#FAF7F0] text-[#1A1A1A] uppercase font-black tracking-wider text-[11px] border-b-2 border-[#1A1A1A]">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Status Level</th>
                <th className="py-3.5 px-4 sm:px-6">Waktu</th>
                <th className="py-3.5 px-4 sm:px-6">Target Komik &amp; Chapter</th>
                <th className="py-3.5 px-4 sm:px-6">Pesan Diagnostik / Error</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#1A1A1A]/10">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#FAF7F0]/60 transition-colors">
                  <td className="py-3.5 px-4 sm:px-6">{getLevelBadge(log.level)}</td>
                  <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-[#7A756D] font-mono text-[11px]">
                    {formatRelativeTime(log.created_at)}
                  </td>
                  <td className="py-3.5 px-4 sm:px-6">
                    {log.comic_title ? (
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[#2E7D6E] shrink-0" />
                        <div>
                          <p className="font-black text-[#1A1A1A] line-clamp-1">{log.comic_title}</p>
                          {log.chapter_number !== null && (
                            <span className="text-[10px] font-mono text-[#7A756D]">
                              Chapter {log.chapter_number}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[#7A756D] font-mono text-[11px]">Sistem Worker</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 font-mono text-xs text-[#1A1A1A]">
                    <div className="max-w-xl break-words">
                      {log.message}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
