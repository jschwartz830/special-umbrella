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

## Tests Run

```
Test Files  2 passed (2)
     Tests  64 passed (64)
  Start at  02:53:47
  Duration  1.80s
```

All 64 tests pass. Zero failures.

---

## Pass/Fail Status

| Suite | Tests | Status |
|-------|-------|--------|
| `evaluateRunProgression` | 13 | ✅ All pass |
| `applyRunProgressionDecision` | 2 | ✅ All pass |
| `derivePaceSecondsPerMile` | 2 | ✅ All pass |
| `formatPace` | 2 | ✅ All pass |
| `resolveWorkoutDisplayTarget` | 5 | ✅ All pass |
| `mod` | 2 | ✅ All pass |
| `computeCurrentDayIndex` | 14 | ✅ All pass |
| `getTodayResolvedDay` | 5 | ✅ All pass |
| `getUpcomingDays` | 8 | ✅ All pass |
| `isPlanExpired` | 7 | ✅ All pass |

---

## Important Logic Still Untested

### High priority (most failure-prone)

1. **historyStore** — `logAction`, `updateEntryAction`, `addOverride`, `removeRetroJumpForDate`
   - The `removeRetroJumpForDate` function does date string parsing to match override dates; the timezone handling here is subtle.
   - `updateEntryAction` (just fixed) — the planDayIndex restoration logic needs test coverage.

2. **outcomeStore** — `logOutcomeWithProgression`, `updateOutcomeNotes`
   - The `logOutcomeWithProgression` function orchestrates evaluation + application of run progression. Should have integration-style tests verifying the state is persisted correctly.

3. **`getResolvedDaysRange`** — the calendar grid workhorse
   - The advance logic at the end of each day (entryAdvances vs projectForward) is subtle and critical for calendar rendering.
   - Edge case: `fromDate` before plan's `startDate` — calendar would show unlogged past days before the plan started.

4. **`buildMonthGrid`** — the calendar grid builder
   - Relies on `getResolvedDaysRange` correctness; should verify the 6×7 grid structure.

5. **`resolveWorkoutDisplayTarget` isFromProgression edge case**
   - When progression distance equals template distance, `isFromProgression = false` even though a progression state exists. This is intentional but worth documenting in tests.

### Medium priority

6. **planStore** — `setActivePlan` (deactivates previously active plan), `duplicatePlan`
7. **Double-day rotation behavior** — advance override + complete entry on the same day, verifying tomorrow starts 2 positions ahead

### Lower priority

8. **CalendarPage retroactive logging flow** — integration behavior of `removeRetroJumpForDate` + `addOverride` + `addEntry`
9. **PlanBuilderPage unsaved-changes guard** — UI behavior testing
10. **TodayPage action handlers** — completion flow, skip flow, day-off flow
