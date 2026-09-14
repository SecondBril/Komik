import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchFullComicRelations } from '@/lib/adaptation-service';

// GET: Fetch adaptations for a comic, or auto-fetch candidates from API
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const comicId = searchParams.get('comicId');
  const autoFetchTitle = searchParams.get('autoFetchTitle');

  // Case 1: Auto-fetch multi-source candidates and franchise from MangaUpdates + AniList
  if (autoFetchTitle) {
    try {
      const result = await fetchFullComicRelations(autoFetchTitle);
      return NextResponse.json({
        success: true,
        data: {
          ...result,
          candidates: result.adaptationCandidates,
        },
      });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: err?.message || 'Failed to fetch adaptation candidates' },
        { status: 500 }
      );
    }
  }

  // Case 2: Fetch existing adaptations from Supabase by comicId
  if (!comicId) {
    return NextResponse.json(
      { success: false, error: 'Parameter comicId or autoFetchTitle is required' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
  }

  try {
    const { data, error } = await supabase
      .from('comic_adaptations')
      .select('*')
      .eq('comic_id', comicId)
      .order('start_chapter', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

// POST: Insert a new adaptation range
export async function POST(req: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const {
      comic_id,
      start_chapter,
      end_chapter,
      anime_season,
      anime_episode_range,
      novel_chapter_range,
      novel_volume,
      arc_title,
      note,
    } = body;

    if (!comic_id || start_chapter === undefined || end_chapter === undefined) {
      return NextResponse.json(
        { success: false, error: 'comic_id, start_chapter, and end_chapter are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('comic_adaptations')
      .insert({
        comic_id,
        start_chapter: Number(start_chapter),
        end_chapter: Number(end_chapter),
        anime_season: anime_season || null,
        anime_episode_range: anime_episode_range || null,
        novel_chapter_range: novel_chapter_range || null,
        novel_volume: novel_volume || null,
        arc_title: arc_title || null,
        note: note || null,
      })
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

// PUT: Update an existing adaptation range
export async function PUT(req: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required for update' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (fields.start_chapter !== undefined) updatePayload.start_chapter = Number(fields.start_chapter);
    if (fields.end_chapter !== undefined) updatePayload.end_chapter = Number(fields.end_chapter);
    if (fields.anime_season !== undefined) updatePayload.anime_season = fields.anime_season;
    if (fields.anime_episode_range !== undefined) updatePayload.anime_episode_range = fields.anime_episode_range;
    if (fields.novel_chapter_range !== undefined) updatePayload.novel_chapter_range = fields.novel_chapter_range;
    if (fields.novel_volume !== undefined) updatePayload.novel_volume = fields.novel_volume;
    if (fields.arc_title !== undefined) updatePayload.arc_title = fields.arc_title;
    if (fields.note !== undefined) updatePayload.note = fields.note;

    const { data, error } = await supabase
      .from('comic_adaptations')
      .update(updatePayload)
      .eq('id', id)
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

// DELETE: Remove an adaptation range
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'id parameter is required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Database client missing' }, { status: 500 });
  }

  try {
    const { error } = await supabase.from('comic_adaptations').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Adaptation record deleted' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
