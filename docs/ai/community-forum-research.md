# NightRespawn — Community / Forum Platform Research (Addendum)

You were right: my first round leaned on **tracker/metrics** sites (BattleMetrics-style). This addendum focuses on **gaming-community sites like yours** — ones built around **player profiles + server info + discussion/forums**.

---

## Closest match to your model — Rustafied (rustafied.com + forum.rustafied.com)
A real Rust community. Structure: **Updates** (news/devblog) · **Guides** · **Servers** (their own list + status) · **VIP forum** (Invision Community) · **Support** (FAQ + request) · **my.rustafied.com** member portal. This is exactly "news + guides + servers + forum + profiles + membership."

Ideas you don't have yet:
- **News / Updates feed on the homepage** (devblog-style posts) — drives return visits; you have forums but no editorial news.
- **Guides / wiki section** — evergreen content (server rules, how-to, wipe info).
- **Member/VIP portal** — manage subscription, perks, linked account in one place.
- **Support as structured forms** — FAQ + "Support Request" (you have Support; templating it as FAQ + ticket form matches the pattern).

## Discord alternative — Guilded (guilded.gg)
"Group chat + integrated **event calendars, forums, polls, lists**." Ideas:
- **Forum channels alongside chat** (you already have both — lean into linking them).
- **Event calendar**: wipe days, tournaments, community nights with RSVP.
- **Polls** inside discussions (e.g. "next wipe schedule?").

## The forum engines themselves — Invision Community / XenForo
Rustafied's forum runs on **Invision Community**; most game communities use it or XenForo. Their standard feature set is the benchmark for "discussion + profiles":
- **Rich member profiles**: cover photo, "About me", post count, **reputation/points**, **badges/trophies**, followers, recent activity. (Yours show game stats — adding social/rep layers makes them full profiles.)
- **Activity stream / "All Activity" / Discover** — one aggregated feed of new posts across the site.
- **Reactions** (like/thanks) + **reputation** + a **top-members leaderboard** — engagement loop.
- **Clubs / sub-groups** — per-clan or per-server mini-communities (fits your Rust "clan" concept).
- **Status updates** — lightweight social posts on profiles.
- **Thread prefixes/tags, polls, follow/subscribe, site-wide search.**

## Game-linked profiles — Steam Community
- Profiles tied to **Steam ID** with verified game info, **announcements**, **discussions**, **events** per group. Reinforces sourcing your kills/K/D/playtime from Steam so stats are trustworthy.

---

## Gap analysis vs. these community sites
You already have: forums, profiles w/ game stats, real-time messaging, store. Compared to the community model, you're **missing the engagement & content layer**:

| Missing piece | Seen on | Effort | Why it matters |
|---|---|---|---|
| Homepage **news/updates feed** | Rustafied, Steam | Low | Gives a reason to return; anchors the community |
| **Guides / wiki** section | Rustafied | Low–Med | Evergreen content + SEO |
| **Activity stream** ("All Activity") | Invision/XenForo | Med | Surfaces new discussion site-wide |
| **Reactions + reputation + member leaderboard/trophies** | Invision/XenForo | Med | Core engagement loop; rewards posting |
| **Richer profiles** (rep, badges, followers, About me, activity) | Invision/XenForo, Steam | Med | Turns stat cards into real social profiles |
| **Event calendar** (wipes/tournaments, RSVP) | Guilded | Med | Organizes community around wipe cycle |
| **Clubs / sub-groups** (per clan/server) | Invision | Med–High | Sub-communities for clans |
| **Polls + status updates** in discussion | Guilded, Invision | Low | Cheap interactivity |
| **Server info woven into discussion/profiles** | Rustafied | Med | Tie server status to forum + profile (vs. isolated Servers tab) |

## Suggested community-focused order
1. **Content & return-visits (low effort):** homepage news/updates feed + a Guides section.
2. **Engagement loop (med):** reactions + reputation + member leaderboard/trophies; richer profiles (badges, followers, About me, activity).
3. **Discovery (med):** site-wide "All Activity" stream + better search.
4. **Organize the community (med):** event calendar (wipe/tournament RSVP), polls/status updates.
5. **Sub-communities (higher):** clubs/groups per clan or per server, with server info surfaced inside.

*Still no code changed — say the word and I'll turn any of this into a build plan or PR.*
