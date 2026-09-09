import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteComicFolderFromStorages } from '@/lib/storage-manager';
import { getSharedPuppeteerBrowser, scrapeChapterPageWithPuppeteer } from '@/workers/scraper/parse-source';

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
    const comicTitle = chapter.comic?.title || 'Comic';
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

    // 4. Try to re-scrape fresh pages directly if Puppeteer is available
    let freshPagesCount = 0;
    const browser = await getSharedPuppeteerBrowser().catch(() => null);

    if (browser) {
      try {
        // Construct common URL pattern for chapter reader
        const candidateUrls = [
          `https://v1.westmanga.my/view/${comicSlug}-chapter-${chapterNumber}-bahasa-indonesia/`,
          `https://v1.westmanga.my/view/${comicSlug}-chapter-${chapterNumber}/`,
          `https://v1.westmanga.my/view/${comicSlug}-ch-${chapterNumber}-bahasa-indonesia/`,
        ];

        let scrapedData = null;
        for (const url of candidateUrls) {
          scrapedData = await scrapeChapterPageWithPuppeteer(
            browser,
            url,
            comicTitle,
            comicSlug,
            chapterNumber
          );
          if (scrapedData && scrapedData.rawImageUrls.length >= 3) {
            break;
          }
        }

        if (scrapedData && scrapedData.rawImageUrls.length > 0) {
          const pagesToInsert = scrapedData.rawImageUrls.map((url, idx) => ({
            chapter_id: chapter.id,
            page_number: idx + 1,
            image_url: url,
          }));

          await supabase.from('chapter_pages').insert(pagesToInsert);
          freshPagesCount = pagesToInsert.length;
        }
      } finally {
        await browser.close().catch(() => {});
      }
    }

    // 5. Reset chapter status to pending with clean retry_count
    await supabase
      .from('chapters')
      .update({
        status: 'pending',
        retry_count: 0,
      })
      .eq('id', chapterId);

    // 6. Record informative log in ingest_logs
    await supabase.from('ingest_logs').insert({
      chapter_id: chapterId,
      level: 'info',
      message:
        freshPagesCount > 0
          ? `[Re-ingest] Halaman corrupt dibersihkan dan ${freshPagesCount} gambar fresh diekstrak ulang oleh Admin. Status: pending.`
          : `[Re-ingest] Halaman corrupt dibersihkan dan status di-reset ke pending oleh Admin. Menunggu antrian scraper/image worker.`,
    });

    return NextResponse.json({
      success: true,
      message:
        freshPagesCount > 0
          ? `Berhasil membersihkan dan mengekstrak ulang ${freshPagesCount} halaman fresh untuk Ch. ${chapterNumber}. Status kini 'pending' untuk upload.`
          : `Berhasil membersihkan data halaman Ch. ${chapterNumber}. Status di-reset ke 'pending' untuk diproses ulang oleh worker.`,
      pages_count: freshPagesCount,
    });
  } catch (err: any) {
    console.error('[Reingest API Error]:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Gagal re-ingest chapter' }, { status: 500 });
  }
}
