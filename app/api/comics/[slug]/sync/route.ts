import { NextRequest, NextResponse } from 'next/server';
import { syncSingleComic } from '@/lib/scraper/catalog-sync';

// POST /api/comics/[slug]/sync
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;
  if (!slug) {
    return NextResponse.json({ success: false, error: 'Slug is required' }, { status: 400 });
  }

  try {
    const result = await syncSingleComic(slug);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      comic: result.comic,
      chaptersCount: result.chaptersCount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Sync failed' },
      { status: 500 }
    );
  }
}
