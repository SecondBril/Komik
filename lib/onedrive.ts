/**
 * Microsoft OneDrive Client & Graph API Helper
 * Menggunakan Microsoft Graph API REST untuk integrasi cloud storage
 */

import path from 'path';

interface OneDriveCredentials {
  clientId: string;
  clientSecret?: string;
  tenantId: string;
  refreshToken: string;
  rootFolder: string;
}

interface OneDriveQuota {
  total: number;
  used: number;
  remaining: number;
  state: 'normal' | 'nearing' | 'critical' | 'exceeded' | 'unknown';
}

interface OneDriveUploadResult {
  id: string;
  name: string;
  size: number;
  path: string;
  proxyUrl: string;
}

// In-memory token cache untuk efisiensi request
let tokenCache: {
  accessToken: string;
  expiresAt: number;
} | null = null;

/**
 * Membaca konfigurasi OneDrive dari environment variables
 */
export function getOneDriveCredentials(): OneDriveCredentials | null {
  const clientId = process.env.ONEDRIVE_CLIENT_ID || '';
  const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET || '';
  const tenantId = process.env.ONEDRIVE_TENANT_ID || 'consumers'; // 'consumers' untuk akun personal Hotmail/Outlook, atau tenant ID untuk enterprise/kampus
  const refreshToken = process.env.ONEDRIVE_REFRESH_TOKEN || '';
  const rootFolder = (process.env.ONEDRIVE_ROOT_FOLDER || 'comics').replace(/^\/+|\/+$/g, '');

  if (!clientId || !refreshToken || clientId.startsWith('your-') || refreshToken.startsWith('your-')) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    tenantId,
    refreshToken,
    rootFolder,
  };
}

/**
 * Mendapatkan Access Token aktif dari Microsoft OAuth2 menggunakan refresh_token
 */
export async function getOneDriveAccessToken(): Promise<string> {
  const creds = getOneDriveCredentials();
  if (!creds) {
    throw new Error('Kredensial OneDrive (ONEDRIVE_CLIENT_ID / ONEDRIVE_REFRESH_TOKEN) belum dikonfigurasi.');
  }

  const now = Date.now();
  // Gunakan token di cache jika masih valid (dengan margin 3 menit)
  if (tokenCache && tokenCache.expiresAt > now + 180_000) {
    return tokenCache.accessToken;
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`;
  const bodyParams: Record<string, string> = {
    client_id: creds.clientId,
    grant_type: 'refresh_token',
    refresh_token: creds.refreshToken,
    scope: 'https://graph.microsoft.com/Files.ReadWrite offline_access',
  };

  if (creds.clientSecret) {
    bodyParams.client_secret = creds.clientSecret;
  }

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(bodyParams).toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    tokenCache = null;
    throw new Error(`Gagal memperbarui token Microsoft Graph (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const expiresInMs = (data.expires_in || 3600) * 1000;

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + expiresInMs,
  };

  return data.access_token;
}

/**
 * Memeriksa sisa kuota dan status penyimpanan OneDrive
 */
export async function getOneDriveQuota(): Promise<OneDriveQuota> {
  const token = await getOneDriveAccessToken();

  const res = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gagal membaca informasi kuota OneDrive: ${err}`);
  }

  const data = await res.json();
  const quota = data.quota || {};

  return {
    total: quota.total || 0,
    used: quota.used || 0,
    remaining: quota.remaining || 0,
    state: quota.state || 'unknown',
  };
}

/**
 * Mengunggah file buffer (misal WebP gambar komik) ke OneDrive.
 * Jika file <= 4MB, menggunakan Simple Upload endpoint Graph API.
 */
export async function uploadToOneDrive(
  imageBuffer: Buffer,
  keyPath: string,
  contentType?: string
): Promise<OneDriveUploadResult> {
  const creds = getOneDriveCredentials();
  if (!creds) {
    throw new Error('Kredensial OneDrive tidak tersedia');
  }

  // 1. Cek kuota OneDrive sebelum upload
  try {
    const quota = await getOneDriveQuota();
    if (quota.state === 'exceeded' || (quota.remaining > 0 && quota.remaining < imageBuffer.length)) {
      throw new Error(`ONEDRIVE_QUOTA_FULL: Penyimpanan OneDrive penuh (tersisa ${Math.round(quota.remaining / 1024 / 1024)} MB)`);
    }
  } catch (quotaErr: any) {
    if (quotaErr.message?.includes('ONEDRIVE_QUOTA_FULL')) {
      throw quotaErr;
    }
    console.warn('[OneDrive] Peringatan saat cek kuota (lanjut mencoba upload):', quotaErr.message);
  }

  const token = await getOneDriveAccessToken();

  // Bersihkan path
  const cleanKey = keyPath.replace(/^\/+/, '');
  const fullItemPath = `${creds.rootFolder}/${cleanKey}`;
  const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(fullItemPath).replace(/%2F/g, '/')}:/content`;

  const ext = path.extname(cleanKey).toLowerCase();
  const mimeType =
    contentType ||
    (ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.png'
      ? 'image/png'
      : 'image/webp');

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': mimeType,
    },
    body: new Uint8Array(imageBuffer),
  });

  if (!res.ok) {
    const errText = await res.text();
    // Jika kode status 507 adalah Insufficient Storage
    if (res.status === 507 || errText.includes('quota') || errText.includes('storage')) {
      throw new Error(`ONEDRIVE_QUOTA_FULL: Ruang penyimpanan OneDrive tidak mencukupi (${res.status})`);
    }
    throw new Error(`OneDrive upload gagal (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const proxyUrl = `/api/storage/onedrive?path=${encodeURIComponent(cleanKey)}`;

  return {
    id: data.id,
    name: data.name,
    size: data.size || imageBuffer.length,
    path: cleanKey,
    proxyUrl,
  };
}

/**
 * Mendapatkan Direct Download URL dari Microsoft CDN untuk file tertentu.
 * URL ini didapatkan dari item metadata (@microsoft.graph.downloadUrl).
 */
export async function getOneDriveDownloadUrl(keyPath: string): Promise<string | null> {
  const creds = getOneDriveCredentials();
  if (!creds) return null;

  const token = await getOneDriveAccessToken();
  const cleanKey = keyPath.replace(/^\/+/, '');
  const fullItemPath = `${creds.rootFolder}/${cleanKey}`;
  const metaUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(fullItemPath).replace(/%2F/g, '/')}`;

  const res = await fetch(metaUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  return data['@microsoft.graph.downloadUrl'] || null;
}

/**
 * Menghapus file atau folder di OneDrive
 */
export async function deleteOneDrivePath(keyPath: string): Promise<{ success: boolean; message?: string }> {
  const creds = getOneDriveCredentials();
  if (!creds) return { success: false, message: 'OneDrive belum dikonfigurasi' };

  try {
    const token = await getOneDriveAccessToken();
    const cleanKey = keyPath.replace(/^\/+/, '');
    const fullItemPath = `${creds.rootFolder}/${cleanKey}`;
    const deleteUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(fullItemPath).replace(/%2F/g, '/')}`;

    const res = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok || res.status === 404) {
      return { success: true };
    }

    const err = await res.text();
    return { success: false, message: `Gagal menghapus OneDrive item (${res.status}): ${err}` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error saat menghapus item di OneDrive' };
  }
}
