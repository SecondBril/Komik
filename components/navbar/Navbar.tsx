'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, BookOpen, History, User, LogOut, ShieldAlert, X, Menu, Compass, Home } from 'lucide-react';
import { MOCK_COMICS } from '@/lib/mock-data';
import { Comic } from '@/lib/types';
import { Toast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { TypeBadge } from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';

export const Navbar: React.FC = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Comic[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name: string; email: string; avatar: string } | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [isToastOpen, setIsToastOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Sync Supabase Auth session & listen for OAuth redirect callbacks
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setIsUserLoggedIn(true);
        setUserProfile({
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          avatar: user.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setIsUserLoggedIn(true);
        setUserProfile({
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          avatar: session.user.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        });
        if (event === 'SIGNED_IN') {
          setToastMessage(`Berhasil masuk sebagai ${session.user.email}!`);
          setIsToastOpen(true);
        }
      } else if (event === 'SIGNED_OUT') {
        setIsUserLoggedIn(false);
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle debounced search preview
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearchOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      const filtered = MOCK_COMICS.filter(
        (c) =>
          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.alt_titles.some((alt) => alt.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 5);
      setSearchResults(filtered);
      setIsSearchOpen(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener to close search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearchOpen(false);
      setIsMobileSearchExpanded(false);
      router.push(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
      if (error) {
        console.error('Google OAuth error:', error.message);
      }
    } else {
      // Simulated fallback mode when Supabase credentials are missing
      setIsUserLoggedIn(true);
      setUserProfile({
        name: 'Andi Pembaca',
        email: 'ag4863017@gmail.com',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      });
      setIsAuthModalOpen(false);
      setToastMessage('Berhasil masuk sebagai Andi Pembaca!');
      setIsToastOpen(true);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setIsUserLoggedIn(false);
    setUserProfile(null);
    setToastMessage('Berhasil keluar dari akun');
    setIsToastOpen(true);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#171A21]/95 backdrop-blur-md border-b border-[#2A2F3A] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

          {/* Logo Brand */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7C5CFC] to-[#6A47F0] flex items-center justify-center shadow-md shadow-[#7C5CFC]/20 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-[#F2F3F5] hidden sm:inline">
              Komik<span className="text-[#7C5CFC]">Indo</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#9AA0AC]">
            <Link href="/" className="hover:text-white transition-colors">
              Beranda
            </Link>
            <Link href="/browse" className="hover:text-white transition-colors">
              Jelajah
            </Link>
            <Link href="/history" className="hover:text-white transition-colors flex items-center gap-1.5">
              <History className="w-4 h-4 text-[#7C5CFC]" />
              Riwayat
            </Link>
            {isUserLoggedIn && userProfile?.email?.toLowerCase() === 'ag4863017@gmail.com' && (
              <Link href="/admin" className="hover:text-amber-400 transition-colors flex items-center gap-1.5 text-xs text-amber-400/80 border border-amber-400/30 px-2 py-0.5 rounded-full bg-amber-400/10">
                <ShieldAlert className="w-3.5 h-3.5" />
                Admin
              </Link>
            )}
          </nav>

          {/* Search Bar (Desktop & Mobile Expandable) */}
          <div ref={searchContainerRef} className="relative flex-1 max-w-md">
            {!isMobileSearchExpanded ? (
              <div className="relative">
                <form onSubmit={handleSearchSubmit}>
                  <input
                    type="text"
                    placeholder="Cari judul komik..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 bg-[#0F1115] border border-[#2A2F3A] rounded-full text-sm text-[#F2F3F5] placeholder-[#5B616D] focus:outline-none focus:border-[#7C5CFC] focus:ring-1 focus:ring-[#7C5CFC] transition-all"
                  />
                  <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-[#5B616D]" />
                </form>
              </div>
            ) : (
              <div className="fixed inset-0 bg-[#171A21] p-4 z-50 flex items-center gap-2">
                <form onSubmit={handleSearchSubmit} className="flex-1 relative">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Cari judul komik..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 bg-[#0F1115] border border-[#7C5CFC] rounded-full text-sm text-[#F2F3F5] placeholder-[#5B616D] focus:outline-none"
                  />
                  <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-[#7C5CFC]" />
                </form>
                <button
                  onClick={() => setIsMobileSearchExpanded(false)}
                  className="p-2 text-[#9AA0AC] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Instant Search Dropdown Preview */}
            {isSearchOpen && (
              <div className="absolute top-12 left-0 right-0 z-50 bg-[#171A21] border border-[#2A2F3A] rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                {searchResults.length > 0 ? (
                  <div className="divide-y divide-[#2A2F3A]">
                    {searchResults.map((comic) => (
                      <Link
                        key={comic.id}
                        href={`/komik/${comic.slug}`}
                        onClick={() => setIsSearchOpen(false)}
                        className="flex items-center gap-3 p-2.5 hover:bg-[#1F232C] transition-colors"
                      >
                        <div className="relative w-10 h-14 rounded overflow-hidden shrink-0 bg-[#1F232C]">
                          <Image
                            src={comic.cover_url}
                            alt={comic.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <TypeBadge type={comic.type} />
                            <span className="text-sm font-medium text-[#F2F3F5] truncate">
                              {comic.title}
                            </span>
                          </div>
                          <span className="text-xs text-[#9AA0AC] truncate mt-0.5">
                            {comic.latest_chapter ? `Ch. ${comic.latest_chapter.chapter_number}` : ''} · {comic.author}
                          </span>
                        </div>
                      </Link>
                    ))}
                    <Link
                      href={`/browse?q=${encodeURIComponent(searchQuery)}`}
                      onClick={() => setIsSearchOpen(false)}
                      className="block p-3 text-center text-xs font-semibold text-[#7C5CFC] hover:bg-[#1F232C] transition-colors"
                    >
                      Lihat semua hasil pencarian →
                    </Link>
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-[#9AA0AC]">
                    Tidak ada komik ditemukan dengan kata kunci &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            )}
          </div>
          {/* User Auth Action & Mobile Hamburger Button */}
          <div className="flex items-center gap-2 shrink-0">
            {isUserLoggedIn && userProfile ? (
              <div className="relative group">
                <button className="flex items-center gap-2 p-1 rounded-full border border-[#2A2F3A] hover:border-[#7C5CFC] transition-colors">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden">
                    <Image src={userProfile.avatar} alt="Profile" fill unoptimized className="object-cover" />
                  </div>
                </button>

                {/* User Dropdown */}
                <div className="absolute right-0 top-10 w-48 bg-[#171A21] border border-[#2A2F3A] rounded-xl shadow-2xl py-2 hidden group-hover:block animate-fade-in z-50">
                  <div className="px-4 py-2 border-b border-[#2A2F3A]">
                    <p className="text-xs font-semibold text-[#F2F3F5]">{userProfile.name}</p>
                    <p className="text-[11px] text-[#9AA0AC] truncate">{userProfile.email}</p>
                  </div>
                  <Link
                    href="/history"
                    className="flex items-center gap-2 px-4 py-2 text-xs text-[#9AA0AC] hover:text-white hover:bg-[#1F232C]"
                  >
                    <History className="w-3.5 h-3.5 text-[#7C5CFC]" />
                    Riwayat Baca
                  </Link>
                  {userProfile?.email?.toLowerCase() === 'ag4863017@gmail.com' && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 px-4 py-2 text-xs text-amber-400 hover:bg-amber-400/10"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Dashboard Admin
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs text-red-400 hover:bg-red-400/10"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Keluar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-white bg-[#7C5CFC] hover:bg-[#6A47F0] transition-colors shadow-md shadow-[#7C5CFC]/20"
              >
                Masuk Google
              </button>
            )}

            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-[#9AA0AC] hover:text-white hover:bg-[#1F232C] transition-colors border border-[#2A2F3A]"
              aria-label="Toggle Mobile Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-[#7C5CFC]" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-Down Drawer Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#171A21] border-b border-[#2A2F3A] px-4 py-3 flex flex-col gap-2 animate-fade-in text-sm font-medium">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#F2F3F5] hover:bg-[#1F232C] transition-colors"
            >
              <Home className="w-4 h-4 text-[#7C5CFC]" />
              Beranda
            </Link>
            <Link
              href="/browse"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#F2F3F5] hover:bg-[#1F232C] transition-colors"
            >
              <Compass className="w-4 h-4 text-[#7C5CFC]" />
              Jelajah Katalog
            </Link>
            <Link
              href="/history"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#F2F3F5] hover:bg-[#1F232C] transition-colors"
            >
              <History className="w-4 h-4 text-[#7C5CFC]" />
              Riwayat Saya
            </Link>
            {isUserLoggedIn && userProfile?.email?.toLowerCase() === 'ag4863017@gmail.com' && (
              <Link
                href="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-amber-400 bg-amber-400/10 border border-amber-400/20 font-semibold transition-colors"
              >
                <ShieldAlert className="w-4 h-4" />
                Dashboard Admin
              </Link>
            )}
          </div>
        )}
      </header>

      {/* Google OAuth Modal Trigger */}
      <Modal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Masuk ke KomikIndo"
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="w-12 h-12 rounded-full bg-[#7C5CFC]/20 flex items-center justify-center text-[#7C5CFC]">
            <User className="w-6 h-6" />
          </div>
          <p className="text-xs text-[#9AA0AC]">
            Simpan riwayat bacaan Anda di cloud dan akses kembali dengan mudah dari perangkat mana saja.
          </p>
          <button
            onClick={handleGoogleLogin}
            className="w-full h-11 rounded-lg bg-white text-gray-900 font-semibold text-sm flex items-center justify-center gap-3 hover:bg-gray-100 transition-colors shadow-md"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.99-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z"
              />
            </svg>
            Lanjutkan dengan Google
          </button>
        </div>
      </Modal>

      <Toast
        message={toastMessage}
        isOpen={isToastOpen}
        onClose={() => setIsToastOpen(false)}
      />
    </>
  );
};
