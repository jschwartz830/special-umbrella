# Test Results — 2026-08-31

## Summary

| Metric | Value |
|---|---|
| Test files | 35 |
| Tests before this pass | 1352 |
| Tests added this pass | 1 |
| Tests after this pass | 1353 |
| Failures | 0 |
| TypeScript errors | 0 |

## Command

```
npx vitest run
```

## Output (final lines)

```
Test Files  35 passed (35)
     Tests  1353 passed (1353)
  Start at  04:19:55
  Duration  2.97s (transform 1.65s, setup 0ms, import 3.15s, tests 585ms, environment 3ms)
```

## New Tests Added This Pass

**File:** `src/store/__tests__/exerciseHistoryStore.test.ts`

**Tests:**
1. `moveByWorkoutInstance > updates workoutInstanceId but leaves calendarDate unchanged when newId contains no parseable date` — verifies that when `parseWorkoutInstanceId(newId)` fails to find a `YYYY-MM-DD`, the record's `workoutInstanceId` is updated to `newId` but `calendarDate` remains at its prior value (no panic, graceful no-op for the date field).

**What it covers:** Documents the defensive fallback in the conditional spread `...(newDate ? { calendarDate: newDate } : {})` inside `moveByWorkoutInstance`. Prevents a future refactor from accidentally causing a crash or silently stomping a valid date when the caller supplies a malformed instanceId.
