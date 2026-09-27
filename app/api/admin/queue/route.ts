import { NextResponse } from 'next/server';
import { getTursoClient } from '@/lib/turso';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const isAlreadyUploaded = (url: string | null | undefined): boolean => {
    if (!url || typeof url !== 'string') return false;
    return (
      (url.includes('ik.imagekit.io') || url.includes('/api/storage/onedrive')) &&
      !url.includes('error') &&
      !url.includes('undefined')
    );
  };

  const turso = getTursoClient();
  if (turso) {
    try {
      const res = await turso.execute(`
        SELECT ch.id, ch.chapter_number, ch.title, ch.status, ch.retry_count, ch.released_at, ch.created_at,
               c.title as comic_title, c.slug as comic_slug,
               (SELECT COUNT(*) FROM chapter_pages cp WHERE cp.chapter_id = ch.id) as total_pages,
               (SELECT COUNT(*) FROM chapter_pages cp WHERE cp.chapter_id = ch.id AND (cp.image_url LIKE '%ik.imagekit.io%' OR cp.image_url LIKE '%/api/storage/onedrive%')) as uploaded_pages
        FROM chapters ch
        LEFT JOIN comics c ON c.id = ch.comic_id
        WHERE ch.status IN ('pending', 'processing', 'failed')
        ORDER BY ch.created_at DESC
        LIMIT 100;
      `);

      const formatted = res.rows.map((r: any) => {
        const totalPages = Number(r.total_pages || 0);
        const uploadedPages = Number(r.uploaded_pages || 0);
        return {
          id: String(r.id),
          chapter_number: Number(r.chapter_number),
          chapter_title: `Ch. ${r.chapter_number}${r.title ? ` - ${r.title}` : ''}`,
          comic_title: String(r.comic_title || 'Unknown Comic'),
          comic_slug: String(r.comic_slug || ''),
          status: String(r.status || 'pending'),
          progress_pages: uploadedPages,
          total_pages: totalPages,
          missing_pages: Math.max(0, totalPages - uploadedPages),
          retry_count: Number(r.retry_count || 0),
          last_error: null,
          updated_at: String(r.created_at),
        };
      });

      return NextResponse.json({ success: true, data: formatted });
    } catch (err: any) {
      console.warn('[Admin Queue GET] Turso error:', err?.message);
    }
  }

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
