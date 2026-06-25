# Track 2 — Externalize In-Memory State

- **Owner**: Unassigned
- **Status**: ⬜ Todo
- **Last updated**: 2026-06-25

## Problem

Several runtime features keep state in **per-process JavaScript `Map`s**. This works for
a single long-lived server but **breaks under serverless**, where each invocation may
run in a fresh, isolated process (and may scale to many concurrent instances):

- **Rate limiting** — [`api/[...path].ts`](../../../api/[...path].ts#L471) (~line 470)
  builds `const requests = new Map<string, number[]>()` per process. Each serverless
  instance has its own map, so limits are neither global nor durable; a user spread
  across instances bypasses the limit, and a cold start resets it entirely.
- **Media operations & quotas** —
  [`api/[...path].ts`](../../../api/[...path].ts#L274) (~line 274) holds
  `mediaOperations = new Map(...)` and `mediaQuotas = new Map(...)`, pruned via
  `setInterval(pruneExpiredMediaOperations, 60_000).unref()`
  ([~line 300](../../../api/[...path].ts#L300)). In serverless, `setInterval` timers do
  not reliably run between invocations, operation state is lost across instances, and
  the hourly quota check ([~line 1705](../../../api/[...path].ts#L1705)) is per-process
  rather than per-user-global.

## Goal

Move this shared runtime state into an **external store** so it is consistent across
processes/instances and survives cold starts:

- Preferred: a shared cache like **Redis** (aligns with the backlog
  `Redis for session/cache management` item), or
- The existing **DB layer** via [`src/lib/db.ts`](../../../src/lib/db.ts) for state that
  is fine to persist relationally (e.g. media operations, quota windows).

Replace `setInterval` pruning with store-native TTLs (Redis `EXPIRE`) or a lazy
sweep/`expires_at` column checked on read.

## Steps

- [ ] **Slice 1: introduce a store abstraction.** Add a small interface (e.g.
  `RateStore` / `KvStore` in `src/lib/`) with a Redis-backed implementation and an
  in-memory implementation for local/dev and tests. Decide Redis vs DB per state type
  and record it in `docs/ai/MEMORY.md`.
- [ ] **Slice 2 (first verifiable slice): move rate limiting** off the per-process
  `Map` (~line 470) to the shared store using atomic counters with a TTL window. Verify
  limits hold across simulated multi-instance requests.
- [ ] **Slice 3: move media quota windows** (~line 1705) to the shared store keyed per
  user, so the hourly quota is global rather than per-process.
- [ ] **Slice 4: move media operation records** (~line 274) to the shared store with
  TTL-based expiry, replacing the `setInterval` pruner (~line 300).
- [ ] **Slice 5: remove the `setInterval` pruning** path entirely once TTL/sweep-on-read
  covers expiry; ensure no serverless-incompatible timers remain.
- [ ] **Slice 6: configuration & fallback.** Gate the store behind env config
  (e.g. `REDIS_URL`); fall back to the in-memory implementation only for local dev, and
  document required production env vars.

Coordinate with [Track 1](./01-unify-api.md): if rate limiters are extracted to a shared
module there, this track swaps their backing store.

## Validation

```bash
npm run lint
npm run build
npm run test:integration
```

Add tests that exercise the store abstraction with both the in-memory and external
backends, and verify rate-limit/quota behavior is consistent when requests are
distributed across simulated instances.

## Cross-links

- Backlog: [`Scalability Improvements`](../BACKLOG.md#scalability-improvements)
  (`Redis for session/cache management`)
- Depends-on: [Track 1](./01-unify-api.md) (shared rate limiter module)
