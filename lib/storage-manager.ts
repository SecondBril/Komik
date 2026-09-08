/**
 * Unified Storage Manager (Dual-Storage Architecture)
 * Prioritas 1: OneDrive (Penyimpanan Utama)
 * Prioritas 2: ImageKit (Penyimpanan Sekunder / Cadangan)
 * Prioritas 3: Local Storage /public/comics/ (Jaring Pengaman Lokal)
 */

import fs from 'fs';
import path from 'path';
import ImageKit from 'imagekit';
import {
  getOneDriveCredentials,
  uploadToOneDrive,
  deleteOneDrivePath,
  getOneDriveQuota,
} from './onedrive';
import { deleteImageKitFolder } from './imagekit-admin';

export type StorageProvider = 'onedrive' | 'imagekit' | 'local';

export interface StorageUploadResult {
  url: string;
  provider: StorageProvider;
  size: number;
}

/**
 * Inisialisasi ImageKit Client
 */
export function getImageKitClient(): ImageKit | null {
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
 * Menyimpan buffer secara lokal di folder public/comics/
 */
export function saveLocalFile(buffer: Buffer, keyPath: string): string {
  try {
    const cleanKey = keyPath.replace(/^\/+/, '');
    const relativePath = cleanKey.startsWith('comics/') ? cleanKey : `comics/${cleanKey}`;
    const fullPath = path.resolve(process.cwd(), 'public', relativePath);
    const targetFolder = path.dirname(fullPath);

    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    fs.writeFileSync(fullPath, buffer);
    const publicUrl = `/${relativePath}`;
    console.log(`[Storage Manager] Tersimpan di lokal fallback: ${publicUrl}`);
    return publicUrl;
  } catch (err: any) {
    console.error('[Storage Manager] Gagal menyimpan ke lokal:', err?.message || err);
    return `/comics/${keyPath.replace(/^\/+/, '')}`;
  }
}

/**
 * Mengunggah file gambar ke ImageKit
 */
async function tryUploadToImageKit(
  imageBuffer: Buffer,
  keyPath: string
): Promise<string | null> {
  const imagekit = getImageKitClient();
  if (!imagekit) return null;

  const cleanKey = keyPath.replace(/^\/+/, '');
  const fileName = cleanKey.split('/').pop() || 'page.webp';
  const folderPath = '/' + cleanKey.substring(0, cleanKey.lastIndexOf('/'));

  try {
    const response = await imagekit.upload({
      file: imageBuffer,
      fileName,
      folder: folderPath,
      useUniqueFileName: false,
    });

    if (response && response.url) {
      return response.url;
    }
  } catch (err: any) {
    console.warn('[Storage Manager] ImageKit upload gagal/penuh:', err?.message || err);
  }

  return null;
}

/**
 * Mengunggah gambar komik dengan alur Dual-Storage:
 * 1. Coba upload ke OneDrive (Primary).
 * 2. Jika OneDrive penuh, bermasalah, atau belum ada kredensial -> Otomatis alihkan ke ImageKit (Secondary).
 * 3. Jika ImageKit juga gagal/penuh -> Simpan ke Local Storage /public/comics/ (Safety Net).
 */
export async function uploadComicImage(
  imageBuffer: Buffer,
  keyPath: string
): Promise<StorageUploadResult> {
  const cleanKey = keyPath.replace(/^\/+/, '');
  const oneDriveCreds = getOneDriveCredentials();

  // -------------------------------------------------------------
  // LANGKAH 1: Coba OneDrive (Primary)
  // -------------------------------------------------------------
  if (oneDriveCreds) {
    try {
      console.log(`[Storage Manager] Mengunggah ke OneDrive (Primary): ${cleanKey}`);
      const oneDriveRes = await uploadToOneDrive(imageBuffer, cleanKey);
      return {
        url: oneDriveRes.proxyUrl,
        provider: 'onedrive',
        size: oneDriveRes.size,
      };
    } catch (oneDriveErr: any) {
      console.warn(
        `[Storage Manager] OneDrive penuh atau terjadi kendala: ${oneDriveErr?.message || oneDriveErr}. Mengalihkan ke ImageKit (Secondary)...`
      );
    }
  } else {
    console.info('[Storage Manager] Kredensial OneDrive belum dikonfigurasi, menggunakan ImageKit.');
  }

  // -------------------------------------------------------------
  // LANGKAH 2: Coba ImageKit (Secondary / Fallback)
  // -------------------------------------------------------------
  const imageKitUrl = await tryUploadToImageKit(imageBuffer, cleanKey);
  if (imageKitUrl) {
    console.log(`[Storage Manager] Berhasil diunggah ke ImageKit (Secondary): ${imageKitUrl}`);
    return {
      url: imageKitUrl,
      provider: 'imagekit',
      size: imageBuffer.length,
    };
  }

  // -------------------------------------------------------------
  // LANGKAH 3: Fallback ke Local Storage
  // -------------------------------------------------------------
  console.warn('[Storage Manager] Cloud storage tidak dapat diakses, beralih ke penyimpanan lokal.');
  const localUrl = saveLocalFile(imageBuffer, cleanKey);
  return {
    url: localUrl,
    provider: 'local',
    size: imageBuffer.length,
  };
}

/**
 * Menghapus folder chapter atau komik di kedua penyedia (OneDrive & ImageKit)
 */
export async function deleteComicFolderFromStorages(folderPath: string): Promise<{
  onedrive: boolean;
  imagekit: boolean;
}> {
  const cleanFolder = folderPath.replace(/^\/+|\/+$/g, '');
  const results = { onedrive: false, imagekit: false };

  // 1. Hapus dari OneDrive
  try {
    const oneDriveRes = await deleteOneDrivePath(cleanFolder);
    results.onedrive = oneDriveRes.success;
  } catch (e) {
    results.onedrive = false;
  }

  // 2. Hapus dari ImageKit
  try {
    const ikRes = await deleteImageKitFolder(`/${cleanFolder}`);
    results.imagekit = ikRes.success;
  } catch (e) {
    results.imagekit = false;
  }

  return results;
}
