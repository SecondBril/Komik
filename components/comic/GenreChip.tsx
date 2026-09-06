'use client';

import React from 'react';

interface GenreChipProps {
  label: string;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export const GenreChip: React.FC<GenreChipProps> = ({
  label,
  isSelected = false,
  onClick,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 whitespace-nowrap ${
        isSelected
          ? 'bg-[#7C5CFC] text-white border-[#7C5CFC] shadow-md shadow-[#7C5CFC]/20'
          : 'bg-[#171A21] text-[#9AA0AC] border-[#2A2F3A] hover:border-[#7C5CFC]/40 hover:text-[#F2F3F5]'
      } ${className}`}
    >
      {label}
    </button>
  );
};
