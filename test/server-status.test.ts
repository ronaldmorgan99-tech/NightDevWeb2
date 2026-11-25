import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkSteamServerStatus, resetServerStatusCache } from '../src/lib/serverStatus.ts';
import { getConfiguredServers } from '../src/lib/configuredServers.ts';

const CODE = '90298158635345928';
const base = { serverCode: CODE, serverName: 'NightRespawnPilot', appId: 304930, useCache: false };
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('without a Steam Web API key the status is unknown and Steam is not called', async () => {
  let called = false;
  const live = await checkSteamServerStatus({ ...base, apiKey: '', fetchImpl: (async () => { called = true; return jsonResponse({}); }) as typeof fetch });
  assert.equal(called, false);
  assert.equal(live.verified, false);
  const [server] = getConfiguredServers({}, live);
  assert.equal(server.status, 'unknown');
  assert.equal(server.players, null);
  assert.equal(server.verified, false);
  assert.equal(server.server_code, CODE);
});

test('a configured server code alone never marks the server online', () => {
  const [server] = getConfiguredServers({});
  assert.equal(server.status, 'unknown');
  assert.equal(server.players, null);
});

test('a server listed on the Steam master server with our SteamID is online with its real player count', async () => {
  let requested = '';
  const fetchImpl = (async (url: string) => {
    requested = url;
    return jsonResponse({ response: { servers: [
      { steamid: '90000000000000001', name: 'NightRespawnPilot clone', players: 9 },
      { steamid: CODE, name: 'NightRespawnPilot', players: 3, max_players: 24, map: 'PEI', version: '3.26.3.15' }
    ] } });
  }) as typeof fetch;
  const live = await checkSteamServerStatus({ ...base, apiKey: 'k', fetchImpl });
  const filter = new URL(requested).searchParams.get('filter');
  assert.equal(filter, '\\appid\\304930\\name_match\\NightRespawnPilot*');
  const [server] = getConfiguredServers({}, live);
  assert.equal(server.status, 'online');
  assert.equal(server.players, 3);
  assert.equal(server.max_players, 24);
  assert.equal(server.status_source, 'steam_web_api');
});

test('a successful Steam lookup without our SteamID reports offline with zero players', async () => {
  const fetchImpl = (async () => jsonResponse({ response: {} })) as typeof fetch;
  const [server] = getConfiguredServers({}, await checkSteamServerStatus({ ...base, apiKey: 'k', fetchImpl }));
  assert.equal(server.status, 'offline');
  assert.equal(server.players, 0);
  assert.equal(server.verified, true);
});

test('Steam errors and network failures fall back to unknown, not online or offline', async () => {
  const forbidden = (async () => jsonResponse({}, 403)) as typeof fetch;
  const failing = (async () => { throw new Error('boom'); }) as typeof fetch;
  for (const fetchImpl of [forbidden, failing]) {
    const [server] = getConfiguredServers({}, await checkSteamServerStatus({ ...base, apiKey: 'k', fetchImpl }));
    assert.equal(server.status, 'unknown');
    assert.equal(server.players, null);
  }
});

test('the error detail never leaks the API key', async () => {
  const failing = (async () => { throw new Error('https://api.steampowered.com/?key=secret-key'); }) as typeof fetch;
  const live = await checkSteamServerStatus({ ...base, apiKey: 'secret-key', fetchImpl: failing });
  assert.doesNotMatch(live.detail, /secret-key/);
});

test('verified results are cached briefly so page refreshes do not hammer Steam', async () => {
  resetServerStatusCache();
  let calls = 0;
  const fetchImpl = (async () => { calls += 1; return jsonResponse({ response: { servers: [] } }); }) as typeof fetch;
  const t0 = new Date('2026-11-25T23:00:00Z');
  await checkSteamServerStatus({ ...base, useCache: true, apiKey: 'k', fetchImpl, now: () => t0 });
  await checkSteamServerStatus({ ...base, useCache: true, apiKey: 'k', fetchImpl, now: () => new Date(t0.getTime() + 10_000) });
  assert.equal(calls, 1);
  await checkSteamServerStatus({ ...base, useCache: true, apiKey: 'k', fetchImpl, now: () => new Date(t0.getTime() + 31_000) });
  assert.equal(calls, 2);
  resetServerStatusCache();
});

test('Servers page shows the live status panel at the top and no fake Network Health panel', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const page = readFileSync(join(here, '../src/pages/ServersPage.tsx'), 'utf8');
  assert.match(page, /data-testid="live-server-status"/);
  assert.doesNotMatch(page, /Network Health/);
  assert.doesNotMatch(page, /'Frankfurt', 'London'/);
  assert.ok(page.indexOf('<LiveStatusPanel') < page.indexOf('data-testid="server-stats"'), 'panel renders above the stats');
});

test('both API entry points use the live status loader', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const rel of ['../server.ts', '../api/[...path].ts']) {
    const src = readFileSync(join(here, rel), 'utf8');
    assert.match(src, /getLiveConfiguredServers\(db\)/, rel);
    assert.doesNotMatch(src, /getConfiguredServers\(\)/, rel);
  }
});
