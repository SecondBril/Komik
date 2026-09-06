import React from 'react';
import { ComicType, ComicStatus } from '@/lib/types';

interface TypeBadgeProps {
  type: ComicType;
  className?: string;
}

export const TypeBadge: React.FC<TypeBadgeProps> = ({ type, className = '' }) => {
  const styles: Record<ComicType, { bg: string; label: string }> = {
    manga: { bg: 'bg-[#5B8DEF]', label: 'Manga' },
    manhwa: { bg: 'bg-[#7C5CFC]', label: 'Manhwa' },
    manhua: { bg: 'bg-[#F0A64E]', label: 'Manhua' },
  };

  const current = styles[type] || styles.manga;

  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 text-[10px] sm:text-xs font-bold text-white uppercase rounded-[4px] shadow-sm tracking-wider ${current.bg} ${className}`}
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
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full border ${
        isOngoing
          ? 'border-[#3DDC84]/30 text-[#3DDC84] bg-[#3DDC84]/10'
          : 'border-[#5B8DEF]/30 text-[#5B8DEF] bg-[#5B8DEF]/10'
      } ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isOngoing ? 'bg-[#3DDC84]' : 'bg-[#5B8DEF]'}`} />
      {isOngoing ? 'Ongoing' : 'Completed'}
    </span>
  );
};
