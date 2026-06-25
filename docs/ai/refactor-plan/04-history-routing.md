# Track 4 — History Routing for SEO

- **Owner**: Unassigned
- **Status**: ⬜ Todo
- **Last updated**: 2026-06-25

## Problem

The app uses **`HashRouter`** in [`src/App.tsx`](../../../src/App.tsx#L178) (~line 178):

```tsx
import { HashRouter, Routes, Route, useLocation } from 'react-router'; // ~line 6
...
<HashRouter>   {/* ~line 178 */}
  ...
</HashRouter>  {/* ~line 224 */}
```

`HashRouter` produces fragment URLs like `/#/threads/123`. Everything after the `#` is a
client-side fragment that **search engines do not treat as a distinct, indexable URL**.
For a public forum whose value depends on threads being discoverable via search, this is
a significant SEO problem — forum/thread pages effectively don't get indexed as
canonical URLs.

## Goal

Migrate to **`BrowserRouter`** so routes are real paths (`/threads/123`), add the
host/server **SPA-fallback rewrites** required to serve `index.html` for deep links, and
evaluate SSR/prerendering for crawlability.

## Relevant Existing Config

Both deploy targets already have config files that will need SPA-fallback rewrites
adjusted for clean paths:

- [`netlify.toml`](../../../netlify.toml) — has `/api/*` → functions and a `/*` →
  `/index.html` (status 200) fallback already; confirm it covers all client routes after
  the switch.
- [`vercel.json`](../../../vercel.json) — uses `handle: filesystem` then `/api/(.*)` →
  the serverless function and `/(.*)` → `/index.html`; confirm deep links resolve to the
  SPA shell and assets still serve via the filesystem handler.

## Steps

- [ ] **Slice 1 (first verifiable slice): switch the router.** Replace `HashRouter` with
  `BrowserRouter` in `src/App.tsx` and verify in-app navigation and deep links work in
  local dev (`npm run dev`).
- [ ] **Slice 2: verify SPA fallback rewrites** for both hosts so direct hits to deep
  links (e.g. `/threads/123`) return the SPA shell, while `/api/*` and static assets
  still route correctly. Adjust [`netlify.toml`](../../../netlify.toml) and
  [`vercel.json`](../../../vercel.json) as needed.
- [ ] **Slice 3: audit hardcoded `#`-based links** and any logic relying on
  `useLocation`/hash fragments; update to path-based equivalents.
- [ ] **Slice 4: SEO essentials** — per-route `<title>`/meta, canonical URLs, and a
  sitemap for public forum/thread routes.
- [ ] **Slice 5: SSR / prerender evaluation.** Decide whether client-side rendering with
  prerendering of public routes is sufficient, or whether SSR is warranted for crawler
  coverage; record the decision in `docs/ai/MEMORY.md`.

## Validation

```bash
npm run lint
npm run build
npm run test:integration
```

Plus deploy-preview checks: deep-link directly to a thread URL on both Netlify and Vercel
previews and confirm the page loads (no 404), assets resolve, and `/api/*` still works.

## Cross-links

- Backlog: [`Scalability Improvements`](../BACKLOG.md#scalability-improvements)
- Related memory: split-origin deployment + Vercel filesystem-first routing notes in
  [`docs/ai/MEMORY.md`](../MEMORY.md)
