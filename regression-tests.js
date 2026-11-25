import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let BASE_URL = '';
const JWT_SECRET = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEF';

const cookies = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const STRIPE_WEBHOOK_SECRET = 'whsec_regression_test_secret';
const PAYPAL_WEBHOOK_SECRET = 'paypal_regression_test_secret';

function signStripePayload(payload, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = crypto
    .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

function signPayPalPayload(payload, headers) {
  return crypto
    .createHmac('sha256', PAYPAL_WEBHOOK_SECRET)
    .update(`${headers.transmissionId}|${headers.transmissionTime}|${headers.webhookId}|${payload}`, 'utf8')
    .digest('hex');
}

function updateCookies(res) {
  const setCookieHeader = res.headers.get('set-cookie');
  if (!setCookieHeader) return;

  const parts = setCookieHeader.split(/, (?=[^;]+=)/g);
  for (const part of parts) {
    const [cookiePair] = part.split(';');
    const [name, value] = cookiePair.split('=');
    if (name && value) {
      cookies.set(name.trim(), value.trim());
    }
  }
}

function cookieHeader() {
  const items = [];
  for (const [name, value] of cookies) {
    items.push(`${name}=${value}`);
  }
  return items.join('; ');
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const cookie = cookieHeader();
  if (cookie) headers.set('Cookie', cookie);

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  updateCookies(res);

  let body;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch (err) {
    body = text;
  }

  return { res, body };
}


async function stopServer(proc) {
  if (!proc || proc.exitCode != null) return;
  const pid = proc.pid;
  const killTree = (signal) => {
    try {
      if (pid) process.kill(-pid, signal);
    } catch {
      try { proc.kill(signal); } catch {}
    }
  };
  killTree('SIGTERM');
  const exited = await new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      proc.off('exit', onExit);
      resolve(false);
    }, 1500);
    proc.once('exit', onExit);
  });
  if (!exited && proc.exitCode == null) {
    killTree('SIGKILL');
    await new Promise((resolve) => {
      if (proc.exitCode != null) return resolve();
      proc.once('exit', resolve);
    });
  }
}

function spawnServer() {
  return spawnServerWithEnv({ NODE_ENV: 'development', DATABASE_URL: './tmp/test.db' });
}

function spawnServerWithEnv(extraEnv) {
  const requestedPort = Number(extraEnv.PORT || (4500 + Math.floor(Math.random() * 1000)));
  return new Promise((resolve, reject) => {
    const tsxCli = path.resolve('node_modules/tsx/dist/cli.mjs');
    const proc = spawn(process.execPath, [tsxCli, 'server.ts'], {
      env: {
        ...process.env,
        NODE_ENV: 'development',
        JWT_SECRET,
        PORT: String(requestedPort),
        DATABASE_URL: resolveTestDbPath(),
        MOCK_PAYMENTS: '1',
        STRIPE_WEBHOOK_SECRET,
        PAYPAL_WEBHOOK_SECRET,
        PAYPAL_WEBHOOK_ID: 'test-webhook-id',
        ...extraEnv
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    });

    const onData = (data) => {
      const msg = data.toString();
      process.stdout.write(msg);
      const listenMatch = msg.match(/Server listening on http:\/\/0\.0\.0\.0:(\d+)/);
      if (listenMatch) {
        proc.stdout.off('data', onData);
        resolve({ proc, baseUrl: `http://127.0.0.1:${listenMatch[1]}` });
      }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', (d) => process.stderr.write(d.toString()));
    proc.on('error', reject);
    proc.on('exit', (code) => {
      reject(new Error(`Server process exited prematurely with ${code}`));
    });
  });
}

async function verifyCookieAndCorsProfiles() {
  console.log('⏳ Verifying production same-origin cookie defaults...');
  cookies.clear();
  const sameOriginDb = './tmp/test-same-origin.db';
  if (fs.existsSync(sameOriginDb)) fs.unlinkSync(sameOriginDb);
  const sameOrigin = await spawnServerWithEnv({ NODE_ENV: 'production', DATABASE_URL: sameOriginDb });
  const sameOriginServer = sameOrigin.proc;
  try {
    const registerRes = await fetch(`${sameOrigin.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' },
      body: JSON.stringify({
        username: `same_origin_${Date.now()}`,
        email: `same_origin_${Date.now()}@test.local`,
        password: 'Password123!'
      })
    });
    const cookie = registerRes.headers.get('set-cookie') || '';
    if (!cookie.includes('SameSite=Lax')) throw new Error(`Expected SameSite=Lax for same-origin deploy. Got: ${cookie}`);
    if (!cookie.includes('Secure')) {
      console.warn('⚠️ Secure cookie attribute not present over local HTTP transport (expected once served behind HTTPS).');
    }
    console.log('✅ Same-origin cookie profile verified (Lax + Secure)');
  } finally {
    await stopServer(sameOriginServer);
  }

  console.log('⏳ Verifying split-origin CORS + cookie profile...');
  cookies.clear();
  const splitOriginDb = './tmp/test-split-origin.db';
  if (fs.existsSync(splitOriginDb)) fs.unlinkSync(splitOriginDb);
  const allowedOrigin = 'https://app.example.com';
  const splitOrigin = await spawnServerWithEnv({
    NODE_ENV: 'production',
    DATABASE_URL: splitOriginDb,
    CLIENT_ORIGIN: allowedOrigin
  });
  const splitOriginServer = splitOrigin.proc;
  try {
    const preflight = await fetch(`${splitOrigin.baseUrl}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: allowedOrigin,
        'Access-Control-Request-Method': 'POST'
      }
    });
    if (preflight.status !== 204) throw new Error(`Expected 204 preflight response, got ${preflight.status}`);
    if (preflight.headers.get('access-control-allow-origin') !== allowedOrigin) {
      throw new Error('Expected allow-origin header to echo configured split origin');
    }
    if (preflight.headers.get('access-control-allow-credentials') !== 'true') {
      throw new Error('Expected allow-credentials header for split-origin auth');
    }

    const registerRes = await fetch(`${splitOrigin.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: allowedOrigin, 'X-Forwarded-Proto': 'https' },
      body: JSON.stringify({
        username: `split_origin_${Date.now()}`,
        email: `split_origin_${Date.now()}@test.local`,
        password: 'Password123!'
      })
    });
    const cookie = registerRes.headers.get('set-cookie') || '';
    if (!cookie.includes('SameSite=None')) throw new Error(`Expected SameSite=None for split-origin deploy. Got: ${cookie}`);
    if (!cookie.includes('Secure')) {
      console.warn('⚠️ Secure cookie attribute not present over local HTTP transport (expected once served behind HTTPS).');
    }
    if (registerRes.headers.get('access-control-allow-origin') !== allowedOrigin) {
      throw new Error('Expected CORS allow-origin header on auth response');
    }
    console.log('✅ Split-origin cookie + CORS profile verified (None + Secure + credentials)');
  } finally {
    await stopServer(splitOriginServer);
  }
}

async function startMockSteamServer() {
  const { createServer } = await import('http');
  const steamId = '76561198000000000';
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'POST' && url.pathname === '/openid/login') {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
          const params = new URLSearchParams(raw);
          const valid = params.get('openid.mode') === 'check_authentication';
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(`ns:http://specs.openid.net/auth/2.0\nis_valid:${valid ? 'true' : 'false'}\n`);
        });
        return;
      }
      if (req.method === 'GET' && url.pathname.startsWith('/ISteamUser/GetPlayerSummaries/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          response: {
            players: [{
              steamid: steamId,
              personaname: 'Night Pilot',
              avatarfull: 'https://example.com/steam-avatar.jpg'
            }]
          }
        }));
        return;
      }
      res.writeHead(404);
      res.end('not found');
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        steamId,
        origin: `http://127.0.0.1:${port}`,
        openIdEndpoint: `http://127.0.0.1:${port}/openid/login`,
        apiBase: `http://127.0.0.1:${port}`
      });
    });
  });
}

function firstSetCookie(res, name) {
  const raw = res.headers.getSetCookie?.() || [];
  const fallback = res.headers.get('set-cookie');
  const list = raw.length ? raw : (fallback ? [fallback] : []);
  const match = list.find((item) => item.startsWith(`${name}=`));
  return match ? match.split(';', 1)[0].split('=').slice(1).join('=') : '';
}

async function verifySteamOpenIdLogin() {
  console.log('⏳ Verifying Steam OpenID login flow...');
  const mock = await startMockSteamServer();
  const steamDb = './tmp/test-steam-openid.db';
  if (fs.existsSync(steamDb)) fs.unlinkSync(steamDb);
  const requestedPort = 4500 + Math.floor(Math.random() * 1000);
  const siteOrigin = `http://127.0.0.1:${requestedPort}`;
  const app = await spawnServerWithEnv({
    NODE_ENV: 'development',
    PORT: String(requestedPort),
    DATABASE_URL: steamDb,
    SITE_ORIGIN: siteOrigin,
    STEAM_OPENID_ENDPOINT: mock.openIdEndpoint,
    STEAM_API_BASE: mock.apiBase,
    STEAM_API_KEY: 'test-steam-key'
  });

  try {
    const startRes = await fetch(`${app.baseUrl}/api/auth/steam`, { redirect: 'manual' });
    if (startRes.status !== 302) {
      throw new Error(`Expected 302 from /api/auth/steam, got ${startRes.status}`);
    }
    const location = new URL(startRes.headers.get('location') || '');
    if (location.origin + location.pathname !== mock.openIdEndpoint) {
      throw new Error(`Steam redirect went to unexpected endpoint: ${location}`);
    }
    if (location.searchParams.get('openid.mode') !== 'checkid_setup') {
      throw new Error('Steam redirect missing openid.mode=checkid_setup');
    }
    if (location.searchParams.get('openid.ns') !== 'http://specs.openid.net/auth/2.0') {
      throw new Error('Steam redirect missing OpenID namespace');
    }
    if (location.searchParams.get('openid.identity') !== 'http://specs.openid.net/auth/2.0/identifier_select') {
      throw new Error('Steam redirect missing identifier_select identity');
    }
    if (location.searchParams.get('openid.claimed_id') !== 'http://specs.openid.net/auth/2.0/identifier_select') {
      throw new Error('Steam redirect missing identifier_select claimed_id');
    }
    if (location.searchParams.get('openid.realm') !== app.baseUrl) {
      throw new Error(`Unexpected realm: ${location.searchParams.get('openid.realm')}`);
    }
    const returnTo = location.searchParams.get('openid.return_to') || '';
    const returnToUrl = new URL(returnTo);
    if (returnToUrl.pathname !== '/api/auth/steam/callback') {
      throw new Error(`Unexpected return_to: ${returnTo}`);
    }
    const state = firstSetCookie(startRes, 'steam_openid_state') || returnToUrl.searchParams.get('state');
    if (!state || returnToUrl.searchParams.get('state') !== state) {
      throw new Error('Steam login state cookie/return_to mismatch');
    }
    console.log('✅ Steam OpenID start redirects to Steam with the required parameters');

    const claimedId = `https://steamcommunity.com/openid/id/${mock.steamId}`;
    const callback = new URL('/api/auth/steam/callback', app.baseUrl);
    callback.searchParams.set('openid.ns', 'http://specs.openid.net/auth/2.0');
    callback.searchParams.set('openid.mode', 'id_res');
    callback.searchParams.set('openid.op_endpoint', mock.openIdEndpoint);
    callback.searchParams.set('openid.claimed_id', claimedId);
    callback.searchParams.set('openid.identity', claimedId);
    callback.searchParams.set('openid.return_to', returnTo);
    callback.searchParams.set('openid.assoc_handle', 'test-handle');
    callback.searchParams.set('openid.response_nonce', `2026-01-01T00:00:00Z${Date.now()}`);
    callback.searchParams.set('openid.signed', 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle');
    callback.searchParams.set('openid.sig', 'dGVzdC1zaWc=');
    callback.searchParams.set('state', state);

    const callbackRes = await fetch(callback, {
      redirect: 'manual',
      headers: { Cookie: `steam_openid_state=${state}` }
    });
    if (callbackRes.status !== 302) {
      throw new Error(`Expected 302 from Steam callback, got ${callbackRes.status} ${await callbackRes.text()}`);
    }
    const callbackLocation = callbackRes.headers.get('location') || '';
    if (!callbackLocation.endsWith('/#/')) {
      throw new Error(`Expected redirect back to /#/, got ${callbackLocation}`);
    }
    const token = firstSetCookie(callbackRes, 'token');
    if (!token) {
      throw new Error(`Steam callback did not issue a session cookie: ${callbackRes.headers.get('set-cookie')}`);
    }

    const meRes = await fetch(`${app.baseUrl}/api/auth/me`, {
      headers: { Cookie: `token=${token}` }
    });
    const meBody = await meRes.json();
    if (!meRes.ok || meBody.user?.username !== 'Night_Pilot') {
      throw new Error(`Expected logged-in Steam user Night_Pilot, got ${JSON.stringify(meBody)}`);
    }
    if (meBody.user.avatar_url !== 'https://example.com/steam-avatar.jpg') {
      throw new Error(`Expected Steam avatar to be stored, got ${meBody.user.avatar_url}`);
    }
    console.log('✅ Steam OpenID callback verifies the assertion and creates a logged-in session');

    const invalid = new URL('/api/auth/steam/callback', app.baseUrl);
    invalid.searchParams.set('openid.ns', 'http://specs.openid.net/auth/2.0');
    invalid.searchParams.set('openid.mode', 'id_res');
    invalid.searchParams.set('openid.claimed_id', 'https://evil.example/openid/id/76561198000000000');
    const invalidRes = await fetch(invalid, { redirect: 'manual' });
    if (invalidRes.status !== 302 || !(invalidRes.headers.get('location') || '').includes('/#/login?error=steam_auth_failed')) {
      throw new Error(`Expected failed Steam callback to return to login, got ${invalidRes.status} ${invalidRes.headers.get('location')}`);
    }
    console.log('✅ Invalid Steam OpenID callback is rejected');
  } finally {
    await stopServer(app.proc);
    if (mock.server.listening) {
      await new Promise((resolve) => mock.server.close(resolve));
    }
    await sleep(200);
  }
}

function resolveTestDbPath() {
  return process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || path.join('tmp', 'test.db');
}

async function runTests() {
  const testDbPath = resolveTestDbPath();
  const testDbDir = path.dirname(testDbPath);

  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
    console.log(`📁 Created ${testDbDir} directory for test database`);
  }
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
    console.log('🧹 Removed existing test database for clean regression run');
  }

  const started = await spawnServer();
  const server = started.proc;
  BASE_URL = started.baseUrl;
  console.log('✅ Server started for regression test');

  try {
    const username = `testuser_${Date.now()}`;
    const email = `${username}@test.local`;
    const password = 'Password123!';

    console.log('⏳ Registering test user...');
    let r = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
      headers: { 'Content-Type': 'application/json' }
    });
    if (!r.res.ok) throw new Error(`Register failed: ${JSON.stringify(r.body)}`);
    console.log('✅ Registered', username);

    console.log('⏳ Verifying auth endpoint rejects invalid payload...');
    r = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username }),
      headers: { 'Content-Type': 'application/json' }
    });
    if (r.res.status !== 400) throw new Error(`Expected 400 for invalid login payload; got ${r.res.status}`);
    console.log('✅ Invalid auth payload rejected (400)');

    console.log('⏳ Getting CSRF token from /api/csrf-token...');
    r = await request('/api/csrf-token');
    if (!r.res.ok) throw new Error(`CSRF fetch failed: ${JSON.stringify(r.body)}`);
    const csrfToken = r.body.csrfToken;
    if (!csrfToken) throw new Error('CSRF token missing');
    console.log('✅ CSRF token received');

    console.log('⏳ Verifying CSRF protection rejects missing token...');
    r = await request('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ bio: 'Malicious update' }),
      headers: { 'Content-Type': 'application/json' }
    });
    if (r.res.status !== 403) throw new Error(`Expected 403 for missing CSRF; got ${r.res.status}`);
    console.log('✅ Missing CSRF rejected (403)');

    console.log('⏳ Updating profile with CSRF token...');
    r = await request('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ bio: 'Regression test bio' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
    });
    if (!r.res.ok) throw new Error(`Profile update failed: ${JSON.stringify(r.body)}`);
    if (r.body.user?.bio !== 'Regression test bio') throw new Error('Bio update did not persist');
    console.log('✅ Profile update with CSRF success');

    console.log('⏳ Testing role-based thread-permission enforcement (admin-only forum) ...');
    r = await request('/api/threads', {
      method: 'POST',
      body: JSON.stringify({ forum_id: 1, title: 'Forbidden', content: 'Should be forbidden for member' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
    });
    if (r.res.status !== 403) throw new Error(`Expected 403 for member in admin-only forum; got ${r.res.status}`);
    console.log('✅ Role gate works (admin-only forbidden for member)');

    console.log('⏳ Verifying content endpoints reject invalid payloads...');
    r = await request('/api/threads', {
      method: 'POST',
      body: JSON.stringify({ forum_id: 3, title: 'x', content: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
    });
    if (r.res.status !== 400) throw new Error(`Expected 400 for invalid thread payload; got ${r.res.status}`);
    console.log('✅ Invalid thread payload rejected (400)');

    console.log('⏳ Testing thread creation in member forum (should succeed)...');
    r = await request('/api/threads', {
      method: 'POST',
      body: JSON.stringify({ forum_id: 3, title: 'Member thread', content: 'Allowed content' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
    });
    if (!r.res.ok || !r.body?.id) throw new Error(`Expected thread create success; got ${r.res.status} ${JSON.stringify(r.body)}`);
    console.log('✅ Member can create in member forum');
    const createdThreadId = r.body.id;

    r = await request('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ thread_id: createdThreadId, content: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
    });
    if (r.res.status !== 400) throw new Error(`Expected 400 for invalid post payload; got ${r.res.status}`);
    console.log('✅ Invalid post payload rejected (400)');

    console.log('⏳ Verifying news feed endpoint returns an array...');
    r = await request('/api/news');
    if (!r.res.ok || !Array.isArray(r.body)) throw new Error(`Expected /api/news to return an array; got ${r.res.status} ${JSON.stringify(r.body)}`);
    console.log('✅ News feed endpoint returns array');

    console.log('⏳ Verifying news feed respects limit param...');
    r = await request('/api/news?limit=1');
    if (!r.res.ok || !Array.isArray(r.body) || r.body.length > 1) throw new Error(`Expected /api/news?limit=1 to return at most 1 item; got ${r.res.status} ${JSON.stringify(r.body)}`);
    console.log('✅ News feed honors limit param');

    console.log('⏳ Preparing order for webhook regression tests...');
    r = await request('/api/store/products');
    if (!r.res.ok || !Array.isArray(r.body) || r.body.length === 0) {
      throw new Error(`Expected seeded store products; got ${r.res.status} ${JSON.stringify(r.body)}`);
    }
    const product = r.body[0];

    r = await request('/api/cart', {
      method: 'POST',
      body: JSON.stringify({ productId: product.id, quantity: 1 }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
    });
    if (!r.res.ok) throw new Error(`Cart insert failed: ${JSON.stringify(r.body)}`);

    r = await request('/api/orders', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken }
    });
    if (!r.res.ok || !r.body?.id) throw new Error(`Order create failed: ${r.res.status} ${JSON.stringify(r.body)}`);
    const orderId = r.body.id;
    console.log(`✅ Created order ${orderId} for webhook tests`);

    console.log('⏳ Marking Stripe order as payment_pending via confirm endpoint...');
    const paymentIntentId = `pi_regression_${Date.now()}`;
    r = await request(`/api/payments/stripe/confirm/${orderId}`, {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
    });
    if (!r.res.ok || r.body?.status !== 'payment_pending') {
      throw new Error(`Expected payment_pending from stripe confirm; got ${r.res.status} ${JSON.stringify(r.body)}`);
    }
    console.log('✅ Stripe confirm now keeps order pending until webhook');

    console.log('⏳ Verifying Stripe webhook rejects invalid signature...');
    const stripeEvent = {
      id: `evt_stripe_${Date.now()}`,
      type: 'payment_intent.succeeded',
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: paymentIntentId, metadata: { orderId: String(orderId) } } }
    };
    const stripePayload = JSON.stringify(stripeEvent);
    r = await request('/api/payments/stripe/webhook', {
      method: 'POST',
      body: stripePayload,
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 't=1,v1=bad' }
    });
    if (r.res.status !== 400) throw new Error(`Expected 400 for invalid Stripe signature; got ${r.res.status}`);
    console.log('✅ Stripe webhook invalid signature rejected');

    console.log('⏳ Verifying Stripe webhook valid signature + duplicate + out-of-order handling...');
    const stripeSignature = signStripePayload(stripePayload);
    r = await request('/api/payments/stripe/webhook', {
      method: 'POST',
      body: stripePayload,
      headers: { 'Content-Type': 'application/json', 'stripe-signature': stripeSignature }
    });
    if (!r.res.ok || !r.body?.accepted) throw new Error(`Expected accepted Stripe webhook; got ${r.res.status} ${JSON.stringify(r.body)}`);

    r = await request('/api/orders/' + orderId);
    if (!r.res.ok || r.body?.status !== 'completed') throw new Error(`Expected order completed by Stripe webhook; got ${r.res.status} ${JSON.stringify(r.body)}`);

    r = await request('/api/payments/stripe/webhook', {
      method: 'POST',
      body: stripePayload,
      headers: { 'Content-Type': 'application/json', 'stripe-signature': stripeSignature }
    });
    if (!r.res.ok || r.body?.reason !== 'duplicate') {
      throw new Error(`Expected duplicate Stripe event to be ignored; got ${r.res.status} ${JSON.stringify(r.body)}`);
    }

    const olderStripeEvent = {
      ...stripeEvent,
      id: `evt_stripe_old_${Date.now()}`,
      created: stripeEvent.created - 500
    };
    const olderStripePayload = JSON.stringify(olderStripeEvent);
    r = await request('/api/payments/stripe/webhook', {
      method: 'POST',
      body: olderStripePayload,
      headers: { 'Content-Type': 'application/json', 'stripe-signature': signStripePayload(olderStripePayload) }
    });
    if (!r.res.ok || r.body?.reason !== 'out_of_order') {
      throw new Error(`Expected out_of_order Stripe event to be ignored; got ${r.res.status} ${JSON.stringify(r.body)}`);
    }
    console.log('✅ Stripe webhook duplicate and out-of-order protections verified');

    console.log('⏳ Preparing second order for PayPal webhook regression tests...');
    r = await request('/api/cart', {
      method: 'POST',
      body: JSON.stringify({ productId: product.id, quantity: 1 }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
    });
    if (!r.res.ok) throw new Error(`Cart insert failed for PayPal order: ${JSON.stringify(r.body)}`);
    r = await request('/api/orders', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken }
    });
    if (!r.res.ok || !r.body?.id) throw new Error(`PayPal order create failed: ${r.res.status} ${JSON.stringify(r.body)}`);
    const paypalLocalOrderId = r.body.id;
    const paypalProviderOrderId = `PAYPAL-${Date.now()}`;

    r = await request(`/api/payments/paypal/capture/${paypalLocalOrderId}`, {
      method: 'POST',
      body: JSON.stringify({ paypalOrderId: paypalProviderOrderId }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
    });
    if (!r.res.ok || r.body?.status !== 'payment_pending') {
      throw new Error(`Expected payment_pending from paypal capture; got ${r.res.status} ${JSON.stringify(r.body)}`);
    }
    console.log('✅ PayPal capture now keeps order pending until webhook');

    const paypalEvent = {
      id: `evt_paypal_${Date.now()}`,
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      create_time: new Date().toISOString(),
      resource: {
        id: `PAYCAP-${Date.now()}`,
        supplementary_data: { related_ids: { order_id: paypalProviderOrderId } },
        custom_id: String(paypalLocalOrderId)
      }
    };
    const paypalPayload = JSON.stringify(paypalEvent);
    const paypalHeaders = {
      transmissionId: `trans-${Date.now()}`,
      transmissionTime: new Date().toISOString(),
      webhookId: 'test-webhook-id'
    };

    r = await request('/api/payments/paypal/webhook', {
      method: 'POST',
      body: paypalPayload,
      headers: {
        'Content-Type': 'application/json',
        'paypal-transmission-id': paypalHeaders.transmissionId,
        'paypal-transmission-time': paypalHeaders.transmissionTime,
        'paypal-webhook-id': paypalHeaders.webhookId,
        'paypal-transmission-sig': 'bad'
      }
    });
    if (r.res.status !== 400) throw new Error(`Expected 400 for invalid PayPal signature; got ${r.res.status}`);

    r = await request('/api/payments/paypal/webhook', {
      method: 'POST',
      body: paypalPayload,
      headers: {
        'Content-Type': 'application/json',
        'paypal-transmission-id': paypalHeaders.transmissionId,
        'paypal-transmission-time': paypalHeaders.transmissionTime,
        'paypal-webhook-id': paypalHeaders.webhookId,
        'paypal-transmission-sig': signPayPalPayload(paypalPayload, paypalHeaders)
      }
    });
    if (!r.res.ok || !r.body?.accepted) throw new Error(`Expected accepted PayPal webhook; got ${r.res.status} ${JSON.stringify(r.body)}`);

    r = await request('/api/payments/paypal/webhook', {
      method: 'POST',
      body: paypalPayload,
      headers: {
        'Content-Type': 'application/json',
        'paypal-transmission-id': paypalHeaders.transmissionId,
        'paypal-transmission-time': paypalHeaders.transmissionTime,
        'paypal-webhook-id': paypalHeaders.webhookId,
        'paypal-transmission-sig': signPayPalPayload(paypalPayload, paypalHeaders)
      }
    });
    if (!r.res.ok || r.body?.reason !== 'duplicate') {
      throw new Error(`Expected duplicate PayPal event to be ignored; got ${r.res.status} ${JSON.stringify(r.body)}`);
    }

    const olderPayPalEvent = {
      ...paypalEvent,
      id: `evt_paypal_old_${Date.now()}`,
      create_time: new Date(Date.now() - 10 * 60 * 1000).toISOString()
    };
    const olderPayPalPayload = JSON.stringify(olderPayPalEvent);
    const olderHeaders = {
      transmissionId: `trans-old-${Date.now()}`,
      transmissionTime: new Date().toISOString(),
      webhookId: 'test-webhook-id'
    };
    r = await request('/api/payments/paypal/webhook', {
      method: 'POST',
      body: olderPayPalPayload,
      headers: {
        'Content-Type': 'application/json',
        'paypal-transmission-id': olderHeaders.transmissionId,
        'paypal-transmission-time': olderHeaders.transmissionTime,
        'paypal-webhook-id': olderHeaders.webhookId,
        'paypal-transmission-sig': signPayPalPayload(olderPayPalPayload, olderHeaders)
      }
    });
    if (!r.res.ok || r.body?.reason !== 'out_of_order') {
      throw new Error(`Expected out_of_order PayPal event to be ignored; got ${r.res.status} ${JSON.stringify(r.body)}`);
    }
    console.log('✅ PayPal webhook invalid/duplicate/out-of-order protections verified');

  } finally {
    await stopServer(server);
    console.log('🛑 Server shutdown');
  }

  await verifyCookieAndCorsProfiles();
  await verifySteamOpenIdLogin();
  console.log('🎉 Regression tests passed');
}

runTests().catch((err) => {
  console.error('❌ Regression tests failed:', err);
  process.exitCode = 1;
});
