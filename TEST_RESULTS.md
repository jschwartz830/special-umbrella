# Test Results — 2026-08-29

## Summary

| Metric | Value |
|---|---|
| Test files | 35 |
| Tests before this pass | 1352 |
| Tests added this pass | 4 |
| Tests after this pass | 1356 |
| Failures | 0 |
| TypeScript errors | 0 |

## Command

```
npx vitest run
```

## Output (final lines)

```
Test Files  35 passed (35)
     Tests  1356 passed (1356)
  Start at  04:21:04
  Duration  2.90s (transform 1.52s, setup 0ms, import 2.99s, tests 550ms, environment 3ms)
```

## New Tests Added This Pass

| File | Test description |
|---|---|
| `historyStats.test.ts` | `computeWeeklyBreakdown` — excludes extras for a different plan (plan isolation) |
| `historyStats.test.ts` | `computeWeeklyBreakdown` — counts multiple extras on the same date as separate contributions (no dedup) |
| `storeSync.test.ts` | `syncOnLogin` — logs console.error when fetch fails |
| `storeSync.test.ts` | `syncOnLogin` — logs console.error when pushStore upsert fails (first-ever login push path) |

---

# Test Results — 2026-08-27

## Summary

| Metric | Value |
|---|---|
| Test files | 35 |
| Tests before this pass | 1349 |
| Tests added this pass | 3 |
| Tests after this pass | 1352 |
| Failures | 0 |
| TypeScript errors | 0 |

## Command

```
npx vitest run
```

## Output (final lines)

```
Test Files  35 passed (35)
     Tests  1352 passed (1352)
  Start at  07:17:11
  Duration  4.44s (transform 2.34s, setup 0ms, import 4.60s, tests 913ms, environment 5ms)
```

## New Tests Added This Pass

**File:** `src/lib/__tests__/storeSync.test.ts`

**Tests:**
1. `backfills progressionStates via migrateOutcomeState when missing from old cloud data` — verifies that when `syncOnLogin` hydrates `wpt_outcomes` from a cloud snapshot missing `progressionStates`, the field is backfilled to `{}`.
2. `backfills vars via migrateProgramState when missing from old cloud data` — verifies that when `syncOnLogin` hydrates `wpt_program_vars` from a cloud snapshot missing `vars`, the field is backfilled to `{}`.
3. `backfills records via migrateExerciseHistoryState when missing from old cloud data` — verifies that when `syncOnLogin` hydrates `wpt_exercise_history` from a cloud snapshot missing `records`, the field is backfilled to `[]`.

**What they cover:** All three directly exercise the storeSync.ts changes for this pass — the three stores that previously used identity migrations now use their proper migration functions.
