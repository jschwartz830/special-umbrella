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
