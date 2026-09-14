import fs from 'fs';
import path from 'path';

try {
  const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
  for (const line of envFile.split('\n')) {
    const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let val = (match[2] || '').trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[key] = val;
    }
  }
} catch (e) {}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('--- Seeding Adaptation Data ---');

  // 1. Find Solo Leveling
  const { data: comics, error: comicErr } = await supabase
    .from('comics')
    .select('id, title, slug')
    .ilike('title', '%solo leveling%');

  if (comicErr || !comics || comics.length === 0) {
    console.log('Solo Leveling not found by title, checking all comics...');
    const { data: allComics } = await supabase.from('comics').select('id, title, slug').limit(5);
    console.log('Sample comics in DB:', allComics);
    return;
  }

  const soloLeveling = comics[0];
  console.log(`Found Solo Leveling: ID=${soloLeveling.id}, Title="${soloLeveling.title}"`);

  // 2. Check if adaptations already exist
  const { data: existing } = await supabase
    .from('comic_adaptations')
    .select('id, start_chapter, end_chapter')
    .eq('comic_id', soloLeveling.id);

  if (existing && existing.length > 0) {
    console.log(`Already has ${existing.length} adaptation records. Skipping insert.`);
    return;
  }

  // 3. Insert realistic adaptation records for Solo Leveling
  // S1 Anime: Chapters 1 - 45 -> Anime Season 1 (Ep 1-12) / Light Novel Ch 1-62
  // S2 Anime: Chapters 46 - 110 -> Anime Season 2 - Arise from the Shadow / Light Novel Ch 63-135
  const sampleData = [
    {
      comic_id: soloLeveling.id,
      start_chapter: 1,
      end_chapter: 45,
      anime_season: 'Season 1',
      anime_episode_range: 'Ep. 1 - 12',
      novel_volume: 'Vol. 1 - 3',
      novel_chapter_range: 'Ch. 1 - 62',
      arc_title: 'D-Rank Dungeon to Job Change Arc',
      note: 'Adapted into Season 1 by A-1 Pictures (12 Episodes).',
    },
    {
      comic_id: soloLeveling.id,
      start_chapter: 46,
      end_chapter: 110,
      anime_season: 'Season 2: Arise from the Shadow',
      anime_episode_range: 'Ep. 13 - 25',
      novel_volume: 'Vol. 4 - 8',
      novel_chapter_range: 'Ch. 63 - 135',
      arc_title: 'Red Gate to Jeju Island Arc',
      note: 'Covers the high-intensity Red Gate, Demon Castle, and iconic Jeju Island raid.',
    },
  ];

  const { data: inserted, error: insertErr } = await supabase
    .from('comic_adaptations')
    .insert(sampleData)
    .select('*');

  if (insertErr) {
    console.error('Failed to insert adaptation records:', insertErr.message);
  } else {
    console.log(`Successfully inserted ${inserted.length} adaptation ranges for Solo Leveling!`);
  }
}

seed().catch(console.error);
