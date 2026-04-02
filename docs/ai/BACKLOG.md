# NightDevWeb2 Backlog

## Now (Current Sprint)

### Studio/Veo Shipping Decision
- **Status**: Pending product decision
- **Details**: VITE_ENABLE_STUDIO currently false, backend ready with GEMINI_API_KEY dependency
- **Definition of Done**: Decision made, if shipping: provision key + docs; if not: remove feature flags

### Production Media Provider Setup
- **Status**: Backend ready, needs env provisioning
- **Details**: GEMINI_API_KEY required for /api/media/ endpoints
- **Definition of Done**: Key configured in production, 503 errors eliminated

### Bundle Optimization
- **Status**: ✅ Implemented lazy loading
- **Details**: Routes now code-split, chunks <500kB
- **Definition of Done**: Build passes without size warnings

### Environment Handling
- **Status**: ✅ Fixed server to load .env.local
- **Details**: README instructions now match runtime behavior
- **Definition of Done**: npm run dev works with .env.local

### Test Strategy
- **Status**: ✅ Added test:integration script
- **Details**: Real server testing available alongside mocks
- **Definition of Done**: CI runs integration tests

## Next (Next Sprint)

### Deployment Documentation
- Add explicit deployment section to README
- Cover environment variables, DB setup, secrets, health checks
- Include production CORS configuration guidance

### Security Review
- Audit Socket.IO CORS settings for production
- Review cookie auth + CORS interaction
- Validate input sanitization across all endpoints

### Performance Monitoring
- Add bundle analyzer to track chunk sizes
- Monitor media API response times
- Set up error tracking for production

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
- Single provider (Gemini) creates vendor lock-in
- No fallback if API quota exceeded or service down
- Rate limiting not implemented

### Real-time Scaling
- Socket.IO with SQLite may not scale to high concurrency
- No message persistence or delivery guarantees
- Connection limits not configured

### Payment Security
- PayPal webhooks not validated in current implementation
- No fraud detection or chargeback handling
- Subscription management edge cases not covered

## Definition of Done Template

For each initiative:
- Code implemented and tested
- Documentation updated
- Security review completed
- Performance impact assessed
- Deployment verified in staging