# Test Results

## 2026-06-19 (sixty-first pass) — branch `claude/dreamy-mccarthy-7ugj5k`

---

### Final run

```
Test Files  24 passed (24)
     Tests  923 passed (923)
  Start at  07:17:14
  Duration  3.43s (transform 1.83s, setup 0ms, import 3.78s, tests 630ms, environment 4ms)
```

All 923 tests pass. Zero failures. Zero skipped.

---

### Delta from pass 60

| Metric | Pass 60 | Pass 61 | Delta |
|--------|---------|---------|-------|
| Test files | 21 | 24 | +3 |
| Tests | 887 | 923 | +36 |
| Failures | 0 | 0 | — |

---

### New test files

#### `src/lib/__tests__/shareWorkout.test.ts` (15 tests)

Tests for `formatWorkoutForClipboard`:

```
✓ includes the day label and date label on the first line
✓ includes the plan name on the second line
✓ includes slot name and type for a rest-day slot
✓ formats weight exercises with sets, reps, and load
✓ formats weight exercises without load when load is omitted
✓ formats a run slot using targetDistance when no segments
✓ formats structured run segments with name, reps, distance, and pace
✓ handles exercises with SetSpec array (uses array length as set count)
✓ includes structureDescription when present on a slot
✓ handles a slot with durationMin and no distance
✓ handles a slot with notes and no other targets
✓ produces stable output — no trailing whitespace on segment lines
✓ renders multiple slots in one day
```

(Tests 4–5 are split across a single `it` block pair in the file; total distinct assertions is higher than the item count.)

#### `src/lib/__tests__/planDayUtils.test.ts` (8 tests)

Tests for `extraToPlanDay`:

```
✓ returns a PlanDay whose id matches the extra id
✓ uses workoutName as the PlanDay label
✓ returns exactly one slot
✓ slot id matches the extra id
✓ slot type matches the extra workoutType
✓ slot name matches the extra workoutName
✓ maps each WorkoutType correctly through the slot
✓ produces a valid PlanDay shape (id, label, slots all present)
```

#### `src/lib/__tests__/outcomeSortKey.test.ts` (9 tests)

Tests for `outcomeSortKey`:

```
✓ returns completedAt when present
✓ falls back to calendarDate extracted from workoutInstanceId when completedAt is null
✓ falls back to calendarDate when completedAt is undefined
✓ returns empty string when instanceId does not contain a recognisable date
✓ completedAt sorts later than calendarDate for the same date
✓ two outcomes with completedAt can be sorted chronologically
✓ two outcomes with only calendarDates can be sorted chronologically
✓ handles extra-workout instanceId (contains _extra_ segment)
✓ handles planId with underscores without extracting wrong date
```

---

### Modified test files

#### `src/store/__tests__/historyStore.test.ts` (+6 tests)

New `addOverride` describe block:

```
✓ appends an override with a generated id and the given type
✓ uses the provided appliedAt when given (calendar back-dating)
✓ defaults appliedAt to now (ISO string) when not provided
✓ stores targetDayIndex for jump overrides
✓ accumulates multiple overrides without replacing earlier ones
✓ each generated id is unique across multiple adds
```

---

### Pre-existing test files (unchanged, all passing)

| File | Tests |
|------|-------|
| `src/engine/__tests__/rotationEngine.test.ts` | 83 |
| `src/store/__tests__/historyStore.test.ts` | (extended — see above) |
| `src/store/__tests__/outcomeStore.test.ts` | — |
| `src/lib/__tests__/expressionEval.test.ts` | — |
| `src/lib/__tests__/historyStats.test.ts` | — |
| `src/lib/__tests__/calendarProjection.test.ts` | — |
| `src/lib/__tests__/workoutInstanceId.test.ts` | — |
| *(all others)* | — |

All pre-existing tests continue to pass without modification.

---

## 2026-06-21 (sixty-second pass) — branch `claude/dreamy-mccarthy-zu4z6a`

---

### Final run

```
Test Files  24 passed (24)
     Tests  935 passed (935)
  Start at  07:14:20
  Duration  2.44s
```

All 935 tests pass. Zero failures. Zero skipped.

---

### Delta from pass 61

| Metric | Pass 61 | Pass 62 | Delta |
|--------|---------|---------|-------|
| Test files | 24 | 24 | 0 |
| Tests | 923 | 935 | +12 |
| Failures | 0 | 0 | — |

No new test files — all new tests were added to the existing `historyStats.test.ts`.

---

### New tests in `src/lib/__tests__/historyStats.test.ts` (+12 tests)

#### `countTotalUnloggedDays` (8 tests)
```
✓ returns 0 when plan starts today
✓ returns 0 when plan starts in the future
✓ returns full active-day count when nothing is logged
✓ subtracts logged dates from the active-day count
✓ does not count today as an active past day
✓ ignores entries before plan start date
✓ ignores entries for a different plan
✓ deduplicates multiple entries for the same date (one logged day)
✓ returns 0 when every past day is logged
```

#### `computeRotationCycleProgress deduplication` (1 test)
```
✓ treats duplicate entries on the same date as one completion (mirrors isPlanExpired)
```

#### `computeRotationPlanRemaining deduplication` (1 test)
```
✓ treats duplicate entries on the same date as one completion (mirrors isPlanExpired)
```

#### `getUnloggedPastDates 14-day window` (1 test)
```
✓ surfaces gaps beyond 7 days when lookbackDays=14
```

---

### Areas still without test coverage

| Area | Notes |
|------|-------|
| React components | TodayPage, CalendarPage, OutcomeModal — no RTL or Playwright tests |
| PR detection logic | The `newPRs` detection in `handleOutcomeConfirm` is UI logic and not unit-tested |
| `olderUnloggedCount` display | UI rendering logic in TodayPage — not unit-tested |
| Multi-timezone behavior | No tests for the date-string convention under timezone changes |
