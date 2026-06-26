# CI Pipeline

## Intent
Validate pull requests and `main` branch changes with lint, build, tests, security scans, and docs freshness checks.

## Trigger
- `on: pull_request`
- `on: push` to `main`

## Decisions and rules
- Run dependency vulnerability scan via `npm audit --audit-level=high`.
- Run CodeQL SAST analysis.
- Run `npm run lint` and `npm run build`.
- Start a local production server and verify `/api/settings` is ready.
- Run `npm run smoke:postdeploy` against the local server.
- If integration tests fail, retry once before failing the job.
- Enforce unit coverage threshold and integration line coverage threshold from V8 artifacts.
- Validate AI doc review dates with `AI_DOCS_MAX_AGE_DAYS`.

## Side effects
- Emits GitHub status checks.
- Uploads coverage artifacts and failure logs.
- Does not modify issues, labels, or project boards.

## Failure modes
- Build or compile failure.
- Local smoke server fails to become ready.
- Smoke verification fails.
- Integration test failure after retry.
- Coverage gate failure.
- Stale AI docs review dates.

## Configuration knobs
- `AI_DOCS_MAX_AGE_DAYS`
- `COVERAGE_THRESHOLD`
- `INTEGRATION_COVERAGE_THRESHOLD`

## Autonomy
- Level 0 — report-only. Human review and merge remain required by branch protection.
