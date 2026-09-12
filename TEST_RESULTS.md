# Test Results — Overnight Audit Pass
**Date:** 2026-09-12

---

## Summary

| Metric | Value |
|---|---|
| Total test files | 35 |
| Total tests before pass | 1364 |
| Total tests after pass | 1365 |
| Tests added | 1 |
| Tests failed | 0 |
| Command | `npx vitest run` |

All 1365 tests pass. One new test added: `formatExerciseSpec` undefined-sets `'?'` fallback in `shareWorkout.test.ts`.

---

## New Tests This Pass

| File | Test | Coverage |
|---|---|---|
| `src/lib/__tests__/shareWorkout.test.ts` | `formats weight exercises with "?" when sets is undefined` | `formatExerciseSpec` fallback branch (`ex.sets` not a number and not an array) |

---

## Coverage Notes

- All major modules have test coverage: `rotationEngine`, `calendarProjection`, `historyStore`, `outcomeStore`, `historyStats`, `sessionSummary`, `workoutInstanceId`, `mobilityLibrary`, `mobilityStore`.
- Both migration functions tested (`migrateHistoryState`, `migrateOutcomeState`) with dedicated describe blocks.
- All `DayStatus` values covered in `calendarProjection.test.ts`.
- All `completionState` values (including `deferred`) tested in `outcomeStore.test.ts`.
- `buildPRFlagsMap` strict-greater-than semantics verified in `sessionSummary.test.ts` and `historyStats.test.ts`.
- `evaluateRunProgression` and `applyRunProgressionDecision` tested including regress and none/null paths (2026-09-05).
- `deriveProgressionMode` fully tested — all four mapping branches and the undefined opt-out case.
- `buildProgressionRecommendation` tested for weights (single/double/volume/maintenance), run, and swim.
- `computeConsecutiveSkips` plan-isolation tested — complete entries from another plan do not break the streak count.
- `currentStreakStartDate` tested: null for streak=0, today for streak=1, correct historical date for streak=3.
- Zero-distance run/swim edge cases in `buildLastSessionSummary` tested and locked in.
- `planDeleteCleanup` integration test covers all six cascade steps across all five stores (history, outcome, program, exerciseHistory, plan).
- `formatExerciseSpec` in `shareWorkout.ts`: all three branches now tested — number sets, array sets (SetSpec[]), and undefined/null fallback (→ `'?'`).
