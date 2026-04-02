---
name: release-readiness
description: Comprehensive checklist for preparing code releases - run before merging to main or deploying
---

# Release Readiness Check

## Pre-Release Validation

### Code Quality
- [ ] `npm run lint` passes (TypeScript strict mode)
- [ ] `npm run build` succeeds without warnings
- [ ] Bundle size optimized (<500kB chunks)
- [ ] No console errors or warnings in dev mode

### Testing
- [ ] `npm run test:integration` passes (real server/database)
- [ ] Mocked tests still pass (`npm test`)
- [ ] Edge cases tested (error conditions, network failures)
- [ ] Cross-browser compatibility verified

### Security
- [ ] No secrets or sensitive data exposed
- [ ] Input validation on all user inputs
- [ ] HTTPS required for production endpoints
- [ ] CORS properly configured for production domains

### Environment
- [ ] All required environment variables documented
- [ ] .env.example matches production requirements
- [ ] Database migrations tested
- [ ] Seed data verified

### Performance
- [ ] Lazy loading implemented for routes
- [ ] Images optimized and properly sized
- [ ] API response times acceptable (<500ms)
- [ ] Memory leaks checked

### Documentation
- [ ] README deployment instructions updated
- [ ] API documentation current
- [ ] Breaking changes documented
- [ ] Migration guides provided

## Deployment Checklist

### Infrastructure
- [ ] Environment variables configured
- [ ] Database backup taken
- [ ] SSL certificates valid
- [ ] CDN configured for static assets

### Monitoring
- [ ] Error tracking enabled
- [ ] Performance monitoring active
- [ ] Health checks configured
- [ ] Alert thresholds set

### Rollback Plan
- [ ] Previous version tagged
- [ ] Rollback procedure documented
- [ ] Data migration reversible
- [ ] Feature flags available for quick disable

## Post-Release Validation

### Functional Testing
- [ ] Core user flows work in production
- [ ] Payment processing verified
- [ ] Real-time features functional
- [ ] Media generation working

### Monitoring
- [ ] Error rates within acceptable limits
- [ ] Performance metrics stable
- [ ] User feedback monitored
- [ ] Support tickets tracked

## Emergency Contacts

- Dev Team: [contact info]
- Infrastructure: [contact info]
- Security: [contact info]