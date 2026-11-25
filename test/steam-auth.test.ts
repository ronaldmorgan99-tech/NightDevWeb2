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
  parseSteamIdFromClaimedId,
  sanitizeSteamUsername,
  verifySteamAssertion,
  fetchSteamProfile,
  STEAM_OPENID_NS,
  STEAM_IDENTIFIER_SELECT
} from '../src/lib/steamAuth.ts';

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
  assert.equal(await verifySteamAssertion(validParams(), okFetch), true);

  const badFetch: typeof fetch = async () => new Response('ns:http://specs.openid.net/auth/2.0\nis_valid:false\n', { status: 200 });
  assert.equal(await verifySteamAssertion(validParams(), badFetch), false);

  const spoofedFetch: typeof fetch = async () => new Response('note:is_valid:true\nis_valid:false\n', { status: 200 });
  assert.equal(await verifySteamAssertion(validParams(), spoofedFetch), false);
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

test('fetchSteamProfile degrades when STEAM_API_KEY is missing or the API fails', async () => {
  const previousKey = process.env.STEAM_API_KEY;
  try {
    delete process.env.STEAM_API_KEY;
    assert.deepEqual(await fetchSteamProfile(steamId, async () => {
      throw new Error('should not be called');
    }), { steamId });

    process.env.STEAM_API_KEY = 'test-key';
    const okFetch: typeof fetch = async (url) => {
      assert.match(String(url), /ISteamUser\/GetPlayerSummaries\/v2/);
      return new Response(JSON.stringify({
        response: {
          players: [{ steamid: steamId, personaname: 'Pilot', avatarfull: 'https://example.com/avatar.jpg' }]
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    assert.deepEqual(await fetchSteamProfile(steamId, okFetch), {
      steamId,
      personaName: 'Pilot',
      avatarUrl: 'https://example.com/avatar.jpg'
    });

    const failFetch: typeof fetch = async () => new Response('nope', { status: 500 });
    assert.deepEqual(await fetchSteamProfile(steamId, failFetch), { steamId });
  } finally {
    if (previousKey === undefined) delete process.env.STEAM_API_KEY;
    else process.env.STEAM_API_KEY = previousKey;
  }
});
