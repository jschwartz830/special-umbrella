# Test Results — Overnight Audit Pass
**Date:** 2026-09-07

---

## Summary

| Metric | Value |
|---|---|
| Total test files | checked via `vitest run` |
| Total tests before pass | 1362 |
| Total tests after pass | 1364 |
| Tests added | +2 |
| Tests failed | 0 |
| Command | `node_modules/.bin/vitest run` |

All 1364 tests pass.

---

## New Tests Added This Pass

### `src/lib/__tests__/sessionSummary.test.ts` (+2)

1. **`shows "0 mi" for run with actualDistanceMiles=0 (zero-distance bad data); no pace derived`**
   - Verifies that `buildLastSessionSummary` displays `"Last: 0 mi · 30 min"` when `actualDistanceMiles=0, actualDurationMin=30`.
   - Confirms pace derivation correctly guards against division-by-zero (distance > 0 required).

2. **`shows "0 m" for swim with actualDistanceMeters=0 (zero-distance bad data); no pace derived`**
   - Verifies that `buildLastSessionSummary` displays `"Last: 0 m · 20 min"` when `actualDistanceMeters=0, actualDurationMin=20`.
   - Same pace-derivation guard applies.

---

## Coverage Notes

- All major modules have test coverage: `rotationEngine`, `calendarProjection`, `historyStore`, `outcomeStore`, `historyStats`, `sessionSummary`, `workoutInstanceId`, `mobilityLibrary`, `mobilityStore`.
- Both migration functions tested (`migrateHistoryState`, `migrateOutcomeState`) with dedicated describe blocks.
- All `DayStatus` values covered in `calendarProjection.test.ts`.
- All `completionState` values (including `deferred`) tested in `outcomeStore.test.ts`.
- `buildPRFlagsMap` strict-greater-than semantics verified in `sessionSummary.test.ts` and `historyStats.test.ts`.
