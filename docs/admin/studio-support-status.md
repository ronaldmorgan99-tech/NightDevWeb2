# Studio Support Status (April/May 2026)

## Final decision

- `/studio` is **implemented behind a controlled discoverability flag** (`VITE_ENABLE_STUDIO`).
- Canonical behavior: `VITE_ENABLE_STUDIO=true` renders Veo Studio at `/studio`; `VITE_ENABLE_STUDIO=false` renders the Coming Soon page at `/studio` (no redirect).

## Why this was deferred

- Historical context: Studio was previously deferred because media endpoints and outage handling were not production ready.
- Current release introduces backend endpoints, quota guardrails, polling limits, and outage-aware UX; release remains gated by go/no-go criteria below.

## Operational ownership

| Area | Owner | Responsibilities |
| --- | --- | --- |
| Route gating and release toggles | Platform Engineering | Manage `VITE_ENABLE_STUDIO`, control `/studio` discoverability in production, and own rollback toggle execution. |
| Media provider credentials and runtime health | Platform Engineering | Provision/rotate `GEMINI_API_KEY`, monitor `/api/media/animate` and `/api/media/poll`, and respond to outage alerts. |
| Quota policy + abuse controls | Platform Engineering + Trust & Safety | Maintain per-user animation quota and poll guardrails; tune thresholds from incident feedback. |
| User/admin communications | Admin Operations | Publish support status updates, release notes, and macro responses for provider/outage incidents. |

## Relaunch criteria

| Criterion | Go/No-Go Rule | Status | Owner | Validation Evidence |
| --- | --- | --- | --- | --- |
| Backend route readiness | `/api/media/animate` and `/api/media/poll` pass authenticated functional tests and reject invalid payloads with clear error codes. | ✅ Complete (2026-04-09) | Platform Engineering | Integration test logs + manual smoke checks |
| Outage fallback UX | Studio page surfaces actionable outage/quota messaging for 429/502/503 without blank/dead-end state. | ✅ Complete (2026-04-09) | Frontend Engineering | QA script capture + UI review |
| Monitoring and quotas | `/api/admin/observability/metrics` reports media latency, provider failure counters, and poll/quota guardrail events. | ✅ Complete (2026-04-09) | Platform Engineering | Metrics endpoint response snapshot + documented thresholds |
| Operational playbook | On-call rotation and escalation path for provider outage incidents documented and acknowledged. | ✅ Complete (2026-04-09) | Platform Engineering + Admin Operations | Runbook review checklist |
| Controlled discoverability | `VITE_ENABLE_STUDIO=true` enabled only after previous criteria are complete; rollback to `false` tested. | ✅ Complete (2026-04-09) | Platform Engineering | Release checklist + rollback drill |

## Rollback drill: media enablement (`VITE_ENABLE_STUDIO=true`)

- **Owner**: Platform Engineering on-call engineer (execution) with Admin Operations incident commander (comms + stakeholder updates).
- **Trigger**:
  - `/api/media/*` provider-failure alerts (`502`) exceed critical threshold.
  - Media quota/guardrail alert (`429`) exceeds critical threshold.
  - Studio discoverability introduces sustained user-impacting errors/performance regressions.
- **Disable path**:
  1. Set `VITE_ENABLE_STUDIO=false` in production environment config.
  2. Redeploy frontend and verify `/studio` renders the Coming Soon page (non-discoverable state).
  3. Run post-deploy smoke script (`npm run smoke:postdeploy`) against production URL.
  4. Confirm `/api/settings`, `/api/auth/me`, and authenticated `/api/admin/observability/metrics` checks pass.
  5. Log rollback timestamp, owner, and re-enable criteria in incident notes.
