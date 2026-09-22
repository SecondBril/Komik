import puppeteer, { Browser } from 'puppeteer-core';
import fs from 'fs';
import { execSync } from 'child_process';
import { ChapterPage } from '@/lib/types';

// In-Memory LRU Cache untuk menyimpan URL gambar chapter yang sudah di-scrape live
// Key: `${comicSlug}:${chapterNumber}` -> { pages: ChapterPage[], timestamp: number }
interface CacheItem {
  pages: ChapterPage[];
  timestamp: number;
}

const LIVE_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 jam TTL
const chapterPagesCache = new Map<string, CacheItem>();

// Singleton Browser instance
let sharedBrowser: Browser | null = null;
let browserLaunchPromise: Promise<Browser | null> | null = null;

export function getChromeExecutablePath(): string | null {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }

  if (process.platform !== 'win32') {
    try {
      const whichChrome = execSync(
        'which google-chrome || which google-chrome-stable || which chromium || which chromium-browser || which chrome',
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      ).trim();
      if (whichChrome && fs.existsSync(whichChrome)) {
        return whichChrome;
      }
    } catch {
      // Fallback
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
  ];

  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

async function getBrowser(): Promise<Browser | null> {
  if (sharedBrowser && sharedBrowser.connected) {
    return sharedBrowser;
  }

  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  browserLaunchPromise = (async () => {
    const chromePath = getChromeExecutablePath();
    if (!chromePath) {
      console.warn('[LiveScraper] Chrome executable not found on system.');
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
          '--window-size=1280,800',
        ],
      });

      browser.on('disconnected', () => {
        sharedBrowser = null;
        browserLaunchPromise = null;
      });

      sharedBrowser = browser;
      return browser;
    } catch (err: any) {
      console.error('[LiveScraper] Failed to launch Puppeteer:', err?.message || err);
      return null;
    } finally {
      browserLaunchPromise = null;
    }
  })();

  return browserLaunchPromise;
}

export async function getSharedPuppeteerBrowser(): Promise<Browser | null> {
  return getBrowser();
}

/**
 * Filter dan validasi URL gambar Westmanga agar hanya gambar komik resmi dari storage.westmanga.blog
 */
function isValidComicImage(url: string, comicSlug: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('http')) return false;
  if (!url.includes('storage.westmanga.blog/west/')) return false;

  const lower = url.toLowerCase();
  if (
    lower.includes('/0ads/') ||
    lower.includes('avatar') ||
    lower.includes('logo') ||
    lower.includes('banner') ||
    lower.includes('cover') ||
    lower.includes('btn_close') ||
    lower.includes('error.png') ||
    lower.endsWith('.gif')
  ) {
    return false;
  }

  return true;
}

/**
 * Live Scrape gambar chapter langsung dari Westmanga
 * TIDAK disimpan di database Postgres, hanya di-cache di memory server (TTL 12 Jam).
 */
export async function scrapeLiveChapterPages(
  comicSlug: string,
  chapterNumber: number,
  chapterId?: string
): Promise<ChapterPage[]> {
  const cacheKey = `${comicSlug}:${chapterNumber}`;
  const now = Date.now();

  // 1. Cek Cache Memory
  const cached = chapterPagesCache.get(cacheKey);
  if (cached && now - cached.timestamp < LIVE_CACHE_TTL_MS && cached.pages.length > 0) {
    console.log(`[LiveScraper] Cache HIT for ${cacheKey} (${cached.pages.length} pages)`);
    return cached.pages;
  }

  console.log(`[LiveScraper] Cache MISS for ${cacheKey}. Fetching live from Westmanga...`);

  const browser = await getBrowser();
  if (!browser) {
    console.error('[LiveScraper] Browser engine unavailable.');
    return [];
  }

  const page = await browser.newPage();
  const capturedImages: string[] = [];
  const seenUrls = new Set<string>();

  try {
    // Intersepsi request: Blokir iklan, analytics, dan tracking agar ultra cepat & hemat resource
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      const type = req.resourceType();

      // Izinkan document & scripts yang dibutuhkan Westmanga
      if (
        type === 'font' ||
        url.includes('google') ||
        url.includes('cloudflareinsights') ||
        url.includes('histats') ||
        url.includes('hedgybache') ||
        url.includes('0ads')
      ) {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });

    // Tangkap data dari API backend Westmanga (Mantweh) secara otomatis
    page.on('response', async (res) => {
      const url = res.url();
      if (
        res.status() === 200 &&
        res.request().method() === 'GET' &&
        url.includes('data.mantweh.online/api/v/')
      ) {
        try {
          const json = await res.json();
          if (json.data?.images && Array.isArray(json.data.images)) {
            json.data.images.forEach((imgUrl: string) => {
              if (isValidComicImage(imgUrl, comicSlug) && !seenUrls.has(imgUrl)) {
                seenUrls.add(imgUrl);
                capturedImages.push(imgUrl);
              }
            });
          }
        } catch {
          // Ignore JSON parse errors from non-json responses
        }
      }
    });

    // Variasi URL chapter di Westmanga:
    const candidateSlugs = [
      `${comicSlug}-chapter-${chapterNumber}`,
      `${comicSlug}-chapter-${String(chapterNumber).padStart(2, '0')}`,
      `${comicSlug}-chapter-${chapterNumber}-bahasa-indonesia`,
      `${comicSlug}-chapter-${String(chapterNumber).padStart(2, '0')}-bahasa-indonesia`,
    ];

    let success = false;
    for (const chSlug of candidateSlugs) {
      const targetUrl = `https://v1.westmanga.my/view/${chSlug}`;
      console.log(`[LiveScraper] Trying view URL: ${targetUrl}`);

      try {
        await page.goto(targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 25000,
        });

        // Tunggu maksimal 3.5 detik untuk respons API Mantweh
        const waitStart = Date.now();
        while (capturedImages.length === 0 && Date.now() - waitStart < 3500) {
          await new Promise((r) => setTimeout(r, 150));
        }

        if (capturedImages.length > 0) {
          success = true;
          console.log(`[LiveScraper] Successfully captured ${capturedImages.length} images via API for ${chSlug}!`);
          break;
        }

        // Jika API tidak tertangkap via network response, coba ekstrak dari DOM
        const domImages = await page.evaluate((targetSlug) => {
          const imgs = Array.from(document.querySelectorAll('img'));
          return imgs
            .map((img) => img.src || img.getAttribute('data-src') || '')
            .filter((src) => src.includes('storage.westmanga.blog/west/'));
        }, comicSlug);

        if (domImages.length > 0) {
          domImages.forEach((imgUrl) => {
            if (isValidComicImage(imgUrl, comicSlug) && !seenUrls.has(imgUrl)) {
              seenUrls.add(imgUrl);
              capturedImages.push(imgUrl);
            }
          });
          if (capturedImages.length > 0) {
            success = true;
            console.log(`[LiveScraper] Successfully extracted ${capturedImages.length} images from DOM for ${chSlug}!`);
            break;
          }
        }
      } catch (navErr: any) {
        console.warn(`[LiveScraper] Candidate ${targetUrl} failed:`, navErr?.message);
      }
    }

    if (!success || capturedImages.length === 0) {
      console.warn(`[LiveScraper] No images found for ${comicSlug} Chapter ${chapterNumber}`);
      return [];
    }

    // Format menjadi array ChapterPage yang kompatibel dengan viewer
    const formattedPages: ChapterPage[] = capturedImages.map((imageUrl, idx) => ({
      id: `${comicSlug}-ch${chapterNumber}-p${idx + 1}`,
      chapter_id: chapterId || `${comicSlug}-ch${chapterNumber}`,
      page_number: idx + 1,
      image_url: imageUrl,
      width: undefined,
      height: undefined,
    }));

    // Simpan di cache RAM server (TIDAK di-insert ke database Postgres)
    chapterPagesCache.set(cacheKey, {
      pages: formattedPages,
      timestamp: Date.now(),
    });

    return formattedPages;
  } catch (err: any) {
    console.error(`[LiveScraper Error] Failed scraping ${comicSlug} ch ${chapterNumber}:`, err?.message || err);
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}
