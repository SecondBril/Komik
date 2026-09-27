import { NextRequest, NextResponse } from 'next/server';
import { getTursoClient } from '@/lib/turso';
import { getTursoComicRelations, saveTursoComicRelations } from '@/lib/queries/turso-comics';
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

  // ── STEP 1: Check Turso Cache First ───────────────────────────────────────
  if (turso && comicId && !forceRefresh) {
    try {
      const cached = await getTursoComicRelations(comicId);
      if (cached && Array.isArray(cached.franchise_relations)) {
        const cacheAgeDays =
          (Date.now() - new Date(cached.updated_at).getTime()) / (1000 * 60 * 60 * 24);

        // Valid for 14 days before needing refresh
        if (cacheAgeDays < 14) {
          return NextResponse.json(
            {
              success: true,
              storage: 'turso_database',
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
      console.warn('[Relations API] Turso cache read warning:', err);
    }
  }

  // ── STEP 2: On-Demand Fetch from Multi-Source APIs ────────────────────────
  try {
    const fullRelations = await fetchFullComicRelations(comicTitle);

    // Cross-reference with comics in Turso to attach local reading links
    if (turso) {
      try {
        const allComicsRes = await turso.execute(`SELECT id, title, slug, cover_url FROM comics;`);
        const allComics = allComicsRes.rows;

        if (allComics && allComics.length > 0) {
          const findLocal = (title: string) => {
            const clean = title.toLowerCase().replace(/[^a-z0-9]/g, '');
            return allComics.find((c: any) => {
              const cClean = String(c.title).toLowerCase().replace(/[^a-z0-9]/g, '');
              return clean.includes(cClean) || cClean.includes(clean);
            });
          };

          // Link franchise relations
          fullRelations.franchiseRelations.forEach((rel) => {
            const match = findLocal(rel.title) as any;
            if (match && match.slug !== slug) {
              rel.local_slug = String(match.slug);
              if (!rel.cover_url && match.cover_url) rel.cover_url = String(match.cover_url);
            }
          });

          // Link recommendations
          fullRelations.recommendations.forEach((rec) => {
            const match = findLocal(rec.title) as any;
            if (match && match.slug !== slug) {
              rec.local_slug = String(match.slug);
              if (!rec.cover_url && match.cover_url) rec.cover_url = String(match.cover_url);
            }
          });
        }
      } catch (e) {
        console.warn('[Relations API] Cross-reference warning:', e);
      }
    }

    // ── STEP 3: Persist into Turso Database ──────────────────────────────────
    if (turso && comicId) {
      try {
        await saveTursoComicRelations(comicId, {
          franchise_relations: fullRelations.franchiseRelations,
          recommendations: fullRelations.recommendations,
          characters: fullRelations.characters,
          sources_used: fullRelations.sourcesUsed,
        });
      } catch (err: any) {
        console.warn('[Relations API] Failed to persist cache in Turso:', err?.message);
      }
    }

    return NextResponse.json(
      {
        success: true,
        storage: 'api_synced_to_turso',
        data: fullRelations,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (err: any) {
    console.error('[Relations API] Exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process franchise relations' },
      { status: 500 }
    );
  }
}
