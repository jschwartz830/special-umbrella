# Test Results

## 2026-06-20 (sixty-first pass) — branch `claude/dreamy-mccarthy-8j8xif`

**Result: 895 passing, 0 failing** (+8 tests vs entry baseline of 887)

| Metric | Value |
|--------|-------|
| Test files | 21 (unchanged) |
| Tests on entry | 887 |
| Tests added | 8 |
| Tests on exit | 895 |
| Failures | 0 |

All tests pass. No existing tests were modified.

### Tests added

**`src/lib/__tests__/historyStats.test.ts`** (+8 tests across two describe blocks)

`computeRotationCycleProgress` (+1):
- `does not double-count duplicate entries for the same calendarDate` — 3 raw entries for 2 unique dates → doneInCycle=2, remaining=1, justCompletedRotation=false

`computeRotationPlanRemaining` (+1):
- `does not double-count duplicate entries for the same calendarDate` — 2 raw entries for 1 unique date → remaining=11 (not 10)

`computeWeeklyBreakdown` (+6):
- `avgEffort is null when no outcomes are passed` — backward-compat: missing param → null
- `avgEffort is null when outcomes are passed but none have perceivedEffort` — outcomes without effort data → null
- `computes avgEffort from completed rotation entries with outcomes` — mean across matching outcomes
- `includes extras effort in avgEffort calculation` — extra workout outcomes counted alongside rotation outcomes
- `skip entries do not contribute to avgEffort` — skip entries excluded from effort average
- `rounds avgEffort to one decimal place` — (1+2+2)/3 = 1.666... → 1.7

---

## 2026-06-18 (sixtieth pass) — branch `claude/dreamy-mccarthy-xqu6si`

**Result: 887 passing, 0 failing** (+5 tests vs entry baseline of 882)

| Metric | Value |
|--------|-------|
| Test files | 21 (unchanged) |
| Tests on entry | 882 |
| Tests added | 5 |
| Tests on exit | 887 |
| Failures | 0 |

All tests pass. No existing tests were modified.

### Tests added

**`src/store/__tests__/outcomeStore.test.ts`** (+5 tests, new `moveOutcome` describe block)
- `re-keys the outcome to the new instanceId` — primary happy path: old key gone, new key present
- `updates workoutInstanceId inside the moved record` — field on the record itself is updated
- `is a no-op when the old instanceId does not exist` — stable state when key is missing
- `preserves all other fields on the moved outcome` — perceivedEffort, durationActualMin, completionState survive
- `delegates exercise history move to exerciseHistoryStore` — verifies exerciseHistory record re-keyed by workoutInstanceId

---

## 2026-06-17 (fifty-ninth pass) — branch `claude/dreamy-mccarthy-b5jqs3`

**Result: 882 passing, 0 failing** (+13 tests vs entry baseline of 869)

| Metric | Value |
|--------|-------|
| Test files | 21 (unchanged) |
| Tests on entry | 869 |
| Tests added | 13 |
| Tests on exit | 882 |
| Failures | 0 |

All tests pass. No existing tests were modified.

### Tests added

**`src/lib/__tests__/historyStats.test.ts`** (+12 tests)
- `deduplicates same-date entries (consistent with isPlanExpired)` — regression test verifying that 4 raw entries with 3 unique dates produce 1 rotation (not 2)
- `returns null for empty plan (no entries)` — findBestWeek
- `returns null when entries belong to a different plan` — findBestWeek isolation
- `returns the only week for a single-week plan` — findBestWeek base case
- `returns the week with the most completions` — findBestWeek selection
- `factors extras into the score` — findBestWeek with extra workouts
- `returns the earlier week on tie` — findBestWeek tie-breaking
- `skips do not count toward best-week score` — findBestWeek skip exclusion
- `day_off entries are not counted` — findBestWeek day-off exclusion
- `works with only extras (no plan entries)` — findBestWeek extras-only edge case
- `handles entries that span a month boundary` — findBestWeek cross-month
- `handles entries that span a year boundary` — findBestWeek cross-year

**`src/lib/__tests__/expressionEval.test.ts`** (+1 test)
- `parses "10m" as meters not minutes` — verifies `resolveQuantityString('10m')` returns `{ value: 10, unit: 'm' }`

---

## 2026-06-16 (fifty-eighth pass) — branch `claude/dreamy-mccarthy-b56q6q`

**Result: 869 passing, 0 failing** (+4 tests vs entry baseline of 865)

| Metric | Value |
|--------|-------|
| Test files | 21 (unchanged) |
| Tests on entry | 865 |
| Tests added | 4 (net; 25 new tests written, 21 already present in baseline) |
| Tests on exit | 869 |
| Failures | 0 |

All tests pass. No existing tests were modified.

### Tests added

**`src/engine/__tests__/rotationEngine.test.ts`** (+1 test)
- `does not count duplicate entries for the same date as two completions` — verifies
  that two history entries on `2026-01-01` for a 2-day plan do not trigger early expiry
  after the `isPlanExpired` deduplication fix.

**`src/lib/__tests__/historyStats.test.ts`** (+21 tests across two new describe blocks)

`describe('getStreakDatesSet')` — 12 tests:
- `returns empty set when there are no entries or extras`
- `includes complete entries`
- `includes day_off entries`
- `does not include skip-only entries`
- `includes extra workout dates`
- `deduplicates dates across entries and extras`
- `without planId, includes all plans`
- `with planId, filters to that plan's entries`
- `with planId, filters extras to that plan`
- `with planId null, includes all plans (like no planId)`
- `handles mixed entries across multiple plans`
- `skip entry on the same date as an extra still adds the date (via extra)`

`describe('computeCurrentStreakDates')` — 9 tests:
- `returns empty set when no streak`
- `returns today when only today is streakable`
- `returns consecutive days ending today`
- `stops at a gap — does not count older isolated dates`
- `without planId, includes all plans in the streak`
- `with planId, only counts that plan's streak`
- `returns empty set when today is a gap day`
- `handles single-day streaks correctly`
- `includes extras from other plans when no planId given`

### Important areas still untested

- **Component rendering** — No tests for TodayPage, CalendarPage, or any React component.
  `computeCurrentStreakDates` is available but not yet wired to any UI path.
- **`computeCurrentStreakDates` with today in the future** — Not tested (unusual but
  possible if a user manipulates their system clock).
- **Second slot of dual-slot plan days** — `computeWorkoutTypeBreakdown` only counts
  `slots[0].type`; the second slot's type contribution is untested by design.

---

## 2026-06-15 (fifty-seventh pass) — branch `claude/dreamy-mccarthy-vqeg2i`

**Result: 848 passing, 0 failing** (+3 tests vs entry baseline of 845)

| Metric | Value |
|--------|-------|
| Test files | 21 (+1 new file) |
| Tests on entry | 845 |
| Tests on exit | 848 |
| Delta | +3 |
| Failures | 0 |

### Tests reviewed

All 20 existing test files confirmed clean on entry (845 passing). No pre-existing failures.

### Tests added

**`src/store/__tests__/outcomeStoreProgressionErrorRecovery.test.ts`** — new file, 3 tests:

- `'saves the outcome even when run-progression evaluation throws'` — mocks `evaluateRunProgression` to throw, calls `logOutcomeWithProgression`, asserts the function does not propagate the error and the outcome is persisted.
- `'does not create a progression state when the engine throws'` — same mock setup; asserts `progressionStates` remains empty (engine threw before `applyRunProgressionDecision` could produce a state).
- `'saves the outcome with a progression recommendation even when run-progression throws'` — confirms step-1 (`buildProgressionRecommendation` → `setOutcome`) completes before the try/catch block is entered; outcome has correct `completionState`.

These tests use `vi.mock('../../modules/run-adaptation/engine', ...)` to inject a throwing implementation. Module-level mocking is isolated to this file.

### Areas still untested

- `useActivePlan` midnight refresh — requires fake timers + hook test environment; not attempted.
- `ProgramVarsPanel` NaN rendering — trivial ternary; validated by code inspection.
- CalendarPage modal flows — require React Testing Library; component tests not in scope.
- TodayPage `handleOutcomeConfirm` with a progression error — the new tests exercise the store in isolation; the full page integration path remains untested (would require mocking the store and rendering the page).

---

## 2026-06-13 (fifty-sixth pass) — branch `claude/dreamy-mccarthy-qvt8m6`

**Result: 845 passing, 0 failing** (+1 test vs entry baseline of 844)

| Metric | Value |
|--------|-------|
| Test files | 20 (unchanged) |
| Tests on entry | 844 |
| Tests on exit | 845 |
| Delta | +1 |
| Failures | 0 |

### Tests reviewed

All 20 test files were confirmed clean on entry. No pre-existing failures. The test suite runs in ~2s with vitest.

### Tests added

**`src/engine/__tests__/rotationEngine.test.ts`** — 1 new case in `describe('isPlanExpired') / describe('weeks-based duration')`:

- `'is not expired when today is before plan startDate (future-start plan)'` — pins the invariant that `isPlanExpired` returns false when a plan has not yet begun (today < plan.startDate). The weeks-plan expiry check computes `endDate = startDate + value*7` and evaluates `today >= endDate`; today being before startDate guarantees today is also before endDate, so the function returns false. Explicit test prevents accidental comparison flip.

### Areas still untested

- `useActivePlan` midnight refresh behaviour — requires fake timers in a hook test environment; not attempted this pass.
- `ProgramVarsPanel` NaN/Infinity rendering — component test would require a React testing setup; the logic is a simple ternary, so the guard is validated by code inspection.
- `buildMonthGrid` (calendarProjection) — 437-line test file already covers this well.
- `getFutureProjection` (calendarProjection) — marked unused in JSDoc; tested indirectly via `getUpcomingDays` coverage.

---

## 2026-06-12 (fifty-fifth pass) — branch `claude/dreamy-mccarthy-wh71fb`

**Result: 836 passing, 0 failing** (+4 tests vs entry baseline of 832)

| Metric | Value |
|--------|-------|
| Test files | 20 (unchanged) |
| Tests on entry | 832 |
| Tests on exit | 836 |
| Delta | +4 |
| Failures | 0 |

### Tests reviewed

All 20 test files were confirmed clean on entry. No pre-existing failures.

### Tests added

**`src/lib/__tests__/expressionEval.test.ts`** — 4 new cases in `describe('NaN / Infinity guard — corrupted program vars must not propagate', ...)`:

| Test | What it asserts |
|------|----------------|
| keeps previous bench value when squat var is NaN | `bench = squat * 0.85` where `squat = NaN` → guard keeps `bench = 135` |
| keeps previous bench value when squat var is Infinity | Same with `squat = Infinity` → guard keeps `bench = 135` |
| chained updates: NaN-tainted first assignment does not corrupt second clean statement | `bench = squat * 0.85, ohp += 5` with NaN squat → bench stays 100, ohp increments 75→80 |
| squat += 5 on a NaN var stays NaN | NaN + 5 = NaN; guard falls back to cur = NaN; cannot self-repair but does not spread |

**`src/store/__tests__/historyStore.test.ts`** — 1 test updated in `describe('updateEntryDate', ...)`:

- The "coexistence: does NOT deduplicate" contract test was replaced with "deduplicates: moving to a date that already has an entry removes the old one", verifying that the moved entry wins and only 1 entry exists at the target date after the move.

### Command run

```
npx vitest run
```

All 836 tests passed. No skipped tests.

### Important areas still untested

| Area | Risk | Notes |
|------|------|-------|
| `TodayPage.tsx` | Medium | Double-day flow, undo, active tracker — integration-test candidates |
| `CalendarPage.tsx` | Medium | DayDetailModal behavior, slot fallback path |
| `HistoryPage.tsx` filter sessionStorage | Low | UI-layer; cannot be tested without jsdom + React Testing Library |
| `useToday` hook | Low | Timeout-dependent; would need `vi.useFakeTimers()` + jsdom environment |

---

## 2026-06-11 (fifty-fourth pass) — branch `claude/dreamy-mccarthy-q8dj7t`

**Result: 832 passing, 0 failing** (+11 tests vs entry baseline of 821)

| Metric | Value |
|--------|-------|
| Test files | 20 (unchanged) |
| Tests on entry | 821 |
| Tests on exit | 832 |
| Delta | +11 |
| Failures | 0 |

### Tests reviewed

All 20 test files were confirmed clean on entry. No pre-existing failures.

### Tests added

**`src/lib/__tests__/historyStats.test.ts`** — 11 new cases in `describe('computeLoggedRate', ...)`:

| Test | What it asserts |
|------|----------------|
| returns null when plan started today | `activeDays = 0` → `null` |
| returns null when plan starts in the future | `activeDays < 0` → `null` |
| returns 0 when no entries logged | 0 logged dates out of 7 → `0` |
| returns 100 when all days logged | 7/7 logged → `100` |
| returns correct partial percentage | 3/7 logged → `43` |
| counts skip entries | skip action → logged date counted |
| counts day_off entries | day_off action → logged date counted |
| excludes today from denominator | today not in `[planStart, today)` range |
| counts duplicate entries as single day | two entries same date → 1 unique day |
| ignores entries from other plans | foreign planId filtered out |
| ignores entries before plan start date | pre-start entries not counted |

### Command run

```
npm test
```

All 832 tests passed. No skipped tests.

---

## 2026-06-08 (fifty-third pass) — branch `claude/dreamy-mccarthy-B7dXE`

**Result: 821 passing, 0 failing** (+7 tests vs entry baseline of 814)

| Metric | Value |
|--------|-------|
| Test files | 20 (unchanged) |
| Tests on entry | 814 |
| Tests on exit | 821 |
| Delta | +7 |
| Failures | 0 |

### Tests reviewed

All 20 test files reviewed as part of the audit. No failing tests identified on entry.

### Tests added

| File | New tests | What they cover |
|------|-----------|-----------------|
| `src/lib/__tests__/workoutInstanceId.test.ts` | 4 | `makeWorkoutInstanceId` (format, round-trip), `makeExtraWorkoutInstanceId` (format, round-trip) |
| `src/engine/__tests__/rotationEngine.test.ts` | 3 | `computeCurrentDayIndex` plan isolation; `getResolvedDaysRange` plan isolation; `getResolvedDaysRange` swap_slot no-op on pointer |

### Results (all 821 tests pass)

```
Test Files  20 passed (20)
Tests  821 passed (821)
```

### Important areas still untested

- **TodayPage / CalendarPage integration** — no component tests; relies on manual browser testing
- **Double-day flow end-to-end** — complex state machine across TodayPage + historyStore + outcomeStore; tested via individual store/engine unit tests only
- **Outcome date-change conflict detection** — `updateEntryDate` overwrites silently; no test for the collision case (noted as carry-forward from pass 47)
- **CSV import rejection feedback** — `historyFromCsv` drops invalid entries silently; no test verifying the user-facing message when entries are rejected
- **ActiveWorkoutTracker** — timer-based, session-local state; not unit-tested

---

## 2026-06-07 (fifty-second pass) — branch `claude/dreamy-mccarthy-j725m`

**Result: 814 passing, 0 failing** (+13 tests vs entry baseline of 801)

| Metric | Value |
|--------|-------|
| Test files | 20 |
| Tests on entry | 801 |
| Tests on exit | 814 |
| Tests added | +13 |
| Tests failed | 0 |

### Tests added

**`src/lib/__tests__/historyStats.test.ts`** (+4 in `computePersonalRecords` and `computePlanStreak` describe blocks)

| Test | What it covers |
|------|---------------|
| `shows most-recent date when same max load is matched on a later session` | `>=` fix: later session with same max load gets the date |
| `shows most-recent date when same max reps matched on a later session` | `>=` fix: later session with same max reps gets the date |
| `result is stable regardless of input record order` | Sort fix: shuffled input records produce the same maxLoadDate/maxRepsDate |
| `future-dated extras do not extend the streak backward past today` | `computePlanStreak` never walks past today even with future-dated extras |

**`src/lib/__tests__/previousSetsHelper.test.ts`** (new file, +6 tests)

| Test | What it covers |
|------|---------------|
| `returns empty map when no outcomes exist` | Empty input guard |
| `returns empty map when all outcomes are on the current date` | Current-date exclusion |
| `returns sets from a previous date` | Basic previous-session lookup |
| `picks the most-recent prior session when multiple exist for the same exercise` | First-wins after descending sort |
| `excludes a specific instanceId when excludeInstanceId is provided` | Optional `excludeInstanceId` falls back to next-most-recent |
| `does not include outcomes from a different plan` | Plan prefix filter |

**`src/lib/__tests__/csv.test.ts`** (+3 in new `personalRecordsToCsv` describe block)

| Test | What it covers |
|------|---------------|
| `returns header-only CSV for empty records array` | Empty input produces valid RFC-4180 |
| `serialises a standard PR record correctly` | Header + one data row with all fields populated |
| `handles null maxLoad and maxReps gracefully` | Null values become empty cells in CSV output |

### Test files added this pass

- `src/lib/__tests__/previousSetsHelper.test.ts` — new file covering the extracted `findPreviousSetsByExercise` helper

### Tests reviewed but not modified

All 19 previously-existing test files passed on entry. Key files reviewed:
- `historyStats.test.ts` — comprehensive; 4 new tests added for PR date and streak edge cases
- `csv.test.ts` — extended with 3 tests for the new `personalRecordsToCsv` function
- `rotationEngine.test.ts` — fully passing; no engine changes in this pass
- `outcomeStore.test.ts` — fully passing; no store changes in this pass

### Important areas still untested

| Area | Risk | Notes |
|------|------|-------|
| `TodayPage.tsx` | Medium | Double-day flow, undo, active tracker — integration-test candidates |
| `CalendarPage.tsx` | Medium | DayDetailModal behavior, slot fallback path |
| `HistoryPage.tsx` export button | Low | UI-layer; component behavior verified by code review |
| `useToday` hook | Low | Timeout-dependent; would need `vi.useFakeTimers()` + jsdom environment |
| `OutcomeModal` component | Low | Complex but UI-layer; E2E tests would be more valuable |

---

## 2026-06-06 (fifty-first pass) — branch `claude/dreamy-mccarthy-HOACg`

**Result: 801 passing, 0 failing** (+3 tests vs entry baseline of 798)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 798 |
| Tests on exit | 801 |
| Tests added | +3 |
| Tests failed | 0 |

### Tests added

**`src/lib/__tests__/historyStats.test.ts`** (+3 in `computeWorkoutTypeBreakdown` describe)

| Test | What it covers |
|------|---------------|
| `works with the production "weights" slot type (not just "weightlifting")` | Verifies type attribution with the real 'weights' value used in HistoryPage (existing tests only used 'weightlifting') |
| `avgEffort is null for skipped-only entries (no outcome data)` | Skipped entries count toward breakdown but produce no effort data |
| `averages effort across mixed completed rotation entries and extras` | Rotation (effort 4) + extra (effort 2) → combined avg 3 |

### Tests reviewed but not modified

All 19 test files passed on entry. No existing tests were changed. Key files reviewed:
- `historyStats.test.ts` — comprehensive; added 3 tests covering production 'weights' type and effort averaging
- `rotationEngine.test.ts` — fully passing; no engine changes in this pass
- `historyStore.test.ts` — fully passing; no store changes in this pass

### Important areas still untested

| Area | Risk | Notes |
|------|------|-------|
| `TodayPage.tsx` | Medium | Double-day flow, undo, active tracker — integration-test candidates |
| `CalendarPage.tsx` | Medium | DayDetailModal useEffect fix (requires React Testing Library) |
| `HistoryPage.tsx` typeBreakdown integration | Low | Component-level; uses `computeWorkoutTypeBreakdown` which is unit-tested |
| `useToday` hook | Low | Timeout-dependent; would need `vi.useFakeTimers()` + jsdom environment |
| `OutcomeModal` component | Low | Complex but UI-layer; E2E tests would be more valuable |

---

## 2026-06-05 (fiftieth pass) — branch `claude/dreamy-mccarthy-UIayl`

**Result: 798 passing, 0 failing** (+5 tests vs entry baseline of 793)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 793 |
| Tests on exit | 798 |
| Tests added | +5 |
| Tests failed | 0 |

### Tests added

**`src/engine/__tests__/rotationEngine.test.ts`** (+2)

| Test | What it covers |
|------|---------------|
| `getTodayResolvedDay > returns a safe rest-day ResolvedDay for a plan with 0 days (no crash)` | Guard returns `{ planDay: { slots: [] }, status: 'today_pending' }` instead of crashing |
| `getTodayResolvedDay > reflects existing entry status for 0-day plan` | Guard correctly maps entry.action → status for 0-day plans |

**`src/store/__tests__/programStore.test.ts`** (+3)

| Test | What it covers |
|------|---------------|
| `applyProgressionRule > error resilience > returns {} and does not throw when rule.if is not evaluable` | Malformed condition string is handled gracefully |
| `applyProgressionRule > error resilience > returns {} and does not throw when rule.then is an empty string` | Empty then-string is a no-op (hits early-return path, not error path) |
| `applyProgressionRule > error resilience > leaves vars unchanged after a catch — no partial mutation` | `null` then-string triggers outer try/catch; vars remain unchanged |

### Tests reviewed but not modified

All 19 test files passed on entry. No existing tests were changed. Key files reviewed:
- `rotationEngine.test.ts` — comprehensive coverage; only missing empty-plan case for `getTodayResolvedDay` (added)
- `programStore.test.ts` — complete coverage of happy paths; missing error cases (added)
- `historyStore.test.ts` — 873 lines, thorough coverage including migration, dedup, extra entries
- `historyStats.test.ts` — 1766 lines, covers all exported functions including `computeConsecutiveSkips`, `getUnloggedPastDates`, `computePlanStreak`

### Important areas still untested

| Area | Risk | Notes |
|------|------|-------|
| `TodayPage.tsx` | Medium | 1200-line page; double-day flow, undo, upcoming log — integration-test candidates |
| `CalendarPage.tsx` | Medium | Retroactive logging, jump overrides, day-off logic |
| `ProgramVarsPanel` | Low | Purely presentational; no logic to unit-test |
| `OutcomeModal` component | Low | Complex but UI-layer; Playwright/E2E tests would be more valuable |
| `CalendarPage.handleOutcomeConfirm` slot fallback | Medium | Slot fallback path passes dummy slot; progression untested for this path |
| `outcomeStore.logOutcomeWithProgression` section 3 | Medium | YAML progression branch covered by programStore tests; outcomeStore integration not tested |

---

## 2026-06-04 (forty-ninth pass) — branch `claude/dreamy-mccarthy-WovqU`

**Result: 793 passing, 0 failing** (+5 tests vs entry baseline of 788)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 788 |
| Tests on exit | 793 |
| New tests | 5 |
| Failing tests | 0 |

### Tests added

**`src/lib/__tests__/historyStats.test.ts`** — 5 new tests:

| Test | Description |
|------|-------------|
| `computePlanProgress > rotations > excludes future-dated entries` | Verifies `calendarDate <= today` guard on the rotations branch |
| `computeRotationCycleProgress > excludes future-dated entries when today is provided` | Verifies the new `today` param filter |
| `computeRotationCycleProgress > includes all entries when today is omitted (backward-compatible)` | Confirms the optional param preserves existing behavior |
| `computeRotationPlanRemaining > excludes future-dated entries when today is provided` | Verifies the new `today` param filter |
| `computeRotationPlanRemaining > includes all entries when today is omitted (backward-compatible)` | Confirms the optional param preserves existing behavior |

### Areas still untested

- `DayDetailModal` render-phase state call (integration test would require React Testing Library setup)
- `logForDate` day_off + jump interaction (carry-forward from pass 44)
- `computeWorkoutTypeBreakdown` multi-slot attribution behavior (documented gap, carry-forward from pass 47)
- TodayPage `rotationProgress` UI rendering (UI-level; no component tests exist today)

---

## 2026-06-02 (forty-eighth pass) — branch `claude/dreamy-mccarthy-lm1Op`

**Result: 788 passing, 0 failing** (+2 tests vs entry baseline of 786)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 786 |
| Tests added | 2 |
| Tests on exit | 788 |
| Failing | 0 |

### Tests added this pass

| File | Tests added | Description |
|------|-------------|-------------|
| `src/engine/__tests__/rotationEngine.test.ts` | 2 | `isPlanExpired` future-entry guard: (a) future-dated entry not counted, (b) normal expiry still fires |

### All other test files

All 18 other test files unchanged; all passing.

---

## 2026-06-01 (forty-seventh pass) — branch `claude/dreamy-mccarthy-iQpbb`

**Result: 786 passing, 0 failing** (+16 tests vs entry baseline of 770)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 770 |
| Tests added | 16 |
| Tests on exit | 786 |
| Failing | 0 |

### Tests reviewed

All 19 test files reviewed. Highlights:

- `historyStats.test.ts` — 1,544 LOC on entry; 16 new tests appended. All `computeConsecutiveSkips` edge cases covered: empty history, gaps, streak of 1 / N, complete breaks streak, day_off breaks streak, extra breaks streak, extra on skipped day, different-plan isolation, today excluded, extras from different plan don't break streak. Plus 1 new `computeWorkoutTypeBreakdown` multi-slot gap documentation test.
- `historyStore.test.ts` — 1 new test added in `updateEntryDate` describe block documenting the no-deduplication caller contract.
- All 17 other test files: unchanged, all passing.

### Tests added / updated this pass

| File | Tests added | Description |
|------|-------------|-------------|
| `src/lib/__tests__/historyStats.test.ts` | 15 | `computeConsecutiveSkips` full coverage suite |
| `src/lib/__tests__/historyStats.test.ts` | 1 | `computeWorkoutTypeBreakdown` multi-slot gap (documentation test) |
| `src/store/__tests__/historyStore.test.ts` | 1 | `updateEntryDate` coexistence / caller contract |

### Areas still untested

- `CalendarPage.tsx` component rendering — no React Testing Library setup exists
- `TodayPage.tsx` component rendering — same
- `OutcomeModal.tsx` — no render tests
- `computeConsecutiveSkips` is not yet consumed by any component, so end-to-end nudge behavior is untested (intentional — UI wiring is a future step)

---

## 2026-05-31 (forty-sixth pass) — branch `claude/dreamy-mccarthy-N2mc1`

**Result: 770 passing, 0 failing** (±0 tests; all changes are UI/logic only)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 770 |
| Tests added | 0 |
| Tests on exit | 770 |
| Failing | 0 |

### Tests reviewed

All 19 test files reviewed. Highlights:

- `rotationEngine.test.ts` — 670 LOC, comprehensive pointer, override, expiry, and range tests
- `historyStats.test.ts` — covers `computeHistoryStats`, `computePlanProgress`, `computeWorkoutTypeBreakdown`, `countPastUnloggedDays`, `computeRotationCycleProgress`, `countPlanDayCompletions`, `computePersonalRecords`, `computePlanStreak`, `computeRotationPlanRemaining`, `computeWeeklyBreakdown`, `padWeekGaps`, `isoWeekStart` — all functions tested
- `calendarProjection.test.ts`, `expressionEval.test.ts`, `csv.test.ts`, `sessionSummary.test.ts`, `workoutInstanceId.test.ts` — all pass
- All store tests (`historyStore`, `outcomeStore`, `planStore`, `programStore`, `exerciseHistoryStore`, `planDeleteCleanup`) — pass
- Module tests (`engine.test.ts`, `progression.test.ts`, `types.test.ts`, `explanation.test.ts`) — pass

### Tests added / updated this pass

None. All changes this pass were UI-layer fixes (CalendarPage sort, `useToday` hook wiring, Day Off logic, outcome preview feature). These areas have no corresponding unit tests because they involve React component rendering and store interactions not currently tested with Vitest.

### Areas still untested

- `CalendarPage.tsx` component rendering — no React Testing Library setup exists; component tests are implicitly validated by the E2E-style manual review
- `TodayPage.tsx` component rendering — same
- `OutcomeModal.tsx` — no render tests
- `DayDetailModal` effort/notes preview — new feature, not tested

The absence of component tests is a known gap carried from previous passes. Adding React Testing Library integration would require a setup change to Vitest (jsdom environment) and falls outside a single overnight pass scope.

---

## 2026-05-30 (forty-fifth pass) — branch `claude/dreamy-mccarthy-mxssu`

**Result: 770 passing, 0 failing** (+3 new tests)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 767 |
| Tests on exit | 770 |
| New tests added | +3 |
| Failures | 0 |

### Tests added

| File | Tests added | Description |
|------|-------------|-------------|
| `src/lib/__tests__/historyStats.test.ts` | 3 | `computeHistoryStats` — future-dated entries excluded from `totalLogged`, `totalCompleted`, and both simultaneously |

### Tests reviewed

- `src/lib/__tests__/historyStats.test.ts` — All pass. Three new tests cover future-dated rotation entries, future-dated extras, and the `totalCompleted` path specifically.
- `src/engine/__tests__/rotationEngine.test.ts` — All 240+ tests pass (no engine changes in this pass; `computeCurrentDayIndex` targetDate < startDate test already exists from a prior pass).
- `src/pages/TodayPage.tsx` changes — No direct unit tests added for `outcomeSortKey` (the function is module-private) or `useToday` (time-dependent). Both verified by code review; behavior is straightforward.

### Important areas still untested

- **`outcomeSortKey` helper** — Module-private; cannot be unit-tested without extraction. Indirect testing path: create two outcomes without `completedAt`, log them via `logOutcomeWithProgression`, confirm the "Last session" hint shows the more recent one.
- **`useToday` hook** — Requires `vi.useFakeTimers()` to advance system time in a test. The timer/cleanup logic is minimal and could be verified with a short test suite in a future pass.
- **TodayPage render behavior** — No React Testing Library tests exist for TodayPage; this is a known gap across all passes.

---

## 2026-05-30 (forty-fourth pass) — branch `claude/dreamy-mccarthy-uCF1X`

**Result: 767 passing, 0 failing** (+1 new test)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 766 |
| Tests on exit | 767 |
| New tests added | +1 |
| Failures | 0 |

### Tests added

| File | Tests added | Description |
|------|-------------|-------------|
| `src/store/__tests__/exerciseHistoryStore.test.ts` | 1 | `moveByWorkoutInstance` — verify `calendarDate` updates to the date in the new instanceId |

### Tests reviewed

- `src/store/__tests__/exerciseHistoryStore.test.ts` — All `moveByWorkoutInstance` tests pass. The new test covers the previously untested `calendarDate` propagation.
- `src/lib/__tests__/sessionSummary.test.ts` — All pass. No changes to `sessionSummary.ts`; existing tests sufficient.
- `src/engine/__tests__/rotationEngine.test.ts` — All 240+ tests pass. No rotation engine changes in this pass.

### Important areas still untested

- **TodayPage render behavior** — No tests cover the `planExtras` memoization or the "Xd ago" display. These are UI-layer changes that would require React Testing Library or equivalent. The logic itself (date diff computation) is simple enough that manual verification is sufficient.
- **`CalendarPage.logForDate` day_off + jump interaction** — The documented edge case (rotation drift when changing a past day from complete to day_off when a jump override exists) is untested. Adding a test here would require a careful rotationEngine integration fixture.

---

## 2026-05-29 (forty-third pass) — branch `claude/dreamy-mccarthy-4tAQK`

**Result: 766 passing, 0 failing** (+8 new tests)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 758 (of which 6 were failing) |
| Tests on exit | 766 |
| New tests added | +8 |
| Tests fixed | 6 |
| Failures | 0 |

### Tests added

| File | Tests added | Description |
|------|-------------|-------------|
| `src/modules/workout-outcomes/__tests__/progression.test.ts` | 2 | New null-guard test (no progressionMode → null); volume mode hold case (sets below target) |
| `src/store/__tests__/historyStore.test.ts` | 6 | `migrateHistoryState` direct tests: undefined→history, preserved double_day, preserved history, skip at v1+, empty array, missing field |

### Tests fixed (were failing on entry)

| File | Tests fixed | Root cause |
|------|-------------|-----------|
| `src/modules/workout-outcomes/__tests__/progression.test.ts` | 6 | PR #121 added a progressionMode guard + changed volume mode logic; tests were written against old behavior |

### Areas still untested

- `ActiveWorkoutTracker` component — React component tests not present. Timer guard,
  set numbering, progression preview (fixed in pass 42) remain untested at unit level.
- `computePlanStreak` with future-dated extras — current streak starts from today and
  walks backward, so future extras don't inflate it. But analogous coverage to the
  `longestStreak` fix is theoretically possible.

---

## 2026-05-28 (forty-second pass) — branch `claude/dreamy-mccarthy-HtWcw`

**Result: 758 passing, 0 failing** (+10 new tests)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 748 |
| Tests on exit | 758 |
| New tests | +10 |
| Failures | 0 |

### Tests added

| File | Tests added | Description |
|------|-------------|-------------|
| `src/lib/__tests__/historyStats.test.ts` | 7 | 6 direct `isoWeekStart` cases (Mon/Wed/Sat/Sun/month-boundary/year-boundary) + 1 `longestStreak` future-date regression |
| `src/store/__tests__/planStore.test.ts` | 3 | `duplicatePlan` suffix stripping, numeric counter, and `(copy N)` stripping |

### Areas still untested

- `ActiveWorkoutTracker` component (React component tests are not present for any component).
  The three fixes in this pass (deleteSet timer guard, set numbering, progression preview) are
  logic-in-render changes that cannot be covered by the current pure-function test suite
  without adding `@testing-library/react`. Documenting for a future pass.
- `computePlanStreak` with future-dated extras (analogous to the `longestStreak` fix — not
  currently filtered).

---

## 2026-05-27 (forty-first pass) — branch `claude/dreamy-mccarthy-9NxZ6`

**Result: 748 passing, 0 failing** (+0 new tests; no new logic paths — all changes are guards or additive components)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 748 |
| Tests on exit | 748 |
| New tests | 0 |
| Failures | 0 |

### New tests added

None. Both changes in this pass are additive or protective:

- **ErrorBoundary**: Class component with no pure-function logic to unit-test.
  Behavior (renders recovery UI on error) is verifiable in a browser.
- **Empty date guard**: The guard is a one-liner early return; the meaningful behavior
  change is a UI guard — not a pure function with extractable test surface. The
  existing 748 tests continue to pass and confirm no regressions.

---

## 2026-05-26 (fortieth pass) — branch `claude/dreamy-mccarthy-8Sa0s`

**Result: 748 passing, 0 failing** (+5 new tests; 0 previously-failing tests)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 743 |
| Tests on exit | 748 |
| New tests | +5 |
| Failures | 0 |

### New tests added

**`src/store/__tests__/planStore.test.ts`** (+1 test in `setActivePlan` describe):

| Test | Covers |
|------|--------|
| is a no-op when the plan id does not exist | Guard prevents state corruption on invalid ID |

**`src/modules/workout-outcomes/__tests__/progression.test.ts`** (+1 test in swim describe):

| Test | Covers |
|------|--------|
| returns progress when effort is null (defaults to 3) | Null effort `?? 3` default for swim |

**`src/lib/__tests__/csv.test.ts`** (+3 tests in swim actuals section):

| Test | Covers |
|------|--------|
| round-trips swim actuals on a rotation entry | Full swim field export + import |
| round-trips swim actuals on an extra entry | Swim on extra workout entries |
| does not set swimActual when all swim columns are empty | Backward compat — unset when absent |

### Important areas still untested

- `computeCurrentDayIndex` with `targetDate` before `plan.startDate` (negative dayCount path)
- `HistoryPage` component-level integration (no component tests in the suite)

---

## 2026-05-25 (thirty-ninth pass) — branch `claude/dreamy-mccarthy-0z9MJ`

**Result: 743 passing, 0 failing** (+5 new tests; 0 previously-failing tests)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 738 |
| Tests on exit | 743 |
| New tests | +5 |
| Failures | 0 |

### New tests added

**`src/lib/__tests__/sessionSummary.test.ts`** (+5 tests in `buildLastSessionSummary` describe block):

| Test | Covers |
|------|--------|
| shows "N sets" (not "×undefined") when both actualReps and targetReps absent | Bug fix: null reps fallback |
| falls back to targetReps when actualReps is null | Reps resolution chain |
| appends "+N more" when multiple exercises have actual data | Multi-exercise feature |
| does not append "+N more" for a single-exercise workout | Single-exercise unchanged |
| counts only exercises with actual data when computing moreCount | Exclusion of empty exercises |

### Important areas still untested

- `computeCurrentDayIndex` with `targetDate` before `plan.startDate` (negative dayCount path)
- `HistoryPage` component-level integration (no component tests in the suite)
- `PlanBuilderPage` component-level integration
- `computeWorkoutTypeBreakdown` is tested but its HistoryPage integration path uses a separate
  manual `typeCountMap` — the two implementations are not cross-checked in tests

---

## 2026-05-24 (thirty-eighth pass) — branch `claude/dreamy-mccarthy-oaS1e`

**Result: 738 passing, 0 failing** (+4 new tests; 0 previously-failing tests)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 734 |
| Tests added | 4 |
| Tests on exit | 738 |
| Failures | 0 |

All tests pass. No existing tests were modified.

### Tests added

**`src/store/__tests__/outcomeStore.test.ts` (+3 tests)**
- `does NOT fire YAML progression rules for deferred outcomes (session_complete=false)` —
  sets `myvar: 0`, creates a `deferred` outcome with `slotProgress: { if: 'session_complete', then: 'myvar += 1' }`,
  calls `logOutcomeWithProgression`, asserts `myvar` remains 0.
- `fires YAML progression rules for completed outcomes (session_complete=true)` —
  same setup with `completionState: 'completed'`, asserts `myvar` becomes 1.
- `does NOT fire YAML progression rules for skipped outcomes (session_complete=false)` —
  same setup with `completionState: 'skipped'`, asserts `myvar` remains 0.

**`src/store/__tests__/planStore.test.ts` (+1 test)**
- `deep-clones DrillSpec[] within RunSegment.drills so drill edits do not cross plans` —
  creates a plan with a run slot containing a segment with `drills: [{ name: 'High Knees', … }, { name: 'A-Skips', … }]`,
  duplicates it, asserts the drill array and each drill object have independent references
  while values are equal.

### Important areas still untested

- **Component rendering** — No tests for TodayPage. The `progressionRecommendation.note`
  hint is verified manually only.
- **`progressionRecommendation` generation** — `buildProgressionRecommendation` in
  `modules/workout-outcomes/progression.ts` has its own coverage; the TodayPage display
  path is not unit-tested.
- **YAML editor → zero-duration save path** — Validated manually; a unit test for
  `PlanBuilderPage.handleSave` with `durationValue = 0` would anchor this permanently.

---

## 2026-05-23 (thirty-seventh pass) — branch `claude/dreamy-mccarthy-79X8Y`

**Result: 734 passing, 0 failing** (+2 new tests; 0 previously-failing tests)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 732 |
| Tests added | 2 |
| Tests on exit | 734 |
| Failures | 0 |

All tests pass. No existing tests were modified.

### Tests added

**`src/store/__tests__/planStore.test.ts`**
- `deep-clones SetSpec[] within exercises so per-set edits do not cross plans` — verifies
  that `duplicatePlan` produces independent `SetSpec` object references for structured
  exercise sets after the `deepCloneExerciseSpec` fix.
- `deep-clones SetSpec[] within warmup exercises` — same for the `warmup` field.

### Important areas still untested

- **Component rendering** — No tests for TodayPage, PlanBuilderPage, or any component.
  The activity strip dedup fix, `computePlanStreak` wiring, and duration validation
  are verified visually only.
- **`RunSegment.drills` nesting** — DrillSpec arrays inside RunSegments are shallow-cloned.
  Lower risk than the SetSpec fix (drills are rarely edited post-import), but untested.
- **YAML editor → zero-duration save path** — The guard at `handleSave` is correct but
  tested only manually. A unit test for the Plan Builder's `handleSave` with `durationValue = 0`
  would anchor the validation permanently.

---

## 2026-05-22 (thirty-sixth pass) — branch `claude/dreamy-mccarthy-9sH8T`

**Result: 732 passing, 0 failing** (+6 new tests; 0 previously-failing tests)

### Tests added

**`src/store/__tests__/outcomeStore.test.ts` (+6 tests)**
- `importOutcomes syncs plan name when plan exists in store`
- `importOutcomes syncs workout name from history entry when available`
- `importOutcomes sets planName null when plan does not exist`
- `importOutcomes is a no-op for non-weights outcomes`
- `importOutcomes handles empty array without error`
- `importOutcomes syncs multiple outcomes with independent context`
