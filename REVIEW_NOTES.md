# Review Notes — Overnight Audit Pass
**Date:** 2026-09-19

---

## Executive Summary

1. **What changed:** Two defensive fixes for the same future-date bug class found in TodayPage.tsx — `findPreviousWeightsOutcome` and `maxLoadByExercise`.
2. **Highest confidence:** Both changes are minimal, one-liner predicate changes that strictly tighten exclusion logic. No architectural risk.
3. **Risky:** Nothing risky. Both changes only affect users with future-dated records from a bad CSV import; correct data produces identical output.
4. **Review first:** The `findPreviousWeightsOutcome` change (TodayPage.tsx:74) — confirm `rest.slice(0, 10) >= currentDate` correctly excludes both today's and future-dated outcomes for both rotation IDs (`YYYY-MM-DD`) and extra IDs (`YYYY-MM-DD_extra_extraId`). This is identical to the `findPreviousSetsByExercise` fix from 2026-09-14.

All 1371 tests pass (no change — both fixed functions are private to TodayPage; unit test coverage not feasible without a rendering harness).

---

## Audit Scope

Modules reviewed this pass:
- `src/pages/TodayPage.tsx` — full re-review of private helper functions (`findPreviousWeightsOutcome`, `maxLoadByExercise` useMemo) and all call sites; found two future-date gaps
- `src/lib/historyStats.ts` — `buildPRFlagsMap`: confirmed it handles future-dated records correctly (they are processed last in date-sorted order; they don't affect running max for prior dates; only their own PR flags could be incorrectly set, which is acceptable since future-dated records are themselves bad data)
- `src/store/exerciseHistoryStore.ts` — `upsertFromOutcome`, `moveByWorkoutInstance`, `clearByPlanId`: all clean; no new issues

---

## Findings

### Fixed this pass

**1. `findPreviousWeightsOutcome` missing future-date guard**

The function pre-fills the OutcomeModal with the most recent previous outcome that has weights data. It excluded today's outcomes via `rest.startsWith(currentDate)`, but future dates were not excluded. Since the function picks the best outcome by `outcomeSortKey` (highest = most recent), a future-dated outcome (e.g. from a bad CSV import with `calendarDate: '2026-12-31'`) would be selected as the "previous weights session," feeding wrong weights/reps into every OutcomeModal opened for the plan.

This is the same class of bug fixed in:
- `findPreviousSessionForPlanDay` (2026-08-19): `!= currentDate` → `< currentDate`
- `findPreviousSetsByExercise` (2026-09-14): `startsWith(currentDate)` → `slice(0, 10) >= currentDate`

**Fix:** Changed `rest.startsWith(currentDate)` to `rest.slice(0, 10) >= currentDate`. Identical pattern to the Sep 14 fix.

**2. `maxLoadByExercise` includes future-dated exercise records**

The `maxLoadByExercise` useMemo builds the all-time max load per exercise from all `exerciseRecords`, without filtering out future-dated entries. This map is captured as `preWorkoutMaxLoad` immediately before saving a new outcome, and compared against the session's loads to detect PRs (shown in the post-workout PR banner).

A future-dated exercise record from a bad CSV import would inflate `preWorkoutMaxLoad[exercise]` to the future load. If a user then sets a new load that is higher than all genuine past records but lower than the fake future record, the PR banner would be suppressed (the comparison `todayMax > prevMax` would be false).

**Fix:** Added `if (r.calendarDate > today) continue` guard and added `today` to the `useMemo` dependency array so the baseline refreshes at midnight.

### Confirmed good

- `buildPRFlagsMap` handles future-dated records correctly — they are processed at the end of the date-sorted pass and don't contaminate the running max for prior dates. The only risk is that a future-dated record would incorrectly flag itself as a PR; since it's bad data, this is acceptable and less harmful than suppressing a genuine PR.
- `exerciseHistoryStore` — `upsertFromOutcome`, `moveByWorkoutInstance`, `clearByPlanId`: all clean.

---

## Recommendations (carry-forward)

| Item | Priority | Notes |
|---|---|---|
| `TodayPage` state extraction hook | Low | ~1200-line component; high refactor risk, deferred indefinitely |
| `updateEntryDate` data-loss on collision | Low | Intentional — CalendarPage, HistoryPage, TodayPage callers rely on delete-on-collision behavior |
| `beforeunload` Supabase async flush | Low | Fire-and-forget `pushStore` may not complete before page teardown; `navigator.sendBeacon` alternative requires format compatibility verification |
| Integration test for TodayPage "Last session" PB hint | Low | Unit coverage exists; rendering path still untested |

---

## Test Results

| Suite | Before | After | Delta |
|---|---|---|---|
| All suites | 1371 | 1371 | 0 |

All 1371 tests pass across 35 files. No new tests this pass (both fixed functions are private inline functions in TodayPage; unit testing requires a rendering harness, which is deferred per prior audit notes).

---

# Review Notes — Overnight Audit Pass
**Date:** 2026-09-14

---

## Executive Summary

1. **What changed:** Two defensive fixes closing the same class of future-date bug across different call sites.
2. **Highest confidence:** Both changes are minimal, targeted, and covered by new tests. No architectural risk.
3. **Risky:** Nothing risky — both are one-liner predicate changes that strictly tighten existing exclusion logic.
4. **Review first:** The `findPreviousSetsByExercise` change (previousSetsHelper.ts:30) — verify `rest.slice(0, 10) >= currentDate` handles all ID formats correctly (rotation + extra), which the two new tests confirm.

All 1371 tests pass (up from 1369 — 2 new tests added).

---

## Audit Scope

Modules reviewed this pass:
- `src/lib/previousSetsHelper.ts` — `findPreviousSetsByExercise`: found future-date gap
- `src/pages/HistoryPage.tsx` — `computePersonalRecords` call site: found missing `today` argument
- `src/lib/storeSync.ts` — confirmed `beforeunload` handler is present; `pushStore` calls are fire-and-forget (async without await); still a trade-off but no new issue
- `src/engine/calendarProjection.ts` — `buildMonthGrid`: confirmed correct; `weekStartsOn` parameter wired correctly from settingsStore
- `src/lib/outcomeSortKey.ts`, `src/lib/planDayUtils.ts` — both simple and correct
- `src/lib/workoutInstanceId.ts`, `src/store/exerciseHistoryStore.ts` — fully tested; no new issues

---

## Findings

### Fixed this pass

**1. `findPreviousSetsByExercise` missing future-date guard**

The function pre-fills the OutcomeModal's set weights/reps from the most recent prior session. It excluded today's outcomes via `rest.startsWith(currentDate)`, but futures dates were not excluded. Since results are sorted newest-first, a future-dated outcome (e.g. from a bad CSV import with `calendarDate: '2026-12-31'`) would appear first and its sets would be used for pre-fill.

This is the same class of bug fixed in the 2026-08-19 pass for `findPreviousSessionForPlanDay` (changed `!= currentDate` to `< currentDate`).

**Fix:** Changed `rest.startsWith(currentDate)` to `rest.slice(0, 10) >= currentDate`. The new condition is a strict superset: it still excludes today's outcomes and also excludes any future-dated ones. Extracting `slice(0, 10)` rather than relying on `startsWith` makes the date comparison explicit and correct for both rotation IDs (`YYYY-MM-DD`) and extra IDs (`YYYY-MM-DD_extra_extraId`).

**2. `HistoryPage` — `computePersonalRecords` missing `today` argument**

The 2026-09-13 pass added an optional `today?: string` parameter to `computePersonalRecords` to guard against future-dated exercise records, but the carry-forward recommendation to update call sites was not implemented. Passing `today` to the `HistoryPage` call activates the guard. Also added `today` to the `useMemo` dependency array so the computed value refreshes at midnight.

### Confirmed good

- All prior fixes remain in place and passing.
- `storeSync.ts` `beforeunload` handler correctly calls `pushStore` for each pending store; the async-without-await trade-off is unchanged and outside the scope of this pass.
- `buildMonthGrid` and `calendarProjection` — clean, no issues.

---

## Recommendations (carry-forward)

| Item | Priority | Notes |
|---|---|---|
| `TodayPage` state extraction hook | Low | ~1200-line component; high refactor risk, deferred indefinitely |
| `updateEntryDate` data-loss on collision | Low | Intentional — CalendarPage, HistoryPage, TodayPage callers rely on delete-on-collision behavior |
| `beforeunload` Supabase async flush | Low | Fire-and-forget `pushStore` may not complete before page teardown; `navigator.sendBeacon` alternative requires format compatibility verification |
| Integration test for TodayPage "Last session" PB hint | Low | Unit coverage exists; rendering path still untested |

---

## Test Results

| Suite | Before | After | Delta |
|---|---|---|---|
| All suites | 1369 | 1371 | +2 |

All 1371 tests pass across 35 files. 2 new tests added this pass:

### `src/lib/__tests__/previousSetsHelper.test.ts` (+2)

- `excludes future-dated rotation outcomes (same class of bug as findPreviousSessionForPlanDay)`
- `excludes future-dated extra workout outcomes`
