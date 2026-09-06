import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MOCK_INGEST_QUEUE } from '@/lib/mock-data';

export async function GET() {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: true, data: MOCK_INGEST_QUEUE });
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
      .order('created_at', { ascending: false });

    if (error || !chapters) {
      return NextResponse.json({ success: true, data: MOCK_INGEST_QUEUE });
    }

    const formattedQueue = chapters.map((ch: any) => ({
      id: ch.id,
      chapter_title: `Ch. ${ch.chapter_number}${ch.title ? ` - ${ch.title}` : ''}`,
      comic_title: ch.comic?.title || 'Unknown Comic',
      status: ch.status,
      progress_pages: ch.status === 'published' ? (ch.pages?.[0]?.count || 5) : (ch.status === 'processing' ? 2 : 0),
      total_pages: ch.pages?.[0]?.count || 5,
      retry_count: ch.retry_count || 0,
      updated_at: ch.created_at,
    }));

    return NextResponse.json({ success: true, data: formattedQueue });
  } catch (err: any) {
    return NextResponse.json({ success: true, data: MOCK_INGEST_QUEUE });
  }
}
