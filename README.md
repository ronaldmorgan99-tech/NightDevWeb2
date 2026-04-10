<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/760e6625-d344-4b21-a27e-ffbef0bdf8e6

## Tech Stack Overview

> **Source of truth:** See `package.json` for the exact runtime dependency set and version constraints used by this project.

### Framework: React 19 + TypeScript + Vite
The frontend is built with **React 19** for modern component-based UI development, **TypeScript** for static typing and safer refactors, and **Vite** for fast local development and optimized production builds.

### Backend: Express.js + Node.js (via `server.ts`)
The server runs on **Node.js** and uses **Express.js** to handle API routes, middleware, and server-side logic. The main backend entry point is `server.ts`, which centralizes server configuration and startup behavior.

### Database: SQLite (local) + MySQL (production)
The data layer supports both runtime environments:
- **SQLite** for local development (simple setup, file-based storage, ideal for quick iteration).
- **MySQL** for production (robust, scalable, and better suited for deployed workloads).

This allows developers to get started quickly while keeping production infrastructure reliable.

### Real-time: Socket.IO integration
The app includes **Socket.IO** for real-time, bidirectional communication between client and server. This is useful for features like live updates, notifications, presence, or collaborative interactions.

### Styling: Tailwind CSS with custom cyberpunk theme
UI styling is built with **Tailwind CSS**, enabling utility-first styling and rapid UI implementation. A **custom cyberpunk theme** is layered on top to provide a distinct visual identity and consistent design language across the app.

### State Management: React Context API + TanStack React Query
State is managed using a combination of:
- **React Context API** for shared app-level/client state (such as UI state and global settings).
- **TanStack React Query** for async server state (fetching, caching, background refetching, and synchronization).

Together, they keep local UI state and remote API data organized, performant, and maintainable.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Create a local environment file:
   `cp .env.example .env.local`
3. Set required values in `.env.local`:
   - `JWT_SECRET` (required): secret used by auth token code in `server.ts`.
   - `NODE_ENV` (required): `development` locally, `production` in deployed environments.
   - `VITE_ENABLE_STUDIO` (recommended): set to `true` to enable `/studio`, or `false` to show the coming soon page.
   - `VITE_ENABLE_STUDIO` is currently ignored in this release because `/studio` is not shipping in the April 2026 cycle.
4. Optional values:
   - `APP_URL`: used in hosted environments for callback/self links.
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

## Vercel Deployment Notes
## Production Deployment Checklist

Use this section before deploying to any production environment (Vercel, container platform, VM, etc.).

- `JWT_SECRET` (required, minimum 32 characters)
- `NODE_ENV=production`
- `DATABASE_URL` (recommended for persistent production data; if omitted on Vercel, SQLite falls back to `/tmp` and data is ephemeral)
- `CLIENT_ORIGIN` (required for split-origin deployments; comma-separated allowlist of trusted frontend origins)
- `AUTH_RATE_LIMIT_CREDENTIAL_WINDOW_MS` (optional; default `600000` / 10 minutes)
- `AUTH_RATE_LIMIT_CREDENTIAL_MAX` (optional; default `8` requests per window for login/register)
- `AUTH_RATE_LIMIT_SESSION_WINDOW_MS` (optional; default `300000` / 5 minutes)
- `AUTH_RATE_LIMIT_SESSION_MAX` (optional; default `30` requests per window for `auth/me` + auth session endpoints)

### Expected default logins (fresh database)

- `admin` / `password`
- `member` / `password`

These users are ensured at API bootstrap for serverless deployments.

### Common production errors

- **`Failed to load module script ... MIME type text/html`**  
  Usually means static assets were rewritten to `index.html`. Confirm Vercel routes preserve filesystem assets before SPA fallback.

- **`/api/* 500` on first load/login**  
  Usually indicates missing/invalid environment variables (especially `JWT_SECRET`) or database initialization failure in the serverless runtime.
- If frontend and API are deployed on the same Vercel project/domain, leave `VITE_API_BASE_URL` unset so the client uses relative `/api/*` requests and avoids cross-origin CORS issues.
- Set `VITE_API_BASE_URL` only when the frontend and backend are hosted on different domains.
- For Node ESM runtime compatibility in Vercel serverless functions, local runtime imports must include `.js` file extensions after TypeScript emit (for example `./db.js`).
- Do **not** provision `GEMINI_API_KEY` for this cycle. Media generation endpoints are intentionally not exposed to users in production until Studio support is re-opened.

## Studio Feature Support Status (April 2026)

- **Decision**: `/studio` is **not shipping** this cycle.
- **User experience**: Visiting `/studio` now redirects to `/` to avoid dead-end “coming soon” flows.
- **Operational ownership**: Platform Engineering owns route-gating and deploy behavior; Admin Operations owns support communications and release notes.
- **Re-open criteria**: backend media routes implemented and validated (`/api/media/animate`, `/api/media/poll`), provider outage fallback UX, and production runbook updates.
### 1) Required environment variables

| Variable | Required | What it controls | Production expectation |
| --- | --- | --- | --- |
| `JWT_SECRET` | Yes | Signing/verification for auth JWTs. | Use a long random value (minimum 32 chars). Rotating this logs out existing sessions. |
| `DATABASE_URL` | Yes (for persistent production) | Primary production database connection string. | Point to a persistent managed DB. Avoid ephemeral local files for production. |
| `NODE_ENV` | Yes | Runtime mode and production behavior. | Set to `production`. |
| `CLIENT_ORIGIN` | Depends on deployment model | CORS + Socket.IO allowlist for trusted frontend origins. | **Unset** for same-origin deploys; **set** to one or more frontend origins for split-origin deploys. |
| `VITE_API_BASE_URL` | Depends on deployment model | Frontend API target for `/api/*` calls. | **Unset** for same-origin deploys; **set** for split-domain deploys (for example `https://api.example.com`). |
| `AUTH_RATE_LIMIT_CREDENTIAL_WINDOW_MS` | No | Auth credential endpoint limiter window in ms. | Default `600000` (10 minutes). |
| `AUTH_RATE_LIMIT_CREDENTIAL_MAX` | No | Max credential requests allowed per IP within credential window. | Default `8` requests (login/register). |
| `AUTH_RATE_LIMIT_SESSION_WINDOW_MS` | No | Auth session endpoint limiter window in ms. | Default `300000` (5 minutes). |
| `AUTH_RATE_LIMIT_SESSION_MAX` | No | Max auth session requests allowed per IP within session window. | Default `30` requests (`/api/auth/me`, logout/session checks). |
| `GEMINI_API_KEY` | Required only if AI media/features are enabled | Access key for Gemini-powered functionality. | Set in production if those features are enabled; otherwise leave unset/disabled. |

### 2) Choose deployment model (same-origin vs split-deployment)

| Deployment model | When to choose it | `VITE_API_BASE_URL` | CORS complexity | Example |
| --- | --- | --- | --- | --- |
| Same-origin (recommended default) | Frontend and API are served from the same domain/project. | Leave **unset** so client uses relative `/api/*`. | Low | App + API on `https://app.example.com`, client calls `https://app.example.com/api/*`. |
| Split-deployment | Frontend and API are deployed to different domains or infrastructure tiers. | Set to full API origin, e.g. `https://api.example.com`. | Higher (must configure allowed origins/credentials). | Frontend at `https://www.example.com`, API at `https://api.example.com`. |

#### Explicit examples

- **Same-origin example**:  
  `NODE_ENV=production`, `JWT_SECRET=<strong-random-secret>`, `DATABASE_URL=<persistent-db-url>`, and **no** `CLIENT_ORIGIN`/`VITE_API_BASE_URL`.
- **Split-deployment example**:  
  `NODE_ENV=production`, `JWT_SECRET=<strong-random-secret>`, `DATABASE_URL=<persistent-db-url>`, `CLIENT_ORIGIN=https://app.example.com,https://admin.example.com`, `VITE_API_BASE_URL=https://api.example.com`.

### 3) Database bootstrap and seed expectations (fresh deployment)

- On a fresh database, the app initializes required schema/tables at startup/bootstrap.
- Default development accounts are seeded for first-run access:
  - `admin` / `password`
  - `member` / `password`
- Treat these as bootstrap credentials only; change passwords or replace/remove seeded users immediately in production.
- If bootstrap fails, expect early `/api/*` errors (typically `500`) during first login/settings requests.

### 4) Post-deploy verification checklist

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

Scripted smoke validation covers:

1. `GET /api/settings` returns `200`.
2. `GET /api/auth/me` returns `401` before login and `200` after login.
3. Authenticated flow check: `GET /api/admin/observability/metrics` returns `200` after login.
4. Static asset integrity:
   - Main JS/CSS bundles return `200` (not HTML fallback).
   - Browser console has no MIME-type errors such as `text/html` for module scripts.
5. Telemetry smoke check:
   - Trigger one authenticated API request and verify it appears in observability metrics/logs.
   - Confirm frontend telemetry delivery via `/api/telemetry/client-error` (or error tracking webhook in production).

### 5) Rollback and incident notes (404/500/CORS regressions)

If a deployment regresses, check in this order first:

1. **404 regressions**
   - Verify static file routing precedence (assets must resolve before SPA fallback to `index.html`).
   - Confirm build artifacts were uploaded and cache/CDN is serving the latest revision.
2. **500 regressions**
   - Validate runtime env vars (`JWT_SECRET`, `DATABASE_URL`, `NODE_ENV`, and `GEMINI_API_KEY` if applicable).
   - Check DB connectivity/migrations/bootstrap logs for startup failures.
3. **CORS regressions**
   - Confirm whether deployment is same-origin or split-deployment.
   - For split deployments, verify `VITE_API_BASE_URL` matches the real API origin and server CORS allowlist includes the frontend origin.

Rollback guidance:

- Keep the previous known-good build and environment config versioned.
- If incident impact is active, first rollback app version, then rollback config changes independently to isolate cause.
- After rollback, re-run the post-deploy verification checklist before restoring traffic.

#### Studio media enablement rollback drill (`VITE_ENABLE_STUDIO=true`)

- **Owner**: Platform Engineering primary on-call (execution) + Admin Operations incident commander (communications).
- **Trigger**: Any of these after Studio discoverability is enabled:
  - Media provider failure alert fires (`/api/media/*` 502 surge).
  - Quota/guardrail alert fires at critical threshold (`429` surge).
  - Studio route causes sustained API degradation or user-facing outage.
- **Disable path**:
  1. Set `VITE_ENABLE_STUDIO=false` in production environment configuration.
  2. Redeploy/restart the frontend artifact so `/studio` is no longer discoverable.
  3. Verify `/studio` redirects/returns non-discoverable state as expected.
  4. Run `npm run smoke:postdeploy` against production and confirm `/api/settings`, `/api/auth/me`, and authenticated metrics flow are healthy.
  5. Record rollback timestamp, incident owner, and next re-enable criteria in release notes/runbook.

## Contributing

- Pull requests must use `.github/pull_request_template.md`. Complete every checklist section before requesting review.
- If your change affects release/deploy behavior, update `docs/ai/MEMORY.md` and/or `docs/ai/BACKLOG.md` as part of the PR.

### CI flaky-test handling policy

- **Retry policy**: CI retries integration tests once before marking the job as failed, to filter out transient environment noise.
- **Quarantine manifest**: `test/flaky-manifest.json` is the source of truth for quarantined tests. Every entry must include: `id`, `testMatch`, `owner`, `ticket`, and `expiry` (`YYYY-MM-DD`). CI fails fast if any required field is missing or malformed.
- **Detection/reporting policy**: CI scans integration test logs (`integration-test-attempt-1.log` and retry logs when present) for each manifest `testMatch` value, emits warnings when quarantined tests are hit, and uploads a per-run flaky summary artifact (`flaky-quarantine-summary`) containing JSON + Markdown rollups.
- **Exit criteria**: Keep quarantine entries only while remediation is active. Remove an entry after the owning team closes its ticket and the test is stable in normal CI execution (no quarantine matcher hits across retries for routine runs).

### CI coverage requirements

- **Unit coverage gate**: `validate` enforces minimum unit test line coverage via `COVERAGE_THRESHOLD` (default `75`).
- **Integration coverage gate**: `validate` enforces minimum integration test line coverage from `coverage/integration` via `INTEGRATION_COVERAGE_THRESHOLD` (default `65`) without rerunning integration tests.

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
