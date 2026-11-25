import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

// Runs in its own process (node --test isolates files), so DATABASE_URL can point db.ts at a temp file.
const require = createRequire(import.meta.url);
const dir = mkdtempSync(join(tmpdir(), 'nd-edited-at-'));
const dbPath = join(dir, 'legacy.db');

test('initDb adds posts.edited_at to an existing database without touching rows, and is idempotent', async (t) => {
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // A legacy posts table from before edited_at existed, with a row in it.
  const Better = require('better-sqlite3');
  const legacy = new Better(dbPath);
  legacy.exec(`CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_hidden INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  legacy.prepare('INSERT INTO posts (thread_id, author_id, content) VALUES (1, 1, ?)').run('keep me');
  legacy.close();

  process.env.DATABASE_URL = dbPath;
  delete process.env.TURSO_DATABASE_URL;
  const { initDb } = await import('../src/lib/db.ts');
  await initDb();
  await initDb(); // second cold start must not fail or duplicate the column

  const check = new Better(dbPath);
  const columns = check.prepare('PRAGMA table_info(posts)').all().map((c: any) => c.name);
  assert.equal(columns.filter((c: string) => c === 'edited_at').length, 1);
  const rows = check.prepare('SELECT content, edited_at FROM posts').all();
  assert.deepEqual(rows, [{ content: 'keep me', edited_at: null }]);
  check.close();
});
