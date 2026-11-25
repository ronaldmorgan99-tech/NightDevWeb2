# NightDevWeb2 Memory

Last reviewed: 2026-11-25

Review note: Docs synced to main `25ea65c` (through PR #245) on 2026-11-25. Reviewed README, env examples, feature inventory, incomplete-features plan, product requirements, and the unify-API refactor track against shipped code.

## Document Governance

- **Owner**: Platform Engineering (primary) with Admin Operations as contributing reviewers for release communications.
- **Required update triggers**:
  - Post-incident review for any production issue touching auth, deploy routing, CORS, or data integrity.
  - Post-release review after each production deployment.
  - Architecture change review whenever routes, API bootstrap, data layer, auth model, or deployment topology changes.
- **Review cadence**: Review weekly and additionally during each sprint retrospective.
- **Archive format**:
  - Keep active context in this file.
  - Move outdated decisions and gotchas older than 30 days to `docs/ai/archive/MEMORY_ARCHIVE.md` under month-based headings (`## YYYY-MM`).
  - Preserve each archived entry with its original date and add `Archived on: YYYY-MM-DD`.

## Architecture Map

### Frontend Routes (`src/App.tsx`, React Router `HashRouter`)

Live URLs are hash paths (example: `/#/servers`).

- `/` — HomePage (home landing, not the forum index)
- `/forums` — ForumsPage (sector/forum listing)
- `/forums/:id` — ForumViewPage
- `/forums/:id/new` — CreateThreadPage
- `/threads/:id` — ThreadViewPage
- `/members` — MembersPage
- `/profile`, `/profile/:id` — ProfilePage
- `/store` — StorePage
- `/servers` — ServersPage (live NightRespawnPilot status panel at the top)
- `/news` — NewsPage (`/api/news`)
- `/messages` — MessagesPage (Socket.IO)
- `/support`, `/contact` — SupportPage (guest-readable; tickets require sign-in)
- `/help`, `/rules`, `/privacy`, `/terms` — HelpPage / InfoPage
- `/login`, `/register`, `/settings` — LoginPage, RegisterPage, SettingsPage
- `/discord` — DiscordPage
- `/admin/*` — AdminLayout (dashboard, users, moderation, forums, tags, store, integrations, analytics, support, settings)
- `/studio` — Feature-flagged: `VITE_ENABLE_STUDIO=true` renders Veo Studio, `VITE_ENABLE_STUDIO=false` renders Coming Soon (no redirect)

`src/pages/CategoryPage.tsx` still exists but is not routed.

### Server Structure

- `server.ts` — long-lived Express entrypoint (`npm run dev`, local/CI smoke).
- `api/[...path].ts` — Vercel/Netlify serverless gateway used in production.
- Both use JWT authentication in an httpOnly `token` cookie, CSRF double-submit, and Socket.IO for messaging.
- Shared modules used by both backends:
  - `src/lib/forumPermissions.ts` (PR #242)
  - `src/lib/liveServers.ts` and `src/lib/serverStatus.ts` (PR #245)
- Other Zod schemas and route handlers are still copied in both files. Registration password minimum is still 8 in `server.ts` and 6 in `api/[...path].ts`.
- Media APIs: `/api/media/animate` + `/api/media/poll` (Google Gemini), gated by `VITE_ENABLE_STUDIO`.

### Database Layer (`src/lib/db.ts`)

- SQLite locally (`DATABASE_URL` as a file path, or `nightrespawn.db`; `/tmp/nightrespawn.db` on Vercel if no remote URL is set).
- Turso/LibSQL when `DATABASE_URL` or `TURSO_DATABASE_URL` starts with `libsql://` (`TURSO_AUTH_TOKEN`).
- MySQL when the URL starts with `mysql`. There is no Postgres driver.
- Stores users, forums, threads, posts, messages, orders, settings, support tickets, and related tables. Steam users are keyed by `steam_id`.

### Auth

- Username/password registration and login, bcrypt password hashing, role-based access (`member`, `moderator`, `admin`, `suspended`).
- Steam OpenID: `GET /api/auth/steam` and `/api/auth/steam/callback` (`src/lib/steamAuth.ts`, PRs #233–#235, #239). `SITE_ORIGIN` (fallback `APP_URL`) is the public origin for `return_to` and realm.
- `STEAM_API_KEY` or admin setting `steam_api_key` hydrates persona name and avatar; login still works without a key.

### Live Server Status

- Configured in `src/lib/configuredServers.ts` from `NIGHTRESPAWN_PILOT_ENABLED`, `NIGHTRESPAWN_PILOT_SERVER_CODE`, and `NIGHTRESPAWN_PILOT_INTERNAL_ADDRESS`. The Server Code changes on every dedicated-server restart.
- `getLiveConfiguredServers` (used by both API entrypoints) calls `checkSteamServerStatus`: Steam `IGameServersService/GetServerList` with filter `\appid\304930\name_match\NightRespawnPilot*`, matched on the Server Code.
- Key resolution reuses `resolveSteamApiKey` (`STEAM_API_KEY`, then `steam_api_key`).
- Status is `online`, `offline`, or `unknown`. Unknown is used when there is no key, Steam errors, or the 4-second timeout fires. Online is never assumed from a configured code alone. Confirmed Steam results are cached for 30 seconds.
- Join link for the relay code: `steam://run/304930//+connect <code>/`.

### Forum Permissions (PR #242)

`src/lib/forumPermissions.ts` is the single rule set for both backends:

- Author or staff can soft-delete a post. Authors cannot delete a post a moderator has hidden. Only staff can restore.
- Locked threads reject new replies unless the actor is staff.
- Content edits set `posts.edited_at`; the thread page shows an **Edited** label. Moderation-only updates do not.
- Pin/lock/hide threads: staff only. Mark solved: author or staff. Delete thread: author or staff.
- `loadForumActor` reads the live role from the database rather than trusting the JWT role.

## Key Invariants

### Authentication

- JWT tokens stored in httpOnly cookies named `token`, 24-hour expiry.
- CSRF tokens required for state-changing requests.
- Password hashing with bcrypt.
- Role-based permissions (member, moderator, admin, suspended). Forum permission checks use the live DB role.

### Payments

- Stripe and PayPal SDK integrations exist, plus `MOCK_PAYMENTS=1` for fake intents/orders.
- Store page checkout is still simulated (no Stripe Elements or PayPal redirect).
- Webhook signature helpers exist (`STRIPE_WEBHOOK_SECRET`, `PAYPAL_WEBHOOK_ID`).
- Admin Settings → Economy tab is still "Under Construction".

### Media Generation

- `/api/media/animate` and `/api/media/poll` are implemented in the serverless API surface.
- Guardrails in place: per-user animation quota, minimum poll interval, poll budget per operation, operation TTL pruning.
- Monitoring in place via `/api/admin/observability/metrics` with latency + provider outage/quota counters.
- Keep Studio discoverability gated (`VITE_ENABLE_STUDIO`); disabled mode must keep `/studio` on Coming Soon (not redirect).

### Real-time Features

- Socket.IO with cookie-based auth parsing.
- Room-based messaging per conversation.
- CORS follows `CLIENT_ORIGIN` (same-origin vs split-origin). Voice/video buttons in the messenger are still disabled.

### Still unwired on the public site

- Sidebar **Vote** button (Store, Discord, and Stats are wired).
- Servers page **Download Network Tool** and **View Stats** buttons.

## Recurring Gotchas

- **Suspense boundaries**: Single top-level Suspense wrapping all routes causes infinite recursion during lazy loading. Use isolated Suspense per route instead.
- **Vite HMR in Codespaces**: Requires wss:// + forwarded domain + clientPort:443. Mismatch between host and socket port breaks connection.
- **Vercel preview CORS**: Setting `VITE_API_BASE_URL` to the production domain causes preview deployments to cross-origin fetch production APIs and fail CORS preflight. For same-project Vercel apps, leave it unset.
- **Environment loading**: Server expects .env.local. SQLite path detection must check DATABASE_URL format (contains '://') not endpoint.
- **Bundle size**: Lazy loading alone isn't enough - need individual Suspense boundaries per route to prevent re-render cascades.
- **Test database**: Must use separate path (tmp/test.db) and create tmp/ directory before tests run.
- **Socket.IO CORS**: Origin '*' OK for dev, but expand HTTP methods to avoid preflight failures.
- **Media polling**: Client polls /api/media/poll every 10 seconds, must handle 404/500 gracefully.
- **Node ESM imports on Vercel**: Serverless runtime fails with `ERR_MODULE_NOT_FOUND` when local imports omit emitted `.js` extensions (for example `./db.js`). This also applies to `forumPermissions.js` and other `src/lib` modules imported from `api/[...path].ts`.
- **Steam Server Code**: NightRespawnPilot's join code changes on every dedicated-server restart. A stale `NIGHTRESPAWN_PILOT_SERVER_CODE` makes Join with Steam fail even if the process is up.
- **Live status needs a Steam Web API key**: Without `STEAM_API_KEY` or `steam_api_key`, the Servers page correctly shows Unknown, not Online.
- **CI source of truth**: Treat `.github/workflows/ci.yml` as canonical for pipeline behavior (security scans, retries, coverage, artifacts) when docs diverge.
- **CI integration coverage gate**: Coverage threshold enforcement consumes existing V8 artifacts in `coverage/integration` (via `NODE_V8_COVERAGE`) rather than rerunning tests; missing or malformed output fails the gate.
- **AI docs freshness**: `scripts/ci/validate-ai-docs-dates.mjs` requires `Last reviewed: YYYY-MM-DD` in this file and in `docs/ai/BACKLOG.md`, no older than `AI_DOCS_MAX_AGE_DAYS` (14).

## Decisions Log

**2026-11-25**: Synced AI and product docs to main `25ea65c` (docs-only). Recorded the November 2026 shipped work below, corrected stale routes (`/` is Home, forums live at `/forums`), documented the live server status panel and Steam key requirements, and refreshed backlog/plan items that had already shipped. No application code changed.

**2026-11-25 (PR #245)**: Live NightRespawnPilot status on the existing Servers page. Removed the fake Network Health panel. Steam `GetServerList` by server code; Unknown when no key or Steam cannot be reached. Shared `src/lib/serverStatus.ts` and `src/lib/liveServers.ts`.

**2026-11-25 (PR #244)**: Live-site polish: nav breakpoints (hamburger uses `lg:hidden`), floating forum post menu, Home vs Forums routes, servers/store fixes, focus ring.

**2026-11-25 (PR #243)**: CodeQL sanitize test fix (fixed expected strings; `js/incomplete-multi-character-sanitization`).

**2026-11-25 (PR #242)**: Forum backend: author delete, locked-thread replies blocked server-side (staff exempt), `edited_at` plus an Edited label, shared `src/lib/forumPermissions.ts` used by both API entrypoints.

**2026-11-25 (PR #241)**: Forum post overflow menu.

**2026-11-25 (PR #240)**: Support and contact pages show content to signed-out visitors; ticket actions still require sign-in.

**2026-11 (PRs #233–#239, #236, #237)**: Steam OpenID sign-in, callback fixes, Steam display name/avatar, `/forums` route and forum author avatars, and a Vercel crash fix for an extensionless `userDisplay` import.

**2026-06-25**: Added a multi-agent architecture refactor planning scaffold under `docs/ai/refactor-plan/` (README, CONVENTIONS, and four track files: 01 unify duplicate API, 02 externalize in-memory state, 03 real-time messaging host, 04 history routing for SEO). Planning/docs only — no application code changed. Linked it from `docs/ai/BACKLOG.md` Scalability Improvements and refreshed the "Last reviewed" dates on `BACKLOG.md`/`MEMORY.md` to satisfy `scripts/ci/validate-ai-docs-dates.mjs` (max age 14 days).

**2026-06-25**: Cleaned up `.github/workflows/ci.yml` by removing a duplicated `c8 report` invocation in the integration coverage step and renumbering the flaky-test policy comment block (which had two `3)` items).

**2026-04-25**: Canonicalized Studio route behavior for April/May 2026: `/studio` remains feature-flagged with `VITE_ENABLE_STUDIO`; enabled mode renders Veo Studio and disabled mode renders Coming Soon (no redirect).

**2026-04-10**: Documented two release-process decisions to keep docs aligned with runtime behavior: (1) CI enforces an explicit integration coverage threshold from existing V8 output and (2) AI docs freshness is gated on `Last reviewed` dates.

**2026-04-09**: Reconciled AI docs with CI reality. `docs/ai/BACKLOG.md` CI/CD status now matches `.github/workflows/ci.yml`.

**2026-04-07**: Stabilized Vercel deployment behavior by:
- adding `handle: filesystem` before SPA fallback in `vercel.json` so built assets are not rewritten to HTML,
- replacing full `seedDb()` execution in serverless API bootstrap with idempotent default-auth-user initialization (`admin`/`member`) after `initDb()` in `api/[...path].ts`.

**2026-04-08**: Fixed Vercel function runtime crash by making `src/lib/seed.ts` import `./db.js` (Node ESM requires explicit file extensions at runtime after TypeScript emit).

**2026-04-08**: Product + engineering introduced backend media endpoints and Studio outage-aware UX, but retained controlled discoverability (`VITE_ENABLE_STUDIO`) pending go/no-go sign-off.

**2026-04-02**: Added configurable `VITE_API_BASE_URL` support in `src/lib/api.ts` for split frontend/backend deployments. Also added explicit 404 handling.

**2026-04-02**: Fixed infinite fetch recursion by preserving native `fetch` and avoiding self-calls after monkey-patching `window.fetch` in `src/main.tsx`.

**2026-04-02**: Fixed infinite Suspense recursion by wrapping each lazy route in isolated Suspense boundaries instead of a single top-level boundary.

**2026-04-02**: Implemented smart Vite HMR detection for GitHub Codespaces vs local dev.

**2026-04-02**: Implemented route-level code splitting with React.lazy + Suspense.

**2026-04-02**: Fixed environment loading to prioritize .env.local. SQLite now respects DATABASE_URL for test isolation.

**2026-04-02**: Added test:integration script for real server/database testing with dedicated tmp/test.db.

**2026-04-02**: Cleaned up .env.example duplicate VITE_ENABLE_STUDIO entries and added DISABLE_HMR flag for Codespaces.

**2026-04-02**: Expanded Socket.IO CORS methods to include OPTIONS, HEAD, PUT, DELETE, PATCH for better compatibility.
