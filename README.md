<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/760e6625-d344-4b21-a27e-ffbef0bdf8e6

## Tech Stack Overview

### Framework: React 19 + TypeScript + Vite
The frontend is built with **React 19** for modern component-based UI development, **TypeScript** for static typing and safer refactors, and **Vite** for fast local development and optimized production builds.

### Backend: Express.js + Node.js (via `server.ts`)
The server runs on **Node.js** and uses **Express.js** to handle API routes, middleware, and server-side logic. The main backend entry point is `server.ts`, which centralizes server configuration and startup behavior.

### Database: Dual-support architecture (SQLite for local, MySQL for production)
The data layer supports two environments:
- **SQLite** for local development (simple setup, file-based storage, ideal for quick iteration).
- **MySQL** for production (robust, scalable, and better suited for deployed workloads).

This allows developers to get started quickly while keeping production infrastructure reliable.

### Real-time: Socket.IO integration
The app includes **Socket.IO** for real-time, bidirectional communication between client and server. This is useful for features like live updates, notifications, presence, or collaborative interactions.

### Styling: Tailwind CSS with custom cyberpunk theme
UI styling is built with **Tailwind CSS**, enabling utility-first styling and rapid UI implementation. A **custom cyberpunk theme** is layered on top to provide a distinct visual identity and consistent design language across the app.

### State Management: React Context API + TanStack React Query
State is managed using a combination of:
- **React Context API** for shared app-level/client state (such as UI state and global settings).
- **TanStack React Query** for async server state (fetching, caching, background refetching, and synchronization).

Together, they keep local UI state and remote API data organized, performant, and maintainable.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Create a local environment file:
   `cp .env.example .env.local`
3. Set required values in `.env.local`:
   - `JWT_SECRET` (required): secret used by auth token code in `server.ts`.
   - `NODE_ENV` (required): `development` locally, `production` in deployed environments.
   - `VITE_ENABLE_STUDIO` (recommended): set to `true` to enable `/studio`, or `false` to show the coming soon page.
4. Optional values:
   - `GEMINI_API_KEY`: only required when media generation APIs are enabled/implemented.
   - `APP_URL`: used in hosted environments for callback/self links.
   - `VITE_API_BASE_URL`: set this when frontend and API are hosted on different domains (example: `https://api.yourdomain.com`). If omitted, frontend calls relative `/api/*` paths on the current origin.
5. Run the app:
   `npm run dev`

### Auth/CORS deployment security defaults

- **Same-origin deploy (frontend + API on one origin)**  
  Leave `CLIENT_ORIGIN` unset. Cookies are sent with `SameSite=Lax`, and no cross-origin credential headers are emitted.
- **Split-origin deploy (frontend and API on different origins)**  
  Set `CLIENT_ORIGIN` to the frontend origin (or a comma-separated list, for example `https://app.example.com,https://admin.example.com`).  
  In production this enables credentialed CORS responses and sets auth cookies as `SameSite=None; Secure`.

## Vercel Deployment Notes

If you deploy this repo to Vercel with API routes enabled, make sure the following are configured:

- `JWT_SECRET` (required, minimum 32 characters)
- `NODE_ENV=production`
- `DATABASE_URL` (recommended for persistent production data; if omitted on Vercel, SQLite falls back to `/tmp` and data is ephemeral)
- `CLIENT_ORIGIN` (required for split-origin deployments; comma-separated allowlist of trusted frontend origins)

### Expected default logins (fresh database)

- `admin` / `password`
- `member` / `password`

These users are ensured at API bootstrap for serverless deployments.

### Common production errors

- **`Failed to load module script ... MIME type text/html`**  
  Usually means static assets were rewritten to `index.html`. Confirm Vercel routes preserve filesystem assets before SPA fallback.

- **`/api/* 500` on first load/login**  
  Usually indicates missing/invalid environment variables (especially `JWT_SECRET`) or database initialization failure in the serverless runtime.
- If frontend and API are deployed on the same Vercel project/domain, leave `VITE_API_BASE_URL` unset so the client uses relative `/api/*` requests and avoids cross-origin CORS issues.
- Set `VITE_API_BASE_URL` only when the frontend and backend are hosted on different domains.
- For Node ESM runtime compatibility in Vercel serverless functions, local runtime imports must include `.js` file extensions after TypeScript emit (for example `./db.js`).

## AI Workflow Files

The repository includes AI collaboration documents that help track context and planned work:

- `skills/release-readiness/SKILL.md` — reusable workflow guidance for release-readiness checks.
- `docs/ai/MEMORY.md` — persistent project memory and key context for future sessions.
- `docs/ai/BACKLOG.md` — prioritized backlog items and follow-up tasks.
