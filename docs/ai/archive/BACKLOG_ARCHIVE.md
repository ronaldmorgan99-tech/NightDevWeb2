# NightDevWeb2 Backlog Archive

Last reviewed: 2026-11-25

## Archive Format

- Group archived entries by quarter using `## YYYY-QN` headings.
- Move completed `Now` items older than 30 days from `docs/ai/BACKLOG.md`.
- For each item, include:
  - Original section (for example, `Now`)
  - Completion date (`Completed: YYYY-MM-DD`)
  - `Archived on: YYYY-MM-DD`

## 2026-Q2

### Critical Bug Fixes
- **Original section**: Now
- **Completed**: 2026-04-02 (Suspense recursion and Codespaces HMR)
- **Archived on**: 2026-11-25
- **Fixes**: Suspense infinite recursion causing "Maximum call stack size exceeded" during login; Vite HMR WebSocket failures in GitHub Codespaces. Individual Suspense boundaries per route, smart HMR detection.

### Studio/Veo Shipping Decision
- **Original section**: Now
- **Completed**: 2026-04-09 (feature-flagged in April/May 2026)
- **Archived on**: 2026-11-25
- **Details**: `/studio` is canonicalized as a feature-flagged route: `VITE_ENABLE_STUDIO=true` serves Veo Studio, while `VITE_ENABLE_STUDIO=false` serves Coming Soon at `/studio` (no redirect).

### Production Media Provider Setup
- **Original section**: Now
- **Completed**: 2026-04-09
- **Archived on**: 2026-11-25
- **Details**: `/api/media/animate` + `/api/media/poll` implemented with quota/poll guardrails and observability counters. Alert thresholds documented.

### Bundle Optimization & Code Splitting
- **Original section**: Now
- **Completed**: 2026-04-02
- **Archived on**: 2026-11-25
- **Details**: Route-level lazy loading with individual Suspense boundaries.

### Environment & Configuration
- **Original section**: Now
- **Completed**: 2026-04-02
- **Archived on**: 2026-11-25
- **Details**: .env.local loading, DATABASE_URL detection, DISABLE_HMR flag, Vite HMR for Codespaces.

### Vercel Split-Deployment API Routing
- **Original section**: Now
- **Completed**: 2026-04-25
- **Archived on**: 2026-11-25
- **Details**: Filesystem-first routing, idempotent default auth-user creation, `VITE_API_BASE_URL` validation/fallback, deployment runbook expansions.

### Integration Testing
- **Original section**: Now
- **Completed**: 2026-04-02
- **Archived on**: 2026-11-25
- **Details**: `test:integration` script with dedicated tmp/test.db.

### Deployment Documentation
- **Original section**: Next / Completed (this sprint)
- **Completed**: 2026-04-10
- **Archived on**: 2026-11-25
- **Details**: README production deployment runbook. (The runbook was later updated on 2026-11-25 to add Steam, Turso, and NightRespawnPilot env vars.)

### Backend Request Validation & TS Server Checks
- **Original section**: Next / Completed (this sprint)
- **Completed**: 2026-04-10 (circa)
- **Archived on**: 2026-11-25
- **Details**: Server-side request and route parameter validation, `csurf` TypeScript declaration fixes, backend TS compilation in CI.

### CI/CD Pipeline completed checks
- **Original section**: Next / CI/CD Pipeline
- **Completed**: 2026-04-09 (verified in CI)
- **Archived on**: 2026-11-25
- **Details**: lint, build, integration tests, `npm audit`, CodeQL, coverage artifacts, integration coverage gate, one retry for integration tests. Remaining work (quarantine reporting) stays in the live backlog.
