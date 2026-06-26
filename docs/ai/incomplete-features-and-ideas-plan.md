# NightRespawn (NightDevWeb2) — Incomplete Features Audit + Competitive Research Plan

**Prepared for:** ronald
**Scope:** (1) Locate incomplete features/tabs across the site, (2) research comparable gaming-community platforms for ideas. **No code was changed.**
**Stack:** React 19 + TS + Vite + Tailwind + TanStack Query (frontend); Node/Express + Socket.IO + SQLite/Turso/MySQL + JWT (backend); Stripe/PayPal SDKs.

---

## Part 1 — Incomplete Features & Dead-End Tabs (what's actually unfinished)

Severity legend: 🔴 user-visible dead-end · 🟡 simulated/partial · 🟢 hidden/gated · ⚪ cleanup

| # | Area | File / location | What's wrong | Sev |
|---|------|-----------------|--------------|-----|
| 1 | Messaging | `src/pages/MessagesPage.tsx` ~L569–604 | Voice call, video call, conversation info, and conversation menu buttons are hard-`disabled` with "(coming soon)" labels | 🔴 |
| 2 | Left sidebar Quick Actions | `src/layouts/MainLayout.tsx` ~L701–719 | **Store**, **Vote**, **Stats** buttons have no `onClick` — clicking does nothing. Only **Discord** works | 🔴 |
| 3 | Servers page | `src/pages/ServersPage.tsx` ~L83 | "VIEW STATS" button has no handler | 🔴 |
| 4 | Servers page | `src/pages/ServersPage.tsx` ~L207–217 | "Network Health" per-region (Frankfurt/London/NY/Singapore) is **hardcoded** — always full bar / "OK", not live | 🟡 |
| 5 | Servers page | `src/pages/ServersPage.tsx` ~L220 | "DOWNLOAD NETWORK TOOL" button likely non-functional (no real asset/handler) | 🔴 |
| 6 | Admin Settings | `src/pages/admin/AdminSettingsPage.tsx` ~L387–402 | **Economy tab** shows "Sector Under Construction" placeholder — credit/market config not built | 🔴 |
| 7 | Store checkout | `src/pages/StorePage.tsx` ~L105–131 | Stripe/PayPal checkout is **simulated** — no card-entry UI (Stripe Elements) or PayPal approval redirect; comments literally say "for now, we'll simulate" | 🟡 |
| 8 | Payments backend | `src/lib/payments.ts` L161, 353, 397 | `MOCK_PAYMENTS=1` returns fake payment intents/orders. Real SDK path exists but needs live keys + webhook validation | 🟡 |
| 9 | Admin Analytics | analytics stat cards | "+12%" trend delta appears **hardcoded** on every card (the underlying numbers are real, the trend badge is fake) | 🟡 |
| 10 | Orphaned page | `src/pages/CategoryPage.tsx` | Legacy page, **not routed anywhere**, old indigo theme (not the cyber theme), dead "New Thread" button. Leftover from earlier iteration | ⚪ |
| 11 | Veo Studio | `/studio` route + `VITE_ENABLE_STUDIO` | AI video generation is feature-gated off by default — finished-ish but hidden behind env flag | 🟢 |
| 12 | Integrations wiring | `AdminIntegrationsPage.tsx` vs `ServersPage.tsx` | Admin can save `steam_api_key`, `network_servers` JSON, `twitch_client_id`, but the public Servers page still uses **hardcoded** data — config is stored but not consumed | 🟡 |

### Already documented in your own backlog (`docs/ai/BACKLOG.md`)
- PayPal webhooks not validated; no fraud detection; subscription edge cases uncovered.
- Real-time scaling risk: Socket.IO + SQLite won't scale horizontally.
- Media generation = vendor lock-in on Gemini/Veo.
- Admin catalog input sanitization still pending.

**Quick wins (low effort, high polish):** #2 (wire Store→`/store`, Vote→vote page, Stats→`/servers`), #3 (wire VIEW STATS), #10 (delete orphan page), #9 (remove or compute the fake +12%). **Bigger projects:** #4/#12 (live server data), #6 (admin economy), #7/#8 (real payments).

---

## Part 2 — Competitive Research (ideas from sites like yours)

Your site is a **Rust-style game-server community** (wipe schedules, raids, kills, K/D, wealth, server browser, store, forums, messaging, profiles). I looked at how the category leaders handle each pillar.

### A. Server browser & live data — *BattleMetrics* (battlemetrics.com)
The gold standard for game-server tracking. Concrete ideas to steal:
- **Live player counts** `current/max` per server, updated continuously (yours is static).
- **Wipe schedule front-and-center**: "Last Wipe" + **"Next Wipe" countdown** columns — Rust players pick servers by this. High-value since your whole profile system already revolves around "wipe performance."
- **Rich filters**: players online, gather rate, group limit, PVE/PVP, map, region/distance, "Last/Next wipe between dates."
- **Sortable ranked list** with pagination (rank, name, players, wipe, location).
- **Per-server detail page**: uptime % graph, player-count history chart, rank history.
- **Status alerts**: notify a user (Discord/email) when a server goes down or comes back.
- **Player tracking / leaderboards** tied to Steam IDs.
- **RCON panel** for admins, and embeddable **server banners**.
> Maps directly onto your Servers page (#3/#4/#5/#12). Even a real player-count + next-wipe countdown would make it feel alive.

### B. Store / monetization — *Tebex* (de-facto Rust/Minecraft store)
Standard feature set worth matching as you finish real payments (#7/#8):
- Package catalog with **categories, bundles, subscriptions (recurring), one-time items**.
- **In-game delivery**: purchase triggers a server command (give kit/VIP) via Steam-account linking — the killer feature for game stores.
- **Sales, coupon/discount codes, gift cards, gifting** to another player.
- **Creator/affiliate codes**, multiple payment methods, clean basket→checkout.
- Purchase history + license/entitlement view in the user profile.
> Your "wealth/credits" economy + Admin Economy tab (#6) is the natural home for this.

### C. Voting & rewards — *rust-servers.net / top-games style*
Your dead **Vote** button (#2) is a whole genre:
- Players vote daily on listing sites → server grants **in-game rewards** (credits, kits).
- A **vote page** with streak tracking, leaderboards, and a reward claim flow drives recurring traffic.
> Cheap to add a vote page that links out + tracks streaks; rewards can plug into your credits system.

### D. Community / engagement — Discord, Guilded, Enjin/XenForo communities
- **Wipe countdown + announcements/news feed** on the homepage (you have forums but no "news").
- **Staff applications, ban appeals, support tickets** as structured forms (you have Support — could template these).
- **Giveaways / events**, **role/rank badges**, **achievements** tied to your existing game-stats.
- **Profile linking to Steam** for verified stats (you already display kills/K/D/playtime — sourcing them from Steam/RCON makes them trustworthy).
- Real-time: **typing indicators, read receipts, presence** are table-stakes for the messaging area; voice/video (#1) is a much bigger lift — consider just removing those buttons until ready vs. leaving dead.

### E. Patterns most relevant to *your* gaps
| Your gap | Best-in-class answer | Effort |
|----------|----------------------|--------|
| Static server list (#4/#12) | BattleMetrics-style live counts + next-wipe countdown | Med |
| Dead Vote button (#2) | Vote-for-rewards page + streaks | Low–Med |
| Simulated checkout (#7/#8) | Tebex-style real payments + in-game delivery | High |
| Admin Economy "under construction" (#6) | Credits/market config + store packages admin | Med–High |
| Disabled call buttons (#1) | Presence/typing/read-receipts first; calls later (or hide) | Low (hide) / High (calls) |
| No news/announcements | Homepage news feed + wipe countdown | Low |

---

## Suggested sequencing (if/when you build)
1. **Cleanup & wiring (days):** #2, #3, #10, #9, hide #1 — removes all visible dead-ends.
2. **Make it feel live (1–2 wks):** real server player counts + next-wipe countdown (#4/#12), homepage news + wipe countdown.
3. **Engagement (1–2 wks):** Vote-for-rewards page (#2), achievements/badges on existing stats.
4. **Commerce (multi-wk):** real Stripe/PayPal + webhooks (#7/#8), then Admin Economy (#6) and in-game delivery.
5. **Hard problems:** Socket.IO scaling, fraud/webhook validation, voice/video calls.

*Nothing in the codebase was modified. Tell me which items to turn into a build plan or PR.*
