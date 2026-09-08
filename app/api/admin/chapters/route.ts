import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractImageKitFolderPath } from '@/lib/imagekit-admin';
import { deleteComicFolderFromStorages } from '@/lib/storage-manager';

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

export async function PUT(req: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { id, chapter_number, title, status, page_order } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Parameter id chapter wajib diisi' }, { status: 400 });
    }

    // 1. Update chapter metadata
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

    // 2. Reorder pages if provided: array of { id, page_number }
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

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
  }

  try {
    // 1. Fetch page URLs to delete from ImageKit
    const { data: pages } = await supabase
      .from('chapter_pages')
      .select('image_url')
      .eq('chapter_id', chapterId)
      .limit(1); // Just need one URL to extract folder path

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
        // Fire-and-forget; don't block deletion on cloud storage response
        deleteComicFolderFromStorages(folderPath).then((result) => {
          console.log('[Storage Delete]', result);
        });
      }
    }

    // 2. Delete pages of this chapter from DB
    await supabase.from('chapter_pages').delete().eq('chapter_id', chapterId);

    // 3. Delete chapter record from DB
    const { error } = await supabase.from('chapters').delete().eq('id', chapterId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Chapter berhasil dihapus beserta gambarnya di CDN.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Gagal menghapus chapter' }, { status: 500 });
  }
}
