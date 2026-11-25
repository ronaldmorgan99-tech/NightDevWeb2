# NightRespawn — Platform Architecture & Feature Inventory

**Repository:** NightDevWeb2

NightRespawn is a **cyberpunk-styled community operations platform for multiplayer gaming networks** — designed to unify discussion, player telemetry, economy systems, messaging, moderation, and AI-powered media tooling under one interface.

Unlike traditional forums that only handle discussion, NightRespawn functions as a hybrid between a **gaming forum, server control panel, player analytics dashboard, and digital economy platform**.

> Companion docs: `community-forum-research.md` (competitor ideas) and `incomplete-features-and-ideas-plan.md` (gaps + sequencing).
>
> Reviewed 2026-11-25 against main `25ea65c` (through PR #245).

---

## Core philosophy
- Community-first discussion
- Persistent player identity across servers
- Real-time interaction
- Server intelligence / telemetry
- Economy-driven engagement
- Staff-grade moderation tooling
- Expandable AI-enhanced media features

---

## Technology stack

### Frontend
React 19 · TypeScript · Vite · Tailwind CSS · TanStack Query · Socket.IO client

**Responsibilities:** SPA routing · live state synchronization · optimistic UI updates · interactive dashboards · real-time messaging.

### Backend
Node.js · Express · Socket.IO · JWT authentication · role-based access control

**Responsibilities:** authentication · authorization · API routing · real-time events · moderation controls · telemetry aggregation.

### Database layer
Supported persistence engines: **SQLite** (development) · **Turso / libSQL** · **MySQL** (migration-safe, idempotent schema across dialects).

Stores: users · categories/forums · threads · replies · game stats · wealth records · transactions · moderation events · messages · integrations config · support tickets.

---

## How the systems connect
NightRespawn's value is in the **links** between subsystems, not any single page:

```
Auth/Roles ──┬─> Forums/Threads ──> Moderation (reports) ──> Admin
             ├─> Profile (Operative Dossier) <── Game stats / Wealth / Transactions
             ├─> Messaging (Neural Link, Socket.IO)
             ├─> Store ──> Economy (credits/wealth) ──> Profile wealth index
             └─> Integrations (Discord/Steam/Twitch) ──> Servers + Profile telemetry
Admin control plane oversees: users · roles · forums · store · integrations · analytics · support
```

- **Identity is the hub.** A user's role gates forum posting (`min_role_to_thread` per forum), moderation powers, and the admin panel; the same identity carries the profile dossier, messages, store purchases, and economy records.
- **Forum ↔ profile:** posts/replies link back to the author's dossier (which also exposes their server telemetry).
- **Economy ↔ profile:** store purchases and in-game transactions feed the profile's Wealth Accumulation Index and the wealth leaderboard.
- **Integrations ↔ servers/profile:** admin-configured Steam/Twitch/Discord keys are the intended source for live server data and verified player stats.
- **Admin ↔ everything:** the `/admin` control plane manages users, sectors, store, integrations, analytics, support, and moderation in one back office.

---

## Core platform systems

### 1. Community discussion system
Public-facing foundation. NightRespawn brands categories as cyberpunk-themed **Sectors** while preserving familiar forum mechanics. Structure is two-level: **categories → forums**, with per-forum minimum-role-to-post permissions.

- **Home** (`/`) — marketing/landing page (`HomePage`), not the forum index.
- **Forums index** (`/forums`) — sector/forum discovery, thread counts, activity overview, latest discussion.
- **Sector / forum view** (`/forums/:id`) — threads in a forum, metadata, creation shortcut. Posting can be gated to `member` / `moderator` / `admin`.
- **Create thread** (`/forums/:id/new`).
- **Thread system** (`/threads/:id`) — thread + flat replies, content persistence, **moderation reporting** (report modal), post overflow menu (PRs #241/#244), and an **Edited** label when `edited_at` is set (PR #242).
- **Permissions** (shared `src/lib/forumPermissions.ts`, used by both API entrypoints, PR #242): authors can soft-delete their own posts (not if a moderator hid them); locked threads reject replies except from staff; pin/lock/hide are staff-only; authors or staff can mark solved or delete a thread.

**Maturity:** Production-ready for the core loop. Shared permission module is in place; other API schemas can still drift between `server.ts` and `api/[...path].ts`.

### 2. Player identity & Operative Dossier
One of NightRespawn's strongest differentiators. Instead of generic profiles, players have persistent **Operative Dossiers** combining social identity with server-derived telemetry.

- **Routes:** `/profile`, `/profile/:id`; **Members directory** at `/members`.
- **Social identity:** avatar, banner, bio, and linked accounts (Steam, X, Facebook, GitHub, YouTube, Kick, Twitch, Discord).
- **Per-server telemetry:** playtime · wealth · kills · K/D ratio · vehicles owned · raids completed · wipe performance · cash on hand · bank balance.
- **Server context switching:** the **Server Wheel** rotates one account across multiple server identities.
- **Wealth intelligence:** historical wealth growth, **Wealth Accumulation Index**, transaction trends, economic ranking.
- **APIs:** `/api/users/:id/game-stats`, `/api/leaderboards/wealth`.

**Maturity:** Advanced / differentiated — closer to MMO/game-backend analytics than a forum profile.
**Note:** social *links* and telemetry exist; a *social engagement* layer (reputation, badges, reactions, followers) does not yet.

### 3. Server intelligence layer
- **Route:** `/servers` — server listing plus the **Live Server Status** panel at the top (PR #245). The fake per-region Network Health panel (Frankfurt/London/NY/Singapore, hardcoded "OK") was removed.
- **NightRespawnPilot source:** env vars `NIGHTRESPAWN_PILOT_ENABLED`, `NIGHTRESPAWN_PILOT_SERVER_CODE`, `NIGHTRESPAWN_PILOT_INTERNAL_ADDRESS`. The Server Code changes on every dedicated-server restart.
- **Live check:** Steam Web API `IGameServersService/GetServerList` by Unturned app id and server name, matched on the Server Code. Key is `STEAM_API_KEY` or admin setting `steam_api_key`. States: Online (listed, real player count), Offline (Steam answered, not listed), Unknown / not verified (no key, error, or timeout). Confirmed results are cached for 30 seconds. The server card, stat tiles, and sidebar Network Status widget share this status.
- **Join:** `steam://run/304930//+connect <code>/` when Online; "Try joining with Steam" when Unknown; no join button when Offline.
- Still unwired on this page: **Download Network Tool** and **View Stats**.
- **Planned / not built:** tick rate, ping distribution, queue counts, crash detection, uptime %, next-wipe countdown.

**State:** 🟡 Live NightRespawnPilot status is real when a Steam Web API key is configured; otherwise the panel correctly shows Unknown. Other telemetry (wipe countdown, `network_servers` JSON, Twitch) is not consumed yet.

### 4. Real-time communication layer — "Neural Link"
- **Route:** `/messages` (Socket.IO).
- **Implemented:** 1:1 chat · conversation persistence · live delivery · scroll-state management · monotonic conversation merging.
- **Planned:** read receipts · presence · typing signals · voice · video · file attachments.

**State:** Strong foundation; social expansion pending (voice/video/info buttons present but disabled).

### 5. Commerce & economy layer
- **Route:** `/store`. Payment providers: **Stripe**, **PayPal**.
- **Flows:** product catalog · checkout (currently simulated) · credits purchasing · wealth-conversion logic.
- **Fallback:** `MOCK_PAYMENTS` mode enables testing without live processing.
- **Future monetization:** battle passes · premium memberships · cosmetics · server boosts · currency packs.

**Maturity:** 🟡 Infrastructure present; production payments incomplete.

### 6. Membership & authentication
- **Routes:** `/register`, `/login`, `/settings`.
- **Security:** JWT in an httpOnly `token` cookie (24h) · Steam OpenID (`/api/auth/steam`) · session persistence · bootstrap accounts (admin + member on first run) · CSRF double-submit cookie · protected routes.
- **Role model (4 roles):**

| Role | Access |
|---|---|
| `member` | Standard community participation |
| `moderator` | Community moderation |
| `admin` | Full platform control |
| `suspended` | Restricted / blocked |

Forums additionally enforce a `min_role_to_thread` per forum.

**Maturity:** Production-capable.

### 7. Support & policy layer
- **Routes:** `/support`, `/contact`, `/help`, `/rules`, `/privacy`, `/terms`.
- **Purpose:** user support · policy disclosure · rule enforcement · legal compliance. Present and functional. Support/contact **content is visible to signed-out visitors**; opening or reviewing tickets requires sign-in (PR #240).

### 8. External integrations
- **Discord** (`/discord`) — guild `1480660543869161562`, invite `discord.gg/3axtkUBN`.
- **Admin-configurable adapters:** Discord webhooks · X · Steam API · Twitch API · network-servers JSON feeds.

**Maturity:** Mixed — config storage works. `steam_api_key` is now consumed for live server status (PR #245). `network_servers` JSON and Twitch are not yet consumed by the public Servers page; NightRespawnPilot comes from env vars.

### 9. AI media studio — "Veo Studio"
- **Route:** `/studio` (Google Gemini / Veo video generation).
- **Capabilities:** AI video generation · media-assisted content · community promotional assets.
- **Feature flag:** `VITE_ENABLE_STUDIO`; when off, `ComingSoonPage` is rendered at `/studio` (imported as `StudioUnavailablePage` in `App.tsx`). There is no redirect.

**Status:** 🟢 Built but hidden behind a feature gate — unusual for gaming-community software and a real differentiator.

---

## Administrative control plane (`/admin`)
A full operational back office under `AdminLayout`:

Dashboard · Users · Moderation · Forums (Sectors) · Tags · Store · Integrations · Analytics · Support · Settings.

**Capabilities:** user/role management · report handling · sector control · store management · platform metrics · integration secrets · operational analytics. (Settings → Economy tab is currently "Under Construction".) This effectively turns NightRespawn into a **community management OS**.

---

## Missing / planned systems
**Content & community:** ✅ `/news` feed exists (backed by `/api/news`; it can be empty) · ❌ wiki/guides · ❌ dedicated patch-notes system · ❌ homepage wipe countdown
**Social systems:** ❌ reputation · ❌ reactions · ❌ badges · ❌ activity feed
**Group systems:** ❌ guilds/clubs · ❌ teams/squads
**Events:** ❌ event calendar · ❌ tournament scheduling · ❌ server-event automation

---

## Architectural assessment

**Strengths:** strong thematic branding · unusually deep player telemetry · full admin suite · hybrid forum + analytics model · AI feature-expansion path.

**Weaknesses:** several systems still mocked or unwired (Vote, Download Network Tool, View Stats, simulated checkout) · missing social retention loops · server telemetry is live for NightRespawnPilot only when a Steam key is set · payments not production-complete.

### Maturity score
| Pillar | Status |
|---|---|
| Forums | 9 / 10 |
| Profiles | 9.5 / 10 |
| Messaging | 7 / 10 |
| Economy | 6.5 / 10 |
| Server telemetry | 7 / 10 (live Steam status for NightRespawnPilot; other telemetry still planned) |
| Admin tooling | 9 / 10 |
| Social systems | 4 / 10 |
| AI tooling | 8 / 10 |

---

## Final product classification
NightRespawn is **not merely a forum**. It sits between **Discord** (community communication), **Steam** (player identity), **BattleMetrics** (server analytics), **Patreon** (monetization), and modern **AI media tooling**.

> **NightRespawn is a cyberpunk community operating system for multiplayer gaming networks.**

*Legend: ✅ present · 🟡 partial/simulated · 🟢 built but hidden · ❌ not present.*
