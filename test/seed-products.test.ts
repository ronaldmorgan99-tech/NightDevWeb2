import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Own process (node --test isolates files), so DATABASE_URL can point db.ts at a temp file.
const dir = mkdtempSync(join(tmpdir(), 'nd-seed-products-'));
process.env.DATABASE_URL = join(dir, 'seed.db');
delete process.env.TURSO_DATABASE_URL;
delete process.env.RESET_DB;

test('re-running the seed does not duplicate starter store products', async (t) => {
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { default: db, initDb } = await import('../src/lib/db.ts');
  const { seedDb } = await import('../src/lib/seed.ts');
  await initDb();
  await seedDb();
  // Force the seed to run again, as happens in production when one of its checks fails.
  await db.execute('DELETE FROM game_stats');
  await seedDb();
  const rows = await db.query<{ name: string; count: number }>('SELECT name, COUNT(*) AS count FROM products GROUP BY name ORDER BY name');
  assert.deepEqual(rows.map((r) => [r.name, Number(r.count)]), [
    ['Custom Profile Theme', 1],
    ['Elite Member Badge', 1],
    ['NightRespawn T-Shirt', 1]
  ]);
});
