import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSearchUserResults } from '../src/lib/messageSearch.ts';

test('normalizeSearchUserResults handles partial/malformed member objects safely', () => {
  const result = normalizeSearchUserResults([
    { id: 1, username: 'Valid', avatar_url: 'https://cdn.test/avatar.png' },
    { id: 2 },
    { username: 'Missing Id' },
    { id: 3, username: ' ', avatar_url: '' },
    null,
    'bad-data'
  ], 999);

  assert.deepEqual(result, [
    { id: 1, username: 'Valid', avatar_url: 'https://cdn.test/avatar.png' },
    { id: 2, username: 'Unknown User', avatar_url: null },
    { id: 3, username: 'Unknown User', avatar_url: null }
  ]);
});
