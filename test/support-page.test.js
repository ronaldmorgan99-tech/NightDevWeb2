import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const supportPage = readFileSync(new URL('../src/pages/SupportPage.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('support and contact routes share SupportPage', () => {
  assert.match(appSource, /path="support"[\s\S]{0,160}<SupportPage/);
  assert.match(appSource, /path="contact"[\s\S]{0,160}<SupportPage/);
});

test('SupportPage does not wall guests behind Access Denied or an early sign-in return', () => {
  assert.equal(/Access Denied/i.test(supportPage), false);
  const earlyReturn = supportPage.search(/if\s*\(\s*!user\s*\)\s*return/);
  const publicContent = supportPage.indexOf('Network');
  const intelligence = supportPage.indexOf('Intelligence');
  assert.ok(publicContent > 0 && intelligence > publicContent, 'expected public Network Intelligence content');
  assert.ok(earlyReturn === -1 || earlyReturn > publicContent, 'guest early-return would hide public support content');
});

test('SupportPage shows help, contact, and FAQ content plus a sign-in CTA for tickets', () => {
  assert.match(supportPage, /Join Discord/);
  assert.match(supportPage, /Knowledge/);
  assert.match(supportPage, /Do I need an account to get help\?/);
  assert.match(supportPage, /How do I reach the team quickly\?/);
  assert.match(supportPage, /Where are guides and rules\?/);
  assert.match(supportPage, /Sign in to send a message/);
  assert.match(supportPage, /to="\/login"/);
  assert.match(supportPage, /to="\/register"/);
  assert.match(supportPage, /Sign In/);
  assert.match(supportPage, /Create Account/);
  assert.match(supportPage, /\{\s*user\s*&&\s*\(/);
  assert.match(supportPage, /Tickets List/);
});
