import { slugify } from './utils/slugify';

export interface ComicMetadataResult {
  title: string;
  alt_titles: string[];
  type: 'manga' | 'manhwa' | 'manhua';
  synopsis: string;
  cover_url: string;
  author: string;
  artist?: string;
  status: 'ongoing' | 'completed';
  rating: number;
  genres: string[];
  sourceApi: 'anilist' | 'mangaupdates' | 'kitsu' | 'multi';
}

function cleanHtml(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Map country code or subtype to comic_type enum ('manga', 'manhwa', 'manhua')
 */
function normalizeComicType(countryOrSubtype?: string | null): 'manga' | 'manhwa' | 'manhua' {
  if (!countryOrSubtype) return 'manga';
  const val = countryOrSubtype.toUpperCase().trim();
  if (val === 'KR' || val === 'MANHWA') return 'manhwa';
  if (val === 'CN' || val === 'TW' || val === 'MANHUA') return 'manhua';
  return 'manga';
}

/**
 * Fetch top comic match from AniList GraphQL API (100% Free, English-focused)
 */
export async function fetchFromAniList(query: string): Promise<ComicMetadataResult | null> {
  const cleanQuery = query.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanQuery) return null;

  const gql = `
    query ($search: String) {
      Page(page: 1, perPage: 1) {
        media(search: $search, type: MANGA) {
          id
          title {
            romaji
            english
            native
          }
          synonyms
          description
          countryOfOrigin
          status
          averageScore
          genres
          coverImage {
            extraLarge
            large
          }
          staff(perPage: 8) {
            edges {
              role
              node {
                name {
                  full
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: gql,
        variables: { search: cleanQuery },
      }),
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const data = await res.json();
    const media = data.data?.Page?.media?.[0];
    if (!media) return null;

    // Prefer English title, fallback to Romaji
    const mainTitle = media.title.english || media.title.romaji || cleanQuery;

    // Collect all alternative titles & synonyms (deduplicated)
    const altSet = new Set<string>();
    if (media.title.romaji && media.title.romaji !== mainTitle) altSet.add(media.title.romaji);
    if (media.title.native) altSet.add(media.title.native);
    if (Array.isArray(media.synonyms)) {
      media.synonyms.forEach((s: string) => {
        if (s && s !== mainTitle) altSet.add(s);
      });
    }

    // Determine type (manga / manhwa / manhua)
    const comicType = normalizeComicType(media.countryOfOrigin);

    // Extract authors/artists
    const storyEdge = media.staff?.edges?.find((e: any) =>
      /story|author|creator|original/i.test(e.role)
    );
    const artEdge = media.staff?.edges?.find((e: any) =>
      /art/i.test(e.role)
    );

    let author = 'Unknown Author';
    const storyName = storyEdge?.node?.name?.full;
    const artName = artEdge?.node?.name?.full;

    if (storyName && artName && storyName !== artName) {
      author = `${storyName} / ${artName}`;
    } else if (storyName) {
      author = storyName;
    } else if (artName) {
      author = artName;
    }

    // Status: RELEASING, FINISHED, HIATUS, CANCELLED, NOT_YET_RELEASED
    const status: 'ongoing' | 'completed' =
      media.status === 'FINISHED' || media.status === 'CANCELLED' ? 'completed' : 'ongoing';

    // Rating: convert AniList 0-100 to 5-star scale e.g. 85 -> 4.25
    let rating = 4.5;
    if (media.averageScore) {
      rating = Number(Math.min(5.0, Math.max(1.0, media.averageScore / 20)).toFixed(2));
    }

    const coverUrl = media.coverImage?.extraLarge || media.coverImage?.large || '';
    const synopsis = cleanHtml(media.description);

    return {
      title: mainTitle,
      alt_titles: Array.from(altSet).slice(0, 10),
      type: comicType,
      synopsis,
      cover_url: coverUrl,
      author,
      status,
      rating,
      genres: Array.isArray(media.genres) ? media.genres : [],
      sourceApi: 'anilist',
    };
  } catch (err) {
    console.error('[AniList API] Error fetching metadata:', err);
    return null;
  }
}

/**
 * Fallback to Kitsu Manga API (100% Free, English-focused)
 */
export async function fetchFromKitsu(query: string): Promise<ComicMetadataResult | null> {
  const cleanQuery = query.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanQuery) return null;

  try {
    const url = `https://kitsu.io/api/edge/manga?filter[text]=${encodeURIComponent(cleanQuery)}&page[limit]=1`;
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.api+json' },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const data = await res.json();
    const item = data.data?.[0];
    if (!item || !item.attributes) return null;

    const attr = item.attributes;
    const mainTitle = attr.canonicalTitle || attr.titles?.en_us || attr.titles?.en || cleanQuery;

    const altSet = new Set<string>();
    if (attr.titles) {
      Object.values(attr.titles).forEach((t: any) => {
        if (typeof t === 'string' && t && t !== mainTitle) altSet.add(t);
      });
    }

    const comicType = normalizeComicType(attr.subtype);
    const status: 'ongoing' | 'completed' =
      attr.status === 'finished' ? 'completed' : 'ongoing';

    let rating = 4.5;
    if (attr.averageRating) {
      const parsed = parseFloat(attr.averageRating);
      if (!isNaN(parsed)) {
        rating = Number(Math.min(5.0, Math.max(1.0, parsed / 20)).toFixed(2));
      }
    }

    const coverUrl = attr.posterImage?.original || attr.posterImage?.large || '';
    const synopsis = cleanHtml(attr.synopsis);

    return {
      title: mainTitle,
      alt_titles: Array.from(altSet).slice(0, 10),
      type: comicType,
      synopsis,
      cover_url: coverUrl,
      author: 'Unknown Author',
      status,
      rating,
      genres: [],
      sourceApi: 'kitsu',
    };
  } catch (err) {
    console.error('[Kitsu API] Error fetching metadata:', err);
    return null;
  }
}

/**
 * Fetch series metadata from MangaUpdates API v1 (100% Free)
 */
export async function fetchFromMangaUpdates(query: string): Promise<ComicMetadataResult | null> {
  const cleanQuery = query.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanQuery) return null;

  try {
    const searchRes = await fetch('https://api.mangaupdates.com/v1/series/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: cleanQuery, stype: 'title', perpage: 3 }),
      cache: 'no-store',
    });

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const hit = searchData.results?.[0]?.record;
    if (!hit?.series_id) return null;

    const detailRes = await fetch(`https://api.mangaupdates.com/v1/series/${hit.series_id}`, {
      cache: 'no-store',
    });
    if (!detailRes.ok) return null;
    const series = await detailRes.json();

    const mainTitle = series.title || hit.title || cleanQuery;

    const altSet = new Set<string>();
    if (Array.isArray(series.associated)) {
      series.associated.forEach((a: any) => {
        if (a?.title && a.title !== mainTitle) altSet.add(a.title);
      });
    }

    const rawType = (series.type || hit.type || '').toLowerCase();
    const comicType: 'manga' | 'manhwa' | 'manhua' =
      rawType === 'manhwa' ? 'manhwa' : rawType === 'manhua' ? 'manhua' : 'manga';

    const authors = series.authors || [];
    const authorNames = authors.filter((a: any) => a.type === 'Author').map((a: any) => a.name);
    const artistNames = authors.filter((a: any) => a.type === 'Artist').map((a: any) => a.name);

    let authorStr = authorNames.join(', ') || 'Unknown Author';
    const artistStr = artistNames.join(', ');
    if (authorNames.length > 0 && artistNames.length > 0 && authorNames.join(',') !== artistNames.join(',')) {
      authorStr = `${authorNames[0]} / ${artistNames[0]}`;
    }

    const rawStatus = (series.status || '').toLowerCase();
    const status: 'ongoing' | 'completed' =
      rawStatus.includes('complete') ? 'completed' : 'ongoing';

    let rating = 4.5;
    if (series.bayesian_rating) {
      rating = Number(Math.min(5.0, Math.max(1.0, series.bayesian_rating / 2)).toFixed(2));
    }

    const coverUrl = series.image?.url?.original || hit.image?.url?.original || '';
    const synopsis = cleanHtml(series.description || hit.description);
    const genres: string[] = (series.genres || []).map((g: any) => g.genre).filter(Boolean);

    return {
      title: mainTitle,
      alt_titles: Array.from(altSet).slice(0, 15),
      type: comicType,
      synopsis,
      cover_url: coverUrl,
      author: authorStr,
      artist: artistStr || undefined,
      status,
      rating,
      genres,
      sourceApi: 'mangaupdates',
    };
  } catch (err) {
    console.warn('[MangaUpdates API] Error fetching metadata:', err);
    return null;
  }
}

/**
 * Primary Multi-Source Fetcher: combines AniList + MangaUpdates + Kitsu fallback
 */
export async function fetchComicMetadata(query: string): Promise<ComicMetadataResult | null> {
  const [anilist, mu] = await Promise.all([
    fetchFromAniList(query).catch(() => null),
    fetchFromMangaUpdates(query).catch(() => null),
  ]);

  if (anilist && mu) {
    // Merge into superior multi-source record
    const combinedAlt = new Set([...anilist.alt_titles, ...mu.alt_titles]);
    return {
      ...anilist,
      author: mu.author !== 'Unknown Author' ? mu.author : anilist.author,
      artist: mu.artist,
      alt_titles: Array.from(combinedAlt).slice(0, 15),
      genres: Array.from(new Set([...anilist.genres, ...mu.genres])),
      sourceApi: 'multi',
    };
  }

  if (anilist) return anilist;
  if (mu) return mu;

  // Fallback to Kitsu
  const kitsuResult = await fetchFromKitsu(query);
  if (kitsuResult) {
    return kitsuResult;
  }

  return null;
}

/**
 * Search multiple candidates for Admin UI Modal / Autocomplete
 */
export async function searchComicMetadataList(
  query: string,
  limit: number = 6
): Promise<ComicMetadataResult[]> {
  const cleanQuery = query.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanQuery) return [];

  const gql = `
    query ($search: String, $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(search: $search, type: MANGA) {
          id
          title {
            romaji
            english
            native
          }
          synonyms
          description
          countryOfOrigin
          status
          averageScore
          genres
          coverImage {
            extraLarge
            large
          }
          staff(perPage: 4) {
            edges {
              role
              node {
                name {
                  full
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: gql,
        variables: { search: cleanQuery, perPage: limit },
      }),
      cache: 'no-store',
    });

    if (!res.ok) return [];
    const data = await res.json();
    const mediaList = data.data?.Page?.media || [];

    return mediaList.map((media: any): ComicMetadataResult => {
      const mainTitle = media.title.english || media.title.romaji || cleanQuery;
      const altSet = new Set<string>();
      if (media.title.romaji && media.title.romaji !== mainTitle) altSet.add(media.title.romaji);
      if (media.title.native) altSet.add(media.title.native);
      if (Array.isArray(media.synonyms)) {
        media.synonyms.forEach((s: string) => {
          if (s && s !== mainTitle) altSet.add(s);
        });
      }

      const storyEdge = media.staff?.edges?.find((e: any) =>
        /story|author|creator|original/i.test(e.role)
      );
      const artEdge = media.staff?.edges?.find((e: any) =>
        /art/i.test(e.role)
      );

      let author = 'Unknown Author';
      const storyName = storyEdge?.node?.name?.full;
      const artName = artEdge?.node?.name?.full;

      if (storyName && artName && storyName !== artName) {
        author = `${storyName} / ${artName}`;
      } else if (storyName) {
        author = storyName;
      } else if (artName) {
        author = artName;
      }

      const rating = media.averageScore
        ? Number(Math.min(5.0, Math.max(1.0, media.averageScore / 20)).toFixed(2))
        : 4.5;

      return {
        title: mainTitle,
        alt_titles: Array.from(altSet).slice(0, 8),
        type: normalizeComicType(media.countryOfOrigin),
        synopsis: cleanHtml(media.description),
        cover_url: media.coverImage?.extraLarge || media.coverImage?.large || '',
        author,
        status: media.status === 'FINISHED' || media.status === 'CANCELLED' ? 'completed' : 'ongoing',
        rating,
        genres: Array.isArray(media.genres) ? media.genres : [],
        sourceApi: 'anilist',
      };
    });
  } catch (err) {
    console.error('[Comic Metadata Search] Error:', err);
    return [];
  }
}

/**
 * Helper to sync comic genres in Supabase
 */
export async function syncComicGenres(
  supabase: any,
  comicId: string,
  genreNames: string[]
): Promise<void> {
  if (!genreNames || genreNames.length === 0) return;

  try {
    // 1. Fetch existing genres
    const { data: existingGenres } = await supabase.from('genres').select('id, name, slug');
    const genreMap = new Map<string, number>();

    if (existingGenres) {
      for (const g of existingGenres) {
        genreMap.set(g.name.toLowerCase(), g.id);
        genreMap.set(g.slug.toLowerCase(), g.id);
      }
    }

    const matchedGenreIds: number[] = [];

    // 2. Insert missing genres
    for (const rawName of genreNames) {
      const trimmed = rawName.trim();
      if (!trimmed) continue;
      const normKey = trimmed.toLowerCase();

      if (genreMap.has(normKey)) {
        matchedGenreIds.push(genreMap.get(normKey)!);
      } else {
        const slug = slugify(trimmed);
        const { data: newGenre, error: insertGenreErr } = await supabase
          .from('genres')
          .insert({ name: trimmed, slug })
          .select('id')
          .maybeSingle();

        if (newGenre) {
          genreMap.set(normKey, newGenre.id);
          genreMap.set(slug, newGenre.id);
          matchedGenreIds.push(newGenre.id);
        } else if (insertGenreErr) {
          // If conflict, try fetching again
          const { data: fetched } = await supabase
            .from('genres')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();
          if (fetched) {
            matchedGenreIds.push(fetched.id);
          }
        }
      }
    }

    // 3. Link into comic_genres
    if (matchedGenreIds.length > 0) {
      // Remove existing associations first
      await supabase.from('comic_genres').delete().eq('comic_id', comicId);

      const rows = matchedGenreIds.map((genre_id) => ({
        comic_id: comicId,
        genre_id,
      }));
      await supabase.from('comic_genres').insert(rows);
    }
  } catch (err) {
    console.warn('[Sync Genres] Warning:', err);
  }
}

/**
 * Enriches a single comic record in Supabase using AniList / Kitsu metadata
 */
export async function enrichComicInDatabase(
  supabase: any,
  comicId: string,
  options?: { force?: boolean }
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!supabase) return { success: false, error: 'Database connection missing' };

  try {
    // 1. Fetch current comic from DB
    const { data: comic, error: fetchErr } = await supabase
      .from('comics')
      .select('*')
      .eq('id', comicId)
      .single();

    if (fetchErr || !comic) {
      return { success: false, error: fetchErr?.message || 'Comic not found' };
    }

    // 2. Query 3rd party API using comic title or slug
    const searchQuery = comic.title || comic.slug.replace(/-/g, ' ');
    const metadata = await fetchComicMetadata(searchQuery);

    if (!metadata) {
      return { success: false, error: `No metadata found from API for "${searchQuery}"` };
    }

    // 3. Build update payload
    const updatePayload: Record<string, any> = {
      type: metadata.type,
      status: metadata.status,
      rating: metadata.rating,
      updated_at: new Date().toISOString(),
    };

    // Update synopsis if current is empty or default template
    const isDefaultSynopsis =
      !comic.synopsis ||
      comic.synopsis.includes('terjemahan Bahasa Indonesia') ||
      comic.synopsis.length < 30;
    if (options?.force || isDefaultSynopsis) {
      if (metadata.synopsis) updatePayload.synopsis = metadata.synopsis;
    }

    // Update author if current is unknown or forced
    const isUnknownAuthor = !comic.author || /unknown/i.test(comic.author);
    if (options?.force || isUnknownAuthor) {
      if (metadata.author && metadata.author !== 'Unknown Author') {
        updatePayload.author = metadata.author;
      }
    }

    // Update cover if current is placeholder
    const isPlaceholderCover =
      !comic.cover_url ||
      comic.cover_url.includes('unsplash') ||
      comic.cover_url.includes('placeholder');
    if (options?.force || isPlaceholderCover) {
      if (metadata.cover_url) updatePayload.cover_url = metadata.cover_url;
    }

    // Update alt_titles if empty or forced
    if (options?.force || !comic.alt_titles || comic.alt_titles.length === 0) {
      if (metadata.alt_titles && metadata.alt_titles.length > 0) {
        updatePayload.alt_titles = metadata.alt_titles;
      }
    }

    // 4. Update the comic in Supabase
    const { data: updatedComic, error: updateErr } = await supabase
      .from('comics')
      .update(updatePayload)
      .eq('id', comicId)
      .select('*')
      .single();

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // 5. Synchronize genres
    if (metadata.genres && metadata.genres.length > 0) {
      await syncComicGenres(supabase, comicId, metadata.genres);
    }

    return {
      success: true,
      data: {
        ...updatedComic,
        metadata_source: metadata.sourceApi,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to enrich comic' };
  }
}

/**
 * Checks if a comic has default/placeholder data
 */
export function isComicDefault(comic: {
  author?: string | null;
  synopsis?: string | null;
  cover_url?: string | null;
}): boolean {
  const hasUnknownAuthor = !comic.author || /unknown/i.test(comic.author);
  const hasDefaultSynopsis =
    !comic.synopsis ||
    comic.synopsis.includes('terjemahan Bahasa Indonesia') ||
    comic.synopsis.length < 30;
  const hasPlaceholderCover =
    !comic.cover_url ||
    comic.cover_url.includes('unsplash') ||
    comic.cover_url.includes('placeholder');

  return hasUnknownAuthor || hasDefaultSynopsis || hasPlaceholderCover;
}

/**
 * Batch enrich all comics in database that still have default/placeholder data
 */
export async function enrichAllDefaultComics(supabase: any): Promise<{
  total: number;
  enriched: number;
  skipped: number;
  errors: string[];
}> {
  if (!supabase) return { total: 0, enriched: 0, skipped: 0, errors: ['Database client missing'] };

  // 1. Fetch all comics
  const { data: comics, error } = await supabase
    .from('comics')
    .select('id, title, slug, author, synopsis, cover_url');

  if (error || !comics) {
    return { total: 0, enriched: 0, skipped: 0, errors: [error?.message || 'Failed to fetch comics'] };
  }

  // 2. Filter out comics that already have complete data
  const defaultComics = comics.filter(isComicDefault);

  const results = {
    total: defaultComics.length,
    enriched: 0,
    skipped: comics.length - defaultComics.length,
    errors: [] as string[],
  };

  // 3. Process each sequentially with a gentle delay to be nice to AniList/Kitsu API
  for (const comic of defaultComics) {
    try {
      const res = await enrichComicInDatabase(supabase, comic.id);
      if (res.success) {
        results.enriched++;
      } else {
        results.errors.push(`${comic.title}: ${res.error}`);
      }
    } catch (err: any) {
      results.errors.push(`${comic.title}: ${err?.message}`);
    }

    // 400ms pause between requests to respect rate limits
    await new Promise((r) => setTimeout(r, 400));
  }

  return results;
}
