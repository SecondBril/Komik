import { getTursoClient } from '../turso';
import { Comic, FilterState, Genre, Chapter, ChapterPage, ComicAdaptation } from '../types';

let cachedTursoGenresWithCounts: (Genre & { count: number })[] | null = null;
let lastTursoGenresFetchedAt = 0;
const GENRES_CACHE_TTL_MS = 5 * 60 * 1000;

export async function getTursoGenres(): Promise<Genre[]> {
  const turso = getTursoClient();
  if (!turso) return [];

  try {
    const res = await turso.execute(`SELECT id, name, slug FROM genres ORDER BY name ASC;`);
    return res.rows.map((r: any) => ({
      id: Number(r.id),
      name: String(r.name),
      slug: String(r.slug),
    }));
  } catch (err) {
    console.error('[getTursoGenres] Error:', err);
    return [];
  }
}

export async function getTursoGenresWithCounts(): Promise<(Genre & { count: number })[]> {
  const now = Date.now();
  if (cachedTursoGenresWithCounts && now - lastTursoGenresFetchedAt < GENRES_CACHE_TTL_MS) {
    return cachedTursoGenresWithCounts;
  }

  const turso = getTursoClient();
  if (!turso) return [];

  try {
    const res = await turso.execute(`
      SELECT g.id, g.name, g.slug, COUNT(cg.comic_id) as count
      FROM genres g
      LEFT JOIN comic_genres cg ON cg.genre_id = g.id
      GROUP BY g.id, g.name, g.slug
      ORDER BY g.name ASC;
    `);

    const result = res.rows.map((r: any) => ({
      id: Number(r.id),
      name: String(r.name),
      slug: String(r.slug),
      count: Number(r.count || 0),
    }));

    cachedTursoGenresWithCounts = result;
    lastTursoGenresFetchedAt = now;
    return result;
  } catch (err) {
    console.error('[getTursoGenresWithCounts] Error:', err);
    return [];
  }
}

function parseComicRow(row: any): Comic {
  let altTitles: string[] = [];
  try {
    if (typeof row.alt_titles === 'string') {
      altTitles = JSON.parse(row.alt_titles);
    } else if (Array.isArray(row.alt_titles)) {
      altTitles = row.alt_titles;
    }
  } catch {}

  let genres: Genre[] = [];
  try {
    if (typeof row.genres_json === 'string') {
      genres = JSON.parse(row.genres_json).filter((g: any) => g && g.id);
    }
  } catch {}

  let latestChapter: any = undefined;
  if (row.latest_chapter_number !== null && row.latest_chapter_number !== undefined) {
    latestChapter = {
      id: `${row.slug}-latest`,
      chapter_number: Number(row.latest_chapter_number),
      released_at: row.latest_chapter_date || row.updated_at,
    };
  }

  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    alt_titles: altTitles,
    type: row.type || 'manhwa',
    synopsis: row.synopsis || '',
    cover_url: row.cover_url || '',
    author: row.author || 'Unknown',
    status: row.status || 'ongoing',
    rating: Number(row.rating || 4.5),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    genres,
    latest_chapter: latestChapter,
  };
}

export async function getTursoLatestComics(limit = 18): Promise<Comic[]> {
  const turso = getTursoClient();
  if (!turso) return [];

  try {
    const res = await turso.execute({
      sql: `
        SELECT 
          c.id, c.slug, c.title, c.alt_titles, c.type, c.synopsis, c.cover_url,
          c.author, c.status, c.rating, c.updated_at, c.created_at,
          c.latest_chapter_number, c.latest_chapter_date,
          (
            SELECT json_group_array(json_object('id', g.id, 'name', g.name, 'slug', g.slug))
            FROM comic_genres cg
            JOIN genres g ON g.id = cg.genre_id
            WHERE cg.comic_id = c.id
          ) as genres_json
        FROM comics c
        ORDER BY c.updated_at DESC
        LIMIT ?;
      `,
      args: [limit],
    });

    return res.rows.map(parseComicRow);
  } catch (err) {
    console.error('[getTursoLatestComics] Error:', err);
    return [];
  }
}

export async function getTursoPopularComics(limit = 10): Promise<Comic[]> {
  const turso = getTursoClient();
  if (!turso) return [];

  try {
    const res = await turso.execute({
      sql: `
        SELECT 
          c.id, c.slug, c.title, c.alt_titles, c.type, c.synopsis, c.cover_url,
          c.author, c.status, c.rating, c.updated_at, c.created_at,
          c.latest_chapter_number, c.latest_chapter_date,
          (
            SELECT json_group_array(json_object('id', g.id, 'name', g.name, 'slug', g.slug))
            FROM comic_genres cg
            JOIN genres g ON g.id = cg.genre_id
            WHERE cg.comic_id = c.id
          ) as genres_json
        FROM comics c
        ORDER BY c.rating DESC
        LIMIT ?;
      `,
      args: [limit],
    });

    return res.rows.map(parseComicRow);
  } catch (err) {
    console.error('[getTursoPopularComics] Error:', err);
    return [];
  }
}

export async function getTursoComicBySlug(slug: string): Promise<Comic | null> {
  const turso = getTursoClient();
  if (!turso || !slug) return null;

  const rawSlug = slug.trim();
  const decodedSlug = decodeURIComponent(rawSlug);

  try {
    const res = await turso.execute({
      sql: `
        SELECT 
          c.id, c.slug, c.title, c.alt_titles, c.type, c.synopsis, c.cover_url,
          c.author, c.status, c.rating, c.updated_at, c.created_at,
          c.latest_chapter_number, c.latest_chapter_date,
          (
            SELECT json_group_array(json_object('id', g.id, 'name', g.name, 'slug', g.slug))
            FROM comic_genres cg
            JOIN genres g ON g.id = cg.genre_id
            WHERE cg.comic_id = c.id
          ) as genres_json
        FROM comics c
        WHERE c.slug = ? OR c.slug = ? OR LOWER(c.slug) = LOWER(?)
        LIMIT 1;
      `,
      args: [rawSlug, decodedSlug, decodedSlug],
    });

    if (res.rows.length === 0) return null;
    return parseComicRow(res.rows[0]);
  } catch (err) {
    console.error('[getTursoComicBySlug] Error:', err);
    return null;
  }
}

export async function getTursoComics(
  filters?: FilterState,
  options?: { page?: number; limit?: number }
): Promise<Comic[]> {
  const turso = getTursoClient();
  if (!turso) return [];

  const limit = Math.min(100, Math.max(1, options?.limit || 24));
  const page = Math.max(1, options?.page || 1);
  const offset = (page - 1) * limit;

  try {
    const whereClauses: string[] = ['1=1'];
    const args: any[] = [];

    if (filters?.type && filters.type !== 'all') {
      whereClauses.push('c.type = ?');
      args.push(filters.type);
    }

    if (filters?.status && filters.status !== 'all') {
      whereClauses.push('c.status = ?');
      args.push(filters.status);
    }

    if (filters?.query) {
      whereClauses.push('(c.title LIKE ? OR c.alt_titles LIKE ?)');
      args.push(`%${filters.query}%`, `%${filters.query}%`);
    }

    let orderBy = 'c.updated_at DESC';
    if (filters?.sort === 'popular' || filters?.sort === 'rating') {
      orderBy = 'c.rating DESC';
    } else if (filters?.sort === 'title') {
      orderBy = 'c.title ASC';
    }

    args.push(limit, offset);

    const res = await turso.execute({
      sql: `
        SELECT 
          c.id, c.slug, c.title, c.alt_titles, c.type, c.synopsis, c.cover_url,
          c.author, c.status, c.rating, c.updated_at, c.created_at,
          c.latest_chapter_number, c.latest_chapter_date,
          (
            SELECT json_group_array(json_object('id', g.id, 'name', g.name, 'slug', g.slug))
            FROM comic_genres cg
            JOIN genres g ON g.id = cg.genre_id
            WHERE cg.comic_id = c.id
          ) as genres_json
        FROM comics c
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?;
      `,
      args,
    });

    return res.rows.map(parseComicRow);
  } catch (err) {
    console.error('[getTursoComics] Error:', err);
    return [];
  }
}

export interface TursoBrowseParams {
  type?: string;
  status?: string;
  q?: string;
  genres?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export async function getTursoBrowseComics(params: TursoBrowseParams): Promise<{ data: Comic[]; total: number }> {
  const turso = getTursoClient();
  if (!turso) return { data: [], total: 0 };

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 30));
  const offset = (page - 1) * limit;

  try {
    const whereClauses: string[] = ['1=1'];
    const args: any[] = [];

    // Filter by type
    if (params.type && params.type !== 'all') {
      whereClauses.push('c.type = ?');
      args.push(params.type);
    }

    // Filter by status
    if (params.status && params.status !== 'all') {
      whereClauses.push('c.status = ?');
      args.push(params.status);
    }

    // Filter by search query
    if (params.q && params.q.trim()) {
      whereClauses.push('(c.title LIKE ? OR c.alt_titles LIKE ?)');
      args.push(`%${params.q.trim()}%`, `%${params.q.trim()}%`);
    }

    // Multi-genre filtering (AND logic: must match all specified genres)
    if (params.genres && params.genres.trim()) {
      const tokens = params.genres
        .split(',')
        .map((g) => g.trim().toLowerCase())
        .filter(Boolean);

      if (tokens.length > 0) {
        const placeholders = tokens.map(() => '?').join(',');
        whereClauses.push(`
          c.id IN (
            SELECT cg.comic_id
            FROM comic_genres cg
            JOIN genres g ON g.id = cg.genre_id
            WHERE LOWER(g.slug) IN (${placeholders}) OR LOWER(g.name) IN (${placeholders})
            GROUP BY cg.comic_id
            HAVING COUNT(DISTINCT g.id) >= ?
          )
        `);
        args.push(...tokens, ...tokens, tokens.length);
      }
    }

    // Sorting
    let orderBy = 'c.updated_at DESC';
    if (params.sort === 'popular' || params.sort === 'rating') {
      orderBy = 'c.rating DESC';
    } else if (params.sort === 'title') {
      orderBy = 'c.title ASC';
    }

    const whereSql = whereClauses.join(' AND ');

    // 1. Total count query
    const countRes = await turso.execute({
      sql: `SELECT COUNT(*) as total FROM comics c WHERE ${whereSql};`,
      args: [...args],
    });
    const total = Number(countRes.rows[0]?.total || 0);

    // 2. Data query
    const dataArgs = [...args, limit, offset];
    const dataRes = await turso.execute({
      sql: `
        SELECT 
          c.id, c.slug, c.title, c.alt_titles, c.type, c.synopsis, c.cover_url,
          c.author, c.status, c.rating, c.updated_at, c.created_at,
          c.latest_chapter_number, c.latest_chapter_date,
          (
            SELECT json_group_array(json_object('id', g.id, 'name', g.name, 'slug', g.slug))
            FROM comic_genres cg
            JOIN genres g ON g.id = cg.genre_id
            WHERE cg.comic_id = c.id
          ) as genres_json
        FROM comics c
        WHERE ${whereSql}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?;
      `,
      args: dataArgs,
    });

    const data = dataRes.rows.map(parseComicRow);
    return { data, total };
  } catch (err) {
    console.error('[getTursoBrowseComics] Error:', err);
    return { data: [], total: 0 };
  }
}

export async function getTursoComicChapters(comicSlug: string): Promise<Chapter[]> {
  const turso = getTursoClient();
  if (!turso || !comicSlug) return [];

  const rawSlug = comicSlug.trim();
  const decodedSlug = decodeURIComponent(rawSlug);

  try {
    const res = await turso.execute({
      sql: `
        SELECT ch.id, ch.comic_id, ch.chapter_number, ch.title, ch.status, ch.pages, ch.released_at, ch.created_at
        FROM chapters ch
        JOIN comics c ON c.id = ch.comic_id
        WHERE c.slug = ? OR c.slug = ? OR LOWER(c.slug) = LOWER(?)
        ORDER BY ch.chapter_number DESC;
      `,
      args: [rawSlug, decodedSlug, decodedSlug],
    });

    return res.rows.map((r: any) => ({
      id: String(r.id),
      comic_id: String(r.comic_id),
      chapter_number: Number(r.chapter_number),
      title: String(r.title || `Chapter ${r.chapter_number}`),
      status: (r.status || 'published') as any,
      retry_count: 0,
      released_at: String(r.released_at || new Date().toISOString()),
      created_at: String(r.created_at || new Date().toISOString()),
    }));
  } catch (err) {
    console.error('[getTursoComicChapters] Error:', err);
    return [];
  }
}

export async function getTursoChapterByNumber(comicSlug: string, chapterNumber: number): Promise<Chapter | null> {
  const turso = getTursoClient();
  if (!turso) return null;

  try {
    const res = await turso.execute({
      sql: `
        SELECT ch.id, ch.comic_id, ch.chapter_number, ch.title, ch.status, ch.pages, ch.released_at, ch.created_at
        FROM chapters ch
        JOIN comics c ON c.id = ch.comic_id
        WHERE c.slug = ? AND ch.chapter_number = ?
        LIMIT 1;
      `,
      args: [comicSlug, chapterNumber],
    });

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: String(r.id),
      comic_id: String(r.comic_id),
      chapter_number: Number(r.chapter_number),
      title: String(r.title || `Chapter ${r.chapter_number}`),
      status: (r.status || 'published') as any,
      retry_count: 0,
      released_at: String(r.released_at || new Date().toISOString()),
      created_at: String(r.created_at || new Date().toISOString()),
    };
  } catch (err) {
    console.error('[getTursoChapterByNumber] Error:', err);
    return null;
  }
}

export async function getTursoChapterPages(chapterId: string): Promise<ChapterPage[]> {
  const turso = getTursoClient();
  if (!turso) return [];

  try {
    // 1. Check chapter_pages table
    const res = await turso.execute({
      sql: `
        SELECT id, chapter_id, page_number, image_url, width, height
        FROM chapter_pages
        WHERE chapter_id = ?
        ORDER BY page_number ASC;
      `,
      args: [chapterId],
    });

    if (res.rows.length > 0) {
      return res.rows.map((r: any) => ({
        id: String(r.id),
        chapter_id: String(r.chapter_id),
        page_number: Number(r.page_number),
        image_url: String(r.image_url),
        width: r.width ? Number(r.width) : undefined,
        height: r.height ? Number(r.height) : undefined,
      }));
    }

    // 2. Check chapters.pages column JSON array
    const chRes = await turso.execute({
      sql: `SELECT pages FROM chapters WHERE id = ? LIMIT 1;`,
      args: [chapterId],
    });

    if (chRes.rows.length > 0 && chRes.rows[0].pages) {
      try {
        const pagesList = JSON.parse(String(chRes.rows[0].pages));
        if (Array.isArray(pagesList) && pagesList.length > 0) {
          return pagesList.map((p: any, idx: number) => {
            if (typeof p === 'string') {
              return {
                id: `${chapterId}-${idx + 1}`,
                chapter_id: chapterId,
                page_number: idx + 1,
                image_url: p,
              };
            }
            return {
              id: p.id || `${chapterId}-${idx + 1}`,
              chapter_id: chapterId,
              page_number: p.page_number || idx + 1,
              image_url: p.image_url,
            };
          });
        }
      } catch {}
    }

    return [];
  } catch (err) {
    console.error('[getTursoChapterPages] Error:', err);
    return [];
  }
}

export async function saveTursoChapterPages(
  chapterId: string,
  pages: Array<{ page_number?: number; image_url: string }>
): Promise<number> {
  const turso = getTursoClient();
  if (!turso || !pages || pages.length === 0) return 0;

  try {
    const stmts: any[] = pages.map((p, idx) => {
      const pageNum = p.page_number || idx + 1;
      const id = `${chapterId}_p${pageNum}`;
      return {
        sql: `
          INSERT INTO chapter_pages (id, chapter_id, page_number, image_url)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(chapter_id, page_number) DO UPDATE SET image_url = excluded.image_url;
        `,
        args: [id, chapterId, pageNum, p.image_url],
      };
    });

    // Also cache as JSON array inside chapters table for maximum speed
    const imageUrls = pages.map((p) => p.image_url);
    stmts.push({
      sql: `UPDATE chapters SET pages = ? WHERE id = ?;`,
      args: [JSON.stringify(imageUrls), chapterId],
    });

    await turso.batch(stmts, 'write');
    return pages.length;
  } catch (err) {
    console.error('[saveTursoChapterPages] Error:', err);
    return 0;
  }
}

export async function getTursoReadingHistory(userId: string): Promise<any[]> {
  const turso = getTursoClient();
  if (!turso) return [];

  try {
    const res = await turso.execute({
      sql: `
        SELECT 
          rh.id, rh.user_id, rh.comic_id, rh.chapter_id, rh.scroll_position, rh.last_read_at,
          c.slug as comic_slug, c.title as comic_title, c.cover_url as comic_cover_url,
          c.type as comic_type, c.author as comic_author, c.status as comic_status, c.rating as comic_rating,
          c.alt_titles as comic_alt_titles, c.synopsis as comic_synopsis,
          ch.chapter_number, ch.title as chapter_title, ch.status as chapter_status, ch.released_at as chapter_released_at
        FROM reading_history rh
        JOIN comics c ON c.id = rh.comic_id
        JOIN chapters ch ON ch.id = rh.chapter_id
        WHERE rh.user_id = ?
        ORDER BY rh.last_read_at DESC
        LIMIT 500;
      `,
      args: [userId],
    });

    return res.rows.map((r: any) => ({
      id: r.id,
      comic_id: r.comic_id,
      chapter_id: r.chapter_id,
      scroll_position: Number(r.scroll_position || 0),
      last_read_at: r.last_read_at,
      comic: {
        id: r.comic_id,
        slug: r.comic_slug,
        title: r.comic_title,
        cover_url: r.comic_cover_url,
        type: r.comic_type,
        author: r.comic_author,
        status: r.comic_status,
        rating: Number(r.comic_rating || 4.5),
        synopsis: r.comic_synopsis || '',
      },
      chapter: {
        id: r.chapter_id,
        comic_id: r.comic_id,
        chapter_number: Number(r.chapter_number),
        title: r.chapter_title,
        status: r.chapter_status,
        released_at: r.chapter_released_at,
      },
    }));
  } catch (err) {
    console.error('[getTursoReadingHistory] Error:', err);
    return [];
  }
}

export async function upsertTursoReadingHistory(
  userId: string,
  items: Array<{
    comic_id: string;
    chapter_id: string;
    scroll_position?: number;
    last_read_at?: string;
  }>
): Promise<number> {
  const turso = getTursoClient();
  if (!turso || !items || items.length === 0) return 0;

  try {
    const stmts = items.map((item) => ({
      sql: `
        INSERT INTO reading_history (id, user_id, comic_id, chapter_id, scroll_position, last_read_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, comic_id) DO UPDATE SET
          chapter_id = excluded.chapter_id,
          scroll_position = excluded.scroll_position,
          last_read_at = excluded.last_read_at;
      `,
      args: [
        `rh_${userId}_${item.comic_id}`,
        userId,
        item.comic_id,
        item.chapter_id,
        Number(item.scroll_position || 0),
        item.last_read_at || new Date().toISOString(),
      ],
    }));

    await turso.batch(stmts, 'write');
    return items.length;
  } catch (err) {
    console.error('[upsertTursoReadingHistory] Error:', err);
    return 0;
  }
}

export async function deleteTursoReadingHistory(
  userId: string,
  params?: { chapterId?: string; comicId?: string }
): Promise<boolean> {
  const turso = getTursoClient();
  if (!turso) return false;

  try {
    if (params?.chapterId) {
      await turso.execute({
        sql: `DELETE FROM reading_history WHERE user_id = ? AND chapter_id = ?;`,
        args: [userId, params.chapterId],
      });
    } else if (params?.comicId) {
      await turso.execute({
        sql: `DELETE FROM reading_history WHERE user_id = ? AND comic_id = ?;`,
        args: [userId, params.comicId],
      });
    } else {
      await turso.execute({
        sql: `DELETE FROM reading_history WHERE user_id = ?;`,
        args: [userId],
      });
    }
    return true;
  } catch (err) {
    console.error('[deleteTursoReadingHistory] Error:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function getTursoComicAdaptations(comicId: string): Promise<ComicAdaptation[]> {
  const turso = getTursoClient();
  if (!turso || !comicId) return [];

  try {
    const res = await turso.execute({
      sql: `SELECT id, comic_id, start_chapter, end_chapter, anime_season, anime_episode_range,
                   novel_chapter_range, novel_volume, arc_title, note, created_at, updated_at
            FROM comic_adaptations
            WHERE comic_id = ?
            ORDER BY start_chapter ASC;`,
      args: [comicId],
    });

    return res.rows.map((r: any) => ({
      id: String(r.id),
      comic_id: String(r.comic_id),
      start_chapter: Number(r.start_chapter),
      end_chapter: Number(r.end_chapter),
      anime_season: r.anime_season ? String(r.anime_season) : undefined,
      anime_episode_range: r.anime_episode_range ? String(r.anime_episode_range) : undefined,
      novel_chapter_range: r.novel_chapter_range ? String(r.novel_chapter_range) : undefined,
      novel_volume: r.novel_volume ? String(r.novel_volume) : undefined,
      arc_title: r.arc_title ? String(r.arc_title) : undefined,
      note: r.note ? String(r.note) : undefined,
      created_at: r.created_at ? String(r.created_at) : undefined,
      updated_at: r.updated_at ? String(r.updated_at) : undefined,
    }));
  } catch (err) {
    console.error('[getTursoComicAdaptations] Error:', err);
    return [];
  }
}

export async function getTursoChapterAdaptation(
  comicId: string,
  chapterNumber: number
): Promise<ComicAdaptation | null> {
  const turso = getTursoClient();
  if (!turso || !comicId || isNaN(chapterNumber)) return null;

  try {
    const res = await turso.execute({
      sql: `SELECT id, comic_id, start_chapter, end_chapter, anime_season, anime_episode_range,
                   novel_chapter_range, novel_volume, arc_title, note, created_at, updated_at
            FROM comic_adaptations
            WHERE comic_id = ? AND start_chapter <= ? AND end_chapter >= ?
            ORDER BY start_chapter DESC
            LIMIT 1;`,
      args: [comicId, chapterNumber, chapterNumber],
    });

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: String(r.id),
      comic_id: String(r.comic_id),
      start_chapter: Number(r.start_chapter),
      end_chapter: Number(r.end_chapter),
      anime_season: r.anime_season ? String(r.anime_season) : undefined,
      anime_episode_range: r.anime_episode_range ? String(r.anime_episode_range) : undefined,
      novel_chapter_range: r.novel_chapter_range ? String(r.novel_chapter_range) : undefined,
      novel_volume: r.novel_volume ? String(r.novel_volume) : undefined,
      arc_title: r.arc_title ? String(r.arc_title) : undefined,
      note: r.note ? String(r.note) : undefined,
      created_at: r.created_at ? String(r.created_at) : undefined,
      updated_at: r.updated_at ? String(r.updated_at) : undefined,
    };
  } catch (err) {
    console.error('[getTursoChapterAdaptation] Error:', err);
    return null;
  }
}

export async function insertTursoAdaptation(item: {
  comic_id: string;
  start_chapter: number;
  end_chapter: number;
  anime_season?: string | null;
  anime_episode_range?: string | null;
  novel_chapter_range?: string | null;
  novel_volume?: string | null;
  arc_title?: string | null;
  note?: string | null;
}): Promise<any> {
  const turso = getTursoClient();
  if (!turso) throw new Error('Turso client not available');

  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ca_${Date.now()}`;
  const now = new Date().toISOString();

  await turso.execute({
    sql: `INSERT INTO comic_adaptations (
      id, comic_id, start_chapter, end_chapter, anime_season, anime_episode_range,
      novel_chapter_range, novel_volume, arc_title, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    args: [
      id,
      item.comic_id,
      Number(item.start_chapter),
      Number(item.end_chapter),
      item.anime_season || null,
      item.anime_episode_range || null,
      item.novel_chapter_range || null,
      item.novel_volume || null,
      item.arc_title || null,
      item.note || null,
      now,
      now,
    ],
  });

  return { id, ...item, created_at: now, updated_at: now };
}

export async function updateTursoAdaptation(id: string, fields: any): Promise<any> {
  const turso = getTursoClient();
  if (!turso) throw new Error('Turso client not available');

  const sets: string[] = ['updated_at = ?'];
  const now = new Date().toISOString();
  const args: any[] = [now];

  if (fields.start_chapter !== undefined) {
    sets.push('start_chapter = ?');
    args.push(Number(fields.start_chapter));
  }
  if (fields.end_chapter !== undefined) {
    sets.push('end_chapter = ?');
    args.push(Number(fields.end_chapter));
  }
  if (fields.anime_season !== undefined) {
    sets.push('anime_season = ?');
    args.push(fields.anime_season || null);
  }
  if (fields.anime_episode_range !== undefined) {
    sets.push('anime_episode_range = ?');
    args.push(fields.anime_episode_range || null);
  }
  if (fields.novel_chapter_range !== undefined) {
    sets.push('novel_chapter_range = ?');
    args.push(fields.novel_chapter_range || null);
  }
  if (fields.novel_volume !== undefined) {
    sets.push('novel_volume = ?');
    args.push(fields.novel_volume || null);
  }
  if (fields.arc_title !== undefined) {
    sets.push('arc_title = ?');
    args.push(fields.arc_title || null);
  }
  if (fields.note !== undefined) {
    sets.push('note = ?');
    args.push(fields.note || null);
  }

  args.push(id);
  await turso.execute({
    sql: `UPDATE comic_adaptations SET ${sets.join(', ')} WHERE id = ?;`,
    args,
  });

  const res = await turso.execute({
    sql: `SELECT * FROM comic_adaptations WHERE id = ? LIMIT 1;`,
    args: [id],
  });
  return res.rows[0] || null;
}

export async function deleteTursoAdaptation(id: string): Promise<boolean> {
  const turso = getTursoClient();
  if (!turso) return false;

  await turso.execute({
    sql: `DELETE FROM comic_adaptations WHERE id = ?;`,
    args: [id],
  });
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMIC RELATIONS CACHE
// ─────────────────────────────────────────────────────────────────────────────

export async function getTursoComicRelations(comicId: string): Promise<any | null> {
  const turso = getTursoClient();
  if (!turso || !comicId) return null;

  try {
    const res = await turso.execute({
      sql: `SELECT id, comic_id, franchise_relations, recommendations, characters, sources_used, updated_at
            FROM comic_relations_cache WHERE comic_id = ? LIMIT 1;`,
      args: [comicId],
    });

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: String(r.id),
      comic_id: String(r.comic_id),
      franchise_relations: typeof r.franchise_relations === 'string' ? JSON.parse(r.franchise_relations) : (r.franchise_relations || []),
      recommendations: typeof r.recommendations === 'string' ? JSON.parse(r.recommendations) : (r.recommendations || []),
      characters: typeof r.characters === 'string' ? JSON.parse(r.characters) : (r.characters || []),
      sources_used: typeof r.sources_used === 'string' ? JSON.parse(r.sources_used) : (r.sources_used || []),
      updated_at: String(r.updated_at),
    };
  } catch (err) {
    console.error('[getTursoComicRelations] Error:', err);
    return null;
  }
}

export async function saveTursoComicRelations(
  comicId: string,
  data: {
    franchise_relations: any[];
    recommendations: any[];
    characters: any[];
    sources_used: string[];
  }
): Promise<boolean> {
  const turso = getTursoClient();
  if (!turso || !comicId) return false;

  try {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rel_${Date.now()}`;
    const now = new Date().toISOString();
    await turso.execute({
      sql: `
        INSERT INTO comic_relations_cache (id, comic_id, franchise_relations, recommendations, characters, sources_used, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(comic_id) DO UPDATE SET
          franchise_relations = excluded.franchise_relations,
          recommendations = excluded.recommendations,
          characters = excluded.characters,
          sources_used = excluded.sources_used,
          updated_at = excluded.updated_at;
      `,
      args: [
        id,
        comicId,
        JSON.stringify(data.franchise_relations || []),
        JSON.stringify(data.recommendations || []),
        JSON.stringify(data.characters || []),
        JSON.stringify(data.sources_used || []),
        now,
      ],
    });
    return true;
  } catch (err) {
    console.error('[saveTursoComicRelations] Error:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN OPERATIONS (Comics, Chapters, Sources, Logs)
// ─────────────────────────────────────────────────────────────────────────────

export async function getTursoAdminComics(): Promise<any[]> {
  const turso = getTursoClient();
  if (!turso) return [];

  try {
    const res = await turso.execute(`
      SELECT c.id, c.title, c.slug, c.type, c.cover_url, c.status, c.author, c.synopsis, c.rating, c.created_at,
             (
               SELECT json_group_array(json_object('id', g.id, 'name', g.name, 'slug', g.slug))
               FROM comic_genres cg
               JOIN genres g ON g.id = cg.genre_id
               WHERE cg.comic_id = c.id
             ) as genres_json,
             (
               SELECT COUNT(*) FROM chapters ch WHERE ch.comic_id = c.id
             ) as total_chapters
      FROM comics c
      ORDER BY c.title ASC;
    `);

    return res.rows.map((r: any) => {
      let genres: any[] = [];
      try {
        if (typeof r.genres_json === 'string') {
          genres = JSON.parse(r.genres_json).filter((g: any) => g && g.id);
        }
      } catch {}

      return {
        id: String(r.id),
        title: String(r.title),
        slug: String(r.slug),
        type: String(r.type || 'manhwa'),
        cover_url: String(r.cover_url || ''),
        status: String(r.status || 'ongoing'),
        author: String(r.author || 'Unknown'),
        synopsis: String(r.synopsis || ''),
        rating: Number(r.rating || 4.5),
        created_at: String(r.created_at),
        genres,
        total_chapters: Number(r.total_chapters || 0),
      };
    });
  } catch (err) {
    console.error('[getTursoAdminComics] Error:', err);
    return [];
  }
}

export async function updateTursoAdminComic(id: string, fields: any): Promise<boolean> {
  const turso = getTursoClient();
  if (!turso) return false;

  try {
    const sets: string[] = ['updated_at = ?'];
    const now = new Date().toISOString();
    const args: any[] = [now];

    if (fields.title !== undefined) { sets.push('title = ?'); args.push(fields.title); }
    if (fields.slug !== undefined) { sets.push('slug = ?'); args.push(fields.slug); }
    if (fields.synopsis !== undefined) { sets.push('synopsis = ?'); args.push(fields.synopsis); }
    if (fields.author !== undefined) { sets.push('author = ?'); args.push(fields.author); }
    if (fields.status !== undefined) { sets.push('status = ?'); args.push(fields.status); }
    if (fields.type !== undefined) { sets.push('type = ?'); args.push(fields.type); }
    if (fields.cover_url !== undefined) { sets.push('cover_url = ?'); args.push(fields.cover_url); }
    if (fields.rating !== undefined) { sets.push('rating = ?'); args.push(Number(fields.rating)); }

    args.push(id);
    await turso.execute({
      sql: `UPDATE comics SET ${sets.join(', ')} WHERE id = ?;`,
      args,
    });

    if (Array.isArray(fields.genre_ids)) {
      await turso.execute({
        sql: `DELETE FROM comic_genres WHERE comic_id = ?;`,
        args: [id],
      });
      for (const gid of fields.genre_ids) {
        await turso.execute({
          sql: `INSERT OR IGNORE INTO comic_genres (comic_id, genre_id) VALUES (?, ?);`,
          args: [id, Number(gid)],
        });
      }
    }

    return true;
  } catch (err) {
    console.error('[updateTursoAdminComic] Error:', err);
    return false;
  }
}

export async function deleteTursoAdminComic(id: string): Promise<boolean> {
  const turso = getTursoClient();
  if (!turso) return false;

  try {
    await turso.execute({ sql: `DELETE FROM chapter_pages WHERE chapter_id IN (SELECT id FROM chapters WHERE comic_id = ?);`, args: [id] });
    await turso.execute({ sql: `DELETE FROM chapters WHERE comic_id = ?;`, args: [id] });
    await turso.execute({ sql: `DELETE FROM comic_genres WHERE comic_id = ?;`, args: [id] });
    await turso.execute({ sql: `DELETE FROM comic_adaptations WHERE comic_id = ?;`, args: [id] });
    await turso.execute({ sql: `DELETE FROM comic_relations_cache WHERE comic_id = ?;`, args: [id] });
    await turso.execute({ sql: `DELETE FROM reading_history WHERE comic_id = ?;`, args: [id] });
    await turso.execute({ sql: `DELETE FROM comics WHERE id = ?;`, args: [id] });
    return true;
  } catch (err) {
    console.error('[deleteTursoAdminComic] Error:', err);
    return false;
  }
}

export async function getTursoAdminSources(): Promise<any[]> {
  const turso = getTursoClient();
  if (!turso) return [];

  try {
    const res = await turso.execute(`SELECT id, name, base_url, scraping_config, is_active, created_at FROM sources ORDER BY created_at DESC;`);
    return res.rows.map((r: any) => ({
      id: String(r.id),
      name: String(r.name),
      base_url: String(r.base_url),
      scraping_config: typeof r.scraping_config === 'string' ? JSON.parse(r.scraping_config) : (r.scraping_config || {}),
      is_active: Boolean(r.is_active),
      created_at: String(r.created_at),
    }));
  } catch (err) {
    console.error('[getTursoAdminSources] Error:', err);
    return [];
  }
}

export async function getTursoAdminLogs(limit = 100): Promise<any[]> {
  const turso = getTursoClient();
  if (!turso) return [];

  try {
    const res = await turso.execute({
      sql: `SELECT id, source_id, chapter_id, level, message, created_at FROM ingest_logs ORDER BY created_at DESC LIMIT ?;`,
      args: [limit],
    });
    return res.rows.map((r: any) => ({
      id: String(r.id),
      source_id: r.source_id ? String(r.source_id) : null,
      chapter_id: r.chapter_id ? String(r.chapter_id) : null,
      level: String(r.level),
      message: String(r.message),
      created_at: String(r.created_at),
    }));
  } catch (err) {
    console.error('[getTursoAdminLogs] Error:', err);
    return [];
  }
}
