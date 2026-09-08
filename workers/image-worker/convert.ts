import sharp from 'sharp';

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
 * Optimally processes an image buffer:
 * 1. If dimensions are within WebP limits (<= 16383px), converts to high-compression WebP.
 * 2. If dimensions exceed 16383px (common in vertical webtoon/manhwa strips) or WebP conversion fails,
 *    converts to progressive MozJPEG (quality 80) which supports up to 65535px and loads progressively in browsers.
 * 3. If height exceeds 65535px, automatically resizes height to 65500px to maintain JPEG validity.
 */
export async function processOptimalImage(
  inputBuffer: Buffer,
  quality = 80
): Promise<ProcessedImageResult> {
  const image = sharp(inputBuffer);
  let metadata;
  try {
    metadata = await image.metadata();
  } catch (metaErr) {
    // If metadata cannot be read, attempt direct WebP with fallback
  }

  const width = metadata?.width;
  const height = metadata?.height;

  const exceedsWebpLimit =
    (width && width > MAX_WEBP_DIMENSION) ||
    (height && height > MAX_WEBP_DIMENSION);

  // If within WebP dimension limits, attempt WebP first
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
        `[Image Processor] WebP conversion failed (${webpErr?.message || webpErr}), falling back to progressive MozJPEG...`
      );
    }
  } else {
    console.info(
      `[Image Processor] Image dimension (${width || '?'}x${height || '?'}) exceeds WebP limit (${MAX_WEBP_DIMENSION}px). Converting to progressive MozJPEG...`
    );
  }

  // Fallback to Progressive MozJPEG
  let jpegPipeline = sharp(inputBuffer);

  // If dimension exceeds JPEG limit (65535), resize proportionally
  if (height && height > MAX_JPEG_DIMENSION) {
    console.warn(
      `[Image Processor] Height (${height}px) exceeds JPEG limit (${MAX_JPEG_DIMENSION}px). Auto-resizing height to 65500px...`
    );
    jpegPipeline = jpegPipeline.resize({ height: 65500, withoutEnlargement: true });
  } else if (width && width > MAX_JPEG_DIMENSION) {
    console.warn(
      `[Image Processor] Width (${width}px) exceeds JPEG limit (${MAX_JPEG_DIMENSION}px). Auto-resizing width to 65500px...`
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
    // If mozjpeg fails on some environment, fallback to standard progressive JPEG
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
 * Converts image buffer to WebP, or falls back to progressive JPEG if WebP limits are exceeded.
 * Provided for backwards compatibility with any existing callers expecting a Buffer.
 */
export async function convertToWebP(inputBuffer: Buffer, quality = 80): Promise<Buffer> {
  const result = await processOptimalImage(inputBuffer, quality);
  return result.buffer;
}

/**
 * Validates image buffer size and format minimum threshold (checks magic bytes)
 */
export function validateImageBuffer(buffer: Buffer, minSizeBytes = 2048): boolean {
  if (!buffer || buffer.length < minSizeBytes) {
    return false;
  }

  // Check magic bytes to guarantee valid image binary (avoid HTML/404/Cloudflare error responses)
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
