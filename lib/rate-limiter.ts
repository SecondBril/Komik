import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: string;        // ISO 8601 string waktu reset besok 00:00 WIB
  resetSeconds: number;   // Detik tersisa hingga reset besok
  identifier: string;     // 'user:...' atau 'ip:...'
}

export const DAILY_REQUEST_LIMIT = 10000;

// In-Memory Fast Tier Cache untuk performa tinggi (<1ms)
interface CacheEntry {
  count: number;
  dateStr: string;
}

const memoryStore = new Map<string, CacheEntry>();

/**
 * Mendapatkan tanggal saat ini dalam format YYYY-MM-DD zona waktu WIB (Asia/Jakarta, UTC+7)
 */
export function getWibDateString(): string {
  const now = new Date();
  // Offset WIB = +7 jam (420 menit)
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibDate = new Date(utc + 7 * 3600000);
  return wibDate.toISOString().split('T')[0];
}

/**
 * Menghitung waktu reset besok tepat pukul 00:00 WIB
 */
export function getWibResetDetails(): { resetAt: string; resetSeconds: number } {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibDate = new Date(utc + 7 * 3600000);

  // Besok 00:00:00 WIB
  const tomorrowWib = new Date(wibDate);
  tomorrowWib.setDate(tomorrowWib.getDate() + 1);
  tomorrowWib.setHours(0, 0, 0, 0);

  // Konversi kembali ke UTC Epoch untuk menghitung selisih detik riil
  const tomorrowEpoch = tomorrowWib.getTime() - 7 * 3600000;
  const diffMs = Math.max(1000, tomorrowEpoch - now.getTime());
  const resetSeconds = Math.ceil(diffMs / 1000);

  return {
    resetAt: new Date(tomorrowEpoch).toISOString(),
    resetSeconds,
  };
}

/**
 * Mengekstrak identifier unik dari request:
 * - User Login: 'user:<uuid>'
 * - Tamu / Guest: 'ip:<ip_address>'
 */
export async function getRequestIdentifier(req: NextRequest): Promise<string> {
  // 1. Cek User Login via Supabase Auth Cookie / Header
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const supabase = createAdminClient();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user?.id) {
          return `user:${user.id}`;
        }
      }
    }

    // Cek auth cookie session jika ada
    const sbCookies = req.cookies.getAll().filter((c) => c.name.includes('-auth-token'));
    if (sbCookies.length > 0) {
      const supabase = createAdminClient();
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          return `user:${session.user.id}`;
        }
      }
    }
  } catch {
    // Fallback ke IP jika auth extraction gagal
  }

  // 2. Fallback ke IP Address untuk Tamu / Guest
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');

  let ip = cfConnectingIp || realIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : '');
  if (!ip || ip === '::1' || ip === '127.0.0.1') {
    ip = '127.0.0.1';
  }

  // Sanitasi IP address
  const cleanIp = ip.replace(/[^a-zA-Z0-9\.\:]/g, '');
  return `ip:${cleanIp || 'anonymous'}`;
}

/**
 * Mengecek dan menambah hitungan kuota harian untuk pengguna.
 * Batas: 10.000 request per hari (Reset 00:00 WIB).
 */
export async function checkDailyRateLimit(
  req: NextRequest,
  limit = DAILY_REQUEST_LIMIT
): Promise<RateLimitResult> {
  const identifier = await getRequestIdentifier(req);
  const todayWib = getWibDateString();
  const { resetAt, resetSeconds } = getWibResetDetails();

  // 1. Cek & Update di In-Memory Fast Tier
  let currentEntry = memoryStore.get(identifier);
  if (!currentEntry || currentEntry.dateStr !== todayWib) {
    currentEntry = { count: 1, dateStr: todayWib };
  } else {
    currentEntry.count += 1;
  }
  memoryStore.set(identifier, currentEntry);

  const currentCount = currentEntry.count;
  const allowed = currentCount <= limit;
  const remaining = Math.max(0, limit - currentCount);

  // 2. Sinkronisasi Asinkron ke Supabase jika tabel tersedia
  // (Dijalankan tanpa memblokir response jika koneksi lambat)
  try {
    const supabase = createAdminClient();
    if (supabase) {
      // Upsert atomic di Supabase Postgres
      Promise.resolve(
        supabase
          .from('daily_request_quotas')
          .upsert(
            {
              identifier,
              date: todayWib,
              request_count: currentCount,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'identifier,date' }
          )
      )
        .then(() => {})
        .catch(() => {});
    }
  } catch {
    // Abaikan jika tabel belum ada atau DB sibuk
  }

  return {
    allowed,
    count: currentCount,
    limit,
    remaining,
    resetAt,
    resetSeconds,
    identifier,
  };
}
