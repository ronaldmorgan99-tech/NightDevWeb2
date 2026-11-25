import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeUserText, stripHtmlTags } from '../src/lib/sanitize.ts';

const legacy = (value: string) => value.replace(/<[^>]*>/g, '');

test('stripHtmlTags matches the old /<[^>]*>/g behaviour', () => {
  const samples = [
    '', 'plain text', '<b>bold</b>', 'a<b<c>d', 'a<b', 'x > y < z', '<<>>', '<>', 'a<>b',
    '<script>alert(1)</script>ok', 'tail <', '> lead', '<a href="x">link</a> & <i>more</i>', '<<<<b>'
  ];
  for (const sample of samples) assert.equal(stripHtmlTags(sample), legacy(sample), JSON.stringify(sample));
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
