# NightDevWeb2 Memory

## Architecture Map

### Frontend Routes (src/App.tsx)
- `/` - ForumsPage (main forum listing)
- `/forums/:id` - ForumViewPage (threads in forum)
- `/threads/:id` - ThreadViewPage (thread with posts)
- `/profile/:id` - ProfilePage (user profiles)
- `/store` - StorePage (premium features)
- `/admin/*` - AdminLayout with various admin pages
- `/studio` - VeoStudioPage (AI video generation, gated by VITE_ENABLE_STUDIO)

### Server Structure (server.ts)
- Express app with SQLite database
- JWT authentication with httpOnly cookies
- CSRF protection via double-submit pattern
- Socket.IO for real-time messaging
- Media APIs: `/api/media/animate` + `/api/media/poll` (Google Gemini integration)

### Database Layer (src/lib/db.ts)
- SQLite with migrations
- User management, forums, threads, posts
- Payment processing (PayPal integration)
- Settings and permissions

## Key Invariants

### Authentication
- JWT tokens stored in httpOnly cookies
- CSRF tokens required for state-changing requests
- Password hashing with bcrypt
- Role-based permissions (user, moderator, admin)

### Payments
- PayPal SDK integration
- Premium features gated by user.subscription_status
- Secure webhook handling

### Media Generation
- Requires GEMINI_API_KEY environment variable
- Async polling pattern for video generation
- 30-minute TTL on operations
- Returns 503 if provider unavailable

### Real-time Features
- Socket.IO with cookie-based auth parsing
- Room-based messaging per thread
- CORS configured for development

## Recurring Gotchas

- **Suspense boundaries**: Single top-level Suspense wrapping all routes causes infinite recursion during lazy loading. Use isolated Suspense per route instead.
- **Vite HMR in Codespaces**: Requires wss:// + forwarded domain + clientPort:443. Mismatch between host and socket port breaks connection.
- **Environment loading**: Server expects .env.local. SQLite path detection must check DATABASE_URL format (contains '://') not endpoint.
- **Bundle size**: Lazy loading alone isn't enough - need individual Suspense boundaries per route to prevent re-render cascades.
- **Test database**: Must use separate path (tmp/test.db) and create tmp/ directory before tests run.
- **Socket.IO CORS**: Origin '*' OK for dev, but expand HTTP methods to avoid preflight failures.
- **Media polling**: Client polls /api/media/poll every 10 seconds, must handle 404/500 gracefully.

## Decisions Log

**2026-04-02 (Latest)**: Fixed Vercel POST 405 issue by normalizing `/api/*` paths inside `api/[...path].ts` (supporting Vercel's stripped route paths) and tightening `vercel.json` SPA rewrite so API requests are not re-rewritten.

**2026-04-02**: Added Vercel serverless API entrypoint at `api/[...path].ts` with core endpoints (`/api/settings`, `/api/servers`, `/api/forums/categories`, `/api/community/stats`, `/api/auth/login`, `/api/auth/me`) and a `vercel.json` rewrite config so frontend and API can run in the same Vercel project.

**2026-04-02**: Added configurable `VITE_API_BASE_URL` support in `src/lib/api.ts` for split frontend/backend deployments (e.g., Vercel frontend + external API). Also added explicit 404 guidance for `/api/*` failures to surface deployment misconfiguration clearly.

**2026-04-02**: Fixed infinite fetch recursion by preserving native `fetch` and avoiding self-calls after monkey-patching `window.fetch` in `src/main.tsx`.

**2026-04-02**: Fixed infinite Suspense recursion by wrapping each lazy route in isolated Suspense boundaries instead of single top-level boundary. This prevents cascading state changes during navigation and solves "Maximum call stack size exceeded" during login.

**2026-04-02**: Implemented smart Vite HMR detection for GitHub Codespaces vs local dev. Uses secure WebSocket (wss://) with forwarded domain for Codespaces, standard ws:// for local. Fixes WebSocket connection failures.

**2026-04-02**: Implemented route-level code splitting with React.lazy + Suspense to reduce bundle size from 1.17MB to multiple <500kB chunks.

**2026-04-02**: Fixed environment loading to prioritize .env.local as per README instructions. SQLite now respects DATABASE_URL for test isolation.

**2026-04-02**: Added test:integration script for real server/database testing with dedicated tmp/test.db. Uses environment variable detection to avoid MySQL URL parsing for local SQLite.

**2026-04-02**: Cleaned up .env.example duplicate VITE_ENABLE_STUDIO entries and added DISABLE_HMR flag for Codespaces.

**2026-04-02**: Expanded Socket.IO CORS methods to include OPTIONS, HEAD, PUT, DELETE, PATCH for better compatibility.
