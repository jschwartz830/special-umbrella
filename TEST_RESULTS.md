# Test Results — 2026-09-03

## Summary

| Metric | Value |
|---|---|
| Test files | 35 |
| Tests before this pass | 1356 |
| Tests added this pass | 5 |
| Tests after this pass | 1361 |
| Failures | 0 |
| TypeScript errors | 0 |

## Command

```
npx vitest run
```

## Output (final lines)

```
Test Files  35 passed (35)
     Tests  1361 passed (1361)
  Start at  04:21:10
  Duration  2.96s (transform 1.56s, setup 0ms, import 3.02s, tests 600ms, environment 3ms)
```

## New Tests Added This Pass

| File | Test | Why |
|---|---|---|
| `shareWorkout.test.ts` | `includes segment duration when present` | `seg.duration` branch in the segment formatter was uncovered — all prior tests used distance/pace segments |
| `shareWorkout.test.ts` | `shows ? for sets when sets field is undefined` | `typeof ex.sets === 'number'` + `Array.isArray` both false → `'?'` fallback was untested |
| `shareWorkout.test.ts` | `shows ? for reps when reps field is undefined` | `ex.reps != null` false → `'?'` fallback was untested |
| `shareWorkout.test.ts` | `falls through to targets branch when exercises array is empty` | `exercises: []` is truthy but length zero — neither exercises nor segments branch fires |
| `progressionMode.test.ts` | `returns single when progressionType is empty string and hasProgressRule is true` | `!''` true but `!true` false — undefined early-return skipped; falls through all explicit checks to `'single'` |

## Coverage Notes

All 35 test files pass; no files were removed or renamed. The five new tests are purely additive. No existing tests were modified.
