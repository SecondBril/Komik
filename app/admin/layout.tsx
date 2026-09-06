'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  ListOrdered,
  Globe,
  FileText,
  ArrowLeft,
  Upload,
  BookOpen,
  ShieldAlert,
  LogOut,
  Loader2,
  Lock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const ADMIN_EMAIL = 'ag4863017@gmail.com';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    async function checkAdminAuth() {
      setIsCheckingAuth(true);
      const supabase = createClient();

      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email) {
          setUserEmail(user.email);
          if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            setIsAuthorized(true);
          } else {
            setIsAuthorized(false);
          }
        } else {
          setUserEmail(null);
          setIsAuthorized(false);
        }
      } else {
        // Fallback for simulation mode without Supabase env
        setUserEmail(ADMIN_EMAIL);
        setIsAuthorized(true);
      }
      setIsCheckingAuth(false);
    }

    checkAdminAuth();

    // Listen to Auth State changes (e.g. login / logout)
    const supabase = createClient();
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
        if (session?.user?.email) {
          const email = session.user.email;
          setUserEmail(email);
          setIsAuthorized(email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
        } else {
          setUserEmail(null);
          setIsAuthorized(false);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const handleGoogleAdminLogin = async () => {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUserEmail(null);
    setIsAuthorized(false);
  };

  const tabs = [
    { name: 'Queue Status', href: '/admin', icon: ListOrdered },
    { name: 'Kelola Komik', href: '/admin/comics', icon: BookOpen },
    { name: 'Input Komik Manual', href: '/admin/upload', icon: Upload },
    { name: 'Sumber Scraping', href: '/admin/sources', icon: Globe },
    { name: 'Log Error Ingest', href: '/admin/logs', icon: FileText },
  ];

  // Loading State
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#0F1115] text-[#F2F3F5] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#7C5CFC]" />
        <p className="text-xs font-semibold text-[#9AA0AC]">Verifikasi Hak Akses Admin...</p>
      </div>
    );
  }

  // Access Denied Screen for non-admin or unauthenticated users
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0F1115] text-[#F2F3F5] flex flex-col items-center justify-center p-4">
        <div className="bg-[#171A21] border border-[#2A2F3A] rounded-2xl p-8 max-w-md w-full flex flex-col items-center text-center gap-5 shadow-2xl relative overflow-hidden">
          {/* Accent Line */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-red-500 to-purple-500" />

          {/* Shield Icon */}
          <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-lg shadow-amber-500/10">
            <Lock className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-1.5 flex items-center justify-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Akses Dibatasi
            </h2>
            <p className="text-xs text-[#9AA0AC] leading-relaxed">
              Dashboard Internal Admin hanya dapat diakses oleh akun Google pengelola utama:
            </p>
            <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-[#0F1115] border border-[#2A2F3A] inline-block">
              <code className="text-xs font-bold text-amber-400 font-mono">{ADMIN_EMAIL}</code>
            </div>
          </div>

          {/* Current Auth Status Notice */}
          {userEmail ? (
            <div className="w-full p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
              Anda saat ini masuk sebagai: <strong>{userEmail}</strong> (Bukan Pengelola Admin).
            </div>
          ) : (
            <div className="w-full p-3 rounded-xl bg-[#0F1115] border border-[#2A2F3A] text-xs text-[#9AA0AC]">
              Anda belum masuk ke akun Google.
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col w-full gap-2.5 pt-2">
            {userEmail ? (
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Keluar & Ganti Akun Admin
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGoogleAdminLogin}
                className="w-full py-2.5 rounded-xl bg-[#7C5CFC] hover:bg-[#6846F9] text-white text-xs font-bold transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Masuk dengan Google (Akun Admin)
              </button>
            )}

            <Link
              href="/"
              className="w-full py-2.5 rounded-xl bg-[#1F232C] hover:bg-[#2A2F3A] text-xs font-semibold text-[#9AA0AC] hover:text-white transition-colors flex items-center justify-center gap-2 border border-[#2A2F3A]"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Beranda Situs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Authorized Admin View
  return (
    <div className="min-h-screen bg-[#0F1115] text-[#F2F3F5] flex flex-col">
      {/* Admin Top Header */}
      <header className="bg-[#171A21] border-b border-[#2A2F3A] px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold flex items-center gap-2">
              Internal Admin Dashboard
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {ADMIN_EMAIL}
              </span>
            </h1>
            <p className="text-[11px] text-[#9AA0AC]">Monitoring Ingest Pipeline & Management</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-colors border border-red-500/20"
            title="Keluar dari akun admin"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar Admin
          </button>

          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F232C] hover:bg-[#2A2F3A] text-xs font-medium text-[#9AA0AC] hover:text-white transition-colors border border-[#2A2F3A]"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Situs
          </Link>
        </div>
      </header>

      {/* Admin Tabs */}
      <div className="bg-[#171A21] border-b border-[#2A2F3A] px-6 flex gap-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
                isActive
                  ? 'border-[#7C5CFC] text-[#7C5CFC] bg-[#7C5CFC]/10'
                  : 'border-transparent text-[#9AA0AC] hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
            </Link>
          );
        })}
      </div>

      {/* Main Admin Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {children}
      </main>
    </div>
  );
}
