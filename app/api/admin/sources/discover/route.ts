import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseWestmangaContentsHTML,
  buildContentsUrl,
  DiscoveredComicSource,
} from '@/lib/scrapers/westmanga-contents';
import { getSharedPuppeteerBrowser } from '@/workers/scraper/parse-source';

export const maxDuration = 60; // Allow long-running Puppeteer scan

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      url = 'https://v1.westmanga.my/contents',
      page = 1,
      endPage,
      html,
      autoSave = false,
    } = body;

    const pageNum = Math.max(1, Number(page) || 1);
    const lastPageNum = endPage ? Math.max(pageNum, Math.min(pageNum + 10, Number(endPage))) : pageNum;

    let discoveredComics: DiscoveredComicSource[] = [];

    // 1. If user provided raw HTML snippet (e.g. pasted directly into the admin modal)
    if (html && typeof html === 'string' && html.trim().length > 0) {
      discoveredComics = parseWestmangaContentsHTML(html);
    } else {
      // 2. Fetch using Puppeteer (since WestManga v1 is a React SPA)
      const browser = await getSharedPuppeteerBrowser();

      if (browser) {
        try {
          const browserPage = await browser.newPage();
          await browserPage.setViewport({ width: 1280, height: 800 });

          // Scan across requested page range (e.g. page 1 or page 1..3)
          for (let p = pageNum; p <= lastPageNum; p++) {
            const targetUrl = buildContentsUrl(url, p);
            console.log(`[Discover API] Scanning WestManga page ${p}: ${targetUrl}`);

            await browserPage.goto(targetUrl, {
              waitUntil: 'networkidle2',
              timeout: 35000,
            }).catch(() => {});

            // Wait for comic anchors or fallback timeout
            try {
              await browserPage.waitForSelector('a[href*="/comic/"]', { timeout: 10000 });
            } catch {
              await new Promise((r) => setTimeout(r, 4000));
            }

            const pageHtml = await browserPage.content();
            const pageComics = parseWestmangaContentsHTML(pageHtml, 'https://v1.westmanga.my');

            pageComics.forEach((c) => {
              if (!discoveredComics.some((existing) => existing.slug === c.slug)) {
                discoveredComics.push(c);
              }
            });

            // Brief pause between pages if scanning range
            if (p < lastPageNum) {
              await new Promise((r) => setTimeout(r, 1500));
            }
          }

          await browserPage.close();
        } catch (err: any) {
          console.warn('[Discover API] Puppeteer scan error:', err.message);
        }
      } else {
        // Fallback to direct fetch if Chrome is not accessible on host
        const targetUrl = buildContentsUrl(url, pageNum);
        try {
          const res = await fetch(targetUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
          });
          const text = await res.text();
          discoveredComics = parseWestmangaContentsHTML(text, 'https://v1.westmanga.my');
        } catch (err: any) {
          console.error('[Discover API] Fallback fetch failed:', err);
        }
      }
    }

    // 3. Query existing sources in Supabase to check for duplicates
    const supabase = createAdminClient();
    const existingUrlSet = new Set<string>();

    if (supabase) {
      try {
        const { data: existingSources } = await supabase
          .from('sources')
          .select('base_url, name');

        if (existingSources) {
          existingSources.forEach((s: any) => {
            if (s.base_url) {
              existingUrlSet.add(s.base_url.toLowerCase().trim());
              existingUrlSet.add(s.base_url.toLowerCase().replace(/\/$/, '').trim());
            }
          });
        }
      } catch (err) {
        console.warn('[Discover API] Failed to fetch existing sources:', err);
      }
    }

    // Mark each discovered comic as already existing or new
    discoveredComics.forEach((comic) => {
      const cleanUrl = comic.comicUrl.toLowerCase().trim();
      const cleanUrlNoSlash = cleanUrl.replace(/\/$/, '');
      comic.isAlreadySource = existingUrlSet.has(cleanUrl) || existingUrlSet.has(cleanUrlNoSlash);
    });

    const newComics = discoveredComics.filter((c) => !c.isAlreadySource);
    const existingCount = discoveredComics.length - newComics.length;
    let savedCount = 0;

    // 4. Auto-save new sources to Supabase if requested
    if (autoSave && newComics.length > 0 && supabase) {
      const sourcesToInsert = newComics.map((c) => ({
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
        .insert(sourcesToInsert)
        .select();

      if (!insertErr && inserted) {
        savedCount = inserted.length;
        // Update isAlreadySource flag for newly saved
        newComics.forEach((c) => {
          c.isAlreadySource = true;
        });
      } else if (insertErr) {
        console.error('[Discover API] Insert sources error:', insertErr);
      }
    }

    return NextResponse.json({
      success: true,
      page: pageNum,
      endPage: lastPageNum,
      totalFound: discoveredComics.length,
      newCount: newComics.length,
      existingCount,
      savedCount,
      comics: discoveredComics,
    });
  } catch (err: any) {
    console.error('[Discover API] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
