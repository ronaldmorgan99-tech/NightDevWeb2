import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSteamCallbackShape,
  buildSteamRedirectUrl,
  collectOpenIdParams,
  getPublicOrigin,
  getSteamCallbackUrl,
  isAllowedReturnTo,
  isValidHttpOrigin,
  parseOpenIdKeyValues,
  parseRawQueryString,
  parseSteamIdFromClaimedId,
  collectOpenIdParamsFromUrl,
  sanitizeSteamUsername,
  sanitizeSteamDisplayName,
  verifySteamAssertion,
  fetchSteamProfile,
  parseSteamProfileXml,
  extractSteamXmlField,
  resolveSteamApiKey,
  upsertSteamUser,
  isSteamPlaceholderUsername,
  STEAM_OPENID_NS,
  STEAM_IDENTIFIER_SELECT
} from '../src/lib/steamAuth.ts';
import { getUserAvatarInitial, getUserDisplayName } from '../src/lib/userDisplay.ts';

const origin = 'https://night-dev-web2.vercel.app';
const state = 'test-state-123';
const steamId = '76561198000000000';
const claimedId = `https://steamcommunity.com/openid/id/${steamId}`;

function validParams(overrides: Record<string, string> = {}) {
  return {
    'openid.ns': STEAM_OPENID_NS,
    'openid.mode': 'id_res',
    'openid.op_endpoint': 'https://steamcommunity.com/openid/login',
    'openid.claimed_id': claimedId,
    'openid.identity': claimedId,
    'openid.return_to': getSteamCallbackUrl(origin, state),
    'openid.sig': 'c2ln',
    'openid.signed': 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
    'openid.assoc_handle': 'abc',
    'openid.response_nonce': '2026-01-01T00:00:00Znonce',
    ...overrides
  };
}

test('parseSteamIdFromClaimedId accepts a 17-digit Steam community OpenID', () => {
  assert.equal(parseSteamIdFromClaimedId(claimedId), steamId);
  assert.equal(parseSteamIdFromClaimedId(`http://steamcommunity.com/openid/id/${steamId}`), steamId);
  assert.equal(parseSteamIdFromClaimedId('https://example.com/openid/id/76561198000000000'), null);
  assert.equal(parseSteamIdFromClaimedId('https://steamcommunity.com/openid/id/12345'), null);
});

test('sanitizeSteamUsername falls back to a steam_ id when the persona name is unusable', () => {
  assert.equal(sanitizeSteamUsername('Ronald Morgan', steamId), 'Ronald_Morgan');
  assert.equal(sanitizeSteamUsername('??', steamId), `steam_${steamId}`);
  assert.equal(sanitizeSteamUsername('', steamId), `steam_${steamId}`);
});

test('buildSteamRedirectUrl includes the required OpenID 2.0 fields', () => {
  const url = new URL(buildSteamRedirectUrl(origin, state));
  assert.equal(url.origin + url.pathname, 'https://steamcommunity.com/openid/login');
  assert.equal(url.searchParams.get('openid.ns'), STEAM_OPENID_NS);
  assert.equal(url.searchParams.get('openid.mode'), 'checkid_setup');
  assert.equal(url.searchParams.get('openid.identity'), STEAM_IDENTIFIER_SELECT);
  assert.equal(url.searchParams.get('openid.claimed_id'), STEAM_IDENTIFIER_SELECT);
  assert.equal(url.searchParams.get('openid.return_to'), getSteamCallbackUrl(origin, state));
  assert.equal(url.searchParams.get('openid.realm'), origin);
});

test('isAllowedReturnTo requires the exact callback path, origin, and state', () => {
  assert.equal(isAllowedReturnTo(getSteamCallbackUrl(origin, state), origin, state), true);
  assert.equal(isAllowedReturnTo(getSteamCallbackUrl(origin, 'other'), origin, state), false);
  assert.equal(isAllowedReturnTo(`${origin}/api/auth/steam/callback?state=${state}&next=https://evil.example`, origin, state), false);
  assert.equal(isAllowedReturnTo(`https://evil.example/api/auth/steam/callback?state=${state}`, origin, state), false);
});

test('assertSteamCallbackShape accepts a well-formed Steam assertion and rejects spoofed fields', () => {
  assert.equal(assertSteamCallbackShape(validParams(), origin, state), steamId);
  assert.throws(() => assertSteamCallbackShape(validParams({ 'openid.mode': 'checkid_setup' }), origin, state));
  assert.throws(() => assertSteamCallbackShape(validParams({ 'openid.op_endpoint': 'https://evil.example/openid' }), origin, state));
  assert.throws(() => assertSteamCallbackShape(validParams({ 'openid.claimed_id': 'https://steamcommunity.com/openid/id/1' }), origin, state));
  assert.throws(() => assertSteamCallbackShape(validParams({ 'openid.identity': 'https://steamcommunity.com/openid/id/76561198000000001' }), origin, state));
  assert.throws(() => assertSteamCallbackShape(validParams({ 'openid.return_to': `${origin}/#/login` }), origin, state));
});

test('verifySteamAssertion requires is_valid:true from Steam', async () => {
  const okFetch: typeof fetch = async (_url, init) => {
    const body = String(init?.body || '');
    assert.match(body, /openid\.mode=check_authentication/);
    return new Response('ns:http://specs.openid.net/auth/2.0\nis_valid:true\n', { status: 200 });
  };
  assert.deepEqual(await verifySteamAssertion(validParams(), okFetch), { ok: true, status: 200 });

  const badFetch: typeof fetch = async () => new Response('ns:http://specs.openid.net/auth/2.0\nis_valid:false\n', { status: 200 });
  assert.equal((await verifySteamAssertion(validParams(), badFetch)).ok, false);
  assert.equal((await verifySteamAssertion(validParams(), badFetch)).reason, 'steam_assertion_not_valid');

  const spoofedFetch: typeof fetch = async () => new Response('note:is_valid:true\nis_valid:false\n', { status: 200 });
  assert.equal((await verifySteamAssertion(validParams(), spoofedFetch)).reason, 'steam_assertion_not_valid');
});

test('parseOpenIdKeyValues and collectOpenIdParams ignore non-openid fields', () => {
  assert.deepEqual(parseOpenIdKeyValues('is_valid:true\nns:http://specs.openid.net/auth/2.0\n'), {
    is_valid: 'true',
    ns: 'http://specs.openid.net/auth/2.0'
  });
  assert.deepEqual(collectOpenIdParams({ 'openid.mode': 'id_res', state, extra: 'nope' }), {
    'openid.mode': 'id_res'
  });
});

test('getPublicOrigin prefers SITE_ORIGIN and ignores the placeholder APP_URL', () => {
  const previousSite = process.env.SITE_ORIGIN;
  const previousApp = process.env.APP_URL;
  try {
    process.env.APP_URL = 'MY_APP_URL';
    process.env.SITE_ORIGIN = 'https://night-dev-web2.vercel.app/';
    assert.equal(getPublicOrigin({ headers: { host: 'localhost:3000' }, protocol: 'http' }), origin);

    delete process.env.SITE_ORIGIN;
    delete process.env.APP_URL;
    assert.equal(
      getPublicOrigin({
        headers: { host: 'night-dev-web2.vercel.app', 'x-forwarded-proto': 'https' },
        protocol: 'http'
      }),
      origin
    );
    assert.equal(isValidHttpOrigin('MY_APP_URL'), false);
  } finally {
    if (previousSite === undefined) delete process.env.SITE_ORIGIN;
    else process.env.SITE_ORIGIN = previousSite;
    if (previousApp === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previousApp;
  }
});

test('fetchSteamProfile uses the Web API, then keyless community XML', async () => {
  const previousKey = process.env.STEAM_API_KEY;
  const steamAvatar = 'https://avatars.fastly.steamstatic.com/abcdef_full.jpg';
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><profile>
    <steamID64>${steamId}</steamID64>
    <steamID><![CDATA[---.GeforceNow Cloud Gamin]]></steamID>
    <avatarFull><![CDATA[${steamAvatar}]]></avatarFull>
  </profile>`;

  try {
    delete process.env.STEAM_API_KEY;

    const xmlFetch: typeof fetch = async (url) => {
      assert.match(String(url), /steamcommunity\.com\/profiles\/76561198000000000\/\?xml=1/);
      return new Response(xml, { status: 200, headers: { 'Content-Type': 'text/xml' } });
    };
    assert.deepEqual(await fetchSteamProfile(steamId, xmlFetch), {
      steamId,
      personaName: '---.GeforceNow Cloud Gamin',
      avatarUrl: steamAvatar,
      source: 'community_xml'
    });

    const failedXmlFetch: typeof fetch = async () => new Response('nope', { status: 500 });
    assert.deepEqual(await fetchSteamProfile(steamId, failedXmlFetch), { steamId, source: 'unavailable' });

    process.env.STEAM_API_KEY = 'test-key';
    const urls: string[] = [];
    const okFetch: typeof fetch = async (url) => {
      urls.push(String(url));
      assert.match(String(url), /ISteamUser\/GetPlayerSummaries\/v2/);
      return new Response(JSON.stringify({
        response: {
          players: [{ steamid: steamId, personaname: 'Pilot', avatarfull: steamAvatar }]
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    assert.deepEqual(await fetchSteamProfile(steamId, okFetch), {
      steamId,
      personaName: 'Pilot',
      avatarUrl: steamAvatar,
      source: 'get_player_summaries'
    });
    assert.equal(urls.length, 1);

    const failThenXml: typeof fetch = async (url) => {
      if (String(url).includes('GetPlayerSummaries')) {
        return new Response('nope', { status: 500 });
      }
      return new Response(xml, { status: 200, headers: { 'Content-Type': 'text/xml' } });
    };
    assert.deepEqual(await fetchSteamProfile(steamId, failThenXml), {
      steamId,
      personaName: '---.GeforceNow Cloud Gamin',
      avatarUrl: steamAvatar,
      source: 'community_xml'
    });

    delete process.env.STEAM_API_KEY;
    const keyedFromOptions: typeof fetch = async (url) => {
      assert.match(String(url), /ISteamUser\/GetPlayerSummaries\/v2/);
      return new Response(JSON.stringify({
        response: { players: [{ steamid: steamId, personaname: 'FromSettings', avatarfull: steamAvatar }] }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    assert.equal(
      (await fetchSteamProfile(steamId, keyedFromOptions, { apiKey: 'db-key' })).personaName,
      'FromSettings'
    );
  } finally {
    if (previousKey === undefined) delete process.env.STEAM_API_KEY;
    else process.env.STEAM_API_KEY = previousKey;
  }
});

test('parseRawQueryString preserves plus signs in OpenID signatures', () => {
  const raw = 'openid.mode=id_res&openid.sig=abc+def/ghi=&other=1';
  const parsed = parseRawQueryString(raw);
  assert.equal(parsed['openid.sig'], 'abc+def/ghi=');
  assert.notEqual(parsed['openid.sig'], 'abc def/ghi=');
  assert.equal(new URLSearchParams(raw).get('openid.sig'), 'abc def/ghi=');

  const fromUrl = collectOpenIdParamsFromUrl('/api/auth/steam/callback?openid.sig=abc+def/ghi=&openid.mode=id_res&state=keep');
  assert.equal(fromUrl['openid.sig'], 'abc+def/ghi=');
  assert.equal(fromUrl['openid.mode'], 'id_res');
  assert.equal('state' in fromUrl, false);
});

const steamAvatar = 'https://avatars.fastly.steamstatic.com/4fa32bf590966bb1bb5a2c43a03cf3079882c0e6_full.jpg';

const ronaldXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><profile>
	<steamID64>76561198778230825</steamID64>
	<steamID><![CDATA[---.GeforceNow Cloud Gamin]]></steamID>
	<avatarFull><![CDATA[${steamAvatar}]]></avatarFull>
	<avatarMedium><![CDATA[https://avatars.fastly.steamstatic.com/4fa32bf590966bb1bb5a2c43a03cf3079882c0e6_medium.jpg]]></avatarMedium>
</profile>`;

test('parseSteamProfileXml reads CDATA persona name and avatarFull', () => {
  const profile = parseSteamProfileXml(ronaldXml, '76561198778230825');
  assert.equal(profile.personaName, '---.GeforceNow Cloud Gamin');
  assert.equal(profile.avatarUrl, steamAvatar);
  assert.equal(profile.source, 'community_xml');
  assert.equal(extractSteamXmlField(ronaldXml, 'steamID'), '---.GeforceNow Cloud Gamin');
  assert.equal(extractSteamXmlField(ronaldXml, 'steamID64'), '76561198778230825');
});

test('parseSteamProfileXml supports non-CDATA fields, entities, and rejects a mismatched steamID64', () => {
  const xml = `<?xml version="1.0"?><profile>
    <steamID64>76561198000000000</steamID64>
    <steamID>Pilot &amp; Co</steamID>
    <avatarFull>https://avatars.fastly.steamstatic.com/pilot_full.jpg</avatarFull>
  </profile>`;
  const profile = parseSteamProfileXml(xml, steamId);
  assert.equal(profile.personaName, 'Pilot & Co');
  assert.equal(profile.avatarUrl, 'https://avatars.fastly.steamstatic.com/pilot_full.jpg');

  const mismatched = parseSteamProfileXml(ronaldXml, steamId);
  assert.deepEqual(mismatched, { steamId, source: 'unavailable' });

  const untrustedAvatar = `<?xml version="1.0"?><profile>
    <steamID64>${steamId}</steamID64>
    <steamID>Pilot</steamID>
    <avatarFull>https://evil.example/avatar.jpg</avatarFull>
  </profile>`;
  const sanitized = parseSteamProfileXml(untrustedAvatar, steamId);
  assert.equal(sanitized.personaName, 'Pilot');
  assert.equal(sanitized.avatarUrl, undefined);
});

test('getUserDisplayName prefers display_name and avatar initials skip leading punctuation', () => {
  assert.equal(getUserDisplayName({ username: 'steam_76561198778230825', display_name: '---.GeforceNow Cloud Gamin' }), '---.GeforceNow Cloud Gamin');
  assert.equal(getUserDisplayName({ username: 'steam_76561198778230825' }), 'steam_76561198778230825');
  assert.equal(getUserAvatarInitial({ display_name: '---.GeforceNow Cloud Gamin' }), 'G');
  assert.equal(sanitizeSteamDisplayName('  ---.GeforceNow Cloud Gamin\n'), '---.GeforceNow Cloud Gamin');
});

test('resolveSteamApiKey prefers the env key, then the admin settings value', async () => {
  const previousKey = process.env.STEAM_API_KEY;
  const settings: Record<string, string> = { steam_api_key: '  db-key  ' };
  const db = {
    async queryOne(_sql: string, params: any[] = []) {
      return { value: settings[params[0]] };
    },
    async query() { return []; },
    async execute() { return {}; }
  };

  try {
    process.env.STEAM_API_KEY = 'env-key';
    assert.equal(await resolveSteamApiKey(db), 'env-key');
    delete process.env.STEAM_API_KEY;
    assert.equal(await resolveSteamApiKey(db), 'db-key');
    settings.steam_api_key = '   ';
    assert.equal(await resolveSteamApiKey(db), undefined);
  } finally {
    if (previousKey === undefined) delete process.env.STEAM_API_KEY;
    else process.env.STEAM_API_KEY = previousKey;
  }
});

function createMemoryUsersDb(seed: Array<Record<string, any>> = []) {
  const users = seed.map((user, index) => ({ id: user.id ?? index + 1, ...user }));
  let nextId = users.reduce((max, user) => Math.max(max, Number(user.id) || 0), 0) + 1;

  const matches = (sql: string, pattern: RegExp) => pattern.test(sql.replace(/\s+/g, ' ').trim());

  const db = {
    users,
    async queryOne(sql: string, params: any[] = []) {
      if (matches(sql, /WHERE steam_id = \?/)) return users.find((user) => user.steam_id === params[0]) || null;
      if (matches(sql, /WHERE username = \? AND id != \?/)) {
        return users.find((user) => user.username === params[0] && user.id !== params[1]) || null;
      }
      if (matches(sql, /WHERE username = \?/)) return users.find((user) => user.username === params[0]) || null;
      if (matches(sql, /WHERE id = \?/)) return users.find((user) => user.id === params[0]) || null;
      return null;
    },
    async query() { return []; },
    async execute(sql: string, params: any[] = []) {
      const compact = sql.replace(/\s+/g, ' ').trim();
      if (compact.startsWith('INSERT INTO users')) {
        const columns = compact.slice(compact.indexOf('(') + 1, compact.indexOf(')')).split(',').map((item) => item.trim());
        const row: Record<string, any> = { id: nextId++ };
        columns.forEach((column, index) => { row[column] = params[index]; });
        users.push(row);
        return { lastInsertRowid: row.id };
      }
      if (compact.startsWith('UPDATE users SET')) {
        const setPart = compact.slice('UPDATE users SET '.length, compact.indexOf(' WHERE'));
        const columns = setPart.split(',').map((part) => part.trim().split('=')[0].trim()).filter((column) => column !== 'last_active');
        const id = params[params.length - 1];
        const user = users.find((item) => item.id === id);
        if (!user) return {};
        let paramIndex = 0;
        for (const column of columns) {
          user[column] = params[paramIndex];
          paramIndex += 1;
        }
        return {};
      }
      return {};
    }
  };

  return db;
}

test('upsertSteamUser stores display_name for a new Steam user', async () => {
  const db = createMemoryUsersDb();
  const created = await upsertSteamUser(db, {
    steamId,
    personaName: '---.GeforceNow Cloud Gamin',
    avatarUrl: steamAvatar,
    source: 'community_xml'
  });
  assert.equal(created.display_name, '---.GeforceNow Cloud Gamin');
  assert.equal(created.avatar_url, steamAvatar);
  assert.equal(created.username, 'GeforceNow_Cloud_Gamin');
  assert.equal(isSteamPlaceholderUsername(created.username, steamId), false);
});

test('upsertSteamUser refreshes display_name and avatar on every login', async () => {
  const existingId = 7;
  const db = createMemoryUsersDb([{
    id: existingId,
    username: `steam_${steamId}`,
    email: `steam-${steamId}@users.noreply.nightrespawn.app`,
    role: 'member',
    steam_id: steamId,
    avatar_url: null,
    display_name: null
  }]);

  const updated = await upsertSteamUser(db, {
    steamId,
    personaName: '---.GeforceNow Cloud Gamin',
    avatarUrl: steamAvatar,
    source: 'community_xml'
  });

  assert.equal(updated.id, existingId);
  assert.equal(updated.display_name, '---.GeforceNow Cloud Gamin');
  assert.equal(updated.avatar_url, steamAvatar);
  assert.equal(updated.username, 'GeforceNow_Cloud_Gamin');

  const customNameDb = createMemoryUsersDb([{
    id: 8,
    username: 'RonaldCustom',
    email: 'ronald@example.com',
    role: 'admin',
    steam_id: steamId,
    avatar_url: 'https://avatars.fastly.steamstatic.com/old.jpg',
    display_name: 'Old Name'
  }]);
  const refreshed = await upsertSteamUser(customNameDb, {
    steamId,
    personaName: '---.GeforceNow Cloud Gamin',
    avatarUrl: steamAvatar,
    source: 'community_xml'
  });
  assert.equal(refreshed.username, 'RonaldCustom');
  assert.equal(refreshed.display_name, '---.GeforceNow Cloud Gamin');
  assert.equal(refreshed.avatar_url, steamAvatar);
});

test('upsertSteamUser keeps the steam_ placeholder username if the persona slug is taken', async () => {
  const db = createMemoryUsersDb([
    {
      id: 1,
      username: `steam_${steamId}`,
      email: `steam-${steamId}@users.noreply.nightrespawn.app`,
      role: 'member',
      steam_id: steamId,
      display_name: null,
      avatar_url: null
    },
    {
      id: 2,
      username: 'GeforceNow_Cloud_Gamin',
      email: 'other@example.com',
      role: 'member',
      steam_id: '76561198000000001',
      display_name: 'Taken'
    },
    {
      id: 3,
      username: 'GeforceNow_Cloud_Gamin_0000',
      email: 'other2@example.com',
      role: 'member',
      steam_id: '76561198000000002'
    }
  ]);

  const updated = await upsertSteamUser(db, {
    steamId,
    personaName: '---.GeforceNow Cloud Gamin',
    avatarUrl: steamAvatar,
    source: 'community_xml'
  });
  assert.equal(updated.username, `steam_${steamId}`);
  assert.equal(updated.display_name, '---.GeforceNow Cloud Gamin');
});
