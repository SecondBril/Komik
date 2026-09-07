'use client';

import React from 'react';

interface DecorativeBlobsProps {
  variant?: 'login' | 'browse' | 'detail' | 'general';
}

export const DecorativeBlobs: React.FC<DecorativeBlobsProps> = ({ variant = 'general' }) => {
  if (variant === 'login') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
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
      </div>
    );
  }

  if (variant === 'browse') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Floating circles on browse screen */}
        <div className="absolute top-[28%] -right-6 w-20 h-20 rounded-full bg-[#F07850] border-2 border-[#1A1A1A] opacity-80" />
        <div className="absolute top-[48%] -left-4 w-16 h-16 rounded-full bg-[#E96379] border-2 border-[#1A1A1A] opacity-80" />
        <div className="absolute top-[72%] -right-8 w-24 h-24 rounded-full bg-[#9086F4] border-2 border-[#1A1A1A] opacity-80" />
        <div className="absolute -bottom-10 left-10 w-28 h-28 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] opacity-80" />
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[35%] -left-6 w-20 h-20 rounded-full bg-[#FF7BB0] border-2 border-[#1A1A1A] opacity-75" />
        <div className="absolute top-[52%] -right-8 w-28 h-28 rounded-full bg-[#F6C945] border-2 border-[#1A1A1A] opacity-90" />
        <div className="absolute top-[70%] -left-4 w-16 h-16 rounded-full bg-[#9086F4] border-2 border-[#1A1A1A] opacity-80" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute top-10 right-4 w-20 h-20 rounded-full bg-[#F6C945]/40 border-2 border-[#1A1A1A]/40" />
      <div className="absolute top-1/3 -left-6 w-24 h-24 rounded-full bg-[#E96379]/40 border-2 border-[#1A1A1A]/40" />
      <div className="absolute bottom-20 right-6 w-24 h-24 rounded-full bg-[#9086F4]/40 border-2 border-[#1A1A1A]/40" />
    </div>
  );
};
