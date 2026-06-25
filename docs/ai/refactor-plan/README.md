# NightDevWeb2 Refactor Plan

Last reviewed: 2026-06-25

A concrete, multi-track architecture refactor plan for the NightDevWeb2 games/forums
platform. The goal is to move the codebase toward a deployment-portable, scalable
shape: one source of truth for the API, externalized runtime state, a sustainable
real-time messaging host, and SEO-friendly routing.

This plan is a **planning/coordination scaffold only**. Tracks describe problems,
goals, incremental steps, and validation. Actual implementation happens in separate,
small PRs per `AGENTS.md`.

## Document Governance

- **Owner**: Platform Engineering (primary) with Frontend Engineering contributing on
  the routing track. Each track file additionally carries a per-track `Owner` that a
  collaborating agent claims.
- **Required update triggers**:
  - Architecture change update when a track's approach, sequencing, or chosen option
    changes.
  - Post-slice update when an agent completes a step/slice (tick the checkbox and bump
    the track's `Last updated`).
  - Cross-link update when a related `docs/ai/BACKLOG.md` risk or item changes status.
- **Review cadence**: Review weekly alongside `docs/ai/BACKLOG.md`.
- **Last reviewed**: 2026-06-25

## How Multiple Agents Collaborate

- **One track per file.** Pick a single track below and work it end to end before
  switching. Avoid editing another agent's active track file in the same window.
- **Claim a track** by setting the header block fields in that file: change
  `Owner: Unassigned` to your owner name and move `Status` from `⬜ Todo` to
  `🔄 In progress`. Bump `Last updated` to the current date.
- **Keep small diffs** per `AGENTS.md` ("Small diffs: make incremental changes with
  clear commit messages"). Each track is decomposed into independently shippable
  slices; land one slice per PR where possible.
- **Validate every change** with the commands in [CONVENTIONS.md](./CONVENTIONS.md)
  (`npm run lint`, `npm run build`, `npm run test:integration`).
- **Log milestones** back into `docs/ai/MEMORY.md` Decisions Log when a slice ships,
  per [CONVENTIONS.md](./CONVENTIONS.md).
- **Cross-link the backlog.** This plan operationalizes the
  [`Real-time Scaling`](../BACKLOG.md#real-time-scaling) risk and the
  [`Scalability Improvements`](../BACKLOG.md#scalability-improvements) item in
  `docs/ai/BACKLOG.md`. Keep those entries in sync as tracks progress.

See [CONVENTIONS.md](./CONVENTIONS.md) for the shared rules (status legend, naming,
claiming, validation, memory logging) before starting.

## Tracks

| # | Track | File | Status | Owner |
| --- | --- | --- | --- | --- |
| 1 | Unify the duplicate API | [01-unify-api.md](./01-unify-api.md) | ⬜ Todo | Unassigned |
| 2 | Externalize in-memory state | [02-externalize-state.md](./02-externalize-state.md) | ⬜ Todo | Unassigned |
| 3 | Real-time messaging host | [03-realtime-host.md](./03-realtime-host.md) | ⬜ Todo | Unassigned |
| 4 | History routing for SEO | [04-history-routing.md](./04-history-routing.md) | ⬜ Todo | Unassigned |

## Sequencing Notes

- **Track 1 unblocks the rest.** Eliminating the duplicate API surface (shared schemas,
  middleware, handlers) makes the state (Track 2) and real-time (Track 3) changes apply
  in exactly one place instead of two drifting copies.
- Track 2 and Track 4 can proceed in parallel once Track 1 has extracted the relevant
  shared modules.
- Track 3 depends on the deployment-topology decision and should be coordinated with
  the `Real-time Scaling` backlog risk owner.
