import sharp from 'sharp';

/**
 * Converts image buffer (JPG/PNG/JPEG) to compressed WebP format (quality 75-80)
 */
export async function convertToWebP(inputBuffer: Buffer, quality = 80): Promise<Buffer> {
  return await sharp(inputBuffer)
    .webp({ quality, effort: 4 })
    .toBuffer();
}

/**
 * Validates image buffer size and format minimum threshold
 */
export function validateImageBuffer(buffer: Buffer, minSizeBytes = 2048): boolean {
  if (!buffer || buffer.length < minSizeBytes) {
    return false;
  }
  return true;
}
