# Test Results

Generated: 2026-04-16

---

## Existing Tests Reviewed

### `src/modules/run-adaptation/__tests__/engine.test.ts`

- **26 tests** across four suites:
  - `evaluateRunProgression` — 13 tests (progress/hold/regress paths, proxy completion, effort thresholds, step sizes, baseline floor)
  - `applyRunProgressionDecision` — 2 tests
  - `derivePaceSecondsPerMile` — 2 tests
  - `formatPace` — 2 tests
  - `resolveWorkoutDisplayTarget` — 5 tests

**Assessment**: Good coverage of the run adaptation engine. Tests are well-structured and cover both happy paths and edge cases. All 26 tests pass.

---

## Tests Added

### `src/engine/__tests__/rotationEngine.test.ts`

- **37 tests** across five suites:

#### `mod` (2 tests)
- Positive inputs (wrap behavior)
- Negative inputs (symmetric modulo for go_back)

#### `computeCurrentDayIndex` (14 tests)
- Returns startDayIndex on plan start date with no entries
- Returns startDayIndex when no entries and no movement
- Advances for complete, skip, and day_off entries
- Does NOT advance for unlogged past days
- Wraps at rotation boundary (modulo)
- Multiple mixed-action entries
- Respects non-zero startDayIndex
- Advance override before reading entry
- Go_back override reducing pointer
- Jump override setting specific position
- Jump + entry: advances from jumped position
- Zero-day plan guard (returns 0)
- Uses most recent entry when multiple entries for same date

#### `getTodayResolvedDay` (5 tests)
- Returns today_pending when no entry
- Returns today_complete after completing
- Returns today_skip after skipping
- Returns today_day_off after day off
- Applies today's overrides to determine planDay shown

#### `getUpcomingDays` (8 tests)
- Empty array for plan with 0 days
- Returns correct count of upcoming days starting tomorrow
- All status values are 'future'
- Advances past today for tomorrow's projection (entry present)
- Advances past today when pending (no entry)
- Applies today's overrides before projecting
- Wraps around rotation boundary
- Incorporates prior completions before today

#### `isPlanExpired` (7 tests)
- Weeks mode: not expired before end date
- Weeks mode: expired on end date
- Weeks mode: expired after end date
- Rotations mode: not expired with fewer completions
- Rotations mode: expired after completing required rotations
- Counts skip toward rotation completion
- Does NOT count day_off toward rotation completion

---

## Tests Added (Second Pass)

### `src/store/__tests__/historyStore.test.ts`

- **28 tests** across six suites:
  - `addEntry` — 5 tests (deduplication, id/timestamp assignment, cross-plan/cross-date isolation)
  - `logAction` — 5 tests (planDayIndex for each action type, notes storage)
  - `updateEntryAction` — 8 tests (action changes, planDayIndex preservation, day_off↔complete restoration)
  - `removeRetroJumpForDate` — 6 tests (match/no-match, type filter, planId filter, multiple removals, no-op)
  - `removeEntry` — 2 tests
  - `clearPlanHistory` — 2 tests

### `src/store/__tests__/outcomeStore.test.ts`

- **17 tests** across five suites:
  - `makeWorkoutInstanceId` — 1 test
  - `setOutcome / getOutcome` — 3 tests (store/retrieve, unknown id, overwrite)
  - `updateOutcomeNotes` — 4 tests (patch, empty → null, no-op for missing, field isolation)
  - `logOutcomeWithProgression` — 5 tests (non-run slot, ineligible run, full progression path, group id, no-error guarantee)
  - `clearPlanOutcomes` — 3 tests (prefix filter, no-op, progressionStates untouched)

### `src/engine/__tests__/calendarProjection.test.ts`

- **31 tests** across three suites:
  - `getResolvedDaysRange` — 21 tests (structure, status assignment for all 9 status values, pointer advancement rules, override ordering, historyEntry attachment, pre-startDate edge case)
  - `buildMonthGrid` — 7 tests (week count, isCurrentMonth accuracy, isToday marker, resolvedDay presence pre/post startDate, no-plan behavior, total cell count divisibility)
  - `resolveWorkoutDisplayTarget` isFromProgression edge case — added to existing engine.test.ts

---

## Tests Run

```
Test Files  5 passed (5)
     Tests  141 passed (141)
  Start at  03:09:33
  Duration  2.05s
```

All 141 tests pass. Zero failures.

---

## Pass/Fail Status

| Suite | Tests | Status |
|-------|-------|--------|
| `evaluateRunProgression` | 13 | ✅ All pass |
| `applyRunProgressionDecision` | 2 | ✅ All pass |
| `derivePaceSecondsPerMile` | 2 | ✅ All pass |
| `formatPace` | 2 | ✅ All pass |
| `resolveWorkoutDisplayTarget` | 6 | ✅ All pass |
| `mod` | 2 | ✅ All pass |
| `computeCurrentDayIndex` | 14 | ✅ All pass |
| `getTodayResolvedDay` | 5 | ✅ All pass |
| `getUpcomingDays` | 8 | ✅ All pass |
| `isPlanExpired` | 7 | ✅ All pass |
| `addEntry` | 5 | ✅ All pass |
| `logAction` | 5 | ✅ All pass |
| `updateEntryAction` | 8 | ✅ All pass |
| `removeRetroJumpForDate` | 6 | ✅ All pass |
| `removeEntry` | 2 | ✅ All pass |
| `clearPlanHistory` | 2 | ✅ All pass |
| `makeWorkoutInstanceId` | 1 | ✅ All pass |
| `setOutcome / getOutcome` | 3 | ✅ All pass |
| `updateOutcomeNotes` | 4 | ✅ All pass |
| `logOutcomeWithProgression` | 5 | ✅ All pass |
| `clearPlanOutcomes` | 3 | ✅ All pass |
| `getResolvedDaysRange` | 21 | ✅ All pass |
| `buildMonthGrid` | 7 | ✅ All pass |

---

## Important Logic Still Untested

### Medium priority

1. **planStore** — `setActivePlan` (deactivates previously active plan), `duplicatePlan`
2. **Double-day rotation behavior** — advance override + complete entry on the same day, verifying tomorrow starts 2 positions ahead

### Lower priority

3. **CalendarPage retroactive logging flow** — integration behavior of `removeRetroJumpForDate` + `addOverride` + `addEntry`
4. **PlanBuilderPage unsaved-changes guard** — UI behavior testing
5. **TodayPage action handlers** — completion flow, skip flow, day-off flow
