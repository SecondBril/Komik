import sharp from 'sharp';
import { uploadComicImage } from './storage-manager';

export interface ProcessedImageResult {
  buffer: Buffer;
  format: 'webp' | 'jpeg';
  contentType: 'image/webp' | 'image/jpeg';
  extension: 'webp' | 'jpg';
  width?: number;
  height?: number;
}

// Max dimensions allowed by WebP specification (libwebp: 16383 x 16383 px)
const MAX_WEBP_DIMENSION = 16383;
// Max dimensions allowed by standard JPEG specification (65535 x 65535 px)
const MAX_JPEG_DIMENSION = 65535;

/**
 * Memproses buffer gambar secara optimal:
 * 1. Jika dimensi <= 16383px: Dikonversi ke WebP terkompresi (quality 80).
 * 2. Jika dimensi > 16383px (webtoon strip vertikal panjang) atau WebP gagal:
 *    Otomatis beralih ke Progressive MozJPEG (quality 80) yang mendukung hingga 65535px dan streaming rendering cepat di browser.
 * 3. Jika dimensi > 65535px: Auto-resize tinggi ke 65500px agar tetap valid.
 */
export async function processOptimalImage(
  inputBuffer: Buffer,
  quality = 80
): Promise<ProcessedImageResult> {
  const image = sharp(inputBuffer);
  let metadata;
  try {
    metadata = await image.metadata();
  } catch (e) {
    // Abaikan jika metadata tidak terbaca
  }

  const width = metadata?.width;
  const height = metadata?.height;

  const exceedsWebpLimit =
    (width && width > MAX_WEBP_DIMENSION) ||
    (height && height > MAX_WEBP_DIMENSION);

  // Jika masih dalam batas WebP, utamakan WebP
  if (!exceedsWebpLimit) {
    try {
      const webpBuffer = await sharp(inputBuffer)
        .webp({ quality, effort: 4 })
        .toBuffer();

      return {
        buffer: webpBuffer,
        format: 'webp',
        contentType: 'image/webp',
        extension: 'webp',
        width,
        height,
      };
    } catch (webpErr: any) {
      console.warn(
        `[WebP Converter] Konversi WebP gagal (${webpErr?.message || webpErr}), beralih ke progressive MozJPEG...`
      );
    }
  } else {
    console.info(
      `[WebP Converter] Dimensi gambar (${width || '?'}x${height || '?'}) melebihi batas WebP (${MAX_WEBP_DIMENSION}px). Otomatis beralih ke Progressive MozJPEG...`
    );
  }

  // Fallback ke Progressive MozJPEG
  let jpegPipeline = sharp(inputBuffer);

  if (height && height > MAX_JPEG_DIMENSION) {
    console.warn(
      `[WebP Converter] Tinggi (${height}px) melebihi batas JPEG (${MAX_JPEG_DIMENSION}px). Auto-resizing ke 65500px...`
    );
    jpegPipeline = jpegPipeline.resize({ height: 65500, withoutEnlargement: true });
  } else if (width && width > MAX_JPEG_DIMENSION) {
    console.warn(
      `[WebP Converter] Lebar (${width}px) melebihi batas JPEG (${MAX_JPEG_DIMENSION}px). Auto-resizing ke 65500px...`
    );
    jpegPipeline = jpegPipeline.resize({ width: 65500, withoutEnlargement: true });
  }

  try {
    const jpegBuffer = await jpegPipeline
      .jpeg({
        quality,
        mozjpeg: true,
        progressive: true,
        chromaSubsampling: '4:2:0',
      })
      .toBuffer();

    return {
      buffer: jpegBuffer,
      format: 'jpeg',
      contentType: 'image/jpeg',
      extension: 'jpg',
      width,
      height,
    };
  } catch (mozErr) {
    const fallbackJpegBuffer = await jpegPipeline
      .jpeg({
        quality,
        progressive: true,
      })
      .toBuffer();

    return {
      buffer: fallbackJpegBuffer,
      format: 'jpeg',
      contentType: 'image/jpeg',
      extension: 'jpg',
      width,
      height,
    };
  }
}

/**
 * Mengonversi image Buffer menjadi WebP, atau fallback ke Progressive JPEG jika batas WebP terlampaui.
 */
export async function convertToWebP(inputBuffer: Buffer, quality = 80): Promise<Buffer> {
  const result = await processOptimalImage(inputBuffer, quality);
  return result.buffer;
}

/**
 * Mengonversi gambar dan mengunggah menggunakan alur Dual-Storage:
 * 1. OneDrive (Penyimpanan Utama)
 * 2. ImageKit (Penyimpanan Sekunder / Cadangan)
 * 3. Local Storage /public/comics/ (Jaring Pengaman Lokal)
 * 
 * Otomatis menyesuaikan ekstensi keyPath (.webp atau .jpg) sesuai format hasil kompresi terbaik.
 */
export async function saveAndUploadWebP(
  imageBuffer: Buffer,
  keyPath: string
): Promise<string> {
  // 1. Konversi ke format optimal (WebP atau Progressive MozJPEG jika strip panjang)
  const processed = await processOptimalImage(imageBuffer, 80);

  // 2. Sesuaikan ekstensi keyPath jika menggunakan JPEG
  let actualKeyPath = keyPath;
  if (processed.extension === 'jpg' && actualKeyPath.endsWith('.webp')) {
    actualKeyPath = actualKeyPath.replace(/\.webp$/, '.jpg');
  }

  // 3. Unggah melalui Storage Manager (OneDrive -> ImageKit -> Local)
  const result = await uploadComicImage(processed.buffer, actualKeyPath, processed.contentType);

  console.log(`[Storage Converter] Upload selesai via provider [${result.provider}] (${processed.extension.toUpperCase()}): ${result.url}`);
  return result.url;
}

/**
 * Validates image buffer size and format minimum threshold (checks magic bytes)
 */
export function validateImageBuffer(buffer: Buffer, minSizeBytes = 32): boolean {
  if (!buffer || buffer.length < minSizeBytes) {
    return false;
  }

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isWebp =
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;
  const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;

  return isJpeg || isPng || isWebp || isGif;
}
