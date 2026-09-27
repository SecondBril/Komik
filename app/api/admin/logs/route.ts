import { NextRequest, NextResponse } from 'next/server';
import { getTursoClient } from '@/lib/turso';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const level = searchParams.get('level'); // 'error' | 'warning' | 'info' | 'all'
  const chapterId = searchParams.get('chapterId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const offset = (page - 1) * limit;

  const turso = getTursoClient();
  if (turso) {
    try {
      const conditions: string[] = [];
      const args: any[] = [];
      if (level && level !== 'all') {
        conditions.push('l.level = ?');
        args.push(level);
      }
      if (chapterId) {
        conditions.push('l.chapter_id = ?');
        args.push(chapterId);
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await turso.execute({
        sql: `SELECT COUNT(*) as c FROM ingest_logs l ${whereClause};`,
        args,
      });
      const total = Number(countRes.rows[0]?.c || 0);

      const logsRes = await turso.execute({
        sql: `
          SELECT l.id, l.level, l.message, l.created_at, l.chapter_id,
                 ch.chapter_number, c.title as comic_title, c.slug as comic_slug
          FROM ingest_logs l
          LEFT JOIN chapters ch ON ch.id = l.chapter_id
          LEFT JOIN comics c ON c.id = ch.comic_id
          ${whereClause}
          ORDER BY l.created_at DESC
          LIMIT ? OFFSET ?;
        `,
        args: [...args, limit, offset],
      });

      const formatted = logsRes.rows.map((log: any) => ({
        id: String(log.id),
        level: String(log.level || 'info'),
        message: String(log.message),
        created_at: String(log.created_at),
        chapter_id: log.chapter_id ? String(log.chapter_id) : null,
        chapter_number: log.chapter_number !== null ? Number(log.chapter_number) : null,
        chapter_title: log.chapter_number !== null ? `Ch. ${log.chapter_number}` : null,
        comic_title: log.comic_title ? String(log.comic_title) : null,
        comic_slug: log.comic_slug ? String(log.comic_slug) : null,
      }));

      return NextResponse.json({
        success: true,
        data: formatted,
        total,
        page,
        limit,
      });
    } catch (err: any) {
      console.warn('[Admin Logs GET] Turso error:', err?.message);
    }
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
  }

  try {
    let query = supabase
      .from('ingest_logs')
      .select(
        `
        id,
        level,
        message,
        created_at,
        chapter_id,
        chapter:chapters(
          id,
          chapter_number,
          title,
          status,
          comic:comics(title, slug)
        )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (level && level !== 'all') {
      query = query.eq('level', level);
    }

    if (chapterId) {
      query = query.eq('chapter_id', chapterId);
    }

    const { data: logs, count, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const formatted = (logs || []).map((log: any) => ({
      id: log.id,
      level: log.level || 'info',
      message: log.message,
      created_at: log.created_at,
      chapter_id: log.chapter_id,
      chapter_number: log.chapter?.chapter_number ?? null,
      chapter_title: log.chapter ? `Ch. ${log.chapter.chapter_number}` : null,
      comic_title: log.chapter?.comic?.title ?? null,
      comic_slug: log.chapter?.comic?.slug ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      total: count || 0,
      page,
      limit,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
