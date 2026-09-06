import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
  }

  try {
    const { data: comics, error } = await supabase
      .from('comics')
      .select(`
        id,
        title,
        slug,
        type,
        cover_url,
        status,
        author,
        created_at,
        chapters:chapters(count)
      `)
      .order('title', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const formattedComics = comics.map((c: any) => ({
      ...c,
      total_chapters: c.chapters?.[0]?.count || 0,
    }));

    return NextResponse.json({ success: true, data: formattedComics });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const comicId = searchParams.get('id');

  if (!comicId) {
    return NextResponse.json({ success: false, error: 'Parameter id komik wajib diisi' }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
  }

  try {
    // 1. Get all chapters of this comic
    const { data: chapters } = await supabase
      .from('chapters')
      .select('id')
      .eq('comic_id', comicId);

    if (chapters && chapters.length > 0) {
      const chapterIds = chapters.map((ch) => ch.id);
      // Delete chapter pages
      await supabase.from('chapter_pages').delete().in('chapter_id', chapterIds);
      // Delete chapters
      await supabase.from('chapters').delete().eq('comic_id', comicId);
    }

    // 2. Delete relationships (comic_genres, reading_history)
    await supabase.from('comic_genres').delete().eq('comic_id', comicId);
    await supabase.from('reading_history').delete().eq('comic_id', comicId);

    // 3. Delete comic record
    const { error } = await supabase.from('comics').delete().eq('id', comicId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Komik beserta seluruh chapter berhasil dihapus.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Gagal menghapus komik' }, { status: 500 });
  }
}
