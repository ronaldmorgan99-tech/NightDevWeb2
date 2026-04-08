# Studio Support Status (April 2026)

## Final decision

- `/studio` is now **implemented behind a controlled discoverability flag** (`VITE_ENABLE_STUDIO`).
- Default state remains non-discoverable until go-live criteria are met and ownership sign-off is complete.

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

| Criterion | Go/No-Go Rule | Owner | Validation Evidence |
| --- | --- | --- | --- |
| Backend route readiness | `/api/media/animate` and `/api/media/poll` pass authenticated functional tests and reject invalid payloads with clear error codes. | Platform Engineering | Integration test logs + manual smoke checks |
| Outage fallback UX | Studio page surfaces actionable outage/quota messaging for 429/502/503 without blank/dead-end state. | Frontend Engineering | QA script capture + UI review |
| Monitoring and quotas | `/api/admin/observability/metrics` reports media latency, provider failure counters, and poll/quota guardrail events. | Platform Engineering | Metrics endpoint response snapshot |
| Operational playbook | On-call rotation and escalation path for provider outage incidents documented and acknowledged. | Platform Engineering + Admin Operations | Runbook review checklist |
| Controlled discoverability | `VITE_ENABLE_STUDIO=true` enabled only after previous criteria are complete; rollback to `false` tested. | Platform Engineering | Release checklist + rollback drill |
