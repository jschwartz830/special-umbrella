# Test Results — 2026-09-04

## Summary

| Metric | Value |
|---|---|
| Test files | 35 |
| Tests before this pass | 1356 |
| Tests added this pass | 1 |
| Tests after this pass | 1357 |
| Failures | 0 |
| TypeScript errors | 0 |

## Command

```
npx vitest run
```

## Output (final lines)

```
Test Files  35 passed (35)
     Tests  1357 passed (1357)
  Start at  04:19:57
  Duration  4.23s (transform 2.34s, setup 0ms, import 4.53s, tests 875ms, environment 4ms)
```

## New Tests Added This Pass

**File:** `src/lib/__tests__/historyStats.test.ts`

**Tests:**
1. `complete entries from a different plan do not break the streak` — verifies that a `complete` entry for plan-B on a date where plan-A has a `skip` entry does not add that date to plan-A's `breakDates`, so the skip streak correctly counts 2 instead of stopping at 1.

**What they cover:** The plan-isolation guard in `computeConsecutiveSkips` (`if (e.planId !== planId) continue`) for the specific case where a cross-plan `complete` entry coincides with a same-plan `skip` entry. Prior tests verified plan-B `skip` entries were treated as gaps and plan-B extras were ignored, but left the `complete`-coincidence case uncovered.
