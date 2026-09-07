/**
 * ImageKit Admin Helper
 * Used server-side only to delete files/folders when comics/chapters are removed.
 */

interface ImageKitDeleteResult {
  success: boolean;
  message?: string;
}

function getImageKitCredentials() {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || '';
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY || '';
  if (!privateKey || !publicKey) return null;
  return { privateKey, publicKey };
}

function getBasicAuthHeader(privateKey: string): string {
  return 'Basic ' + Buffer.from(privateKey + ':').toString('base64');
}

/**
 * Delete a single file from ImageKit by its fileId.
 * The fileId is typically embedded in the URL as the last path segment before the filename,
 * or retrieved from a bulk search. We use bulk delete by filePath instead.
 */
export async function deleteImageKitFileByPath(filePath: string): Promise<ImageKitDeleteResult> {
  const creds = getImageKitCredentials();
  if (!creds) return { success: false, message: 'ImageKit credentials not configured' };

  try {
    // 1. Search by filePath to get fileId
    const searchUrl = `https://api.imagekit.io/v1/files?path=${encodeURIComponent(filePath)}&limit=1`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: getBasicAuthHeader(creds.privateKey) },
    });
    const files = await searchRes.json();

    if (!Array.isArray(files) || files.length === 0) {
      return { success: true, message: 'File not found in ImageKit (already deleted or not uploaded)' };
    }

    const fileId = files[0].fileId;

    // 2. Delete by fileId
    const deleteRes = await fetch(`https://api.imagekit.io/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: getBasicAuthHeader(creds.privateKey) },
    });

    if (deleteRes.ok || deleteRes.status === 404) {
      return { success: true };
    }

    return { success: false, message: `Delete failed: ${deleteRes.status}` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Unknown error' };
  }
}

/**
 * Delete all files inside an ImageKit folder (bulk delete).
 * folderPath example: "/comics/slug-komik/14"
 */
export async function deleteImageKitFolder(folderPath: string): Promise<ImageKitDeleteResult> {
  const creds = getImageKitCredentials();
  if (!creds) return { success: false, message: 'ImageKit credentials not configured' };

  try {
    // 1. List all files in the folder
    const listUrl = `https://api.imagekit.io/v1/files?path=${encodeURIComponent(folderPath)}&limit=500`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: getBasicAuthHeader(creds.privateKey) },
    });
    const files = await listRes.json();

    if (!Array.isArray(files) || files.length === 0) {
      return { success: true, message: 'Folder empty or not found in ImageKit' };
    }

    const fileIds = files.map((f: any) => f.fileId).filter(Boolean);

    if (fileIds.length === 0) return { success: true };

    // 2. Bulk delete
    const bulkRes = await fetch('https://api.imagekit.io/v1/files/batch/deleteByFileIds', {
      method: 'POST',
      headers: {
        Authorization: getBasicAuthHeader(creds.privateKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileIds }),
    });

    if (bulkRes.ok) {
      return { success: true, message: `Deleted ${fileIds.length} files from ImageKit folder: ${folderPath}` };
    }

    return { success: false, message: `Bulk delete failed: ${bulkRes.status}` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Unknown error' };
  }
}

/**
 * Extract the ImageKit folder path from an image URL.
 * Example URL: https://ik.imagekit.io/m2imafj66/comics/slug/14/1.webp
 * Returns: /comics/slug/14
 */
export function extractImageKitFolderPath(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    // Path: /m2imafj66/comics/slug/14/1.webp → strip first segment (account-id)
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    // Remove account ID (first part) and filename (last part)
    const folderParts = parts.slice(1, -1);
    return '/' + folderParts.join('/');
  } catch {
    return null;
  }
}
