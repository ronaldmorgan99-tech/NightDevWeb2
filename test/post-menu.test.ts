import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildPostPermalink,
  buildQuotedReply,
  getPostMenuItems,
  parsePostIdFromUrl,
  postAnchorId
} from '../src/lib/postMenu.ts';

const authorId = 10;
const otherMember = { id: 20, role: 'member' as const };
const author = { id: authorId, role: 'member' as const };
const moderator = { id: 30, role: 'moderator' as const };
const admin = { id: 40, role: 'admin' as const };

const base = {
  postAuthorId: authorId,
  isHidden: false,
  isLocked: false,
  isHiddenPlaceholder: false
};

test('guest sees Copy link and a sign-in prompt, not Report or author/staff actions', () => {
  const items = getPostMenuItems({ ...base, viewer: null });
  assert.deepEqual(items, ['copy-link', 'sign-in']);
  assert.ok(!items.includes('report'));
  assert.ok(!items.includes('edit'));
  assert.ok(!items.includes('delete'));
  assert.ok(!items.includes('hide'));
  assert.ok(!items.includes('quote'));
});

test('another member sees Quote, Copy link and Report', () => {
  const items = getPostMenuItems({ ...base, viewer: otherMember });
  assert.deepEqual(items, ['quote', 'copy-link', 'report']);
  assert.ok(!items.includes('edit'));
  assert.ok(!items.includes('delete'));
  assert.ok(!items.includes('hide'));
  assert.ok(!items.includes('sign-in'));
});

test('another member does not get Quote when the thread is locked', () => {
  const items = getPostMenuItems({ ...base, viewer: otherMember, isLocked: true });
  assert.deepEqual(items, ['copy-link', 'report']);
});

test('author sees Edit, Quote and Delete, but not Report or Hide on their own post', () => {
  const items = getPostMenuItems({ ...base, viewer: author });
  assert.deepEqual(items, ['quote', 'copy-link', 'edit', 'delete']);
  assert.ok(!items.includes('report'));
  assert.ok(!items.includes('hide'));
  assert.ok(!items.includes('sign-in'));
});

test('author still sees Edit and Delete when the thread is locked, but not Quote', () => {
  const items = getPostMenuItems({ ...base, viewer: author, isLocked: true });
  assert.deepEqual(items, ['copy-link', 'edit', 'delete']);
});

test('author does not get Delete on a post a moderator hid', () => {
  const items = getPostMenuItems({ ...base, viewer: author, isHidden: true, isHiddenPlaceholder: true });
  assert.deepEqual(items, ['copy-link']);
});

test('another member never gets Delete on someone else\'s post', () => {
  const items = getPostMenuItems({ ...base, viewer: otherMember });
  assert.ok(!items.includes('delete'));
});

test('staff keep Quote on a locked thread because the server lets staff reply there', () => {
  const items = getPostMenuItems({ ...base, viewer: moderator, isLocked: true });
  assert.deepEqual(items, ['quote', 'copy-link', 'edit', 'hide', 'report', 'delete']);
});

test('moderator sees Edit, Hide, Delete, Report, Quote and Copy link', () => {
  const items = getPostMenuItems({ ...base, viewer: moderator });
  assert.deepEqual(items, ['quote', 'copy-link', 'edit', 'hide', 'report', 'delete']);
});

test('admin sees the same staff items as a moderator, with Unhide on a hidden post', () => {
  const visible = getPostMenuItems({ ...base, viewer: admin });
  assert.deepEqual(visible, ['quote', 'copy-link', 'edit', 'hide', 'report', 'delete']);
  const hidden = getPostMenuItems({ ...base, viewer: admin, isHidden: true });
  assert.deepEqual(hidden, ['quote', 'copy-link', 'edit', 'unhide', 'report', 'delete']);
  assert.ok(!hidden.includes('hide'));
});

test('staff do not get Report on their own post, but keep Edit, Hide and Delete', () => {
  const items = getPostMenuItems({ ...base, viewer: { id: authorId, role: 'moderator' } });
  assert.deepEqual(items, ['quote', 'copy-link', 'edit', 'hide', 'delete']);
  assert.ok(!items.includes('report'));
});

test('hidden placeholders hide Quote, Edit and Report for non-staff', () => {
  const guest = getPostMenuItems({ ...base, viewer: null, isHidden: true, isHiddenPlaceholder: true });
  assert.deepEqual(guest, ['copy-link', 'sign-in']);
  const member = getPostMenuItems({
    ...base,
    viewer: otherMember,
    isHidden: true,
    isHiddenPlaceholder: true
  });
  assert.deepEqual(member, ['copy-link']);
});

test('menu items never include thread Pin or Lock', () => {
  const staff = getPostMenuItems({ ...base, viewer: admin });
  assert.ok(!staff.includes('pin' as never));
  assert.ok(!staff.includes('lock' as never));
});

test('postAnchorId uses the post-{id} pattern', () => {
  assert.equal(postAnchorId(42), 'post-42');
  assert.equal(postAnchorId('7'), 'post-7');
});

test('Copy link uses ?post= on HashRouter thread URLs so routing stays intact', () => {
  const href = 'https://nightdev.example/#/threads/9';
  assert.equal(buildPostPermalink(href, 12), 'https://nightdev.example/#/threads/9?post=12');
  assert.equal(
    buildPostPermalink('https://nightdev.example/#/threads/9?post=3', 12),
    'https://nightdev.example/#/threads/9?post=12'
  );
  assert.equal(
    buildPostPermalink('https://nightdev.example/#/threads/9?from=forum', 12),
    'https://nightdev.example/#/threads/9?from=forum&post=12'
  );
});

test('Copy link uses a #post-{id} hash on history-style URLs', () => {
  assert.equal(
    buildPostPermalink('https://nightdev.example/threads/9', 12),
    'https://nightdev.example/threads/9#post-12'
  );
  assert.equal(
    buildPostPermalink('https://nightdev.example/threads/9#post-3', 12),
    'https://nightdev.example/threads/9#post-12'
  );
});

test('parsePostIdFromUrl reads ?post= and #post-{id}', () => {
  assert.equal(parsePostIdFromUrl('https://nightdev.example/#/threads/9?post=12'), 12);
  assert.equal(parsePostIdFromUrl('https://nightdev.example/threads/9#post-12'), 12);
  assert.equal(parsePostIdFromUrl('/threads/9?foo=1&post=8'), 8);
  assert.equal(parsePostIdFromUrl('https://nightdev.example/#/threads/9'), null);
});

test('Quote prepends a plain-text quote and keeps existing reply text', () => {
  const quoted = buildQuotedReply('Alice', 'First line\nSecond line');
  assert.equal(quoted, '> Alice wrote:\n> First line\n> Second line\n\n');
  const withExisting = buildQuotedReply('Alice', 'Hello', 'I was going to say');
  assert.equal(withExisting, 'I was going to say\n\n> Alice wrote:\n> Hello\n\n');
});

test('thread view wires the overflow menu, post anchors, and keeps Pin/Lock in the header', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const page = readFileSync(join(here, '../src/pages/ThreadViewPage.tsx'), 'utf8');
  const menu = readFileSync(join(here, '../src/components/PostOverflowMenu.tsx'), 'utf8');

  assert.match(page, /PostOverflowMenu/);
  assert.match(page, /id=\{postAnchorId\(post\.id\)\}/);
  assert.match(page, /scrollIntoView/);
  assert.match(page, /handleQuote/);
  assert.match(page, /id="thread-reply"/);
  assert.doesNotMatch(page, /<Flag /);
  assert.doesNotMatch(page, /MoreVertical/);
  // Thread Pin and Lock stay in the header, not in the post menu helper.
  assert.match(page, /Unpin Thread/);
  assert.match(page, /Lock Thread/);
  assert.match(menu, /to="\/login"/);
  assert.match(menu, /aria-haspopup="menu"/);
  assert.match(menu, /aria-label="More options"/);
  assert.match(menu, /Copied/);
});

test('thread view sends boolean moderation flags, confirms author deletes and shows an Edited label', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const page = readFileSync(join(here, '../src/pages/ThreadViewPage.tsx'), 'utf8');
  // The API schemas validate booleans; the page must not send 1/0 numbers.
  assert.doesNotMatch(page, /\? 0 : 1/);
  assert.match(page, /is_deleted: true/);
  assert.match(page, /is_hidden: !post\.is_hidden/);
  // Delete still goes through the shared confirm dialog.
  assert.match(page, /onDelete=\{\(\) => setConfirmDelete\(\{ isOpen: true, type: 'post', id: post\.id \}\)\}/);
  // Edited label with a timestamp tooltip.
  assert.match(page, /edited_at\?: string \| null/);
  assert.match(page, /post\.edited_at && !post\.is_hidden_placeholder/);
  assert.match(page, /title=\{`Edited \$\{formatDbDateTime\(post\.edited_at\)\}`\}/);
  // Non-staff see the locked banner; staff can still reply.
  assert.match(page, /data\.thread\.is_locked && !isStaff/);
});
