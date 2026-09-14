import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('--- Checking Comics in DB ---');
  const { data: allComics } = await supabase.from('comics').select('id, title, slug').order('title');
  console.log(`Total comics in DB: ${allComics?.length}`);
  for (const c of allComics || []) {
    console.log(`- [${c.slug}] ${c.title} (ID: ${c.id})`);
  }

  // Find target comics
  const findComic = (keyword) =>
    allComics?.find((c) => c.title.toLowerCase().includes(keyword.toLowerCase()) || c.slug.includes(keyword.toLowerCase()));

  const worldAfterFall = findComic('the-world-after-the-fall');
  const pickMeUp = findComic('pick-me-up');
  const swordHound = findComic('iron-blooded');
  const infiniteMage = findComic('infinite-mage');

  const seeds = [];

  if (worldAfterFall) {
    seeds.push(
      {
        comic_id: worldAfterFall.id,
        start_chapter: 1,
        end_chapter: 30,
        anime_season: null,
        anime_episode_range: null,
        novel_volume: 'Vol. 1',
        novel_chapter_range: 'Ch. 1 - 42',
        arc_title: 'Tower of Nightmares / Monarch of Chaos Arc',
        note: 'Adapted from the hit web novel by sing N song (author of Omniscient Reader).',
      },
      {
        comic_id: worldAfterFall.id,
        start_chapter: 31,
        end_chapter: 80,
        anime_season: null,
        anime_episode_range: null,
        novel_volume: 'Vol. 2 - 3',
        novel_chapter_range: 'Ch. 43 - 115',
        arc_title: 'Chaos / Tree of Imagery Arc',
        note: 'Covers Jaehwan ascending into the depth of Chaos.',
      }
    );
  }

  if (pickMeUp) {
    seeds.push(
      {
        comic_id: pickMeUp.id,
        start_chapter: 1,
        end_chapter: 40,
        anime_season: null,
        anime_episode_range: null,
        novel_volume: 'Vol. 1 - 2',
        novel_chapter_range: 'Ch. 1 - 50',
        arc_title: 'Tutorial to Niflheim Formation',
        note: 'Adapted from the famous novel by Hermod (500+ novel chapters).',
      },
      {
        comic_id: pickMeUp.id,
        start_chapter: 41,
        end_chapter: 90,
        anime_season: null,
        anime_episode_range: null,
        novel_volume: 'Vol. 3 - 4',
        novel_chapter_range: 'Ch. 51 - 120',
        arc_title: 'First Floor Clearing & Clan Battles',
        note: 'Intense tactical gacha dungeon raid arc.',
      }
    );
  }

  if (infiniteMage) {
    seeds.push(
      {
        comic_id: infiniteMage.id,
        start_chapter: 1,
        end_chapter: 35,
        anime_season: null,
        anime_episode_range: null,
        novel_volume: 'Vol. 1 - 2',
        novel_chapter_range: 'Ch. 1 - 48',
        arc_title: 'Alpheas Magic Academy Entrance Arc',
        note: 'Adapted from the web novel by Kim Chi-woo (1200+ chapters).',
      }
    );
  }

  if (swordHound) {
    seeds.push(
      {
        comic_id: swordHound.id,
        start_chapter: 1,
        end_chapter: 30,
        anime_season: null,
        anime_episode_range: null,
        novel_volume: 'Vol. 1',
        novel_chapter_range: 'Ch. 1 - 38',
        arc_title: 'Baskerville Academy / Barbarian Outskirts Arc',
        note: 'Adapted from the popular web novel by Seomwoo.',
      }
    );
  }

  const youjoSenki = findComic('youjo-senki');
  if (youjoSenki) {
    seeds.push(
      {
        comic_id: youjoSenki.id,
        start_chapter: 1,
        end_chapter: 20,
        anime_season: 'Season 1',
        anime_episode_range: 'Ep. 1 - 12',
        novel_volume: 'Vol. 1 - 3',
        novel_chapter_range: 'Ch. 1 - 18',
        arc_title: 'Rhine Front & Norden Operation Arc',
        note: 'Adapted into anime by Studio NuT (12 Episodes + Movie).',
      }
    );
  }

  const kanojo100 = findComic('100-ri-no-kanojo');
  if (kanojo100) {
    seeds.push(
      {
        comic_id: kanojo100.id,
        start_chapter: 1,
        end_chapter: 22,
        anime_season: 'Season 1',
        anime_episode_range: 'Ep. 1 - 12',
        novel_volume: null,
        novel_chapter_range: null,
        arc_title: 'First 6 Soulmates Arc',
        note: 'Adapted into Anime Season 1 by Bibury Animation Studios.',
      }
    );
  }

  console.log(`\nInserting ${seeds.length} sample adaptation ranges...`);
  for (const s of seeds) {
    const { data: exist } = await supabase
      .from('comic_adaptations')
      .select('id')
      .eq('comic_id', s.comic_id)
      .eq('start_chapter', s.start_chapter)
      .maybeSingle();

    if (!exist) {
      await supabase.from('comic_adaptations').insert(s);
      console.log(`+ Added adaptation for comic ${s.comic_id}: Ch ${s.start_chapter}-${s.end_chapter} (Novel Ch ${s.novel_chapter_range})`);
    } else {
      console.log(`- Already exists: Ch ${s.start_chapter}-${s.end_chapter}`);
    }
  }
  console.log('Done seeding adaptations!');
}

seed().catch(console.error);
