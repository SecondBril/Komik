'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, History, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const ADMIN_EMAIL = 'ag4863017@gmail.com';

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check localStorage
    const localUser = localStorage.getItem('chameleon_user');
    if (localUser) {
      try {
        const parsed = JSON.parse(localUser);
        if (parsed?.email?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          setIsAdmin(true);
        }
      } catch (e) {}
    }

    // Check Supabase Auth
    const supabase = createClient();
    if (supabase) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          setIsAdmin(true);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
        if (session?.user?.email?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          setIsAdmin(true);
        } else if (!localUser) {
          setIsAdmin(false);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  // Hide on reader page (e.g., /komik/slug/47, /komik/slug/1.1)
  if (pathname && /^\/komik\/[^\/]+\/[^\/]+\/?$/.test(pathname)) {
    return null;
  }

  const navItems = [
    {
      label: 'Home',
      href: '/',
      icon: Home,
      isActive: pathname === '/',
    },
    {
      label: 'Search',
      href: '/browse',
      icon: Search,
      isActive: pathname.startsWith('/browse') || pathname.startsWith('/komik/'),
    },
    {
      label: 'History',
      href: '/history',
      icon: History,
      isActive: pathname.startsWith('/history'),
    },
  ];

  // If logged in as ag4863017@gmail.com, add Admin button to mobile bottom nav
  if (isAdmin) {
    navItems.push({
      label: 'Admin',
      href: '/admin',
      icon: Shield,
      isActive: pathname.startsWith('/admin'),
    });
  }

  return (
    <nav
      aria-label="Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-[#1A1A1A] py-1.5 px-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
    >
      <div className="max-w-sm mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          if (active) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className="flex flex-col items-center justify-center px-4 py-1 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] text-[#1A1A1A] shadow-sm transition-transform active:scale-95"
              >
                <Icon className="w-4 h-4 stroke-[2.5]" />
                <span className="text-xs font-black tracking-tight">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex flex-col items-center justify-center px-4 py-1 text-[#1A1A1A] hover:text-[#2E7D6E] transition-colors group"
            >
              <Icon className="w-5 h-5 stroke-[2] group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-[#666] group-hover:text-[#1A1A1A] mt-0.5">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
