# Test Results — 2026-09-15 overnight session

## Command

```
node_modules/.bin/vitest run
```

## Result

```
Test Files  35 passed (35)
     Tests  1374 passed (1374)
  Start at  04:19:39
  Duration  3.27s
```

## Baseline

The branch starts from 35 test files / 1371 tests (all green, confirmed
before making any changes).

## Delta

+3 tests added in `src/lib/__tests__/historyStats.test.ts` under
`describe('computePersonalRecords')`:
1. `does not surface 0-load session as a PR (bodyweight / unrecorded)`
2. `does not surface 0-reps session as a PR`
3. `correctly picks the real-load session when mixed with a 0-load session`

No tests were removed or modified.  All 1374 tests pass on the final head commit.
