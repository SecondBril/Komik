/**
 * Microsoft OneDrive Client untuk Background Image Worker
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config();

interface OneDriveCredentials {
  clientId: string;
  clientSecret?: string;
  tenantId: string;
  refreshToken: string;
  rootFolder: string;
}

let tokenCache: {
  accessToken: string;
  expiresAt: number;
} | null = null;

export function getWorkerOneDriveCredentials(): OneDriveCredentials | null {
  const clientId = process.env.ONEDRIVE_CLIENT_ID || '';
  const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET || '';
  const tenantId = process.env.ONEDRIVE_TENANT_ID || 'consumers';
  const refreshToken = process.env.ONEDRIVE_REFRESH_TOKEN || '';
  const rootFolder = (process.env.ONEDRIVE_ROOT_FOLDER || 'comics').replace(/^\/+|\/+$/g, '');

  if (!clientId || !refreshToken || clientId.startsWith('your-') || refreshToken.startsWith('your-')) {
    return null;
  }

  return { clientId, clientSecret, tenantId, refreshToken, rootFolder };
}

export async function getWorkerOneDriveAccessToken(): Promise<string> {
  const creds = getWorkerOneDriveCredentials();
  if (!creds) {
    throw new Error('Kredensial OneDrive worker belum lengkap.');
  }

  const now = Date.now();
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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(bodyParams).toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    tokenCache = null;
    throw new Error(`Worker OneDrive Token Refresh Failed (${response.status}): ${errText}`);
  }

  const data = await response.json() as any;
  const expiresInMs = (data.expires_in || 3600) * 1000;

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + expiresInMs,
  };

  return data.access_token;
}

export async function uploadToOneDriveWorker(
  imageBuffer: Buffer,
  keyPath: string
): Promise<{ url: string; size: number }> {
  const creds = getWorkerOneDriveCredentials();
  if (!creds) throw new Error('Kredensial OneDrive tidak tersedia');

  const token = await getWorkerOneDriveAccessToken();
  const cleanKey = keyPath.replace(/^\/+/, '');
  const fullItemPath = `${creds.rootFolder}/${cleanKey}`;
  const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(fullItemPath).replace(/%2F/g, '/')}:/content`;

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/webp',
    },
    body: new Uint8Array(imageBuffer),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 507 || errText.includes('quota') || errText.includes('storage')) {
      throw new Error(`ONEDRIVE_QUOTA_FULL: Penyimpanan OneDrive penuh (${res.status})`);
    }
    throw new Error(`OneDrive worker upload failed (${res.status}): ${errText}`);
  }

  const proxyUrl = `/api/storage/onedrive?path=${encodeURIComponent(cleanKey)}`;
  return {
    url: proxyUrl,
    size: imageBuffer.length,
  };
}
