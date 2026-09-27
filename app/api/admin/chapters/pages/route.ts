import { NextRequest, NextResponse } from 'next/server';
import { getTursoClient } from '@/lib/turso';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/admin/chapters/pages?chapterId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chapterId = searchParams.get('chapterId');

  if (!chapterId) {
    return NextResponse.json({ success: false, error: 'Parameter chapterId wajib diisi' }, { status: 400 });
  }

  const turso = getTursoClient();
  if (turso) {
    try {
      const res = await turso.execute({
        sql: `SELECT id, page_number, image_url, width, height FROM chapter_pages WHERE chapter_id = ? ORDER BY page_number ASC;`,
        args: [chapterId],
      });
      const pages = res.rows.map((r: any) => ({
        id: String(r.id),
        page_number: Number(r.page_number),
        image_url: String(r.image_url),
        width: r.width ? Number(r.width) : null,
        height: r.height ? Number(r.height) : null,
      }));
      return NextResponse.json({ success: true, data: pages });
    } catch (err: any) {
      console.warn('[Admin Pages GET] Turso error:', err?.message);
    }
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
  }

  try {
    const { data: pages, error } = await supabase
      .from('chapter_pages')
      .select('id, page_number, image_url')
      .eq('chapter_id', chapterId)
      .order('page_number', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: pages || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
