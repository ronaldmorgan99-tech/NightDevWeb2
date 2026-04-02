# NightDevWeb2 Backlog

## Now (Current Sprint)

### Critical Bug Fixes
- **Status**: ✅ Completed
- **Fixes**:
  - Suspense infinite recursion causing "Maximum call stack size exceeded" during login
  - Vite HMR WebSocket failures in GitHub Codespaces
- **Details**: Individual Suspense boundaries per route, smart HMR detection

### Studio/Veo Shipping Decision
- **Status**: Pending product decision
- **Details**: VITE_ENABLE_STUDIO currently false, backend ready with GEMINI_API_KEY dependency
- **Definition of Done**: Decision made, if shipping: provision key + docs; if not: remove feature flags

### Production Media Provider Setup
- **Status**: Backend ready, needs env provisioning
- **Details**: GEMINI_API_KEY required for /api/media/ endpoints
- **Definition of Done**: Key configured in production, 503 errors eliminated

### Bundle Optimization & Code Splitting
- **Status**: ✅ Implemented
- **Details**: Route-level lazy loading with individual Suspense boundaries, chunks <500kB
- **Definition of Done**: Build passes without size warnings, no infinite re-render issues

### Environment & Configuration
- **Status**: ✅ Fixed
- **Details**: .env.local loading, DATABASE_URL detection, DISABLE_HMR flag, Vite HMR for Codespaces
- **Definition of Done**: All dev environments work without websocket/file loading errors

### Vercel Split-Deployment API Routing
- **Status**: 🚧 Partially implemented
- **Details**: Added Vercel serverless route file `api/[...path].ts`, fixed POST 405 path normalization for `/api/*`, and adjusted SPA rewrites to avoid intercepting API requests. Remaining API surface still lives in `server.ts` and should be migrated incrementally if full parity is required.
- **Definition of Done**: All production-critical `/api/*` routes used by frontend are available through Vercel functions with no 404s.

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
- Wire test:integration into CI (currently runs locally only)
- Add lint + build checks to PR workflow
- Set up automated security scanning

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
