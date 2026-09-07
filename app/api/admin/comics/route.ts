import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteImageKitFolder } from '@/lib/imagekit-admin';

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
        synopsis,
        rating,
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

export async function PUT(req: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { id, title, slug, synopsis, author, status, type, cover_url, rating } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Parameter id komik wajib diisi' }, { status: 400 });
    }

    const updateFields: Record<string, any> = {};
    if (title !== undefined) updateFields.title = title;
    if (slug !== undefined) updateFields.slug = slug;
    if (synopsis !== undefined) updateFields.synopsis = synopsis;
    if (author !== undefined) updateFields.author = author;
    if (status !== undefined) updateFields.status = status;
    if (type !== undefined) updateFields.type = type;
    if (cover_url !== undefined) updateFields.cover_url = cover_url;
    if (rating !== undefined) updateFields.rating = Number(rating);

    const { error } = await supabase
      .from('comics')
      .update(updateFields)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Komik berhasil diperbarui.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Gagal memperbarui komik' }, { status: 500 });
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
    // 1. Get the comic slug for ImageKit folder path
    const { data: comic } = await supabase
      .from('comics')
      .select('slug')
      .eq('id', comicId)
      .single();

    // 2. Get all chapters of this comic
    const { data: chapters } = await supabase
      .from('chapters')
      .select('id, chapter_number')
      .eq('comic_id', comicId);

    if (chapters && chapters.length > 0) {
      const chapterIds = chapters.map((ch) => ch.id);

      // 3. Delete chapter pages from DB
      await supabase.from('chapter_pages').delete().in('chapter_id', chapterIds);

      // 4. Delete chapters from DB
      await supabase.from('chapters').delete().eq('comic_id', comicId);

      // 5. Delete ImageKit files (fire-and-forget, one folder per comic slug)
      if (comic?.slug) {
        const ikFolderPath = `/comics/${comic.slug}`;
        deleteImageKitFolder(ikFolderPath).then((result) => {
          if (!result.success) {
            console.warn('[ImageKit Comic Delete Warning]', result.message);
          } else {
            console.log('[ImageKit Comic Delete]', result.message);
          }
        });
      }
    }

    // 6. Delete relationships
    await supabase.from('comic_genres').delete().eq('comic_id', comicId);
    await supabase.from('reading_history').delete().eq('comic_id', comicId);

    // 7. Delete comic record
    const { error } = await supabase.from('comics').delete().eq('id', comicId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Komik beserta seluruh chapter dan aset CDN berhasil dihapus.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Gagal menghapus komik' }, { status: 500 });
  }
}
