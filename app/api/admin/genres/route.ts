import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteImageKitFolder } from '@/lib/imagekit-admin';

export async function GET() {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
  }

  try {
    const { data: genres, error: genresError } = await supabase
      .from('genres')
      .select('id, name, slug')
      .order('name', { ascending: true });

    if (genresError) {
      return NextResponse.json({ success: false, error: genresError.message }, { status: 500 });
    }

    // Get comic associations
    const { data: comicGenres, error: cgError } = await supabase
      .from('comic_genres')
      .select('genre_id, comic_id, comics(id, title, slug)');

    const countMap: Record<number, { count: number; comics: any[] }> = {};
    if (!cgError && comicGenres) {
      comicGenres.forEach((item: any) => {
        if (!countMap[item.genre_id]) {
          countMap[item.genre_id] = { count: 0, comics: [] };
          if (item.comics) {
            countMap[item.genre_id].count++;
            countMap[item.genre_id].comics.push(item.comics);
          }
        }
      });
    }

    const data = (genres || []).map((g: any) => ({
      ...g,
      comic_count: countMap[g.id]?.count || 0,
      comics: countMap[g.id]?.comics || [],
    }));

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { name, slug } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Nama genre wajib diisi' }, { status: 400 });
    }

    const cleanSlug = (slug && slug.trim())
      ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
      : name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const { data, error } = await supabase
      .from('genres')
      .insert([{ name: name.trim(), slug: cleanSlug }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: `Genre "${name}" berhasil ditambahkan.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Gagal menambahkan genre' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { id, name, slug } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Parameter id genre wajib diisi' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Nama genre tidak boleh kosong' }, { status: 400 });
    }

    const cleanSlug = (slug && slug.trim())
      ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
      : name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const { data, error } = await supabase
      .from('genres')
      .update({ name: name.trim(), slug: cleanSlug })
      .eq('id', Number(id))
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: `Genre berhasil diperbarui.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Gagal memperbarui genre' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const genreId = searchParams.get('id');
  const deleteComics = searchParams.get('delete_comics') === 'true';

  if (!genreId) {
    return NextResponse.json({ success: false, error: 'Parameter id genre wajib diisi' }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
  }

  try {
    // If deleteComics is true, find all comics associated with this genre and delete them
    if (deleteComics) {
      const { data: linkedComics } = await supabase
        .from('comic_genres')
        .select('comic_id, comics(id, slug)')
        .eq('genre_id', Number(genreId));

      if (linkedComics && linkedComics.length > 0) {
        for (const item of linkedComics) {
          const cId = item.comic_id;
          const slug = (item.comics as any)?.slug;

          if (slug) {
            await deleteImageKitFolder(`comics/${slug}`).catch(() => { });
          }

          // Delete comic_genres junction
          await supabase.from('comic_genres').delete().eq('comic_id', cId);

          // Delete comic (cascades to chapters, pages, etc.)
          await supabase.from('comics').delete().eq('id', cId);
        }
      }
    } else {
      // Just delete relations for this genre
      await supabase.from('comic_genres').delete().eq('genre_id', Number(genreId));
    }

    // Delete the genre record itself
    const { error: genreDeleteError } = await supabase
      .from('genres')
      .delete()
      .eq('id', Number(genreId));

    if (genreDeleteError) {
      return NextResponse.json({ success: false, error: genreDeleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: deleteComics
        ? 'Genre beserta seluruh komik yang terkait berhasil dihapus.'
        : 'Genre berhasil dihapus dari database.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Gagal menghapus genre' }, { status: 500 });
  }
}
