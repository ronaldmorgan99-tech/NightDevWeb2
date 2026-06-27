# NightRespawn — Site Feature Inventory

A self-inventory of NightRespawn (NightDevWeb2), written in the same style as `community-forum-research.md` — but describing **what this site already has**, organized by the same community pillars (profiles · server info · discussion · commerce · membership). Use it as a quick map of the platform.

**Stack:** React 19 + TS + Vite + Tailwind + TanStack Query (frontend) · Node/Express + Socket.IO + SQLite/Turso/MySQL + JWT (backend) · Stripe/PayPal SDKs · Google Gemini/Veo (media).

---

## Discussion / Forums
The home surface of the site. Route `/` renders the forums index.
- **Forums index** (`ForumsPage`, route `/`) — browse sectors/categories.
- **Forum view** (`ForumViewPage`, `/forums/:id`) — threads within a sector.
- **Create thread** (`CreateThreadPage`, `/forums/:id/new`) — post a new discussion.
- **Thread view** (`ThreadViewPage`, `/threads/:id`) — read + reply, with report modal.
- Cyberpunk-themed "sectors" terminology for categories.

## Player profiles
- **Profile** (`ProfilePage`, `/profile` and `/profile/:id`) — the "Operative Dossier."
- **Game telemetry per server**: playtime, total wealth, kills, K/D ratio, vehicles owned, raids completed, wipe performance, bank balance, cash on hand (DB-backed via `/api/users/:id/game-stats`).
- **Wealth Accumulation Index** — historical wealth-trend chart from transactions.
- **Server wheel** — switch which server's stats you're viewing.
- **Wealth leaderboard** (`/api/leaderboards/wealth`).
- **Members directory** (`MembersPage`, `/members`) — browse/search users ("Scanning Network").

## Server info
- **Servers page** (`ServersPage`, `/servers`) — server browser / network view.
- Region "Network Health" panel and download CTA (note: region health is currently hardcoded — see `incomplete-features-and-ideas-plan.md`).

## Real-time messaging
- **Messages** (`MessagesPage`, `/messages`) — 1:1 real-time chat ("Neural Link") over Socket.IO.
- Conversation list + live message stream, monotonic conversation merging, programmatic-scroll handling.
- (Voice/video/info/menu buttons are present but disabled "coming soon".)

## Commerce / economy
- **Store** (`StorePage`, `/store`) — purchase flow with Stripe + PayPal SDKs (checkout currently simulated; `MOCK_PAYMENTS` fallback exists).
- Credits/"wealth" economy concept tied to profiles.

## Membership / accounts / auth
- **Register** (`RegisterPage`, `/register`) and **Login** (`LoginPage`, `/login`) — JWT auth, bootstrap admin/member accounts on first run, CSRF double-submit-cookie protection.
- **Settings** (`SettingsPage`, `/settings`) — account/preferences.
- "Uplinked" account-creation timestamp in the UI.

## Support & info
- **Support / Contact** (`SupportPage`, `/support` and `/contact`) — support requests.
- **Help** (`HelpPage`, `/help`).
- **Info pages** (`InfoPage`) — `/rules`, `/privacy`, `/terms`.

## Integrations & community links
- **Discord page** (`DiscordPage`, `/discord`) + sidebar Discord quick-action (guild `1480660543869161562`, invite `discord.gg/3axtkUBN`).
- Admin-configurable integrations: Discord webhook, X/Twitter, **Steam Web API key**, Twitch client ID, network-servers JSON.

## AI media — Studio (feature-gated)
- **Veo Studio** (`VeoStudioPage`, `/studio`) — AI video generation via Gemini/Veo.
- Gated behind `VITE_ENABLE_STUDIO`; shows `StudioUnavailablePage` when off.

## Admin panel (`/admin`)
Full back-office under `AdminLayout`:
- **Dashboard** (`/admin`) · **Users** (`/admin/users`) · **Moderation** (`/admin/moderation`)
- **Forums/Sectors** (`/admin/forums`) · **Tags** (`/admin/tags`)
- **Store** (`/admin/store`) · **Integrations** (`/admin/integrations`) · **Analytics** (`/admin/analytics`)
- **Support** (`/admin/support`) · **Settings** (`/admin/settings`)
- (Settings → Economy tab is currently "Under Construction".)

---

## How this maps to the community model (vs. `community-forum-research.md`)
| Community pillar | NightRespawn status |
|---|---|
| Discussion / forums | ✅ Full (index, sectors, threads, replies, reports) |
| Player profiles | ✅ Strong — game telemetry, wealth trend, leaderboard (missing social/rep layer) |
| Server info | 🟡 Page exists; data partly hardcoded, not yet live |
| Real-time messaging | ✅ 1:1 chat (no voice/video; no presence/read receipts yet) |
| Commerce / economy | 🟡 Store + SDKs present; checkout simulated |
| Membership / auth | ✅ JWT register/login/settings + CSRF |
| Support & info | ✅ Support/Help/Rules/Privacy/Terms |
| Integrations | ✅ Discord + admin keys (Steam/Twitch wiring partial) |
| AI media (Studio) | 🟢 Built, feature-gated off |
| Admin panel | ✅ Broad (one tab under construction) |
| News/updates feed | ❌ Not present |
| Guides / wiki | ❌ Not present |
| Activity stream | ❌ Not present |
| Reactions / reputation / badges | ❌ Not present |
| Event calendar | ❌ Not present |
| Clubs / sub-groups | ❌ Not present |

*Legend: ✅ present · 🟡 partial/simulated · 🟢 built but hidden · ❌ not present. Companion docs: `community-forum-research.md` (competitor ideas) and `incomplete-features-and-ideas-plan.md` (gaps + sequencing).*
