import { NextRequest, NextResponse } from 'next/server';
import { getTursoClient } from '@/lib/turso';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const turso = getTursoClient();
  if (turso) {
    try {
      const res = await turso.execute(`SELECT id, name, base_url, scraping_config, is_active, created_at FROM sources ORDER BY created_at DESC;`);
      const data = res.rows.map((r: any) => ({
        id: String(r.id),
        name: String(r.name),
        base_url: String(r.base_url),
        scraping_config: typeof r.scraping_config === 'string' ? JSON.parse(r.scraping_config) : (r.scraping_config || {}),
        is_active: Boolean(r.is_active),
        created_at: String(r.created_at),
      }));
      return NextResponse.json({ success: true, data });
    } catch (err: any) {
      console.warn('[Admin Sources GET] Turso error:', err?.message);
    }
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    const { data, error } = await supabase.from('sources').select('*').order('created_at', { ascending: false });
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, base_url, scraping_config } = body;

  const turso = getTursoClient();
  if (turso) {
    try {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `src_${Date.now()}`;
      const now = new Date().toISOString();
      await turso.execute({
        sql: `INSERT INTO sources (id, name, base_url, scraping_config, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?);`,
        args: [id, name, base_url, JSON.stringify(scraping_config || {}), now],
      });
      return NextResponse.json({
        success: true,
        data: [{ id, name, base_url, scraping_config: scraping_config || {}, is_active: true, created_at: now }],
      });
    } catch (err: any) {
      console.warn('[Admin Sources POST] Turso error:', err?.message);
    }
  }

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

  const turso = getTursoClient();
  if (turso) {
    try {
      await turso.execute({
        sql: `UPDATE sources SET is_active = ? WHERE id = ?;`,
        args: [is_active ? 1 : 0, id],
      });
      return NextResponse.json({ success: true });
    } catch (err: any) {
      console.warn('[Admin Sources PATCH] Turso error:', err?.message);
    }
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

  const turso = getTursoClient();
  if (turso) {
    try {
      await turso.execute({
        sql: `DELETE FROM sources WHERE id = ?;`,
        args: [id],
      });
      return NextResponse.json({ success: true, message: 'Sumber scraping berhasil dihapus dari Turso.' });
    } catch (err: any) {
      console.warn('[Admin Sources DELETE] Turso error:', err?.message);
    }
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
