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

**`programParser.ts` — duration/coercion/description paths (resolved 2026-08-20):**
All previously untested paths in `programParser.ts` are now covered: `parseDurationSecs`, `coerceWorkoutType`, validation error reporting, `validateYamlProgram`, and `buildStructureDescription`. 20 new tests added; test count 1268 → 1288.

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

---

## Additions — 2026-08-15

### Changes implemented this pass

| # | Item | Type | Files |
|---|---|---|---|
| 1 | `useToday`: add `visibilitychange` listener for device-wake edge case | Bug fix | `src/hooks/useToday.ts` |
| 2 | `allSetsHitTarget`: simplify from two parameters to one | Refactor | `src/modules/workout-outcomes/progression.ts` |
| 3 | `computeHistoryStats`: deduplicate rotation entries in `totalLogged` / `totalCompleted` | Defensive fix | `src/lib/historyStats.ts` |

### Detail

**1. `useToday` visibilitychange bug**
The hook only used `setTimeout` for midnight refresh. If the device sleeps and the OS pauses or delays the timer, the app would show "yesterday" until something forced a re-render. Adding a `visibilitychange` listener that re-checks the date whenever the page becomes visible catches the device-wake edge case immediately. The `[today]` dep already re-schedules the `setTimeout` on each date change; the new listener just adds a second trigger.

**2. `allSetsHitTarget` single-parameter refactor**
The original signature `(allSets, completedSets)` ran the `completed` check over `allSets` and the `targetReps` check only over `completedSets`. This was semantically correct but redundant: any set that passes `s.completed` in the first loop would also appear in `completedSets` since `completedSets` was defined as `allSets.filter(s => s.completed)`. The refactor collapses both checks into a single `sets.every(s => { if (!s.completed) return false; ... })` predicate. All three call sites updated. No behaviour change.

**3. `computeHistoryStats` deduplication**
`totalLogged` was counting `entries.length` directly, assuming the store always enforces the one-entry-per-(planId, calendarDate) invariant. The store does enforce this on write, but `importEntries` and old persisted data could create duplicates in the array. The fix collapses `entries` to a `Set` keyed by `planId__calendarDate` before sizing — the same pattern used by `isPlanExpired` and `computePlanProgress`. `totalCompleted` receives the same treatment.

### Status of previous items

| P# | Item | Status |
|---|---|---|
| P1 (multi-statement tests) | Covered in 2026-08-14 pass (`expressionEval.test.ts` 79 tests) | Done |
| P2 (`computeAverageWorkoutsPerWeek`) | Implemented 2026-08-14 | Done |
| P3 (`parsePrimary` warning) | Implemented 2026-08-14 | Done |
| P4 (`parseWorkoutInstanceId` doc) | Implemented 2026-08-14 | Done |
| P5 (`totalLogged` dedup) | Implemented 2026-08-15 (change 3 above) | Done |
| P6 (calendar week start) | Recommendation only — not implemented | Open |

---

## Additions — 2026-08-16

### Changes implemented this pass

| # | Item | Type | Files |
|---|---|---|---|
| 1 | `CalendarPage`: preserve jump override when marking a jumped date as `day_off` | Bug fix | `src/pages/CalendarPage.tsx` |
| 2 | `computeHistoryStats`: deduplicate `last7Completed` / `last30Completed` by `planId__calendarDate` | Defensive fix | `src/lib/historyStats.ts`, `src/lib/__tests__/historyStats.test.ts` |
| 3 | `expressionEval`: warn in dev when YAML progression rule references unknown variable | DX improvement | `src/lib/expressionEval.ts`, `src/lib/__tests__/expressionEval.test.ts` |

### Detail

**1. CalendarPage jump-override day_off bug**
`logForDate` guarded the jump re-add with `action !== 'day_off'`, so marking a previously-jumped date as day_off silently dropped the jump. The rotation engine would then advance from the pre-jump plan day index for all subsequent dates, causing every day after to show the wrong workout. Fix: remove the `action !== 'day_off'` exclusion.

**2. `last7/last30Completed` dedup**
`totalCompleted` already deduped by `planId__calendarDate` (added 2026-08-15), but the windowed counts did not. A re-imported CSV could inflate the 7-day and 30-day stats while leaving the all-time stat correct. Fix mirrors the `totalCompleted` pattern exactly.

**3. Unknown-variable dev warning**
Typos in YAML progression rule variable names (e.g. `squatt` vs `squat`) silently evaluate to 0, making the rule appear to do nothing. A `console.warn` behind `import.meta.env.DEV` surfaces these immediately without any production behaviour change. Built-in variables (`effort`, `all_reps`, `session_complete`) are always in `vars` so they never trigger the warning.

### Items still open / recommended only

| Item | Status |
|---|---|
| Calendar week start configurable | Recommendation only — requires settings infrastructure |
| `TodayPage` state extraction hook | Recommendation only — risky refactor of 1150-line component |
| `beforeunload` flush for Supabase writes | Recommendation only — needs product decision on write semantics |
| `updateEntryDate` data-loss risk in historyStore | Recommendation only — audit found no production callers |
| Cloud sync conflict resolution | Out of scope |

---

## Additions — 2026-08-23

### Changes implemented this pass

| # | Item | Type | Files |
|---|---|---|---|
| 1 | `TodayPlanProgressModal`: surface `longestStreak` as "Best streak" | Feature | `src/components/today/TodayPlanProgressModal.tsx`, `src/pages/TodayPage.tsx` |
| 2 | Calendar week start: configurable Sun/Mon setting | Feature | `src/store/settingsStore.ts`, `src/engine/calendarProjection.ts`, `src/pages/CalendarPage.tsx`, `src/pages/SettingsPage.tsx`, `src/store/__tests__/settingsStore.test.ts` |

### Detail

**1. Best streak in Plan Progress modal**
`computeHistoryStats` already returned `longestStreak` (the all-time longest streak across all plans) but it was never surfaced in the UI. The Plan Progress modal now shows a "Best streak" row beneath the existing "Current streak" row, hidden when `longestStreak === 0`. Implementation: add `longestStreak: number` prop to `TodayPlanProgressModal`, pass `stats.longestStreak` from `TodayPage`.

**2. Configurable calendar week start (P6 resolved)**
`buildMonthGrid` previously hardcoded `weekStartsOn: 0` (Sunday). A `weekStartsOn: 0 | 1` preference was added to `settingsStore` with Sunday as the default (backward compatible), included in `migrateSettingsState`, threaded from `CalendarPage` into `buildMonthGrid`, and exposed as a Sunday/Monday button toggle in the Settings page. Five new tests cover the store action and migration.

### Items still open / recommended only

| Item | Status |
|---|---|
| `TodayPage` state extraction hook | Recommendation only — risky refactor of ~1170-line component |
| `beforeunload` flush for Supabase writes | Recommendation only — needs product decision on write semantics |
| `updateEntryDate` data-loss risk in historyStore | Recommendation only — audit found no production callers |
| Cloud sync conflict resolution | Out of scope |

---

## Additions — 2026-08-19

### Changes implemented this pass

| # | Item | Type | Files |
|---|---|---|---|
| 1 | `findPreviousSessionForPlanDay`: exclude future-dated entries | Bug fix | `src/lib/sessionSummary.ts`, `src/lib/__tests__/sessionSummary.test.ts` |
| 2 | `TodayPage`: wrap `computeAverageWorkoutsPerWeek` in `useMemo` | Perf fix | `src/pages/TodayPage.tsx` |
| 3 | `TodayPlanProgressModal`: surface `computeRotationPlanRemaining` as "Workouts remaining" | Feature | `src/pages/TodayPage.tsx`, `src/components/today/TodayPlanProgressModal.tsx` |

### Detail

**1. `findPreviousSessionForPlanDay` future-date bug**
`findPreviousSessionForPlanDay` filtered with `e.calendarDate !== currentDate`, which correctly excluded today but allowed future-dated entries through. A CSV import with an erroneously future-dated entry for the same `planDayIndex` would appear as the "Last session" data shown on the Today view. Fix: change the predicate to `e.calendarDate < currentDate` so all present and future dates are excluded. One test added covering the future-date case.

**2. `avgWorkoutsPerWeek` useMemo**
`computeAverageWorkoutsPerWeek` scans all history entries and extras for every render of `TodayPage`. Previous audit passes documented this as a recommendation (R3) but did not implement it. The fix wraps the call in `useMemo` with deps `[plan.id, planEntries, planExtras, plan.startDate, today]`, consistent with the memoization pattern used by the nearby `rotationLoggedCount` computation. No behaviour change.

**3. "Workouts remaining" in Plan Progress modal**
`computeRotationPlanRemaining` was implemented and tested in the stats layer but never surfaced in the UI. The Plan Progress modal (opened by tapping the ring on the Today view) now shows a "Workouts remaining" row for rotation-duration plans. Returns `'Done'` when the count reaches 0. No change for weeks-duration plans (prop is null, row is hidden). Implementation: compute in `TodayPage`, pass as `rotationPlanRemaining` prop to `TodayPlanProgressModal`.

### Items still open / recommended only

| Item | Status |
|---|---|
| Calendar week start configurable | Recommendation only — requires settings infrastructure |
| `TodayPage` state extraction hook | Recommendation only — risky refactor of ~1160-line component |
| `beforeunload` flush for Supabase writes | Recommendation only — needs product decision on write semantics |
| `updateEntryDate` data-loss risk in historyStore | Recommendation only — audit found no production callers |
| Cloud sync conflict resolution | Out of scope |

---

## Additions — 2026-08-20
## Additions — 2026-08-21
## Additions — 2026-08-24

### Changes implemented this pass

| # | Item | Type | Files |
|---|---|---|---|
| 1 | `historyStats.test`: correct `daysMap` type annotation to use `WorkoutType` | Type fix | `src/lib/__tests__/historyStats.test.ts` |
| 2 | `programParser`: add 20 tests for untested parser paths | Tests | `src/engine/__tests__/programParser.test.ts` |

### Detail

**1. `daysMap` type annotation fix**
The `daysMap` helper in `historyStats.test.ts` had a hardcoded union type that didn't include `'run'`. Tests at lines 913 and 924 passed `type: 'run'`, producing `TS2322` compile errors silently swallowed by Vitest's esbuild transform. Fixed by using the imported `WorkoutType` union.

**2. `programParser` test coverage**
`programParser.test.ts` had only 6 tests. Added 20 new tests covering: `parseDurationSecs`, `coerceWorkoutType`, validation error reporting, `validateYamlProgram`, and `buildStructureDescription`. Test count: 1268 → 1288.

---

## Additions — 2026-08-21

### Changes implemented this pass

| # | Item | Type | Files |
|---|---|---|---|
| 1 | `TodayPage`: memoize `computeLoggedRate` and `computeWorkoutCompletionRate` | Perf fix | `src/pages/TodayPage.tsx` |

### Detail

**1. Memoize `computeLoggedRate` and `computeWorkoutCompletionRate`**
Both functions scan `planEntries` on every render of `TodayPage`. Wrapped both in `useMemo` with precise dependency arrays, following the identical pattern used for `avgWorkoutsPerWeek` (Aug 19 pass) and `rotationLoggedCount`.
| 1 | `TodayPage`: memoize `computeLoggedRate` and `computeWorkoutCompletionRate` | Perf fix | `src/pages/TodayPage.tsx` |

### Detail

**1. `computeLoggedRate` + `computeWorkoutCompletionRate` memoization**
Both calls scan all `planEntries` (O(n)) on every render. The `avgWorkoutsPerWeek` memo (added 2026-08-19) uses the same four deps `[plan.id, planEntries, plan.startDate, today]`. Wrapping both calls in `useMemo` with the same dep array is a safe, direct application of the established pattern.

### Items still open / recommended only

| Item | Status |
|---|---|
| Calendar week start configurable | Recommendation only — requires settings infrastructure |
| `TodayPage` state extraction hook | Recommendation only — risky refactor of ~1160-line component |

---

## Additions — 2026-08-22

### Changes implemented this pass (test-only)

| # | Item | Type | Files |
|---|---|---|---|
| 1 | `programParser.test.ts`: 10 new tests covering `buildStructureDescription`, `parseRunSegment`, `parseDurationSecs`, `parseDay` | Coverage | `src/engine/__tests__/programParser.test.ts` |
| 2 | `explanation.test.ts`: 2 new tests for `reset` and null `lastResult` branches in `buildAdaptationNote` | Coverage | `src/modules/recommendation/__tests__/explanation.test.ts` |
| 3 | `previousSetsHelper.test.ts`: 2 new tests for extra-workout instance ID handling | Coverage | `src/lib/__tests__/previousSetsHelper.test.ts` |

### Detail

**1. `programParser` branch coverage**
Three branches of `buildStructureDescription` for weights slots were completely dark: the set-array path (shows "N sets"), the reps-only path (shows "×N"), and the no-exercises path (returns `undefined`). Added tests for all three. A test also documents the raw-vs-parsed type discrepancy: `buildStructureDescription` uses the raw YAML `type` string in the display label while `parseRunSegment` normalises unknown types to `'easy'` — a subtlety that is easy to miss when reading the code. Additional coverage for `parseDurationSecs` (zero, invalid string, 2-minute string) and `parseDay` label default.

**2. `buildAdaptationNote` untested switch branches**
The `switch (state.lastResult)` in `buildAdaptationNote` has five branches. `reset` and `default` (triggered by `null`/`undefined`) were untested. Added two tests to close the gap.

**3. `findPreviousSetsByExercise` extra-workout IDs**
Extra workouts use IDs of the form `planId_YYYY-MM-DD_extra_extraId`. The function excludes same-date IDs via `rest.startsWith(currentDate)`. For an extra workout, `rest` is `YYYY-MM-DD_extra_extraId`, which correctly starts with the date prefix. Two tests now pin this contract explicitly.

### Items still open / recommended only

| Item | Status |
|---|---|
| Calendar week start configurable | Recommendation only — requires settings infrastructure |
| `TodayPage` state extraction hook | Recommendation only — risky refactor of ~1170-line component |
| `beforeunload` flush for Supabase writes | Recommendation only — needs product decision on write semantics |
| `updateEntryDate` data-loss risk in historyStore | Recommendation only — audit found no production callers |
| `TodayPage` state extraction hook | Recommendation only — risky refactor of ~1160-line component |
| 1 | `findBestWeek`: exclude future-dated entries when `today` param is passed | Defensive fix | `src/lib/historyStats.ts`, `src/pages/HistoryPage.tsx`, `src/lib/__tests__/historyStats.test.ts` |
| 2 | `HistoryPage`: clamp `computeWorkoutTypeBreakdown` dateRange to `today` | Defensive fix | `src/pages/HistoryPage.tsx`, `src/lib/__tests__/historyStats.test.ts` |

### Detail

**1. `findBestWeek` future-date guard**
`findBestWeek` builds its aggregation window from the min/max
`calendarDate` seen across the plan's entries + extras. A single future-
dated `complete` (say, from a bad CSV import to `2099-06-01`) would push
`toDate` all the way to 2099 and let a fake future week win the
"best week" celebration slot. Fix: add an optional `today` parameter that
filters out `calendarDate > today` before the window is derived. When
omitted, the pre-guard behavior is retained (backwards-compatible;
explicit regression test). `HistoryPage` now passes `today`.

**2. `HistoryPage` type-breakdown range clamp**
`computeWorkoutTypeBreakdown` already accepted an optional `dateRange`,
but the `HistoryPage` caller wasn't using it. A future-dated `complete`
entry from a bad CSV import would count in the History-page type-mix
label. Passing `{ from: '0000-01-01', to: today }` uses the existing
(already-tested) dateRange path to exclude future dates. Two new tests
document the future-date behavior specifically.

### Items still open / recommended only

Same open items as the 2026-08-19 pass — none re-classified this pass.

