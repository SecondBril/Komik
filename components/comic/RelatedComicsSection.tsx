'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  GitBranch,
  Sparkles,
  ExternalLink,
  BookOpen,
  Film,
  Users,
  ChevronRight,
  Star,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  FranchiseRelation,
  ComicRecommendation,
  ComicCharacter,
} from '@/lib/types';

interface RelatedComicsSectionProps {
  comicSlug: string;
  comicTitle: string;
}

export function RelatedComicsSection({
  comicSlug,
  comicTitle,
}: RelatedComicsSectionProps) {
  const [activeTab, setActiveTab] = useState<'franchise' | 'recommendations' | 'characters'>('franchise');
  const [loading, setLoading] = useState(true);
  const [franchise, setFranchise] = useState<FranchiseRelation[]>([]);
  const [recommendations, setRecommendations] = useState<ComicRecommendation[]>([]);
  const [characters, setCharacters] = useState<ComicCharacter[]>([]);
  const [sources, setSources] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadRelations() {
      if (!comicSlug) return;
      setLoading(true);

      try {
        const res = await fetch(`/api/comics/${encodeURIComponent(comicSlug)}/relations`);
        const json = await res.json();

        if (isMounted && json.success && json.data) {
          const data = json.data;
          setFranchise(data.franchiseRelations || []);
          setRecommendations(data.recommendations || []);
          setCharacters(data.characters || []);
          setSources(data.sourcesUsed || []);

          // Auto-select first tab that has content
          if ((data.franchiseRelations || []).length === 0 && (data.recommendations || []).length > 0) {
            setActiveTab('recommendations');
          }
        }
      } catch (err) {
        console.warn('[RelatedComicsSection] Failed to load relations:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadRelations();

    return () => {
      isMounted = false;
    };
  }, [comicSlug]);

  if (loading) {
    return (
      <div className="w-full bg-white rounded-[32px] sm:rounded-[40px] border-[3px] border-[#1A1A1A] shadow-[6px_6px_0px_#1A1A1A] p-5 sm:p-7 flex flex-col gap-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FAF7F0] border-2 border-[#1A1A1A]" />
          <div className="h-5 w-48 bg-[#FAF7F0] rounded-xl" />
        </div>
        <div className="h-24 bg-[#FAF7F0] rounded-2xl border-2 border-[#1A1A1A]" />
      </div>
    );
  }

  const hasFranchise = franchise.length > 0;
  const hasRecs = recommendations.length > 0;
  const hasChars = characters.length > 0;

  if (!hasFranchise && !hasRecs && !hasChars) {
    return null;
  }

  const getRelationBadge = (type: FranchiseRelation['relation_type']) => {
    switch (type) {
      case 'sequel':
        return { label: 'Sekuel', bg: 'bg-[#EBF3FE]', text: 'text-[#2A4FCB]' };
      case 'prequel':
        return { label: 'Prekuel', bg: 'bg-[#FAF7F0]', text: 'text-[#1A1A1A]' };
      case 'novel':
        return { label: 'Original Novel', bg: 'bg-[#FFF8E1]', text: 'text-[#8C6200]' };
      case 'anime':
        return { label: 'Adaptasi Anime', bg: 'bg-[#EBF3FE]', text: 'text-[#2A4FCB]' };
      case 'spinoff':
        return { label: 'Spin-Off', bg: 'bg-[#F3E8FF]', text: 'text-[#6B21A8]' };
      case 'side_story':
        return { label: 'Side Story', bg: 'bg-[#FAF7F0]', text: 'text-[#2E7D6E]' };
      default:
        return { label: 'Terkait', bg: 'bg-[#FAF7F0]', text: 'text-[#1A1A1A]' };
    }
  };

  return (
    <section className="w-full bg-white rounded-[32px] sm:rounded-[40px] border-[3px] border-[#1A1A1A] shadow-[6px_6px_0px_#1A1A1A] p-5 sm:p-7 flex flex-col gap-4 overflow-hidden">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#1A1A1A]/10 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#F6C945] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center shrink-0">
            <GitBranch className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#1A1A1A] tracking-tight flex items-center gap-2">
              <span>Semesta, Relasi &amp; Komik Serupa</span>
            </h2>
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-[#7A756D] font-bold mt-0.5">
              <span>Data tervalidasi dari:</span>
              {sources.map((src) => (
                <span
                  key={src}
                  className="px-1.5 py-0.2 rounded-md bg-[#FAF7F0] border border-[#1A1A1A]/30 text-[#1A1A1A]"
                >
                  {src}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 bg-[#FAF7F0] p-1 rounded-2xl border-2 border-[#1A1A1A] self-start sm:self-auto overflow-x-auto max-w-full">
          {hasFranchise && (
            <button
              type="button"
              onClick={() => setActiveTab('franchise')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                activeTab === 'franchise'
                  ? 'bg-[#2E7D6E] text-white border border-[#1A1A1A] shadow-xs'
                  : 'text-[#7A756D] hover:text-[#1A1A1A]'
              }`}
            >
              Relasi Karya ({franchise.length})
            </button>
          )}

          {hasRecs && (
            <button
              type="button"
              onClick={() => setActiveTab('recommendations')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                activeTab === 'recommendations'
                  ? 'bg-[#2E7D6E] text-white border border-[#1A1A1A] shadow-xs'
                  : 'text-[#7A756D] hover:text-[#1A1A1A]'
              }`}
            >
              Komik Serupa ({recommendations.length})
            </button>
          )}

          {hasChars && (
            <button
              type="button"
              onClick={() => setActiveTab('characters')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                activeTab === 'characters'
                  ? 'bg-[#2E7D6E] text-white border border-[#1A1A1A] shadow-xs'
                  : 'text-[#7A756D] hover:text-[#1A1A1A]'
              }`}
            >
              Karakter ({characters.length})
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Franchise & Direct Relations */}
      {activeTab === 'franchise' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {franchise.map((item, idx) => {
            const badge = getRelationBadge(item.relation_type);
            const isLocal = Boolean(item.local_slug);

            return (
              <div
                key={item.id || idx}
                className="bg-[#FAF7F0] border-2 border-[#1A1A1A] rounded-2xl p-3.5 shadow-[3px_3px_0px_#1A1A1A] flex items-center justify-between gap-3 hover:bg-[#F6C945]/15 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-12 h-16 rounded-xl overflow-hidden bg-white border-2 border-[#1A1A1A] shadow-xs shrink-0 flex items-center justify-center">
                    {item.cover_url ? (
                      <Image
                        src={item.cover_url}
                        alt={item.title}
                        fill
                        className="object-cover"
                      />
                    ) : item.format === 'NOVEL' ? (
                      <BookOpen className="w-5 h-5 text-[#8C6200]" />
                    ) : (
                      <Film className="w-5 h-5 text-[#2A4FCB]" />
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full border border-[#1A1A1A] text-[9px] font-black uppercase tracking-wider w-max mb-1 ${badge.bg} ${badge.text}`}
                    >
                      {badge.label}
                    </span>
                    <h3 className="text-xs font-black text-[#1A1A1A] truncate group-hover:text-[#2E7D6E] transition-colors">
                      {item.title}
                    </h3>
                    <span className="text-[10px] text-[#7A756D] font-medium mt-0.5">
                      Format: <span className="font-bold">{item.format || 'Series'}</span>
                    </span>
                  </div>
                </div>

                {isLocal ? (
                  <Link
                    href={`/komik/${item.local_slug}`}
                    className="px-3 py-1.5 rounded-full bg-[#2E7D6E] hover:bg-[#256358] text-white text-[10px] font-black border border-[#1A1A1A] shadow-xs shrink-0 flex items-center gap-1 active:translate-y-0.5 transition-all"
                  >
                    <span>Baca</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                ) : item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full bg-white hover:bg-[#FAF7F0] border border-[#1A1A1A] shadow-xs text-[#7A756D] hover:text-[#1A1A1A] shrink-0 transition-colors"
                    title="Buka info luar"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Recommendations / Similar Comics */}
      {activeTab === 'recommendations' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-1">
          {recommendations.map((rec, idx) => {
            const isLocal = Boolean(rec.local_slug);
            const targetUrl = isLocal
              ? `/komik/${rec.local_slug}`
              : `/browse?q=${encodeURIComponent(rec.title)}`;

            return (
              <Link
                key={rec.id || idx}
                href={targetUrl}
                className="bg-[#FAF7F0] border-2 border-[#1A1A1A] rounded-2xl p-2.5 shadow-[2px_2px_0px_#1A1A1A] hover:shadow-[4px_4px_0px_#1A1A1A] hover:-translate-y-0.5 transition-all flex flex-col gap-2 group"
              >
                <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-white border-2 border-[#1A1A1A]">
                  {rec.cover_url ? (
                    <Image
                      src={rec.cover_url}
                      alt={rec.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#FAF7F0] text-[#7A756D]">
                      <BookOpen className="w-6 h-6" />
                    </div>
                  )}

                  {isLocal && (
                    <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-[#2E7D6E] text-white border border-[#1A1A1A] text-[8px] font-black shadow-xs">
                      Tersedia
                    </span>
                  )}
                </div>

                <div className="flex flex-col min-w-0">
                  <h3 className="text-xs font-black text-[#1A1A1A] truncate group-hover:text-[#2E7D6E] transition-colors">
                    {rec.title}
                  </h3>
                  {rec.rating && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-black text-[#1A1A1A]">
                      <Star className="w-3 h-3 fill-[#F6C945] stroke-[#1A1A1A]" />
                      <span>{rec.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Tab 3: Key Characters */}
      {activeTab === 'characters' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-1">
          {characters.map((ch, idx) => (
            <div
              key={idx}
              className="bg-[#FAF7F0] border-2 border-[#1A1A1A] rounded-2xl p-3 shadow-[2px_2px_0px_#1A1A1A] flex flex-col items-center text-center gap-2"
            >
              <div className="relative w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-[#1A1A1A] shadow-xs">
                {ch.image_url ? (
                  <Image
                    src={ch.image_url}
                    alt={ch.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#FAF7F0] text-[#7A756D]">
                    <Users className="w-6 h-6" />
                  </div>
                )}
              </div>

              <div className="min-w-0 w-full">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full border border-[#1A1A1A] text-[8px] font-black uppercase mb-1 ${
                    ch.role === 'MAIN'
                      ? 'bg-[#F6C945] text-[#1A1A1A]'
                      : 'bg-white text-[#7A756D]'
                  }`}
                >
                  {ch.role === 'MAIN' ? 'Protagonis' : 'Pendukung'}
                </span>
                <p className="text-xs font-black text-[#1A1A1A] truncate">
                  {ch.name}
                </p>
                {ch.native_name && (
                  <p className="text-[10px] text-[#7A756D] truncate mt-0.5 font-medium">
                    {ch.native_name}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </section>
  );
}
