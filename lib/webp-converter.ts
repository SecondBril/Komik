import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import ImageKit from 'imagekit';

export function getImageKitClient() {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY || '';
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || '';
  const urlEndpoint = process.env.R2_PUBLIC_CDN_URL || 'https://ik.imagekit.io/m2imafj66';

  if (!publicKey || !privateKey) {
    return null;
  }

  return new ImageKit({
    publicKey,
    privateKey,
    urlEndpoint,
  });
}

/**
 * Converts image Buffer (PNG/JPG/JPEG) to compressed WebP format (quality 80)
 */
export async function convertToWebP(inputBuffer: Buffer, quality = 80): Promise<Buffer> {
  return await sharp(inputBuffer)
    .webp({ quality, effort: 4 })
    .toBuffer();
}

/**
 * Saves WebP image locally to /public/comics/{keyPath} AND uploads to ImageKit if keys exist
 * Key path format: comics/{comic_slug}/{chapter_no}/{page_no}.webp or comics/{comic_slug}/cover.webp
 */
export async function saveAndUploadWebP(
  imageBuffer: Buffer,
  keyPath: string
): Promise<string> {
  // 1. Convert to WebP first
  const webpBuffer = await convertToWebP(imageBuffer, 80);

  // 2. Try ImageKit API upload if configured
  const imagekit = getImageKitClient();
  if (imagekit) {
    try {
      const fileName = keyPath.split('/').pop() || 'file.webp';
      const folderPath = '/' + keyPath.substring(0, keyPath.lastIndexOf('/'));

      const response = await imagekit.upload({
        file: webpBuffer,
        fileName,
        folder: folderPath,
        useUniqueFileName: false,
      });

      if (response && response.url) {
        console.log(`[ImageKit Manual Upload Success] URL: ${response.url}`);
        return response.url;
      }
    } catch (err) {
      console.warn('[ImageKit Upload Warning] Error during upload, falling back to local file:', err);
    }
  }

  // 3. Save WebP image locally to /public/ folder
  const localUrl = saveLocalFile(webpBuffer, keyPath);
  return localUrl;
}

function saveLocalFile(buffer: Buffer, keyPath: string): string {
  try {
    const relativePath = keyPath.startsWith('comics/') ? keyPath : `comics/${keyPath}`;
    const fullPath = path.resolve(process.cwd(), 'public', relativePath);
    const targetFolder = path.dirname(fullPath);

    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    fs.writeFileSync(fullPath, buffer);
    console.log(`[Local WebP Saved] Path: /${relativePath}`);
    return `/${relativePath}`;
  } catch (err: any) {
    console.error(`[Local Save Error]:`, err?.message || err);
    return `/comics/${keyPath}`;
  }
}
