import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchComicMetadata,
  searchComicMetadataList,
  enrichComicInDatabase,
  enrichAllDefaultComics,
} from '@/lib/comic-metadata';

// GET: Search candidates from 3rd party API (AniList / Kitsu)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') || searchParams.get('q') || '';

  if (!query.trim()) {
    return NextResponse.json(
      { success: false, error: 'Query parameter "query" or "q" is required' },
      { status: 400 }
    );
  }

  try {
    const results = await searchComicMetadataList(query.trim(), 8);
    return NextResponse.json({ success: true, data: results });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to search comics from external API' },
      { status: 500 }
    );
  }
}

// POST: Enrich single comic, batch enrich default comics, or fetch one metadata without saving
export async function POST(req: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Database admin connection missing' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { comicId, enrichAllDefaults, query, force } = body;

    // Case 1: Batch enrich all comics that have default/placeholder data
    if (enrichAllDefaults) {
      const summary = await enrichAllDefaultComics(supabase);
      return NextResponse.json({
        success: true,
        message: `Enrichment completed. ${summary.enriched} updated, ${summary.skipped} already complete.`,
        data: summary,
      });
    }

    // Case 2: Enrich a specific comic in database by ID
    if (comicId) {
      const result = await enrichComicInDatabase(supabase, comicId, { force: Boolean(force) });
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to enrich comic' },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        message: 'Comic data successfully enriched from external API.',
        data: result.data,
      });
    }

    // Case 3: Just fetch metadata for a query string (for frontend preview / auto-fill)
    if (query) {
      const metadata = await fetchComicMetadata(query);
      if (!metadata) {
        return NextResponse.json(
          { success: false, error: `No comic metadata found for "${query}"` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        data: metadata,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Provide either comicId, enrichAllDefaults, or query' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error during enrichment' },
      { status: 500 }
    );
  }
}
