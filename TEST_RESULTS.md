# Test Results — 2026-08-17

## Run

```
vitest run
```

## Results

```
Test Files  35 passed (35)
     Tests  1280 passed (1280)
  Duration  ~3.4s
```

## New tests added this pass (+18)

### `computeWeeklyBreakdown` dedup (2 tests)
- `dedup: only the newest entry per calendarDate is counted`
- `dedup: two complete entries for the same date count as one, not two`

### `computeWorkoutTypeBreakdown` dedup (3 tests)
- `dedup: only the newest entry per (planId, date) is counted`
- `dedup: two complete entries for the same (planId, date) count as one completed`
- `dedup: different plans on the same date are NOT deduped against each other`

### `computeLongestPlanStreak` (13 tests)
- returns 0 with no entries
- returns 1 for a single qualifying date
- returns the length of a single consecutive run
- returns the longer of two separate runs
- a gap of 2 days splits a streak
- day_off counts toward streak
- skip alone does NOT extend a streak
- extras count toward streak
- future dates are excluded
- ignores entries for other plans when planId is given
- planId null aggregates across all plans
- longest streak >= current streak always
- equals current streak when the active streak is the all-time best

## TypeScript

`npx tsc --noEmit` — no errors.
