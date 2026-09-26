import { getTursoClient } from '../turso';
import { Comic, FilterState, Genre, Chapter, ChapterPage } from '../types';

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
  if (!turso) return null;

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
        WHERE c.slug = ?
        LIMIT 1;
      `,
      args: [slug],
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
  if (!turso) return [];

  try {
    const res = await turso.execute({
      sql: `
        SELECT ch.id, ch.comic_id, ch.chapter_number, ch.title, ch.status, ch.pages, ch.released_at, ch.created_at
        FROM chapters ch
        JOIN comics c ON c.id = ch.comic_id
        WHERE c.slug = ?
        ORDER BY ch.chapter_number DESC;
      `,
      args: [comicSlug],
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
