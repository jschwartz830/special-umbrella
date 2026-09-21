# Review Notes — Overnight Audit Pass
**Date:** 2026-09-21

---

## Executive Summary

1. **What changed:** One bug fix + extraction: `findPreviousWeightsOutcome` moved from TodayPage.tsx to `previousSetsHelper.ts`, with the missing future-date guard applied and 7 new tests added.
2. **Highest confidence:** The fix is a one-character predicate change (identical to the `findPreviousSetsByExercise` fix from the previous pass). Extraction is a clean rename+move with no logic change beyond the guard.
3. **Risky:** Nothing risky — the function's signature and callers are unchanged.
4. **Review first:** The guard change in `previousSetsHelper.ts:38` (`rest.slice(0, 10) >= currentDate` instead of `rest.startsWith(currentDate)`) — verify the new tests confirm both today's and future-dated outcomes are excluded.

All 1378 tests pass (up from 1371 — 7 new tests added).

---

## Audit Scope

Modules reviewed this pass:
- `src/pages/TodayPage.tsx` — `findPreviousWeightsOutcome`: found future-date gap (same class as previous pass)
- `src/lib/previousSetsHelper.ts` — confirmed fixed; `findPreviousWeightsOutcome` extracted here
- `src/lib/sessionSummary.ts` — `findPreviousSessionForPlanDay`: already uses `< currentDate`; correct
- `src/pages/CalendarPage.tsx` — uses `findPreviousSetsByExercise` (already fixed); `previousOutcome={null}`; no issue
- `src/pages/HistoryPage.tsx` — `computePersonalRecords` and `findBestWeek` both pass `today`; correct
- `src/lib/expressionEval.ts` — `parsePrimary` fallback already emits `console.warn` in DEV mode; IMPLEMENTATION_PLAN note updated
- `src/lib/__tests__/historyStats.test.ts` — `computeConsecutiveSkips` has comprehensive plan-isolation tests; IMPLEMENTATION_PLAN note updated

---

## Findings

### Fixed this pass

**`findPreviousWeightsOutcome` — missing future-date guard + extraction**

The function `findPreviousWeightsOutcome` in `TodayPage.tsx` (lines 64–79) used
`rest.startsWith(currentDate)` to exclude today's outcomes, matching the pre-fix
version of `findPreviousSetsByExercise` that was corrected last pass. A future-dated
outcome (e.g. from a bad CSV import with `calendarDate: '2026-12-31'`) would sort
first by `outcomeSortKey` and be returned as the "previous workout", causing
`ActiveWorkoutTracker` to pre-fill sets from a phantom future session.

**Fix:** Changed predicate to `rest.slice(0, 10) >= currentDate`, mirroring the guard
in `findPreviousSetsByExercise`. Simultaneously extracted the function to
`src/lib/previousSetsHelper.ts` so it can be unit-tested and sits alongside the
closely related `findPreviousSetsByExercise`. Removed the `outcomeSortKey` import from
TodayPage.tsx that was only needed for the private copy.

### Confirmed good

- All prior fixes remain in place and passing.
- `findPreviousSessionForPlanDay` (sessionSummary.ts:26): already uses `< currentDate` — correct.
- `computePersonalRecords` in HistoryPage: passes `today` — activated (fixed 2026-09-13).
- `findBestWeek` in HistoryPage: passes `today` — correct.
- CalendarPage: uses `findPreviousSetsByExercise` (fixed); passes `previousOutcome={null}` to `ActiveWorkoutTracker`.
- `expressionEval.ts parsePrimary`: emits `console.warn` in DEV; not silent.
- `computeConsecutiveSkips`: has comprehensive plan-isolation tests including `'extras for a different plan do not break the streak'` and `'complete entries from a different plan do not break the streak'`.

---

## Improvements Completed

| Item | Type | Confidence |
|---|---|---|
| `findPreviousWeightsOutcome` future-date guard | Bug fix | High |
| Extract `findPreviousWeightsOutcome` to `previousSetsHelper.ts` | Code quality | High |
| 7 new tests for `findPreviousWeightsOutcome` | Test coverage | High |

---

## Recommendations (carry-forward)

| Item | Priority | Notes |
|---|---|---|
| `TodayPage` state extraction hook | Low | ~1200-line component; high refactor risk, deferred indefinitely |
| `updateEntryDate` data-loss on collision | Low | Intentional — CalendarPage, HistoryPage, TodayPage callers rely on delete-on-collision behavior |
| `beforeunload` Supabase async flush | Low | Fire-and-forget `pushStore` may not complete before page teardown; `navigator.sendBeacon` alternative requires format compatibility verification |
| `computeWorkoutCompletionRate` UI surface | Low | Function exists in historyStats.ts since Pass 90; suggested for HistoryPage stats card or plan-progress modal |

---

## Definitely Keep

- `findPreviousWeightsOutcome` extraction + future-date fix
- All 7 new tests

## Probably Keep but Tweak

Nothing.

## Do Not Keep

Nothing.

## Open Questions

- Should `findPreviousWeightsOutcome` be renamed to better express that it returns the full outcome object (vs `findPreviousSetsByExercise` which returns sets)? Current name is clear enough; no action required.

---

## Test Results

| Suite | Before | After | Delta |
|---|---|---|---|
| All suites | 1371 | 1378 | +7 |

All 1378 tests pass across 35 files.
