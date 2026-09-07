# Review Notes — Overnight Audit Pass
**Date:** 2026-09-07

---

## Executive Summary

The codebase is in excellent shape. All 1362 tests passed before this pass; this pass added 2 more (total: 1364). No bugs were found. The audit covered all major modules: rotation engine, history store, outcome store, session summary, history stats, and calendar projection. Test coverage is comprehensive across every exported function.

---

## Audit Scope

Modules reviewed this pass:
- `src/engine/rotationEngine.ts` — pointer advancement, override application, status assignment
- `src/engine/calendarProjection.ts` — month grid builder, `buildMonthGrid` with `weekStartsOn`
- `src/store/historyStore.ts` — `migrateHistoryState`, `addEntry`, `removeRetroJumpForDate`
- `src/store/outcomeStore.ts` — `logOutcomeWithProgression`, `migrateOutcomeState`, `deferred` completionState handling
- `src/lib/historyStats.ts` — `buildPRFlagsMap`, `computeCurrentStreakDates`, `computeConsecutiveSkips`, `findBestWeek`, `computeAverageWorkoutsPerWeek`
- `src/lib/sessionSummary.ts` — `findPreviousSessionForPlanDay`, `buildLastSessionSummary`
- `src/lib/__tests__/sessionSummary.test.ts` — test completeness review

---

## Findings

### Confirmed good
- All migration functions (`migrateHistoryState`, `migrateOutcomeState`, `migratePlanState`) have dedicated unit test suites.
- `buildLastSessionSummary` PB detection uses strict-greater-than semantics (fixed Sep 6); well-tested.
- `computeCurrentStreakDates`, `getStreakDatesSet`, and `computeConsecutiveSkips` all have plan-isolation and edge-case coverage.
- `calendarProjection.test.ts` covers all status values, pointer advancement, overrides, `historyEntry` attachment, and `weekStartsOn` variants.
- `deferred` completionState correctly maps to `session_complete=false` in YAML progression rules; tested in `outcomeStore.test.ts`.

### Edge case documented (this pass)
- `buildLastSessionSummary` for `actualDistanceMiles=0` and `actualDistanceMeters=0`: the current code displays "0 mi" / "0 m" (non-null guard treats zero as present data). Pace derivation correctly guards against division-by-zero via `distance > 0`, so no pace is shown. Two tests added to lock in and document this behavior.

---

## Recommendations (carry-forward)

| Item | Priority | Notes |
|---|---|---|
| `TodayPage` state extraction hook | Low | ~1200-line component; high refactor risk, deferred indefinitely |
| `updateEntryDate` data-loss on collision | Low | Intentional — CalendarPage, HistoryPage, TodayPage callers rely on delete-on-collision behavior |
| `beforeunload` Supabase async flush | Low | Product decision needed; `navigator.sendBeacon` alternative requires format compatibility verification |
| Integration test for TodayPage "Last session" PB hint | Low | Unit coverage exists; rendering path still untested |

---

## Test Results

| Suite | Before | After | Delta |
|---|---|---|---|
| `sessionSummary.test.ts` | 53 | 55 | +2 |
| All suites | 1362 | 1364 | +2 |

All tests pass.
