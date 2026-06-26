# Staging Post-Deploy Verification

## Intent
Verify staging deployments after a successful staging deployment event or manual dispatch.

## Trigger
- `on: deployment_status` for staging success
- `on: workflow_dispatch`

## Decisions and rules
- Require `BASE_URL` from `workflow_dispatch` input or `STAGING_BASE_URL` secret.
- Require `STAGING_SMOKE_USER` and `STAGING_SMOKE_PASSWORD` secrets.
- Run `npm run smoke:postdeploy` against the configured staging target.
- On failure, upload `staging-smoke-postdeploy-logs` and fail the workflow.

## Side effects
- Emits GitHub status checks.
- Uploads smoke verification logs on failure.
- Does not change code, issues, or project boards.

## Failure modes
- Missing required staging secrets or URL.
- Smoke verification failure.

## Configuration knobs
- `STAGING_BASE_URL`
- `STAGING_SMOKE_USER`
- `STAGING_SMOKE_PASSWORD`

## Autonomy
- Level 0 — report-only verification. Does not deploy, merge, or alter production state.
