import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteComicFolderFromStorages } from '@/lib/storage-manager';

export async function POST(
  req: NextRequest,
  { params }: { params: { chapterId: string } }
) {
  const chapterId = params.chapterId;
  const supabase = createAdminClient();

  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
  }

  try {
    // 1. Fetch chapter metadata and comic info
    const { data: chapter, error: chErr } = await supabase
      .from('chapters')
      .select('*, comic:comics(*)')
      .eq('id', chapterId)
      .single();

    if (chErr || !chapter) {
      return NextResponse.json({ success: false, error: 'Chapter tidak ditemukan' }, { status: 404 });
    }

    const comicSlug = chapter.comic?.slug;
    const chapterNumber = chapter.chapter_number;

    // 2. Delete corrupt / old pages in DB
    await supabase.from('chapter_pages').delete().eq('chapter_id', chapterId);

    // 3. Delete old/corrupt cloud storage folder in background
    if (comicSlug && chapterNumber) {
      const folderPath = `comics/${comicSlug}/${chapterNumber}`;
      deleteComicFolderFromStorages(folderPath).catch((err) => {
        console.warn('[Reingest] Gagal hapus folder storage:', err?.message);
      });
    }

    // 4. Reset chapter status to pending with clean retry_count
    await supabase
      .from('chapters')
      .update({
        status: 'pending',
        retry_count: 0,
      })
      .eq('id', chapterId);

    // 5. Record informative log in ingest_logs
    await supabase.from('ingest_logs').insert({
      chapter_id: chapterId,
      level: 'info',
      message: `[Re-ingest] Seluruh halaman corrupt dibersihkan dan status di-reset ke pending oleh Admin. Chapter siap di-scrape dan diunggah ulang oleh worker.`,
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil membersihkan data halaman Ch. ${chapterNumber}. Status di-reset ke 'pending' untuk di-scrape dan diunggah ulang secara bersih oleh worker.`,
    });
  } catch (err: any) {
    console.error('[Reingest API Error]:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Gagal re-ingest chapter' }, { status: 500 });
  }
}
