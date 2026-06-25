# Refactor Plan Conventions

Last reviewed: 2026-06-25

Shared rules so multiple agents stay consistent while extending the refactor plan.
These conventions complement (do not replace) the root [`AGENTS.md`](../../../AGENTS.md).

## Status Legend

| Symbol | Meaning |
| --- | --- |
| ⬜ | Todo — not started |
| 🔄 | In progress — actively owned |
| ✅ | Done — slice shipped and validated |
| ⏸️ | Blocked — waiting on a decision or another track |

Use the same symbols in track header blocks, per-step checkboxes, and the
[README.md](./README.md) tracks table.

## File Naming

- Track files use a two-digit ordinal prefix: `NN-short-kebab-topic.md`
  (e.g. `01-unify-api.md`). The ordinal reflects suggested sequencing, not strict
  dependency.
- Keep one track per file. Do not bundle unrelated work into a single file.
- Index/overview lives in `README.md`; shared rules live in this file.

## Track Header Block

Every track file starts with this block:

```
# <Title>

- **Owner**: Unassigned
- **Status**: ⬜ Todo
- **Last updated**: 2026-06-25
```

Followed by the **Problem / Goal / Steps / Validation** structure.

## Claiming and Owning a Task

1. Set `Owner:` from `Unassigned` to your owner/agent name.
2. Move `Status:` from `⬜ Todo` to `🔄 In progress`.
3. Bump `Last updated:` to the current date (ISO `YYYY-MM-DD`).
4. Work the steps top to bottom; tick checkboxes (`- [ ]` → `- [x]`) as each verifiable
   slice lands.
5. When all steps are done, set `Status:` to `✅ Done` and log a milestone (below).
6. If blocked, set `Status:` to `⏸️ Blocked` and note what you are waiting on.

Avoid editing a track file whose `Status` is `🔄 In progress` under another owner in
the same window; coordinate or pick a different track.

## Small Diffs

Per `AGENTS.md`, make incremental changes with clear commit messages. Each track is
decomposed into independently shippable slices — prefer one slice per PR. Land the
first "verifiable slice" of a track before expanding scope.

## Required Validation Commands

Run these (from `AGENTS.md` "How to Run Checks") after each change and before opening a
PR for any implementation work:

```bash
npm run lint              # tsc --noEmit type checking
npm run build             # production build (includes profile page cleanliness check)
npm run test:integration  # real server/database integration tests
```

A docs-only change to this plan does not require `build`/`test:integration`, but must
still keep `docs/ai/MEMORY.md` and `docs/ai/BACKLOG.md` "Last reviewed" dates fresh
(CI runs `scripts/ci/validate-ai-docs-dates.mjs`, max age 14 days).

## Logging Completed Milestones

When a slice or track ships, append an entry to the **Decisions Log** in
[`docs/ai/MEMORY.md`](../MEMORY.md) using the existing dated format:

```
**YYYY-MM-DD**: <what changed and why>, referencing the refactor-plan track
(e.g. docs/ai/refactor-plan/01-unify-api.md).
```

Also update the affected track header (`Status`, `Last updated`) and the
[README.md](./README.md) tracks table so the index stays accurate.
