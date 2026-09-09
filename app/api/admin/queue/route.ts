import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
  }

  const isAlreadyUploaded = (url: string | null | undefined): boolean => {
    if (!url || typeof url !== 'string') return false;
    return (
      (url.includes('ik.imagekit.io') || url.includes('/api/storage/onedrive')) &&
      !url.includes('error') &&
      !url.includes('undefined')
    );
  };

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
        comic:comics(title, slug),
        pages:chapter_pages(id, page_number, image_url)
      `)
      .in('status', ['pending', 'processing', 'failed'])
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const chapterIds = (chapters || []).map((ch: any) => ch.id);
    const logMap = new Map<string, string>();

    if (chapterIds.length > 0) {
      const { data: logs } = await supabase
        .from('ingest_logs')
        .select('chapter_id, message, level, created_at')
        .in('chapter_id', chapterIds)
        .order('created_at', { ascending: false });

      if (logs) {
        for (const log of logs) {
          if (log.chapter_id && !logMap.has(log.chapter_id)) {
            logMap.set(log.chapter_id, log.message);
          }
        }
      }
    }

    const formattedQueue = (chapters || []).map((ch: any) => {
      const allPages = ch.pages || [];
      const uploadedPages = allPages.filter((p: any) => isAlreadyUploaded(p.image_url)).length;

      return {
        id: ch.id,
        chapter_number: ch.chapter_number,
        chapter_title: `Ch. ${ch.chapter_number}${ch.title ? ` - ${ch.title}` : ''}`,
        comic_title: ch.comic?.title || 'Unknown Comic',
        comic_slug: ch.comic?.slug || '',
        status: ch.status,
        progress_pages: uploadedPages,
        total_pages: allPages.length,
        missing_pages: allPages.length - uploadedPages,
        retry_count: ch.retry_count || 0,
        last_error: logMap.get(ch.id) || null,
        updated_at: ch.created_at,
      };
    });

    return NextResponse.json({ success: true, data: formattedQueue });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
