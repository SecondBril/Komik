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

// POST /api/history — Simpan chapter yang dibaca ke Supabase (upsert per user+chapter)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { comic_id, chapter_id, scroll_position } = body;

  if (!comic_id || !chapter_id) {
    return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
  }

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

  const { data, error } = await supabase
    .from('reading_history')
    .upsert(
      {
        user_id: user.id,
        comic_id,
        chapter_id,
        scroll_position: scroll_position || 0,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,chapter_id' }
    )
    .select();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
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
