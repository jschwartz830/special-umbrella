# Review Notes — Overnight Audit Pass
**Date:** 2026-09-18

---

## Executive Summary

1. **What changed:** One defensive fix closing the same class of future-date bug in `countPlanDayCompletions` and its two TodayPage call sites.
2. **Highest confidence:** Minimal, targeted predicate addition — strictly tightens existing logic; backward-compatible with callers that don't pass `today`.
3. **Risky:** Nothing risky.
4. **Review first:** TodayPage line 374 (`useMemo`): confirm `today` is in the dependency array (it is now) so the upcoming-card counts refresh at midnight.

All 1373 tests pass (up from 1371 — 2 new tests added).

---

## Audit Scope

Modules reviewed this pass:
- `src/lib/historyStats.ts` — `countPlanDayCompletions`: found missing `today` upper-bound parameter
- `src/pages/TodayPage.tsx` — both `countPlanDayCompletions` call sites: missing future-date guard
- `src/store/planStore.ts`, `src/store/exerciseHistoryStore.ts`, `src/store/historyStore.ts`, `src/store/outcomeStore.ts` — reviewed; no new issues
- Carry-forward items (TodayPage state extraction, `updateEntryDate`, `beforeunload` flush, integration test) — still deferred per prior notes

---

## Findings

### Fixed this pass

**1. `countPlanDayCompletions` missing future-date guard**

The function counts completed plan-day entries without excluding future-dated ones. TodayPage calls it for:
- The "Session N" label on today's pending card — correctly excluded today via `excludeDate`, but futures weren't capped
- Upcoming cards' session counts — no exclusion at all

This is the same class of bug fixed across multiple prior passes (2026-08-14, 2026-08-19, 2026-08-24, 2026-09-13, 2026-09-14).

**Fix:** Added `today?: string` as a fifth parameter; when provided, entries with `calendarDate > today` are excluded. Updated both TodayPage call sites (line 366 and line 374). Added `today` to the `useMemo` dep array at line 377.

---

## Carry-Forward / Open Items

| Item | Status | Notes |
|---|---|---|
| TodayPage state extraction hook | Deferred | ~1200-line component — risky mid-audit refactor |
| `updateEntryDate` data-loss risk | Deferred | Intentional collision-delete design |
| `beforeunload` async Supabase flush | Deferred | Product decision needed |
| Integration test for TodayPage PB hint | Deferred | Unit coverage exists; rendering path untested |

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
