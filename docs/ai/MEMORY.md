# NightDevWeb2 Memory

Last reviewed: 2026-04-10

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

### Frontend Routes (src/App.tsx)
- `/` - ForumsPage (main forum listing)
- `/forums/:id` - ForumViewPage (threads in forum)
- `/threads/:id` - ThreadViewPage (thread with posts)
- `/profile/:id` - ProfilePage (user profiles)
- `/store` - StorePage (premium features)
- `/admin/*` - AdminLayout with various admin pages
- `/studio` - Controlled route: enabled only when `VITE_ENABLE_STUDIO=true`, otherwise remains non-discoverable

### Server Structure (server.ts)
- Express app with SQLite database
- JWT authentication with httpOnly cookies
- CSRF protection via double-submit pattern
- Socket.IO for real-time messaging
- Media APIs: `/api/media/animate` + `/api/media/poll` (Google Gemini integration)

### Database Layer (src/lib/db.ts)
- SQLite with migrations
- User management, forums, threads, posts
- Payment processing (PayPal integration)
- Settings and permissions

## Key Invariants

### Authentication
- JWT tokens stored in httpOnly cookies
- CSRF tokens required for state-changing requests
- Password hashing with bcrypt
- Role-based permissions (user, moderator, admin)

### Payments
- PayPal SDK integration
- Premium features gated by user.subscription_status
- Secure webhook handling

### Media Generation
- `/api/media/animate` and `/api/media/poll` are implemented in the serverless API surface.
- Guardrails in place: per-user animation quota, minimum poll interval, poll budget per operation, operation TTL pruning.
- Monitoring in place via `/api/admin/observability/metrics` with latency + provider outage/quota counters.
- Keep Studio discoverability gated (`VITE_ENABLE_STUDIO`) until go/no-go owners sign off.

### Real-time Features
- Socket.IO with cookie-based auth parsing
- Room-based messaging per thread
- CORS configured for development

## Recurring Gotchas

- **Suspense boundaries**: Single top-level Suspense wrapping all routes causes infinite recursion during lazy loading. Use isolated Suspense per route instead.
- **Vite HMR in Codespaces**: Requires wss:// + forwarded domain + clientPort:443. Mismatch between host and socket port breaks connection.
- **Vercel preview CORS**: Setting `VITE_API_BASE_URL` to the production domain causes preview deployments to cross-origin fetch production APIs and fail CORS preflight. For same-project Vercel API routes, leave `VITE_API_BASE_URL` unset.
- **Environment loading**: Server expects .env.local. SQLite path detection must check DATABASE_URL format (contains '://') not endpoint.
- **Bundle size**: Lazy loading alone isn't enough - need individual Suspense boundaries per route to prevent re-render cascades.
- **Test database**: Must use separate path (tmp/test.db) and create tmp/ directory before tests run.
- **Socket.IO CORS**: Origin '*' OK for dev, but expand HTTP methods to avoid preflight failures.
- **Media polling**: Client polls /api/media/poll every 10 seconds, must handle 404/500 gracefully.
- **Node ESM imports on Vercel**: Serverless runtime fails with `ERR_MODULE_NOT_FOUND` when local imports omit emitted `.js` extensions (for example `./db.js`).
- **CI source of truth**: Treat `.github/workflows/ci.yml` as canonical for pipeline behavior (security scans, retries, coverage, artifacts) when docs diverge.
- **CI integration coverage gate**: Coverage threshold enforcement consumes existing V8 artifacts in `coverage/integration` (via `NODE_V8_COVERAGE`) rather than rerunning tests; missing or malformed V8 output will fail the gate.

## Decisions Log

**2026-04-10 (Latest)**: Documented two release-process decisions to keep docs aligned with runtime behavior: (1) CI enforces an explicit integration coverage threshold from existing V8 output in `coverage/integration` in `.github/workflows/ci.yml`; (2) `README.md` now serves as the consolidated production deployment runbook/checklist for environment requirements, verification, and rollback guidance.
**2026-04-09 (Latest)**: Reconciled AI docs with CI reality. `docs/ai/BACKLOG.md` CI/CD status now matches `.github/workflows/ci.yml` (dependency scan, CodeQL SAST, coverage artifacts, retry + failure artifact behavior marked complete; only true gaps remain).
**2026-04-07 (Latest)**: Stabilized Vercel deployment behavior by:
- adding `handle: filesystem` before SPA fallback in `vercel.json` so built assets are not rewritten to HTML,
- replacing full `seedDb()` execution in serverless API bootstrap with idempotent default-auth-user initialization (`admin`/`member`) after `initDb()` in `api/[...path].ts`.
**2026-04-08 (Latest)**: Fixed Vercel function runtime crash by making `src/lib/seed.ts` import `./db.js` (Node ESM requires explicit file extensions at runtime after TypeScript emit). Added deployment note to keep `VITE_API_BASE_URL` unset when frontend/API share the same Vercel origin to avoid preview CORS failures.
**2026-04-08 (Latest)**: Product + engineering introduced backend media endpoints and Studio outage-aware UX, but retained controlled discoverability (`VITE_ENABLE_STUDIO`) pending go/no-go sign-off from Platform Engineering and Admin Operations.

**2026-04-02 (Latest)**: Added configurable `VITE_API_BASE_URL` support in `src/lib/api.ts` for split frontend/backend deployments (e.g., Vercel frontend + external API). Also added explicit 404 guidance for `/api/*` failures to surface deployment misconfiguration clearly.

**2026-04-02**: Fixed infinite fetch recursion by preserving native `fetch` and avoiding self-calls after monkey-patching `window.fetch` in `src/main.tsx`.

**2026-04-02**: Fixed infinite Suspense recursion by wrapping each lazy route in isolated Suspense boundaries instead of single top-level boundary. This prevents cascading state changes during navigation and solves "Maximum call stack size exceeded" during login.

**2026-04-02**: Implemented smart Vite HMR detection for GitHub Codespaces vs local dev. Uses secure WebSocket (wss://) with forwarded domain for Codespaces, standard ws:// for local. Fixes WebSocket connection failures.

**2026-04-02**: Implemented route-level code splitting with React.lazy + Suspense to reduce bundle size from 1.17MB to multiple <500kB chunks.

**2026-04-02**: Fixed environment loading to prioritize .env.local as per README instructions. SQLite now respects DATABASE_URL for test isolation.

**2026-04-02**: Added test:integration script for real server/database testing with dedicated tmp/test.db. Uses environment variable detection to avoid MySQL URL parsing for local SQLite.

**2026-04-02**: Cleaned up .env.example duplicate VITE_ENABLE_STUDIO entries and added DISABLE_HMR flag for Codespaces.

**2026-04-02**: Expanded Socket.IO CORS methods to include OPTIONS, HEAD, PUT, DELETE, PATCH for better compatibility.
