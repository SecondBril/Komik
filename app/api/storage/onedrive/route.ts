import { NextRequest, NextResponse } from 'next/server';
import { getOneDriveDownloadUrl } from '@/lib/onedrive';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * GET /api/storage/onedrive?path=comics/slug/ch/1.webp
 * Mengambil link unduhan segar dari Microsoft Graph dan mengarahkan browser langsung
 * ke direct download CDN Microsoft dengan HTTP 307 Redirect dan header caching.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json(
      { success: false, error: 'Query parameter "path" diperlukan.' },
      { status: 400 }
    );
  }

  const cleanPath = filePath.replace(/^\/+/, '');

  try {
    // 1. Coba ambil URL unduhan langsung dari Microsoft OneDrive
    const downloadUrl = await getOneDriveDownloadUrl(cleanPath);

    if (downloadUrl) {
      // Redirect 307 ke CDN Microsoft dengan caching 1 jam di browser
      return NextResponse.redirect(downloadUrl, {
        status: 307,
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      });
    }
  } catch (err: any) {
    console.warn(`[OneDrive Proxy] Gagal mengambil download URL untuk ${cleanPath}:`, err?.message || err);
  }

  // 2. Fallback jika file tidak ditemukan di OneDrive: Cek ImageKit CDN
  const cdnBase = (process.env.R2_PUBLIC_CDN_URL || 'https://ik.imagekit.io/m2imafj66').replace(/\/$/, '');
  const imageKitCandidate = `${cdnBase}/${cleanPath}`;

  // 3. Fallback jika ada file lokal di /public/comics/
  try {
    const localPath = path.resolve(process.cwd(), 'public', cleanPath.startsWith('comics/') ? cleanPath : `comics/${cleanPath}`);
    if (fs.existsSync(localPath)) {
      const fileBuffer = fs.readFileSync(localPath);
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }
  } catch (localErr) {
    // Abaikan jika tidak ada file lokal
  }

  // Redirect ke ImageKit jika OneDrive tidak menemukan file
  return NextResponse.redirect(imageKitCandidate, {
    status: 307,
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  });
}
