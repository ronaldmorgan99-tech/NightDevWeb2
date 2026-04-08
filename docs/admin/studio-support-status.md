# Studio Support Status (April 2026)

## Final decision

- `/studio` is **not shipping** in this release cycle.
- The frontend route is intentionally non-discoverable and redirects users to `/`.

## Why this was deferred

- Production media endpoints (`/api/media/animate`, `/api/media/poll`) are not yet available in the deployed API surface.
- Operational readiness work (provider outage UX, runbook, monitoring ownership) is incomplete.

## Operational ownership

| Area | Owner | Responsibilities |
| --- | --- | --- |
| Route gating and release toggles | Platform Engineering | Keep `/studio` non-discoverable, enforce redirect behavior, and gate relaunch behind validated backend readiness. |
| Provider credentials and runtime health | Platform Engineering | Provision `GEMINI_API_KEY` only during relaunch, validate endpoint behavior, and add runtime monitors/alerts. |
| User/admin communications | Admin Operations | Publish support status updates, release notes, and macro responses for "where is Studio" inquiries. |

## Relaunch criteria

1. `/api/media/animate` and `/api/media/poll` implemented and validated in production-like environment.
2. User-facing outage fallback messaging implemented for provider/API downtime.
3. `GEMINI_API_KEY` provisioning documented with rollback and rotation steps.
4. Runbook ownership confirmed between Platform Engineering and Admin Operations.
