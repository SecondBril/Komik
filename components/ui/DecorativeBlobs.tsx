'use client';

import React from 'react';

interface DecorativeBlobsProps {
  variant?: 'login' | 'browse' | 'detail' | 'general';
}

export const DecorativeBlobs: React.FC<DecorativeBlobsProps> = ({ variant = 'general' }) => {
  if (variant === 'login') {
    return (
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* Top-right yellow blob */}
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] opacity-90" />
        {/* Top-left small coral circle */}
        <div className="absolute top-16 left-3 w-8 h-8 rounded-full bg-[#E96379] border-2 border-[#1A1A1A]" />
        {/* Middle-right purple blob */}
        <div className="absolute top-[48%] -right-8 w-28 h-28 rounded-full bg-[#9086F4] border-2 border-[#1A1A1A] opacity-90" />
        {/* Middle-left pink/coral circle */}
        <div className="absolute top-[60%] -left-8 w-24 h-24 rounded-full bg-[#E96379] border-2 border-[#1A1A1A] opacity-90" />
        {/* Bottom-right orange blob */}
        <div className="absolute -bottom-10 right-4 w-36 h-36 rounded-full bg-[#F07850] border-2 border-[#1A1A1A] opacity-90" />
        {/* Bottom-left massive purple blob */}
        <div className="absolute -bottom-20 -left-20 w-52 h-52 rounded-full bg-[#FF7BB0]/30 border-2 border-[#1A1A1A]/40" />
        {/* Extra: top-center teal small */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#2E7D6E] border-2 border-[#1A1A1A] opacity-70" />
        {/* Extra: mid-right small coral */}
        <div className="absolute top-[30%] -right-3 w-10 h-10 rounded-full bg-[#E96379] border-2 border-[#1A1A1A] opacity-80" />
        {/* Extra: bottom-center yellow small */}
        <div className="absolute bottom-16 left-1/3 w-10 h-10 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] opacity-70" />
      </div>
    );
  }

  if (variant === 'browse') {
    return (
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* Right side */}
        <div className="absolute top-[10%] -right-8 w-20 h-20 rounded-full bg-[#F07850] border-2 border-[#1A1A1A] opacity-80" />
        <div className="absolute top-[28%] -right-4 w-12 h-12 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] opacity-70" />
        <div className="absolute top-[50%] -right-8 w-24 h-24 rounded-full bg-[#9086F4] border-2 border-[#1A1A1A] opacity-80" />
        <div className="absolute top-[72%] -right-6 w-16 h-16 rounded-full bg-[#E96379] border-2 border-[#1A1A1A] opacity-75" />
        {/* Left side */}
        <div className="absolute top-[18%] -left-6 w-16 h-16 rounded-full bg-[#2E7D6E] border-2 border-[#1A1A1A] opacity-70" />
        <div className="absolute top-[40%] -left-4 w-12 h-12 rounded-full bg-[#E96379] border-2 border-[#1A1A1A] opacity-80" />
        <div className="absolute top-[62%] -left-8 w-20 h-20 rounded-full bg-[#FF7BB0] border-2 border-[#1A1A1A] opacity-70" />
        <div className="absolute top-[82%] -left-4 w-14 h-14 rounded-full bg-[#F07850] border-2 border-[#1A1A1A] opacity-70" />
        {/* Bottom */}
        <div className="absolute -bottom-10 left-16 w-28 h-28 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] opacity-80" />
        <div className="absolute -bottom-6 right-24 w-16 h-16 rounded-full bg-[#9086F4] border-2 border-[#1A1A1A] opacity-70" />
        {/* Top */}
        <div className="absolute -top-4 left-32 w-14 h-14 rounded-full bg-[#E96379] border-2 border-[#1A1A1A] opacity-60" />
        <div className="absolute -top-2 right-40 w-8 h-8 rounded-full bg-[#2E7D6E] border-2 border-[#1A1A1A] opacity-60" />
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* Left side */}
        <div className="absolute top-[15%] -left-8 w-24 h-24 rounded-full bg-[#FF7BB0] border-2 border-[#1A1A1A] opacity-75" />
        <div className="absolute top-[35%] -left-6 w-16 h-16 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] opacity-70" />
        <div className="absolute top-[58%] -left-4 w-12 h-12 rounded-full bg-[#9086F4] border-2 border-[#1A1A1A] opacity-80" />
        <div className="absolute top-[78%] -left-8 w-20 h-20 rounded-full bg-[#E96379] border-2 border-[#1A1A1A] opacity-70" />
        {/* Right side */}
        <div className="absolute top-[8%] -right-8 w-20 h-20 rounded-full bg-[#F07850] border-2 border-[#1A1A1A] opacity-75" />
        <div className="absolute top-[28%] -right-6 w-28 h-28 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] opacity-90" />
        <div className="absolute top-[52%] -right-4 w-14 h-14 rounded-full bg-[#2E7D6E] border-2 border-[#1A1A1A] opacity-70" />
        <div className="absolute top-[70%] -right-8 w-24 h-24 rounded-full bg-[#9086F4] border-2 border-[#1A1A1A] opacity-75" />
        {/* Bottom decorations */}
        <div className="absolute -bottom-8 left-20 w-24 h-24 rounded-full bg-[#FF7BB0]/40 border-2 border-[#1A1A1A]/30" />
        <div className="absolute -bottom-4 right-32 w-16 h-16 rounded-full bg-[#F6C945]/50 border-2 border-[#1A1A1A]/30" />
      </div>
    );
  }

  // General (default) — used on history and other misc pages
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      {/* Top area */}
      <div className="absolute -top-4 right-8 w-20 h-20 rounded-full bg-[#F6C945]/50 border-2 border-[#1A1A1A]/40" />
      <div className="absolute top-6 left-12 w-10 h-10 rounded-full bg-[#E96379]/40 border-2 border-[#1A1A1A]/40" />
      <div className="absolute top-2 -right-6 w-14 h-14 rounded-full bg-[#F07850]/40 border-2 border-[#1A1A1A]/30" />
      {/* Left side */}
      <div className="absolute top-1/4 -left-8 w-24 h-24 rounded-full bg-[#E96379]/40 border-2 border-[#1A1A1A]/40" />
      <div className="absolute top-[45%] -left-4 w-12 h-12 rounded-full bg-[#F6C945]/40 border-2 border-[#1A1A1A]/30" />
      <div className="absolute top-[65%] -left-6 w-16 h-16 rounded-full bg-[#FF7BB0]/35 border-2 border-[#1A1A1A]/30" />
      {/* Right side */}
      <div className="absolute top-[30%] -right-6 w-20 h-20 rounded-full bg-[#9086F4]/40 border-2 border-[#1A1A1A]/40" />
      <div className="absolute top-[55%] -right-4 w-14 h-14 rounded-full bg-[#F07850]/35 border-2 border-[#1A1A1A]/30" />
      {/* Bottom area */}
      <div className="absolute bottom-20 right-6 w-24 h-24 rounded-full bg-[#9086F4]/40 border-2 border-[#1A1A1A]/40" />
      <div className="absolute bottom-10 left-10 w-16 h-16 rounded-full bg-[#F6C945]/40 border-2 border-[#1A1A1A]/30" />
      <div className="absolute -bottom-6 right-20 w-20 h-20 rounded-full bg-[#E96379]/30 border-2 border-[#1A1A1A]/25" />
    </div>
  );
};
