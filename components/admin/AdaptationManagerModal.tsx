'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
  ComicAdaptation,
  FranchiseRelation,
  ComicRecommendation,
  ComicCharacter,
} from '@/lib/types';
import {
  Film,
  BookOpen,
  Sparkles,
  Plus,
  Trash2,
  Pencil,
  X,
  Loader2,
  Check,
  Layers,
  Save,
  GitBranch,
  RefreshCw,
  Star,
  Users,
} from 'lucide-react';

interface AdminComicInfo {
  id: string;
  title: string;
  slug: string;
  cover_url?: string;
  type?: string;
}

interface AdaptationManagerModalProps {
  comic: AdminComicInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export function AdaptationManagerModal({
  comic,
  isOpen,
  onClose,
  onNotify,
}: AdaptationManagerModalProps) {
  // Navigation tabs in modal
  const [modalTab, setModalTab] = useState<'adaptations' | 'franchise' | 'recommendations' | 'characters'>('adaptations');

  // Form references for smooth scrolling when clicking edit
  const adaptationFormRef = useRef<HTMLFormElement>(null);
  const franchiseFormRef = useRef<HTMLFormElement>(null);
  const recommendationFormRef = useRef<HTMLFormElement>(null);
  const characterFormRef = useRef<HTMLFormElement>(null);

  // ── Tab 1: Chapter Adaptation State ─────────────────────────────────────────
  const [adaptations, setAdaptations] = useState<ComicAdaptation[]>([]);
  const [loadingAdaptations, setLoadingAdaptations] = useState(false);
  const [autoFetching, setAutoFetching] = useState(false);
  const [candidateData, setCandidateData] = useState<any | null>(null);

  const [editingAdaptationId, setEditingAdaptationId] = useState<string | null>(null);
  const [adaptationForm, setAdaptationForm] = useState({
    start_chapter: '',
    end_chapter: '',
    anime_season: '',
    anime_episode_range: '',
    novel_volume: '',
    novel_chapter_range: '',
    arc_title: '',
    note: '',
  });
  const [isSavingAdaptation, setIsSavingAdaptation] = useState(false);
  const [isDeletingAdaptationId, setIsDeletingAdaptationId] = useState<string | null>(null);

  // ── Tab 2, 3, 4: Franchise, Recommendations, Characters State ──────────────
  const [franchiseRelations, setFranchiseRelations] = useState<FranchiseRelation[]>([]);
  const [recommendations, setRecommendations] = useState<ComicRecommendation[]>([]);
  const [characters, setCharacters] = useState<ComicCharacter[]>([]);
  const [sourcesUsed, setSourcesUsed] = useState<string[]>([]);
  const [loadingRelations, setLoadingRelations] = useState(false);
  const [isSyncingFromApi, setIsSyncingFromApi] = useState(false);
  const [isSavingRelations, setIsSavingRelations] = useState(false);

  // Forms for Tab 2: Franchise Relations (Add & Edit)
  const [editingRelationIndex, setEditingRelationIndex] = useState<number | null>(null);
  const [relationForm, setRelationForm] = useState({
    title: '',
    relation_type: 'sequel' as FranchiseRelation['relation_type'],
    format: 'MANGA',
    cover_url: '',
    url: '',
  });

  // Forms for Tab 3: Recommendations (Add & Edit)
  const [editingRecommendationIndex, setEditingRecommendationIndex] = useState<number | null>(null);
  const [recommendationForm, setRecommendationForm] = useState({
    title: '',
    rating: '4.5',
    cover_url: '',
    format: 'MANHWA',
  });

  // Forms for Tab 4: Characters (Add & Edit)
  const [editingCharacterIndex, setEditingCharacterIndex] = useState<number | null>(null);
  const [characterForm, setCharacterForm] = useState({
    name: '',
    native_name: '',
    role: 'MAIN' as 'MAIN' | 'SUPPORTING',
    image_url: '',
  });

  // ── Data Loaders ────────────────────────────────────────────────────────────

  const fetchAdaptations = useCallback(async () => {
    if (!comic?.id) return;
    setLoadingAdaptations(true);
    try {
      const res = await fetch(`/api/admin/adaptations?comicId=${comic.id}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAdaptations(json.data);
      }
    } catch (err) {
      console.error('[AdaptationManager] Failed to load adaptations:', err);
    } finally {
      setLoadingAdaptations(false);
    }
  }, [comic?.id]);

  const fetchRelationsCache = useCallback(async () => {
    if (!comic?.id) return;
    setLoadingRelations(true);
    try {
      const res = await fetch(`/api/admin/relations?comicId=${comic.id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setFranchiseRelations(json.data.franchise_relations || []);
        setRecommendations(json.data.recommendations || []);
        setCharacters(json.data.characters || []);
        setSourcesUsed(json.data.sources_used || []);
      }
    } catch (err) {
      console.error('[AdaptationManager] Failed to load relations cache:', err);
    } finally {
      setLoadingRelations(false);
    }
  }, [comic?.id]);

  useEffect(() => {
    if (isOpen && comic) {
      setModalTab('adaptations');
      resetAdaptationForm();
      resetRelationForm();
      resetRecommendationForm();
      resetCharacterForm();
      setCandidateData(null);
      fetchAdaptations();
      fetchRelationsCache();
    }
  }, [isOpen, comic, fetchAdaptations, fetchRelationsCache]);

  // ── Tab 1 Handlers (Adaptations) ───────────────────────────────────────────

  const resetAdaptationForm = () => {
    setEditingAdaptationId(null);
    setAdaptationForm({
      start_chapter: '',
      end_chapter: '',
      anime_season: '',
      anime_episode_range: '',
      novel_volume: '',
      novel_chapter_range: '',
      arc_title: '',
      note: '',
    });
  };

  const handleEditAdaptationClick = (item: ComicAdaptation) => {
    setEditingAdaptationId(item.id);
    setAdaptationForm({
      start_chapter: String(item.start_chapter),
      end_chapter: String(item.end_chapter),
      anime_season: item.anime_season || '',
      anime_episode_range: item.anime_episode_range || '',
      novel_volume: item.novel_volume || '',
      novel_chapter_range: item.novel_chapter_range || '',
      arc_title: item.arc_title || '',
      note: item.note || '',
    });
    adaptationFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSaveAdaptation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comic?.id) return;

    const start = Number(adaptationForm.start_chapter);
    const end = Number(adaptationForm.end_chapter);

    if (isNaN(start) || isNaN(end) || start < 0 || end < start) {
      onNotify('Chapter awal dan akhir harus berupa angka valid (Awal ≤ Akhir)');
      return;
    }

    setIsSavingAdaptation(true);
    try {
      if (editingAdaptationId) {
        const res = await fetch('/api/admin/adaptations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingAdaptationId,
            start_chapter: start,
            end_chapter: end,
            anime_season: adaptationForm.anime_season.trim() || null,
            anime_episode_range: adaptationForm.anime_episode_range.trim() || null,
            novel_volume: adaptationForm.novel_volume.trim() || null,
            novel_chapter_range: adaptationForm.novel_chapter_range.trim() || null,
            arc_title: adaptationForm.arc_title.trim() || null,
            note: adaptationForm.note.trim() || null,
          }),
        });
        const json = await res.json();
        if (json.success) {
          onNotify('Adaptasi berhasil diperbarui!');
          resetAdaptationForm();
          fetchAdaptations();
        } else {
          onNotify(`Gagal update: ${json.error}`);
        }
      } else {
        const res = await fetch('/api/admin/adaptations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comic_id: comic.id,
            start_chapter: start,
            end_chapter: end,
            anime_season: adaptationForm.anime_season.trim() || null,
            anime_episode_range: adaptationForm.anime_episode_range.trim() || null,
            novel_volume: adaptationForm.novel_volume.trim() || null,
            novel_chapter_range: adaptationForm.novel_chapter_range.trim() || null,
            arc_title: adaptationForm.arc_title.trim() || null,
            note: adaptationForm.note.trim() || null,
          }),
        });
        const json = await res.json();
        if (json.success) {
          onNotify('Rentang adaptasi baru berhasil ditambahkan!');
          resetAdaptationForm();
          fetchAdaptations();
        } else {
          onNotify(`Gagal simpan: ${json.error}`);
        }
      }
    } catch (err: any) {
      onNotify(`Error: ${err?.message || 'Server error'}`);
    } finally {
      setIsSavingAdaptation(false);
    }
  };

  const handleDeleteAdaptation = async (id: string) => {
    if (!confirm('Apakah kamu yakin ingin menghapus rentang adaptasi ini?')) return;
    setIsDeletingAdaptationId(id);
    try {
      const res = await fetch(`/api/admin/adaptations?id=${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        onNotify('Rentang adaptasi dihapus!');
        if (editingAdaptationId === id) resetAdaptationForm();
        fetchAdaptations();
      } else {
        onNotify(`Gagal hapus: ${json.error}`);
      }
    } catch (err: any) {
      onNotify(`Error: ${err?.message || 'Server error'}`);
    } finally {
      setIsDeletingAdaptationId(null);
    }
  };

  const handleAutoFetchCandidates = async () => {
    if (!comic?.title) return;
    setAutoFetching(true);
    setCandidateData(null);
    try {
      const res = await fetch(
        `/api/admin/adaptations?autoFetchTitle=${encodeURIComponent(comic.title)}`
      );
      const json = await res.json();
      if (json.success && json.data) {
        setCandidateData(json.data);
        onNotify(
          `Ditemukan ${json.data.candidates?.length || 0} rekomendasi dari MangaUpdates & AniList!`
        );
      } else {
        onNotify(json.error || 'Tidak menemukan data adaptasi otomatis');
      }
    } catch (err: any) {
      onNotify(`Gagal auto-fetch: ${err?.message || 'Server error'}`);
    } finally {
      setAutoFetching(false);
    }
  };

  const applyCandidate = (cand: any) => {
    setAdaptationForm({
      start_chapter: cand.start_chapter !== undefined ? String(cand.start_chapter) : '',
      end_chapter: cand.end_chapter !== undefined ? String(cand.end_chapter) : '',
      anime_season: cand.anime_season || '',
      anime_episode_range: cand.anime_episode_range || '',
      novel_volume: cand.novel_volume || '',
      novel_chapter_range: cand.novel_chapter_range || '',
      arc_title: cand.arc_title || '',
      note: cand.note || '',
    });
    onNotify('Data rekomendasi dimasukkan ke formulir input.');
    adaptationFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Database Persistence for Relations, Recommendations, Characters ───────

  const persistRelationsToDb = async (
    updatedFranchise: FranchiseRelation[],
    updatedRecs: ComicRecommendation[],
    updatedChars: ComicCharacter[]
  ) => {
    if (!comic?.id) return;
    setIsSavingRelations(true);
    try {
      const res = await fetch('/api/admin/relations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comic_id: comic.id,
          franchise_relations: updatedFranchise,
          recommendations: updatedRecs,
          characters: updatedChars,
          sources_used: sourcesUsed.includes('Admin') ? sourcesUsed : [...sourcesUsed, 'Admin'],
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFranchiseRelations(updatedFranchise);
        setRecommendations(updatedRecs);
        setCharacters(updatedChars);
      } else {
        onNotify(`Gagal menyimpan: ${json.error}`);
      }
    } catch (err: any) {
      onNotify(`Error: ${err?.message || 'Server error'}`);
    } finally {
      setIsSavingRelations(false);
    }
  };

  // ── Tab 2 Handlers (Franchise Relations Add & Edit) ─────────────────────────

  const resetRelationForm = () => {
    setEditingRelationIndex(null);
    setRelationForm({
      title: '',
      relation_type: 'sequel',
      format: 'MANGA',
      cover_url: '',
      url: '',
    });
  };

  const handleEditRelationClick = (index: number) => {
    const item = franchiseRelations[index];
    if (!item) return;
    setEditingRelationIndex(index);
    setRelationForm({
      title: item.title,
      relation_type: item.relation_type,
      format: item.format || 'MANGA',
      cover_url: item.cover_url || '',
      url: item.url || '',
    });
    franchiseFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSaveRelation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relationForm.title.trim()) {
      onNotify('Judul karya relasi harus diisi');
      return;
    }

    const item: FranchiseRelation = {
      title: relationForm.title.trim(),
      relation_type: relationForm.relation_type,
      format: relationForm.format,
      cover_url: relationForm.cover_url.trim() || undefined,
      url: relationForm.url.trim() || undefined,
      source: 'AniList',
    };

    let nextList: FranchiseRelation[];
    if (editingRelationIndex !== null) {
      nextList = [...franchiseRelations];
      nextList[editingRelationIndex] = {
        ...nextList[editingRelationIndex],
        ...item,
      };
    } else {
      nextList = [item, ...franchiseRelations];
    }

    await persistRelationsToDb(nextList, recommendations, characters);
    const wasEditing = editingRelationIndex !== null;
    resetRelationForm();
    onNotify(wasEditing ? 'Relasi karya berhasil diperbarui!' : 'Relasi karya baru ditambahkan ke Supabase!');
  };

  const handleDeleteRelation = async (index: number) => {
    if (!confirm('Hapus relasi karya ini dari database?')) return;
    const nextList = franchiseRelations.filter((_, idx) => idx !== index);
    await persistRelationsToDb(nextList, recommendations, characters);
    if (editingRelationIndex === index) resetRelationForm();
    onNotify('Relasi karya berhasil dihapus');
  };

  // ── Tab 3 Handlers (Recommendations Add & Edit) ────────────────────────────

  const resetRecommendationForm = () => {
    setEditingRecommendationIndex(null);
    setRecommendationForm({
      title: '',
      rating: '4.5',
      cover_url: '',
      format: 'MANHWA',
    });
  };

  const handleEditRecommendationClick = (index: number) => {
    const item = recommendations[index];
    if (!item) return;
    setEditingRecommendationIndex(index);
    setRecommendationForm({
      title: item.title,
      rating: String(item.rating ?? 4.5),
      cover_url: item.cover_url || '',
      format: item.format || 'MANHWA',
    });
    recommendationFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSaveRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recommendationForm.title.trim()) {
      onNotify('Judul komik rekomendasi harus diisi');
      return;
    }

    const item: ComicRecommendation = {
      title: recommendationForm.title.trim(),
      rating: parseFloat(recommendationForm.rating) || 4.5,
      cover_url: recommendationForm.cover_url.trim() || undefined,
      format: recommendationForm.format,
    };

    let nextList: ComicRecommendation[];
    if (editingRecommendationIndex !== null) {
      nextList = [...recommendations];
      nextList[editingRecommendationIndex] = {
        ...nextList[editingRecommendationIndex],
        ...item,
      };
    } else {
      nextList = [item, ...recommendations];
    }

    await persistRelationsToDb(franchiseRelations, nextList, characters);
    const wasEditing = editingRecommendationIndex !== null;
    resetRecommendationForm();
    onNotify(wasEditing ? 'Rekomendasi berhasil diperbarui!' : 'Rekomendasi baru ditambahkan ke Supabase!');
  };

  const handleDeleteRecommendation = async (index: number) => {
    if (!confirm('Hapus komik ini dari daftar rekomendasi?')) return;
    const nextList = recommendations.filter((_, idx) => idx !== index);
    await persistRelationsToDb(franchiseRelations, nextList, characters);
    if (editingRecommendationIndex === index) resetRecommendationForm();
    onNotify('Rekomendasi berhasil dihapus');
  };

  // ── Tab 4 Handlers (Characters Add & Edit) ──────────────────────────────────

  const resetCharacterForm = () => {
    setEditingCharacterIndex(null);
    setCharacterForm({
      name: '',
      native_name: '',
      role: 'MAIN',
      image_url: '',
    });
  };

  const handleEditCharacterClick = (index: number) => {
    const item = characters[index];
    if (!item) return;
    setEditingCharacterIndex(index);
    setCharacterForm({
      name: item.name,
      native_name: item.native_name || '',
      role: item.role || 'MAIN',
      image_url: item.image_url || '',
    });
    characterFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSaveCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!characterForm.name.trim()) {
      onNotify('Nama karakter harus diisi');
      return;
    }

    const item: ComicCharacter = {
      name: characterForm.name.trim(),
      native_name: characterForm.native_name.trim() || undefined,
      role: characterForm.role,
      image_url: characterForm.image_url.trim() || undefined,
    };

    let nextList: ComicCharacter[];
    if (editingCharacterIndex !== null) {
      nextList = [...characters];
      nextList[editingCharacterIndex] = {
        ...nextList[editingCharacterIndex],
        ...item,
      };
    } else {
      nextList = [item, ...characters];
    }

    await persistRelationsToDb(franchiseRelations, recommendations, nextList);
    const wasEditing = editingCharacterIndex !== null;
    resetCharacterForm();
    onNotify(wasEditing ? 'Karakter berhasil diperbarui!' : 'Karakter baru ditambahkan ke Supabase!');
  };

  const handleDeleteCharacter = async (index: number) => {
    if (!confirm('Hapus karakter ini dari database?')) return;
    const nextList = characters.filter((_, idx) => idx !== index);
    await persistRelationsToDb(franchiseRelations, recommendations, nextList);
    if (editingCharacterIndex === index) resetCharacterForm();
    onNotify('Karakter berhasil dihapus');
  };

  // ── Sync from API ──────────────────────────────────────────────────────────

  const handleSyncFromApi = async () => {
    if (!comic?.id) return;
    if (!confirm('Ambil ulang data relasi terbaru dari AniList & MangaUpdates dan perbarui database?')) return;

    setIsSyncingFromApi(true);
    try {
      const res = await fetch(`/api/admin/relations?action=sync&comicId=${comic.id}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success && json.data) {
        setFranchiseRelations(json.data.franchise_relations || []);
        setRecommendations(json.data.recommendations || []);
        setCharacters(json.data.characters || []);
        setSourcesUsed(json.data.sources_used || []);
        onNotify('Sinkronisasi ulang dari API berhasil disimpan ke database!');
      } else {
        onNotify(json.error || 'Gagal sinkronisasi');
      }
    } catch (err: any) {
      onNotify(`Gagal sync: ${err?.message || 'Server error'}`);
    } finally {
      setIsSyncingFromApi(false);
    }
  };

  if (!isOpen || !comic) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-[#FAF7F0] border-[3px] border-[#1A1A1A] rounded-[32px] shadow-[8px_8px_0px_#1A1A1A] flex flex-col overflow-hidden text-[#1A1A1A]">
        
        {/* Header Bar */}
        <div className="p-4 sm:px-6 bg-[#2E7D6E] text-white border-b-2 border-[#1A1A1A] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center shrink-0">
              <Film className="w-5 h-5 text-[#2E7D6E]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black tracking-tight truncate">
                Kelola Adaptasi &amp; Relasi Semesta
              </h3>
              <p className="text-xs text-white/90 truncate font-medium">
                Komik: <span className="font-bold underline">{comic.title}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncFromApi}
              disabled={isSyncingFromApi}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] text-xs font-black border-2 border-[#1A1A1A] shadow-xs active:translate-y-0.5 transition-all disabled:opacity-60"
              title="Tarik relasi & rekomendasi terbaru dari AniList + MangaUpdates"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFromApi ? 'animate-spin' : ''}`} />
              <span>{isSyncingFromApi ? 'Menyinkronkan...' : 'Sync dari API'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/30"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="bg-[#FAF7F0] border-b-2 border-[#1A1A1A] px-5 pt-3 pb-2 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setModalTab('adaptations')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all border-2 shrink-0 ${
              modalTab === 'adaptations'
                ? 'bg-[#2E7D6E] text-white border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                : 'bg-white text-[#7A756D] border-transparent hover:border-[#1A1A1A]/30'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Adaptasi Bab ({adaptations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setModalTab('franchise')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all border-2 shrink-0 ${
              modalTab === 'franchise'
                ? 'bg-[#2E7D6E] text-white border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                : 'bg-white text-[#7A756D] border-transparent hover:border-[#1A1A1A]/30'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Relasi Franchise ({franchiseRelations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setModalTab('recommendations')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all border-2 shrink-0 ${
              modalTab === 'recommendations'
                ? 'bg-[#2E7D6E] text-white border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                : 'bg-white text-[#7A756D] border-transparent hover:border-[#1A1A1A]/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Rekomendasi Serupa ({recommendations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setModalTab('characters')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all border-2 shrink-0 ${
              modalTab === 'characters'
                ? 'bg-[#2E7D6E] text-white border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                : 'bg-white text-[#7A756D] border-transparent hover:border-[#1A1A1A]/30'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Karakter ({characters.length})</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 1: ADAPTASI BAB (CHAPTER TO ANIME / NOVEL RANGES)
          ═══════════════════════════════════════════════════════════════════ */}
          {modalTab === 'adaptations' && (
            <div className="space-y-6">
              {/* Auto-Fetch Assistant Card */}
              <div className="bg-white border-2 border-[#1A1A1A] rounded-2xl p-4 shadow-[3px_3px_0px_#1A1A1A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-[#1A1A1A] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#2E7D6E]" />
                    Auto-Deteksi dari MangaUpdates &amp; AniList
                  </h4>
                  <p className="text-xs text-[#7A756D] font-medium mt-0.5">
                    Cari otomatis rentang chapter komik yang diadaptasi ke episode anime atau novel aslinya (100% Gratis).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAutoFetchCandidates}
                  disabled={autoFetching}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#F6C945] hover:bg-[#EDB72B] text-[#1A1A1A] text-xs font-black border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-60 shrink-0"
                >
                  {autoFetching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{autoFetching ? 'Mencari...' : 'Cari Data Adaptasi'}</span>
                </button>
              </div>

              {/* Candidate suggestions display if available */}
              {candidateData && (
                <div className="bg-[#EBF3FE] border-2 border-[#1A1A1A] rounded-2xl p-4 shadow-[3px_3px_0px_#1A1A1A] space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-[#2A4FCB] uppercase tracking-wider flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        Hasil Rekomendasi Multi-Source
                      </h4>
                      {candidateData.sourcesUsed && candidateData.sourcesUsed.length > 0 && (
                        <div className="flex items-center gap-1">
                          {candidateData.sourcesUsed.map((src: string) => (
                            <span key={src} className="px-1.5 py-0.2 rounded bg-white border border-[#1A1A1A]/30 text-[9px] font-black text-[#1A1A1A]">
                              {src}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCandidateData(null)}
                      className="text-xs text-[#7A756D] hover:text-[#1A1A1A] underline font-bold"
                    >
                      Tutup Hasil
                    </button>
                  </div>

                  {/* Candidate rows */}
                  {candidateData.candidates && candidateData.candidates.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {candidateData.candidates.map((cand: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-white border-2 border-[#1A1A1A] rounded-xl p-3 shadow-xs flex flex-col justify-between gap-2"
                        >
                          <div className="text-xs">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-black text-[#1A1A1A]">
                                Ch. {cand.start_chapter} &ndash; {cand.end_chapter}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-[#FAF7F0] border border-[#1A1A1A]/20 text-[9px] font-black text-[#7A756D] uppercase">
                                {cand.source || 'API'}
                              </span>
                            </div>

                            <div className="text-[11px] text-[#4A463F] space-y-0.5">
                              {cand.anime_season && (
                                <p className="truncate">
                                  <strong>Anime:</strong> {cand.anime_season} ({cand.anime_episode_range || 'Semua episode'})
                                </p>
                              )}
                              {cand.novel_volume && (
                                <p className="truncate">
                                  <strong>Novel:</strong> {cand.novel_volume} ({cand.novel_chapter_range ? `Ch. ${cand.novel_chapter_range}` : 'Full'})
                                </p>
                              )}
                              {cand.arc_title && (
                                <p className="truncate text-[#2E7D6E] font-bold">
                                  Arc: {cand.arc_title}
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => applyCandidate(cand)}
                            className="w-full py-1.5 rounded-lg bg-[#2E7D6E] hover:bg-[#256358] text-white text-xs font-black border border-[#1A1A1A] shadow-xs active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Gunakan Data Ini ke Form</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#7A756D] italic">
                      Tidak ada detail rentang chapter spesifik yang terdeteksi otomatis. Silakan isi form di bawah secara manual.
                    </p>
                  )}
                </div>
              )}

              {/* Form Tambah / Edit Rentang Adaptasi */}
              <form
                ref={adaptationFormRef}
                onSubmit={handleSaveAdaptation}
                className="bg-white border-2 border-[#1A1A1A] rounded-2xl p-5 shadow-[4px_4px_0px_#1A1A1A] space-y-3.5"
              >
                {/* Header with edit indication */}
                <div className="flex items-center justify-between border-b-2 border-[#1A1A1A]/10 pb-2">
                  <h4 className="text-sm font-black text-[#1A1A1A] flex items-center gap-2">
                    {editingAdaptationId ? (
                      <Pencil className="w-4 h-4 text-[#F6C945]" />
                    ) : (
                      <Plus className="w-4 h-4 text-[#2E7D6E]" />
                    )}
                    <span>{editingAdaptationId ? 'Edit Rentang Adaptasi Bab' : 'Tambah Rentang Adaptasi Manual'}</span>
                  </h4>
                  {editingAdaptationId && (
                    <button
                      type="button"
                      onClick={resetAdaptationForm}
                      className="px-2.5 py-1 rounded-full bg-[#FAF7F0] hover:bg-white border border-[#1A1A1A] text-[10px] font-black text-[#7A756D] hover:text-[#1A1A1A] flex items-center gap-1 transition-all"
                    >
                      <X className="w-3 h-3" />
                      <span>Batal Edit</span>
                    </button>
                  )}
                </div>

                {editingAdaptationId && (
                  <div className="bg-[#FFF8E1] border-2 border-[#1A1A1A] rounded-xl p-2.5 flex items-center justify-between shadow-xs">
                    <span className="text-xs font-bold text-[#8C6200]">
                      ✏️ Sedang mengedit adaptasi Chapter {adaptationForm.start_chapter} &ndash; {adaptationForm.end_chapter}
                    </span>
                    <span className="text-[10px] font-black text-[#8C6200] uppercase tracking-wider">
                      Mode Edit
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Chapter Mulai *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="1"
                      value={adaptationForm.start_chapter}
                      onChange={(e) => setAdaptationForm({ ...adaptationForm, start_chapter: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Chapter Selesai *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="25"
                      value={adaptationForm.end_chapter}
                      onChange={(e) => setAdaptationForm({ ...adaptationForm, end_chapter: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Anime Season
                    </label>
                    <input
                      type="text"
                      placeholder="Season 1"
                      value={adaptationForm.anime_season}
                      onChange={(e) => setAdaptationForm({ ...adaptationForm, anime_season: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Episode Anime
                    </label>
                    <input
                      type="text"
                      placeholder="Ep. 1 - 12"
                      value={adaptationForm.anime_episode_range}
                      onChange={(e) => setAdaptationForm({ ...adaptationForm, anime_episode_range: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Novel Volume
                    </label>
                    <input
                      type="text"
                      placeholder="Volume 1"
                      value={adaptationForm.novel_volume}
                      onChange={(e) => setAdaptationForm({ ...adaptationForm, novel_volume: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Bab Novel
                    </label>
                    <input
                      type="text"
                      placeholder="Bab 1 - 30"
                      value={adaptationForm.novel_chapter_range}
                      onChange={(e) => setAdaptationForm({ ...adaptationForm, novel_chapter_range: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Nama Arc (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: D-Rank Dungeon Arc"
                      value={adaptationForm.arc_title}
                      onChange={(e) => setAdaptationForm({ ...adaptationForm, arc_title: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                    Catatan Tambahan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Light novel canon adaptation"
                    value={adaptationForm.note}
                    onChange={(e) => setAdaptationForm({ ...adaptationForm, note: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  {editingAdaptationId && (
                    <button
                      type="button"
                      onClick={resetAdaptationForm}
                      className="px-4 py-2.5 rounded-full bg-white hover:bg-[#FAF7F0] text-[#1A1A1A] text-xs font-black border-2 border-[#1A1A1A] shadow-xs active:translate-x-[1px] active:translate-y-[1px] transition-all"
                    >
                      Batal
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSavingAdaptation}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2E7D6E] hover:bg-[#256358] text-white text-xs font-black border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50"
                  >
                    {isSavingAdaptation ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{editingAdaptationId ? 'Simpan Perubahan Adaptasi' : 'Tambah Rentang'}</span>
                  </button>
                </div>
              </form>

              {/* Existing Adaptations List */}
              <div className="space-y-3">
                <h4 className="text-sm font-black text-[#1A1A1A] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#2E7D6E]" />
                  Daftar Rentang Adaptasi Tersimpan ({adaptations.length})
                </h4>

                {loadingAdaptations ? (
                  <div className="p-8 text-center bg-white rounded-2xl border-2 border-[#1A1A1A]">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#2E7D6E] mb-2" />
                    <p className="text-xs font-bold text-[#7A756D]">Memuat data adaptasi...</p>
                  </div>
                ) : adaptations.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border-2 border-[#1A1A1A] text-xs font-bold text-[#7A756D]">
                    Belum ada data adaptasi untuk komik ini. Gunakan Auto-Deteksi di atas atau input manual.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {adaptations.map((item) => (
                      <div
                        key={item.id}
                        className={`bg-white border-2 border-[#1A1A1A] rounded-2xl p-4 shadow-[3px_3px_0px_#1A1A1A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                          editingAdaptationId === item.id ? 'ring-2 ring-[#2E7D6E] bg-[#F4F9F8]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-[#1A1A1A] text-[#F6C945] flex flex-col items-center justify-center font-black text-xs shrink-0 shadow-xs">
                            <span className="text-[9px] uppercase text-white">Ch</span>
                            <span>{item.start_chapter}-{item.end_chapter}</span>
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-[#1A1A1A]">
                                Chapter {item.start_chapter} &ndash; {item.end_chapter}
                              </span>
                              {item.arc_title && (
                                <span className="px-2 py-0.5 rounded-full bg-[#FAF7F0] border border-[#1A1A1A] text-[10px] font-black text-[#2E7D6E]">
                                  {item.arc_title}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap mt-1">
                              {(item.anime_season || item.anime_episode_range) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EBF3FE] border border-[#1A1A1A]/30 text-[10px] font-bold text-[#2A4FCB]">
                                  <Film className="w-3 h-3" />
                                  {item.anime_season ? `${item.anime_season} ` : ''}
                                  {item.anime_episode_range ? `(${item.anime_episode_range})` : ''}
                                </span>
                              )}

                              {(item.novel_volume || item.novel_chapter_range) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFF8E1] border border-[#1A1A1A]/30 text-[10px] font-bold text-[#8C6200]">
                                  <BookOpen className="w-3 h-3" />
                                  {item.novel_volume ? `${item.novel_volume} ` : ''}
                                  {item.novel_chapter_range ? `Ch. ${item.novel_chapter_range}` : ''}
                                </span>
                              )}

                              {item.note && (
                                <span className="text-[10px] text-[#7A756D] italic truncate max-w-xs">
                                  {item.note}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditAdaptationClick(item)}
                            className="p-2 rounded-full bg-[#FAF7F0] hover:bg-[#F6C945] border-2 border-[#1A1A1A] shadow-xs text-[#1A1A1A] active:translate-y-0.5 transition-all"
                            title="Edit Rentang Ini"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteAdaptation(item.id)}
                            disabled={isDeletingAdaptationId === item.id}
                            className="p-2 rounded-full bg-[#FFEAEA] hover:bg-[#FFD6D6] border-2 border-[#1A1A1A] shadow-xs text-[#C53030] active:translate-y-0.5 transition-all disabled:opacity-50"
                            title="Hapus Rentang Ini"
                          >
                            {isDeletingAdaptationId === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 2: RELASI FRANCHISE & SEMESTA (ADD & FULL EDIT)
          ═══════════════════════════════════════════════════════════════════ */}
          {modalTab === 'franchise' && (
            <div className="space-y-6">
              {/* Form Tambah / Edit Relasi */}
              <form
                ref={franchiseFormRef}
                onSubmit={handleSaveRelation}
                className="bg-white border-2 border-[#1A1A1A] rounded-2xl p-5 shadow-[4px_4px_0px_#1A1A1A] space-y-3.5"
              >
                <div className="flex items-center justify-between border-b-2 border-[#1A1A1A]/10 pb-2">
                  <h4 className="text-sm font-black text-[#1A1A1A] flex items-center gap-2">
                    {editingRelationIndex !== null ? (
                      <Pencil className="w-4 h-4 text-[#F6C945]" />
                    ) : (
                      <Plus className="w-4 h-4 text-[#2E7D6E]" />
                    )}
                    <span>
                      {editingRelationIndex !== null
                        ? `Edit Relasi Karya #${editingRelationIndex + 1}`
                        : 'Tambah Relasi Karya Baru (Sekuel, Prekuel, Novel, Anime, Spin-Off)'}
                    </span>
                  </h4>
                  {editingRelationIndex !== null && (
                    <button
                      type="button"
                      onClick={resetRelationForm}
                      className="px-2.5 py-1 rounded-full bg-[#FAF7F0] hover:bg-white border border-[#1A1A1A] text-[10px] font-black text-[#7A756D] hover:text-[#1A1A1A] flex items-center gap-1 transition-all"
                    >
                      <X className="w-3 h-3" />
                      <span>Batal Edit</span>
                    </button>
                  )}
                </div>

                {editingRelationIndex !== null && (
                  <div className="bg-[#FFF8E1] border-2 border-[#1A1A1A] rounded-xl p-2.5 flex items-center justify-between shadow-xs">
                    <span className="text-xs font-bold text-[#8C6200]">
                      ✏️ Sedang mengedit: &ldquo;{relationForm.title}&rdquo;
                    </span>
                    <span className="text-[10px] font-black text-[#8C6200] uppercase tracking-wider">
                      Mode Edit
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Judul Karya Terkait *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Solo Leveling: Ragnarok"
                      value={relationForm.title}
                      onChange={(e) => setRelationForm({ ...relationForm, title: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Tipe Relasi
                    </label>
                    <select
                      value={relationForm.relation_type}
                      onChange={(e) => setRelationForm({ ...relationForm, relation_type: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    >
                      <option value="sequel">Sekuel (Lanjutan)</option>
                      <option value="prequel">Prekuel (Kisah Terdahulu)</option>
                      <option value="novel">Original Web Novel</option>
                      <option value="anime">Adaptasi Anime</option>
                      <option value="spinoff">Spin-Off</option>
                      <option value="side_story">Side Story</option>
                      <option value="alternative">Versi Alternatif</option>
                      <option value="other">Lainnya / Semesta Sama</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Format Karya
                    </label>
                    <select
                      value={relationForm.format}
                      onChange={(e) => setRelationForm({ ...relationForm, format: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    >
                      <option value="MANGA">Manga / Manhwa</option>
                      <option value="NOVEL">Web Novel / Light Novel</option>
                      <option value="ANIME">Anime TV / Movie</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Cover URL (Opsional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={relationForm.cover_url}
                      onChange={(e) => setRelationForm({ ...relationForm, cover_url: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  {editingRelationIndex !== null && (
                    <button
                      type="button"
                      onClick={resetRelationForm}
                      className="px-4 py-2.5 rounded-full bg-white hover:bg-[#FAF7F0] text-[#1A1A1A] text-xs font-black border-2 border-[#1A1A1A] shadow-xs active:translate-x-[1px] active:translate-y-[1px] transition-all"
                    >
                      Batal
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSavingRelations}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2E7D6E] hover:bg-[#256358] text-white text-xs font-black border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50"
                  >
                    {isSavingRelations ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editingRelationIndex !== null ? (
                      <Save className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <span>
                      {editingRelationIndex !== null ? 'Simpan Perubahan Relasi' : 'Tambahkan Relasi ke Database'}
                    </span>
                  </button>
                </div>
              </form>

              {/* List of Franchise Relations */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-[#1A1A1A] flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-[#2E7D6E]" />
                    Daftar Relasi Tersimpan di Supabase ({franchiseRelations.length})
                  </h4>
                  {sourcesUsed.length > 0 && (
                    <span className="text-[10px] text-[#7A756D] font-bold">
                      Sumber: {sourcesUsed.join(', ')}
                    </span>
                  )}
                </div>

                {loadingRelations ? (
                  <div className="p-8 text-center bg-white rounded-2xl border-2 border-[#1A1A1A]">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#2E7D6E] mb-2" />
                    <p className="text-xs font-bold text-[#7A756D]">Memuat data relasi database...</p>
                  </div>
                ) : franchiseRelations.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border-2 border-[#1A1A1A] text-xs font-bold text-[#7A756D]">
                    Belum ada relasi franchise yang tersimpan. Kamu bisa tambah manual di atas atau klik &quot;Sync dari API&quot;.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {franchiseRelations.map((item, idx) => (
                      <div
                        key={idx}
                        className={`bg-white border-2 border-[#1A1A1A] rounded-2xl p-3.5 shadow-[3px_3px_0px_#1A1A1A] flex items-center justify-between gap-3 transition-all ${
                          editingRelationIndex === idx ? 'ring-2 ring-[#2E7D6E] bg-[#F4F9F8]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-12 h-16 rounded-xl overflow-hidden bg-[#FAF7F0] border-2 border-[#1A1A1A] shadow-xs shrink-0 flex items-center justify-center">
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
                            <span className="px-2 py-0.5 rounded-full bg-[#FAF7F0] border border-[#1A1A1A] text-[9px] font-black uppercase tracking-wider w-max mb-1 text-[#2E7D6E]">
                              {item.relation_type}
                            </span>
                            <h5 className="text-xs font-black text-[#1A1A1A] truncate max-w-[190px]">
                              {item.title}
                            </h5>
                            <span className="text-[10px] text-[#7A756D] font-medium mt-0.5">
                              Format: <span className="font-bold">{item.format || 'Series'}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditRelationClick(idx)}
                            className="p-2 rounded-full bg-[#FAF7F0] hover:bg-[#F6C945] border-2 border-[#1A1A1A] text-[#1A1A1A] shadow-xs transition-colors"
                            title="Edit relasi ini"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteRelation(idx)}
                            className="p-2 rounded-full bg-[#FFEAEA] hover:bg-[#FFD6D6] border-2 border-[#1A1A1A] text-[#C53030] shadow-xs transition-colors"
                            title="Hapus relasi ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 3: REKOMENDASI KOMIK SERUPA (ADD & FULL EDIT)
          ═══════════════════════════════════════════════════════════════════ */}
          {modalTab === 'recommendations' && (
            <div className="space-y-6">
              {/* Form Tambah / Edit Rekomendasi */}
              <form
                ref={recommendationFormRef}
                onSubmit={handleSaveRecommendation}
                className="bg-white border-2 border-[#1A1A1A] rounded-2xl p-5 shadow-[4px_4px_0px_#1A1A1A] space-y-3.5"
              >
                <div className="flex items-center justify-between border-b-2 border-[#1A1A1A]/10 pb-2">
                  <h4 className="text-sm font-black text-[#1A1A1A] flex items-center gap-2">
                    {editingRecommendationIndex !== null ? (
                      <Pencil className="w-4 h-4 text-[#F6C945]" />
                    ) : (
                      <Plus className="w-4 h-4 text-[#2E7D6E]" />
                    )}
                    <span>
                      {editingRecommendationIndex !== null
                        ? `Edit Rekomendasi #${editingRecommendationIndex + 1}`
                        : 'Tambah Rekomendasi Komik Serupa Manual'}
                    </span>
                  </h4>
                  {editingRecommendationIndex !== null && (
                    <button
                      type="button"
                      onClick={resetRecommendationForm}
                      className="px-2.5 py-1 rounded-full bg-[#FAF7F0] hover:bg-white border border-[#1A1A1A] text-[10px] font-black text-[#7A756D] hover:text-[#1A1A1A] flex items-center gap-1 transition-all"
                    >
                      <X className="w-3 h-3" />
                      <span>Batal Edit</span>
                    </button>
                  )}
                </div>

                {editingRecommendationIndex !== null && (
                  <div className="bg-[#FFF8E1] border-2 border-[#1A1A1A] rounded-xl p-2.5 flex items-center justify-between shadow-xs">
                    <span className="text-xs font-bold text-[#8C6200]">
                      ✏️ Sedang mengedit rekomendasi: &ldquo;{recommendationForm.title}&rdquo;
                    </span>
                    <span className="text-[10px] font-black text-[#8C6200] uppercase tracking-wider">
                      Mode Edit
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Judul Komik Serupa *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Omniscient Reader"
                      value={recommendationForm.title}
                      onChange={(e) => setRecommendationForm({ ...recommendationForm, title: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Rating Bintang (1 - 5)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      placeholder="4.5"
                      value={recommendationForm.rating}
                      onChange={(e) => setRecommendationForm({ ...recommendationForm, rating: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Format
                    </label>
                    <select
                      value={recommendationForm.format}
                      onChange={(e) => setRecommendationForm({ ...recommendationForm, format: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    >
                      <option value="MANHWA">Manhwa</option>
                      <option value="MANGA">Manga</option>
                      <option value="MANHUA">Manhua</option>
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Cover URL (Opsional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={recommendationForm.cover_url}
                      onChange={(e) => setRecommendationForm({ ...recommendationForm, cover_url: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  {editingRecommendationIndex !== null && (
                    <button
                      type="button"
                      onClick={resetRecommendationForm}
                      className="px-4 py-2.5 rounded-full bg-white hover:bg-[#FAF7F0] text-[#1A1A1A] text-xs font-black border-2 border-[#1A1A1A] shadow-xs active:translate-x-[1px] active:translate-y-[1px] transition-all"
                    >
                      Batal
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSavingRelations}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2E7D6E] hover:bg-[#256358] text-white text-xs font-black border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50"
                  >
                    {isSavingRelations ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editingRecommendationIndex !== null ? (
                      <Save className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <span>
                      {editingRecommendationIndex !== null ? 'Simpan Perubahan Rekomendasi' : 'Tambahkan ke Rekomendasi'}
                    </span>
                  </button>
                </div>
              </form>

              {/* List of Recommendations */}
              <div className="space-y-3">
                <h4 className="text-sm font-black text-[#1A1A1A] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#2E7D6E]" />
                  Daftar Komik Serupa Tersimpan di Database ({recommendations.length})
                </h4>

                {loadingRelations ? (
                  <div className="p-8 text-center bg-white rounded-2xl border-2 border-[#1A1A1A]">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#2E7D6E] mb-2" />
                    <p className="text-xs font-bold text-[#7A756D]">Memuat rekomendasi...</p>
                  </div>
                ) : recommendations.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border-2 border-[#1A1A1A] text-xs font-bold text-[#7A756D]">
                    Belum ada rekomendasi komik serupa yang tersimpan.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {recommendations.map((item, idx) => (
                      <div
                        key={idx}
                        className={`bg-white border-2 border-[#1A1A1A] rounded-2xl p-2.5 shadow-[2px_2px_0px_#1A1A1A] flex flex-col justify-between gap-2 transition-all ${
                          editingRecommendationIndex === idx ? 'ring-2 ring-[#2E7D6E] bg-[#F4F9F8]' : ''
                        }`}
                      >
                        <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-[#FAF7F0] border border-[#1A1A1A]">
                          {item.cover_url ? (
                            <Image
                              src={item.cover_url}
                              alt={item.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#7A756D]">
                              <BookOpen className="w-6 h-6" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h5 className="text-xs font-black text-[#1A1A1A] truncate" title={item.title}>
                            {item.title}
                          </h5>
                          {item.rating && (
                            <div className="flex items-center gap-1 mt-0.5 text-[10px] font-black text-[#1A1A1A]">
                              <Star className="w-3 h-3 fill-[#F6C945] stroke-[#1A1A1A]" />
                              <span>{item.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 w-full">
                          <button
                            type="button"
                            onClick={() => handleEditRecommendationClick(idx)}
                            className="flex-1 py-1 rounded-lg bg-[#FAF7F0] hover:bg-[#F6C945] border border-[#1A1A1A] text-[#1A1A1A] text-[10px] font-black flex items-center justify-center gap-1 transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecommendation(idx)}
                            className="flex-1 py-1 rounded-lg bg-[#FFEAEA] hover:bg-[#FFD6D6] border border-[#1A1A1A] text-[#C53030] text-[10px] font-black flex items-center justify-center gap-1 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 4: KARAKTER UTAMA & PENDUKUNG (ADD & FULL EDIT)
          ═══════════════════════════════════════════════════════════════════ */}
          {modalTab === 'characters' && (
            <div className="space-y-6">
              {/* Form Tambah / Edit Karakter */}
              <form
                ref={characterFormRef}
                onSubmit={handleSaveCharacter}
                className="bg-white border-2 border-[#1A1A1A] rounded-2xl p-5 shadow-[4px_4px_0px_#1A1A1A] space-y-3.5"
              >
                <div className="flex items-center justify-between border-b-2 border-[#1A1A1A]/10 pb-2">
                  <h4 className="text-sm font-black text-[#1A1A1A] flex items-center gap-2">
                    {editingCharacterIndex !== null ? (
                      <Pencil className="w-4 h-4 text-[#F6C945]" />
                    ) : (
                      <Plus className="w-4 h-4 text-[#2E7D6E]" />
                    )}
                    <span>
                      {editingCharacterIndex !== null
                        ? `Edit Karakter #${editingCharacterIndex + 1}`
                        : 'Tambah Karakter Baru (Utama / Pendukung)'}
                    </span>
                  </h4>
                  {editingCharacterIndex !== null && (
                    <button
                      type="button"
                      onClick={resetCharacterForm}
                      className="px-2.5 py-1 rounded-full bg-[#FAF7F0] hover:bg-white border border-[#1A1A1A] text-[10px] font-black text-[#7A756D] hover:text-[#1A1A1A] flex items-center gap-1 transition-all"
                    >
                      <X className="w-3 h-3" />
                      <span>Batal Edit</span>
                    </button>
                  )}
                </div>

                {editingCharacterIndex !== null && (
                  <div className="bg-[#FFF8E1] border-2 border-[#1A1A1A] rounded-xl p-2.5 flex items-center justify-between shadow-xs">
                    <span className="text-xs font-bold text-[#8C6200]">
                      ✏️ Sedang mengedit karakter: &ldquo;{characterForm.name}&rdquo;
                    </span>
                    <span className="text-[10px] font-black text-[#8C6200] uppercase tracking-wider">
                      Mode Edit
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Nama Karakter *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Sung Jin-woo"
                      value={characterForm.name}
                      onChange={(e) => setCharacterForm({ ...characterForm, name: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Nama Asli / Hangul (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 성진우"
                      value={characterForm.native_name}
                      onChange={(e) => setCharacterForm({ ...characterForm, native_name: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Peran Karakter
                    </label>
                    <select
                      value={characterForm.role}
                      onChange={(e) => setCharacterForm({ ...characterForm, role: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    >
                      <option value="MAIN">Karakter Utama (MAIN)</option>
                      <option value="SUPPORTING">Karakter Pendukung (SUPPORTING)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-black text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Foto Profil / Avatar URL (Opsional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={characterForm.image_url}
                      onChange={(e) => setCharacterForm({ ...characterForm, image_url: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-[#FAF7F0] border-2 border-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#2E7D6E]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  {editingCharacterIndex !== null && (
                    <button
                      type="button"
                      onClick={resetCharacterForm}
                      className="px-4 py-2.5 rounded-full bg-white hover:bg-[#FAF7F0] text-[#1A1A1A] text-xs font-black border-2 border-[#1A1A1A] shadow-xs active:translate-x-[1px] active:translate-y-[1px] transition-all"
                    >
                      Batal
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSavingRelations}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2E7D6E] hover:bg-[#256358] text-white text-xs font-black border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50"
                  >
                    {isSavingRelations ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editingCharacterIndex !== null ? (
                      <Save className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <span>
                      {editingCharacterIndex !== null ? 'Simpan Perubahan Karakter' : 'Tambahkan Karakter ke Database'}
                    </span>
                  </button>
                </div>
              </form>

              {/* List of Characters */}
              <div className="space-y-3">
                <h4 className="text-sm font-black text-[#1A1A1A] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#2E7D6E]" />
                  Daftar Karakter Tersimpan di Supabase ({characters.length})
                </h4>

                {loadingRelations ? (
                  <div className="p-8 text-center bg-white rounded-2xl border-2 border-[#1A1A1A]">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#2E7D6E] mb-2" />
                    <p className="text-xs font-bold text-[#7A756D]">Memuat data karakter...</p>
                  </div>
                ) : characters.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border-2 border-[#1A1A1A] text-xs font-bold text-[#7A756D]">
                    Belum ada karakter yang tersimpan. Gunakan form di atas untuk menambahkan karakter.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {characters.map((item, idx) => (
                      <div
                        key={idx}
                        className={`bg-white border-2 border-[#1A1A1A] rounded-2xl p-3 shadow-[3px_3px_0px_#1A1A1A] flex items-center justify-between gap-3 transition-all ${
                          editingCharacterIndex === idx ? 'ring-2 ring-[#2E7D6E] bg-[#F4F9F8]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#FAF7F0] border-2 border-[#1A1A1A] shadow-xs shrink-0 flex items-center justify-center">
                            {item.image_url ? (
                              <Image
                                src={item.image_url}
                                alt={item.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <Users className="w-6 h-6 text-[#7A756D]" />
                            )}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <span
                              className={`px-2 py-0.2 rounded-full border border-[#1A1A1A] text-[9px] font-black uppercase tracking-wider w-max mb-0.5 ${
                                item.role === 'MAIN'
                                  ? 'bg-[#E6F4EA] text-[#137333]'
                                  : 'bg-[#FAF7F0] text-[#7A756D]'
                              }`}
                            >
                              {item.role === 'MAIN' ? 'Utama' : 'Pendukung'}
                            </span>
                            <h5 className="text-xs font-black text-[#1A1A1A] truncate max-w-[150px]">
                              {item.name}
                            </h5>
                            {item.native_name && (
                              <span className="text-[10px] text-[#7A756D] font-medium truncate max-w-[150px]">
                                {item.native_name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditCharacterClick(idx)}
                            className="p-2 rounded-full bg-[#FAF7F0] hover:bg-[#F6C945] border-2 border-[#1A1A1A] text-[#1A1A1A] shadow-xs transition-colors"
                            title="Edit karakter ini"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteCharacter(idx)}
                            className="p-2 rounded-full bg-[#FFEAEA] hover:bg-[#FFD6D6] border-2 border-[#1A1A1A] text-[#C53030] shadow-xs transition-colors"
                            title="Hapus karakter ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-6 bg-[#FAF7F0] border-t-2 border-[#1A1A1A] flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-[#7A756D] font-medium">
            Perubahan langsung tersimpan di Supabase dan aktif pada halaman pembaca.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-white hover:bg-[#FAF7F0] text-[#1A1A1A] text-xs font-black border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] transition-all"
          >
            Selesai
          </button>
        </div>

      </div>
    </div>
  );
}
