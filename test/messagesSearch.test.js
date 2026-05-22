import { test } from 'node:test';
import assert from 'node:assert';
import { buildMembersSearchUrl } from '../src/lib/messagesSearch.js';

test('buildMembersSearchUrl uses unfiltered endpoint for empty search', () => {
  assert.strictEqual(buildMembersSearchUrl(''), '/api/members');
});

test('buildMembersSearchUrl encodes special characters in search query', () => {
  const search = '&%?#';
  assert.strictEqual(
    buildMembersSearchUrl(search),
    '/api/members?search=%26%25%3F%23'
  );
});
