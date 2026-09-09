import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const level = searchParams.get('level'); // 'error' | 'warning' | 'info' | 'all'
    const chapterId = searchParams.get('chapterId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const offset = (page - 1) * limit;

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
