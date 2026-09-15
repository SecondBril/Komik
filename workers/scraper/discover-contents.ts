import { getWorkerSupabaseClient } from '../lib/supabase-client';
import { getSharedPuppeteerBrowser } from './parse-source';
import {
  parseWestmangaContentsHTML,
  buildContentsUrl,
  DiscoveredComicSource,
} from './westmanga-contents';

async function runDiscoverSourcesWorker() {
  console.log('====================================================');
  console.log('[Discover Worker] Starting WestManga Catalog Scanner...');
  console.log('====================================================');

  // Parse CLI args: e.g. --page=10 or --start=1 --end=3
  const args = process.argv.slice(2);
  let startPage = 1;
  let endPage = 1;

  args.forEach((arg) => {
    if (arg.startsWith('--page=')) {
      startPage = parseInt(arg.replace('--page=', ''), 10) || 1;
      endPage = startPage;
    } else if (arg.startsWith('--start=')) {
      startPage = parseInt(arg.replace('--start=', ''), 10) || 1;
    } else if (arg.startsWith('--end=')) {
      endPage = parseInt(arg.replace('--end=', ''), 10) || 1;
    }
  });

  console.log(`[Discover Worker] Scanning Page Range: ${startPage} to ${endPage}`);

  const supabase = getWorkerSupabaseClient();
  if (!supabase) {
    console.error('[Discover Worker] Error: No Supabase connection found!');
    process.exit(1);
  }

  const browser = await getSharedPuppeteerBrowser();
  if (!browser) {
    console.error('[Discover Worker] Error: Failed to start Puppeteer browser!');
    process.exit(1);
  }

  // 1. Fetch existing sources from DB
  const { data: existingSources } = await supabase.from('sources').select('base_url');
  const existingUrls = new Set<string>(
    (existingSources || []).map((s) => s.base_url.toLowerCase().replace(/\/$/, ''))
  );

  console.log(`[Discover Worker] Existing sources in DB: ${existingUrls.size}`);

  const discoveredTotal: DiscoveredComicSource[] = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  for (let p = startPage; p <= endPage; p++) {
    const targetUrl = buildContentsUrl('https://v1.westmanga.my/contents', p);
    console.log(`\n[Discover Worker] Navigating to page ${p}: ${targetUrl} ...`);

    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 40000 }).catch(() => {});
      try {
        await page.waitForSelector('a[href*="/comic/"]', { timeout: 10000 });
      } catch {
        await new Promise((r) => setTimeout(r, 4000));
      }

      const html = await page.content();
      const comics = parseWestmangaContentsHTML(html, 'https://v1.westmanga.my');
      console.log(`[Discover Worker] Page ${p}: Found ${comics.length} comics.`);

      comics.forEach((c) => {
        if (!discoveredTotal.some((existing) => existing.slug === c.slug)) {
          discoveredTotal.push(c);
        }
      });

      if (p < endPage) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err: any) {
      console.error(`[Discover Worker] Error scanning page ${p}:`, err.message);
    }
  }

  await browser.close();

  // 2. Filter new comics not yet in sources
  const newComics = discoveredTotal.filter(
    (c) => !existingUrls.has(c.comicUrl.toLowerCase().replace(/\/$/, ''))
  );

  console.log(`\n====================================================`);
  console.log(`[Discover Worker] Summary:`);
  console.log(`  - Total comics discovered: ${discoveredTotal.length}`);
  console.log(`  - Already in sources DB:   ${discoveredTotal.length - newComics.length}`);
  console.log(`  - New comics to register:  ${newComics.length}`);
  console.log(`====================================================`);

  if (newComics.length === 0) {
    console.log('[Discover Worker] All discovered comics are already registered as sources. Done!');
    return;
  }

  // 3. Batch insert new sources into Supabase
  console.log(`[Discover Worker] Inserting ${newComics.length} new sources into Supabase...`);
  const sourcesPayload = newComics.map((c) => ({
    name: c.title,
    base_url: c.comicUrl,
    is_active: true,
    scraping_config: {
      comic_slug: c.slug,
      comic_type: c.type,
      cover_url: c.coverUrl,
      latest_chapter: c.latestChapter?.chapterNumber,
      selector_title: '.entry-title',
      selector_images: '#readerarea img',
    },
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from('sources')
    .insert(sourcesPayload)
    .select();

  if (insertErr) {
    console.error('[Discover Worker] Error inserting sources:', insertErr);
  } else {
    console.log(`[Discover Worker] Successfully registered ${inserted?.length || 0} new sources!`);
  }

  console.log('[Discover Worker] Finished auto-discovery run.');
}

runDiscoverSourcesWorker().catch((err) => {
  console.error('[Discover Worker] Fatal error:', err);
  process.exit(1);
});
