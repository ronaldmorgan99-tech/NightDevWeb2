# NightDevWeb2 Backlog

Updated on 2026-04-08

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
- **Status**: Deferred (dependent on Studio relaunch)
- **Details**: `GEMINI_API_KEY` provisioning is intentionally postponed until media routes are production-ready.
- **Definition of Done**: Provision key only when `/api/media/animate` and `/api/media/poll` are implemented, validated, and monitored.

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
- **Priority**: High
- Add explicit deployment section to README with:
  - Environment variables breakdown (DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, etc.)
  - Database migration and seeding steps
  - HTTPS/secrets management
  - Health check endpoints and monitoring
  - Vite HMR configuration for production domains

### Security Hardening
- **Priority**: High
- Audit Socket.IO CORS settings before production (currently origin: '*')
- Review cookie auth + CORS interaction for cross-domain scenarios
- Add input sanitization validation across all endpoints
- Implement rate limiting on auth endpoints

### CI/CD Pipeline
- **Priority**: High
- **Workflow Reference**: `.github/workflows/ci.yml`

**Completed (verified in CI)**
- `npm run lint` runs in the `validate` job.
- `npm run build` runs in the `validate` job.
- `npm run test:integration` runs in the `validate` job with failure artifacts.

**Remaining**
- Add automated security scans (dependency + SAST) to CI.
- Add coverage collection and enforce minimum coverage gates.
- Define flaky-test policy (retry strategy, quarantine rules, and reporting).

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
- No fallback if API quota exceeded or service down
- Rate limiting not implemented
- **Mitigation**: Add provider abstraction layer, implement request queuing

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
