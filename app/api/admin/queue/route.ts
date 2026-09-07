import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
  }

  try {
    const { data: chapters, error } = await supabase
      .from('chapters')
      .select(`
        id,
        chapter_number,
        title,
        status,
        retry_count,
        released_at,
        created_at,
        comic:comics(title),
        pages:chapter_pages(count)
      `)
      .in('status', ['pending', 'processing', 'failed'])
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const formattedQueue = (chapters || []).map((ch: any) => ({
      id: ch.id,
      chapter_title: `Ch. ${ch.chapter_number}${ch.title ? ` - ${ch.title}` : ''}`,
      comic_title: ch.comic?.title || 'Unknown Comic',
      status: ch.status,
      progress_pages: ch.status === 'processing' ? Math.floor((ch.pages?.[0]?.count || 0) / 2) : 0,
      total_pages: ch.pages?.[0]?.count || 0,
      retry_count: ch.retry_count || 0,
      updated_at: ch.created_at,
    }));

    return NextResponse.json({ success: true, data: formattedQueue });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
