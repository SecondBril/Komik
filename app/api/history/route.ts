import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// GET /api/history — Ambil semua riwayat baca user dari Supabase (per chapter, data real)
export async function GET() {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('reading_history')
    .select(
      `
      id,
      comic_id,
      chapter_id,
      scroll_position,
      last_read_at,
      comic:comics(id, slug, title, cover_url, type, author, status, rating, alt_titles, synopsis, created_at, updated_at),
      chapter:chapters(id, comic_id, chapter_number, title, status, retry_count, released_at, created_at)
    `
    )
    .eq('user_id', user.id)
    .order('last_read_at', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data || [] });
}

// POST /api/history — Simpan chapter yang dibaca ke Supabase (single atau bulk upsert per user+chapter)
export async function POST(req: NextRequest) {
  const body = await req.json();

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ success: true, message: 'Saved to local session' });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Bukan error — guest tidak perlu cloud sync
    return NextResponse.json({ success: true, message: 'Guest session, not saved to cloud' });
  }

  // Normalisasi input: bisa single item { comic_id, chapter_id, ... } atau array { items: [...] }
  const rawItems: any[] = Array.isArray(body.items)
    ? body.items
    : (body.comic_id || body.chapter_id ? [body] : []);

  if (rawItems.length === 0) {
    return NextResponse.json({ success: false, error: 'No items provided' }, { status: 400 });
  }

  const isUuid = (val: any) =>
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const rowsToUpsert: Array<{
    user_id: string;
    comic_id: string;
    chapter_id: string;
    scroll_position: number;
    last_read_at: string;
  }> = [];

  for (const item of rawItems) {
    let comicId = item.comic_id;
    let chapterId = item.chapter_id;
    const comicSlug = item.comic_slug || item.comic?.slug;
    const chapterNumber =
      item.chapter_number !== undefined
        ? Number(item.chapter_number)
        : item.chapter?.chapter_number !== undefined
        ? Number(item.chapter.chapter_number)
        : undefined;
    const scrollPosition = Number(item.scroll_position) || 0;
    const lastReadAt = item.last_read_at || new Date().toISOString();

    // 1. Resolve comic_id jika bukan UUID
    if (!isUuid(comicId)) {
      const slugToLookup = comicSlug || comicId;
      if (slugToLookup) {
        const { data: comicRow } = await supabase
          .from('comics')
          .select('id')
          .eq('slug', slugToLookup)
          .maybeSingle();
        if (comicRow) {
          comicId = comicRow.id;
        }
      }
    }

    // 2. Resolve chapter_id jika bukan UUID
    if (!isUuid(chapterId) && isUuid(comicId) && chapterNumber !== undefined && !isNaN(chapterNumber)) {
      const { data: chRow } = await supabase
        .from('chapters')
        .select('id')
        .eq('comic_id', comicId)
        .eq('chapter_number', chapterNumber)
        .maybeSingle();
      if (chRow) {
        chapterId = chRow.id;
      }
    }

    // Validasi akhir: pastikan comicId dan chapterId sudah berbentuk UUID valid
    if (isUuid(comicId) && isUuid(chapterId)) {
      rowsToUpsert.push({
        user_id: user.id,
        comic_id: comicId,
        chapter_id: chapterId,
        scroll_position: scrollPosition,
        last_read_at: lastReadAt,
      });
    }
  }

  if (rowsToUpsert.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No matching database items to sync (items might be mock or removed)',
      synced: 0,
    });
  }

  // Deduplicate by chapter_id (keep latest)
  const dedupedMap = new Map<string, (typeof rowsToUpsert)[0]>();
  for (const row of rowsToUpsert) {
    dedupedMap.set(row.chapter_id, row);
  }
  const dedupedRows = Array.from(dedupedMap.values());

  const { data, error } = await supabase
    .from('reading_history')
    .upsert(dedupedRows, { onConflict: 'user_id,chapter_id' })
    .select();

  if (error) {
    console.error('[API History POST] Upsert error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: dedupedRows.length, data });
}

// DELETE /api/history — Hapus riwayat baca
// Query params:
//   ?chapterId=xxx  → hapus 1 chapter spesifik
//   ?comicId=xxx    → hapus semua chapter dari 1 komik
//   (tanpa param)   → hapus seluruh history user
export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ success: true });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const chapterId = searchParams.get('chapterId');
  const comicId = searchParams.get('comicId');

  let query = supabase.from('reading_history').delete().eq('user_id', user.id);

  if (chapterId) {
    query = query.eq('chapter_id', chapterId);
  } else if (comicId) {
    query = query.eq('comic_id', comicId);
  }
  // else: hapus semua history user ini

  const { error } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
