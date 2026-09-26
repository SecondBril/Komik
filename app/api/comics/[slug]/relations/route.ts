import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTursoClient } from '@/lib/turso';
import { fetchFullComicRelations } from '@/lib/adaptation-service';
import { MOCK_COMICS } from '@/lib/mock-data';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const { searchParams } = new URL(req.url);
  const forceRefresh = searchParams.get('refresh') === 'true';

  if (!slug) {
    return NextResponse.json({ success: false, error: 'Slug is required' }, { status: 400 });
  }

  const turso = getTursoClient();
  const supabase = createAdminClient();
  let comicTitle = '';
  let comicId: string | null = null;

  if (turso) {
    try {
      const res = await turso.execute({
        sql: `SELECT id, title, slug FROM comics WHERE slug = ? LIMIT 1;`,
        args: [slug],
      });
      if (res.rows.length > 0) {
        comicTitle = String(res.rows[0].title);
        comicId = String(res.rows[0].id);
      }
    } catch (tErr) {
      console.warn('[Relations API] Turso lookup warning:', tErr);
    }
  }

  if (!comicTitle && supabase) {
    try {
      const { data: comic } = await supabase
        .from('comics')
        .select('id, title, slug')
        .eq('slug', slug)
        .maybeSingle();

      if (comic?.title) {
        comicTitle = comic.title;
        comicId = comic.id;
      }
    } catch (err) {
      console.warn('[Relations API] Supabase fetch warning:', err);
    }
  }

  // Fallback to mock data if not in DB
  if (!comicTitle) {
    const mock = MOCK_COMICS.find((c) => c.slug === slug);
    if (mock) {
      comicTitle = mock.title;
      comicId = mock.id;
    } else {
      comicTitle = slug.replace(/[_-]/g, ' ');
    }
  }

  // ── HYBRID STEP 1: Check Database Cache First ─────────────────────────────
  if (supabase && comicId && !forceRefresh) {
    try {
      const { data: cached } = await supabase
        .from('comic_relations_cache')
        .select('*')
        .eq('comic_id', comicId)
        .maybeSingle();

      if (cached && Array.isArray(cached.franchise_relations)) {
        const cacheAgeDays =
          (Date.now() - new Date(cached.updated_at).getTime()) / (1000 * 60 * 60 * 24);

        // Valid for 14 days before needing refresh
        if (cacheAgeDays < 14) {
          return NextResponse.json(
            {
              success: true,
              storage: 'database',
              data: {
                title: comicTitle,
                adaptationCandidates: [],
                franchiseRelations: cached.franchise_relations,
                recommendations: cached.recommendations,
                characters: cached.characters,
                sourcesUsed: cached.sources_used,
                cachedAt: cached.updated_at,
              },
            },
            {
              headers: {
                'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
              },
            }
          );
        }
      }
    } catch (err) {
      console.warn('[Relations API] Cache read warning:', err);
    }
  }

  // ── HYBRID STEP 2: On-Demand Fetch from Multi-Source APIs ──────────────────
  try {
    const fullRelations = await fetchFullComicRelations(comicTitle);

    // Cross-reference with all comics in DB to attach local reading links
    if (supabase) {
      try {
        const { data: allComics } = await supabase
          .from('comics')
          .select('id, title, slug, cover_url');

        if (allComics && allComics.length > 0) {
          const findLocal = (title: string) => {
            const clean = title.toLowerCase().replace(/[^a-z0-9]/g, '');
            return allComics.find((c) => {
              const cClean = c.title.toLowerCase().replace(/[^a-z0-9]/g, '');
              return clean.includes(cClean) || cClean.includes(clean);
            });
          };

          // Link franchise relations
          fullRelations.franchiseRelations.forEach((rel) => {
            const match = findLocal(rel.title);
            if (match && match.slug !== slug) {
              rel.local_slug = match.slug;
              if (!rel.cover_url && match.cover_url) rel.cover_url = match.cover_url;
            }
          });

          // Link recommendations
          fullRelations.recommendations.forEach((rec) => {
            const match = findLocal(rec.title);
            if (match && match.slug !== slug) {
              rec.local_slug = match.slug;
              if (!rec.cover_url && match.cover_url) rec.cover_url = match.cover_url;
            }
          });
        }
      } catch (e) {
        console.warn('[Relations API] Cross-reference warning:', e);
      }
    }

    // ── HYBRID STEP 3: Persist into Supabase Database ────────────────────────
    if (supabase && comicId) {
      try {
        await supabase
          .from('comic_relations_cache')
          .upsert(
            {
              comic_id: comicId,
              franchise_relations: fullRelations.franchiseRelations,
              recommendations: fullRelations.recommendations,
              characters: fullRelations.characters,
              sources_used: fullRelations.sourcesUsed,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'comic_id' }
          );
      } catch (err: any) {
        console.warn('[Relations API] Failed to persist cache in DB:', err?.message);
      }
    }

    return NextResponse.json(
      {
        success: true,
        storage: 'api_synced_to_database',
        data: fullRelations,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (err: any) {
    console.error('[Relations API] Failed to fetch relations:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
