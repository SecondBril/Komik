import React from 'react';
import { ComicType, ComicStatus } from '@/lib/types';

interface TypeBadgeProps {
  type: ComicType;
  size?: 'sm' | 'md';
  className?: string;
}

export const TypeBadge: React.FC<TypeBadgeProps> = ({ type, size = 'md', className = '' }) => {
  const styles: Record<ComicType, { bg: string; text: string; label: string }> = {
    manga: { bg: 'bg-[#2A4FCB]', text: 'text-white', label: 'Manga' },
    manhwa: { bg: 'bg-[#2E7D6E]', text: 'text-white', label: 'Manhwa' },
    manhua: { bg: 'bg-[#F07850]', text: 'text-white', label: 'Manhua' },
  };

  const current = styles[type] || styles.manga;

  const sizeStyle =
    size === 'sm'
      ? 'px-1.5 py-0.5 text-[9px] sm:text-[10px]'
      : 'px-2.5 py-0.5 text-[10px] sm:text-xs';

  return (
    <span
      className={`inline-flex items-center justify-center font-black uppercase rounded-full border border-[#1A1A1A] shadow-[1px_1px_0px_#1A1A1A] tracking-wide shrink-0 ${sizeStyle} ${current.bg} ${current.text} ${className}`}
    >
      {current.label}
    </span>
  );
};

interface StatusBadgeProps {
  status: ComicStatus | string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', className = '' }) => {
  const normalized = (status || '').toLowerCase();
  const isOngoing = normalized === 'ongoing';
  const isCompleted = normalized === 'completed';

  const colorStyle = isOngoing
    ? 'bg-[#E6F4EA] text-[#137333]'
    : isCompleted
    ? 'bg-[#E8F0FE] text-[#1A73E8]'
    : 'bg-[#FEF7E0] text-[#B06000]';

  const dotColor = isOngoing
    ? 'bg-[#34A853]'
    : isCompleted
    ? 'bg-[#1A73E8]'
    : 'bg-[#F9AB00]';

  const label = isOngoing
    ? 'Ongoing'
    : isCompleted
    ? 'Completed'
    : normalized === 'hiatus'
    ? 'Hiatus'
    : status;

  const sizeStyle =
    size === 'sm'
      ? 'px-1.5 py-0.5 text-[9px] sm:text-[10px] gap-1'
      : 'px-3 py-0.5 text-xs gap-1.5';

  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span
      className={`inline-flex items-center font-black rounded-full border border-[#1A1A1A] shadow-[1px_1px_0px_#1A1A1A] shrink-0 ${sizeStyle} ${colorStyle} ${className}`}
    >
      <span className={`rounded-full shrink-0 ${dotSize} ${dotColor}`} />
      <span className="truncate">{label}</span>
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
