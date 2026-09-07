'use client';

import React from 'react';

interface ChameleonMascotProps {
  className?: string;
  size?: number;
  variant?: 'full' | 'avatar' | 'mascotOnly' | 'badgeOnly';
  brandText?: string;
}

export const ChameleonMascot: React.FC<ChameleonMascotProps> = ({
  className = '',
  size = 120,
  variant = 'full',
  brandText = 'Chameleon Comics',
}) => {
  // 1. Avatar variant (circular icon for top-left header)
  if (variant === 'avatar') {
    return (
      <div
        className={`relative rounded-full bg-white border-2 border-[#1A1A1A] p-1.5 flex items-center justify-center overflow-hidden shadow-sm ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Branch */}
          <path
            d="M 10 75 Q 50 72 90 75"
            stroke="#1A1A1A"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="85" cy="70" r="4" fill="#69B578" stroke="#1A1A1A" strokeWidth="1.5" />
          
          {/* Chameleon Body */}
          <path
            d="M 28 68 C 15 50 32 30 55 30 C 72 30 84 40 84 55 C 84 68 70 72 50 72 C 38 72 30 70 28 68 Z"
            fill="#38A3A5"
            stroke="#1A1A1A"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          
          {/* Chameleon Tail curled */}
          <path
            d="M 32 66 C 22 66 16 60 16 52 C 16 44 24 44 26 48 C 28 52 24 56 22 56"
            stroke="#1A1A1A"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />

          {/* Spots on back */}
          <circle cx="46" cy="40" r="3.5" fill="#FFD84D" stroke="#1A1A1A" strokeWidth="1.5" />
          <circle cx="56" cy="38" r="3" fill="#E96379" stroke="#1A1A1A" strokeWidth="1.5" />
          <circle cx="65" cy="42" r="3" fill="#9086F4" stroke="#1A1A1A" strokeWidth="1.5" />
          <circle cx="48" cy="50" r="2.5" fill="#FF9F43" stroke="#1A1A1A" strokeWidth="1.5" />
          <circle cx="58" cy="49" r="3" fill="#57CC99" stroke="#1A1A1A" strokeWidth="1.5" />

          {/* Eye */}
          <circle cx="72" cy="45" r="9" fill="#FFFFFF" stroke="#1A1A1A" strokeWidth="2.5" />
          <circle cx="74" cy="45" r="4" fill="#1A1A1A" />
          <circle cx="75.5" cy="43.5" r="1.5" fill="#FFFFFF" />

          {/* Mouth Smile */}
          <path d="M 78 57 Q 73 60 68 58" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" />

          {/* Claws */}
          <path d="M 60 70 L 60 75" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
          <path d="M 45 70 L 45 75" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // 2. Full brand emblem with Mascot sitting on Branch & Yellow Badge
  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Mascot illustration */}
      <div className="relative -mb-3 z-10" style={{ width: size, height: size * 0.7 }}>
        <svg
          viewBox="0 0 200 130"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          {/* Branch / Twig */}
          <path
            d="M 20 102 Q 100 96 185 100"
            stroke="#1A1A1A"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Twig leaves */}
          <path
            d="M 175 92 C 185 85 192 90 188 98 C 182 98 178 95 175 92 Z"
            fill="#57CC99"
            stroke="#1A1A1A"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M 165 96 C 168 88 178 88 175 96 Z"
            fill="#80ED99"
            stroke="#1A1A1A"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Chameleon Main Body */}
          <path
            d="M 50 94 C 30 70 50 38 85 36 C 115 34 140 45 145 68 C 147 85 130 96 95 96 C 75 96 60 96 50 94 Z"
            fill="#38A3A5"
            stroke="#1A1A1A"
            strokeWidth="4"
            strokeLinejoin="round"
          />

          {/* Curled Spiral Tail */}
          <path
            d="M 55 92 C 40 92 25 80 25 65 C 25 50 38 48 44 55 C 48 62 42 70 36 68 C 32 66 33 60 36 60"
            stroke="#1A1A1A"
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Colorful chameleon spots */}
          <circle cx="70" cy="54" r="5.5" fill="#FFD84D" stroke="#1A1A1A" strokeWidth="2" />
          <circle cx="85" cy="50" r="5" fill="#E96379" stroke="#1A1A1A" strokeWidth="2" />
          <circle cx="102" cy="52" r="5.5" fill="#9086F4" stroke="#1A1A1A" strokeWidth="2" />
          <circle cx="118" cy="58" r="4.5" fill="#FF9F43" stroke="#1A1A1A" strokeWidth="2" />
          <circle cx="76" cy="68" r="4.5" fill="#FF7BB0" stroke="#1A1A1A" strokeWidth="2" />
          <circle cx="92" cy="66" r="5" fill="#57CC99" stroke="#1A1A1A" strokeWidth="2" />
          <circle cx="108" cy="68" r="4" fill="#FFD84D" stroke="#1A1A1A" strokeWidth="2" />

          {/* Cute Big Eye */}
          <circle cx="132" cy="58" r="14" fill="#FFFFFF" stroke="#1A1A1A" strokeWidth="3.5" />
          <circle cx="134" cy="58" r="6" fill="#1A1A1A" />
          <circle cx="136" cy="55.5" r="2.5" fill="#FFFFFF" />

          {/* Snout and smile */}
          <path
            d="M 144 72 Q 138 77 128 75"
            stroke="#1A1A1A"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Feet holding branch */}
          <path d="M 112 94 L 112 102" stroke="#1A1A1A" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M 88 94 L 88 102" stroke="#1A1A1A" strokeWidth="4.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Yellow pill badge with brand name */}
      <div className="relative px-6 py-2 rounded-2xl bg-[#F6C945] border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] flex items-center justify-center">
        <h1 className="text-lg sm:text-xl font-extrabold text-[#1A1A1A] tracking-tight font-sans">
          {brandText}
        </h1>
      </div>
    </div>
  );
};
