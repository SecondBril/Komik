import { getWorkerSupabaseClient } from '../lib/supabase-client';
import ImageKit from 'imagekit';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

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
 * Helper to upload to ImageKit with automatic retry for socket hang up / network glitches
 */
async function uploadToImageKitWithRetry(
  imagekit: ImageKit,
  file: Buffer,
  fileName: string,
  folder: string,
  maxRetries = 3
): Promise<any> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      attempt++;
      return await imagekit.upload({
        file,
        fileName,
        folder,
        useUniqueFileName: false,
      });
    } catch (err: any) {
      const isNetworkError =
        err?.code === 'ECONNRESET' ||
        err?.message?.includes('socket hang up') ||
        err?.message?.includes('ECONNRESET');

      if (isNetworkError && attempt < maxRetries) {
        const waitTime = attempt * 1000;
        console.warn(`[ImageKit Upload] Network retry ${attempt}/${maxRetries} in ${waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Uploads a WebP image buffer to ImageKit (or saves to local /public/comics/ folder as fallback)
 * Path structure: comics/{comic_slug}/{chapter_number}/{page_number}.webp
 */
export async function uploadImageToR2(
  imageBuffer: Buffer,
  keyPath: string
): Promise<string> {
  const imagekit = getImageKitClient();
  const cdnBaseUrl = (process.env.R2_PUBLIC_CDN_URL || '').replace(/\/$/, '');

  // 1. Upload to ImageKit API with retry mechanism
  if (imagekit) {
    try {
      const fileName = keyPath.split('/').pop() || 'page.webp';
      const folderPath = '/' + keyPath.substring(0, keyPath.lastIndexOf('/'));

      const response = await uploadToImageKitWithRetry(imagekit, imageBuffer, fileName, folderPath, 3);

      if (response && response.url) {
        console.log(`[ImageKit Upload Success] URL: ${response.url}`);
        return response.url;
      }
    } catch (err: any) {
      console.warn('[ImageKit Upload Warning] API upload error, saving locally:', err?.message || err);
    }
  }

  // 2. Fallback to Supabase Storage if configured
  const supabase = getWorkerSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from('comics')
        .upload(keyPath, imageBuffer, {
          contentType: 'image/webp',
          upsert: true,
        });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage.from('comics').getPublicUrl(keyPath);
        return publicUrlData.publicUrl;
      }
    } catch (err) {
      // Fallback
    }
  }

  // 3. Save WebP image locally to /public/comics/ directory for instant 100% working local preview
  try {
    const localPublicDir = path.resolve(process.cwd(), '../public/comics', keyPath);
    const targetFolder = path.dirname(localPublicDir);

    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    fs.writeFileSync(localPublicDir, imageBuffer);
    const localPublicUrl = keyPath.startsWith('/') ? keyPath : `/${keyPath}`;
    console.log(`[Local Saved WebP] File: ${localPublicUrl}`);
    return localPublicUrl;
  } catch (err: any) {
    console.error(`[Local Save Error]:`, err?.message || err);
    const fallbackBase = cdnBaseUrl || 'https://images.unsplash.com';
    return `${fallbackBase}/${keyPath}`;
  }
}
