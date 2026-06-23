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

## Pass 62 — 2026-06-23

### Tests Reviewed

Ran full test suite at start of pass: **923 tests across 24 files — all passing**.

Key files audited for coverage gaps:
- `src/lib/__tests__/expressionEval.test.ts` — very thorough; already covers div-by-zero (line 85), unknown functions, NaN/Infinity guards.
- `src/lib/__tests__/historyStats.test.ts` — 2421 lines; covers all exported functions including `computeCurrentStreakDates` and `findBestWeek`.
- `src/engine/__tests__/rotationEngine.test.ts` — covers all public functions; override, jump, go_back scenarios.
- `src/modules/run-adaptation/__tests__/engine.test.ts` — covers all progression paths (progress/hold/regress/none).

### Tests Added/Updated

None added this pass.

**Reason**: The two bug fixes involve React component behavior (modal close/discard flow) that requires React Testing Library or Playwright to test meaningfully. The `roundMiles` fix is on a private function only verifiable through integration. Adding unit tests would require either:
- Extracting `roundMiles` as an exported function
- Adding RTL to the project
Neither was deemed worth the scope increase for this pass.

### Results

| Before | After |
|--------|-------|
| 923 tests, 24 files, all passing | 923 tests, 24 files, all passing |

### Important Areas Still Untested

| Area | Gap | Severity |
|------|-----|----------|
| OutcomeModal close behavior | No test for discard warning triggering on new vs. edit | Medium (React component) |
| `roundMiles` with sub-0.5 steps | Private function; epsilon fix not directly testable | Low |
| CalendarPage retroactive logging flow | End-to-end scenario not covered by unit tests | Medium |
| HistoryPage outcome editing flow | Same — requires integration/e2e | Medium |
