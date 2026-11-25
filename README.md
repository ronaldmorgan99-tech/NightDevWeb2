# NightRespawn (NightDevWeb2)

NightRespawn is the community website for the NightRespawn gaming network: forums, player profiles, a store, direct messages, and a live server browser for the **NightRespawnPilot** Unturned playtest. The usual production deployment is [night-dev-web2.vercel.app](https://night-dev-web2.vercel.app). Client routes are hash-based, so URLs look like `/#/servers` and `/#/forums`.

This repository includes production build tooling (`npm run build`), a deployment runbook, and post-deploy verification steps.

## How the website works

### Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS (cyberpunk theme), and TanStack Query. Client routing uses React Router `HashRouter`.
- **Backend:** The API exists in two places that must stay in sync:
  - [`server.ts`](server.ts) — the long-lived Node/Express app used by `npm run dev` and local/CI smoke checks.
  - [`api/[...path].ts`](api/[...path].ts) — the Vercel (and Netlify) serverless gateway used in production.
  Shared modules already used by both include [`src/lib/forumPermissions.ts`](src/lib/forumPermissions.ts) (PR #242) and [`src/lib/liveServers.ts`](src/lib/liveServers.ts) / [`src/lib/serverStatus.ts`](src/lib/serverStatus.ts) (PR #245). Other request schemas and handlers are still duplicated; see [`docs/ai/refactor-plan/01-unify-api.md`](docs/ai/refactor-plan/01-unify-api.md).
- **Database:** SQLite for local development (`DATABASE_URL` as a file path; default `nightrespawn.db`). On Vercel, Turso/LibSQL is used when `DATABASE_URL` or `TURSO_DATABASE_URL` starts with `libsql://` (with `TURSO_AUTH_TOKEN`). MySQL is supported when the URL starts with `mysql`. There is no Postgres driver.
- **Auth:** A JWT is stored in an httpOnly cookie named `token` (24-hour expiry). Same-origin cookies use `SameSite=Lax`; split-origin production cookies use `SameSite=None; Secure`. CSRF uses a double-submit cookie. Passwords are hashed with bcrypt. Visitors can also sign in with **Steam OpenID** (`GET /api/auth/steam` → `/api/auth/steam/callback`). Set `SITE_ORIGIN` to the public site URL for Steam `return_to` and realm (`APP_URL` is a fallback).
- **Realtime:** Socket.IO for direct messages, authenticated from the JWT cookie.
- **State:** React Context for session/UI state, TanStack Query for server data.

### Main pages

| Hash path | What it is |
| --- | --- |
| `/#/` | Home |
| `/#/forums` | Forum index (sectors and forums) |
| `/#/forums/:id` | Threads in a forum |
| `/#/forums/:id/new` | Create a thread |
| `/#/threads/:id` | Thread and posts |
| `/#/servers` | Server browser and live status panel |
| `/#/store` | Store |
| `/#/members`, `/#/profile`, `/#/profile/:id` | Members directory and profiles |
| `/#/messages` | Direct messages |
| `/#/news` | News feed from `/api/news` |
| `/#/support`, `/#/contact` | Support and contact. Page content is visible to signed-out visitors; opening or viewing tickets requires sign-in (PR #240). |
| `/#/help`, `/#/rules`, `/#/privacy`, `/#/terms` | Help and policy pages |
| `/#/login`, `/#/register`, `/#/settings` | Sign-in, registration, and account settings |
| `/#/discord` | Discord invite |
| `/#/studio` | Veo Studio when `VITE_ENABLE_STUDIO=true`; otherwise the Coming Soon page, with no redirect |
| `/#/admin/*` | Admin control plane (dashboard, users, moderation, forums, tags, store, integrations, analytics, support, settings) |

### Live server status

The **Live Server Status** panel sits at the top of the Servers page (`/#/servers`) and replaced the old hardcoded Network Health box (Frankfurt / London / New York / Singapore all stuck on "OK"). Shipped in [PR #245](https://github.com/ronaldmorgan99-tech/NightDevWeb2/pull/245).

- NightRespawnPilot is listed from deployment config: `NIGHTRESPAWN_PILOT_ENABLED`, `NIGHTRESPAWN_PILOT_SERVER_CODE`, and `NIGHTRESPAWN_PILOT_INTERNAL_ADDRESS`. The Server Code is a 17-digit Steam game-server ID and **changes on every dedicated-server restart**. Update `NIGHTRESPAWN_PILOT_SERVER_CODE` after a restart, or set `NIGHTRESPAWN_PILOT_ENABLED=false` to hide the card.
- Status is checked with Steam Web API `IGameServersService/GetServerList`, filtered by Unturned app id `304930` and name `NightRespawnPilot*`, then matched on the Server Code. The API key is resolved by `resolveSteamApiKey`: the `STEAM_API_KEY` environment variable first, then the admin integrations setting `steam_api_key`. No separate status-only key exists.
- **Online:** Steam lists the server, and the panel shows the real player count. **Offline:** Steam answers but the server is not listed. **Unknown / not verified:** there is no key, Steam returns an error, or the request times out after 4 seconds. The site never reports Online just because a Server Code is configured.
- Results Steam confirms are cached for 30 seconds per function instance. The NightRespawnPilot card, the stat tiles, and the sidebar Network Status widget use the same status.
- **Join with Steam** uses `steam://run/304930//+connect <code>/` when Steam confirms the server is online. If status is Unknown, the card offers **Try joining with Steam** and a not-verified warning. If Offline, it shows "Server offline" and no join button.
- A direct A2S query is not possible: this playtest server has no public game port and is reached only through Steam's relay.

### Forums

Forum permission rules live in [`src/lib/forumPermissions.ts`](src/lib/forumPermissions.ts) and are imported by both `server.ts` and `api/[...path].ts` so the two backends cannot drift (PR #242).

- Authors can soft-delete their own posts, unless a moderator has already hidden the post. Only staff can restore a deleted post.
- Replies to locked threads are rejected on the server. Moderators and admins may still reply.
- When post content actually changes, `edited_at` is set. The thread page shows an **Edited** label with the time. Hide/unhide and other moderation-only updates do not set `edited_at`.
- Pin, lock, and hide are staff-only. The thread author or staff can mark a thread solved. The thread author or staff can delete a thread.
- Checks use the user's live role from the database, not the role stored in a 24-hour JWT.
- Each post has an overflow menu (PR #241). Later polish renders that menu in a floating portal so it is not clipped (PR #244).

### Store and payments

The catalog and payment API routes exist (`/api/payments/stripe/*`, `/api/payments/paypal/*`). The Store page still **simulates** confirmation: it does not present Stripe Elements or a PayPal approval redirect. `MOCK_PAYMENTS=1` returns fake payment intents and orders. The real Stripe and PayPal SDK paths run when provider credentials are set, and webhook signature checks exist (`STRIPE_WEBHOOK_SECRET`, `PAYPAL_WEBHOOK_ID`). That is not yet a complete production checkout. The admin Settings → Economy tab is still "Under Construction".

### Admin

`/#/admin` is the operator back office: users and roles, moderation, sectors/forums, tags, store catalog, integrations (including `steam_api_key`), analytics, support tickets, and site settings. Some analytics trend badges (for example "+12%") are still hardcoded.

Known player-facing leftovers on the public site: the sidebar **Vote** button, the Servers page **Download Network Tool** button, and **View Stats** still have no click action. See [`docs/ai/incomplete-features-and-ideas-plan.md`](docs/ai/incomplete-features-and-ideas-plan.md).

## Tech Stack Overview

> **Source of truth:** See `package.json` for the exact runtime dependency set and version constraints used by this project. Local and CI Node version is **24** (`.nvmrc` / `engines.node`).

### Frontend
React 19 + TypeScript + Vite, Tailwind CSS with a custom cyberpunk theme, TanStack Query, and React Context.

### Workflow automation docs
Workflow automation is documented under `docs/workflows/` for the active GitHub Actions workflows. See `docs/workflows/WORKFLOW_INDEX.md` for the current workflow catalog.

### Backend and data
Node.js and Express, with the dual API entrypoints described above. Persistence is SQLite locally, Turso/LibSQL on Vercel, or MySQL. Socket.IO handles realtime messaging.

## Admin Stability and Navigation Hardening (April 14, 2026)

- Added null-safe rendering across admin data-dependent sections (including analytics, support, moderation, users, tags, sectors, and store) to prevent pre-load/runtime crashes when API payloads are missing or partial.
- Added explicit empty-state UI handling across admin pages so operators see informative placeholders when APIs return empty arrays or partial responses.
- Standardized admin navigation/detail routing on React Router `Link` usage and switched app routing to `HashRouter` to prevent full-page reload issues in hash-based deployments.
- Added global API client protection for `204 No Content`, `205 Reset Content`, `Content-Length: 0`, and empty-body responses to prevent JSON parsing crashes across endpoints.
- Updated admin regression test scaffolding for `globalThis.fetch`, token handling via `btoa(...)`, and assertions aligned to current moderator/admin behavior.
- Enabled `esModuleInterop` in `tsconfig.json` to improve React default import compatibility in tooling and test paths.
- Clarified known Jest/ts-jest limitation: `import.meta` handling can fail in Jest CJS transforms without ESM-aware configuration; this is a tooling constraint and separate from these runtime/admin functional fixes.

**Impact:** Resolved moderator/admin access flow failures from navigation reload mismatches and prevented runtime crashes across admin sections when upstream API data is delayed, empty, or partial.

## Current Developer Commands (source: `package.json`)

- `npm run dev` — starts the Node/Express app via `tsx server.ts`.
- `npm run lint` — runs `tsc --noEmit`.
- `npm run build` — runs `npm run check:profilepage-clean && vite build`.
- `npm run test` / `npm run test:regression` — Node test runner plus `tsx --test` coverage of unit/regression files, including forum permissions, Steam auth, sanitization, site polish, and server status.
- `npm run test:integration` — runs `regression-tests.js`.
- `npm run smoke:postdeploy` — executes post-deploy smoke checks script.
- `npm run check:serverless-imports` — verifies serverless ESM `.js` imports.

## Run Locally

**Prerequisites:** Node.js 24 (see `.nvmrc`).

1. Install dependencies:
   `npm install`
2. Create a local environment file:
   `cp .env.example .env.local`
3. Set required values in `.env.local`:
   - `JWT_SECRET` (required): secret used by auth token code in `server.ts`.
   - `NODE_ENV` (required): `development` locally, `production` in deployed environments.
   - `VITE_ENABLE_STUDIO` (recommended): set to `true` to render the Veo Studio experience at `/studio`; set to `false` (default) to keep `/studio` on the Coming Soon experience.
4. Optional but important values:
   - `SITE_ORIGIN` (or `APP_URL`): public origin used for Steam OpenID callbacks.
   - `STEAM_API_KEY`: needed for live NightRespawnPilot status and Steam persona/avatar lookup. Steam login still works without it.
   - `NIGHTRESPAWN_PILOT_SERVER_CODE`: update this whenever the playtest server restarts.
   - `VITE_API_BASE_URL`: set this when frontend and API are hosted on different domains (example: `https://api.yourdomain.com`). If omitted, frontend calls relative `/api/*` paths on the current origin.
5. Run the app:
   `npm run dev`

### Auth/CORS deployment security defaults

- **Same-origin deploy (frontend + API on one origin)**  
  Leave both `CLIENT_ORIGIN` and `VITE_API_BASE_URL` unset. Cookies are sent with `SameSite=Lax`, Socket.IO does not allow credentialed cross-origin handshakes, and the frontend calls relative `/api/*`.
- **Split-origin deploy (frontend and API on different origins)**  
  Set `CLIENT_ORIGIN` to the frontend origin (or a comma-separated list, for example `https://app.example.com,https://admin.example.com`).  
  Set `VITE_API_BASE_URL` to the API origin (for example `https://api.example.com`). In production this enables credentialed CORS responses and sets auth cookies as `SameSite=None; Secure`.
  Socket.IO CORS uses the same `CLIENT_ORIGIN` allowlist (comma-separated entries are supported).

### Security hardening status (2026-04-25)

- **Owner**: Platform Engineering.
- **Implemented**:
  - Zod-backed request validation middleware is enforced on auth/content/support write endpoints.
  - Auth endpoint rate limiting is active for login/register and session mutation endpoints.
  - User-generated text writes are sanitized server-side (profile bio, thread title, post body, support ticket subject/message, and direct message content).
- **Rollout caveat**:
  - Sanitization is currently scoped to user-generated content fields. Admin catalog/config mutation endpoints rely on schema validation but do not sanitize rich text fields yet.
  - Registration password minimum length still differs between the two API copies: `server.ts` requires 8 characters, `api/[...path].ts` requires 6. See `docs/ai/refactor-plan/01-unify-api.md`.

## Production Deployment Runbook

### Ownership
- **Owner**: Platform Engineering
- **Backup owner**: Admin Operations
- **Escalation path**: Platform Engineering on-call -> Incident Commander -> Head of Engineering

#### Quarterly ownership review checklist
- [ ] Verify owner, backup owner, and escalation path are still correct for production deploy incidents.

Use this runbook before every production deployment (Vercel, containers, or VM-based hosting).

### 1) Deployment model decision (same-origin vs split-deployment)

| Deployment model | When to choose it | `VITE_API_BASE_URL` | `CLIENT_ORIGIN` | CORS complexity |
| --- | --- | --- | --- | --- |
| Same-origin (recommended default) | Frontend and API are served from one domain/project. | Leave **unset** (frontend uses relative `/api/*`). | Leave **unset**. | Low |
| Split-deployment | Frontend and API are on different domains/infrastructure tiers. | Set to full API origin (example: `https://api.example.com`). | Set to one or more allowed frontend origins (comma-separated). | Medium/High |

### 2) Required production environment variables

| Variable | Required | What it controls | Production guidance |
| --- | --- | --- | --- |
| `NODE_ENV` | Yes | Runtime behavior and security defaults | Set to `production`. |
| `JWT_SECRET` | Yes | JWT signing/verification | Minimum 32 random characters; rotate via secret manager. |
| `DATABASE_URL` | Yes (for persistent data) | Primary production DB connection | On Vercel, use a Turso/LibSQL URL (`libsql://…`) plus `TURSO_AUTH_TOKEN`. `TURSO_DATABASE_URL` is accepted as a fallback. MySQL URLs (`mysql…`) are also supported. Do not use an ephemeral SQLite file on serverless hosts. There is no Postgres driver. |
| `CLIENT_ORIGIN` | Same-origin: No, Split: Yes | CORS + Socket.IO origin allowlist | For split deployments, set trusted HTTPS origins only. |
| `VITE_API_BASE_URL` | Same-origin: No, Split: Yes | Frontend API target | For split deployments, set canonical API URL with HTTPS. |
| `AUTH_RATE_LIMIT_CREDENTIAL_WINDOW_MS` | No | Login/register limiter window | Defaults to `600000` (10 minutes). |
| `AUTH_RATE_LIMIT_CREDENTIAL_MAX` | No | Login/register max requests per window | Defaults to `8`. |
| `AUTH_RATE_LIMIT_SESSION_WINDOW_MS` | No | Session endpoint limiter window | Defaults to `300000` (5 minutes). |
| `AUTH_RATE_LIMIT_SESSION_MAX` | No | Session endpoint max requests per window | Defaults to `30`. |
| `GEMINI_API_KEY` | Feature-gated | Gemini-backed media features | Required when `VITE_ENABLE_STUDIO=true`; keep unset when Studio stays in Coming Soon mode. |
| `SITE_ORIGIN` | Yes, if Steam sign-in is used | Public site origin for Steam OpenID `return_to` and realm | Set to the live canonical URL (example: `https://night-dev-web2.vercel.app`). `APP_URL` is accepted as a fallback. |
| `STEAM_API_KEY` | For live server status and Steam profile hydration | Steam Web API key ([steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)) | Resolved by `resolveSteamApiKey`: env var first, then the admin setting `steam_api_key`. Required for the Servers page to show Online/Offline with a real player count. Without a key, status is **Unknown / not verified**. Steam OpenID login still works without it; persona name and avatar lookup will fall back to Community XML. |
| `NIGHTRESPAWN_PILOT_ENABLED` | No (defaults to enabled) | Whether to list NightRespawnPilot on `/api/servers` | Set to `false` to hide the playtest server. |
| `NIGHTRESPAWN_PILOT_SERVER_CODE` | Yes, if the playtest server is listed | Steam relay Server Code (17-digit Steam game-server ID) | **Changes on every dedicated-server restart.** Update this after a restart or players cannot join. |
| `NIGHTRESPAWN_PILOT_INTERNAL_ADDRESS` | No | Internal address recorded on the server card | Informational only; players join by Server Code, not this address. |
| `TURSO_AUTH_TOKEN` | Yes, when using Turso | Turso/LibSQL auth token | Required with a `libsql://` database URL. |
| `STRIPE_SECRET_KEY` / `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | For live payment APIs | Payment provider credentials | Optional. Store checkout in the UI is still simulated. `MOCK_PAYMENTS=1` returns fake intents/orders. |
| `STRIPE_WEBHOOK_SECRET` / `PAYPAL_WEBHOOK_ID` | For webhook signature checks | Payment webhook verification | Used by `/api/payments/stripe/webhook` and `/api/payments/paypal/webhook`. |

### 3) Database bootstrap and seed expectations

- The app performs schema/bootstrap work at startup for fresh databases.
- Default bootstrap users are created on first run:
  - `admin` / `password`
  - `member` / `password`
- Treat bootstrap credentials as temporary only. Rotate passwords (or remove accounts) immediately after deployment.
- If bootstrap fails, expect early `500` responses on `/api/settings` or `/api/auth/*` until DB connectivity/configuration is corrected.

### 4) HTTPS + secrets management requirements

- Enforce HTTPS end-to-end in production (frontend origin, API origin, and reverse proxy/CDN).
- Store all production secrets in platform secret management (never commit to repository files).
- Minimum secrets/config controls:
  - `JWT_SECRET` must be random and unique per environment (dev/staging/prod).
  - DB credentials must be rotated on incident response and personnel changes.
  - Split-origin cookies require secure transport (`SameSite=None; Secure`) and trusted origin allowlists.
- Keep `.env.local` for local development only; never re-use local/test credentials in production.

### 5) Vite HMR and production domain guidance

- HMR is a development-only concern; do not expose or depend on HMR websocket settings in production traffic.
- In production, serve built assets from `npm run build` output and ensure asset routes are not rewritten to `index.html`.
- For development on hosted domains/codespaces, configure HMR explicitly via environment-specific settings (for example `DISABLE_HMR` and host/protocol adjustments) without carrying those overrides into production deploy config.

### 6) Post-deploy verification and health checks

Run this after each production deployment:
Run these checks immediately after every production release.

#### GitHub Actions (staging post-deploy)

Use `.github/workflows/staging-verify.yml` to validate staging automatically after successful deployment events (`deployment_status` with environment `staging`) or manually via `workflow_dispatch`.

Required secrets for this workflow:

- `STAGING_BASE_URL` (required unless manually overridden with the workflow `base_url` input)
- `STAGING_SMOKE_USER`
- `STAGING_SMOKE_PASSWORD`

The workflow executes `npm run smoke:postdeploy` against staging and uploads `staging-smoke-postdeploy-logs` when verification fails.

#### Manual CLI smoke check

```bash
BASE_URL="https://<your-production-origin>" \
SMOKE_USER="admin" \
SMOKE_PASSWORD="<smoke-user-password>" \
npm run smoke:postdeploy
```

Minimum expected results:

1. `GET /api/settings` returns `200`.
2. `GET /api/auth/me` returns `401` pre-login and `200` post-login.
3. `GET /api/admin/observability/metrics` returns `200` after auth.
4. Main JS/CSS assets return `200` with correct MIME types (no HTML fallback for module scripts).
5. At least one authenticated request is visible in observability metrics/log pipelines.

### 7) Common production failures + triage order

1. **404 errors**
   - Verify static file routing precedence (assets before SPA fallback).
   - Verify deployment artifact revision and CDN cache invalidation.
2. **500 errors**
   - Verify `JWT_SECRET`, `DATABASE_URL` (and `TURSO_AUTH_TOKEN` for Turso), `NODE_ENV`, and feature-gated secrets (`STEAM_API_KEY`, `GEMINI_API_KEY`, payment keys).
   - Review startup/bootstrap logs for DB or initialization failures.
3. **CORS/auth-cookie errors**
   - Reconfirm same-origin vs split-deployment choice.
   - In split mode, ensure `CLIENT_ORIGIN` and `VITE_API_BASE_URL` match real deployed origins.

### 8) Rollback procedure

1. Roll back application revision to last known-good deploy.
2. Roll back configuration changes separately (if needed) to isolate bad config vs bad artifact.
3. Re-run smoke checks before restoring full traffic.
4. Record incident owner, rollback timestamp, and re-release criteria in release notes/runbook.

## Vercel-specific deployment notes

- If frontend and API share one Vercel project/origin, leave `VITE_API_BASE_URL` unset to avoid cross-origin CORS drift.
- If split across projects/domains, set `VITE_API_BASE_URL` to the API origin and set `CLIENT_ORIGIN` accordingly.
- For Node ESM compatibility in serverless runtime, use emitted `.js` import extensions in runtime imports.
- If static assets load as `text/html`, adjust route ordering so filesystem assets resolve before SPA fallback rewrites.

## Studio Feature Support Status (April/May 2026)
### Vercel environment matrix (`VITE_API_BASE_URL` + API health)

| Environment | Frontend origin example | API deployment model | `VITE_API_BASE_URL` value | Validation rule | Required health checks |
| --- | --- | --- | --- | --- | --- |
| Local development | `http://localhost:5173` | Same-origin via local server proxy/runtime routes | Leave unset (recommended) | Unset defaults to same-origin `/api/*`; if set locally, allow `http://localhost:<port>` only. | `GET /api/settings` => `200`; `POST /api/auth/login` => `401` (invalid creds) and `200` (valid creds). |
| Vercel Preview | `https://<project>-git-<branch>-<user>.vercel.app` | Usually same-origin within one Vercel project | Leave unset for same-project previews. | Do **not** point preview frontend at production API origin unless intentionally running split preview testing. | `GET /api/settings` => `200`; `POST /api/auth/login` => `401` (invalid creds) and `200` (valid creds). |
| Production | `https://app.example.com` (or production Vercel domain) | Same-origin or split-origin | Same-origin: unset. Split-origin: set `https://api.example.com`. | Require HTTPS when set in production; split deploy must align with `CLIENT_ORIGIN`. | `GET /api/settings` => `200`; `POST /api/auth/login` => `401` (invalid creds) and `200` (valid creds). |

### Deployment checklist additions (preview + production)

- [ ] Confirm `VITE_API_BASE_URL` matches the selected environment model (unset for same-origin, explicit HTTPS API origin for split deployments).
- [ ] Run post-deploy smoke checks in each environment:
  - Preview: `BASE_URL="https://<preview-origin>" SMOKE_USER="..." SMOKE_PASSWORD="..." npm run smoke:postdeploy`
  - Production: `BASE_URL="https://<production-origin>" SMOKE_USER="..." SMOKE_PASSWORD="..." npm run smoke:postdeploy`
- [ ] Run `npm run check:serverless-imports` before deploy to confirm Node ESM `.js` runtime import extensions remain intact in `api/*` entrypoints.

## Studio Feature Support Status (April 2026)

- **Decision**: `/studio` is **feature-flagged** for April/May 2026 using `VITE_ENABLE_STUDIO`.
- **User experience**: Visiting `/studio` always resolves to a page: `VITE_ENABLE_STUDIO=true` renders Veo Studio; `VITE_ENABLE_STUDIO=false` renders the Coming Soon page (no redirect).
- **Operational ownership**: Platform Engineering owns route-gating and deploy behavior; Admin Operations owns support communications and release notes.
- **Enablement criteria**: keep `VITE_ENABLE_STUDIO=false` by default until media SLOs and on-call readiness criteria are met for the target environment.

## Contributing

- Pull requests must use `.github/pull_request_template.md`. Complete every checklist section before requesting review.
- If your change affects release/deploy behavior, update `docs/ai/MEMORY.md` and/or `docs/ai/BACKLOG.md` as part of the PR.
- CI validates `Last reviewed: YYYY-MM-DD` in both `docs/ai/MEMORY.md` and `docs/ai/BACKLOG.md` via `scripts/ci/validate-ai-docs-dates.mjs`.
  Keep both dates valid and no older than 14 days (`AI_DOCS_MAX_AGE_DAYS`) when opening/updating a PR.

### CI flaky-test handling policy

- **Canonical smoke checks in CI**:
  - `.github/workflows/ci.yml` (`validate` job) is the single source of truth for pull request and `main` branch local-server smoke coverage. It starts the app, waits for readiness with bounded retries, and runs `npm run smoke:postdeploy`.
  - `.github/workflows/staging-verify.yml` is the canonical post-deploy staging smoke workflow and also runs `npm run smoke:postdeploy` against the deployed environment.
  - `smoke-test.yml` has been removed to avoid duplicate smoke implementations and drift.
- **Retry policy**: CI retries integration tests once before marking the job as failed, to filter out transient environment noise.
- **Quarantine manifest**: `test/flaky-manifest.json` is the source of truth for quarantined tests. Every entry must include: `id`, `testMatch`, `owner`, `ticket`, and `expiry` (`YYYY-MM-DD`). CI fails fast if any required field is missing or malformed.
- **Detection/reporting policy**: CI scans integration test logs (`integration-test-attempt-1.log` and retry logs when present) for each manifest `testMatch` value, emits warnings when quarantined tests are hit, and uploads a per-run flaky summary artifact (`flaky-quarantine-summary`) containing JSON + Markdown rollups.
- **Exit criteria**: Keep quarantine entries only while remediation is active. Remove an entry after the owning team closes its ticket and the test is stable in normal CI execution (no quarantine matcher hits across retries for routine runs).

### CI coverage requirements

- **Unit coverage gate**: `validate` enforces minimum unit test line coverage via `COVERAGE_THRESHOLD` (default `75`).
- **Integration coverage gate**: `validate` enforces minimum integration test line coverage from `coverage/integration` via `INTEGRATION_COVERAGE_THRESHOLD` (default `50`) without rerunning integration tests.
- Canonical source: if CI behavior changes, update `.github/workflows/ci.yml` first and then sync this section.

## Product Requirements Documentation

- See `docs/product-requirements.md` for formal functional/non-functional requirements, end-to-end user journeys, module documentation outline, RBAC matrix, and moderation policy baseline.

## AI Workflow Files

The repository includes AI collaboration documents that help track context and planned work:

- `skills/release-readiness/SKILL.md` — reusable workflow guidance for release-readiness checks.
- `docs/ai/MEMORY.md` — persistent project memory and key context for future sessions.
- `docs/ai/BACKLOG.md` — prioritized backlog items and follow-up tasks.

### Contributor checklist (release/deploy behavior changes)

When touching release or deployment behavior, update these files in the same PR:

- [ ] Update `docs/ai/MEMORY.md` decisions/invariants and set `Last reviewed: YYYY-MM-DD` to today.
- [ ] Update `docs/ai/BACKLOG.md` (`Now`/`Next` priorities) and set `Last reviewed: YYYY-MM-DD` to today.
- [ ] If a `Now` item has been complete for more than 30 days, move it to `docs/ai/archive/BACKLOG_ARCHIVE.md`.
- [ ] If an old memory/backlog entry is archived, include `Archived on: YYYY-MM-DD` in the archive entry.
