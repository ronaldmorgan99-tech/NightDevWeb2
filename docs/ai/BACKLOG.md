# NightDevWeb2 Backlog

Updated on 2026-04-10
Last reviewed: 2026-04-10

## Document Governance

- **Owner**: Platform Engineering backlog steward (primary) with Product + Admin Operations providing prioritization input.
- **Required update triggers**:
  - Post-incident update when incidents create follow-up actions or change task priority.
  - Post-release update to reflect shipped work, regressions, and carry-over tasks.
  - Architecture change update when technical direction changes feature scope, sequencing, or risks.
- **Review cadence**: Review weekly and at each sprint planning session.
- **Quarterly ownership review checklist**:
  - [ ] Confirm owner, backup owner, and escalation path are still valid for CI/CD and deployment initiatives.
- **Archive format**:
  - In `## Now`, any item marked complete for more than 30 days must be moved to `docs/ai/archive/BACKLOG_ARCHIVE.md`.
  - Archive entries must include: original section, completion date, and `Archived on: YYYY-MM-DD`.
  - Keep archive grouped by quarter headings (`## YYYY-QN`) to make retrieval easier.

## Now (Current Sprint)

### Critical Bug Fixes
- **Status**: ✅ Completed
- **Fixes**:
  - Suspense infinite recursion causing "Maximum call stack size exceeded" during login
  - Vite HMR WebSocket failures in GitHub Codespaces
- **Details**: Individual Suspense boundaries per route, smart HMR detection

### Studio/Veo Shipping Decision
- **Status**: ✅ Decided (Not shipping in April 2026 cycle)
- **Details**: `/studio` now redirects to `/` so users do not hit dead-end routes. Discoverability remains disabled.
- **Definition of Done**: Decision documented in README + admin operations docs, with ownership and re-open criteria.

### Production Media Provider Setup
- **Status**: ✅ Release-ready (validation + rollback drill documented)
- **Details**: `/api/media/animate` + `/api/media/poll` implemented with quota/poll guardrails and observability counters. Alert thresholds for media latency/error/quota are now documented, and scripted post-deploy smoke checks were added for auth/settings/metrics paths.
- **Definition of Done**: Complete production validation, verify `/api/admin/observability/metrics` dashboards/alerts, then enable `VITE_ENABLE_STUDIO=true` with rollback drill.

### Bundle Optimization & Code Splitting
- **Status**: ✅ Implemented
- **Details**: Route-level lazy loading with individual Suspense boundaries, chunks <500kB
- **Definition of Done**: Build passes without size warnings, no infinite re-render issues

### Environment & Configuration
- **Status**: ✅ Fixed
- **Details**: .env.local loading, DATABASE_URL detection, DISABLE_HMR flag, Vite HMR for Codespaces
- **Definition of Done**: All dev environments work without websocket/file loading errors

### Vercel Split-Deployment API Routing
- **Status**: ✅ Core fixes implemented
- **Details**: Added Vercel filesystem-first routing for static assets and stabilized serverless API bootstrap with idempotent default auth-user creation.
- **Definition of Done**: Maintain green deploys where `/api/settings`, `/api/servers`, and `/api/auth/login` return expected responses (200/401, not 404/500) after redeploy.
- **Status**: ⚠️ In progress
- **Details**: Frontend supports `VITE_API_BASE_URL` for split deployment. For same-origin Vercel API routes, keep `VITE_API_BASE_URL` unset to avoid preview-to-production CORS failures. Serverless runtime also requires explicit emitted `.js` import extensions in Node ESM paths.
- **Definition of Done**: Vercel project has working API origin configured, `/api/settings` and `/api/auth/login` return 200/401 (not 404) in production.

### Integration Testing
- **Status**: ✅ Implemented
- **Details**: test:integration script with dedicated tmp/test.db, real server/database testing
- **Definition of Done**: CI runs and validates real auth/API flows

## Next (Next Sprint)

### Deployment Documentation
- **Owner**: Platform Engineering
- **Backup owner**: Admin Operations
- **Escalation path**: Platform Engineering on-call -> Incident Commander -> Head of Engineering
- **Priority**: High
- **Status**: ✅ Completed (2026-04-10)
- **Details**: README now includes a production deployment runbook covering deployment models, environment-variable requirements, DB bootstrap/seed expectations, HTTPS and secrets-management requirements, post-deploy health/smoke checks, rollback flow, and Vite HMR production-domain guidance.
### Completed (this sprint)

#### Deployment Documentation
- **Status**: ✅ Completed (2026-04-10)
- Added explicit deployment section to README covering:
  - Environment variables breakdown (DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, etc.)
  - Database migration and seeding steps
  - HTTPS/secrets management
  - Health check endpoints and monitoring
  - Vite HMR configuration for production domains

### Pending

### Security Hardening
- **Priority**: High
- Audit Socket.IO CORS settings before production (currently origin: '*')
- Review cookie auth + CORS interaction for cross-domain scenarios
- Add input sanitization validation across all endpoints
- Implement rate limiting on auth endpoints

### CI/CD Pipeline
- **Owner**: Platform Engineering
- **Backup owner**: Admin Operations
- **Escalation path**: Platform Engineering on-call -> Incident Commander -> Head of Engineering
- **Priority**: High
- **Workflow Reference**: `.github/workflows/ci.yml`
- **Source of truth note**: Treat `.github/workflows/ci.yml` as canonical when backlog checklists drift.

**Completed (verified in CI)**
- `npm run lint` runs in the `validate` job.
- `npm run build` runs in the `validate` job.
- `npm run test:integration` runs in the `validate` job.
- Dependency vulnerability scanning runs via `npm audit --audit-level=high` (`dependency-scan` job).
- SAST scanning runs via CodeQL (`sast` job).
- Coverage collection is enabled for integration + unit tests and uploaded as artifacts.
- Integration coverage gating is enforced from existing `coverage/integration` output with an explicit threshold in CI.
- Flaky/failure behavior is implemented: one retry for integration tests, upload failure logs/database artifact after second failure, then fail the workflow.

**Remaining**
- Formalize flaky-test quarantine/reporting automation beyond inline workflow comments.
- _None currently. Re-open when new CI/CD gaps are identified._

### Performance Monitoring
- **Priority**: Medium
- Add bundle analyzer to track chunk sizes post-optimization
- Monitor media API (Gemini) latency and quota usage
- Set up error tracking for production (e.g., Sentry)
- Add performance monitoring for Socket.IO connections

## Later (Future Sprints)

### Advanced Features
- Expand media provider support (beyond Gemini)
- Add user-generated content moderation
- Implement advanced forum features (polls, reactions)

### Scalability Improvements
- Database connection pooling
- Redis for session/cache management
- CDN for static assets

## Open Risks

### Media API Dependency
- **Risk Level**: High
- Single provider (Gemini) creates vendor lock-in
- Fallback UX now exists for provider outage/quota errors, but multi-provider failover is not yet implemented
- Initial rate limiting/guardrails implemented; thresholds still need production tuning
- **Mitigation**: Add provider abstraction layer, implement request queuing, and review guardrail thresholds after one week of production telemetry

## Studio Go/No-Go Gate (April 2026)

| Check | Status | Owner |
| --- | --- | --- |
| Media routes (`/api/media/animate`, `/api/media/poll`) implemented and locally validated | ✅ | Platform Engineering |
| Provider outage + quota fallback UX in Studio page | ✅ | Frontend Engineering |
| Monitoring endpoint includes media latency/failure/guardrail counters | ✅ | Platform Engineering |
| Production provisioning, alert wiring, and rollback drill complete | ✅ Complete (2026-04-09, Owner: Platform Engineering + Admin Operations) | Platform Engineering + Admin Operations |
| Enable discoverability (`VITE_ENABLE_STUDIO=true`) | ✅ Complete (2026-04-09, Owner: Platform Engineering) | Platform Engineering |

### Real-time Scaling
- **Risk Level**: Medium
- Socket.IO with SQLite may not scale to high concurrency
- No message persistence or delivery guarantees beyond session
- Connection limits not configured (could DOS on high user count)
- **Mitigation**: Add Redis for session persistence, implement connection limits

### Frontend State Management
- **Risk Level**: Low (now resolved)
- Was: Suspense infinite recursion during lazy route transitions
- **Fixed**: Individual Suspense boundaries prevent cascade
- **Monitoring**: Watch for similar patterns with other async boundaries

### Payment Security
- **Risk Level**: High
- PayPal webhooks not validated in current implementation
- No fraud detection or chargeback handling
- Subscription management edge cases not covered
- **Mitigation**: Validate webhook signatures, add subscription audit logs

## Definition of Done Template

For each initiative:
- Code implemented and tested
- Documentation updated
- Security review completed
- Performance impact assessed
- Deployment verified in staging
