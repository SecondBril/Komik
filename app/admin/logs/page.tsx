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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/30 uppercase">
            <AlertCircle className="w-3 h-3" /> Error
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">
            <AlertTriangle className="w-3 h-3" /> Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 uppercase">
            <Info className="w-3 h-3" /> Info
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 border-b border-[#2A2F3A] pb-4">
        <FileText className="w-5 h-5 text-[#7C5CFC]" />
        <h2 className="text-lg font-bold text-[#F2F3F5]">Log Ingest & Error Pipeline</h2>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-[#2A2F3A] bg-[#171A21]">
        <table className="w-full text-left text-xs text-[#9AA0AC]">
          <thead className="bg-[#1F232C] text-[#F2F3F5] uppercase font-bold border-b border-[#2A2F3A]">
            <tr>
              <th className="p-3.5">Level</th>
              <th className="p-3.5">Waktu</th>
              <th className="p-3.5">Pesan Detail Log</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A2F3A]">
            {MOCK_INGEST_LOGS.map((log) => (
              <tr key={log.id} className="hover:bg-[#1F232C]/50 transition-colors">
                <td className="p-3.5">{getLevelBadge(log.level)}</td>
                <td className="p-3.5 whitespace-nowrap">{formatRelativeTime(log.created_at)}</td>
                <td className="p-3.5 font-mono text-[11px] text-[#F2F3F5]">{log.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
