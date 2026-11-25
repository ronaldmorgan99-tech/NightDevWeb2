import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  LOCKED_THREAD_ERROR,
  canCreateThread,
  canDeleteThread,
  canReplyToThread,
  canReport,
  canUpdatePost,
  canUpdateThread,
  deniedResponse,
  isContentChange,
  meetsMinRole
} from '../src/lib/forumPermissions.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

const author = { id: 10, role: 'member' };
const other = { id: 20, role: 'member' };
const moderator = { id: 30, role: 'moderator' };
const admin = { id: 40, role: 'admin' };
const suspended = { id: 50, role: 'suspended' };
const post = { author_id: 10, is_hidden: 0, is_deleted: 0 };
const thread = { author_id: 10 };

const allowed = (r: { allowed: boolean }) => r.allowed === true;

// 1. Authors can delete their own posts
test('author can soft-delete their own post; others cannot', () => {
  assert.ok(allowed(canUpdatePost(author, post, { is_deleted: true })));
  assert.ok(allowed(canUpdatePost(moderator, post, { is_deleted: true })));
  assert.ok(allowed(canUpdatePost(admin, post, { is_deleted: true })));
  const denied = canUpdatePost(other, post, { is_deleted: true });
  assert.equal(denied.allowed, false);
  assert.equal(deniedResponse(denied).status, 403);
});

test('author cannot restore, hide, or delete a moderator-hidden post', () => {
  assert.equal(canUpdatePost(author, post, { is_deleted: false }).allowed, false);
  assert.equal(canUpdatePost(author, post, { is_hidden: true }).allowed, false);
  assert.equal(canUpdatePost(author, { ...post, is_hidden: 1 }, { is_deleted: true }).allowed, false);
  assert.ok(allowed(canUpdatePost(moderator, { ...post, is_hidden: 1 }, { is_deleted: false })));
});

test('author and staff can edit content; other members cannot', () => {
  assert.ok(allowed(canUpdatePost(author, post, { content: 'x' })));
  assert.ok(allowed(canUpdatePost(moderator, post, { content: 'x' })));
  assert.equal(canUpdatePost(other, post, { content: 'x' }).allowed, false);
});

test('author ids compare numerically (string ids from Turso rows still match)', () => {
  assert.ok(allowed(canUpdatePost({ id: 10, role: 'member' }, { author_id: '10' }, { is_deleted: true })));
});

// 2. Locked threads
test('non-staff replies to a locked thread get 403 with a clear error', () => {
  const locked = { is_locked: 1, min_role_to_thread: 'member' };
  const denied = canReplyToThread(author, locked);
  assert.equal(denied.allowed, false);
  assert.deepEqual(deniedResponse(denied), { status: 403, body: { error: LOCKED_THREAD_ERROR } });
  assert.match(LOCKED_THREAD_ERROR, /locked/i);
});

test('staff can still reply to a locked thread; anyone allowed can reply to an open one', () => {
  const locked = { is_locked: 1, min_role_to_thread: 'member' };
  assert.ok(allowed(canReplyToThread(moderator, locked)));
  assert.ok(allowed(canReplyToThread(admin, locked)));
  assert.ok(allowed(canReplyToThread(author, { is_locked: 0, min_role_to_thread: 'member' })));
});

test('forum min role is still enforced for replies and new threads', () => {
  assert.equal(canReplyToThread(author, { is_locked: 0, min_role_to_thread: 'admin' }).allowed, false);
  assert.equal(canReplyToThread(suspended, { is_locked: 0, min_role_to_thread: 'member' }).allowed, false);
  assert.equal(canCreateThread(author, { min_role_to_thread: 'admin' }).allowed, false);
  assert.ok(allowed(canCreateThread(admin, { min_role_to_thread: 'admin' })));
});

// 3. edited_at helper
test('isContentChange is true only when content actually changes', () => {
  assert.equal(isContentChange('old', 'new'), true);
  assert.equal(isContentChange('same', 'same'), false);
  assert.equal(isContentChange('old', undefined), false);
});

// 4. Shared thread/post rules
test('pin, lock and hide are staff-only; solve is author or staff', () => {
  for (const change of [{ is_pinned: true }, { is_locked: true }, { is_hidden: true }]) {
    assert.equal(canUpdateThread(author, thread, change).allowed, false, JSON.stringify(change));
    assert.ok(allowed(canUpdateThread(moderator, thread, change)));
  }
  assert.ok(allowed(canUpdateThread(author, thread, { is_solved: true })));
  assert.equal(canUpdateThread(other, thread, { is_solved: true }).allowed, false);
});

test('thread delete: author or staff; report: any signed-in user', () => {
  assert.ok(allowed(canDeleteThread(author, thread)));
  assert.ok(allowed(canDeleteThread(admin, thread)));
  assert.equal(canDeleteThread(other, thread).allowed, false);
  assert.ok(allowed(canReport(other)));
  assert.equal(deniedResponse(canReport(null)).status, 401);
});

test('role ranking matches both old tables (admin > moderator > member > suspended > unknown)', () => {
  assert.ok(meetsMinRole('admin', 'moderator'));
  assert.ok(meetsMinRole('moderator', 'member'));
  assert.ok(!meetsMinRole('member', 'moderator'));
  assert.ok(!meetsMinRole('suspended', 'member'));
  assert.ok(!meetsMinRole('mystery', 'member'));
  assert.ok(meetsMinRole('member', null));
});

// Parity: both backends must use the shared helper for every thread/post action.
const server = read('../server.ts');
const vercel = read('../api/[...path].ts');

test('Express and Vercel both import the shared forum permission helper', () => {
  assert.match(server, /from '\.\/src\/lib\/forumPermissions'/);
  // Vercel runs Node ESM: the relative import must keep its .js extension.
  assert.match(vercel, /from '\.\.\/src\/lib\/forumPermissions\.js'/);
  const helper = read('../src/lib/forumPermissions.ts');
  assert.doesNotMatch(helper, /^import (?!type )[^\n]*from '\.\.?\//m, 'shared helper must not have runtime relative imports');
});

for (const [name, source] of [['server.ts', server], ['api/[...path].ts', vercel]] as const) {
  test(`${name} routes every thread/post action through the shared checks`, () => {
    for (const fn of ['canCreateThread', 'canReplyToThread', 'canUpdatePost', 'canUpdateThread', 'canDeleteThread', 'canReport']) {
      assert.match(source, new RegExp(`${fn}\\(`), `${name} should call ${fn}`);
    }
    assert.doesNotMatch(source, /ROLE_WEIGHT|roleHierarchy/, `${name} should not keep its own role table`);
    assert.doesNotMatch(source, /Only moderators can hide\/delete posts/, `${name} still has the old staff-only delete check`);
    assert.doesNotMatch(source, /if \(!\['admin', 'moderator'\]\.includes\(req\.user\.role\)\)/);
  });

  test(`${name} loads is_locked when creating a post and sets edited_at only for content edits`, () => {
    assert.match(source, /SELECT t\.id, t\.is_locked, f\.min_role_to_thread/);
    const contentBranch = source.indexOf("updates.push('content = ?')");
    const editedAt = source.indexOf("updates.push('edited_at = CURRENT_TIMESTAMP')");
    const hiddenBranch = source.indexOf("updates.push('is_hidden = ?')", contentBranch);
    assert.ok(contentBranch > 0 && editedAt > contentBranch && editedAt < hiddenBranch, 'edited_at must be set inside the content branch only');
    assert.equal(source.split("edited_at = CURRENT_TIMESTAMP").length - 1, 1, 'edited_at set in exactly one place');
  });
}
