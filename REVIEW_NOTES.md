# Review Notes — Overnight Audit Pass
**Date:** 2026-08-21
**Branch:** `claude/serene-cori-5zm3g1`
**Date:** 2026-08-22
**Branch:** `claude/serene-cori-g0k8es`
**Date:** 2026-08-25
**Branch:** `claude/serene-cori-lwkxmd`
**Date:** 2026-08-26
**Branch:** `claude/serene-cori-a58c0l`
**Date:** 2026-08-27
**Branch:** `claude/serene-cori-h67b7b`
**Date:** 2026-09-02
**Branch:** `claude/admiring-noether-khylj8`
**Date:** 2026-09-03
**Branch:** `claude/admiring-noether-es2l78`

---

## Executive Summary (2026-09-03 pass)

1. **What changed:** Five new tests across two test files (+5) and one documentation-only comment in a production file. `shareWorkout.test.ts` gained four tests covering previously-untested branches: segment-duration formatting, `?`-fallback for undefined `sets`, `?`-fallback for undefined `reps`, and the empty-exercises-array path. `progressionMode.test.ts` gained one test for the edge case `deriveProgressionMode('', true)` — empty-string `progressionType` with `hasProgressRule=true` bypasses the undefined early-return and falls through to `'single'`. `storeSync.ts` gained an inline comment block documenting the known async limitation of the `beforeunload` flush (`pushStore` cannot be awaited) and what a future fix would look like. Test count: 1356 → 1361 (+5).

2. **Why this matters:** The four `shareWorkout` branches are all reachable from real YAML-defined workout programs: a timed segment with no distance, an exercise spec where `sets` or `reps` is absent from the YAML, and a slot whose exercises key is explicitly `[]`. Each was an invisible regression risk. The `progressionMode` edge case documents a partially-configured exercise state that's representable in the store. The `storeSync` comment closes a multi-pass open item: the async limitation was known but unrecorded, making it easy for a future contributor to attempt an await-based fix that cannot work.

3. **Highest confidence:** All five changes are either test-only or documentation-only. No production logic was altered.

4. **Remaining open items:** TodayPage extraction hook (risky refactor), `updateEntryDate` data-loss risk (no callers), cloud sync conflict resolution (out of scope). The `beforeunload` async limitation is now documented; the `navigator.sendBeacon` upgrade path is recorded in the comment for future work.

---

## Executive Summary (2026-09-02 pass)

1. **What changed:** Two low-risk housekeeping improvements to production code and four new tests. `migratePlanState` received the optional `_fromVersion` parameter it was missing (signature parity with all other migration functions). `importOutcomes` received an explanatory inline comment documenting its last-writer-wins behavior and how it differs from `historyStore.importEntries`. Four new tests in `engine.test.ts` cover the 'hold', 'regress', 'reset', and default branches of `buildAdaptationNote` via the `resolveWorkoutDisplayTarget` call path. Test count: 1352 → 1356 (+4).

2. **Why this matters:** The `migratePlanState` signature inconsistency was a low-grade maintenance hazard — any future contributor adding version-conditional migration logic had no signal that the second parameter was needed. The `importOutcomes` documentation closes an audit finding from the previous pass: the function's last-writer-wins behavior contrasts with `historyStore.importEntries`'s newest-createdAt semantics, and was undocumented. The new tests eliminate the last incomplete coverage path in `resolveWorkoutDisplayTarget` for the adaptation note feature.

3. **Highest confidence:** All three changes are additive and non-breaking. The signature change is backward-compatible (optional parameter). The comment is documentation-only. The tests all pass.

4. **Remaining open items (no change):** TodayPage extraction hook (risky refactor), `updateEntryDate` data-loss risk (no callers), `beforeunload` async Supabase flush (needs format compatibility check before implementing), cloud sync conflict resolution (out of scope).

---

## Executive Summary (2026-08-27 pass)

1. **What changed:** One production fix (`storeSync.ts`) and three new tests (+3). The `wpt_outcomes`, `wpt_program_vars`, and `wpt_exercise_history` cloud migrations were upgraded from identity functions to their respective proper migration functions (`migrateOutcomeState`, `migrateProgramState`, `migrateExerciseHistoryState`), completing the pattern established in the Aug 26 pass for `wpt_settings`. Test count: 1349 → 1352 (+3).

2. **Why this matters:** Cloud data hydration via `syncOnLogin` bypasses Zustand `persist` middleware — the migration hook only runs on `localStorage` reads, not `setState`. With identity migrations, missing top-level fields (e.g., a `progressionStates` key absent from an old cloud snapshot) silently land as `undefined` in the live store. `wpt_outcomes.progressionStates`, `wpt_program_vars.vars`, and `wpt_exercise_history.records` being `undefined` would crash any code that iterates or indexes into them. The proper migration functions backfill each field to its correct empty default.

3. **Highest confidence:** All three migration functions are already unit-tested and idempotent. The three new tests mirror the existing `weekStartsOn` backfill test pattern.

4. **Remaining open items (no change):** TodayPage extraction hook (risky refactor), `updateEntryDate` data-loss risk (no callers), cloud sync conflict resolution (out of scope).

---

## Executive Summary (2026-08-26 pass)

1. **What changed:** One production fix (`storeSync.ts`) and one new test (+1). The `wpt_settings` cloud migration was upgraded from an identity function to `migrateSettingsState`, matching the pattern already used for `wpt_history` and `wpt_mobility`. Test count: 1348 → 1349 (+1).

2. **Why this matters:** Cloud data hydration via `syncOnLogin` bypasses Zustand's `persist` middleware migration hook, so new settings fields would be absent after login rather than defaulting correctly. The identity migration was a fragile implicit reliance on Zustand `setState`'s shallow merge; the explicit `migrateSettingsState` call is self-documenting and robust.

3. **Highest confidence:** The `migrateSettingsState` function is already unit-tested and idempotent. The new test directly exercises the gap (old cloud data without `weekStartsOn` → should backfill to `0`).

4. **Remaining open items (no change):** TodayPage extraction hook (risky refactor), `updateEntryDate` data-loss risk (no callers), cloud sync conflict resolution (out of scope).

---

## Executive Summary (2026-08-25 pass)

1. **What changed:** 36 new tests across three files — `mobilityLibrary.test.ts` (+19), `planStore.test.ts` (+15), `calendarProjection.test.ts` (+4 in new describe block) — covering previously-untested branches. No production source files modified. Test count: 1312 → 1348 (+36).

2. **Highest confidence:** All additions are test-only. Each test targets a specific, previously-unexercised branch with a concrete scenario.

3. **What is risky:** Nothing. No production code was changed.

4. **What to review first:** Run `npx vitest run` and verify all 1348 tests pass. The `migratePlanState` tests (12 new) are the highest-value addition — they cover all four legacy slot-type migrations (`weightlifting→weights`, `long_run→run`, `recovery_run→run`, `rest→other`) plus tag-derived `location` and `weightsFocusArea` promotion. These were completely unexercised before and represent a migration correctness regression risk for any existing user with pre-v2 persisted data.

---

## Improvements Completed (2026-08-25)

| # | Description |
|---|---|
| 1 | `test(mobilityLibrary)`: cover all 3 `formatMobilityDuration` branches (seconds-only, minutes-only, mixed) |
| 2 | `test(mobilityLibrary)`: cover `getLibraryExerciseById` found and not-found paths |
| 3 | `test(mobilityLibrary)`: cover all 3 tiers of `mobilityExerciseName` (routine → library → raw id) |
| 4 | `test(mobilityLibrary)`: cover all 8 `summarizeMobilitySets` format branches |
| 5 | `test(planStore)`: cover `makeSlot` for all 7 workout types beyond weights/mobility |
| 6 | `test(planStore)`: cover `migratePlanState` — all 4 slot-type migrations, tag derivation, null/missing input |
| 7 | `test(calendarProjection)`: cover `weekStartsOn: 1` (Monday-first grid) — first/last column days, full January coverage, today marking |

---

## Previous Pass Notes (2026-08-22)
**Branch:** `claude/serene-cori-g0k8es`

---

## Executive Summary (2026-08-22 pass)

1. **What changed:** 13 new tests covering previously-unexercised branches across three files — `programParser.test.ts` (+10 tests), `explanation.test.ts` (+2 tests), `previousSetsHelper.test.ts` (+2 tests) — and one test correction. No production source files were modified. Test count: 1288 → 1301 (+13).

2. **Highest confidence:** All additions are test-only. Each test exercises a real code path with a concrete inline scenario and verifies observable output. No mocks, no globals patched.

3. **What is risky:** Nothing. No production code was changed.

4. **What to review first:** Run `npx vitest run` and verify all 1301 tests pass. The new `programParser` tests cover three previously-dark branches (`buildStructureDescription` set-array, reps-only, and run-slot no-segments) and document a subtlety: `buildStructureDescription` uses the raw YAML type string for display while `parseRunSegment` normalises unrecognised types to `'easy'`. The two new `explanation` tests pin the `reset` and null-lastResult switch branches in `buildAdaptationNote`. The two new `previousSetsHelper` tests confirm that extra-workout instance IDs (`planId_YYYY-MM-DD_extra_id`) are correctly included when from a prior date and correctly excluded when from the current date.

---

## Improvements Completed (2026-08-22)

| # | Description |
|---|---|
| 1 | `test(programParser)`: cover `buildStructureDescription` set-array, reps-only, and run-no-segments branches |
| 2 | `test(programParser)`: cover `parseRunSegment` unrecognised-type normalisation |
| 3 | `test(programParser)`: cover `parseDurationSecs` zero/invalid/2m edge cases |
| 4 | `test(programParser)`: cover `parseDay` no-label default |
| 5 | `test(explanation)`: cover `reset` and null lastResult branches in `buildAdaptationNote` |
| 6 | `test(previousSetsHelper)`: cover extra-workout instance ID inclusion and same-day exclusion |

---

## Previous Pass Notes (2026-08-21)
**Branch:** `claude/serene-cori-g0k8es` (perf commit on main)

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
1. **What changed:** Memoized two O(n) stat calls in TodayPage — `computeLoggedRate` and `computeWorkoutCompletionRate` — using `useMemo` with the same dependency set as the adjacent `avgWorkoutsPerWeek` memo (added 2026-08-19). Updated overnight audit docs. No new tests.

2. **Highest confidence:** The memoization is a direct copy of the established pattern in TodayPage. Both calls are pure functions whose output depends only on `plan.id`, `planEntries`, `plan.startDate`, and `today`.

3. **What is risky:** Nothing. `useMemo` is transparent to React — same values in, same value out.
**Date:** 2026-08-23
**Branch:** `claude/serene-cori-eyspm7`

---

## Executive Summary (2026-08-23 pass)

1. **What changed:** Two additive features — (a) "Best streak" row in the Plan Progress modal (surfaces `longestStreak`, which was already computed but never displayed), and (b) configurable calendar week start day (Sun/Mon toggle in Settings, threaded through CalendarPage into `buildMonthGrid`). Test count: 1288 → 1293 (+5 new `settingsStore` tests).

2. **Highest confidence:** The `longestStreak` surfacing — the value was already computed, tested, and correct; this is purely a display addition. The `weekStartsOn` setting — the change is backward-compatible (defaults to 0 = Sunday), the store migration backfills the default, and `buildMonthGrid` already accepted the parameter in its original signature contract.

3. **What is risky:** Nothing in this pass is risky. Both changes are additive. The Settings toggle is the most user-visible change — if a user accidentally sets Monday, they can switch back immediately.

4. **What to review first:** Open Settings and verify the "Calendar week start" Sun/Mon toggle appears and works. Switch to Monday, navigate to the calendar, and confirm the grid header shifts from Sun–Sat to Mon–Sun. Open the Plan Progress modal (via the ring on Today) and confirm a "Best streak" row appears when the all-time streak is greater than 0.

---

## Improvements Completed (2026-08-23)

| # | Description | Commit |
|---|---|---|
| 1 | `feat(ui)`: surface `longestStreak` as "Best streak" in Plan Progress modal | `9b45fcc` |
| 2 | `feat(settings)`: configurable calendar week start day (Sun/Mon) | `72358c0` |
**Date:** 2026-08-24
**Branch:** `claude/serene-cori-3haj5d`

---

## Executive Summary (2026-08-24 pass)

1. **What changed:** Two symmetric defensive fixes preventing future-dated
   entries (from a bad CSV import) from inflating History-page stats.
   (a) `findBestWeek` now takes an optional `today` upper bound and
   filters `entries`/`extras` above it before computing the best week.
   (b) `HistoryPage` now passes `{ from: '0000-01-01', to: today }` as the
   `dateRange` argument to `computeWorkoutTypeBreakdown` so the type-mix
   label in the stats bar can't be pushed by a future `complete` entry.
   Test count: 1288 → 1294 (+6 new tests).

2. **Highest confidence:** Both fixes mirror the exact future-date guard
   already established by `computeHistoryStats` (longestStreak, totalLogged,
   last7Completed/last30Completed) and `computeWorkoutCompletionRate`. The
   `findBestWeek` change is backwards-compatible — the `today` parameter is
   optional and the pre-guard behavior is retained when omitted (covered
   by a dedicated regression test). The `HistoryPage` change uses the
   already-tested `dateRange` code path in `computeWorkoutTypeBreakdown`.

3. **What is risky:** Nothing. Neither change alters the shape of returned
   data. The `findBestWeek` signature change is additive; the `HistoryPage`
   caller supplies an explicit upper bound rather than relying on implicit
   inclusion of all past+future entries.

4. **What to review first:** Import a CSV with a future-dated `complete`
   entry (say `2099-06-01`) into a plan on the History page. Verify:
   (a) the "Best week" celebration does NOT surface the future week and
   instead points at the real best past week, and (b) the type-mix label
   in the History stats bar does NOT include the future entry's count.
   Then run `npx vitest run` and confirm 1294 tests pass, `npx tsc --noEmit`
   is clean.

---

## Improvements Completed (2026-08-24)

| # | Description | Commit |
|---|---|---|
| 1 | `fix(historyStats)`: exclude future-dated entries from `findBestWeek` via optional `today` param (+4 tests) | `16111b6` |
| 2 | `fix(HistoryPage)`: clamp `typeBreakdown` dateRange to `today` (+2 tests) | `7378f2b` |

---

## Previous Pass Notes (2026-08-20)
**Branch:** `claude/serene-cori-27v4nu`

---

## Executive Summary (2026-08-20 pass)

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
