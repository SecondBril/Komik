'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChameleonMascot } from '@/components/ui/ChameleonMascot';
import { DecorativeBlobs } from '@/components/ui/DecorativeBlobs';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { mergeGuestHistoryToSupabase } from '@/lib/queries/history';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Harap isi email dan password.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const supabase = createClient();
      if (!supabase) {
        // Fallback for offline demo
        localStorage.setItem('chameleon_user', JSON.stringify({ email, name: email.split('@')[0] }));
        router.push('/');
        return;
      }

      if (isRegisterMode) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setErrorMessage('Akun berhasil dibuat! Silakan cek email konfirmasi atau login.');
        setIsRegisterMode(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Sync cookie history ke Supabase setelah login berhasil
        await mergeGuestHistoryToSupabase();
        router.push('/');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal autentikasi');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    localStorage.setItem('chameleon_user', JSON.stringify({ email: 'reader@chameleon.io', name: 'Pembaca Tamu' }));
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[#F7F2E6] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative colored blobs in background */}
      <DecorativeBlobs variant="login" />

      {/* Mobile Shell Frame */}
      <div className="relative w-full max-w-[390px] bg-[#F7F2E6] rounded-[40px] border-[3px] border-[#1A1A1A] shadow-[8px_8px_0px_#1A1A1A] overflow-hidden flex flex-col min-h-[740px] z-10">
        
        {/* Top Organic Curved Header */}
        <div className="relative w-full bg-[#2E7D6E] pt-8 pb-14 px-6 rounded-b-[48px] border-b-[3px] border-[#1A1A1A] flex flex-col items-center">
          
          {/* Top Bar inside Header */}
          <div className="w-full flex items-center justify-between mb-2">
            {/* Chameleon Avatar Top-Left */}
            <ChameleonMascot variant="avatar" size={42} />

            {/* Back to Home Button */}
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 hover:bg-white text-[#1A1A1A] border-2 border-[#1A1A1A] text-xs font-bold shadow-sm transition-transform active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Home</span>
            </Link>
          </div>

          {/* Overlapping Mascot and Badge Emblem */}
          <div className="absolute -bottom-10 left-0 right-0 flex justify-center z-20">
            <ChameleonMascot variant="full" size={130} brandText="Chameleon Comics" />
          </div>
        </div>

        {/* Form Area */}
        <div className="flex-1 px-6 pt-16 pb-8 flex flex-col justify-between z-10">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            
            {errorMessage && (
              <div className="p-3 text-xs font-bold text-[#1A1A1A] bg-[#FFE17D] border-2 border-[#1A1A1A] rounded-xl shadow-sm">
                {errorMessage}
              </div>
            )}

            {/* Your Email Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-extrabold text-[#1A1A1A] tracking-tight">
                Your email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white border-2 border-[#1A1A1A] text-sm text-[#1A1A1A] placeholder-[#8C8C8C] focus:outline-none focus:ring-2 focus:ring-[#2A4FCB] shadow-sm font-medium"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-extrabold text-[#1A1A1A] tracking-tight">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white border-2 border-[#1A1A1A] text-sm text-[#1A1A1A] placeholder-[#8C8C8C] focus:outline-none focus:ring-2 focus:ring-[#2A4FCB] shadow-sm font-medium pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8C8C] hover:text-[#1A1A1A]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  onClick={() => alert('Fitur reset kata sandi telah dikirim ke email kamu!')}
                  className="text-[11px] font-bold text-[#666] hover:text-[#1A1A1A] transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {/* Primary Action Button: "Log in ->" */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3.5 px-6 rounded-full bg-[#2A4FCB] hover:bg-[#203EA5] text-white font-extrabold text-sm tracking-wide border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#1A1A1A] transition-all flex items-center justify-center gap-3 group"
            >
              <span>{loading ? 'Processing...' : isRegisterMode ? 'Register Now' : 'Log in'}</span>
              <div className="w-6 h-6 rounded-full bg-white/20 border border-white/40 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ArrowRight className="w-3.5 h-3.5 text-white stroke-[3]" />
              </div>
            </button>

            {/* Secondary Action Button: "Don't have an account? Register!" */}
            <button
              type="button"
              onClick={() => setIsRegisterMode(!isRegisterMode)}
              className="w-full py-3 px-4 rounded-full bg-white hover:bg-[#FAF7F0] text-[#1A1A1A] font-extrabold text-xs tracking-tight border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#1A1A1A] transition-all text-center"
            >
              {isRegisterMode
                ? 'Already have an account? Log in!'
                : "Don't have an account? Register!"}
            </button>
          </form>

          {/* Quick Guest Access / Footer Note */}
          <div className="mt-6 text-center">
            <button
              onClick={handleGuestLogin}
              className="text-xs font-bold text-[#2E7D6E] hover:underline"
            >
              Masuk sebagai Tamu (Guest Mode) →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
