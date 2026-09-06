import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: true, data: [] });
  }

  const { data, error } = await supabase.from('sources').select('*').order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, base_url, scraping_config } = body;

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: true, message: 'Source added in local dev mode' });
  }

  const { data, error } = await supabase
    .from('sources')
    .insert({
      name,
      base_url,
      scraping_config: scraping_config || {},
      is_active: true,
    })
    .select();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, is_active } = body;

  if (!id) {
    return NextResponse.json({ success: false, error: 'Source ID missing' }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from('sources')
    .update({ is_active })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'Source ID missing' }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase.from('sources').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Sumber scraping berhasil dihapus.' });
}
