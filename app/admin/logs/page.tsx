'use client';

import React from 'react';
import { MOCK_INGEST_LOGS } from '@/lib/mock-data';
import { FileText, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils/relative-time';

export default function AdminLogsPage() {
  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#FFEAEA] text-[#C53030] border-2 border-[#1A1A1A] uppercase tracking-wider">
            <AlertCircle className="w-3.5 h-3.5" /> Error
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#FFF8E1] text-[#B78103] border-2 border-[#1A1A1A] uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5" /> Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#EBF3FE] text-[#2A4FCB] border-2 border-[#1A1A1A] uppercase tracking-wider">
            <Info className="w-3.5 h-3.5" /> Info
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[4px_4px_0px_#1A1A1A] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#2E7D6E] text-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#1A1A1A] tracking-tight">
              Log Ingest &amp; Error Pipeline
            </h2>
            <p className="text-xs text-[#7A756D] font-medium mt-0.5">
              Riwayat aktivitas background worker, scraper engine, dan status kegagalan ingest.
            </p>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="w-full overflow-x-auto rounded-2xl sm:rounded-3xl border-2 border-[#1A1A1A] bg-white shadow-[4px_4px_0px_#1A1A1A] overflow-hidden">
        <table className="w-full text-left text-xs font-bold text-[#1A1A1A] border-collapse">
          <thead className="bg-[#FAF7F0] text-[#1A1A1A] uppercase font-black tracking-wider text-[11px] border-b-2 border-[#1A1A1A]">
            <tr>
              <th className="py-3.5 px-4 sm:px-6">Status Level</th>
              <th className="py-3.5 px-4 sm:px-6">Waktu Kejadian</th>
              <th className="py-3.5 px-4 sm:px-6">Detail Pesan Log</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-[#1A1A1A]/10">
            {MOCK_INGEST_LOGS.map((log) => (
              <tr key={log.id} className="hover:bg-[#FAF7F0]/60 transition-colors">
                <td className="py-3.5 px-4 sm:px-6">{getLevelBadge(log.level)}</td>
                <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-[#7A756D] font-mono text-[11px]">
                  {formatRelativeTime(log.created_at)}
                </td>
                <td className="py-3.5 px-4 sm:px-6 font-mono text-xs text-[#1A1A1A]">{log.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
