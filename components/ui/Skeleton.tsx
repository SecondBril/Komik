import React from 'react';

export const SkeletonComicCard: React.FC = () => {
  return (
    <div className="flex flex-col rounded-lg overflow-hidden bg-[#171A21] border border-[#2A2F3A] animate-pulse">
      {/* Cover Skeleton 2:3 ratio */}
      <div className="w-full aspect-[2/3] skeleton-shimmer" />
      <div className="p-3 flex flex-col gap-2">
        <div className="w-12 h-4 rounded bg-[#1F232C] skeleton-shimmer" />
        <div className="w-3/4 h-4 rounded bg-[#1F232C] skeleton-shimmer" />
        <div className="w-1/2 h-3 rounded bg-[#1F232C] skeleton-shimmer" />
      </div>
    </div>
  );
};

export const SkeletonChapterList: React.FC = () => {
  return (
    <div className="flex flex-col gap-2 w-full">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="w-full h-12 rounded-lg bg-[#171A21] border border-[#2A2F3A] p-3 flex items-center justify-between skeleton-shimmer"
        >
          <div className="w-1/3 h-4 rounded bg-[#1F232C]" />
          <div className="w-20 h-3 rounded bg-[#1F232C]" />
        </div>
      ))}
    </div>
  );
};
