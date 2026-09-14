import { NextRequest, NextResponse } from 'next/server';
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

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
  }

  try {
    const { data, error } = await supabase
      .from('comic_relations_cache')
      .select('*')
      .eq('comic_id', comicId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

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
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

// PUT: Save admin edited relations, recommendations, and characters
export async function PUT(req: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
  }

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

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
  }

  try {
    // 1. Find comic title and slug
    const { data: comic, error: comicErr } = await supabase
      .from('comics')
      .select('id, title, slug')
      .eq('id', comicId)
      .single();

    if (comicErr || !comic) {
      return NextResponse.json({ success: false, error: 'Comic not found' }, { status: 404 });
    }

    // 2. Fetch fresh multi-source data
    const fullRelations = await fetchFullComicRelations(comic.title);

    // 3. Link local comics
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

      fullRelations.franchiseRelations.forEach((rel) => {
        const match = findLocal(rel.title);
        if (match && match.id !== comicId) {
          rel.local_slug = match.slug;
          if (!rel.cover_url && match.cover_url) rel.cover_url = match.cover_url;
        }
      });

      fullRelations.recommendations.forEach((rec) => {
        const match = findLocal(rec.title);
        if (match && match.id !== comicId) {
          rec.local_slug = match.slug;
          if (!rec.cover_url && match.cover_url) rec.cover_url = match.cover_url;
        }
      });
    }

    // 4. Upsert to Supabase
    const { data: saved, error: upsertErr } = await supabase
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
      )
      .select('*')
      .single();

    if (upsertErr) {
      return NextResponse.json({ success: false, error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
