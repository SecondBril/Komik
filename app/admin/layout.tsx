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
  Menu,
  X,
  Tags,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ChameleonMascot } from '@/components/ui/ChameleonMascot';

const ADMIN_EMAIL = 'ag4863017@gmail.com';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function checkAdminAuth() {
      setIsCheckingAuth(true);
      const supabase = createClient();

      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email) {
          setUserEmail(user.email);
          setIsAuthorized(user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
        } else {
          // Check localStorage demo
          const localUser = localStorage.getItem('chameleon_user');
          if (localUser) {
            try {
              const parsed = JSON.parse(localUser);
              if (parsed.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
                setUserEmail(parsed.email);
                setIsAuthorized(true);
                setIsCheckingAuth(false);
                return;
              }
            } catch (e) {}
          }
          setUserEmail(null);
          setIsAuthorized(false);
        }
      } else {
        setUserEmail(ADMIN_EMAIL);
        setIsAuthorized(true);
      }
      setIsCheckingAuth(false);
    }

    checkAdminAuth();

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
        options: { redirectTo: `${window.location.origin}/api/auth/callback` },
      });
    } else {
      localStorage.setItem('chameleon_user', JSON.stringify({ email: ADMIN_EMAIL, name: 'Admin Utama' }));
      setUserEmail(ADMIN_EMAIL);
      setIsAuthorized(true);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('chameleon_user');
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    setUserEmail(null);
    setIsAuthorized(false);
  };

  const tabs = [
    { name: 'Queue', href: '/admin', icon: ListOrdered },
    { name: 'Komik', href: '/admin/comics', icon: BookOpen },
    { name: 'Genre', href: '/admin/genres', icon: Tags },
    { name: 'Upload', href: '/admin/upload', icon: Upload },
    { name: 'Sumber', href: '/admin/sources', icon: Globe },
    { name: 'Log', href: '/admin/logs', icon: FileText },
  ];

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#F7F2E6] text-[#1A1A1A] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#2E7D6E]" />
        <p className="text-xs font-bold text-[#7A756D]">Verifikasi Hak Akses Admin...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#F7F2E6] text-[#1A1A1A] flex flex-col items-center justify-center p-4">
        <div className="bg-white border-[3px] border-[#1A1A1A] rounded-[36px] p-8 max-w-md w-full flex flex-col items-center text-center gap-5 shadow-[8px_8px_0px_#1A1A1A] relative overflow-hidden">
          <ChameleonMascot variant="avatar" size={64} />
          <div>
            <h2 className="text-xl font-black text-[#1A1A1A] mb-1.5 flex items-center justify-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#F07850]" />
              Akses Dibatasi
            </h2>
            <p className="text-xs text-[#7A756D] font-medium leading-relaxed">
              Dashboard Pengelola Admin hanya dapat diakses khusus oleh email resmi pengelola:
            </p>
            <div className="mt-2.5 px-3.5 py-1.5 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] shadow-sm inline-block">
              <code className="text-xs font-black text-[#1A1A1A] font-mono">{ADMIN_EMAIL}</code>
            </div>
          </div>
          {userEmail ? (
            <div className="w-full p-3 rounded-2xl bg-[#FFEAEA] border-2 border-[#1A1A1A] text-[#C53030] text-xs font-bold">
              Saat ini masuk sebagai: <strong>{userEmail}</strong> (Bukan Pengelola Admin).
            </div>
          ) : (
            <div className="w-full p-3 rounded-2xl bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-medium text-[#7A756D]">
              Anda belum masuk ke akun Google pengelola.
            </div>
          )}
          <div className="flex flex-col w-full gap-2.5 pt-1">
            {userEmail ? (
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-3 rounded-full bg-white hover:bg-[#FAF7F0] text-[#E96379] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-xs font-black transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Keluar &amp; Ganti Akun Admin
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGoogleAdminLogin}
                className="w-full py-3 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] text-xs font-black transition-all flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4 stroke-[2.5]" />
                Masuk dengan Google (Akun Admin)
              </button>
            )}
            <Link
              href="/"
              className="w-full py-2.5 rounded-full bg-white hover:bg-[#FAF7F0] text-xs font-bold text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Beranda Situs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F2E6] text-[#1A1A1A] flex flex-col">
      {/* Admin Top Header in Neo-Comic Style */}
      <header className="bg-white border-b-2 border-[#1A1A1A] px-4 md:px-6 h-16 flex items-center justify-between gap-3 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="shrink-0 flex items-center gap-2 group">
            <ChameleonMascot variant="avatar" size={38} />
          </Link>
          <div>
            <h1 className="text-sm md:text-base font-black text-[#1A1A1A] leading-tight">
              Admin Panel
            </h1>
            <p className="text-[10px] text-[#7A756D] font-medium hidden sm:block">
              Manajemen Komik, Genre, Ingest Pipeline &amp; Scraper
            </p>
          </div>
        </div>

        {/* Desktop Tabs */}
        <nav className="hidden lg:flex items-center gap-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black border-2 border-[#1A1A1A] transition-all ${
                  isActive
                    ? 'bg-[#F6C945] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                    : 'bg-white text-[#1A1A1A] hover:bg-[#FAF7F0]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Actions */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#7A756D] hidden md:inline truncate max-w-[140px]">
            {userEmail}
          </span>
          <Link
            href="/"
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] text-xs font-bold text-[#1A1A1A] shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Web Publik</span>
          </Link>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-full bg-white hover:bg-[#FFEAEA] border-2 border-[#1A1A1A] text-[#E96379] shadow-sm"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-full bg-white border-2 border-[#1A1A1A]"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Submenu Tabs */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b-2 border-[#1A1A1A] p-3 flex flex-wrap gap-2 shadow-md">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black border-2 border-[#1A1A1A] ${
                  isActive ? 'bg-[#F6C945] text-[#1A1A1A]' : 'bg-[#FAF7F0] text-[#1A1A1A]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Main Admin Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
