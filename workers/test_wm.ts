import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import https from 'https';

async function testWestmanga() {
  const chapterUrl = 'https://v1.westmanga.my/view/level-1-kara-hajimaru-shoukan-musou-chapter-47';
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });

  console.log('Fetching:', chapterUrl);

  try {
    const res = await fetch(chapterUrl, {
      agent: (p: any) => (p.protocol === 'https:' ? httpsAgent : undefined),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });

    console.log('HTTP Status:', res.status);
    const html = await res.text();
    console.log('HTML Length:', html.length);

    const $ = cheerio.load(html);
    console.log('Page Title:', $('title').text().trim());

    // Search for storage.westmanga image URLs
    const images: string[] = [];
    $('img').each((_: any, el: any) => {
      const src = $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('src') || $(el).attr('data-original');
      if (src && (src.includes('storage.westmanga') || src.includes('westmanga'))) {
        images.push(src);
      }
    });

    console.log(`Found ${images.length} images matching storage.westmanga:`);
    images.slice(0, 10).forEach((img, i) => console.log(` [${i+1}] ${img}`));

    // Search for script tags containing storage.westmanga or images
    $('script').each((_: any, el: any) => {
      const text = $(el).html() || '';
      if (text.includes('storage.westmanga') || text.includes('ts_reader') || text.includes('images')) {
        console.log('\n--- Script Content ---');
        console.log(text.slice(0, 500));
      }
    });

  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

testWestmanga();
