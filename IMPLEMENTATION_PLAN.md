# Implementation Plan — Overnight Audit Pass
**Date:** 2026-08-14

---

## Architecture Summary

**Stack:** React 18 + TypeScript + Zustand + Vite, deployed to GitHub Pages as a PWA.

**Core layers:**
- `src/engine/` — Pure functions (rotation/scheduling logic, calendar projection, program parsing). Stateless; all state is passed in.
- `src/store/` — Seven Zustand stores, all persisted to `localStorage` via versioned `persist` middleware. Stores are isolated with cross-store calls done via `getState()`.
- `src/pages/` + `src/components/` — React UI, using hooks that compose store selectors and engine functions.
- `src/lib/` — Utilities (stats computation, CSV, date helpers, expression evaluator).
- `src/modules/` — Domain modules (workout outcomes, run adaptation, progression recommendations).
- `src/programs/` — YAML workout program definitions.

**Key invariants:**
- All calendar dates are `YYYY-MM-DD` local-time strings throughout.
- `HistoryEntry` for a given `(planId, calendarDate)` pair is deduplicated on write (newest createdAt wins).
- The rotation pointer advances on `complete | skip | day_off`; unlogged past days stall the pointer.
- `WorkoutOutcome` is keyed by `workoutInstanceId = planId_YYYY-MM-DD` (or `..._extra_extraId` for ad-hoc).

---

## Product Capability Summary

- **Today View:** Resolves which workout is scheduled, shows pending/complete state, supports full workout tracking (weights, run, mobility), ad-hoc "extra" workouts, and double-day flow.
- **Calendar View:** Month grid with rotation overlay, retroactive logging via jump overrides, per-day detail modals.
- **History View:** Reverse-chronological log with PR badges, per-exercise session records.
- **Plans:** CRUD for custom plans; YAML program import with variable-based progression rules.
- **Mobility:** Daily routine with completions, library, custom templates.
- **Stats:** Streak, completion rate, plan progress, cycle progress, workout type breakdown, weekly breakdown, PRs.
- **Cloud Sync:** Supabase opt-in; CSV export/import as fallback.

---

## What Appears Strong and Well-Designed

1. **Rotation engine** — Pure functions, no side effects, comprehensive edge-case tests (887 lines). Consistent handling of overrides, deduplication, and the stall-on-unlogged invariant.
2. **Test coverage** — 1238 tests across 35 files; all passing. All critical logic paths covered.
3. **Error resilience in progression** — `logOutcomeWithProgression` wraps every progression-rule evaluation in `try/catch` so a malformed YAML rule can never prevent an outcome from being saved.
4. **Deduplication discipline** — Store writes, imports, and stats computations consistently apply dedup logic so duplicate entries don't inflate counts.
5. **UTC-safe date arithmetic** — `historyStats.ts` uses `Date.UTC` for streak/window math, avoiding DST shift bugs.
6. **Expression evaluator** — Hand-rolled recursive descent parser with no `eval()`, supporting complex YAML progression rules safely.

---

## Key Issues and Risks

### P1 — Missing test coverage for critical edge cases

**`expressionEval.ts` — `evaluateUpdates` multi-statement path:**
The `splitStatements` function uses parenthesis-depth tracking to avoid splitting `min(a, b)` on the inner comma. This is the correct algorithm, but the behavior is **untested**. A regression here would silently corrupt YAML-driven progression variables.

**`workoutInstanceId.ts` — `parseWorkoutInstanceId` with extra IDs:**
Extra workout instance IDs (`planId_YYYY-MM-DD_extra_extraId`) are parsed by the same function used for rotation IDs. The function is tested for basic cases but not for the extra-ID format.

**`historyStats.ts` — `computeConsecutiveSkips` plan isolation:**
The skip streak correctly scopes extras and break-dates to the given plan, but this is untested. A bug here would cause the skip-warning banner to fire incorrectly.

### P2 — Missing useful stat: average workouts per week

The stats layer has streak, completion rate, weekly breakdown, best week, and plan progress — but no `computeAverageWorkoutsPerWeek`. This is a commonly expected fitness metric that would be useful in the Plan Progress modal.

### P3 — `expressionEval.ts` — Silent fallback in `parsePrimary`

When the parser encounters an unexpected token (e.g. `comma` or `rparen` in an unexpected position), it silently returns `{ k: 'num', v: 0 }`. No warning is emitted even in development. This makes YAML expression debugging harder.

### P4 — `workoutInstanceId.ts` — Safety assumption not documented

`parseWorkoutInstanceId` uses `indexOf('_YYYY-MM-DD')` to locate the planId boundary. This is safe because planIds are hex-only nanoids (no date-like substrings), but this assumption is undocumented. A future change to the ID alphabet could silently break ID parsing.

### P5 — `computeHistoryStats.totalLogged` counts raw array length

The store prevents duplicate `(planId, calendarDate)` entries via `addEntry`, but `computeHistoryStats` assumes this and does not re-deduplicate. Bad data (e.g. corrupted localStorage) could inflate `totalLogged`. Low risk in practice.

### P6 — Calendar week starts on Sunday (hardcoded)

`buildMonthGrid` uses `weekStartsOn: 0` (Sunday). International users expect Monday-first. No user-configurable setting exists.

---

## Prioritized Plan

| Priority | Item | Action | Rationale |
|---|---|---|---|
| 1 | Test: `evaluateUpdates` multi-statement edge cases | Implement | Untested critical progression path |
| 2 | Test: `parseWorkoutInstanceId` with extra IDs | Implement | Untested ID format used in outcomes |
| 3 | Test: `computeConsecutiveSkips` plan isolation | Implement | Untested skip-streak scoping |
| 4 | Feature: `computeAverageWorkoutsPerWeek` | Implement | Useful missing metric; clean addition |
| 5 | Doc/guard: `parsePrimary` silent fallback | Implement | Add dev-mode warning for easier debugging |
| 6 | Doc: `parseWorkoutInstanceId` assumption | Document | Low-risk, but worth capturing |
| 7 | UX: Calendar week start configurable | Recommend only | Requires settings infrastructure |
| 8 | Refactor: TodayPage state extraction hook | Recommend only | 1150-line file; risky mid-audit |
| 9 | Stats: `totalLogged` dedup at stats layer | Recommend only | Low risk, defensive change |

---

## Rationale for Sequencing

Tests first — they validate existing behavior before any changes. The new stat function (`computeAverageWorkoutsPerWeek`) is purely additive and won't affect existing tests. The `parsePrimary` warning is additive and dev-only so it cannot break production behavior. Calendar week start and TodayPage refactor are left as recommendations because they require product decisions and broader UI changes.
