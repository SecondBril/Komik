import {
  ComicAdaptation,
  FranchiseRelation,
  ComicRecommendation,
  ComicCharacter,
} from './types';

export interface AdaptationCandidate {
  start_chapter: number;
  end_chapter: number;
  anime_season?: string;
  anime_episode_range?: string;
  novel_chapter_range?: string;
  novel_volume?: string;
  arc_title?: string;
  note?: string;
  source: 'mangaupdates' | 'anilist' | 'inferred';
}

export interface FullComicRelationsResult {
  title: string;
  adaptationCandidates: AdaptationCandidate[];
  franchiseRelations: FranchiseRelation[];
  recommendations: ComicRecommendation[];
  characters: ComicCharacter[];
  sourcesUsed: ('AniList' | 'MangaUpdates' | 'Kitsu')[];
}

/**
 * Normalizes relation type string across AniList & MangaUpdates
 */
function normalizeRelationType(
  rawType: string,
  format?: string
): FranchiseRelation['relation_type'] {
  const norm = (rawType || '').toLowerCase().trim();
  const fmt = (format || '').toUpperCase();

  if (fmt === 'NOVEL' || norm.includes('novel') || norm.includes('adapted from') || norm === 'source') {
    return 'novel';
  }
  if (fmt === 'TV' || fmt === 'MOVIE' || fmt === 'OVA' || norm.includes('anime') || norm === 'adaptation') {
    return 'anime';
  }
  if (norm.includes('sequel')) return 'sequel';
  if (norm.includes('prequel')) return 'prequel';
  if (norm.includes('spin')) return 'spinoff';
  if (norm.includes('side')) return 'side_story';
  if (norm.includes('alt')) return 'alternative';
  return 'other';
}

/**
 * Parses MangaUpdates Anime start/end chapter strings
 */
function parseMangaUpdatesAnimeRange(
  startStr?: string | null,
  endStr?: string | null
): AdaptationCandidate[] {
  if (!startStr && !endStr) return [];

  const candidates: AdaptationCandidate[] = [];
  const starts = (startStr || '').split('/').map((s) => s.trim());
  const ends = (endStr || '').split('/').map((s) => s.trim());
  const count = Math.max(starts.length, ends.length);

  for (let i = 0; i < count; i++) {
    const s = starts[i] || starts[0] || '';
    const e = ends[i] || ends[0] || '';

    const startMatch = s.match(/(?:chap|chapter)\s*(\d+(?:\.\d+)?)/i);
    const endMatch = e.match(/(?:chap|chapter)\s*(\d+(?:\.\d+)?)/i);

    const seasonMatch = (s + ' ' + e).match(/(?:s|season)\s*(\d+)/i);
    const seasonNumber = seasonMatch ? seasonMatch[1] : String(i + 1);

    const startNum = startMatch ? parseFloat(startMatch[1]) : 1;
    const endNum = endMatch ? parseFloat(endMatch[1]) : startNum + 40;

    candidates.push({
      start_chapter: Math.max(1, startNum),
      end_chapter: Math.max(startNum, endNum),
      anime_season: `Season ${seasonNumber}`,
      anime_episode_range: `Season ${seasonNumber}`,
      novel_chapter_range: '',
      arc_title: `Anime Season ${seasonNumber} Arc`,
      note: `Parsed from MangaUpdates (Ch. ${startNum} - ${endNum})`,
      source: 'mangaupdates',
    });
  }

  return candidates;
}

/**
 * Fetch detailed MangaUpdates series info (Anime chapter ranges + Franchise relations)
 */
export async function fetchMangaUpdatesDetails(title: string): Promise<{
  animeRanges: AdaptationCandidate[];
  relatedSeries: FranchiseRelation[];
}> {
  try {
    const cleanTitle = title.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanTitle) return { animeRanges: [], relatedSeries: [] };

    const searchRes = await fetch('https://api.mangaupdates.com/v1/series/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: cleanTitle, stype: 'title', perpage: 3 }),
      cache: 'no-store',
    });

    if (!searchRes.ok) return { animeRanges: [], relatedSeries: [] };
    const searchData = await searchRes.json();
    const seriesId = searchData.results?.[0]?.record?.series_id;

    if (!seriesId) return { animeRanges: [], relatedSeries: [] };

    const detailRes = await fetch(`https://api.mangaupdates.com/v1/series/${seriesId}`, {
      cache: 'no-store',
    });
    if (!detailRes.ok) return { animeRanges: [], relatedSeries: [] };

    const detail = await detailRes.json();
    const animeRanges = parseMangaUpdatesAnimeRange(detail.anime?.start, detail.anime?.end);

    const relatedSeries: FranchiseRelation[] = [];
    if (Array.isArray(detail.related_series)) {
      for (const rel of detail.related_series) {
        if (!rel.related_series_name) continue;
        relatedSeries.push({
          id: rel.related_series_id,
          title: rel.related_series_name,
          relation_type: normalizeRelationType(rel.relation_type),
          format: rel.relation_type?.toLowerCase().includes('novel') ? 'NOVEL' : 'MANGA',
          source: 'MangaUpdates',
          url: rel.related_series_url,
        });
      }
    }

    return { animeRanges, relatedSeries };
  } catch (err) {
    console.warn('[MangaUpdates] Error fetching details:', err);
    return { animeRanges: [], relatedSeries: [] };
  }
}

/**
 * Fetch AniList GraphQL rich relations, characters, and recommendations
 */
export async function fetchAniListFull(title: string): Promise<{
  animeList: { title: string; format: string; episodes?: number; status: string }[];
  novel?: { title: string; chapters?: number };
  franchiseRelations: FranchiseRelation[];
  recommendations: ComicRecommendation[];
  characters: ComicCharacter[];
}> {
  const cleanTitle = title.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanTitle) {
    return { animeList: [], franchiseRelations: [], recommendations: [], characters: [] };
  }

  const query = `
    query ($search: String) {
      Media(search: $search, type: MANGA) {
        title { english romaji }
        characters(perPage: 6, sort: [ROLE, RELEVANCE]) {
          edges {
            role
            node {
              name { full native }
              image { medium }
            }
          }
        }
        relations {
          edges {
            relationType
            node {
              id
              title { english romaji }
              type
              format
              status
              coverImage { medium }
            }
          }
        }
        recommendations(perPage: 8, sort: [RATING_DESC]) {
          nodes {
            mediaRecommendation {
              id
              title { english romaji }
              format
              coverImage { medium }
              averageScore
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { search: cleanTitle } }),
      cache: 'no-store',
    });

    if (!res.ok) {
      return { animeList: [], franchiseRelations: [], recommendations: [], characters: [] };
    }

    const data = await res.json();
    const media = data.data?.Media;
    if (!media) {
      return { animeList: [], franchiseRelations: [], recommendations: [], characters: [] };
    }

    const animeList: any[] = [];
    let novel: any = undefined;
    const franchiseRelations: FranchiseRelation[] = [];

    // Process relations
    const relEdges = media.relations?.edges || [];
    for (const edge of relEdges) {
      const node = edge.node;
      const relTitle = node.title?.english || node.title?.romaji || 'Unknown';
      const relType = normalizeRelationType(edge.relationType, node.format);

      if (node.type === 'ANIME') {
        animeList.push({
          title: relTitle,
          format: node.format,
          episodes: node.episodes || undefined,
          status: node.status,
        });
      } else if (node.format === 'NOVEL' || edge.relationType === 'SOURCE') {
        novel = {
          title: relTitle,
          chapters: node.chapters || undefined,
        };
      }

      franchiseRelations.push({
        id: node.id,
        title: relTitle,
        relation_type: relType,
        format: node.format || (node.type === 'ANIME' ? 'ANIME' : 'MANGA'),
        cover_url: node.coverImage?.medium,
        source: 'AniList',
      });
    }

    // Process recommendations
    const recNodes = media.recommendations?.nodes || [];
    const recommendations: ComicRecommendation[] = [];
    for (const rec of recNodes) {
      const target = rec.mediaRecommendation;
      if (!target) continue;
      const recTitle = target.title?.english || target.title?.romaji;
      if (!recTitle) continue;

      recommendations.push({
        id: target.id,
        title: recTitle,
        cover_url: target.coverImage?.medium,
        format: target.format,
        rating: target.averageScore ? Number((target.averageScore / 20).toFixed(2)) : undefined,
      });
    }

    // Process characters
    const charEdges = media.characters?.edges || [];
    const characters: ComicCharacter[] = [];
    for (const edge of charEdges) {
      const node = edge.node;
      if (!node?.name?.full) continue;
      characters.push({
        name: node.name.full,
        native_name: node.name.native || undefined,
        role: edge.role === 'MAIN' ? 'MAIN' : 'SUPPORTING',
        image_url: node.image?.medium || undefined,
      });
    }

    return { animeList, novel, franchiseRelations, recommendations, characters };
  } catch (err) {
    console.warn('[AniList Full] Error:', err);
    return { animeList: [], franchiseRelations: [], recommendations: [], characters: [] };
  }
}

/**
 * Fetch Legacy candidates helper for admin auto-enrich modal
 */
export async function generateAdaptationCandidates(
  title: string
): Promise<{
  candidates: AdaptationCandidate[];
  relations: {
    animeList: { title: string; format: string; episodes?: number; status: string }[];
    novel?: { title: string; chapters?: number };
  };
}> {
  const [muData, alData] = await Promise.all([
    fetchMangaUpdatesDetails(title),
    fetchAniListFull(title),
  ]);

  const candidates = muData.animeRanges;
  const relations = { animeList: alData.animeList, novel: alData.novel };

  if (candidates.length > 0 && relations.animeList.length > 0) {
    candidates.forEach((cand, idx) => {
      const matchedAnime = relations.animeList[idx] || relations.animeList[0];
      if (matchedAnime) {
        if (matchedAnime.episodes) {
          cand.anime_episode_range = `Episode 1 - ${matchedAnime.episodes}`;
        }
        cand.note = `Anime: ${matchedAnime.title} (${matchedAnime.status})`;
      }
      if (relations.novel) {
        cand.novel_volume = relations.novel.title;
      }
    });
  } else if (candidates.length === 0 && relations.animeList.length > 0) {
    relations.animeList.forEach((anime, idx) => {
      candidates.push({
        start_chapter: idx === 0 ? 1 : idx * 45 + 1,
        end_chapter: idx === 0 ? 45 : (idx + 1) * 45,
        anime_season: `Season ${idx + 1}`,
        anime_episode_range: anime.episodes ? `Episode 1 - ${anime.episodes}` : 'Season 1',
        novel_chapter_range: '',
        arc_title: `${anime.title}`,
        note: `Status: ${anime.status}`,
        source: 'inferred',
      });
    });
  }

  return { candidates, relations };
}

/**
 * Complete Multi-Source Aggregator for Comic Detail Page & Admin
 */
export async function fetchFullComicRelations(title: string): Promise<FullComicRelationsResult> {
  const sourcesUsed: ('AniList' | 'MangaUpdates' | 'Kitsu')[] = [];

  const [muData, alData] = await Promise.all([
    fetchMangaUpdatesDetails(title),
    fetchAniListFull(title),
  ]);

  if (alData.franchiseRelations.length > 0 || alData.recommendations.length > 0) {
    sourcesUsed.push('AniList');
  }
  if (muData.animeRanges.length > 0 || muData.relatedSeries.length > 0) {
    sourcesUsed.push('MangaUpdates');
  }

  // Combine and deduplicate franchise relations
  const seenTitles = new Set<string>();
  const combinedFranchise: FranchiseRelation[] = [];

  const addRelation = (rel: FranchiseRelation) => {
    const key = rel.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      combinedFranchise.push(rel);
    }
  };

  // Prioritize AniList for posters, then MangaUpdates for community relations
  alData.franchiseRelations.forEach(addRelation);
  muData.relatedSeries.forEach(addRelation);

  // Adaptation candidates
  const candidatesResult = await generateAdaptationCandidates(title);

  return {
    title,
    adaptationCandidates: candidatesResult.candidates,
    franchiseRelations: combinedFranchise,
    recommendations: alData.recommendations,
    characters: alData.characters,
    sourcesUsed,
  };
}
