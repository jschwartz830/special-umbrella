# Review Notes — Overnight Audit Pass
**Date:** 2026-08-21
**Branch:** `claude/serene-cori-5zm3g1`

---

## Executive Summary (2026-08-21 pass)

1. **What changed:** One performance fix — `computeLoggedRate` and `computeWorkoutCompletionRate` in `TodayPage.tsx` are now wrapped in `useMemo`, preventing redundant O(n) scans of `planEntries` on every re-render. No production logic was altered, no tests were added (no untested edge cases identified in this pass). Test count: unchanged at 1288.

2. **Highest confidence:** The change is the exact same `useMemo` pattern applied to `avgWorkoutsPerWeek` in the Aug 19 pass. The dependency arrays (`[plan.id, planEntries, plan.startDate, today]` and `[plan.id, planEntries, today]`) precisely match the function arguments, making stale-cache bugs impossible.

3. **What is risky:** Nothing. Pure performance optimization with no behavioral change.

4. **What to review:** Verify that `computeLoggedRate` and `computeWorkoutCompletionRate` in `TodayPage.tsx` are now wrapped in `useMemo` and that their dependency arrays are correct. Run `npx vitest run` to confirm all 1288 tests still pass.

---

## Improvements Completed (2026-08-21)

| # | Description | Commit |
|---|---|---|
| 1 | `perf(TodayPage)`: memoize `computeLoggedRate` and `computeWorkoutCompletionRate` | TBD |

---

## Open Recommendations (carry-forward)

| ID | Area | Description | Status |
|---|---|---|---|
| R1 | Calendar | Week-start configurable (Mon vs Sun) — requires settings infrastructure | Open |
| R2 | TodayPage | Extract heavy state computation into a custom hook | Open |
| R4 | `updateEntryDate` | Potential data-loss risk; no production callers currently | Open |

---

## Previous Pass Notes (2026-08-20)
**Branch:** `claude/serene-cori-27v4nu`

---

## Executive Summary (2026-08-20 pass)

1. **What changed:** Two quality fixes with no production code changes — (a) a TypeScript type annotation correction in `historyStats.test.ts` that was causing `TS2322` compile errors silently ignored by Vitest's esbuild transform, and (b) 20 new tests for `programParser.ts` paths that were completely uncovered (duration parsing, type coercion, validation errors, `validateYamlProgram`, and `buildStructureDescription`). Test count: 1268 → 1288 (+20 new tests).

2. **Highest confidence:** The `daysMap` fix is a single type annotation update with no runtime effect. The programParser tests are pure additions exercising well-defined parser behaviors via inline YAML — each test is independently self-contained.

3. **What is risky:** Nothing. Both changes are test-only; no production source files were modified.

4. **What to review first:** Run `npx tsc --noEmit` and verify it exits cleanly (previously two TS2322 errors). Run `npx vitest run` and verify the new programParser describe blocks all pass — particularly the `buildStructureDescription` tests, which rely on the parser correctly assembling `structureDescription` from exercises/segments.

---

## Improvements Completed (2026-08-20)

| # | Description | Commit |
|---|---|---|
| 1 | `fix(historyStats.test)`: correct `daysMap` type annotation to use `WorkoutType` | `0099f4e` |
| 2 | `test(programParser)`: add 20 tests for untested parser paths | `0099f4e` |

---

## Previous Pass Notes (2026-08-19)
**Branch:** `claude/serene-cori-yi37e7`

---

## Executive Summary (2026-08-19 pass)

1. **What changed:** One bug fix (`findPreviousSessionForPlanDay` no longer leaks future-dated entries as "Last session" data), one perf fix (`avgWorkoutsPerWeek` now memoized), and one additive feature ("Workouts remaining" surfaced in the Plan Progress modal for rotation plans). Test count: 1267 → 1268 (+1 new test for the bug fix).

2. **Highest confidence:** The `findPreviousSessionForPlanDay` fix is a direct one-character change (`!==` → `<`) with a covering test and no side effects on the `buildLastSessionSummary` path. The `useMemo` wrap is an identical pattern to three adjacent calls in `TodayPage`. The "Workouts remaining" feature is purely additive — the function already existed, was already tested, and the new row is hidden when `rotationPlanRemaining` is null (i.e., for all weeks plans).

3. **What is risky:** Nothing in this pass is risky. All three changes are either narrowly scoped fixes or purely additive.

4. **What to review first:** Open the Plan Progress modal for an active rotation-duration plan and verify the "Workouts remaining" row appears with the correct count. Verify it is absent for a weeks-duration plan. Verify the Today view's "Last session" hint does not show future-dated data when entries with `calendarDate > today` exist (can be created via CSV import).

---

## Improvements Completed (2026-08-19)

| # | Description | Commit |
|---|---|---|
| 1 | `fix(sessionSummary)`: exclude future-dated entries from `findPreviousSessionForPlanDay` (+1 test) | TBD |
| 2 | `perf(TodayPage)`: memoize `computeAverageWorkoutsPerWeek` call | TBD |
| 3 | `feat(TodayPlanProgressModal)`: surface "Workouts remaining" for rotation plans | TBD |

---

## Previous Pass Notes (2026-08-18)
**Branch:** `claude/serene-cori-5e9ub6`

---

## Executive Summary (2026-08-18 pass)

1. **What changed:** Two targeted dedup fixes in `historyStats.ts` — `computeWeeklyBreakdown` and `computeWorkoutTypeBreakdown` now apply newest-`createdAt`-wins dedup on rotation entries, matching the existing pattern in five other stats functions. One defensive null-safety fix in `planStore.ts` guards `migratePlanState` against corrupted persisted state. Test count: 1262 → 1267 (+5 new tests).

2. **Highest confidence:** The dedup fixes — they apply an identical pattern already proven by `computeWorkoutCompletionRate`, `computeHistoryStats`, and `computePlanProgress` in the same file. The logic is symmetric, the tests are direct, and the change only activates when duplicate entries exist (which is already prevented at the store layer).

3. **What is risky:** Nothing in this pass is risky. The `planStore` null guard only activates on data that would otherwise throw — it has no effect on valid plans.

4. **What to review first:** Run the app with a plan that has many history entries and verify the weekly breakdown chart and type breakdown still display correctly. Both functions now skip earlier duplicates (keeping newest), which is the same behavior as the completion-rate chart.

---

## Improvements Completed (2026-08-18)

| # | Description | Commit |
|---|---|---|
| 1 | `fix(historyStats)`: deduplicate `computeWeeklyBreakdown` and `computeWorkoutTypeBreakdown` rotation entries (+5 tests) | `e7283cb` |
| 2 | `fix(planStore)`: null-safety guard in `migratePlanState` for missing `days`/`slots` | `cf417ba` |

---

## Previous Pass Notes (2026-08-16)
**Branch:** `claude/serene-cori-8em73i`

---

## Executive Summary (2026-08-16 pass)

1. **What changed:** Three targeted fixes — a CalendarPage jump-override rotation bug, a `last7/last30Completed` dedup fix, and a dev-mode warning for unknown YAML variables. Also resolved a pre-existing TypeScript error (TS2554) in `progression.ts` from an incomplete 2026-08-15 refactor. Test count: 1251 → 1262 (+11 new tests).

2. **Highest confidence:** The `last7/last30Completed` dedup fix — it's a one-line change mirroring the identical pattern used 4 lines earlier for `totalCompleted`. Three new tests cover the edge case. The `expressionEval` dev warning is dev-only with no production behaviour change.

3. **What is risky:** The CalendarPage `logForDate` fix is the most subtle change. It restores a jump override during `day_off` logging that was previously dropped. The logic is correct (a day_off doesn't undo the jump target), but the CalendarPage has no unit tests — manual verification of the retroactive logging flow is needed.

4. **What to review first:** Mark a previously-jumped calendar date as Day Off and confirm the next day still shows the jumped-to workout in sequence. Also confirm that marking a non-jumped date as Day Off still works correctly.

---

## Improvements Completed (2026-08-16)

| # | Description | Commit |
|---|---|---|
| 0 | `fix(progression)`: remove stale extra arg from allSetsHitTarget call (TS2554) | `20854aa` |
| 1 | `fix(calendar)`: preserve jump override when marking a jumped date as day_off | `9c50d73` |
| 2 | `fix(historyStats)`: deduplicate last7/last30Completed by planId__calendarDate | `6ae59c0` |
| 3 | `feat(expressionEval)`: warn in dev when YAML progression rule references unknown variable | `c1ac228` |

---

## Previous Pass Notes (2026-08-15)
**Branch:** `claude/serene-cori-t6hvf0`

---

## Executive Summary (2026-08-15 pass)

1. **What changed:** Three targeted fixes — a `useToday` device-wake bug, an `allSetsHitTarget` cleanup, and a defensive dedup in `computeHistoryStats`. No new dependencies, no new features, no test count change (all 1251 continue to pass).

2. **Highest confidence:** `allSetsHitTarget` refactor — semantically equivalent single-`every()` rewrite, zero behaviour change, all related outcome tests green. `computeHistoryStats` dedup — mirrors the exact pattern used by `isPlanExpired` and `computePlanProgress` in the same file.

3. **What is risky:** None of these changes are risky. The `visibilitychange` fix is the most "user-facing" but it only adds a second trigger for the same `tick()` call that already ran at midnight — React's value-stable `setState` ensures no extra renders when the date hasn't changed.

4. **What to review first:** The `useToday` fix is worth a quick sanity check: leave the app open past midnight on a device that sleeps, wake it up, and confirm TodayPage shows the new date without a reload.

---

## Improvements Completed (2026-08-15)

| # | Description | Commit |
|---|---|---|
| 1 | `useToday` visibilitychange device-wake fix | `3084146` |
| 2 | `allSetsHitTarget` single-parameter refactor | `ea66d3e` |
| 3 | `computeHistoryStats` totalLogged/totalCompleted dedup | `56255d0` |

---

## Previous Pass Notes (2026-08-14)
**Branch:** `claude/serene-cori-gxsgmm`

---

## Executive Summary

1. **What changed:** Added `computeAverageWorkoutsPerWeek` to the stats layer with 13 tests; wired it into the Plan Progress modal as a new "Avg / week" row; added a dev-mode warning for malformed YAML expressions; improved doc comment in `workoutInstanceId.ts`.

2. **Highest confidence:** The `computeAverageWorkoutsPerWeek` function and its tests. It's a pure function that follows existing dedup and filtering conventions exactly. The UI wiring is additive (new prop, new conditional row). No existing tests were modified; 13 new tests were added and all pass.

3. **What is risky:** The fractional-denominator choice in `computeAverageWorkoutsPerWeek` — a 3-day-old plan with 3 workouts shows 7.0/week, which is technically correct but could look alarming. This is a product decision, not a bug, but worth reviewing.

4. **What to review first:** The Plan Progress modal in the running app (or its snapshot tests if you add them). The new "Avg / week" row should appear after completing at least one workout, and be absent on a brand-new plan.

---

## Biggest Issues Found During Audit

### 1. Excellent overall test coverage (no blockers)
All 1238 existing tests pass and every critical code path is covered. The engine, stores, stats layer, and expression evaluator each have dedicated test files. No existing tests were broken.

### 2. `computeAverageWorkoutsPerWeek` was missing
A common fitness metric — how consistently am I training each week? — was absent from the stats layer. Every other "plan health" metric was present. **Implemented and tested.**

### 3. `parsePrimary` silent fallback gave zero feedback to YAML authors
Malformed YAML progression expressions (extra commas, unmatched parens in wrong positions) silently returned 0. **Fixed with a dev-mode warning.**

### 4. `parseWorkoutInstanceId` alphabet assumption was undocumented
The function relies on hex-only planIds for correctness but didn't say so. **Documented.**

### 5. Calendar week starts hardcoded to Sunday (not implemented — recommendation only)
`buildMonthGrid` in `calendarProjection.ts` uses `weekStartsOn: 0` (US Sunday convention). International users may expect Monday-first. Fixing this requires a settings preference and more extensive UI work — documented as recommendation only.

### 6. `TodayPage` state density (not implemented — recommendation only)
`TodayPage.tsx` is ~1160 lines after this pass. The component is well-decomposed into sub-components and sub-hooks already, but state initialization (the long sequence of `const` computations before the return) could be extracted into a `useTodayPageStats` hook for clarity.

---

## Improvements Completed

| # | Description | Commit |
|---|---|---|
| 1 | `computeAverageWorkoutsPerWeek` + 13 tests | `0431da5` |
| 2 | Wire avg/week into Plan Progress modal | `d42c6ce` |
| 3 | `parsePrimary` dev-mode warning | `e81e9e8` |
| 4 | `parseWorkoutInstanceId` doc update | `7fcf67c` |

---

## Feature Added

**Feature:** "Average workouts per week" stat in Plan Progress modal.

**Classification:** Keep — this is a pure additive change with strong tests and obvious user value. The fractional denominator edge case (high early average) is documented and easy to tune.

---

## Definitely Keep

- `computeAverageWorkoutsPerWeek` + tests — valuable metric, well-tested, clean API
- Dev-mode warning in `parsePrimary` — zero production risk, helps YAML authors
- `parseWorkoutInstanceId` doc comment — pure documentation improvement

---

## Probably Keep But Tweak

- "Avg / week" modal row — the `×` suffix is a minor style choice; you may prefer `/ wk` or omit the unit suffix entirely. The conditional null-hide is correct and should stay.
- Fractional-week denominator in `computeAverageWorkoutsPerWeek` — if early-plan averages feel misleading, consider adding a minimum-elapsed-days guard (e.g. return null if `daysElapsed < 3`). This is a product decision, not a bug.

---

## Do Not Keep

None — all four changes are purely additive or documentation-only.

---

## Recommendations Only (Not Implemented)

### R1 — Calendar week-start setting
`buildMonthGrid` uses Sunday-first weeks. Add a `weekStartsOn: 0 | 1` setting to `settingsStore` and thread it through `CalendarPage → buildMonthGrid`. Moderate complexity; affects only the calendar view.

### R2 — TodayPage stats extraction hook
Extract the 30+ `const` stat derivations between the early-return guard and the JSX into a `useTodayPageStats(plan, planEntries, planExtras, today, ...)` hook. This makes TodayPage shorter and each stat easier to unit test. No behaviour change — pure refactor.

### R3 — `avgWorkoutsPerWeek` memoization in TodayPage
The `computeAverageWorkoutsPerWeek` call runs on every TodayPage render. For plans with many entries, wrapping in `useMemo([planEntries, planExtras, plan.startDate, today])` is a minor win. Low priority — the function is O(n) and n is typically small.

### R4 — `computeHistoryStats.totalLogged` dedup at stats layer
The function counts raw array length, assuming the store prevents duplicates. This assumption holds now but could be violated by future import paths. Adding `new Set(entries.map(...)).size` dedup at the stats layer would make it defensive. Very low risk currently.

### R5 — YAML progression rule documentation
The expression DSL supported by `expressionEval.ts` is powerful but undocumented in the app itself. A help tooltip or linked doc in `ProgramImportPage` would help YAML authors understand the `then`/`else` update syntax.

---

## Open Questions For You

1. **Fractional avg/week for new plans** — Does 7.0 workouts/week for a plan started 3 days ago (with 3 workouts done) read correctly to you, or would you prefer a `null` return until at least 7 days have elapsed?

2. **"Avg / week" label** — Is `2.5×` the right format, or would `2.5 / wk` or just `2.5` be clearer?

3. **Calendar week start** — Is Sunday-first correct for your use case, or would you like a Monday-first option?

4. **TodayPage refactor** — Would you like a follow-up pass to extract the stats derivations into a dedicated hook? This would make TodayPage easier to test but doesn't change any behaviour.

---

## Known Issues / Incomplete Work

- No visual test (screenshot or component snapshot) for the new Plan Progress modal row. The plan progress modal is not covered by existing component tests, so this change relies on manual verification.
- `avgWorkoutsPerWeek` in TodayPage is not wrapped in `useMemo`. For typical plan sizes (< 500 entries) this is unnoticeable, but could be addressed proactively.

---

## Dependencies Added

None.
