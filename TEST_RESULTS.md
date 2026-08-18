# Test Results — Overnight Audit Pass

---

## 2026-08-18 Pass

### Source Changes Validated

| Change | Tests affected | Result |
|---|---|---|
| `historyStats.ts` `computeWeeklyBreakdown` dedup | 3 new tests added to `historyStats.test.ts` | All passing |
| `historyStats.ts` `computeWorkoutTypeBreakdown` dedup | 2 new tests added to `historyStats.test.ts` | All passing |
| `planStore.ts` `migratePlanState` null guard | Covered by existing planStore tests | All passing |

### Tests Added

#### `src/lib/__tests__/historyStats.test.ts` — 5 new tests

`computeWeeklyBreakdown` dedup block (3 tests):

| Test | Description |
|---|---|
| `deduplicates rotation entries for the same date — newest createdAt wins` | Two complete entries for same date count as 1 |
| `deduplicates a newer skip over an older complete for the same date` | Newer action wins over older action |
| `does not deduplicate entries on different dates` | Distinct dates are still counted independently |

`computeWorkoutTypeBreakdown` dedup block (2 tests):

| Test | Description |
|---|---|
| `deduplicates rotation entries by (planId, calendarDate) — newest createdAt wins` | Two complete entries for same date count as 1 |
| `uses the newest rotation entry when older and newer disagree on action` | Newer skip wins over older complete |

### Result

- **Test files:** 35
- **Tests:** 1267 (1262 baseline + 5 new)
- **Result:** All passing

---

## 2026-08-16 Pass

### Source Changes Validated

| Change | Tests affected | Result |
|---|---|---|
| `progression.ts` TS2554 fix (stale extra arg) | All `progression` / `outcomeStore` tests | All passing |
| `CalendarPage.tsx` jump-override day_off fix | No dedicated unit tests (UI component — manual) | N/A |
| `historyStats.ts` last7/last30 dedup | 3 new tests added to `historyStats.test.ts` | All passing |
| `expressionEval.ts` unknown-var dev warning | 5 new tests (var warning) + 3 new tests (parsePrimary warning) | All passing |

### Tests Added

#### `src/lib/__tests__/historyStats.test.ts` — 3 new tests

| Test | Description |
|---|---|
| `last7Completed deduplicates complete entries for the same planId__calendarDate` | Two entries for same date count as 1 |
| `last30Completed deduplicates complete entries for the same planId__calendarDate` | Same dedup for 30-day window |
| `last7Completed counts distinct complete entries for different dates within the window` | Normal case still counts correctly |

#### `src/lib/__tests__/expressionEval.test.ts` — 8 new tests

`parsePrimary unexpected-token warning` describe block (3 tests):
| Test | Description |
|---|---|
| `returns 0 when a bare comma appears in primary position` | Existing fallback-to-0 behaviour |
| `emits a console.warn in DEV when an unexpected token is in primary position` | Warning fires in dev |
| `does NOT warn in production (DEV not set)` | Silent in production |

`unknown variable name evaluator warning` describe block (5 tests):
| Test | Description |
|---|---|
| `returns 0 for an unknown variable (existing behaviour)` | Fallback unchanged |
| `emits a console.warn in DEV when a variable name is not in ctx.vars` | Warning fires in dev |
| `does NOT warn for known ctx.vars variables` | Known vars are silent |
| `does NOT warn for built-in keywords (effort, all_reps, session_complete)` | Built-ins are silent |
| `does NOT warn in production (DEV not set)` | Silent in production |

### Result

- **Test files:** 35
- **Tests:** 1262 (1251 baseline + 11 new)
- **Result:** All passing

---

## 2026-08-15 Pass

### Source Changes Validated

| Change | Tests affected | Result |
|---|---|---|
| `useToday` visibilitychange fix | No dedicated unit tests (browser event — manual testing) | N/A |
| `allSetsHitTarget` single-parameter refactor | All `outcomeStore` + `progression` tests | All passing |
| `computeHistoryStats` totalLogged/totalCompleted dedup | All `historyStats` tests | All passing |

### Result

- **Test files:** 35
- **Tests:** 1251 (unchanged — no new tests added this pass)
- **Result:** All passing

### Notes

No new tests were added this pass. The three changes were:
- A refactor with no behaviour change (allSetsHitTarget) — covered by existing outcome/progression tests
- A defensive fix that only affects data with pre-existing duplicates (historyStats dedup) — the existing test suite exercises dedup semantics via `deduplicateByDate` in historyStore tests
- A browser-event hook fix (useToday) — this relies on a browser API (`visibilitychange`) that isn't available in the Vitest/jsdom environment without additional mocking; manual verification is the appropriate test mechanism

A dedicated test for the `useToday` visibilitychange path could be added by mocking `document.addEventListener` and `document.visibilityState` — flagged as a future improvement.

---

## 2026-08-14 Pass

**Date:** 2026-08-14

---

## Baseline (Before Changes)

- **Test files:** 35
- **Tests:** 1238
- **Result:** All passing

---

## Tests Added

### `src/lib/__tests__/historyStats.test.ts` — 13 new tests added

New `describe` block: `computeAverageWorkoutsPerWeek`

| Test | Description |
|---|---|
| `returns null when plan has not started yet` | `planStartDate > today` returns null |
| `returns null when there are no active sessions` | Only skips/day-offs → null |
| `returns 1.0 for a plan started today with one extra` | Denominator clamped to 1 week |
| `returns 3.0 for exactly 3 workouts over 7 days` | Exact 1-week span |
| `returns 1.5 for 3 workouts over 14 days` | 2-week span |
| `counts extras alongside completed rotation entries` | Extras add to count |
| `excludes skip entries from the count` | Skip excluded |
| `excludes day_off entries from the count` | Day-off excluded |
| `excludes entries for a different plan` | Plan isolation |
| `excludes entries after today` | Future entries excluded |
| `deduplicates same-date complete entries to avoid inflating count` | Mirrors isPlanExpired dedup |
| `rounds result to one decimal place` | 2.5 → 2.5 (not 2.4999...) |
| `returns 7.0 when working out every day for one week` | 7/7 days |

---

## After Changes

- **Test files:** 35
- **Tests:** 1251 (+13)
- **Result:** All passing

---

## Tests Reviewed (Not Modified)

The following test suites were reviewed during the audit and confirmed to cover their domains thoroughly:

| File | Tests | Notes |
|---|---|---|
| `engine/__tests__/rotationEngine.test.ts` | 72 | Comprehensive: mod, computeCurrentDayIndex, getTodayResolvedDay, getUpcomingDays, getResolvedDaysRange, isPlanExpired |
| `engine/__tests__/calendarProjection.test.ts` | 22 | Grid building, pre-start clamping, today highlighting |
| `engine/__tests__/programParser.test.ts` | 35 | YAML parsing edge cases |
| `store/__tests__/historyStore.test.ts` | 87 | All store actions, migration, dedup semantics |
| `store/__tests__/outcomeStore.test.ts` | 54 | Outcome CRUD, progression, error recovery |
| `store/__tests__/planStore.test.ts` | 45 | Plan CRUD, migration |
| `store/__tests__/planDeleteCleanup.test.ts` | 8 | Cross-store cleanup on plan delete |
| `lib/__tests__/expressionEval.test.ts` | 79 | Full DSL coverage including NaN guard, multi-statement |
| `lib/__tests__/historyStats.test.ts` | 264 (→277) | All 22 exported functions covered |
| `lib/__tests__/workoutInstanceId.test.ts` | 21 | makeWorkout*, parseWorkout*, extractExtraId — including extra-ID format |

---

## Important Areas Still Untested

1. **`TodayPlanProgressModal` component** — No snapshot or render test exists. The new "Avg / week" row is verified by running the app, not by a test. A component test using `@testing-library/react` would be valuable.

2. **`TodayPage` integration flows** — The double-day flow, undo flow, and catch-up modal are only covered by the store-level unit tests and manual testing. Integration tests for these state machines would catch regression.

3. **`buildMonthGrid` in CalendarPage** — `calendarProjection.test.ts` covers the pure function, but the CalendarPage component itself (day-detail modal, retroactive logging flow) has no UI test.

4. **`expressionEval.ts` — `parsePrimary` dev warning** — The new `console.warn` in `parsePrimary` is not directly tested (the tokenizer-level warning for unknown characters IS tested, but the parser-level fallback is not). Adding a test similar to the existing `unknown character tokenizer warning` describe block would complete coverage.
