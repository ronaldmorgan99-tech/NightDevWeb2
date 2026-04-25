import assert from 'node:assert/strict';
import test from 'node:test';

type FetchImpl = typeof fetch;

async function loadApiWithFetch(fetchImpl: FetchImpl) {
  globalThis.fetch = fetchImpl;
  const modulePath = `../src/lib/api.ts?test=${Date.now()}-${Math.random()}`;
  return import(modulePath);
}

test('apiJson returns null for empty-body success responses', async () => {
  const { apiJson } = await loadApiWithFetch(async () => new Response(null, { status: 204 }));

  const result = await apiJson('/api/example');

  assert.equal(result, null);
});

test('apiJson throws ApiError for empty-body error responses', async () => {
  const { apiJson, ApiError } = await loadApiWithFetch(async () => new Response(null, { status: 500 }));

  await assert.rejects(
    () => apiJson('/api/example'),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 500);
      assert.equal(error.message, 'HTTP 500');
      return true;
    }
  );
});

test('apiJson preserves text-body error semantics for non-2xx responses', async () => {
  const { apiJson, ApiError } = await loadApiWithFetch(
    async () => new Response('Something went wrong', { status: 400, headers: { 'content-type': 'text/plain' } })
  );

  await assert.rejects(
    () => apiJson('/api/example'),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 400);
      assert.equal(error.message, 'Something went wrong');
      return true;
    }
  );
});

test('apiJson parses JSON response bodies for successful responses', async () => {
  const { apiJson } = await loadApiWithFetch(
    async () => new Response(JSON.stringify({ ok: true, count: 2 }), { status: 200, headers: { 'content-type': 'application/json' } })
  );

  const result = await apiJson<{ ok: boolean; count: number }>('/api/example');

  assert.deepEqual(result, { ok: true, count: 2 });
});
