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

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
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

function normalizeComicType(countryOrSubtype?: string | null): 'manga' | 'manhwa' | 'manhua' {
  if (!countryOrSubtype) return 'manga';
  const val = countryOrSubtype.toUpperCase().trim();
  if (val === 'KR' || val === 'MANHWA') return 'manhwa';
  if (val === 'CN' || val === 'TW' || val === 'MANHUA') return 'manhua';
  return 'manga';
}

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
    });

    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const media = data.data?.Page?.media?.[0];
    if (!media) return null;

    const mainTitle = media.title.english || media.title.romaji || cleanQuery;

    const altSet = new Set<string>();
    if (media.title.romaji && media.title.romaji !== mainTitle) altSet.add(media.title.romaji);
    if (media.title.native) altSet.add(media.title.native);
    if (Array.isArray(media.synonyms)) {
      media.synonyms.forEach((s: string) => {
        if (s && s !== mainTitle) altSet.add(s);
      });
    }

    const comicType = normalizeComicType(media.countryOfOrigin);

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

    const status: 'ongoing' | 'completed' =
      media.status === 'FINISHED' || media.status === 'CANCELLED' ? 'completed' : 'ongoing';

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
    console.error('[Worker AniList API] Error:', err);
    return null;
  }
}

export async function fetchFromKitsu(query: string): Promise<ComicMetadataResult | null> {
  const cleanQuery = query.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanQuery) return null;

  try {
    const url = `https://kitsu.io/api/edge/manga?filter[text]=${encodeURIComponent(cleanQuery)}&page[limit]=1`;
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.api+json' },
    });

    if (!res.ok) return null;
    const data = (await res.json()) as any;
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
    console.error('[Worker Kitsu API] Error:', err);
    return null;
  }
}

export async function fetchFromMangaUpdates(query: string): Promise<ComicMetadataResult | null> {
  const cleanQuery = query.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanQuery) return null;

  try {
    const searchRes = await fetch('https://api.mangaupdates.com/v1/series/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: cleanQuery, stype: 'title', perpage: 3 }),
    });

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const hit = searchData.results?.[0]?.record;
    if (!hit?.series_id) return null;

    const detailRes = await fetch(`https://api.mangaupdates.com/v1/series/${hit.series_id}`);
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
    console.warn('[Worker MangaUpdates API] Error:', err);
    return null;
  }
}

export async function fetchComicMetadata(query: string): Promise<ComicMetadataResult | null> {
  const [anilist, mu] = await Promise.all([
    fetchFromAniList(query).catch(() => null),
    fetchFromMangaUpdates(query).catch(() => null),
  ]);

  if (anilist && mu) {
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

  const kitsuResult = await fetchFromKitsu(query);
  if (kitsuResult) {
    return kitsuResult;
  }

  return null;
}

export async function syncWorkerComicGenres(
  supabase: any,
  comicId: string,
  genreNames: string[]
): Promise<void> {
  if (!genreNames || genreNames.length === 0) return;

  try {
    const { data: existingGenres } = await supabase.from('genres').select('id, name, slug');
    const genreMap = new Map<string, number>();

    if (existingGenres) {
      for (const g of existingGenres) {
        genreMap.set(g.name.toLowerCase(), g.id);
        genreMap.set(g.slug.toLowerCase(), g.id);
      }
    }

    const matchedGenreIds: number[] = [];

    for (const rawName of genreNames) {
      const trimmed = rawName.trim();
      if (!trimmed) continue;
      const normKey = trimmed.toLowerCase();

      if (genreMap.has(normKey)) {
        matchedGenreIds.push(genreMap.get(normKey)!);
      } else {
        const slug = slugify(trimmed);
        const { data: newGenre } = await supabase
          .from('genres')
          .insert({ name: trimmed, slug })
          .select('id')
          .maybeSingle();

        if (newGenre) {
          genreMap.set(normKey, newGenre.id);
          genreMap.set(slug, newGenre.id);
          matchedGenreIds.push(newGenre.id);
        } else {
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

    if (matchedGenreIds.length > 0) {
      await supabase.from('comic_genres').delete().eq('comic_id', comicId);
      const rows = matchedGenreIds.map((genre_id) => ({
        comic_id: comicId,
        genre_id,
      }));
      await supabase.from('comic_genres').insert(rows);
    }
  } catch (err) {
    console.warn('[Worker Sync Genres] Warning:', err);
  }
}
