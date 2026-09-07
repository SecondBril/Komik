import React from 'react';
import { ComicType, ComicStatus } from '@/lib/types';

interface TypeBadgeProps {
  type: ComicType;
  className?: string;
}

export const TypeBadge: React.FC<TypeBadgeProps> = ({ type, className = '' }) => {
  const styles: Record<ComicType, { bg: string; text: string; label: string }> = {
    manga: { bg: 'bg-[#2A4FCB]', text: 'text-white', label: 'Manga' },
    manhwa: { bg: 'bg-[#2E7D6E]', text: 'text-white', label: 'Manhwa' },
    manhua: { bg: 'bg-[#F07850]', text: 'text-white', label: 'Manhua' },
  };

  const current = styles[type] || styles.manga;

  return (
    <span
      className={`inline-flex items-center justify-center px-2.5 py-0.5 text-[10px] sm:text-xs font-black uppercase rounded-full border border-[#1A1A1A] shadow-[1px_1px_0px_#1A1A1A] tracking-wide ${current.bg} ${current.text} ${className}`}
    >
      {current.label}
    </span>
  );
};

interface StatusBadgeProps {
  status: ComicStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const isOngoing = status === 'ongoing';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-0.5 text-xs font-bold rounded-full border border-[#1A1A1A] shadow-[1px_1px_0px_#1A1A1A] ${
        isOngoing
          ? 'bg-[#E6F4EA] text-[#137333]'
          : 'bg-[#E8F0FE] text-[#1A73E8]'
      } ${className}`}
    >
      <span className={`w-2 h-2 rounded-full ${isOngoing ? 'bg-[#34A853]' : 'bg-[#1A73E8]'}`} />
      {isOngoing ? 'Ongoing' : 'Completed'}
    </span>
  );
};

interface PriceBadgeProps {
  price?: string;
  className?: string;
}

export const PriceBadge: React.FC<PriceBadgeProps> = ({ price = '$3.50', className = '' }) => {
  return (
    <span
      className={`inline-flex items-center justify-center px-3 py-1 text-xs sm:text-sm font-black text-[#1A1A1A] bg-[#F6C945] rounded-full border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] ${className}`}
    >
      {price}
    </span>
  );
};
