# Test Results — 2026-09-21

All tests passing.

| Suite | Count |
|---|---|
| All test files | 35 |
| Total tests | 1378 |
| Passed | 1378 |
| Failed | 0 |

## New tests added this pass (+7)

### `src/lib/__tests__/previousSetsHelper.test.ts` (+7)

New `describe('findPreviousWeightsOutcome')` suite:

- `returns null when no outcomes exist`
- `returns null when the only outcome is on the current date`
- `returns the most recent prior outcome`
- `excludes future-dated outcomes (same class of bug as findPreviousSetsByExercise)`
- `returns null when only future-dated outcomes exist`
- `does not return outcomes from a different plan`
- `returns null when the only prior outcome has no weights data`

---

# Test Results — 2026-09-14

All tests passing.

| Suite | Count |
|---|---|
| All test files | 35 |
| Total tests | 1371 |
| Passed | 1371 |
| Failed | 0 |

## New tests added this pass (+2)

### `src/lib/__tests__/previousSetsHelper.test.ts` (+2)

- `excludes future-dated rotation outcomes (same class of bug as findPreviousSessionForPlanDay)`
- `excludes future-dated extra workout outcomes`

---

# Test Results — 2026-09-13

All tests passing.

| Suite | Count |
|---|---|
| All test files | 35 |
| Total tests | 1369 |
| Passed | 1369 |
| Failed | 0 |

## New tests added this pass (+5)

### `src/lib/__tests__/historyStats.test.ts` (+4)

- `computePersonalRecords > excludes future-dated records when today is provided`
- `computePersonalRecords > includes all records when today is not provided (backward-compatible)`
- `computePersonalRecords > excludes future-dated records even when planId filter is applied`
- `computePersonalRecords > returns empty array when all records are in the future`

### `src/lib/__tests__/estimateRunDuration.test.ts` (+1)

- `estimateRunDurationMin > falls through to distance when duration is present but unrecognized`

## Command

```
npx vitest run
```

Duration: ~3.5s
