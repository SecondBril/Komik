import sharp from 'sharp';
import { uploadComicImage } from './storage-manager';

/**
 * Mengonversi image Buffer (PNG/JPG/JPEG/dll) menjadi format WebP terkompresi (quality 80)
 */
export async function convertToWebP(inputBuffer: Buffer, quality = 80): Promise<Buffer> {
  return await sharp(inputBuffer)
    .webp({ quality, effort: 4 })
    .toBuffer();
}

/**
 * Mengonversi ke WebP dan mengunggah menggunakan alur Dual-Storage:
 * 1. OneDrive (Penyimpanan Utama)
 * 2. ImageKit (Penyimpanan Sekunder / Cadangan)
 * 3. Local Storage /public/comics/ (Jaring Pengaman Lokal)
 * 
 * Format keyPath: comics/{comic_slug}/{chapter_no}/{page_no}.webp atau comics/{comic_slug}/cover.webp
 */
export async function saveAndUploadWebP(
  imageBuffer: Buffer,
  keyPath: string
): Promise<string> {
  // 1. Konversi ke WebP
  const webpBuffer = await convertToWebP(imageBuffer, 80);

  // 2. Unggah melalui Storage Manager (OneDrive -> ImageKit -> Local)
  const result = await uploadComicImage(webpBuffer, keyPath);

  console.log(`[WebP Converter] Upload selesai via provider [${result.provider}]: ${result.url}`);
  return result.url;
}
