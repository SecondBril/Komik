'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, Compass, User, LogOut, X, History, Shield } from 'lucide-react';
import { Comic } from '@/lib/types';
import { Toast } from '@/components/ui/Toast';
import { ChameleonMascot } from '@/components/ui/ChameleonMascot';
import { GoogleAuthModal } from '@/components/auth/GoogleAuthModal';
import { createClient } from '@/lib/supabase/client';

export const Navbar: React.FC = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Comic[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name: string; email: string; avatar: string } | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [isToastOpen, setIsToastOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Sync Supabase Auth session & local storage
  useEffect(() => {
    const localUser = localStorage.getItem('chameleon_user');
    if (localUser) {
      try {
        const parsed = JSON.parse(localUser);
        setIsUserLoggedIn(true);
        setUserProfile({
          name: parsed.name || 'Reader',
          email: parsed.email || '',
          avatar: parsed.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        });
      } catch (e) { }
    }

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsUserLoggedIn(true);
        setUserProfile({
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          avatar: session.user.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        });
      } else if (!localUser) {
        setIsUserLoggedIn(false);
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch live search results from Supabase /api/browse
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearchOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/browse?q=${encodeURIComponent(searchQuery.trim())}&limit=6`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSearchResults(json.data);
          setIsSearchOpen(true);
        }
      } catch (err) {
        console.error('Navbar search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener
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
      router.push(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('chameleon_user');
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
      <header className="sticky top-0 z-40 w-full bg-[#F7F2E6]/95 backdrop-blur-md border-b-2 border-[#1A1A1A] py-2 sm:py-2.5 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">

          {/* Logo Brand with Chameleon Avatar */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <ChameleonMascot variant="avatar" size={40} />
            <div className="flex flex-col">
              <span className="text-base sm:text-xl font-black tracking-tight text-[#1A1A1A] group-hover:text-[#2E7D6E] transition-colors leading-none">
                Chameleon
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#2E7D6E]">
                Comics
              </span>
            </div>
          </Link>

          {/* Search Bar - Hidden on Mobile, Visible on Tablet & PC */}
          <div ref={searchContainerRef} className="relative flex-1 max-w-md lg:max-w-lg hidden md:block">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari judul komik, karakter..."
                className="w-full bg-white border-2 border-[#1A1A1A] rounded-full py-2 pl-10 pr-8 text-xs font-bold text-[#1A1A1A] placeholder-[#8C8C8C] shadow-[2px_2px_0px_#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A1A] stroke-[2.5]" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8C8C] hover:text-[#1A1A1A]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            {/* Quick Live Search Dropdown */}
            {isSearchOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border-2 border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] overflow-hidden z-50 p-2 flex flex-col gap-1 max-h-96 overflow-y-auto">
                {isSearching ? (
                  <div className="p-3 text-center text-xs font-bold text-[#7A756D]">
                    Mencari komik di database...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-center text-xs font-bold text-[#7A756D]">
                    Tidak ditemukan komik dengan judul &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  searchResults.map((c) => (
                    <Link
                      key={c.id}
                      href={`/komik/${c.slug}`}
                      onClick={() => setIsSearchOpen(false)}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#FAF7F0] transition-colors group"
                    >
                      <div className="relative w-10 h-14 rounded-lg overflow-hidden shrink-0 border border-[#1A1A1A] bg-[#FAF7F0]">
                        <Image src={c.cover_url} alt={c.title} fill className="object-cover" />
                      </div>
                      <div className="flex flex-col flex-1 truncate">
                        <span className="text-xs font-black text-[#1A1A1A] group-hover:text-[#2E7D6E] truncate">
                          {c.title}
                        </span>
                        <span className="text-[11px] text-[#7A756D]">
                          Ch. {c.latest_chapter?.chapter_number || 1} • {c.type.toUpperCase()} • Rating {c.rating.toFixed(1)}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Navigation Links (Desktop & Tablet only) & Auth Button (All screens) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Hidden on mobile, shown on md+ (tablet & desktop) */}
            <Link
              href="/browse"
              className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] hover:bg-[#FAF7F0] active:translate-x-[1px] active:translate-y-[1px] transition-all"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Browse</span>
            </Link>

            <Link
              href="/history"
              className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] hover:bg-[#FAF7F0] active:translate-x-[1px] active:translate-y-[1px] transition-all"
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </Link>

            {/* Admin Button - ONLY visible for ag4863017@gmail.com */}
            {userProfile?.email?.trim().toLowerCase() === 'ag4863017@gmail.com' && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] border-2 border-[#1A1A1A] text-xs font-black shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all"
                title="Panel Pengelola Admin"
              >
                <Shield className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Admin</span>
              </Link>
            )}

            {/* Login / Profile Button - Shown on ALL screens (on mobile this is the only action next to logo) */}
            {isUserLoggedIn ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-white border-2 border-[#1A1A1A] text-xs font-black text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] hover:bg-[#FAF7F0]"
                title="Keluar dari akun"
              >
                <User className="w-3.5 h-3.5" />
                <span className="truncate max-w-[80px] sm:max-w-[110px]">{userProfile?.name}</span>
                <LogOut className="w-3 h-3 text-[#E96379]" />
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#2A4FCB] hover:bg-[#203EA5] text-white border-2 border-[#1A1A1A] text-xs font-black shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all"
              >
                <User className="w-3.5 h-3.5" />
                <span>Log in</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Google Auth Modal */}
      <GoogleAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(u) => {
          setIsUserLoggedIn(true);
          setUserProfile(u);
          setToastMessage(`Selamat datang, ${u.name}!`);
          setIsToastOpen(true);
        }}
      />

      <Toast
        isOpen={isToastOpen}
        onClose={() => setIsToastOpen(false)}
        message={toastMessage}
      />
    </>
  );
};
