<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Build and Launch Readiness

✅ **Status: This app is ready for build and launch.**

The project includes production build tooling (`npm run build`), deployment runbook guidance, and post-deploy verification steps to support a launch workflow.

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

## Admin Stability and Navigation Hardening (April 14, 2026)

- Added null-safe rendering across admin data-dependent sections (including analytics, support, moderation, users, tags, sectors, and store) to prevent pre-load/runtime crashes when API payloads are missing or partial.
- Added explicit empty-state UI handling across admin pages so operators see informative placeholders when APIs return empty arrays or partial responses.
- Standardized admin navigation/detail routing on React Router `Link` usage and switched app routing to `HashRouter` to prevent full-page reload issues in hash-based deployments.
- Added global API client protection for `204 No Content`, `205 Reset Content`, `Content-Length: 0`, and empty-body responses to prevent JSON parsing crashes across endpoints.
- Updated admin regression test scaffolding for `globalThis.fetch`, token handling via `btoa(...)`, and assertions aligned to current moderator/admin behavior.
- Enabled `esModuleInterop` in `tsconfig.json` to improve React default import compatibility in tooling and test paths.
- Clarified known Jest/ts-jest limitation: `import.meta` handling can fail in Jest CJS transforms without ESM-aware configuration; this is a tooling constraint and separate from these runtime/admin functional fixes.

**Impact:** Resolved moderator/admin access flow failures from navigation reload mismatches and prevented runtime crashes across admin sections when upstream API data is delayed, empty, or partial.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Create a local environment file:
   `cp .env.example .env.local`
3. Set required values in `.env.local`:
   - `JWT_SECRET` (required): secret used by auth token code in `server.ts`.
   - `NODE_ENV` (required): `development` locally, `production` in deployed environments.
   - `VITE_ENABLE_STUDIO` (recommended): set to `true` to render the Veo Studio experience at `/studio`; set to `false` (default) to keep `/studio` on the Coming Soon experience.
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
| `DATABASE_URL` | Yes (for persistent data) | Primary production DB connection | Use managed MySQL/Postgres-equivalent persistent DB URL; avoid ephemeral files. |
| `CLIENT_ORIGIN` | Same-origin: No, Split: Yes | CORS + Socket.IO origin allowlist | For split deployments, set trusted HTTPS origins only. |
| `VITE_API_BASE_URL` | Same-origin: No, Split: Yes | Frontend API target | For split deployments, set canonical API URL with HTTPS. |
| `AUTH_RATE_LIMIT_CREDENTIAL_WINDOW_MS` | No | Login/register limiter window | Defaults to `600000` (10 minutes). |
| `AUTH_RATE_LIMIT_CREDENTIAL_MAX` | No | Login/register max requests per window | Defaults to `8`. |
| `AUTH_RATE_LIMIT_SESSION_WINDOW_MS` | No | Session endpoint limiter window | Defaults to `300000` (5 minutes). |
| `AUTH_RATE_LIMIT_SESSION_MAX` | No | Session endpoint max requests per window | Defaults to `30`. |
| `GEMINI_API_KEY` | Feature-gated | Gemini-backed media features | Required when `VITE_ENABLE_STUDIO=true`; keep unset when Studio stays in Coming Soon mode. |

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
   - Verify `JWT_SECRET`, `DATABASE_URL`, `NODE_ENV`, and feature-gated secrets.
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
- **Integration coverage gate**: `validate` enforces minimum integration test line coverage from `coverage/integration` via `INTEGRATION_COVERAGE_THRESHOLD` (default `65`) without rerunning integration tests.
- Canonical source: if CI behavior changes, update `.github/workflows/ci.yml` first and then sync this section.

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
