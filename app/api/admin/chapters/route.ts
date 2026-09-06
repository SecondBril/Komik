import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const comicId = searchParams.get('comicId');

  if (!comicId) {
    return NextResponse.json({ success: false, error: 'Parameter comicId wajib diisi' }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
  }

  try {
    const { data: chapters, error } = await supabase
      .from('chapters')
      .select(`
        id,
        chapter_number,
        title,
        status,
        released_at,
        created_at,
        pages:chapter_pages(count)
      `)
      .eq('comic_id', comicId)
      .order('chapter_number', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const formattedChapters = chapters.map((ch: any) => ({
      ...ch,
      total_pages: ch.pages?.[0]?.count || 0,
    }));

    return NextResponse.json({ success: true, data: formattedChapters });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chapterId = searchParams.get('id');

  if (!chapterId) {
    return NextResponse.json({ success: false, error: 'Parameter id chapter wajib diisi' }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
  }

  try {
    // 1. Delete pages of this chapter
    await supabase.from('chapter_pages').delete().eq('chapter_id', chapterId);

    // 2. Delete chapter record
    const { error } = await supabase.from('chapters').delete().eq('id', chapterId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Chapter berhasil dihapus.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Gagal menghapus chapter' }, { status: 500 });
  }
}
