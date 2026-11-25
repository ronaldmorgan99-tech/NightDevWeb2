# NightDevWeb2 Backlog

Updated on 2026-11-25
Last reviewed: 2026-11-25

Review note: Synced to main `25ea65c` (through PR #245). Long-completed April/June "Now" items were moved to `docs/ai/archive/BACKLOG_ARCHIVE.md`.

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

### Player-facing leftovers (priority)

These still affect people trying to join or vote, as of `25ea65c`:

- **Vote button** in the sidebar Quick Actions has no click handler and no vote page or vote-site URL. Store, Discord, and Stats next to it do work (`/store`, Discord invite, `/servers`).
- **Download Network Tool** on the Servers page is a button with no handler and no downloadable asset.
- **View Stats** on non-Unturned server cards has no handler.
- **Ops:** add a Steam Web API key (`STEAM_API_KEY` in Vercel, or `steam_api_key` in admin integrations) so the live status panel can show Online/Offline instead of Unknown. This is configuration, not a code change. After a NightRespawnPilot restart, update `NIGHTRESPAWN_PILOT_SERVER_CODE`.

### Unify remaining API drift

- **Priority**: High
- **Status**: ⚠️ Partial (forum permissions and live server status are shared; other schemas/handlers are not)
- **Details**: Track 1 in `docs/ai/refactor-plan/01-unify-api.md`. Concrete remaining bug: registration password minimum is 8 characters in `server.ts` (line 84) and 6 characters in `api/[...path].ts` (line 139).

### Security hardening carry-over

- **Priority**: High
- **Status**: ⚠️ In progress (updated 2026-11-25)
- Completed earlier: Socket.IO CORS audit, cookie auth + CORS for cross-domain, input sanitization on auth/content/profile/support write paths, auth endpoint rate limiting.
- **Remaining**: sanitization of non-content admin catalog payloads still relies on schema validation only; formalize flaky-test quarantine reporting beyond the existing manifest.

### Performance monitoring

- **Priority**: Medium
- Add bundle analyzer to track chunk sizes post-optimization
- Monitor media API (Gemini) latency and quota usage
- Set up error tracking for production (e.g., Sentry)
- Add performance monitoring for Socket.IO connections

## Next

### Finish public-site cleanup

Wire or hide the dead Vote, Download Network Tool, and View Stats controls. Remove or compute the hardcoded "+12%" trend badge on the admin dashboard. Delete or route the orphaned `CategoryPage.tsx`.

### Make the site feel live (remaining)

Live NightRespawnPilot status shipped in PR #245. Still open: next-wipe countdown, homepage news/wipe treatment beyond the existing `/news` feed, and consuming any `network_servers` admin JSON (the playtest server comes from env vars, not that setting).

### Engagement

Vote-for-rewards page (the destination the Vote button still lacks), achievements and badges.

### Commerce

Replace the simulated Store checkout with real Stripe Elements / PayPal approval, then build the admin Economy tab. Webhook signature checks already exist; fraud/chargeback handling and subscription edge cases do not.

## Shipped (November 2026)

Recorded here so the plan and this backlog stop listing them as open. Details are in `docs/ai/MEMORY.md`.

- **PR #245** — Live server status panel at the top of `/#/servers`. Removed the fake Network Health panel. Steam `GetServerList` status check, Unknown state without a key, shared `src/lib/serverStatus.ts` and `src/lib/liveServers.ts`.
- **PR #244** — Live-site polish: nav breakpoints, floating post menu, Home vs Forums, servers/store fixes, focus ring. Store and Stats Quick Actions are wired.
- **PR #243** — CodeQL sanitize test fix.
- **PR #242** — Forum backend: author delete, locked-thread replies blocked server-side (staff exempt), `edited_at` + Edited label, shared `src/lib/forumPermissions.ts`.
- **PR #241** — Forum post overflow menu.
- **PR #240** — Support and contact pages readable by signed-out visitors.
- **PRs #233–#239, #236, #237** — Steam OpenID sign-in and callback/display-name fixes, `/forums` route and forum authors, Vercel `userDisplay` import fix.

## Later (Future Sprints)

### Advanced Features

- Expand media provider support (beyond Gemini)
- Implement advanced forum features (polls, reactions)

### Scalability Improvements

- Database connection pooling
- Redis for session/cache management
- CDN for static assets
- **Refactor plan**: A multi-track architecture refactor plan operationalizing these scalability items (unify duplicate API, externalize in-memory state, real-time host, history routing) lives in [`docs/ai/refactor-plan/`](refactor-plan/README.md). Track 1 is partially started in the sense that forum permissions and live server status are shared modules; the track itself is still open.

## Open Risks

### Media API Dependency

- **Risk Level**: High
- Single provider (Gemini) creates vendor lock-in
- Fallback UX now exists for provider outage/quota errors, but multi-provider failover is not yet implemented
- Initial rate limiting/guardrails implemented; thresholds still need production tuning
- **Mitigation**: Add provider abstraction layer, implement request queuing, and review guardrail thresholds after one week of production telemetry

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
- Store checkout UI is still simulated (no card entry or PayPal redirect).
- Stripe and PayPal webhook signature verification is implemented (`verifyStripeWebhookSignature`, `verifyPayPalWebhookSignature`) when the webhook secrets/IDs are configured. Earlier backlog text that said PayPal webhooks were not validated is outdated.
- No fraud detection or chargeback handling
- Subscription management edge cases not covered
- **Mitigation**: Finish real checkout, keep webhook signatures required in production, add subscription audit logs

### Studio Go/No-Go Gate (April 2026)

Historical gate; all checklist rows were marked complete on 2026-04-09. `/studio` remains feature-flagged with `VITE_ENABLE_STUDIO` (default false → Coming Soon). See `docs/admin/studio-support-status.md`.

## Definition of Done Template

For each initiative:
- Code implemented and tested
- Documentation updated
- Security review completed
- Performance impact assessed
- Deployment verified in staging
