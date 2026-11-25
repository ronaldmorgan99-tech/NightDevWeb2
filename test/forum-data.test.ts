import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import type { IDatabase } from '../src/lib/db';
import { attachForumLastPosts, getForumThreads, getThreadWithPosts, HIDDEN_POST_PLACEHOLDER, isViewerStaff } from '../src/lib/forumData';
import { parseDbDate, formatRelativeTime } from '../src/lib/dates';

function makeDb(): IDatabase {
  const raw = new Database(':memory:');
  raw.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, display_name TEXT, email TEXT, password TEXT, role TEXT, avatar_url TEXT, bio TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, last_active TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE forums (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE threads (id INTEGER PRIMARY KEY, forum_id INTEGER, author_id INTEGER, title TEXT, is_pinned INTEGER DEFAULT 0, is_hidden INTEGER DEFAULT 0, views INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE posts (id INTEGER PRIMARY KEY, thread_id INTEGER, author_id INTEGER, content TEXT, is_hidden INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO users (id, username, email, password, role, avatar_url) VALUES (1, 'alice', 'a@x.test', 'hash', 'admin', 'https://img/a.png'), (2, 'bob', 'b@x.test', 'hash', 'member', NULL);
    UPDATE users SET display_name = 'Bob Steam' WHERE id = 2;
    INSERT INTO forums (id, name) VALUES (10, 'General'), (11, 'Empty');
    INSERT INTO threads (id, forum_id, author_id, title) VALUES (100, 10, 1, 'Hello'), (101, 10, 2, 'Secret');
    UPDATE threads SET is_hidden = 1 WHERE id = 101;
    INSERT INTO posts (id, thread_id, author_id, content) VALUES (1, 100, 1, 'first');
    INSERT INTO posts (id, thread_id, author_id, content) VALUES (2, 100, 2, 'reply');
    INSERT INTO posts (id, thread_id, author_id, content, is_hidden) VALUES (3, 100, 2, 'hidden reply', 1);
    INSERT INTO posts (id, thread_id, author_id, content, is_deleted) VALUES (4, 100, 2, 'deleted reply', 1);
    INSERT INTO posts (id, thread_id, author_id, content) VALUES (5, 101, 2, 'in hidden thread');
  `);
  return {
    async execute(sql, params = []) { return raw.prepare(sql).run(...params); },
    async query<T>(sql: string, params: any[] = []) { return raw.prepare(sql).all(...params) as T[]; },
    async queryOne<T>(sql: string, params: any[] = []) { return (raw.prepare(sql).get(...params) ?? null) as T | null; }
  };
}

test('forum list gets the latest visible post author', async () => {
  const db = makeDb();
  const forums = await attachForumLastPosts(db, [{ id: 10 }, { id: 11 }]);
  assert.equal(forums[0].last_post_author_id, 2);
  assert.equal(forums[0].last_post_author_name, 'Bob Steam');
  assert.equal(forums[0].last_thread_id, 100);
  assert.equal((forums[1] as any).last_post_author_id, undefined);
});

test('forum threads include author avatar and hide hidden threads from guests', async () => {
  const db = makeDb();
  const guest = await getForumThreads(db, 10, false);
  assert.deepEqual(guest.map((t: any) => t.id), [100]);
  assert.equal(guest[0].author_avatar, 'https://img/a.png');
  assert.equal(guest[0].last_post_author_name, 'Bob Steam');
  assert.equal(guest[0].author_name, 'alice');
  assert.equal(Number(guest[0].post_count), 3);
  assert.ok(!('email' in guest[0]) && !('password' in guest[0]));
  const staff = await getForumThreads(db, 10, true);
  assert.equal(staff.length, 2);
});

test('thread posts expose public author info, drop deleted posts, mask hidden ones for guests', async () => {
  const db = makeDb();
  const guest = await getThreadWithPosts(db, 100, false);
  assert.ok(guest);
  assert.deepEqual(guest!.posts.map((p: any) => p.id), [1, 2, 3]);
  const hidden = guest!.posts.find((p: any) => p.id === 3);
  assert.equal(hidden.content, HIDDEN_POST_PLACEHOLDER);
  assert.equal(hidden.is_hidden_placeholder, true);
  assert.equal(guest!.posts[0].author_avatar, 'https://img/a.png');
  assert.equal(Number(guest!.posts[1].author_post_count), 3);
  for (const post of guest!.posts) assert.ok(!('email' in post) && !('password' in post));

  const staff = await getThreadWithPosts(db, 100, true);
  assert.equal(staff!.posts.find((p: any) => p.id === 3).content, 'hidden reply');

  assert.equal(await getThreadWithPosts(db, 101, false), null);
  assert.ok(await getThreadWithPosts(db, 101, true));
});

test('isViewerStaff reads the current role from the database', async () => {
  const db = makeDb();
  assert.equal(await isViewerStaff(db, { id: 1 }), true);
  assert.equal(await isViewerStaff(db, { id: 2 }), false);
  assert.equal(await isViewerStaff(db, null), false);
});

test('parseDbDate treats zone-less DB timestamps as UTC', () => {
  assert.equal(parseDbDate('2026-05-15 18:05:26')?.toISOString(), '2026-05-15T18:05:26.000Z');
  assert.equal(parseDbDate('2026-05-15T18:05:26Z')?.toISOString(), '2026-05-15T18:05:26.000Z');
  assert.equal(parseDbDate('not a date'), null);
  assert.equal(parseDbDate(null), null);
  const now = Date.parse('2026-05-15T18:10:26Z');
  assert.equal(formatRelativeTime('2026-05-15 18:05:26', now), '5m ago');
});

test('forumData uses an explicit .js specifier so Vercel Node ESM can load userDisplay', () => {
  const source = readFileSync(new URL('../src/lib/forumData.ts', import.meta.url), 'utf8');
  assert.match(source, /from ['"]\.\/userDisplay\.js['"]/);
  assert.equal(/from ['"]\.\/userDisplay['"]/.test(source), false);
});
