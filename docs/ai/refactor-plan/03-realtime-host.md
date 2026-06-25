# Track 3 — Real-time Messaging Host

- **Owner**: Unassigned
- **Status**: ⬜ Todo
- **Last updated**: 2026-06-25

## Problem

Real-time messaging uses **Socket.IO bound to a long-lived `http.Server`**, initialized
only in [`server.ts`](../../../server.ts#L523) (~line 523):

```ts
const server = http.createServer(app);   // ~line 523
const io = new Server(server, { ... });  // ~line 525
io.on('connection', (socket) => { ... }); // ~line 856
```

The serverless gateway ([`api/[...path].ts`](../../../api/[...path].ts)) has **no
Socket.IO** — serverless functions are short-lived and cannot host the persistent
WebSocket connections Socket.IO needs. So real-time messaging only works when the app is
run as the long-lived Express server, not in the serverless deployment model the rest of
the API targets. This is the architectural gap behind the
[`Real-time Scaling`](../BACKLOG.md#real-time-scaling) backlog risk (Socket.IO + SQLite
won't scale; no persistence/delivery guarantees; connection limits unset).

## Goal

Choose and document a real-time hosting strategy that is compatible with the deployment
topology and scales horizontally, then migrate the client/server wiring to it.

## Options

| Option | Summary | Pros | Cons |
| --- | --- | --- | --- |
| A. Dedicated always-on socket host | Run Socket.IO on a separate long-lived service/process (e.g. a small Node host or container) alongside the serverless API | Keep existing Socket.IO code; full control; works with `serverless` frontend/API | Extra service to operate/scale; needs shared adapter (e.g. Redis) for multi-instance fan-out; cross-origin/auth wiring |
| B. Managed real-time service (Pusher / Ably) | Offload transport to a hosted pub/sub; server publishes events via REST, client subscribes via SDK | No socket infra to run; built-in scaling, presence, history; serverless-friendly | Vendor dependency/cost; rewrite of emit/subscribe call sites; auth via signed channels |

Both options require moving message fan-out state off per-process memory — coordinate
with [Track 2](./02-externalize-state.md) (Redis) and the
[`Real-time Scaling`](../BACKLOG.md#real-time-scaling) mitigation
(`Add Redis for session persistence, implement connection limits`).

## Decision Checklist

- [ ] Confirm target deployment topology (pure serverless vs serverless + always-on
  service) with the platform owner.
- [ ] Inventory all Socket.IO emit/listen call sites in `server.ts` (rooms per thread,
  connection auth via cookie parsing) to size the migration.
- [ ] Decide Option A vs Option B; record the decision and rationale in
  `docs/ai/MEMORY.md`.
- [ ] If Option A: choose the host runtime and add a horizontal-scaling adapter (e.g.
  `@socket.io/redis-adapter`) backed by the Track 2 store.
- [ ] If Option B: select provider, define channel/auth model (signed channels), and map
  existing rooms to channels.
- [ ] Define connection limits and message persistence/delivery expectations (the
  backlog notes neither is configured today).
- [ ] Plan the client migration in `socket.io-client` / messaging pages and a rollback
  path.

## Steps

- [ ] **Slice 1 (first verifiable slice): decision record.** Complete the checklist
  above and commit the chosen option to `docs/ai/MEMORY.md`. (Doc-only; no code.)
- [ ] **Slice 2: scaffold the chosen host/provider** behind env config without removing
  the existing path (feature-flag the new transport).
- [ ] **Slice 3: migrate one message flow** (e.g. a single thread room) end to end as a
  proof of concept; verify real-time delivery.
- [ ] **Slice 4: migrate remaining flows**, add connection limits, and wire
  persistence/delivery guarantees as decided.
- [ ] **Slice 5: remove the legacy in-process Socket.IO path** (or document why it
  remains for local dev) and update the backlog risk status.

## Validation

```bash
npm run lint
npm run build
npm run test:integration
```

Plus a manual/integration real-time check: two clients exchange messages through the new
transport and observe delivery; verify behavior across more than one server instance for
Option A.

## Cross-links

- Backlog risk: [`Real-time Scaling`](../BACKLOG.md#real-time-scaling)
- Depends-on: [Track 2](./02-externalize-state.md) (shared store / Redis adapter)
