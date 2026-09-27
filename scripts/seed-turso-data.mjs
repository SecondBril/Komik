import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client';
import crypto from 'crypto';

const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[match[1]] = val;
  }
}

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function seed() {
  console.log('--- Fetching Comics from Turso ---');
  const res = await turso.execute('SELECT id, title, slug FROM comics;');
  const allComics = res.rows;
  console.log(`Total comics in Turso: ${allComics.length}`);

  const findComic = (keyword) =>
    allComics.find((c) => 
      String(c.title).toLowerCase().includes(keyword.toLowerCase()) || 
      String(c.slug).toLowerCase().includes(keyword.toLowerCase())
    );

  const worldAfterFall = findComic('the-world-after-the-fall');
  const pickMeUp = findComic('pick-me-up');
  const swordHound = findComic('iron-blooded');
  const infiniteMage = findComic('infinite-mage');
  const youjoSenki = findComic('youjo-senki');
  const kanojo100 = findComic('100-ri-no-kanojo');

  const seeds = [];

  if (worldAfterFall) {
    seeds.push(
      {
        id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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

  if (youjoSenki) {
    seeds.push(
      {
        id: crypto.randomUUID(),
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

  if (kanojo100) {
    seeds.push(
      {
        id: crypto.randomUUID(),
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

  console.log(`Inserting ${seeds.length} adaptations into Turso...`);
  for (const s of seeds) {
    const existing = await turso.execute({
      sql: 'SELECT id FROM comic_adaptations WHERE comic_id = ? AND start_chapter = ? LIMIT 1;',
      args: [s.comic_id, s.start_chapter]
    });

    if (existing.rows.length === 0) {
      await turso.execute({
        sql: `INSERT INTO comic_adaptations (id, comic_id, start_chapter, end_chapter, anime_season, anime_episode_range, novel_volume, novel_chapter_range, arc_title, note)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          s.id, s.comic_id, s.start_chapter, s.end_chapter,
          s.anime_season, s.anime_episode_range, s.novel_volume,
          s.novel_chapter_range, s.arc_title, s.note
        ]
      });
      console.log(`+ Added adaptation for ${s.comic_id}: Ch ${s.start_chapter}-${s.end_chapter}`);
    } else {
      console.log(`- Already exists: Ch ${s.start_chapter}-${s.end_chapter}`);
    }
  }

  // Also seed default sources if empty
  const sourcesRes = await turso.execute('SELECT COUNT(*) as c FROM sources;');
  if (sourcesRes.rows[0].c === 0) {
    await turso.execute({
      sql: `INSERT INTO sources (id, name, base_url, scraping_config, is_active)
            VALUES (?, ?, ?, ?, ?);`,
      args: [
        crypto.randomUUID(),
        'WestManga',
        'https://v1.westmanga.my',
        JSON.stringify({
          catalog_url: 'https://v1.westmanga.my/komik-terbaru',
          item_selector: '.listupd .bsx',
          title_selector: '.tt',
          link_selector: 'a',
          image_selector: 'img',
          chapter_container: '#chapterlist',
          chapter_item: 'li',
          reader_images: '#readerarea img'
        }),
        1
      ]
    });
    console.log('✓ Seeded default WestManga source into Turso');
  }

  console.log('Done!');
}

seed().catch(console.error);
