import fs from 'fs';
import { createClient as createTursoClient } from '@libsql/client';
import { ensureCheckpointTables, getAllShardsStatus, resetCheckpoints } from './lib/checkpoint-manager.mjs';

// 1. Load Environment Variables from .env.local if available
if (!process.env.TURSO_DATABASE_URL && fs.existsSync('.env.local')) {
  try {
    const envLines = fs.readFileSync('.env.local', 'utf8').split('\n');
    for (const line of envLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {}
}

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  console.error('❌ Turso credentials (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN) belum diset!');
  process.exit(1);
}

const turso = createTursoClient({ url: tursoUrl, authToken: tursoToken });

async function main() {
  const args = process.argv.slice(2);
  const taskPrefix = args[0] || 'repair_images';
  const totalShards = parseInt(args[1] || '20', 10);
  const isReset = args.includes('--reset') || process.env.RESET_CHECKPOINTS === 'true';

  await ensureCheckpointTables(turso);

  if (isReset) {
    console.log(`🧹 Mereset seluruh checkpoint untuk "${taskPrefix}"...`);
    await resetCheckpoints(turso, taskPrefix);
    console.log(`✅ Checkpoint berhasil direset. Run berikutnya akan mulai dari awal.`);
    return;
  }

  console.log(`\n======================================================`);
  console.log(`📊 STATUS CHECKPOINT & HISTORI AKSI: "${taskPrefix}" (${totalShards} Shards)`);
  console.log(`======================================================`);

  const status = await getAllShardsStatus(turso, taskPrefix, totalShards);

  console.log(`\n┌───────┬──────────────┬──────────────┬──────────────┬─────────────────────────┐`);
  console.log(`│ Shard │ Status       │ Progres      │ Diperbaiki   │ Terakhir Berjalan       │`);
  console.log(`├───────┼──────────────┼──────────────┼──────────────┼─────────────────────────┤`);

  for (let i = 0; i < status.shards.length; i++) {
    const s = status.shards[i];
    const shardLabel = `Shard ${(i + 1).toString().padStart(2, ' ')}`;
    const statusLabel = s.status === 'completed'
      ? '✅ Selesai    '
      : s.status === 'in_progress'
      ? '⏳ Lanjut...  '
      : '⚪ Belum Mulai ';

    const progressLabel = s.totalItems > 0
      ? `${s.cursor}/${s.totalItems}`.padEnd(12, ' ')
      : '0/0         ';

    const repairedLabel = `${s.repairedCount} komik`.padEnd(12, ' ');
    const lastRunLabel = s.lastRunAt ? s.lastRunAt.replace('T', ' ').slice(0, 19) : '-                      ';

    console.log(`│ ${shardLabel} │ ${statusLabel} │ ${progressLabel} │ ${repairedLabel} │ ${lastRunLabel} │`);
  }

  console.log(`└───────┴──────────────┴──────────────┴──────────────┴─────────────────────────┘\n`);

  console.log(`📈 Ringkasan:`);
  console.log(`   - Shard Selesai   : ${status.completedCount} / ${totalShards}`);
  console.log(`   - Shard Belum     : ${status.unfinishedCount} / ${totalShards}`);
  console.log(`   - Total Diperiksa : ${status.totalProcessed} komik`);
  console.log(`   - Total Diperbaiki: ${status.totalRepaired} komik`);

  const needsContinuation = !status.allCompleted;

  if (needsContinuation) {
    console.log(`\n⚠️ STATUS: MASIH ADA ${status.unfinishedCount} SHARD BELUM SELESAI.`);
    console.log(`🔄 Rekomendasi: Lanjutkan sesi eksekusi berikutnya secara otomatis.`);
  } else {
    console.log(`\n🎉 STATUS: SELURUH ${totalShards} SHARD TELAH SELESAI 100%!`);
  }

  // Jika berjalan di dalam GitHub Actions runner, set step output
  const githubOutputFile = process.env.GITHUB_OUTPUT;
  if (githubOutputFile && fs.existsSync(githubOutputFile)) {
    fs.appendFileSync(githubOutputFile, `needs_continuation=${needsContinuation ? 'true' : 'false'}\n`);
    fs.appendFileSync(githubOutputFile, `all_completed=${status.allCompleted ? 'true' : 'false'}\n`);
    fs.appendFileSync(githubOutputFile, `unfinished_count=${status.unfinishedCount}\n`);
    fs.appendFileSync(githubOutputFile, `completed_count=${status.completedCount}\n`);
    fs.appendFileSync(githubOutputFile, `total_repaired=${status.totalRepaired}\n`);
  }

  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('Fatal error saat cek status:', err);
  process.exit(1);
});
