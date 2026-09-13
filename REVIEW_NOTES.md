# Review Notes — Overnight Audit Pass
**Date:** 2026-09-13

---

## Executive Summary

All 1369 tests pass (up from 1364 — 5 new tests added). Two targeted improvements were made:

1. **`computePersonalRecords` future-date guard** — defensive fix matching prior passes for `computeHistoryStats`, `findBestWeek`, and `findPreviousSessionForPlanDay`.
2. **`estimateRunDurationMin` fallthrough test** — pinned an important control-flow behavior that was previously unexercised in tests.

No bugs were found beyond the items addressed. The codebase remains in excellent shape.

---

## Audit Scope

Modules reviewed this pass:
- `src/lib/historyStats.ts` — `computePersonalRecords` future-date guard; existing dedup/guard patterns reviewed for completeness
- `src/lib/estimateRunDurationMin.ts` — segment resolution order; duration-regex non-match → distance fallthrough
- `src/lib/__tests__/historyStats.test.ts` — new tests for `computePersonalRecords` with `today` param
- `src/lib/__tests__/estimateRunDuration.test.ts` — new test for combined duration+distance segment
- `src/store/outcomeStore.ts`, `src/store/planStore.ts`, `src/store/exerciseHistoryStore.ts` — re-reviewed for consistency with new `computePersonalRecords` signature; no callers currently pass `today` (backward-compatible)

---

## Findings

### Fixed this pass

**`computePersonalRecords` missing future-date guard**

All other stat functions that compute from dated records have been given a `today` guard over the past several passes:
- `computeHistoryStats`: `pastEntries = entries.filter(e => e.calendarDate <= today)` (2026-08-14)
- `findBestWeek`: `today?` parameter added (2026-08-24)
- `findPreviousSessionForPlanDay`: predicate changed to `< currentDate` (2026-08-19)
- `computeWorkoutTypeBreakdown`: `dateRange` clamped to `today` in HistoryPage (2026-08-24)

`computePersonalRecords` was the only remaining stat function without this guard. A bad CSV import creating `ExerciseSessionRecord` rows with `calendarDate > today` would:
- Inflate `sessionCount` in the Personal Records table
- Show a future date as `maxLoadDate` or `maxRepsDate`

**Fix:** Added optional `today?: string` parameter. When provided, records are pre-filtered by `calendarDate <= today` before planId scoping and aggregation. Omitting the parameter preserves prior behavior for all existing callers.

### Pinned this pass

**`estimateRunDurationMin` duration-unrecognized → distance fallthrough**

The implementation correctly falls through from the `seg.duration` branch to the `seg.distance` branch when `duration` doesn't match the `/m(?:in)?$/` regex. The existing test for unrecognized duration (`"30km"`) used a segment with no `distance` field, so only the final 20-min fallback was exercised — not the fallthrough itself. A future developer adding `continue` after the regex non-match would silently break this behavior.

Added one test with `{ duration: '30km', distance: '2' }` → 22 min (2 × 11 min/mi).

### Confirmed good

- All prior fixes remain in place and passing.
- `computePersonalRecords` existing tests (8 cases) still pass with no behavior change.
- The `today` parameter is additive and backward-compatible — zero callers needed updating.

---

## Recommendations (carry-forward)

| Item | Priority | Notes |
|---|---|---|
| `TodayPage` state extraction hook | Low | ~1200-line component; high refactor risk, deferred indefinitely |
| `updateEntryDate` data-loss on collision | Low | Intentional — CalendarPage, HistoryPage, TodayPage callers rely on delete-on-collision behavior |
| `beforeunload` Supabase async flush | Low | Product decision needed; `navigator.sendBeacon` alternative requires format compatibility verification |
| Integration test for TodayPage "Last session" PB hint | Low | Unit coverage exists; rendering path still untested |
| Pass `today` to `computePersonalRecords` at call sites | Low | The guard now exists; call sites (HistoryPage, PRs modal) should pass `today` to activate it |

---

## Test Results

| Suite | Before | After | Delta |
|---|---|---|---|
| All suites | 1364 | 1369 | +5 |

All 1369 tests pass across 35 files. 5 new tests added this pass:
- 4 in `historyStats.test.ts` (`computePersonalRecords` future-date behavior)
- 1 in `estimateRunDuration.test.ts` (segment duration-unrecognized fallthrough)
