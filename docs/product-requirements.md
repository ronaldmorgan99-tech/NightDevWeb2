# NightDevWeb2 Product Requirements and System Flows

## 1) Functional Requirements

| Area | Requirement | Notes |
| --- | --- | --- |
| Authentication & Authorization | Secure registration/login/session lifecycle using JWT + bcrypt; role-aware access for Member, Moderator, Admin. | Enforce server-side authorization checks on privileged endpoints. |
| Community Interaction (Forums) | Category/forum/thread/post model with rich content support and moderation actions. | Support thread lifecycle controls (pin/lock/solved where applicable). |
| Real-time Communication | Direct messaging with delivery, presence, and user-visible notifications. | Backed by Socket.IO events and authenticated socket sessions. |
| AI Media Services (Veo Studio) | Prompt/image-driven media generation workflow with queued execution and status polling. | Feature-gated via environment config and API key controls. |
| Commerce | Product catalog, cart flow, and secure third-party checkout integrations. | Payment/webhook processing must be idempotent and validated. |
| Administrative Oversight | Central dashboard for moderation, configuration, and activity/financial analytics. | Include audit-friendly controls for sensitive administrative actions. |

## 2) Non-Functional Requirements

| Category | Requirement | Implementation Targets |
| --- | --- | --- |
| Performance | Fast page loads and responsive state transitions. | Vite optimization, route/code splitting, TanStack Query caching/refetch strategy. |
| Scalability | Multi-database compatibility and deploy flexibility. | SQLite for local iteration, MySQL for production, cloud-friendly stateless API patterns. |
| Observability | Operational visibility for reliability and incident response. | Structured logs, health endpoints, metrics collection, error triage runbooks. |
| Security | Defense-in-depth across auth, input handling, and integrations. | Rate limiting, request validation, sanitization, CSRF-aware session/cookie policy, secure webhook verification. |
| Availability | Predictable deployment and rollback behavior. | CI checks, deploy runbooks, post-deploy smoke tests, rollback procedures. |
| UX/Aesthetics | Cohesive Cyberpunk visual identity and interaction quality. | Tailwind theme tokens, motion/animation standards, consistent iconography and dark-theme contrast. |

## 3) End-to-End App Flow Journeys

### A) Community Member Journey
1. User lands on public pages and browses categories/threads.
2. User registers or logs in and receives authenticated session/token state.
3. User creates threads/replies, receives notifications for mentions/replies.
4. User opens direct messages and exchanges live messages via real-time channel.
5. User optionally visits profile pages, follows activity, and updates profile metadata.

### B) Creator (Veo Studio) Journey
1. Authenticated user navigates to Studio route.
2. User supplies prompt and optional media input.
3. Client sends generation request to API and receives job identifier.
4. Client polls/subscribes for status updates until completion/failure.
5. User previews output and can share/download per configured policy.

### C) Shopper Journey
1. User browses store catalog and product details.
2. User adds items to cart and initiates checkout.
3. Checkout session is created with configured payment provider(s).
4. Provider redirects/returns, webhook confirms payment state.
5. Order status and purchase history are visible in user account surfaces.

### D) Moderator Journey
1. Moderator signs in and enters moderation surfaces.
2. Reviews reports/flags and inspects relevant thread/post/user context.
3. Executes actions (hide/delete/move/lock/suspend) based on policy.
4. Action is logged/auditable and reflected in user-facing state.

### E) Admin Journey
1. Admin signs in and lands on operational dashboard.
2. Monitors health, growth/revenue indicators, and queue backlogs.
3. Updates site-level settings/feature flags and role assignments.
4. Validates outcomes through metrics, logs, and post-change verification checks.

## 4) Module-by-Module Documentation Outline

### 4.1 Authentication Module
- Identity lifecycle: registration, login, refresh/session validation, logout.
- Token/cookie behavior by deployment mode (same-origin vs split-origin).
- Password hashing, auth rate limiting, and failed-attempt handling.
- Role assignment and permission checks.

### 4.2 Forums Module
- Data model: categories, threads, posts, reactions/metadata.
- Thread lifecycle events: create/edit/lock/pin/solve/archive.
- Pagination/search/filter patterns and content sanitization rules.
- Moderator intervention points and user-facing status states.

### 4.3 Veo Studio (AI) Module
- Request contract for prompt/media inputs.
- Queue lifecycle and status states (queued/running/succeeded/failed).
- Provider integration boundaries and key management.
- Quota/rate controls and abuse prevention.

### 4.4 Payments & Commerce Module
- Catalog and cart state transitions.
- Checkout session creation and provider handoff.
- Webhook verification and replay/idempotency protections.
- Order fulfillment states and reconciliation points.

### 4.5 Realtime Module (DM + Notifications)
- Socket authentication handshake and identity binding.
- Event map for messaging, delivery receipts, typing, presence, alerts.
- Reconnect/offline behavior and eventual consistency with persisted data.

### 4.6 Admin Module
- Dashboard KPI definitions and data sources.
- Feature flag/configuration management controls.
- User/account administration actions and escalation safeguards.

### 4.7 API Module
- Domain grouping (`/auth`, `/community`, `/messages`, `/admin`, `/settings`, `/store`, `/studio`).
- Request/response conventions and error envelope standardization.
- Validation contracts, HTTP status semantics, and auth requirements by endpoint.

## 5) RBAC Matrix (Explicit)

| Capability | Member | Moderator | Admin |
| --- | :---: | :---: | :---: |
| Register/login/manage own profile | ✅ | ✅ | ✅ |
| Create/edit own posts/threads | ✅ | ✅ | ✅ |
| Send direct messages | ✅ | ✅ | ✅ |
| Access Veo Studio (when enabled) | ✅ | ✅ | ✅ |
| Purchase products / view own orders | ✅ | ✅ | ✅ |
| Moderate reported content | ❌ | ✅ | ✅ |
| Lock/pin/move threads | ❌ | ✅ | ✅ |
| Suspend/ban members | ❌ | ✅ (policy-bound) | ✅ |
| View moderation queue/audit trail | ❌ | ✅ | ✅ |
| Manage site settings / feature flags | ❌ | ❌ | ✅ |
| Manage roles/permissions | ❌ | ❌ | ✅ |
| View platform-wide financial analytics | ❌ | ❌ | ✅ |

> Notes:
> - Admin has full authority; moderator actions can be scoped by policy/config.
> - High-impact actions (role changes, bans, payment/refund operations) should be audit logged.

## 6) Moderation Policy (Baseline)

### 6.1 Enforcement Principles
- **Consistency**: similar violations receive similar outcomes.
- **Proportionality**: action severity should map to violation severity/repeat history.
- **Transparency**: users receive reason codes/messages for enforcement actions when appropriate.
- **Appealability**: provide a review path for suspensions/bans.

### 6.2 Action Ladder
1. Soft warning / content edit request.
2. Content hide/remove.
3. Temporary restrictions (muted posting/DM limits).
4. Temporary suspension.
5. Permanent ban for severe or repeated abuse.

### 6.3 Operational Requirements
- Log actor, target, timestamp, reason code, and evidence references.
- Require confirmation prompts for destructive actions.
- Restrict irreversible operations to privileged roles.
- Periodically review moderation metrics for bias/drift and policy updates.

## 7) Recommended Follow-up Docs
- API endpoint catalog with concrete schemas/examples.
- Event contract document for Socket.IO channels.
- Moderation reason-code taxonomy and appeal SLA definitions.
- Data retention/privacy policy mapped to user data domains.
