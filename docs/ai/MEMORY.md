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

- Environment loading: Server expects .env.local (README says create .env.local)
- Bundle size: Static imports cause large initial bundle - use lazy loading
- Test mocking: npm test uses mocked fetch, npm run test:integration uses real server
- Socket.IO CORS: Origin '*' with cookie auth may cause issues in production
- Media polling: Client must poll every 10 seconds, handle 404/500 gracefully

## Decisions Log

**2026-04-02**: Implemented route-level code splitting with React.lazy + Suspense to reduce bundle size from 1.17MB to multiple <500kB chunks.

**2026-04-02**: Fixed environment loading to prioritize .env.local as per README instructions.

**2026-04-02**: Added test:integration script for real server/database testing alongside existing mocked tests.

**2026-04-02**: Cleaned up .env.example duplicate VITE_ENABLE_STUDIO entries.

**2026-04-02**: Expanded Socket.IO CORS methods to prevent preflight failures.