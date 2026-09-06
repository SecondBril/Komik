import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { saveAndUploadWebP } from '@/lib/webp-converter';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
  }

  try {
    const formData = await req.formData();

    const isNewComic = formData.get('isNewComic') === 'true';
    let comicId = formData.get('comicId') as string;
    let comicTitle = formData.get('title') as string || '';
    let comicSlug = formData.get('slug') as string || slugify(comicTitle);
    const type = (formData.get('type') as string) || 'manhwa';
    const synopsis = (formData.get('synopsis') as string) || '';
    const author = (formData.get('author') as string) || 'Unknown Author';
    const comicStatus = (formData.get('status') as string) || 'ongoing';

    const chapterNumberRaw = formData.get('chapterNumber') as string;
    const chapterNumber = parseFloat(chapterNumberRaw || '1');
    const chapterTitle = (formData.get('chapterTitle') as string) || `Chapter ${chapterNumber}`;

    // 1. Process New Comic Creation
    if (isNewComic) {
      if (!comicTitle) {
        return NextResponse.json({ success: false, error: 'Judul komik wajib diisi.' }, { status: 400 });
      }

      const coverFile = formData.get('coverFile') as File | null;
      let coverUrl = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

      if (coverFile && coverFile.size > 0) {
        const coverArrayBuffer = await coverFile.arrayBuffer();
        const coverBuffer = Buffer.from(coverArrayBuffer);
        coverUrl = await saveAndUploadWebP(coverBuffer, `comics/${comicSlug}/cover.webp`);
      }

      // Check if comic slug already exists
      const { data: existingComic } = await supabase
        .from('comics')
        .select('id, slug, title')
        .eq('slug', comicSlug)
        .maybeSingle();

      if (existingComic) {
        comicId = existingComic.id;
      } else {
        const { data: newComic, error: comicErr } = await supabase
          .from('comics')
          .insert({
            slug: comicSlug,
            title: comicTitle,
            type,
            synopsis: synopsis || `Komik ${comicTitle} terjemahan Bahasa Indonesia.`,
            cover_url: coverUrl,
            author: author || 'Unknown Author',
            status: comicStatus,
            rating: 4.9,
          })
          .select('id, slug, title')
          .single();

        if (comicErr || !newComic) {
          return NextResponse.json({ success: false, error: `Gagal membuat komik baru: ${comicErr?.message}` }, { status: 500 });
        }
        comicId = newComic.id;
      }
    } else {
      if (!comicId) {
        return NextResponse.json({ success: false, error: 'Pilih komik yang sudah ada.' }, { status: 400 });
      }
      // Fetch existing comic slug
      const { data: existingComic } = await supabase
        .from('comics')
        .select('id, slug, title')
        .eq('id', comicId)
        .single();

      if (existingComic) {
        comicSlug = existingComic.slug;
        comicTitle = existingComic.title;
      }
    }

    // 2. Find or Create Chapter Record
    let { data: chapter } = await supabase
      .from('chapters')
      .select('id')
      .eq('comic_id', comicId)
      .eq('chapter_number', chapterNumber)
      .maybeSingle();

    if (!chapter) {
      const { data: newChapter, error: chErr } = await supabase
        .from('chapters')
        .insert({
          comic_id: comicId,
          chapter_number: chapterNumber,
          title: chapterTitle,
          status: 'published',
          released_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (chErr || !newChapter) {
        return NextResponse.json({ success: false, error: `Gagal membuat chapter: ${chErr?.message}` }, { status: 500 });
      }
      chapter = newChapter;
    } else {
      // Update chapter status to 'published'
      await supabase
        .from('chapters')
        .update({ status: 'published', title: chapterTitle, released_at: new Date().toISOString() })
        .eq('id', chapter.id);
    }

    // 3. Process Chapter Pages Upload & WebP Conversion
    const pageFiles = formData.getAll('pageFiles') as File[];
    if (!pageFiles || pageFiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Komik & Chapter berhasil dibuat tanpa halaman gambar.',
        comicId,
        chapterId: chapter.id,
        totalPages: 0,
      });
    }

    // Delete existing pages for re-upload
    await supabase.from('chapter_pages').delete().eq('chapter_id', chapter.id);

    const pageRecords = [];
    for (let i = 0; i < pageFiles.length; i++) {
      const file = pageFiles[i];
      const pageNumber = i + 1;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const keyPath = `comics/${comicSlug}/${chapterNumber}/${pageNumber}.webp`;
      const webpUrl = await saveAndUploadWebP(buffer, keyPath);

      pageRecords.push({
        chapter_id: chapter.id,
        page_number: pageNumber,
        image_url: webpUrl,
      });
    }

    const { error: pageErr } = await supabase.from('chapter_pages').insert(pageRecords);
    if (pageErr) {
      return NextResponse.json({ success: false, error: `Gagal menyimpan daftar halaman: ${pageErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mengunggah ${pageFiles.length} halaman untuk "${comicTitle}" Ch. ${chapterNumber} (WebP Compressed)!`,
      comicId,
      comicSlug,
      chapterId: chapter.id,
      chapterNumber,
      totalPages: pageFiles.length,
    });
  } catch (err: any) {
    console.error('[Manual Upload Error]:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Server error saat upload' }, { status: 500 });
  }
}
