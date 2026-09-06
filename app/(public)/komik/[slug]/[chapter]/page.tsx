'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getComicBySlug } from '@/lib/queries/comics';
import { getComicChapters, getChapterPages, getChapterByNumber } from '@/lib/queries/chapters';
import { saveReadingHistory } from '@/lib/queries/history';
import { Comic, Chapter, ChapterPage } from '@/lib/types';
import { ViewerScroll } from '@/components/reader/ViewerScroll';
import { ViewerPaged } from '@/components/reader/ViewerPaged';
import { ChapterNav } from '@/components/reader/ChapterNav';
import { BookOpen } from 'lucide-react';

export default function ReadingViewerPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const chapterNo = Number(params?.chapter);

  const [comic, setComic] = useState<Comic | null>(null);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [pages, setPages] = useState<ChapterPage[]>([]);
  const [readMode, setReadMode] = useState<'scroll' | 'paged'>('scroll');
  const [containerWidth, setContainerWidth] = useState<'normal' | 'large' | 'full'>('large');
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [loading, setLoading] = useState(true);

  // Auto-hide navigation on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 50 && currentScrollY > lastScrollY) {
        setIsNavVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setIsNavVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    async function loadData() {
      if (!slug || isNaN(chapterNo)) return;
      setLoading(true);

      const comicData = await getComicBySlug(slug);
      setComic(comicData);

      if (comicData) {
        // Set default reading mode based on comic type (Manhwa -> scroll, Manga -> paged)
        setReadMode(comicData.type === 'manhwa' ? 'scroll' : 'paged');
      }

      const chapterList = await getComicChapters(slug);
      setAllChapters(chapterList);

      const chapterData = await getChapterByNumber(slug, chapterNo);
      setCurrentChapter(chapterData);

      if (chapterData) {
        const pageList = await getChapterPages(chapterData.id);
        setPages(pageList);

        // Record reading history (Cloud & Local)
        if (comicData) {
          saveReadingHistory({
            comic_id: comicData.id,
            chapter_id: chapterData.id,
          });
        }
      }

      setLoading(false);
    }

    loadData();
  }, [slug, chapterNo]);

  if (loading || !comic || !currentChapter) {
    return (
      <div className="fixed inset-0 bg-[#0B0C0F] z-50 flex flex-col items-center justify-center text-[#F2F3F5] gap-3">
        <BookOpen className="w-10 h-10 text-[#7C5CFC] animate-pulse" />
        <p className="text-xs font-semibold text-[#9AA0AC]">Memuat halaman chapter...</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#0B0C0F] text-[#F2F3F5] pt-14 pb-20 select-none cursor-pointer"
      onClick={() => setIsNavVisible((prev) => !prev)}
    >
      <ChapterNav
        comicSlug={slug}
        comicTitle={comic.title}
        currentChapterNumber={chapterNo}
        allChapters={allChapters}
        readMode={readMode}
        onToggleReadMode={setReadMode}
        containerWidth={containerWidth}
        onToggleContainerWidth={setContainerWidth}
        isVisible={isNavVisible}
      />

      {readMode === 'scroll' ? (
        <ViewerScroll
          pages={pages}
          comicTitle={comic.title}
          chapterNumber={chapterNo}
          containerWidth={containerWidth}
          onScrollProgress={(progress) => {
            if (progress > 80 && comic && currentChapter) {
              saveReadingHistory({
                comic_id: comic.id,
                chapter_id: currentChapter.id,
                scroll_position: progress,
              });
            }
          }}
        />
      ) : (
        <ViewerPaged
          pages={pages}
          comicTitle={comic.title}
          chapterNumber={chapterNo}
        />
      )}
    </div>
  );
}
