import { spawn } from 'child_process';
import fs from 'fs';

const PORT = 4000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEF';

const cookies = new Map();

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
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['tsx', 'server.ts'], {
      env: { ...process.env, NODE_ENV: 'development', JWT_SECRET, PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const onData = (data) => {
      const msg = data.toString();
      process.stdout.write(msg);
      if (msg.includes(`Server listening on http://0.0.0.0:${PORT}`)) {
        proc.stdout.off('data', onData);
        resolve(proc);
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

async function runTests() {
  if (fs.existsSync('nightrespawn.db')) {
    fs.unlinkSync('nightrespawn.db');
    console.log('🧹 Removed existing nightrespawn.db for clean regression run');
  }

  const server = await spawnServer();
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

    console.log('🎉 Regression tests passed');
  } finally {
    server.kill('SIGTERM');
    console.log('🛑 Server shutdown');
  }
}

runTests().catch((err) => {
  console.error('❌ Regression tests failed:', err);
  process.exitCode = 1;
});
