# NightRespawn (NightDevWeb2) — Incomplete Features Audit + Competitive Research Plan

**Prepared for:** ronald
**Scope:** (1) Locate incomplete features/tabs across the site, (2) research comparable gaming-community platforms for ideas. Originally a no-code audit; **status column refreshed 2026-11-25 against main `25ea65c`.**
**Stack:** React 19 + TS + Vite + Tailwind + TanStack Query (frontend); Node/Express + Socket.IO + SQLite/Turso/MySQL + JWT (backend); Stripe/PayPal SDKs.

---

## Part 1 — Incomplete Features & Dead-End Tabs (what's actually unfinished)

Severity legend: 🔴 user-visible dead-end · 🟡 simulated/partial · 🟢 hidden/gated · ⚪ cleanup

| # | Area | File / location | What's wrong | Sev | Status (2026-11-25) |
|---|------|-----------------|--------------|-----|---------------------|
| 1 | Messaging | `src/pages/MessagesPage.tsx` | Voice call, video call, conversation info, and conversation menu buttons are hard-`disabled` with "(coming soon)" labels | 🔴 | **Open.** |
| 2 | Left sidebar Quick Actions | `src/layouts/MainLayout.tsx` ~L752–783 | Originally Store, Vote, and Stats did nothing. | 🔴 | **Partial.** Store navigates to `/store`, Discord opens the invite, Stats navigates to `/servers`. **Vote still has no `onClick` and no vote page.** |
| 3 | Servers page | `src/pages/ServersPage.tsx` ~L241–244 | "VIEW STATS" button has no handler | 🔴 | **Open.** Still unwired on main `25ea65c`. |
| 4 | Servers page | `src/pages/ServersPage.tsx` | "Network Health" per-region (Frankfurt/London/NY/Singapore) was hardcoded to "OK" | 🟡 | **Done in [PR #245](https://github.com/ronaldmorgan99-tech/NightDevWeb2/pull/245).** The fake panel was removed and replaced by the Live Server Status panel at the top of `/#/servers`. |
| 5 | Servers page | `src/pages/ServersPage.tsx` ~L375–378 | "DOWNLOAD NETWORK TOOL" button has no asset or handler | 🔴 | **Open.** Still a plain button with no `onClick`. |
| 6 | Admin Settings | `src/pages/admin/AdminSettingsPage.tsx` ~L392 | **Economy tab** shows "Sector Under Construction" | 🔴 | **Open.** |
| 7 | Store checkout | `src/pages/StorePage.tsx` ~L105–131 | Stripe/PayPal checkout is **simulated** — no Stripe Elements or PayPal approval redirect | 🟡 | **Open.** Comments still say "for now, we'll simulate". |
| 8 | Payments backend | `src/lib/payments.ts` | `MOCK_PAYMENTS=1` returns fake intents/orders. Real SDK path exists. | 🟡 | **Partial.** Webhook signature verification now exists (`verifyStripeWebhookSignature`, `verifyPayPalWebhookSignature`). Checkout UI is still simulated; fraud/chargebacks are not built. |
| 9 | Admin Analytics | `src/pages/admin/AdminDashboard.tsx` ~L39 | "+12%" trend delta is hardcoded (example: Total Operatives card) | 🟡 | **Open.** |
| 10 | Orphaned page | `src/pages/CategoryPage.tsx` | Legacy page, not routed, old indigo theme, dead "New Thread" button | ⚪ | **Open.** Still unrouted in `src/App.tsx`. |
| 11 | Veo Studio | `/studio` route + `VITE_ENABLE_STUDIO` | Feature-gated off by default | 🟢 | **Unchanged.** Flag off renders Coming Soon, no redirect. |
| 12 | Integrations wiring | `AdminIntegrationsPage.tsx` vs Servers page | Admin can save `steam_api_key`, `network_servers` JSON, `twitch_client_id` | 🟡 | **Partial.** `steam_api_key` (and `STEAM_API_KEY`) is consumed for live NightRespawnPilot status in PR #245. The playtest server itself comes from `NIGHTRESPAWN_PILOT_*` env vars, not `network_servers`. Twitch / `network_servers` JSON are still unused by the public Servers page. |

### Already documented in your own backlog (`docs/ai/BACKLOG.md`)
- Store checkout UI is still simulated; webhook signature checks exist, but fraud detection and subscription edge cases are still uncovered.
- Real-time scaling risk: Socket.IO + SQLite won't scale horizontally.
- Media generation = vendor lock-in on Gemini/Veo.
- Admin catalog input sanitization still pending.

**Quick wins still open:** finish #2 (Vote destination), #3 (VIEW STATS), #5 (Download Network Tool), #10 (delete orphan page), #9 (remove or compute the fake +12%). **Bigger projects still open:** #6 (admin economy), #7/#8 (real checkout). **Shipped:** #4 live status (PR #245); part of #2 (Store/Stats wiring); part of #8 (webhook signatures); part of #12 (`steam_api_key` consumed).

---

## Part 2 — Competitive Research (ideas from sites like yours)

Your site is a **Rust-style game-server community** (wipe schedules, raids, kills, K/D, wealth, server browser, store, forums, messaging, profiles). I looked at how the category leaders handle each pillar.

### A. Server browser & live data — *BattleMetrics* (battlemetrics.com)
The gold standard for game-server tracking. Concrete ideas to steal:
- **Live player counts** `current/max` per server, updated continuously (NightRespawnPilot can be live via Steam when a Web API key is set; without a key the panel shows Unknown).
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
1. **Cleanup & wiring (days):** remaining #2 (Vote), #3, #5, #10, #9, hide #1 — removes the visible dead-ends that are still on main.
2. **Make it feel live (remaining):** next-wipe countdown and richer homepage/news treatment. Real NightRespawnPilot status already shipped in PR #245 (needs a Steam Web API key in production to leave the Unknown state).
3. **Engagement (1–2 wks):** Vote-for-rewards page (#2), achievements/badges on existing stats.
4. **Commerce (multi-wk):** real Stripe/PayPal checkout UI (#7), then Admin Economy (#6) and in-game delivery. Webhook signature checks already exist.
5. **Hard problems:** Socket.IO scaling, fraud/chargeback handling, voice/video calls. Unify the remaining duplicated API surface (`docs/ai/refactor-plan/01-unify-api.md`), including the register password min-length drift (8 vs 6).

*Status updated 2026-11-25 against main `25ea65c`. Competitive research in Part 2 is unchanged.*
