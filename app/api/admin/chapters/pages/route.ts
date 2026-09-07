import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/admin/chapters/pages?chapterId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chapterId = searchParams.get('chapterId');

  if (!chapterId) {
    return NextResponse.json({ success: false, error: 'Parameter chapterId wajib diisi' }, { status: 400 });
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
