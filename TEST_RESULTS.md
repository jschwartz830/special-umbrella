# Test Results

## 2026-04-21 (eighth pass) — branch `claude/epic-cannon-Ltjw1`

### Suite totals

| Metric | Entry | Exit |
| --- | ---: | ---: |
| Test files | 8 | 8 |
| Tests | 194 | **206** |
| Failing | 0 | 0 |

Final run: `npm test`

```
 Test Files  8 passed (8)
      Tests  206 passed (206)
```

Type-check: `npx tsc --noEmit` — clean.
Production build: `npm run build` — clean.

### Tests reviewed

- `src/lib/__tests__/historyStats.test.ts` — extended (new signature
  plus 4 new extras-aware tests).
- `src/lib/__tests__/csv.test.ts` — extended with 4 new tests: extras
  round-trip, fresh-id generation on import, invalid workoutType
  rejection, and a legacy-CSV backward-compat check.
- `src/store/__tests__/historyStore.test.ts` — extended with 3 new
  tests covering `importExtraEntries`.
- All other suites passed unchanged.

### Tests added (12)

**`computeHistoryStats` extras** (4):

- `includes extras in totals and completed counts` — verifies every
  extra counts as a completed workout.
- `includes extras in the 7-day and 30-day windows` — extras are
  windowed on their calendarDate the same way rotation completes are.
- `counts an extras-only streak that ends today` — a user who logs
  only ad-hoc yoga every day sees the correct streak.
- `extras fill gaps in a mixed streak` — an extra on a day otherwise
  logged as `skip` keeps the streak going.
- `duplicate-date extras do not double-count within the streak` —
  Set-based dedupe by date is the right semantics.

**`historyToCsv` / `historyFromCsv` extras** (3 + 1 compat):

- `round-trips extraEntries and their outcomes` — the full path:
  export with extras, re-import, verify the new extras exist and
  their outcomes are rekeyed to the freshly generated ids.
- `generates fresh extra IDs on import` — originals do not leak
  across the boundary (prevents id collisions with existing extras).
- `rejects extra rows with invalid workoutType` — malformed extras
  are warned about, not silently created.
- `treats pre-2026-04-21 CSVs (no entryKind column) as all-rotation`
  — legacy backups still import cleanly.

**`historyStore.importExtraEntries`** (3):

- `appends new extras without touching existing ones`
- `skips incoming extras whose id collides with an existing one`
- `is a no-op for an empty array`

### Notable diffs touching existing tests

- Existing `historyStats` tests were updated to pass `[]` as the new
  `extras` argument — behaviour-preserving signature change.
- Existing `csv.test.ts` `rejects invalid action` / `rejects
  malformed dates` tests were updated to include the new `entryKind`
  column on their inline CSV fixtures.
- Existing `historyToCsv` callsites in tests and HistoryPage now pass
  `extraEntries` as the new second argument.

---

## 2026-04-19 (seventh pass) — branch `claude/gracious-heisenberg-2fsGC`

### Suite totals

| Metric | Entry | Exit |
| --- | ---: | ---: |
| Test files | 8 | 8 |
| Tests | 192 | **194** |
| Failing | 0 | 0 |

Final run: `npx vitest run`

```
 Test Files  8 passed (8)
      Tests  194 passed (194)
```

Type-check: `npx tsc --noEmit` — clean.

### Tests reviewed

- `src/store/__tests__/historyStore.test.ts` — extended with 2 new
  tests under a new describe block.
- All other suites passed unchanged.

### Tests added

**`logAction replace-on-collision (TodayPage guard invariant)`** (2):

- `replaces today's primary entry when logAction is called again for
  the same (planId, today) with a different planDayIndex` — documents
  the data-loss path the TodayPage guard prevents. Verifies that a
  second `logAction` on the same `(planId, calendarDate)` wipes out
  the prior `planDayIndex` and `notes`.
- `does NOT collide when today has no entry yet (the intended
  "upcoming-as-today" path)` — confirms the feature's intended use
  case still works when today is pending.

### Results

All 194 tests pass. No regressions in any of the 8 suites.

Full manifest:

- `src/engine/__tests__/rotationEngine.test.ts`
- `src/engine/__tests__/calendarProjection.test.ts`
- `src/store/__tests__/historyStore.test.ts` (+2)
- `src/store/__tests__/outcomeStore.test.ts`
- `src/store/__tests__/planDeleteCleanup.test.ts`
- `src/lib/__tests__/csv.test.ts`
- `src/lib/__tests__/historyStats.test.ts`
- `src/modules/run-adaptation/__tests__/` (adaptation engine)

### UI flows not covered by tests

- The TodayPage inline error banner for the guard case renders only
  when `upcomingLogError` is set. No component-level test confirms
  the banner shows; verified by code review and type check only.
- The `OutcomeMetrics` shared component is rendered by CalendarPage
  and HistoryPage; no component-level test confirms the visual output.
  Type check and manual review only.

---

## 2026-04-18 (sixth pass) — branch `claude/overnight-audit-improvements-RzBkA`

### Suite totals

| Metric | Entry | Exit |
| --- | ---: | ---: |
| Test files | 8 | 8 |
| Tests | 176 | **192** |
| Failing | 0 | 0 |

Final run: `npx vitest run`

```
 Test Files  8 passed (8)
      Tests  192 passed (192)
```

Type-check: `npx tsc --noEmit` — clean (only the pre-existing
`baseUrl` deprecation warning; unrelated to this run).

### Tests reviewed

- `src/store/__tests__/historyStore.test.ts` — extended with 19 new
  tests across four new describe blocks.
- All other suites passed unchanged.

### Tests added

**`updateEntryDate`** (3): moves entry, isolates other entries, preserves fields.

**`updateExtraEntryDate`** (4): moves extra, isolates other extras, preserves fields, no-ops on wrong id.

**`clearExtraEntriesForDate`** (4): clears matching plan+date, leaves other dates, leaves other plans, no-op.

**`ExtraWorkoutEntry.source`** (6): double_day persisted, history persisted, undefined for legacy shape, Undo filter removes double_day+undefined but keeps history, removes-all, keeps-all.

### Results

All 192 tests pass.

### Important areas still untested

- UI-level tests for any page (no React testing setup; unchanged from
  prior passes).
- CalendarPage OutcomeModal fix is covered by type-check and store-level
  key-collision invariants, but not by an automated UI test.
- `progressionStates` cleanup on plan delete — not implemented.

---

## 2026-04-18 (fifth pass) — branch `claude/add-bonus-workout-outcomes-c1H1R`

### Suite totals

| Metric | Entry | Exit |
| --- | ---: | ---: |
| Test files | 8 | 8 |
| Tests | 171 | **176** |
| Failing | 0 | 0 |

Final run: `npx vitest run`

```
 Test Files  8 passed (8)
      Tests  176 passed (176)
```

Type-check: `npx tsc --noEmit` — clean (only the pre-existing
`baseUrl` deprecation warning surfaced; unrelated to this run).

### Tests reviewed

- `src/store/__tests__/historyStore.test.ts` — passed at baseline; the
  `beforeEach` reset was silently leaking `extraEntries` across tests
  (the bucket was added to the store after the reset was written).
  Caught when my new tests first failed with unexpectedly-large array
  lengths.
- `src/store/__tests__/outcomeStore.test.ts` — passed at baseline.
  Added one new `describe` block.
- `src/store/__tests__/planDeleteCleanup.test.ts` — passed, not
  modified. Already covers plan-delete cascade including extras.
- Other suites (engine, run-adaptation, lib) — passed, not touched.

### Tests added / updated

1. **`historyStore.test.ts` — new `describe` "addExtraEntry alongside
   a primary HistoryEntry"** (3 tests):
   - Primary `HistoryEntry` and `ExtraWorkoutEntry` coexist on the
     same `(planId, calendarDate)`.
   - Multiple extras on the same date accumulate with distinct ids.
   - `removeEntry` does not touch extras.
2. **`historyStore.test.ts` — `beforeEach` reset**: now also resets
   `extraEntries: []`.
3. **`outcomeStore.test.ts` — new `describe` "primary and extra
   outcomes for the same (planId, date)"** (2 tests):
   - Both outcomes coexist under distinct keys.
   - `clearPlanOutcomes` wipes both.

### Results

All 176 tests pass. New tests directly exercise the invariants the
double-day fix depends on:
- `HistoryEntry` + `ExtraWorkoutEntry` on the same date survive
  together.
- `WorkoutOutcome` under `makeWorkoutInstanceId(planId, date)` and
  under `makeExtraWorkoutInstanceId(planId, date, extraId)` do not
  collide.
- Cleanup (`removeEntry`, `clearPlanOutcomes`) behaves predictably.

### Important areas still untested

- UI-level test of the double-day flow in `TodayPage` (clicking
  Complete with double-day on → primary modal confirms → bonus modal
  appears → bonus persists as extra). No React testing setup exists
  in this codebase; adding one was out of scope. The store-level
  tests cover the data-model half of the contract.
- `HistoryPage` extra-entry outcome edit round-trip — the fix in
  `7969378` is a one-line wiring change that relies on the new
  `OutcomeModal.workoutInstanceId` prop, which is itself exercised
  indirectly by the new store tests. A direct UI test would be
  valuable but is also blocked on the lack of React test setup.
- The `completionStateToAction` documentation bug (noted in the prior
  audit) still has no test guarding the actual rotation-advance
  behaviour for `day_off`. Not expected to close this run.

---

## 2026-04-18 run — branch `claude/system-improvements-m4b4f`

### Suite totals

| Stage       | Files | Tests | Passing |
|-------------|-------|-------|---------|
| Baseline    | 8     | 170   | 169 (1 failing) |
| After run   | 8     | 171   | **171** |
| Delta       | 0     | +1    | +2 (1 fix + 1 add) |

All green. Run with `npx vitest run` (or `npm test`).

### Failing test that was fixed

**`src/lib/__tests__/csv.test.ts`** — the `'generates fresh IDs on
import'` test asserted `plans[0].id` was regenerated. Commit
`d16e8c2` intentionally changed the import to preserve planId so
previously-exported history CSVs stay linkable across re-imports.
Renamed the test to `'preserves planId but generates fresh day/slot
IDs on import'` and flipped the assertion to `toBe('plan-1')`. Day
and slot IDs are still verified to regenerate.

### New tests added

**`src/store/__tests__/planDeleteCleanup.test.ts`** (+1 test, now 3 total)

- `'removes ad-hoc extra workouts and their outcomes for the deleted
  plan only'` — seeds plan A with 2 extras and plan B with 1 extra,
  creates outcomes for each extra, simulates the PlansPage
  delete-cascade (`clearPlanHistory` → `clearPlanOutcomes` →
  `deletePlan`), asserts plan A extras + outcomes are gone and plan B
  extras + outcome survive. The existing two tests (basic cascade,
  active-plan reset) were untouched.

### Behaviors now guaranteed by tests

1. Deleting a plan removes all ad-hoc extra workouts logged against
   it from `historyStore.extraEntries`, and their outcomes from
   `outcomeStore.outcomes`. Sibling plans' extras survive.
2. CSV plan import preserves planId (contract documented by test).
   Day and slot IDs still regenerate.

### Not regression-tested (acceptable)

Doc-only changes (`aa09ad7` on `completionStateToAction`) don't need
a test. No code path changed.

---

## 2026-04-17 run — branch `claude/funny-galileo-6zMOl`

### Suite totals

| Stage       | Files | Tests |
|-------------|-------|-------|
| Baseline    | 6     | 156   |
| After run   | 8     | 170   |
| Delta       | +2    | +14   |

All green. Run with `npx vitest run`.

Production build: `npx vite build` succeeds — `dist/assets/index-*.js`
~308 kB (89 kB gzip), `dist/assets/index-*.css` ~24 kB (5 kB gzip).

### Files added

#### `src/lib/__tests__/historyStats.test.ts` — 9 tests

- empty-entry-list returns all zeros
- totals vs. completed counts
- 7-day window is inclusive of today (day −6 in, day −7 out)
- 30-day window is inclusive of today (day −29 in, day −30 out)
- skip entries are excluded from window counts
- streak counts consecutive complete/day_off days ending today
- streak is 0 when today has no qualifying entry
- skip on an intermediate day breaks the streak
- a gap day breaks the streak

#### `src/store/__tests__/planDeleteCleanup.test.ts` — 2 tests

- deleting plan A purges its history entries and outcomes from both
  stores, and leaves plan B entirely untouched
- deleting the currently active plan resets `activePlanId` to null

### File additions (new tests within existing file)

#### `src/store/__tests__/outcomeStore.test.ts`

Added a `removeOutcome` describe block:

- removes a single outcome by instanceId (doesn't touch siblings)
- no-op when instanceId is unknown
- does not affect `progressionStates` (progression state keyed by
  group id, not plan id — should survive single-outcome removal)

### Behaviors now guaranteed by tests

1. Deleting a plan with 2 history entries + 2 outcomes leaves 0 of
   either in the stores; sibling plans unaffected.
2. Undoing a single entry removes its outcome but keeps all other
   outcomes and the progression state.
3. History stats helper is timezone-safe (UTC shift) and respects
   inclusive N-day windows.

---

## 2026-04-16 run

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
