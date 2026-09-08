import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { saveAndUploadWebP, validateImageBuffer } from '@/lib/webp-converter';

export async function POST(
  req: NextRequest,
  { params }: { params: { chapterId: string } }
) {
  const chapterId = params.chapterId;
  const supabase = createAdminClient();

  if (!supabase) {
    return NextResponse.json({ success: true, message: 'Retried chapter in mock state' });
  }

  // Helper to check if a page is already uploaded
  const isAlreadyUploaded = (url: string | null | undefined): boolean => {
    if (!url || typeof url !== 'string') return false;
    return (
      (url.includes('ik.imagekit.io') || url.includes('/api/storage/onedrive')) &&
      !url.includes('error') &&
      !url.includes('undefined')
    );
  };

  try {
    // 1. Fetch chapter metadata with comic info
    const { data: chapter, error: chErr } = await supabase
      .from('chapters')
      .select('*, comic:comics(*)')
      .eq('id', chapterId)
      .single();

    if (chErr || !chapter) {
      return NextResponse.json({ success: false, error: 'Chapter tidak ditemukan' }, { status: 404 });
    }

    // 2. Fetch all pages of this chapter
    const { data: pages, error: pErr } = await supabase
      .from('chapter_pages')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('page_number', { ascending: true });

    if (pErr) {
      return NextResponse.json({ success: false, error: pErr.message }, { status: 500 });
    }

    const allPages = pages || [];
    const missingPages = allPages.filter((p) => !isAlreadyUploaded(p.image_url));

    // If all pages are already uploaded and contiguous: mark published immediately!
    const isConsecutive = allPages.length >= 3 && allPages.every((p, idx) => p.page_number === idx + 1);
    if (missingPages.length === 0 && isConsecutive) {
      await supabase
        .from('chapters')
        .update({ status: 'published' })
        .eq('id', chapterId);

      return NextResponse.json({
        success: true,
        message: `Semua ${allPages.length} halaman sudah berhasil terunggah. Chapter ditandai published!`,
        published: true,
      });
    }

    // 3. Process ONLY missing/failed pages that have remote HTTP URLs
    let uploadedNow = 0;

    for (const page of missingPages) {
      if (!page.image_url || !page.image_url.startsWith('http')) {
        continue;
      }

      try {
        let referer = 'https://v1.westmanga.my/';
        try {
          referer = `${new URL(page.image_url).origin}/`;
        } catch {}

        const res = await fetch(page.image_url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': referer,
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        if (!validateImageBuffer(buffer)) {
          throw new Error('Buffer bukan format gambar valid');
        }

        const keyPath = `comics/${chapter.comic?.slug || 'comic'}/${chapter.chapter_number}/${page.page_number}.webp`;
        const cdnUrl = await saveAndUploadWebP(buffer, keyPath);

        if (cdnUrl && (cdnUrl.includes('ik.imagekit.io') || cdnUrl.includes('/api/storage/onedrive'))) {
          await supabase
            .from('chapter_pages')
            .update({ image_url: cdnUrl })
            .eq('id', page.id);
          uploadedNow++;
        }
      } catch (uploadErr: any) {
        console.warn(`[Retry Chapter] Gagal mengunggah halaman ${page.page_number}:`, uploadErr?.message);
      }
    }

    // 4. Re-verify chapter completeness
    const { data: finalPages } = await supabase
      .from('chapter_pages')
      .select('page_number, image_url')
      .eq('chapter_id', chapterId)
      .order('page_number', { ascending: true });

    const finalAllUploaded =
      finalPages &&
      finalPages.length >= 3 &&
      finalPages.every((p, idx) => p.page_number === idx + 1 && isAlreadyUploaded(p.image_url));

    if (finalAllUploaded) {
      await supabase
        .from('chapters')
        .update({ status: 'published' })
        .eq('id', chapterId);

      return NextResponse.json({
        success: true,
        message: `Berhasil mengunggah ${uploadedNow} gambar yang tertunda! Seluruh ${finalPages.length} halaman lengkap dan chapter kini published.`,
        published: true,
      });
    }

    // If still missing pages or some failed: keep as pending for scraper/image worker
    const nextRetry = (chapter.retry_count || 0) + 1;
    await supabase
      .from('chapters')
      .update({ status: 'pending', retry_count: nextRetry })
      .eq('id', chapterId);

    return NextResponse.json({
      success: true,
      message:
        uploadedNow > 0
          ? `Berhasil mengunggah ${uploadedNow} gambar. Sisa ${missingPages.length - uploadedNow} gambar sedang diantrekan ke worker.`
          : `Status di-reset ke pending (${missingPages.length} gambar belum terunggah) untuk diproses worker.`,
      published: false,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Gagal memproses retry' }, { status: 500 });
  }
}
