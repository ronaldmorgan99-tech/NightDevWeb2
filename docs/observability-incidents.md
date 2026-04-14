# Observability, Dashboards, Alert Thresholds, and Incident Triage

## Ownership
- **Owner**: Platform Engineering
- **Backup owner**: Admin Operations
- **Escalation path**: Platform Engineering on-call -> Incident Commander -> Head of Engineering

### Quarterly ownership review checklist
- [ ] Confirm observability/incident ownership and escalation contacts remain accurate.

## Scope
This document defines baseline monitoring and incident response for:

- API reliability and latency (`/api/*`)
- Auth flows (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`)
- Media endpoints (`/api/media/*`)
- Socket.IO connection lifecycle + room load
- Frontend route-level and API-level exceptions

## Signals

| Area | Signal | Source |
| --- | --- | --- |
| API reliability | Request counts, status buckets, route latency, error rate | `GET /api/admin/observability/metrics` (`api` block) + structured `http.request` logs |
| Auth flows | Register/login attempts, success/failure, `/api/auth/me` unauthorized checks | `GET /api/admin/observability/metrics` (`auth` block) |
| Media jobs | Latency aggregates for `/api/media/animate` and `/api/media/poll` | `GET /api/admin/observability/metrics` (`media` block) |
| Socket lifecycle | Auth failures, connect/disconnect/error counts, active connections | `GET /api/admin/observability/metrics` (`socket` block) + structured logs |
| Socket room load | Room count, room memberships, max room occupancy | `GET /api/admin/observability/metrics` (`socket` block) |
| Runtime exceptions | Backend route-level exceptions + frontend route/API exceptions | Error tracking webhook + `/api/telemetry/client-error` |

## Dashboard Definitions

| Dashboard | Panels |
| --- | --- |
| **API Health** | `api.totalRequests`, `api.errorRatePct`, `api.statusCounts.5xx`, top `api.byRoute[*].latency.avgMs`, top `api.byRoute[*].errorRatePct` |
| **Auth Funnel** | `auth.registerAttempts/success/failure`, `auth.loginAttempts/success/failure`, `auth.meUnauthorized` |
| **Realtime Socket Health** | `socket.connections`, `socket.disconnects`, `socket.connectionErrors`, `socket.activeConnections`, `socket.authFailures`, `socket.roomCount`, `socket.roomMemberships`, `socket.maxRoomOccupancy` |
| **Frontend + Backend Exceptions** | Count by `payload.type` (`frontend.api_exception`, `window.error`, `react.error_boundary`) and backend `exception.captured` trend |

## Initial Alert Thresholds

| Alert | Condition | Severity | Suggested action |
| --- | --- | --- | --- |
| API 5xx rate spike | `api.errorRatePct > 5%` for 10 minutes or `statusCounts.500+` > 25 in 5 minutes | P1 | Triage top failing routes, rollback recent changes if needed |
| API latency degradation | Any critical route `api.byRoute[*].latency.avgMs > 1200ms` for 10 minutes | P2 | Check DB load, recent query changes, and upstream provider health |
| Login failures surge | `auth.loginFailure / auth.loginAttempts > 0.2` for 10 minutes | P1 | Validate auth cookies, JWT secret, and rate limit behavior |
| Registration failures surge | `auth.registerFailure / auth.registerAttempts > 0.15` for 10 minutes | P2 | Validate schema changes, DB writes, and email side-effects |
| `/api/auth/me` unauthorized spike | `auth.meUnauthorized > 100` in 10 minutes | P2 | Investigate token expiry, cookie domain/sameSite settings |
| Socket instability | `socket.connectionErrors > 20` in 5 minutes OR `disconnects / connections > 1.5` for 10 minutes | P2 | Inspect network quality and deployment events |
| Socket room overload | `socket.maxRoomOccupancy > 1000` OR `socket.roomMemberships` growth > 3x in 10 minutes | P2 | Check for runaway subscriptions and room cleanup bugs |
| Exception burst | Frontend + backend unhandled exceptions > 10 in 5 minutes | P1 | Triage recent deploy and impacted routes/pages |

## Media Counter Alert Thresholds (`/api/admin/observability/metrics`)

Use these thresholds to wire paging alerts before enabling Studio discoverability in production. The endpoint exposes media latency directly in `media.*.avgMs/maxMs` and exposes media error/quota behavior via API route status counters under `api.byRoute` and `api.statusCounts`.

| Counter type | Metric path(s) | Trigger | Severity | Owner |
| --- | --- | --- | --- | --- |
| Media latency warning | `media['/api/media/animate'].avgMs`, `media['/api/media/poll'].avgMs` | `animate.avgMs > 12000` **or** `poll.avgMs > 3500` for 10 minutes | P2 | Platform Engineering |
| Media latency critical | `media['/api/media/animate'].maxMs`, `media['/api/media/poll'].maxMs` | `animate.maxMs > 45000` **or** `poll.maxMs > 10000` for 5 minutes | P1 | Platform Engineering |
| Media error rate warning | `api.byRoute['/api/media/animate'].errorRatePct`, `api.byRoute['/api/media/poll'].errorRatePct` | Either route `errorRatePct > 5%` with at least 20 requests in 10 minutes | P2 | Platform Engineering |
| Media provider failure critical | `api.statusCounts['502']` + media route error-rate trend | `502` responses from media routes > 15 in 5 minutes | P1 | Platform Engineering + Admin Operations |
| Media quota/guardrail warning | `api.statusCounts['429']`, `api.byRoute['/api/media/animate'].errors`, `api.byRoute['/api/media/poll'].errors` | `429` responses on media routes > 30 in 10 minutes | P2 | Platform Engineering + Trust & Safety |
| Media quota/guardrail critical | same as above | `429` responses on media routes > 75 in 10 minutes, or >25% of media traffic | P1 | Platform Engineering + Trust & Safety |

## Incident Runbook

1. **Acknowledge and classify (0-5 min)**
   - Assign severity (P1/P2/P3) and incident commander.
   - Capture exact start timestamp and impacted surface (API/auth/socket/frontend).
2. **Scope impact (5-10 min)**
   - Check `GET /api/admin/observability/metrics` for deviations.
   - Pull recent structured logs by `requestId`, route, and status.
   - Review error tracker payloads for stack traces and affected route/page.
3. **Stabilize service (10-20 min)**
   - Roll back recent deploy/config if correlation is clear.
   - Disable/feature-flag problematic paths if rollback is not immediate.
   - For provider incidents, serve degraded but explicit error responses.
4. **Mitigate and communicate (ongoing)**
   - Post status updates every 15 minutes while active.
   - Log user impact, temporary mitigations, and ETA.
5. **Recover and verify (before close)**
   - Confirm alerts have cleared for at least 30 minutes.
   - Confirm smoke checks pass, including telemetry health.
6. **Post-incident follow-up (within 48h)**
   - Document root cause, trigger, timeline, and action items.
   - Add a regression test and/or monitoring refinement in the next PR.

## Notes
- Start with conservative thresholds, then tune after one week of production traffic.
- Always correlate frontend telemetry and backend logs with `x-request-id` when available.
