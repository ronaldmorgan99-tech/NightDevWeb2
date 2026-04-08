# Observability, Alert Thresholds, and Incident Triage

## Scope
This document defines the baseline monitoring/alerting for:

- Auth endpoints (`/api/auth/*`)
- Settings endpoints (`/api/settings`, `/api/admin/settings`)
- Media endpoints (`/api/media/*`)
- Socket.IO connection lifecycle

## Signals

| Area | Signal | Source |
| --- | --- | --- |
| Auth/settings/media API | Structured request logs with `requestId`, status, duration, and optional user id | `server.ts` request logging middleware |
| Media jobs | Latency aggregates for `/api/media/animate` and `/api/media/poll` | `/api/admin/observability/metrics` |
| Socket lifecycle | Auth failures, total connects/disconnects, active connections, socket errors | `/api/admin/observability/metrics` + structured logs |
| Runtime exceptions | Backend and frontend exception capture | Webhook-based error tracking + server telemetry endpoint |

## Initial Alert Thresholds

| Alert | Condition | Severity | Suggested action |
| --- | --- | --- | --- |
| Auth failure spike | `socket.authFailures` or `/api/auth/*` 401/403 responses > 50 in 5 min | P2 | Verify auth cookies/JWT secret/session rollout issues |
| Media latency degradation | `/api/media/animate` avg latency > 8,000ms for 10 min | P2 | Check Gemini provider health and job queue behavior |
| Media hard failures | `/api/media/*` 5xx rate > 5% for 10 min | P1 | Check provider credentials and API error details |
| Socket instability | `connectionErrors` > 20 in 5 min or disconnect/connect ratio > 1.5 for 10 min | P2 | Inspect network disruptions and recent deploys |
| Unhandled exception burst | > 10 backend or frontend unhandled exceptions in 5 min | P1 | Triage latest release and stack traces immediately |

## Lightweight Incident Triage Runbook

1. **Acknowledge and classify**
   - Assign severity (P1/P2/P3).
   - Mark start time and impacted area (auth/settings/media/socket/frontend).
2. **Scope impact quickly (5-10 min)**
   - Review structured logs for affected endpoints and `requestId` patterns.
   - Check `/api/admin/observability/metrics` for media/socket trend shifts.
   - Review webhook/error tracker events and newest stack traces.
3. **Stabilize**
   - If caused by deploy: rollback or disable the feature flag/config.
   - If provider issue: return degraded response with clear client message.
4. **Mitigate + communicate**
   - Post status in team channel every 15 minutes while active.
   - Document temporary mitigation and customer-facing impact.
5. **Close and follow-up**
   - Record root cause, trigger, and corrective actions.
   - Add a regression test or monitor adjustment before closing.

## Notes
- Keep thresholds conservative first; tune after one week of production data.
- Use `x-request-id` to correlate frontend reports with backend logs.
