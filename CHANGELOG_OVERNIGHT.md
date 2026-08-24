# Overnight Changelog

---

## 2026-08-23

### Change 1 — `feat(ui): surface longestStreak as "Best streak" in Plan Progress modal`

**Summary:** `computeHistoryStats` already computed and returned `longestStreak` but the value was never displayed. Added a "Best streak" row to `TodayPlanProgressModal`, visible below the existing "Current streak" row when `longestStreak > 0`. Wired `stats.longestStreak` through `TodayPage` as a new required prop.

**Why it matters:** Users who break a streak lose context on their personal best. Surfacing it alongside the current streak gives motivation and a historical baseline.

**Files changed:**
- `src/components/today/TodayPlanProgressModal.tsx` — new `longestStreak` prop, new conditional row
- `src/pages/TodayPage.tsx` — `longestStreak={stats.longestStreak}` passed to modal

**Risks / tradeoffs:** Zero risk. The value was already computed; this is display-only. The row is hidden when `longestStreak === 0`, so brand-new plans show nothing spurious.

**Rollback:** Revert the associated commit (`9b45fcc`).

---

### Change 2 — `feat(settings): configurable calendar week start day (Sun/Mon)`

**Summary:** `buildMonthGrid` previously hardcoded `weekStartsOn: 0` (Sunday). Added a `weekStartsOn: 0 | 1` field to `settingsStore`, backfilled in `migrateSettingsState` (defaults to 0 = Sunday, backward compatible), threaded from `CalendarPage` into `buildMonthGrid`, and exposed in the Settings page as a Sunday/Monday button toggle. Five new tests in `settingsStore.test.ts` cover the new action and migration behavior. Test count: 1288 → 1293.

**Why it matters:** Monday-first weeks are the ISO standard and the default expectation for users outside North America. Without this setting, the calendar week grid is always Sunday-first, making it appear out of sync with device calendars that use Monday-first.

**Files changed:**
- `src/store/settingsStore.ts` — `weekStartsOn: 0 | 1` field + `setWeekStartsOn` setter + migration
- `src/engine/calendarProjection.ts` — `buildMonthGrid` `weekStartsOn` parameter (default 0)
- `src/pages/CalendarPage.tsx` — reads `weekStartsOn` from store, passes to `buildMonthGrid`, adds to `useMemo` deps
- `src/pages/SettingsPage.tsx` — Sun/Mon button toggle in new "Calendar week start" section
- `src/store/__tests__/settingsStore.test.ts` — 5 new tests (default, toggle to Mon, toggle back, idempotent, migration backfill)

**Risks / tradeoffs:** Very low. Defaults to Sunday (0), so existing users see no change. The setting is persisted and migrated. The only behavioral change for existing users who switch to Monday-first is that the calendar grid shifts — which is exactly the expected outcome.

**Rollback:** Revert the `feat(settings)` commit (`72358c0`).
## 2026-08-24

### Change 1 — `fix(historyStats): exclude future-dated entries from findBestWeek`

**Summary:** `findBestWeek` builds its per-week aggregation window from the
min/max `calendarDate` across the plan's entries and extras, then picks the
week with the most active workouts (completed + extras). If a bad CSV import
left a future-dated `complete` entry in the store, that entry (and any
neighbors) would push a future week into the "best week" celebration slot,
even though the user has not actually trained that week yet. Added an
optional 4th parameter `today?: string` that filters `entries`/`extras` down
to `calendarDate <= today` before the aggregation window is computed. When
the parameter is omitted, existing 3-arg callers get the pre-guard
behavior (backwards compatible; covered by an explicit test).

**Why it matters:** Mirrors the same future-date guard already applied to
`computeHistoryStats` (`longestStreak`, `totalLogged`,
`last7Completed`/`last30Completed`) and `computeWorkoutCompletionRate`. The
"Best week" section is one of the few celebration surfaces on the History
page; showing a fake future week would make the entire stats card feel
untrustworthy.

**Files changed:**
- `src/lib/historyStats.ts` — new optional `today` parameter on `findBestWeek`; filters entries/extras above it before max-date computation.
- `src/pages/HistoryPage.tsx` — passes `today` into the `findBestWeek` call.
- `src/lib/__tests__/historyStats.test.ts` — 4 new tests: rotation-entry
  guard, extras guard, all-future-plus-guard returns null, and an explicit
  regression test confirming the pre-guard behavior when `today` is omitted.

**Risks / tradeoffs:** Zero risk. Signature change is additive; the previous
3-arg call shape is preserved by a regression test. Guard only activates
when the `today` parameter is supplied.

**Rollback:** Revert commit `16111b6`.

---

### Change 2 — `fix(HistoryPage): clamp typeBreakdown dateRange to today`

**Summary:** `HistoryPage` was calling `computeWorkoutTypeBreakdown` with
no `dateRange`, so future-dated `complete` entries (from a bad CSV import)
would be attributed into the type-mix label in the stats bar. Now
`HistoryPage` passes `{ from: '0000-01-01', to: today }` as the range so
only past + today entries contribute. The underlying function is unchanged
— the existing (already-tested) `dateRange` code path does the work.

**Why it matters:** The type-mix label ("3 weights · 2 runs · 1 yoga …") is
one of the first data points a returning user sees on the History page.
Inflated counts from a stray future entry would look like genuine training
that never happened. Mirrors the same defensive posture applied to
`computeHistoryStats` and (in Change 1 above) `findBestWeek`.

**Files changed:**
- `src/pages/HistoryPage.tsx` — `computeWorkoutTypeBreakdown` call now
  passes an explicit dateRange with `to: today`; the memo's dep array picks
  up `today`.
- `src/lib/__tests__/historyStats.test.ts` — 2 new tests confirming
  future-dated rotation entries and future-dated extras are excluded when
  `dateRange.to` is set to `today`.

**Risks / tradeoffs:** Zero risk. The `dateRange` code path was already
covered by existing tests; the new tests document the specific future-date
use case. No signature change; no other caller affected.

**Rollback:** Revert commit `7378f2b`.

---

## 2026-08-20

### Change 1 — `fix(historyStats.test): correct daysMap type annotation to use WorkoutType`

**Summary:** The `daysMap` helper in `historyStats.test.ts` (used by `computeWorkoutTypeBreakdown` tests) had a hardcoded type union `'weightlifting' | 'long_run' | 'yoga' | 'rest'` that was never updated when `'run'` was added as a modern `WorkoutType`. Tests at lines 913 and 924 passed `type: 'run'` to `daysMap`, producing `TS2322` compile errors. Vitest's `esbuild` transform silently ignores TypeScript errors, so the tests passed at runtime but were type-incorrect. Fixed by updating the helper's parameter and return types to use the imported `WorkoutType` union.

**Why it matters:** `npx tsc --noEmit` was failing silently — any developer running type-checking in CI would see two errors. The `daysMap` helper is used in the tests for one of the six stats functions that affects the workout-type breakdown chart.

**Files changed:**
- `src/lib/__tests__/historyStats.test.ts` — `daysMap` helper uses `WorkoutType` instead of hardcoded union

**Risks / tradeoffs:** Zero risk. A type annotation change in a test helper only affects compile-time checking.

**Rollback:** Revert the associated commit.

---

### Change 2 — `test(programParser): add 20 tests for untested parser paths`

**Summary:** `programParser.test.ts` had only 6 tests, all targeting the `mobilityExercises` parsing path. Large portions of the parser — duration string parsing, workout type coercion, YAML validation errors, the `validateYamlProgram` convenience wrapper, and `buildStructureDescription` — were completely untested. Added 20 new tests across 6 new describe blocks exercising all of these paths via inline YAML strings (preserving the black-box testing style of the existing tests).

**Why it matters:** `programParser.ts` is the entry point for YAML program import. Bugs in `coerceWorkoutType` would silently map valid types to `'other'`; bugs in `parseDurationSecs` would produce wrong rest/hold durations; bugs in validation would let malformed programs through without error. These paths were completely uncovered before this change.

**Files changed:**
- `src/engine/__tests__/programParser.test.ts` — 20 new tests; also adds `validateYamlProgram` to the import line

**Risks / tradeoffs:** Zero risk. New tests only; no source changes.

**Rollback:** Not applicable (tests only — no production code changed).

---

## 2026-08-18

### Change 1 — `fix(historyStats): deduplicate rotation entries in computeWeeklyBreakdown`

**Summary:** `computeWeeklyBreakdown` iterated the raw entries array without deduplication. When a plan had duplicate entries for the same calendar date (CSV re-import or cloud-sync write race), weekly counts for `completed`, `skipped`, `dayOffs`, and `totalLogged` were inflated. Applied newest-`createdAt`-wins dedup — the same pattern used by `computeWorkoutCompletionRate`, `computeHistoryStats`, and `computePlanProgress`.

**Why it matters:** The weekly breakdown chart and stats are the primary progress view for returning users. Inflated counts from import duplicates would make a week with 3 real workouts show as 6, with no visible indication of the data error.

**Files changed:**
- `src/lib/historyStats.ts` — two-pass dedup in `computeWeeklyBreakdown` rotation loop
- `src/lib/__tests__/historyStats.test.ts` — 3 new tests covering the duplicate-entry edge case

**Risks / tradeoffs:** Zero risk. Dedup is already applied by every other function in the same file; this brings `computeWeeklyBreakdown` into alignment with the established pattern.

**Rollback:** Revert the `fix(historyStats)` commit (`e7283cb`).

---

### Change 2 — `fix(historyStats): deduplicate rotation entries in computeWorkoutTypeBreakdown`

**Summary:** `computeWorkoutTypeBreakdown` had the same raw-entries iteration bug. Duplicate entries for the same (planId, calendarDate) would inflate `completed` and `skipped` counts in the workout-type breakdown. Applied newest-`createdAt`-wins dedup on the rotation entries pass.

**Why it matters:** The workout-type breakdown is used for the history analytics view. A user importing a plan twice would see double counts for every workout type, making their history appear twice as productive.

**Files changed:**
- `src/lib/historyStats.ts` — two-pass dedup in `computeWorkoutTypeBreakdown` rotation loop
- `src/lib/__tests__/historyStats.test.ts` — 2 new tests covering the duplicate-entry and action-conflict edge cases

**Risks / tradeoffs:** Zero risk. Same dedup pattern as Change 1 above.

**Rollback:** Revert the `fix(historyStats)` commit (`e7283cb`).

---

### Change 3 — `fix(planStore): guard migratePlanState against null/undefined days and slots`

**Summary:** `migratePlanState` called `.map()` directly on `plan.days` and `day.slots` with no null check. Corrupted persisted state (e.g. a partial cloud hydration or a future import path that omits the `days` field) would throw a TypeError, crashing the store migration and rendering the app non-functional. Added `?? []` guards to both accesses.

**Why it matters:** Store migration runs on every app load from persisted state. A crash here means the plan store fails to initialize, preventing the user from accessing their plans entirely.

**Files changed:**
- `src/store/planStore.ts` — `(plan.days ?? []).map(...)` and `(day.slots ?? []).map(...)` in `migratePlanState`

**Risks / tradeoffs:** Zero risk. The guard only activates on data that would otherwise throw; valid persisted plans are unaffected.

**Rollback:** Revert the `fix(planStore)` commit (`cf417ba`).

---

## 2026-08-16

### Change 1 — `fix(calendar): preserve jump override when marking a jumped date as day_off`

**Summary:** When a calendar date had a retro jump override and the user marked it as `day_off`, the code removed the jump override and then skipped re-adding it because of an `action !== 'day_off'` guard. This left the rotation pointer anchored at the wrong plan day index for all subsequent dates.

**Why it matters:** The rotation engine uses jump overrides to resolve which plan day should be shown for a given calendar date. If the jump is lost on a `day_off` log, `computeCurrentDayIndex` advances from the pre-jump position instead of the jumped-to position, causing all subsequent days to show the wrong workout.

**Root cause:** `logForDate` (CalendarPage.tsx:146) explicitly excluded `day_off` from the re-add path for the jump override: `if (action !== 'day_off' && (hadJump || ...))`. This was logically incorrect — a `day_off` action doesn't undo the user's intent to jump to a specific plan day.

**Files changed:**
- `src/pages/CalendarPage.tsx` — removed `action !== 'day_off'` exclusion from the jump-override re-add condition

**Risks / tradeoffs:** Very low. The fix ensures that a `day_off` on a jumped date behaves identically to a `complete` or `skip` on a jumped date — it preserves the jump. No existing test exercises this path because the CalendarPage has no unit tests; manual verification is required.

**Rollback:** Revert the `fix(calendar)` commit.

---

### Change 2 — `fix(historyStats): deduplicate last7/last30Completed by planId__calendarDate`

**Summary:** `last7Completed` and `last30Completed` were counting raw array length, unlike `totalCompleted` which already deduplicates by `planId__calendarDate`. A CSV re-import or cloud-sync race producing two entries for the same date would inflate the 7-day and 30-day window counts while leaving `totalCompleted` correct.

**Why it matters:** A user might see "7 workouts this week" when they only completed 4 if a re-import created duplicates. The inconsistency between `totalCompleted` (deduplicated) and `last7Completed` (not deduplicated) was confusing and incorrect.

**Files changed:**
- `src/lib/historyStats.ts` — `last7Completed` and `last30Completed` now use `Set`-based dedup matching `totalCompleted`
- `src/lib/__tests__/historyStats.test.ts` — 3 new tests confirming dedup behaviour

**Rollback:** Revert the `fix(historyStats)` commit.

---

### Change 3 — `feat(expressionEval): warn in dev when YAML progression rule references unknown variable`

**Summary:** Added a `console.warn` in development builds when `evalExpr` evaluates a `var` node whose name is not present in the evaluation context (`vars`). This surfaces YAML progression rule typos (e.g. `squatt` instead of `squat`) immediately during local development without any runtime behaviour change in production — unknown variables continue to evaluate to `0` as before.

**Why it matters:** YAML progression rules that reference a misspelled variable silently return 0, making the rule appear to do nothing. The dev warning makes the error visible immediately without requiring the user to debug via breakpoints.

**Files changed:**
- `src/lib/expressionEval.ts` — added `console.warn` behind `import.meta.env.DEV` guard in `case 'var'`
- `src/lib/__tests__/expressionEval.test.ts` — 5 new tests for the unknown-variable warning; also added 3 tests for the `parsePrimary` unexpected-token warning that was untested across the two prior passes

**Rollback:** Revert the `feat(expressionEval)` commit.

---

## 2026-08-15

### Change 1 — `fix(hooks): re-check date on visibilitychange to handle device wake from sleep`

**Summary:** Added a `visibilitychange` event listener to `useToday` that calls `tick()` whenever the page becomes visible. The existing `setTimeout`-based midnight refresh remains, but was insufficient on its own: when a device sleeps and the OS pauses or delays the timer, the app would display "yesterday" until something forced a React re-render. The visibility listener catches the device-wake edge case immediately.

**Why it matters:** TodayPage is a time-gated view — it resolves workouts by the current local date. Showing the wrong date (from a prior day) would display yesterday's workout as "today" and block the user from logging. This is a silent UX failure that only appears after leaving the device asleep past midnight.

**Files changed:**
- `src/hooks/useToday.ts` — added `handleVisibility` function and `visibilitychange` listener within the same `useEffect`; cleanup removes both the timer and the listener

**Design decisions:**
- The listener is registered inside the same `useEffect` as the `setTimeout` so a single cleanup removes both. No new `useEffect` needed.
- The `[today]` dependency ensures both the timer and the listener are re-registered each time the date advances, so no stale closure issues.

**Risks / tradeoffs:**
- `visibilitychange` fires on every tab-switch/app-background even when the date hasn't changed. The `setToday` call is stable-by-value (React bails out when the new value equals the current), so the cost is just one `format(new Date(), 'yyyy-MM-dd')` call per visibility event — negligible.

**Rollback:** Revert the `fix(hooks)` commit. The hook reverts to `setTimeout`-only behavior with no other changes.

---

### Change 2 — `refactor(progression): simplify allSetsHitTarget to single parameter`

**Summary:** Simplified the private `allSetsHitTarget` function in `progression.ts` from two parameters (`allSets`, `completedSets`) to one (`sets`). The original split ran the `completed` flag check over `allSets` and the `targetReps` check only over the pre-filtered `completedSets`. Since `completedSets` was defined as `allSets.filter(s => s.completed)`, both checks could be expressed as a single `sets.every(s => { if (!s.completed) return false; ... })`. All three call sites updated.

**Why it matters:** The two-parameter signature was confusing — both parameters referred to the same logical set at different filter stages. A reader might assume the parameters could differ independently (e.g. pass different arrays), but in practice they never did. The single-parameter version is easier to read, easier to test, and harder to misuse.

**Files changed:**
- `src/modules/workout-outcomes/progression.ts` — function signature reduced to 1 param, body rewritten as a single `every()` call, three call sites updated

**Risks / tradeoffs:** No behaviour change. All three call sites previously passed `(allSets, completedSets)` where `completedSets = allSets.filter(s => s.completed)`. The unified `every` predicate is semantically equivalent.

**Rollback:** Revert the `refactor(progression)` commit.

---

### Change 3 — `fix(historyStats): deduplicate rotation entries in totalLogged and totalCompleted`

**Summary:** `computeHistoryStats` now collapses rotation `entries` to a `Set` keyed by `planId__calendarDate` before counting `totalLogged` and `totalCompleted`. Previously the function counted raw array length, relying on the store's write-time dedup invariant. That invariant holds under normal use but can be violated by `importEntries` on older persisted data. The fix makes the stats layer independently safe.

**Why it matters:** If `totalLogged` or `totalCompleted` were inflated by duplicate entries, the Plan Progress modal would show a completion rate > 100% and plan expiry logic could fire prematurely. Making the stats layer deduplicate defensively mirrors the pattern already used by `isPlanExpired` and `computePlanProgress`.

**Files changed:**
- `src/lib/historyStats.ts` — `totalLogged` and `totalCompleted` now use `Set`-based dedup

**Design decisions:**
- The key `planId__calendarDate` matches the existing convention used by `deduplicateByDate` in `historyStore.ts`.
- `extras` are intentionally not deduplicated: extra workouts allow multiple per day by design (e.g. morning run + afternoon weights), so counting them by array length is correct.

**Risks / tradeoffs:** Very low risk. The only observable change is that duplicate rotation entries (which shouldn't exist in healthy data) no longer inflate the count. Correct data produces identical output.

**Rollback:** Revert the `fix(historyStats)` commit.

---

## 2026-08-14

**Date:** 2026-08-14

---

## Change 1 — `feat(historyStats): add computeAverageWorkoutsPerWeek`

**Summary:** Added `computeAverageWorkoutsPerWeek(planId, entries, extras, planStartDate, today)` to `src/lib/historyStats.ts`. Returns the average number of active workout sessions per week since the plan started, rounded to one decimal place. Returns `null` when there are no active sessions or the plan hasn't started yet.

**Why it matters:** Average workouts/week is a universally understood training frequency metric missing from the stats layer. It gives users quick context on their training consistency and is safer than raw totals because it accounts for how long the plan has been running.

**Files changed:**
- `src/lib/historyStats.ts` — new exported function + doc comment
- `src/lib/__tests__/historyStats.test.ts` — 13 new tests (import line updated + new `describe` block)

**Design decisions:**
- Counts `complete` entries + extras; excludes `skip` and `day_off` (mirrors training-output semantics used by `findBestWeek`)
- Deduplicates completed dates by calendarDate, matching `isPlanExpired` / `computePlanProgress`
- Denominator is `max(1, daysElapsed / 7)` so a plan started today divides by 1 (not zero)
- Denominator uses fractional weeks so a 3-day-old plan with 3 workouts shows 7.0/week rather than 1.0/week

**Risks / tradeoffs:**
- Fractional denominator means early-plan average can look high (e.g. 7.0/week after 3 consecutive days). This is mathematically correct but may surprise users. The `null` guard for zero sessions avoids the worst case (Infinity).
- Could add a minimum-days threshold (e.g. return null for plans < 3 days old) if the high early values prove confusing in practice.

**Rollback:** Revert the `feat(historyStats)` commit. No existing code depends on this function.

---

## Change 2 — `feat(ui): surface avg workouts/week in Plan Progress modal`

**Summary:** Wired the new `computeAverageWorkoutsPerWeek` into `TodayPage` and passed it as a new `avgWorkoutsPerWeek` prop to `TodayPlanProgressModal`. The modal renders a new row "Avg / week  2.5×" between "Completion rate" and "Consecutive skips" when the value is non-null.

**Why it matters:** The Plan Progress modal is where users check their training stats. Adding average frequency gives a quick "am I training enough?" signal alongside the existing per-workout completion rate.

**Files changed:**
- `src/pages/TodayPage.tsx` — import addition, one `const avgWorkoutsPerWeek = ...` line, prop added to JSX
- `src/components/today/TodayPlanProgressModal.tsx` — new optional prop in interface, new row in JSX

**Design decisions:**
- Row is hidden when `avgWorkoutsPerWeek === null`, so brand-new plans and skip-only plans show no spurious data
- Label is "Avg / week" for brevity; value displayed as `2.5×` (the `×` reads naturally as "times per week")

**Risks / tradeoffs:**
- Adds one row to the modal, which may feel crowded on small screens. Consider collapsing it behind "show more" if the modal becomes too tall.
- `avgWorkoutsPerWeek` is computed at render time in TodayPage (not memoized). Since it involves a Set construction and array filter, it runs on every render. For a plan with thousands of entries, this could be non-trivial — wrapping in `useMemo` is a low-effort follow-up.

**Rollback:** Revert the `feat(ui)` commit.

---

## Change 3 — `fix(expressionEval): warn in dev when parsePrimary receives unexpected token`

**Summary:** Added a `console.warn` in development mode when `parsePrimary()` encounters an unexpected token (e.g. a bare comma or unmatched rparen in expression position). Previously these cases were silently ignored and returned 0.

**Why it matters:** YAML progression rule authors have no feedback when they write malformed expressions like `squat += (5, 3)`. The silent 0 return meant the variable appeared to update correctly but was actually set to 0 — a subtle data corruption. Dev-mode warnings make authoring errors visible immediately.

**Files changed:**
- `src/lib/expressionEval.ts` — 6 lines added after the final `parsePrimary` fallback

**Risks / tradeoffs:**
- Only fires in development (`import.meta.env.DEV`). Production behaviour is unchanged — no throws, no console noise.
- The warning fires for structural syntax errors (wrong token in wrong place), not for unknown identifiers or unknown function names, which already have well-defined 0 semantics.

**Rollback:** Revert the `fix(expressionEval)` commit. One-file, six-line change.

---

## Change 4 — `docs(workoutInstanceId): document hex-alphabet safety assumption`

**Summary:** Updated the doc comment on `parseWorkoutInstanceId` to explicitly state that the function is safe only because nanoid planIds use a hex alphabet, and that the function must be revisited if the alphabet changes.

**Why it matters:** The function's correctness depends on an implicit invariant (hex IDs cannot contain date-like substrings). Without documentation, a future maintainer might change the ID generator without realising the impact on ID parsing.

**Files changed:**
- `src/lib/workoutInstanceId.ts` — doc comment expanded

**Risks / tradeoffs:** Documentation-only change. No runtime impact.

**Rollback:** Revert the `docs(workoutInstanceId)` commit.
