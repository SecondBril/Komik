import { NextRequest, NextResponse } from 'next/server';
import { getTursoClient } from '@/lib/turso';
import {
  getTursoAdminComics,
  updateTursoAdminComic,
  deleteTursoAdminComic,
} from '@/lib/queries/turso-comics';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteImageKitFolder } from '@/lib/imagekit-admin';

export async function GET() {
  if (getTursoClient()) {
    try {
      const comics = await getTursoAdminComics();
      return NextResponse.json({ success: true, data: comics });
    } catch (err: any) {
      console.warn('[Admin Comics GET] Turso error:', err?.message);
    }
  }

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
        genres:comic_genres(genres(id, name, slug)),
        chapters:chapters(count)
      `)
      .order('title', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const formattedComics = comics.map((c: any) => ({
      ...c,
      genres: c.genres?.map((g: any) => g.genres).filter(Boolean) || [],
      total_chapters: c.chapters?.[0]?.count || 0,
    }));

    return NextResponse.json({ success: true, data: formattedComics });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, slug, synopsis, author, status, type, cover_url, rating, genre_ids } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Parameter id komik wajib diisi' }, { status: 400 });
    }

    if (getTursoClient()) {
      const ok = await updateTursoAdminComic(id, {
        title,
        slug,
        synopsis,
        author,
        status,
        type,
        cover_url,
        rating,
        genre_ids,
      });
      if (ok) {
        return NextResponse.json({ success: true, message: 'Komik berhasil diperbarui di Turso.' });
      }
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
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

    if (Object.keys(updateFields).length > 0) {
      const { error } = await supabase
        .from('comics')
        .update(updateFields)
        .eq('id', id);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    // Update genres relation if genre_ids is provided
    if (Array.isArray(genre_ids)) {
      await supabase.from('comic_genres').delete().eq('comic_id', id);
      if (genre_ids.length > 0) {
        const rows = genre_ids.map((genre_id: number) => ({
          comic_id: id,
          genre_id: Number(genre_id),
        }));
        await supabase.from('comic_genres').insert(rows);
      }
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

  const turso = getTursoClient();
  if (turso) {
    try {
      // 1. Get comic slug for ImageKit cleanup
      const res = await turso.execute({
        sql: `SELECT slug FROM comics WHERE id = ? LIMIT 1;`,
        args: [comicId],
      });
      if (res.rows.length > 0 && res.rows[0].slug) {
        const folderPath = `comics/${res.rows[0].slug}`;
        deleteImageKitFolder(folderPath).catch(() => {});
      }

      await deleteTursoAdminComic(comicId);
      return NextResponse.json({
        success: true,
        message: 'Komik berhasil dihapus dari Turso.',
      });
    } catch (err: any) {
      console.warn('[Admin Comic DELETE] Turso error:', err?.message);
    }
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
  }

  try {
    const { data: comic } = await supabase
      .from('comics')
      .select('slug')
      .eq('id', comicId)
      .single();

    if (comic?.slug) {
      const folderPath = `comics/${comic.slug}`;
      deleteImageKitFolder(folderPath).catch(() => {});
    }

    await supabase.from('comic_genres').delete().eq('comic_id', comicId);
    const { error } = await supabase.from('comics').delete().eq('id', comicId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Komik berhasil dihapus dari database.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Gagal menghapus komik' }, { status: 500 });
  }
}
