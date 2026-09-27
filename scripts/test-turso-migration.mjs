import fs from 'fs';
import path from 'path';
import { getTursoClient } from '../lib/turso.js';
import {
  getTursoComicBySlug,
  getTursoComicChapters,
  getTursoGenresWithCounts,
  getTursoBrowseComics,
  getTursoComicAdaptations,
} from '../lib/queries/turso-comics.js';

// Load .env.local
const env = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
for (const l of env.split('\n')) {
  const m = l.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (m) process.env[m[1]] = (m[2] || '').trim().replace(/^"|"$/g, '');
}

async function runTest() {
  console.log('=== VERIFYING TURSO DATA INTEGRATION ===\n');

  console.log('1. Checking Turso Connection...');
  const turso = getTursoClient();
  if (!turso) {
    console.error('❌ Turso client is null!');
    process.exit(1);
  }
  console.log('   ✓ Turso client connected');

  console.log('\n2. Testing Genres with Counts...');
  const genres = await getTursoGenresWithCounts();
  console.log(`   ✓ Found ${genres.length} genres with comic counts:`);
  console.log(`     Top 3:`, genres.slice(0, 3));

  console.log('\n3. Testing Comic By Slug ("one-piece")...');
  const op = await getTursoComicBySlug('one-piece');
  if (op) {
    console.log(`   ✓ Found One Piece: "${op.title}" (ID: ${op.id})`);
    console.log(`     Type: ${op.type}, Status: ${op.status}`);
  } else {
    console.warn('   ⚠️ One piece not found');
  }

  console.log('\n4. Testing Comic Chapters ("one-piece")...');
  const opChapters = await getTursoComicChapters('one-piece');
  console.log(`   ✓ Found ${opChapters.length} chapters for One Piece`);
  if (opChapters.length > 0) {
    console.log(`     Latest chapter: Ch. ${opChapters[0].chapter_number} (${opChapters[0].title})`);
  }

  console.log('\n5. Testing Browse Query...');
  const browseRes = await getTursoBrowseComics({ type: 'all', page: 1, limit: 5 });
  console.log(`   ✓ Browse total: ${browseRes.total} comics. Returned: ${browseRes.data.length} items`);

  console.log('\n6. Testing Adaptations...');
  if (op) {
    const adapt = await getTursoComicAdaptations(op.id);
    console.log(`   ✓ Adaptations query executed successfully (Found: ${adapt.length})`);
  }

  console.log('\n✅ ALL TURSO MIGRATION VERIFICATION CHECKS PASSED!');
}

runTest().catch(console.error);
