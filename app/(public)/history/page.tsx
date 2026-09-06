'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ReadingHistoryItem } from '@/lib/types';
import { getGuestHistory, removeGuestHistoryItem, clearGuestHistory } from '@/lib/queries/history';
import { createClient } from '@/lib/supabase/client';
import { HistoryCard } from '@/components/history/HistoryCard';
import { Toast } from '@/components/ui/Toast';
import { History, Trash2, BookOpen, AlertCircle, Loader2 } from 'lucide-react';

export default function HistoryPage() {
  const [historyItems, setHistoryItems] = useState<ReadingHistoryItem[]>([]);
  const [isGuest, setIsGuest] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [isToastOpen, setIsToastOpen] = useState(false);

  useEffect(() => {
    async function loadHistoryData() {
      setLoading(true);
      const supabase = createClient();

      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setIsGuest(false);
          setUserEmail(user.email || null);

          // Fetch authenticated user history from API
          try {
            const res = await fetch('/api/history');
            const json = await res.json();

            if (json.success && Array.isArray(json.data) && json.data.length > 0) {
              setHistoryItems(json.data);
              setLoading(false);
              return;
            }
          } catch (err) {
            console.error('Error fetching user history API:', err);
          }

          // User is logged in, but cloud DB is empty -> show local cache without changing isGuest to true!
          const localData = getGuestHistory();
          setHistoryItems(localData);
          setLoading(false);
          return;
        }
      }

      // Guest fallback
      setIsGuest(true);
      const localData = getGuestHistory();
      setHistoryItems(localData);
      setLoading(false);
    }

    loadHistoryData();
  }, []);

  const handleRemoveSingle = async (comicId: string) => {
    if (isGuest) {
      removeGuestHistoryItem(comicId);
      setHistoryItems((prev) => prev.filter((item) => item.comic_id !== comicId));
    } else {
      try {
        await fetch(`/api/history?comicId=${comicId}`, { method: 'DELETE' });
        setHistoryItems((prev) => prev.filter((item) => item.comic_id !== comicId));
      } catch (err) {
        removeGuestHistoryItem(comicId);
        setHistoryItems((prev) => prev.filter((item) => item.comic_id !== comicId));
      }
    }
    setToastMessage('Item dihapus dari riwayat baca');
    setIsToastOpen(true);
  };

  const handleClearAll = async () => {
    if (confirm('Apakah Anda yakin ingin menghapus semua riwayat bacaan?')) {
      if (isGuest) {
        clearGuestHistory();
      } else {
        try {
          await fetch('/api/history', { method: 'DELETE' });
        } catch {
          clearGuestHistory();
        }
      }
      setHistoryItems([]);
      setToastMessage('Semua riwayat bacaan telah dibersihkan');
      setIsToastOpen(true);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      
      {/* Page Title & Clear All Action */}
      <div className="flex items-center justify-between border-b border-[#2A2F3A] pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[#7C5CFC]/10 text-[#7C5CFC]">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#F2F3F5]">
              Riwayat Baca Saya
            </h1>
            {!isGuest && userEmail && (
              <p className="text-xs text-emerald-400 font-medium">
                Tersinkronisasi dengan akun Cloud ({userEmail})
              </p>
            )}
          </div>
        </div>

        {historyItems.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F232C] hover:bg-red-400/10 text-red-400 border border-red-400/30 text-xs font-semibold transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Hapus Semua
          </button>
        )}
      </div>

      {/* Guest Warning Banner */}
      {isGuest && (
        <div className="p-4 rounded-xl bg-[#171A21] border border-amber-500/30 text-amber-400 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>
              Anda membaca sebagai Tamu. Riwayat tersimpan sementara di peramban ini. Masuk dengan Google untuk menyinkronkan secara permanen ke cloud.
            </span>
          </div>
        </div>
      )}

      {/* History Items List */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-[#9AA0AC] gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#7C5CFC]" />
          <span className="text-xs">Memuat riwayat bacaan...</span>
        </div>
      ) : historyItems.length > 0 ? (
        <div className="flex flex-col gap-3">
          {historyItems.map((item) => (
            <HistoryCard key={item.id} item={item} onRemove={handleRemoveSingle} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-16 bg-[#171A21] border border-[#2A2F3A] rounded-2xl text-center">
          <BookOpen className="w-14 h-14 text-[#5B616D] mb-4 stroke-[1.5]" />
          <h3 className="text-lg font-bold text-[#F2F3F5] mb-1">
            Belum Ada Riwayat Baca
          </h3>
          <p className="text-xs text-[#9AA0AC] mb-6 max-w-sm">
            Komik dan chapter yang Anda baca akan otomatis muncul di sini untuk mempermudah Anda melanjutkan bacaan.
          </p>
          <Link
            href="/"
            className="px-6 py-2.5 rounded-xl bg-[#7C5CFC] hover:bg-[#6A47F0] text-white font-bold text-xs transition-colors shadow-lg shadow-[#7C5CFC]/20"
          >
            Mulai Baca Komik
          </Link>
        </div>
      )}

      {/* Confirmation Toast */}
      <Toast
        message={toastMessage}
        isOpen={isToastOpen}
        onClose={() => setIsToastOpen(false)}
      />
    </div>
  );
}
