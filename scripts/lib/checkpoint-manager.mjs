import crypto from 'crypto';

/**
 * Checkpoint Manager untuk GitHub Actions & Long-Running Tasks
 * Menyimpan progres di database Turso agar task yang terpotong batas waktu (6 jam)
 * dapat otomatis dilanjutkan dari posisi terakhir tanpa mengulang dari awal.
 */

export async function ensureCheckpointTables(turso) {
  if (!turso) return;
  try {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS action_checkpoints (
        task_key TEXT PRIMARY KEY,
        current_cursor INTEGER DEFAULT 0,
        last_item_id TEXT,
        total_items INTEGER DEFAULT 0,
        processed_count INTEGER DEFAULT 0,
        repaired_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        session_run_id TEXT,
        continuation_count INTEGER DEFAULT 0,
        last_run_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        metadata TEXT DEFAULT '{}'
      );
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS action_history_logs (
        id TEXT PRIMARY KEY,
        task_key TEXT NOT NULL,
        session_run_id TEXT,
        shard_index INTEGER,
        total_shards INTEGER,
        cursor_start INTEGER,
        cursor_end INTEGER,
        items_processed INTEGER,
        items_repaired INTEGER,
        status TEXT,
        duration_seconds REAL,
        details TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await turso.execute(`CREATE INDEX IF NOT EXISTS idx_action_hist_key ON action_history_logs(task_key, created_at DESC);`);
  } catch (err) {
    console.warn('⚠️ Gagal memastikan tabel checkpoint di Turso:', err.message);
  }
}

export async function getCheckpoint(turso, taskKey) {
  if (!turso) return null;
  try {
    const res = await turso.execute({
      sql: `SELECT task_key, current_cursor, last_item_id, total_items, processed_count, repaired_count, status, session_run_id, continuation_count, last_run_at, completed_at, metadata FROM action_checkpoints WHERE task_key = ? LIMIT 1;`,
      args: [taskKey],
    });
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      taskKey: String(row.task_key),
      cursor: Number(row.current_cursor || 0),
      lastItemId: row.last_item_id ? String(row.last_item_id) : null,
      totalItems: Number(row.total_items || 0),
      processedCount: Number(row.processed_count || 0),
      repairedCount: Number(row.repaired_count || 0),
      status: String(row.status || 'pending'),
      sessionRunId: row.session_run_id ? String(row.session_run_id) : null,
      continuationCount: Number(row.continuation_count || 0),
      lastRunAt: row.last_run_at ? String(row.last_run_at) : null,
      completedAt: row.completed_at ? String(row.completed_at) : null,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata || {}),
    };
  } catch (err) {
    console.warn(`⚠️ Gagal membaca checkpoint "${taskKey}":`, err.message);
    return null;
  }
}

export async function saveCheckpoint(turso, data) {
  if (!turso) return false;
  try {
    const {
      taskKey,
      cursor = 0,
      lastItemId = null,
      totalItems = 0,
      processedCount = 0,
      repairedCount = 0,
      status = 'in_progress',
      sessionRunId = null,
      continuationCount = 0,
      metadata = {},
    } = data;

    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    const metaStr = typeof metadata === 'object' ? JSON.stringify(metadata) : String(metadata || '{}');

    await turso.execute({
      sql: `
        INSERT INTO action_checkpoints (
          task_key, current_cursor, last_item_id, total_items, processed_count, repaired_count,
          status, session_run_id, continuation_count, last_run_at, completed_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
        ON CONFLICT(task_key) DO UPDATE SET
          current_cursor = excluded.current_cursor,
          last_item_id = excluded.last_item_id,
          total_items = excluded.total_items,
          processed_count = excluded.processed_count,
          repaired_count = excluded.repaired_count,
          status = excluded.status,
          session_run_id = excluded.session_run_id,
          continuation_count = excluded.continuation_count,
          last_run_at = CURRENT_TIMESTAMP,
          completed_at = COALESCE(excluded.completed_at, action_checkpoints.completed_at),
          metadata = excluded.metadata;
      `,
      args: [
        taskKey,
        cursor,
        lastItemId,
        totalItems,
        processedCount,
        repairedCount,
        status,
        sessionRunId,
        continuationCount,
        completedAt,
        metaStr,
      ],
    });
    return true;
  } catch (err) {
    console.warn(`⚠️ Gagal menyimpan checkpoint "${data.taskKey}":`, err.message);
    return false;
  }
}

export async function recordHistoryLog(turso, data) {
  if (!turso) return false;
  try {
    const {
      taskKey,
      sessionRunId = null,
      shardIndex = 0,
      totalShards = 1,
      cursorStart = 0,
      cursorEnd = 0,
      itemsProcessed = 0,
      itemsRepaired = 0,
      status = 'completed',
      durationSeconds = 0,
      details = {},
    } = data;

    const id = `hist_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const detStr = typeof details === 'object' ? JSON.stringify(details) : String(details || '{}');

    await turso.execute({
      sql: `
        INSERT INTO action_history_logs (
          id, task_key, session_run_id, shard_index, total_shards,
          cursor_start, cursor_end, items_processed, items_repaired,
          status, duration_seconds, details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
      `,
      args: [
        id,
        taskKey,
        sessionRunId,
        shardIndex,
        totalShards,
        cursorStart,
        cursorEnd,
        itemsProcessed,
        itemsRepaired,
        status,
        durationSeconds,
        detStr,
      ],
    });
    return true;
  } catch (err) {
    console.warn(`⚠️ Gagal mencatat history log:`, err.message);
    return false;
  }
}

export async function resetCheckpoints(turso, taskPrefix) {
  if (!turso) return 0;
  try {
    const res = await turso.execute({
      sql: `DELETE FROM action_checkpoints WHERE task_key LIKE ?;`,
      args: [`${taskPrefix}%`],
    });
    console.log(`🧹 Berhasil mereset checkpoint dengan prefix "${taskPrefix}".`);
    return res.rowsAffected || 0;
  } catch (err) {
    console.warn(`⚠️ Gagal mereset checkpoint:`, err.message);
    return 0;
  }
}

export async function getAllShardsStatus(turso, taskPrefix, totalShards) {
  if (!turso) return { allCompleted: false, shards: [], unfinishedCount: totalShards };
  try {
    const res = await turso.execute({
      sql: `SELECT task_key, current_cursor, total_items, processed_count, repaired_count, status, last_item_id, last_run_at, completed_at, continuation_count FROM action_checkpoints WHERE task_key LIKE ? ORDER BY task_key ASC;`,
      args: [`${taskPrefix}%`],
    });

    const shardMap = new Map();
    for (const r of res.rows) {
      shardMap.set(String(r.task_key), {
        taskKey: String(r.task_key),
        cursor: Number(r.current_cursor || 0),
        totalItems: Number(r.total_items || 0),
        processedCount: Number(r.processed_count || 0),
        repairedCount: Number(r.repaired_count || 0),
        status: String(r.status || 'pending'),
        lastItemId: r.last_item_id ? String(r.last_item_id) : null,
        lastRunAt: r.last_run_at ? String(r.last_run_at) : null,
        completedAt: r.completed_at ? String(r.completed_at) : null,
        continuationCount: Number(r.continuation_count || 0),
      });
    }

    const shards = [];
    let completedCount = 0;
    let totalProcessed = 0;
    let totalRepaired = 0;

    for (let i = 0; i < totalShards; i++) {
      const key = `${taskPrefix}_shard_${i}_of_${totalShards}`;
      const existing = shardMap.get(key) || {
        taskKey: key,
        cursor: 0,
        totalItems: 0,
        processedCount: 0,
        repairedCount: 0,
        status: 'pending',
        lastItemId: null,
        lastRunAt: null,
        completedAt: null,
        continuationCount: 0,
      };

      if (existing.status === 'completed') {
        completedCount++;
      }
      totalProcessed += existing.processedCount;
      totalRepaired += existing.repairedCount;
      shards.push(existing);
    }

    const allCompleted = completedCount === totalShards;
    const unfinishedCount = totalShards - completedCount;

    return {
      allCompleted,
      shards,
      completedCount,
      unfinishedCount,
      totalProcessed,
      totalRepaired,
    };
  } catch (err) {
    console.warn(`⚠️ Gagal membaca status shard:`, err.message);
    return { allCompleted: false, shards: [], unfinishedCount: totalShards };
  }
}
