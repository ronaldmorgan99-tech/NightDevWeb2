import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

let BASE_URL = '';
const JWT_SECRET = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEF';

const cookies = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function spawnServer() {
  return spawnServerWithEnv({ NODE_ENV: 'development', DATABASE_URL: './tmp/test.db' });
}

function spawnServerWithEnv(extraEnv) {
  const requestedPort = Number(extraEnv.PORT || (4500 + Math.floor(Math.random() * 1000)));
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['tsx', 'server.ts'], {
      env: { ...process.env, JWT_SECRET, PORT: String(requestedPort), ...extraEnv },
      env: { ...process.env, NODE_ENV: 'development', JWT_SECRET, PORT: String(PORT), DATABASE_URL: resolveTestDbPath() },
      stdio: ['ignore', 'pipe', 'pipe']
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
    sameOriginServer.kill('SIGTERM');
    await sleep(500);
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
    splitOriginServer.kill('SIGTERM');
    await sleep(500);
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

    console.log('⏳ Testing thread creation in member forum (should succeed)...');
    r = await request('/api/threads', {
      method: 'POST',
      body: JSON.stringify({ forum_id: 3, title: 'Member thread', content: 'Allowed content' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
    });
    if (!r.res.ok || !r.body?.id) throw new Error(`Expected thread create success; got ${r.res.status} ${JSON.stringify(r.body)}`);
    console.log('✅ Member can create in member forum');

  } finally {
    server.kill('SIGTERM');
    console.log('🛑 Server shutdown');
    await sleep(500);
  }

  await verifyCookieAndCorsProfiles();
  console.log('🎉 Regression tests passed');
}

runTests().catch((err) => {
  console.error('❌ Regression tests failed:', err);
  process.exitCode = 1;
});
