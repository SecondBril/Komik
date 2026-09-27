import { NextRequest, NextResponse } from 'next/server';
import { getTursoClient } from '@/lib/turso';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractImageKitFolderPath } from '@/lib/imagekit-admin';
import { deleteComicFolderFromStorages } from '@/lib/storage-manager';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const comicId = searchParams.get('comicId');

  if (!comicId) {
    return NextResponse.json({ success: false, error: 'Parameter comicId wajib diisi' }, { status: 400 });
  }

  const turso = getTursoClient();
  if (turso) {
    try {
      const res = await turso.execute({
        sql: `
          SELECT ch.id, ch.chapter_number, ch.title, ch.status, ch.released_at, ch.created_at,
                 (SELECT COUNT(*) FROM chapter_pages cp WHERE cp.chapter_id = ch.id) as total_pages
          FROM chapters ch
          WHERE ch.comic_id = ?
          ORDER BY ch.chapter_number DESC;
        `,
        args: [comicId],
      });

      const formatted = res.rows.map((r: any) => ({
        id: String(r.id),
        chapter_number: Number(r.chapter_number),
        title: String(r.title || `Chapter ${r.chapter_number}`),
        status: String(r.status || 'published'),
        released_at: String(r.released_at),
        created_at: String(r.created_at),
        total_pages: Number(r.total_pages || 0),
      }));

      return NextResponse.json({ success: true, data: formatted });
    } catch (err: any) {
      console.warn('[Admin Chapters GET] Turso error:', err?.message);
    }
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

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, chapter_number, title, status, page_order } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Parameter id chapter wajib diisi' }, { status: 400 });
    }

    const turso = getTursoClient();
    if (turso) {
      const sets: string[] = [];
      const args: any[] = [];
      if (chapter_number !== undefined) { sets.push('chapter_number = ?'); args.push(Number(chapter_number)); }
      if (title !== undefined) { sets.push('title = ?'); args.push(title); }
      if (status !== undefined) { sets.push('status = ?'); args.push(status); }

      if (sets.length > 0) {
        args.push(id);
        await turso.execute({
          sql: `UPDATE chapters SET ${sets.join(', ')} WHERE id = ?;`,
          args,
        });
      }

      if (Array.isArray(page_order) && page_order.length > 0) {
        for (const p of page_order) {
          await turso.execute({
            sql: `UPDATE chapter_pages SET page_number = ? WHERE id = ?;`,
            args: [Number(p.page_number), p.id],
          });
        }
      }

      return NextResponse.json({ success: true, message: 'Chapter berhasil diperbarui di Turso.' });
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
    }

    const updateFields: Record<string, any> = {};
    if (chapter_number !== undefined) updateFields.chapter_number = Number(chapter_number);
    if (title !== undefined) updateFields.title = title;
    if (status !== undefined) updateFields.status = status;

    if (Object.keys(updateFields).length > 0) {
      const { error: chapterErr } = await supabase
        .from('chapters')
        .update(updateFields)
        .eq('id', id);

      if (chapterErr) {
        return NextResponse.json({ success: false, error: chapterErr.message }, { status: 500 });
      }
    }

    if (Array.isArray(page_order) && page_order.length > 0) {
      const updates = page_order.map(({ id: pageId, page_number }: { id: string; page_number: number }) =>
        supabase
          .from('chapter_pages')
          .update({ page_number })
          .eq('id', pageId)
      );
      await Promise.all(updates);
    }

    return NextResponse.json({ success: true, message: 'Chapter berhasil diperbarui.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Gagal memperbarui chapter' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chapterId = searchParams.get('id');

  if (!chapterId) {
    return NextResponse.json({ success: false, error: 'Parameter id chapter wajib diisi' }, { status: 400 });
  }

  const turso = getTursoClient();
  if (turso) {
    try {
      const pRes = await turso.execute({
        sql: `SELECT image_url FROM chapter_pages WHERE chapter_id = ? LIMIT 1;`,
        args: [chapterId],
      });
      if (pRes.rows.length > 0 && pRes.rows[0].image_url) {
        const imgUrl = String(pRes.rows[0].image_url);
        let folderPath: string | null = null;
        if (imgUrl.includes('/api/storage/onedrive')) {
          try {
            const urlObj = new URL(imgUrl, 'http://localhost');
            const filePath = urlObj.searchParams.get('path');
            if (filePath) folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
          } catch {}
        } else if (imgUrl.includes('ik.imagekit.io')) {
          folderPath = extractImageKitFolderPath(imgUrl);
        }

        if (folderPath) {
          deleteComicFolderFromStorages(folderPath).catch(() => {});
        }
      }

      await turso.execute({ sql: `DELETE FROM chapter_pages WHERE chapter_id = ?;`, args: [chapterId] });
      await turso.execute({ sql: `DELETE FROM reading_history WHERE chapter_id = ?;`, args: [chapterId] });
      await turso.execute({ sql: `DELETE FROM chapters WHERE id = ?;`, args: [chapterId] });

      return NextResponse.json({ success: true, message: 'Chapter berhasil dihapus dari Turso.' });
    } catch (err: any) {
      console.warn('[Admin Chapter DELETE] Turso error:', err?.message);
    }
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
  }

  try {
    const { data: pages } = await supabase
      .from('chapter_pages')
      .select('image_url')
      .eq('chapter_id', chapterId)
      .limit(1);

    if (pages && pages.length > 0 && pages[0].image_url) {
      const imgUrl = pages[0].image_url;
      let folderPath: string | null = null;

      if (imgUrl.includes('/api/storage/onedrive')) {
        try {
          const urlObj = new URL(imgUrl, 'http://localhost');
          const filePath = urlObj.searchParams.get('path');
          if (filePath) {
            folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
          }
        } catch (e) {
          // ignore
        }
      } else if (imgUrl.includes('ik.imagekit.io')) {
        folderPath = extractImageKitFolderPath(imgUrl);
      }

      if (folderPath) {
        deleteComicFolderFromStorages(folderPath).then((result) => {
          console.log('[Storage Delete]', result);
        });
      }
    }

    await supabase.from('chapter_pages').delete().eq('chapter_id', chapterId);
    const { error } = await supabase.from('chapters').delete().eq('id', chapterId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Chapter berhasil dihapus beserta gambarnya di CDN.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Gagal menghapus chapter' }, { status: 500 });
  }
}
