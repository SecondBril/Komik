import { NextRequest, NextResponse } from 'next/server';
import { getComicBySlug } from '@/lib/queries/comics';
import { getComicChapters } from '@/lib/queries/chapters';
import { getComicAdaptations } from '@/lib/queries/adaptations';

export async function GET(
  req: NextRequest,
  context: { params: { slug: string } | Promise<{ slug: string }> }
) {
  const resolvedParams = await context.params;
  const slug = resolvedParams?.slug;

  if (!slug) {
    return NextResponse.json(
      { success: false, error: 'Slug komik wajib diisi' },
      { status: 400 }
    );
  }

  try {
    const [comic, chapters] = await Promise.all([
      getComicBySlug(slug),
      getComicChapters(slug),
    ]);

    if (!comic) {
      return NextResponse.json(
        { success: false, error: 'Komik tidak ditemukan di database' },
        { status: 404 }
      );
    }

    const adaptations = await getComicAdaptations(comic.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          comic,
          chapters,
          adaptations,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error: any) {
    console.error(`[API /api/comics/${slug}] Error:`, error);
    return NextResponse.json(
      { success: false, error: 'Gagal memuat detail komik dari database' },
      { status: 500 }
    );
  }
}
