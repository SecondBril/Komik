import fs from 'fs';
import path from 'path';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createTursoClient } from '@libsql/client';

// 1. Load Environment Variables from .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const tursoUrl = env.TURSO_DATABASE_URL;
const tursoToken = env.TURSO_AUTH_TOKEN;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials missing in .env.local');
  process.exit(1);
}

if (!tursoUrl || !tursoToken) {
  console.error('❌ Turso credentials missing in .env.local');
  process.exit(1);
}

const supabase = createSupabaseClient(supabaseUrl, supabaseKey);
const turso = createTursoClient({ url: tursoUrl, authToken: tursoToken });

const CHECKPOINT_DIR = path.resolve('scratch');
if (!fs.existsSync(CHECKPOINT_DIR)) fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
const CHECKPOINT_FILE = path.join(CHECKPOINT_DIR, 'pages-checkpoint.json');

function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    } catch {}
  }
  return { lastId: null, migrated: 0 };
}

function saveCheckpoint(lastId, migrated) {
  try {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ lastId, migrated, updatedAt: new Date().toISOString() }));
  } catch {}
}

async function ensureTursoSchema() {
  console.log('📌 Memastikan tabel chapter_pages di Turso siap (tanpa foreign key overhead)...');
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS chapter_pages (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      UNIQUE (chapter_id, page_number)
    );
  `);
  await turso.execute(`CREATE INDEX IF NOT EXISTS idx_chapter_pages_ch ON chapter_pages (chapter_id, page_number ASC);`);
}

async function fetchSupabaseBatch(lastId, limit = 1000) {
  let retries = 10;
  let delay = 1000;

  while (retries > 0) {
    try {
      let query = supabase
        .from('chapter_pages')
        .select('id, chapter_id, page_number, image_url, width, height')
        .order('id', { ascending: true })
        .limit(limit);

      if (lastId) {
        query = query.gt('id', lastId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
      console.warn(`\n⚠️ Supabase fetch warning: ${err.message}. Retry dalam ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(10000, delay * 1.5);
    }
  }
  return [];
}

async function writeTursoBatch(rows) {
  if (!rows || rows.length === 0) return;
  let retries = 10;
  let delay = 1000;

  const stmts = rows.map((p) => ({
    sql: `
      INSERT OR IGNORE INTO chapter_pages (id, chapter_id, page_number, image_url, width, height)
      VALUES (?, ?, ?, ?, ?, ?);
    `,
    args: [p.id, p.chapter_id, p.page_number, p.image_url, p.width || null, p.height || null],
  }));

  while (retries > 0) {
    try {
      await turso.batch(stmts, 'write');
      return;
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
      console.warn(`\n⚠️ Turso write warning: ${err.message}. Retry dalam ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(10000, delay * 1.5);
    }
  }
}

async function main() {
  const startTime = Date.now();
  console.log('================================================================');
  console.log('🚀 MEMULAI MIGRASI CEPAT: 1.55 JUTA CHAPTER PAGES -> TURSO (5 GB)');
  console.log('================================================================');

  await ensureTursoSchema();

  const checkpoint = loadCheckpoint();
  let lastId = checkpoint.lastId;
  let migrated = checkpoint.migrated || 0;

  // Cek jumlah yang sudah ada di Turso
  const { rows: tCount } = await turso.execute('SELECT COUNT(*) as count FROM chapter_pages;');
  const existingInTurso = Number(tCount[0]?.count || 0);
  if (existingInTurso > migrated) migrated = existingInTurso;

  const estimatedTotal = 1557618;
  console.log(`Posisi checkpoint: ${migrated} baris sudah di Turso. Melanjutkan dari ID: ${lastId || 'AWAL'}...`);

  const BATCH_SIZE = 1000;
  const startingMigrated = migrated;
  let batchNum = Math.floor(migrated / BATCH_SIZE);
  let isRunning = true;

  process.on('SIGINT', () => {
    console.log('\n⚠️ Mendeteksi interupsi (SIGINT). Menyimpan checkpoint sebelum keluar...');
    saveCheckpoint(lastId, migrated);
    process.exit(0);
  });

  // Pipeline: fetch batch pertama
  let nextFetchPromise = fetchSupabaseBatch(lastId, BATCH_SIZE);

  while (isRunning) {
    const rows = await nextFetchPromise;

    if (!rows || rows.length === 0) {
      console.log('\n✓ Tidak ada data lagi dari Supabase. Migrasi selesai!');
      break;
    }

    const currentBatchLastId = rows[rows.length - 1].id;
    lastId = currentBatchLastId;

    // Prefetch batch berikutnya secara bersamaan di background saat menulis ke Turso
    nextFetchPromise = fetchSupabaseBatch(lastId, BATCH_SIZE);

    // Tulis batch saat ini ke Turso
    await writeTursoBatch(rows);

    migrated += rows.length;
    batchNum++;

    // Hitung kecepatan sesi ini dan estimasi waktu selesai
    const elapsedSec = (Date.now() - startTime) / 1000;
    const rowsThisRun = migrated - startingMigrated;
    const speed = Math.round(rowsThisRun / Math.max(1, elapsedSec));
    const percent = Math.min(100, ((migrated / estimatedTotal) * 100)).toFixed(1);
    const remainingRows = Math.max(0, estimatedTotal - migrated);
    const etaMin = speed > 0 ? (remainingRows / speed / 60).toFixed(1) : '?';

    const logLine = `[Batch ${batchNum}] Migrated: ${migrated.toLocaleString('id-ID')} / ~${estimatedTotal.toLocaleString('id-ID')} (${percent}%) | Speed: ${speed} rows/s | ETA: ${etaMin}m`;
    
    if (batchNum % 10 === 0) {
      console.log(logLine);
    } else {
      process.stdout.write(`\r${logLine}`);
    }

    // Simpan checkpoint tiap 5 batch
    if (batchNum % 5 === 0) {
      saveCheckpoint(lastId, migrated);
    }

    if (rows.length < BATCH_SIZE) {
      console.log('\n✓ Mencapai akhir tabel chapter_pages.');
      break;
    }
  }

  saveCheckpoint(lastId, migrated);

  const durationMin = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log('\n================================================================');
  console.log(`🎉 MIGRASI 1.55 JUTA CHAPTER PAGES SELESAI DALAM ${durationMin} MENIT!`);
  console.log(`Total Baris Tersimpan di Turso: ${migrated.toLocaleString('id-ID')}`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal migration error:', err);
  process.exit(1);
});
