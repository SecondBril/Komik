import { NextRequest, NextResponse } from 'next/server';
import { getTursoClient } from '@/lib/turso';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteImageKitFolder } from '@/lib/imagekit-admin';

export async function GET() {
  const turso = getTursoClient();
  if (turso) {
    try {
      const res = await turso.execute(`
        SELECT g.id, g.name, g.slug, COUNT(cg.comic_id) as comic_count
        FROM genres g
        LEFT JOIN comic_genres cg ON cg.genre_id = g.id
        GROUP BY g.id, g.name, g.slug
        ORDER BY g.name ASC;
      `);
      const data = res.rows.map((r: any) => ({
        id: Number(r.id),
        name: String(r.name),
        slug: String(r.slug),
        comic_count: Number(r.comic_count || 0),
        comics: [],
      }));
      return NextResponse.json({ success: true, data });
    } catch (err: any) {
      console.warn('[Admin Genres GET] Turso error:', err?.message);
    }
  }

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
  try {
    const body = await req.json();
    const { name, slug } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Nama genre wajib diisi' }, { status: 400 });
    }

    const cleanSlug = (slug && slug.trim())
      ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
      : name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const turso = getTursoClient();
    if (turso) {
      const res = await turso.execute({
        sql: `INSERT INTO genres (name, slug) VALUES (?, ?);`,
        args: [name.trim(), cleanSlug],
      });
      return NextResponse.json({
        success: true,
        data: { id: Number(res.lastInsertRowid), name: name.trim(), slug: cleanSlug },
        message: `Genre "${name}" berhasil ditambahkan ke Turso.`,
      });
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
    }

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

    const turso = getTursoClient();
    if (turso) {
      await turso.execute({
        sql: `UPDATE genres SET name = ?, slug = ? WHERE id = ?;`,
        args: [name.trim(), cleanSlug, Number(id)],
      });
      return NextResponse.json({
        success: true,
        data: { id: Number(id), name: name.trim(), slug: cleanSlug },
        message: `Genre berhasil diperbarui di Turso.`,
      });
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
    }

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

  const turso = getTursoClient();
  if (turso) {
    try {
      if (deleteComics) {
        const cRes = await turso.execute({
          sql: `SELECT c.id, c.slug FROM comics c JOIN comic_genres cg ON cg.comic_id = c.id WHERE cg.genre_id = ?;`,
          args: [Number(genreId)],
        });
        for (const c of cRes.rows) {
          const cId = String(c.id);
          const slug = String(c.slug);
          deleteImageKitFolder(`comics/${slug}`).catch(() => {});
          await turso.execute({ sql: `DELETE FROM chapter_pages WHERE chapter_id IN (SELECT id FROM chapters WHERE comic_id = ?);`, args: [cId] });
          await turso.execute({ sql: `DELETE FROM chapters WHERE comic_id = ?;`, args: [cId] });
          await turso.execute({ sql: `DELETE FROM comic_genres WHERE comic_id = ?;`, args: [cId] });
          await turso.execute({ sql: `DELETE FROM comics WHERE id = ?;`, args: [cId] });
        }
      } else {
        await turso.execute({ sql: `DELETE FROM comic_genres WHERE genre_id = ?;`, args: [Number(genreId)] });
      }

      await turso.execute({ sql: `DELETE FROM genres WHERE id = ?;`, args: [Number(genreId)] });
      return NextResponse.json({
        success: true,
        message: deleteComics
          ? 'Genre beserta seluruh komik yang terkait berhasil dihapus dari Turso.'
          : 'Genre berhasil dihapus dari Turso.',
      });
    } catch (err: any) {
      console.warn('[Admin Genres DELETE] Turso error:', err?.message);
    }
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
  }

  try {
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
          await supabase.from('comic_genres').delete().eq('comic_id', cId);
          await supabase.from('comics').delete().eq('id', cId);
        }
      }
    } else {
      await supabase.from('comic_genres').delete().eq('genre_id', Number(genreId));
    }

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
