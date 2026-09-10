# Test Results — Overnight Audit Pass
**Date:** 2026-09-10

---

## Summary

| Metric | Value |
|---|---|
| Total test files | checked via `vitest run` |
| Total tests before pass | 1364 |
| Total tests after pass | 1367 |
| Tests added | 3 |
| Tests failed | 0 |
| Command | `node_modules/.bin/vitest run` |

All 1367 tests pass. 3 new tests added in `src/modules/workout-outcomes/__tests__/progression.test.ts` covering the `maintenance` mode fix in `buildWeightsRecommendation`.

---

## Coverage Notes

- All major modules have test coverage: `rotationEngine`, `calendarProjection`, `historyStore`, `outcomeStore`, `historyStats`, `sessionSummary`, `workoutInstanceId`, `mobilityLibrary`, `mobilityStore`.
- Both migration functions tested (`migrateHistoryState`, `migrateOutcomeState`) with dedicated describe blocks.
- All `DayStatus` values covered in `calendarProjection.test.ts`.
- All `completionState` values (including `deferred`) tested in `outcomeStore.test.ts`.
- `buildPRFlagsMap` strict-greater-than semantics verified in `sessionSummary.test.ts` and `historyStats.test.ts`.
- `evaluateRunProgression` and `applyRunProgressionDecision` tested including regress and none/null paths (2026-09-05).
- `deriveProgressionMode` fully tested — all four mapping branches and the undefined opt-out case.
- `buildProgressionRecommendation` tested for weights (single/double/volume/maintenance — all four modes now explicit), run, and swim.
- `computeConsecutiveSkips` plan-isolation tested — complete entries from another plan do not break the streak count.
- `currentStreakStartDate` tested: null for streak=0, today for streak=1, correct historical date for streak=3.
- Zero-distance run/swim edge cases in `buildLastSessionSummary` tested and locked in.
