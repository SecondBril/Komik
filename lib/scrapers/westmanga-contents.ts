import * as cheerio from 'cheerio';

export interface DiscoveredComicSource {
  title: string;
  slug: string;
  comicUrl: string; // e.g. https://v1.westmanga.my/comic/evolution-frenzy
  coverUrl?: string;
  type: 'manga' | 'manhwa' | 'manhua';
  latestChapter?: {
    chapterNumber?: number;
    title?: string;
    relativeTime?: string;
    url?: string;
  };
  isColor?: boolean;
  isAlreadySource?: boolean;
}

/**
 * Builds a valid contents URL with page parameter.
 * Handles existing query params (?page= or ?pages=)
 */
export function buildContentsUrl(baseUrl: string, pageNumber?: number): string {
  let cleanUrl = baseUrl.trim();
  if (!cleanUrl) {
    cleanUrl = 'https://v1.westmanga.my/contents';
  }

  // If user provided a specific page number
  if (pageNumber && pageNumber > 1) {
    try {
      const urlObj = new URL(cleanUrl);
      urlObj.searchParams.set('page', String(pageNumber));
      return urlObj.toString();
    } catch {
      if (cleanUrl.includes('?')) {
        return `${cleanUrl}&page=${pageNumber}`;
      }
      return `${cleanUrl}?page=${pageNumber}`;
    }
  }

  return cleanUrl;
}

/**
 * Parses raw HTML from Westmanga contents page using Cheerio
 */
export function parseWestmangaContentsHTML(
  html: string,
  siteOrigin = 'https://v1.westmanga.my'
): DiscoveredComicSource[] {
  const $ = cheerio.load(html);
  const items: DiscoveredComicSource[] = [];
  const seenSlugs = new Set<string>();

  // Search for comic link anchors
  $('a[href*="/comic/"]').each((_, el) => {
    const rawHref = $(el).attr('href') || '';
    if (!rawHref) return;

    // Extract comic slug: e.g. /comic/evolution-frenzy -> evolution-frenzy
    const match = rawHref.match(/\/comic\/([a-zA-Z0-9_-]+)/i);
    if (!match) return;

    const slug = match[1];
    if (seenSlugs.has(slug)) return;

    // Full URL
    const comicUrl = rawHref.startsWith('http')
      ? rawHref
      : `${siteOrigin.replace(/\/$/, '')}/${rawHref.replace(/^\//, '')}`;

    // Find the enclosing card container
    // Look up for common card containers in westmanga layout
    const parentContainer = $(el).closest('.overflow-hidden, .group, [data-slot="card"], .space-y-1').parent();
    const cardScope = parentContainer.length > 0 ? parentContainer : $(el).closest('div');

    // 1. Extract Title
    // Priority: p.font-medium, img[alt], anchor text, or slug
    let title = cardScope.find('p.font-medium, p.font-semibold').first().text().trim();
    if (!title) {
      const imgAlt = cardScope.find('img[alt]').attr('alt')?.trim();
      if (imgAlt && !imgAlt.startsWith('CN') && !imgAlt.startsWith('JP') && !imgAlt.startsWith('KR')) {
        title = imgAlt;
      }
    }
    if (!title) {
      title = $(el).text().trim();
    }
    if (!title || title.length < 2) {
      title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    // 2. Extract Cover URL
    let coverUrl = '';
    const imgEl = cardScope.find('img.object-fill, img[src*="storage.westmanga"], img[src*="covers"]').first();
    if (imgEl.length > 0) {
      coverUrl =
        imgEl.attr('src') ||
        imgEl.attr('data-src') ||
        imgEl.attr('data-lazy-src') ||
        '';
    }
    if (!coverUrl) {
      // Fallback check all images in card except flags
      cardScope.find('img').each((_, img) => {
        const src = $(img).attr('src') || '';
        if (src && !src.includes('flagcdn') && !coverUrl) {
          coverUrl = src;
        }
      });
    }

    // 3. Extract Country / Comic Type from flag
    let type: 'manga' | 'manhwa' | 'manhua' = 'manga';
    const flagImg = cardScope.find('img[src*="flagcdn"], img[alt="CN"], img[alt="KR"], img[alt="JP"]').first();
    if (flagImg.length > 0) {
      const flagSrc = (flagImg.attr('src') || '').toLowerCase();
      const flagAlt = (flagImg.attr('alt') || '').toUpperCase();

      if (flagSrc.includes('/cn.') || flagAlt === 'CN') {
        type = 'manhua';
      } else if (flagSrc.includes('/kr.') || flagAlt === 'KR') {
        type = 'manhwa';
      } else if (flagSrc.includes('/jp.') || flagAlt === 'JP') {
        type = 'manga';
      }
    }

    // 4. Extract Latest Chapter info
    let latestChapter: DiscoveredComicSource['latestChapter'] = undefined;
    const chLinkEl = cardScope.find('a[href*="/view/"]').first();
    if (chLinkEl.length > 0) {
      const chHref = chLinkEl.attr('href') || '';
      const chUrl = chHref.startsWith('http')
        ? chHref
        : `${siteOrigin.replace(/\/$/, '')}/${chHref.replace(/^\//, '')}`;

      const chText = chLinkEl.text().trim();
      const chMatch = chText.match(/(?:chapter|ch\.?)\s*(\d+(?:[\.-]\d+)?)/i) || chHref.match(/chapter-(\d+(?:[\.-]\d+)?)/i);
      const chNum = chMatch ? parseFloat(chMatch[1].replace('-', '.')) : undefined;

      // Relative time (e.g. 10 menit, 1 jam, 3 jam)
      const timeMatch = chText.match(/(\d+\s*(?:menit|jam|hari|detik|bulan|tahun))/i);
      const relativeTime = timeMatch ? timeMatch[1] : undefined;

      latestChapter = {
        chapterNumber: chNum,
        title: chText,
        relativeTime,
        url: chUrl,
      };
    }

    // 5. Check if Color badge is present
    const isColor = cardScope.text().includes('COLOR');

    seenSlugs.add(slug);
    items.push({
      title,
      slug,
      comicUrl,
      coverUrl: coverUrl || undefined,
      type,
      latestChapter,
      isColor,
    });
  });

  return items;
}
