import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeUserText, stripHtmlTags } from '../src/lib/sanitize.ts';

// Expected outputs are fixed strings (captured from the previous /<[^>]*>/g implementation),
// so the test no longer embeds that regex.
const cases: Array<[string, string]> = [
  ['', ''],
  ['plain text', 'plain text'],
  ['<b>bold</b>', 'bold'],
  ['a<b<c>d', 'ad'],
  ['a<b', 'a<b'],
  ['x > y < z', 'x > y < z'],
  ['<<>>', '>'],
  ['<>', ''],
  ['a<>b', 'ab'],
  ['<script>alert(1)</script>ok', 'alert(1)ok'],
  ['tail <', 'tail <'],
  ['> lead', '> lead'],
  ['<a href="x">link</a> & <i>more</i>', 'link & more'],
  ['<<<<b>', '']
];

test('stripHtmlTags keeps the previous tag-stripping behaviour', () => {
  for (const [input, expected] of cases) assert.equal(stripHtmlTags(input), expected, JSON.stringify(input));
});

test('stripHtmlTags is linear on many unclosed "<" characters', () => {
  const evil = '<'.repeat(200_000);
  const started = Date.now();
  assert.equal(stripHtmlTags(evil), evil);
  assert.ok(Date.now() - started < 500, 'should not backtrack quadratically');
});

test('sanitizeUserText strips tags and control characters and normalises newlines', () => {
  assert.equal(sanitizeUserText('  <b>Hi</b>\u0007 there\r\nfriend  '), 'Hi there\nfriend');
});
