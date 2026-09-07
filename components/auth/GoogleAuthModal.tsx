'use client';

import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';
import { ChameleonMascot } from '@/components/ui/ChameleonMascot';
import { createClient } from '@/lib/supabase/client';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: { name: string; email: string; avatar: string }) => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const supabase = createClient();
      if (supabase) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/api/auth/callback`,
          },
        });
        if (error) throw error;
      } else {
        // Fallback demo simulation
        const mockUser = {
          name: 'Google Reader',
          email: 'user@gmail.com',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        };
        localStorage.setItem('chameleon_user', JSON.stringify(mockUser));
        if (onSuccess) onSuccess(mockUser);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal masuk dengan Google');
      setLoading(false);
    }
  };

  const handleGuestContinue = () => {
    const guestUser = {
      name: 'Pembaca Tamu',
      email: 'guest@chameleon.io',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    };
    localStorage.setItem('chameleon_user', JSON.stringify(guestUser));
    if (onSuccess) onSuccess(guestUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      {/* Modal Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm bg-[#F7F2E6] rounded-[36px] border-[3px] border-[#1A1A1A] shadow-[8px_8px_0px_#1A1A1A] p-6 sm:p-7 flex flex-col items-center text-center overflow-hidden"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center text-[#1A1A1A] hover:bg-[#FAF7F0] active:translate-x-[1px] active:translate-y-[1px] transition-all"
          aria-label="Tutup modal"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Mascot Avatar Header */}
        <div className="mb-3 mt-1">
          <ChameleonMascot variant="avatar" size={72} />
        </div>

        {/* Badge Brand */}
        <div className="px-3.5 py-1 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] mb-3">
          <span className="text-xs font-black text-[#1A1A1A] tracking-tight">
            Chameleon Comics
          </span>
        </div>

        {/* Heading & Subtitle */}
        <h2 className="text-xl sm:text-2xl font-black text-[#1A1A1A] tracking-tight leading-snug mb-1.5">
          Masuk ke Akun
        </h2>
        <p className="text-xs text-[#7A756D] font-medium leading-relaxed max-w-xs mb-6">
          Simpan riwayat membaca otomatis dan nikmati pengalaman baca komik tanpa lag di semua perangkat.
        </p>

        {errorMessage && (
          <div className="w-full p-2.5 mb-4 text-xs font-bold text-[#E96379] bg-white border-2 border-[#1A1A1A] rounded-xl shadow-sm">
            {errorMessage}
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3.5 px-5 rounded-full bg-white hover:bg-[#FAF7F0] border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#1A1A1A] transition-all flex items-center justify-center gap-3 group"
        >
          {/* Google Icon SVG */}
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span className="text-sm font-black text-[#1A1A1A] tracking-tight">
            {loading ? 'Menghubungkan...' : 'Lanjutkan dengan Google'}
          </span>
        </button>

        {/* Divider */}
        <div className="w-full flex items-center my-4">
          <div className="flex-1 border-t border-[#D9D3C5]" />
          <span className="px-3 text-[11px] font-extrabold text-[#7A756D] uppercase">atau</span>
          <div className="flex-1 border-t border-[#D9D3C5]" />
        </div>

        {/* Guest Mode Option */}
        <div className="w-full flex flex-col gap-2">
          <button
            onClick={handleGuestContinue}
            className="w-full py-2.5 px-4 rounded-full bg-[#E6F4EA] hover:bg-[#D4EDDA] border-2 border-[#1A1A1A] text-xs font-black text-[#137333] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all"
          >
            Lanjut sebagai Tamu (Guest)
          </button>
        </div>
      </div>
    </div>
  );
};
