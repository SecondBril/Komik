import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTursoClient } from '@/lib/turso';
import {
  getTursoReadingHistory,
  upsertTursoReadingHistory,
  deleteTursoReadingHistory,
} from '@/lib/queries/turso-comics';

// GET /api/history — Ambil semua riwayat baca user (Auth di Supabase, Data di Turso)
export async function GET() {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Auth not configured' }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Prioritaskan Turso (super cepat ~10ms, 0 Supabase disk/quota)
  if (getTursoClient()) {
    try {
      const tursoHistory = await getTursoReadingHistory(user.id);
      return NextResponse.json({ success: true, data: tursoHistory || [] });
    } catch (err) {
      console.warn('[History API GET] Turso query failed, falling back:', err);
    }
  }

  // 2. Fallback Supabase hanya jika Turso tidak aktif
  try {
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

// POST /api/history — Simpan chapter yang dibaca (Auth di Supabase, Storage di Turso)
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
    // Guest tidak disimpan ke cloud
    return NextResponse.json({ success: true, message: 'Guest session, not saved to cloud' });
  }

  const rawItems: any[] = Array.isArray(body.items)
    ? body.items
    : (body.comic_id || body.chapter_id ? [body] : []);

  if (rawItems.length === 0) {
    return NextResponse.json({ success: false, error: 'No items provided' }, { status: 400 });
  }

  const isUuid = (val: any) =>
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const turso = getTursoClient();
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
      if (slugToLookup && turso) {
        try {
          const cRes = await turso.execute({
            sql: `SELECT id FROM comics WHERE slug = ? LIMIT 1;`,
            args: [slugToLookup],
          });
          if (cRes.rows.length > 0) {
            comicId = String(cRes.rows[0].id);
          }
        } catch {
          // ignore
        }
      }
    }

    // 2. Resolve chapter_id jika bukan UUID
    if (!isUuid(chapterId) && isUuid(comicId) && chapterNumber !== undefined && !isNaN(chapterNumber) && turso) {
      try {
        const chRes = await turso.execute({
          sql: `SELECT id FROM chapters WHERE comic_id = ? AND chapter_number = ? LIMIT 1;`,
          args: [comicId, chapterNumber],
        });
        if (chRes.rows.length > 0) {
          chapterId = String(chRes.rows[0].id);
        }
      } catch {
        // ignore
      }
    }

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

  // Deduplicate by chapter_id
  const dedupedMap = new Map<string, (typeof rowsToUpsert)[0]>();
  for (const row of rowsToUpsert) {
    dedupedMap.set(row.chapter_id, row);
  }
  const dedupedRows = Array.from(dedupedMap.values());

  // 1. Simpan eksklusif ke Turso
  if (turso) {
    try {
      await upsertTursoReadingHistory(user.id, dedupedRows);
      return NextResponse.json({ success: true, count: dedupedRows.length, data: dedupedRows });
    } catch (tursoErr) {
      console.warn('[API History POST] Turso upsert warning:', tursoErr);
    }
  }

  // 2. Fallback Supabase jika Turso tidak tersedia
  try {
    const { data: supaData, error } = await supabase
      .from('reading_history')
      .upsert(dedupedRows, { onConflict: 'user_id,chapter_id' })
      .select();

    if (error) {
      console.warn('[API History POST] Supabase upsert error:', error.message);
    }

    return NextResponse.json({ success: true, count: dedupedRows.length, data: supaData });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Save error' }, { status: 500 });
  }
}

// DELETE /api/history — Hapus riwayat baca (Auth di Supabase, Storage di Turso)
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

  // 1. Hapus dari Turso
  if (getTursoClient()) {
    try {
      await deleteTursoReadingHistory(user.id, {
        chapterId: chapterId || undefined,
        comicId: comicId || undefined,
      });
      return NextResponse.json({ success: true });
    } catch (tursoErr) {
      console.warn('[API History DELETE] Turso error:', tursoErr);
    }
  }

  // 2. Fallback Supabase jika Turso tidak aktif
  try {
    let query = supabase.from('reading_history').delete().eq('user_id', user.id);
    if (chapterId) {
      query = query.eq('chapter_id', chapterId);
    } else if (comicId) {
      query = query.eq('comic_id', comicId);
    }
    await query;
  } catch (err) {
    console.warn('[API History DELETE] Supabase error:', err);
  }

  return NextResponse.json({ success: true });
}
