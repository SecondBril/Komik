import { NextRequest, NextResponse } from 'next/server';
import { syncWestmangaComics } from '@/lib/scraper/catalog-sync';

// GET /api/cron/sync-comics?pages=1
// POST /api/cron/sync-comics
export async function GET(req: NextRequest) {
  return handleSync(req);
}

export async function POST(req: NextRequest) {
  return handleSync(req);
}

async function handleSync(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cronSecret = process.env.CRON_SECRET || 'westmanga_sync_secret';

  // Verifikasi otentikasi cron (Authorization Bearer atau header x-cron-secret)
  const authHeader = req.headers.get('authorization') || '';
  const customHeader = req.headers.get('x-cron-secret') || '';
  const querySecret = searchParams.get('secret') || '';

  const isAuthorized =
    authHeader === `Bearer ${cronSecret}` ||
    customHeader === cronSecret ||
    querySecret === cronSecret ||
    process.env.NODE_ENV === 'development';

  if (!isAuthorized) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized. Secret key diperlukan.' },
      { status: 401 }
    );
  }

  const pages = Math.min(10, Math.max(1, Number(searchParams.get('pages')) || 1));

  try {
    console.log(`[Cron Sync] Triggering auto-sync for ${pages} page(s)...`);
    const stats = await syncWestmangaComics({ maxPages: pages });

    return NextResponse.json({
      success: true,
      message: `Sync selesai. ${stats.newComicsAdded} komik baru dan ${stats.newChaptersAdded} chapter baru berhasil didaftarkan.`,
      stats,
    });
  } catch (err: any) {
    console.error('[Cron Sync Error]:', err?.message || err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Gagal menjalankan sinkronisasi komik.',
      },
      { status: 500 }
    );
  }
}
