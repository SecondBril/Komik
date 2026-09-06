import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { MOCK_COMICS, MOCK_CHAPTERS } from '@/lib/mock-data';

export async function GET() {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ success: true, data: [] });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('reading_history')
    .select(`
      *,
      comic:comics(*),
      chapter:chapters(*)
    `)
    .eq('user_id', user.id)
    .order('last_read_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: true, message: 'Guest session' });
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
      { onConflict: 'user_id,comic_id' }
    )
    .select();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ success: true });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const comicId = searchParams.get('comicId');

  let query = supabase.from('reading_history').delete().eq('user_id', user.id);
  if (comicId) {
    query = query.eq('comic_id', comicId);
  }

  const { error } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
