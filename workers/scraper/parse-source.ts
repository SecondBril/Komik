import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import https from 'https';
import puppeteer, { Browser } from 'puppeteer-core';
import fs from 'fs';
import { execSync } from 'child_process';

export interface ScrapedChapterData {
  comicTitle: string;
  comicSlug: string;
  chapterNumber: number;
  chapterTitle?: string;
  rawImageUrls: string[];
}

export interface ComicDetailData {
  comicTitle: string;
  comicSlug: string;
  coverUrl?: string;
  chapters: Array<{
    chapterNumber: number;
    url: string;
  }>;
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

export function getChromeExecutablePath(): string | null {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }

  // Dynamic CLI resolution (PATH) on Linux/macOS runners
  if (process.platform !== 'win32') {
    try {
      const whichChrome = execSync(
        'which google-chrome || which google-chrome-stable || which chromium || which chromium-browser || which chrome',
        {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'],
        }
      ).trim();
      if (whichChrome && fs.existsSync(whichChrome)) {
        return whichChrome;
      }
    } catch {
      // Ignore fallback error
    }
  }

  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/usr/local/bin/chrome',
    '/usr/local/bin/google-chrome',
  ];
  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

export async function getSharedPuppeteerBrowser(): Promise<Browser | null> {
  const chromePath = getChromeExecutablePath();
  if (!chromePath) {
    console.warn('[Puppeteer] Chrome executable not found on system.');
    return null;
  }

  try {
    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      ],
    });
    return browser;
  } catch (err: any) {
    console.error('[Puppeteer] Failed to launch browser:', err?.message || err);
    return null;
  }
}

/**
 * Fetch HTML statically with node-fetch
 */
export async function fetchHTML(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      agent: (parsedUrl) => (parsedUrl.protocol === 'https:' ? httpsAgent : undefined) as any,
      signal: controller.signal as any,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    clearTimeout(timeoutId);

    if (response.status === 403 || response.status === 503 || !response.ok) {
      return null;
    }

    return await response.text();
  } catch (err: any) {
    return null;
  }
}

/**
 * Extracts list of chapter links & comic info from comic detail page / catalog page using Puppeteer
 */
export async function getComicDetailWithPuppeteer(
  browser: Browser,
  sourceUrl: string
): Promise<ComicDetailData | null> {
  console.log(`[Puppeteer Scraper] Discovering comic detail & chapter links from: ${sourceUrl}`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    await page.goto(sourceUrl, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
    try {
      await page.waitForSelector('a[href*="/view/"]', { timeout: 10000 });
    } catch (e) {
      await new Promise((r) => setTimeout(r, 4000));
    }

    const title = await page.title();
    const rawTitle = title.replace(/\s*-\s*.*$/, '').replace(/Bahasa Indonesia/gi, '').trim() || 'Komik Scraped';

    // Parse comic slug from URL
    const westmangaComicMatch = sourceUrl.match(/\/comic\/([^\/]+)/i);
    const westmangaViewMatch = sourceUrl.match(/\/view\/(.*?)-chapter-(\d+(?:[\.-]\d+)?)/i);

    let comicSlug = '';
    let comicTitle = '';

    if (westmangaComicMatch) {
      comicSlug = westmangaComicMatch[1];
      comicTitle = comicSlug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    } else if (westmangaViewMatch) {
      comicSlug = westmangaViewMatch[1];
      comicTitle = comicSlug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    } else {
      comicTitle = rawTitle;
      comicSlug = slugify(rawTitle);
    }

    const { chapterLinks, coverUrl } = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      const hrefs = anchors.map((a) => a.href).filter((h) => h && (h.includes('/view/') || h.includes('chapter')));

      const imgElements = Array.from(document.querySelectorAll('img'));
      const cover = imgElements
        .map((img) => img.src || img.getAttribute('data-src') || '')
        .find((src) => src.includes('/covers/') || src.includes('/manga/') || src.includes('cover'));

      return {
        chapterLinks: Array.from(new Set(hrefs)),
        coverUrl: cover || undefined,
      };
    });

    const parsedChapters: Array<{ chapterNumber: number; url: string }> = [];

    // Parse chapter number for each link.
    // Supports:
    //   - Standard decimals: chapter-1.1, ch1.5
    //   - Dash-encoded decimals: chapter-07-1-bahasa-indonesia (7.1), chapter-15-1-bahasa-indonesia (15.1)
    //   - Plain integers: chapter-07 (7), chapter-15 (15)
    // Filters out chapter numbers < 1 (e.g. 0, 0.5) as requested.
    chapterLinks.forEach((chUrl) => {
      // Strategy 1: direct decimal in URL (e.g. chapter-1.5 or ch-1.5 or chapter-07.1)
      let match = chUrl.match(/(?:chapter|ch)[\-\/\s]*(\d+\.\d+)/i);
      if (match) {
        const chapterNumber = parseFloat(match[1]);
        if (!isNaN(chapterNumber) && chapterNumber >= 1) {
          parsedChapters.push({ chapterNumber, url: chUrl });
          return;
        }
      }

      // Strategy 2: dash-encoded sub-chapter (e.g. chapter-07-1-bahasa-indonesia -> 7.1, chapter-15-1 -> 15.1)
      // Pattern: chapter-{major}-{1-2 digit minor} followed by non-digit (e.g. -bahasa-indonesia, /, ?, #, or end of string)
      match = chUrl.match(/(?:chapter|ch)[\-\/](\d+)-(\d{1,2})(?![0-9])/i);
      if (match) {
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        // Treat as decimal if minor part is 1-2 digits (avoid false positives like year numbers)
        const chapterNumber = parseFloat(`${major}.${minor}`);
        if (!isNaN(chapterNumber) && chapterNumber >= 1 && minor > 0) {
          parsedChapters.push({ chapterNumber, url: chUrl });
          return;
        }
      }

      // Strategy 3: plain integer chapter number (e.g. chapter-07-bahasa-indonesia -> 7)
      match = chUrl.match(/(?:chapter|ch)[\-\/\s]*(\d+)/i);
      if (match) {
        const chapterNumber = parseInt(match[1], 10);
        if (!isNaN(chapterNumber) && chapterNumber >= 1) {
          parsedChapters.push({ chapterNumber, url: chUrl });
        }
      }
    });

    // Deduplicate by chapter number
    const uniqueMap = new Map<number, string>();
    parsedChapters.forEach((ch) => {
      if (!uniqueMap.has(ch.chapterNumber)) {
        uniqueMap.set(ch.chapterNumber, ch.url);
      }
    });

    const sortedChapters = Array.from(uniqueMap.entries())
      .map(([chapterNumber, url]) => ({ chapterNumber, url }))
      .sort((a, b) => b.chapterNumber - a.chapterNumber); // Descending (latest chapter first)

    console.log(`[Puppeteer Scraper] Discovered comic "${comicTitle}" (${sortedChapters.length} total chapters found on page).`);

    return {
      comicTitle,
      comicSlug,
      coverUrl,
      chapters: sortedChapters,
    };
  } catch (err: any) {
    console.error(`[Puppeteer Scraper Error] Failed discovering detail for ${sourceUrl}:`, err?.message || err);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * Scrapes direct reader page (extracting all 25+ page image URLs) using active Puppeteer Browser
 */
export async function scrapeChapterPageWithPuppeteer(
  browser: Browser,
  viewUrl: string,
  comicTitle: string,
  comicSlug: string,
  chapterNumber: number
): Promise<ScrapedChapterData | null> {
  console.log(`[Puppeteer Reader Engine] Opening Chapter ${chapterNumber} (${viewUrl})...`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const capturedImages = new Set<string>();

  page.on('request', (req) => {
    const url = req.url();
    if (
      url.includes('storage.westmanga.blog/west/') &&
      !url.includes('/0ads/') &&
      !url.includes('logo') &&
      !url.includes('cover') &&
      !url.includes('btn_close') &&
      !url.endsWith('.gif')
    ) {
      if (url.startsWith('http')) {
        capturedImages.add(url);
      }
    }
  });

  try {
    await page.goto(viewUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});

    try {
      await page.waitForSelector('img[src*="storage.westmanga"], #readerarea img, .rdcontent img', { timeout: 10000 });
    } catch (e) {
      // Fallback delay
    }

    // Smooth scroll down to trigger lazy loading of reader images
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 500;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight || totalHeight > 35000) {
            clearInterval(timer);
            resolve();
          }
        }, 120);
      });
    });

    await new Promise((r) => setTimeout(r, 2500));

    // Extract all DOM img elements as fallback
    const domImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs
        .map((img) => img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || '')
        .filter(
          (src) =>
            src &&
            src.startsWith('http') &&
            src.includes('storage.westmanga.blog/west/') &&
            !src.includes('avatar') &&
            !src.includes('logo') &&
            !src.includes('/0ads/') &&
            !src.includes('banner') &&
            !src.includes('cover') &&
            !src.endsWith('.gif')
        );
    });

    domImages.forEach((img) => capturedImages.add(img));

    const rawImageUrls = Array.from(capturedImages).filter(
      (url) => url.includes('storage.westmanga.blog/west/') && !url.includes('cover')
    );

    console.log(`[Puppeteer Reader Engine] Successfully extracted ${rawImageUrls.length} page images for Chapter ${chapterNumber}.`);

    // Require at least 3 page images to be valid chapter
    if (rawImageUrls.length < 3) {
      console.warn(`[Puppeteer Reader Engine] Less than 3 valid page images for Chapter ${chapterNumber}. Skipping false positive.`);
      return null;
    }

    return {
      comicTitle,
      comicSlug,
      chapterNumber,
      chapterTitle: `Chapter ${chapterNumber}`,
      rawImageUrls,
    };
  } catch (err: any) {
    console.error(`[Puppeteer Reader Error] Chapter ${chapterNumber} failed:`, err?.message || err);
    return null;
  } finally {
    await page.close();
  }
}
