# Track 1 — Unify the Duplicate API

- **Owner**: Unassigned
- **Status**: ⬜ Todo
- **Last updated**: 2026-06-25

## Problem

The backend exists as **two independent copies** of the same API:

- [`server.ts`](../../../server.ts) — the long-lived Express entrypoint (`npm run dev`).
- [`api/[...path].ts`](../../../api/[...path].ts) — the serverless gateway used by
  Vercel/Netlify deployments.

Each file declares its **own** copy of:

- Zod request schemas (auth register/login, profile update, content, etc.)
- CSRF middleware (double-submit cookie pattern)
- Rate limiters
- Auth helpers (JWT signing/verification, bcrypt usage)
- Route handlers

Because they are maintained separately, **they have already drifted**. Concrete example
— the registration password minimum length:

| File | Line | Rule |
| --- | --- | --- |
| [`server.ts`](../../../server.ts#L66) | ~65 | `password: z.string().min(8).max(128)` |
| [`api/[...path].ts`](../../../api/[...path].ts#L128) | ~128 | `password: z.string().min(6).max(128)` |

A user who registers via the serverless API can set a 6-character password that the
Express server would reject — a real security/consistency bug caused purely by
duplication. More drift like this is likely lurking across the other shared concerns.

## Goal

Establish a **single source of truth** for schemas, middleware, auth helpers, and route
handlers, consumed by both `server.ts` and `api/[...path].ts`. The two files should
shrink to thin adapters that wire the shared logic into their respective runtimes
(long-lived Express vs serverless handler).

Suggested home for shared code: existing [`src/lib/`](../../../src/lib) (alongside
`db.ts`, `api.ts`) or a new `src/server/` module. Pick one and apply it consistently;
record the decision in `docs/ai/MEMORY.md`.

## Steps

Start with the **auth schemas** — the smallest independently verifiable slice that also
fixes the known password-length drift.

- [ ] **Slice 1 (first verifiable slice): extract auth schemas.** Create a shared
  module (e.g. `src/lib/schemas/auth.ts`) exporting `authRegisterSchema` and
  `authLoginSchema` with a single agreed password policy (reconcile to `min(8)`).
  Import it in both `server.ts` and `api/[...path].ts`, deleting the local copies.
  Validate that registration/login behave identically on both entrypoints.
- [ ] **Slice 2: extract remaining Zod schemas** (profile update, content/forum/post,
  message, support ticket) into shared modules; remove duplicates from both files.
- [ ] **Slice 3: extract auth helpers** (JWT sign/verify, cookie parsing, bcrypt
  wrappers) into a shared `src/lib/auth.ts` (or `src/server/auth.ts`) used by both.
- [ ] **Slice 4: extract CSRF middleware** (double-submit cookie) into one shared
  implementation; wire it into both runtimes.
- [ ] **Slice 5: extract rate limiters** into a shared module (coordinate with
  [Track 2](./02-externalize-state.md), which replaces the in-memory store backing
  them).
- [ ] **Slice 6: extract route handlers** into framework-agnostic functions that both
  entrypoints register, leaving `server.ts` / `api/[...path].ts` as thin adapters.
- [ ] **Slice 7: add a drift guard** — a small test (or type-level assertion) that
  fails if the two entrypoints diverge on shared contracts (e.g. importing the same
  schema objects).

Tick each checkbox as its slice lands; keep diffs small (one slice per PR where
possible).

## Validation

For each slice:

```bash
npm run lint
npm run build
npm run test:integration
```

Additionally, assert behavioral parity between the two entrypoints for the touched
routes (e.g. same validation rejection for a 6-char password on both
`server.ts` and the serverless gateway).

## Cross-links

- Backlog: [`Scalability Improvements`](../BACKLOG.md#scalability-improvements)
- Depends-on / unblocks: [Track 2](./02-externalize-state.md),
  [Track 3](./03-realtime-host.md)
