import { NextRequest, NextResponse } from 'next/server';
import { getTursoClient } from '@/lib/turso';
import { getTursoComicRelations, saveTursoComicRelations } from '@/lib/queries/turso-comics';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchFullComicRelations } from '@/lib/adaptation-service';
import { FranchiseRelation, ComicRecommendation, ComicCharacter } from '@/lib/types';

// GET: Load cached relations & recommendations for a comic
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const comicId = searchParams.get('comicId');

  if (!comicId) {
    return NextResponse.json({ success: false, error: 'comicId is required' }, { status: 400 });
  }

  // 1. Prioritize Turso
  if (getTursoClient()) {
    try {
      const data = await getTursoComicRelations(comicId);
      return NextResponse.json({
        success: true,
        data: data || {
          comic_id: comicId,
          franchise_relations: [],
          recommendations: [],
          characters: [],
          sources_used: [],
        },
      });
    } catch (err: any) {
      console.warn('[Admin Relations GET] Turso error:', err?.message);
    }
  }

  const supabase = createAdminClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('comic_relations_cache')
        .select('*')
        .eq('comic_id', comicId)
        .maybeSingle();

      if (!error && data) {
        return NextResponse.json({ success: true, data });
      }
    } catch (err: any) {
      console.warn('[Admin Relations GET] Supabase fallback error:', err?.message);
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      comic_id: comicId,
      franchise_relations: [],
      recommendations: [],
      characters: [],
      sources_used: [],
    },
  });
}

// PUT: Save admin edited relations, recommendations, and characters
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      comic_id,
      franchise_relations,
      recommendations,
      characters,
      sources_used,
    } = body;

    if (!comic_id) {
      return NextResponse.json({ success: false, error: 'comic_id is required' }, { status: 400 });
    }

    if (getTursoClient()) {
      await saveTursoComicRelations(comic_id, {
        franchise_relations: Array.isArray(franchise_relations) ? franchise_relations : [],
        recommendations: Array.isArray(recommendations) ? recommendations : [],
        characters: Array.isArray(characters) ? characters : [],
        sources_used: Array.isArray(sources_used) ? sources_used : ['Admin'],
      });
      return NextResponse.json({ success: true, data: { comic_id } });
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('comic_relations_cache')
      .upsert(
        {
          comic_id,
          franchise_relations: Array.isArray(franchise_relations) ? franchise_relations : [],
          recommendations: Array.isArray(recommendations) ? recommendations : [],
          characters: Array.isArray(characters) ? characters : [],
          sources_used: Array.isArray(sources_used) ? sources_used : ['Admin'],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'comic_id' }
      )
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

// POST: Trigger fresh API sync for a comic
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const comicId = searchParams.get('comicId');

  if (!comicId) {
    return NextResponse.json({ success: false, error: 'comicId is required' }, { status: 400 });
  }

  const turso = getTursoClient();
  let comicTitle = '';

  if (turso) {
    try {
      const res = await turso.execute({
        sql: `SELECT id, title, slug FROM comics WHERE id = ? LIMIT 1;`,
        args: [comicId],
      });
      if (res.rows.length > 0) {
        comicTitle = String(res.rows[0].title);
      }
    } catch (e: any) {
      console.warn('[Admin Relations POST] Turso lookup error:', e?.message);
    }
  }

  if (!comicTitle) {
    const supabase = createAdminClient();
    if (supabase) {
      const { data: comic } = await supabase
        .from('comics')
        .select('id, title, slug')
        .eq('id', comicId)
        .maybeSingle();
      if (comic?.title) comicTitle = comic.title;
    }
  }

  if (!comicTitle) {
    return NextResponse.json({ success: false, error: 'Comic not found' }, { status: 404 });
  }

  try {
    // 2. Fetch fresh multi-source data
    const fullRelations = await fetchFullComicRelations(comicTitle);

    // 3. Link local comics
    if (turso) {
      try {
        const allComicsRes = await turso.execute(`SELECT id, title, slug, cover_url FROM comics;`);
        const allComics = allComicsRes.rows;

        const findLocal = (title: string) => {
          const clean = title.toLowerCase().replace(/[^a-z0-9]/g, '');
          return allComics.find((c: any) => {
            const cClean = String(c.title).toLowerCase().replace(/[^a-z0-9]/g, '');
            return clean.includes(cClean) || cClean.includes(clean);
          });
        };

        fullRelations.franchiseRelations.forEach((rel) => {
          const match = findLocal(rel.title) as any;
          if (match && match.id !== comicId) {
            rel.local_slug = String(match.slug);
            if (!rel.cover_url && match.cover_url) rel.cover_url = String(match.cover_url);
          }
        });

        fullRelations.recommendations.forEach((rec) => {
          const match = findLocal(rec.title) as any;
          if (match && match.id !== comicId) {
            rec.local_slug = String(match.slug);
            if (!rec.cover_url && match.cover_url) rec.cover_url = String(match.cover_url);
          }
        });
      } catch (e) {
        console.warn('[Admin Relations POST] Link error:', e);
      }
    }

    // 4. Save to Turso
    if (turso) {
      await saveTursoComicRelations(comicId, {
        franchise_relations: fullRelations.franchiseRelations,
        recommendations: fullRelations.recommendations,
        characters: fullRelations.characters,
        sources_used: fullRelations.sourcesUsed,
      });
      return NextResponse.json({ success: true, data: fullRelations });
    }

    return NextResponse.json({ success: true, data: fullRelations });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
