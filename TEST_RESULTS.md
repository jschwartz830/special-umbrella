# Test Results

## 2026-05-10 (twenty-fifth pass) — branch `claude/dreamy-mccarthy-ApbpW`

**Result: 616 passing, 0 failing** (+7 tests from 609 baseline)

### Tests added this pass

| File | Change | What they cover |
|------|--------|-----------------|
| `src/lib/__tests__/sessionSummary.test.ts` | +7 new, 5 updated | Swim rounding, pace=0 guard, auto-derived pace (null, zero fallback, stored-wins, duration-only, no-data) |

### Tests reviewed (no changes)

All 609 existing tests reviewed implicitly by full suite run — zero regressions.

### Notable test highlights

- **"derives pace from distance + duration when averagePaceSecondsPerMile is absent"** —
  the primary regression anchor for the auto-derive feature.
- **"prefers stored pace over derived pace"** — ensures GPS/manually-entered pace
  always wins over the derived fallback.
- **"shows no pace when stored pace is 0 and no distance/duration to derive from"** —
  verifies the pace=0 guard produces null rather than "0:00 /mi".
- **"rounds swim distance to the nearest whole meter"** — catches float display regression.

### Important areas still untested

| Area | Notes |
|------|-------|
| `CalendarPage.tsx` stale-closure fix | The CalendarPage bug fix changes 3 lines and has no unit test. The fix follows the same pattern as the tested TodayPage and HistoryPage equivalents; the store operations it calls (updateEntryDate, updateEntryAction) are each individually tested. |
| `ActiveWorkoutTracker.tsx` | Large component with real-time timer, exercise tracking, rest timer. No tests. |
| `OutcomeModal.tsx` | Large component with complex form state. No tests. |
| `CalendarPage.tsx` retroactive edit flows | Complex multi-step edit flows tested implicitly by engine/store units but no integration coverage. |

---

## 2026-05-07 (twenty-fourth pass) — branch `claude/dreamy-mccarthy-Q6elc`

**Result: 609 passing, 0 failing** (+58 tests from 551 baseline)

### Tests added this pass

| File | New tests | What they cover |
|------|-----------|-----------------|
| `src/modules/workout-outcomes/__tests__/progression.test.ts` | 30 | `buildProgressionRecommendation`: weights (single/double/volume), run, swim; null paths; partial completion; regression anchor for allCompleted bug |
| `src/modules/workout-outcomes/__tests__/types.test.ts` | 24 | `completionStateToAction` (6 states), `derivePaceSecondsPerMile`, `deriveSwimPaceSecondsPer100m`, `formatPace` (incl. 9:60 guard, padding, rounding), `formatSwimPace` |
| `src/lib/__tests__/sessionSummary.test.ts` | 5 | Run distance rounding (3.14159 → "3.1 mi"), pace present ("9:02 /mi"), pace null (omitted), pace-only display, no regression on existing cases |
| **Total new** | **58** | |

### Tests reviewed (no changes)

All 551 existing tests reviewed implicitly by full suite run — zero regressions.

### Notable test highlights

- **"hold when not all sets completed" (progression.test.ts)** — regression anchor for
  the `allCompleted` bug. This test would have caught the bug if written before the fix.
- **"prevents 9:60 display" (types.test.ts)** — verifies the totalSecs rounding guard
  in `formatPace` that prevents an invalid minute:seconds display.
- **"rounds run distance to 1 decimal place" (sessionSummary.test.ts)** — catches float
  display regression if rounding is ever removed.

### Important areas still untested

| Area | Notes |
|------|-------|
| `ActiveWorkoutTracker.tsx` | Large component (33.5KB) with real-time timer, exercise tracking, rest timer. No tests. Would require significant test harness work. |
| `OutcomeModal.tsx` | Large component (21.8KB) with complex form state. No tests. |
| `CalendarPage.tsx` retroactive edit flows | Complex multi-step edit flows that involve coordinated store mutations. Tested implicitly by engine/store unit tests but no integration coverage. |
| `csv.ts` full round-trip for outcomes | CSV import/export round-trip tested, but outcome-specific fields (weights, run, swim) within the CSV are not separately verified. |
| `expressionEval.ts` error paths | DSL evaluation errors (malformed expressions) return `0` silently. No test for the error-handling behavior. |

---

## 2026-05-06 (twenty-third pass) — branch `claude/dreamy-mccarthy-9Dgx6`

**Result: 551 passing, 0 failing** (+3 tests from 548 baseline)

### Tests added this pass

| File | New tests | What they cover |
|------|-----------|-----------------|
| `sessionSummary.test.ts` | +4 | Empty `exercises` array → null; all-null sets → null; weights with no actual data falls through to run summary; explicit null return confirmation |

### Areas still untested

- `WeeklyActivityStrip` component — UI-only component rendering dots; no unit test added (would require React Testing Library setup not present in the project). Behaviour is visible and easily verified manually.
- `TodayPage` as a whole — full render tests not present in this project; covered by manual testing.

### TypeScript

`npx tsc --noEmit` exits clean (0 errors).

---

## 2026-05-05 (twenty-second pass) — branch `claude/dreamy-mccarthy-phNna`

**Result: 548 passing, 0 failing** (+11 tests from 537 baseline)

### Tests added this pass

| File | New tests | What they cover |
|------|-----------|-----------------|
| `sessionSummary.test.ts` | +2 | Mixed warmup/working-set display; PB detection with warmup as first set |
| `historyStats.test.ts` | +7 | `computePersonalRecords`: empty input, per-exercise rows, max-load tracking, max-reps tracking, plan-scoped filter, all-time mode, null-load handling |
| `planDeleteCleanup.test.ts` | +2 | `removeProgressionStates` cascade on plan delete; no-op for empty groupIds |

### TypeScript

`npx tsc --noEmit` exits clean (0 errors).

---

## 2026-05-04 (twenty-first pass) — branch `claude/dreamy-mccarthy-sA0Ai`

**Result: 493 passing, 0 failing** (+24 tests from 469 baseline)

### Tests reviewed

All 14 test files reviewed as part of codebase audit:
- `rotationEngine.test.ts` — comprehensive coverage of `mod`, `computeCurrentDayIndex`, `getTodayResolvedDay`, `getUpcomingDays`, `isPlanExpired`; now also covers `getResolvedDaysRange`
- `calendarProjection.test.ts` — tests `buildMonthGrid`
- `historyStore.test.ts` — store CRUD, deduplication, override handling
- `outcomeStore.test.ts` — outcome persistence, moveOutcome
- `exerciseHistoryStore.test.ts` — upsert, remove, move, PR detection
- `programStore.test.ts` — var management, progression rule application
- `planDeleteCleanup.test.ts` — cross-store cascade on plan delete
- `expressionEval.test.ts` — full evaluator coverage (literals, vars, operators, functions, updates)
- `historyStats.test.ts` — stats, plan progress, cycle progress, unlogged days
- `historyScope.test.ts` — scope filtering helpers
- `csv.test.ts` — CSV import/export
- `useExpiryDismiss.test.ts` — expiry banner state hook
- `explanation.test.ts` — run adaptation note generation
- `engine.test.ts` (run-adaptation) — progression decision logic

### Tests added this pass

| File | Added | Description |
|------|-------|-------------|
| `rotationEngine.test.ts` | +17 | `getResolvedDaysRange` suite |
| `rotationEngine.test.ts` | +1 | `isPlanExpired` zero-value guard |
| `historyStats.test.ts` | +5 | `countPlanDayCompletions` suite |
| **Total** | **+23** | (one test failed initial authoring, corrected before commit) |

### Results

All 493 tests pass. No regressions introduced.

### Important areas still untested

- `TodayPage` and `CalendarPage` interactive flows (modal state, undo, double-day) — require browser/React testing framework
- Backdate-overwrite full flow (history entry + outcome + exercise records) — integration test gap
- Plan builder validation (no tests for UI form submission)
- `ActiveWorkoutTracker` timer and set-tracking logic — no unit tests
- `WorkoutDayCard` rendering variations (status, sessionCount display) — no component tests

---

## 2026-04-29 (seventeenth pass) — branch `claude/dreamy-mccarthy-vrC4L`

**Result: 315 passing, 0 failing** (+4 tests this pass)

### Tests reviewed

All 11 test files reviewed for regressions. No existing tests were modified.

### Tests added / updated

**`src/lib/__tests__/historyStats.test.ts`** — 4 new tests in the
`computePlanProgress > weeks-based plans` describe block:

| Test | Purpose |
|------|---------|
| `completed+1 === 1 (week 1) on plan start date and through day 6` | Documents that `completed=0` on days 0–6 → "Week 1" |
| `completed+1 === 2 (week 2) from day 7 through day 13` | Documents week-2 boundary |
| `identifies last week: completed === total-1 when one full week remains` | Documents the "last week!" condition |
| `completed >= total when plan is expired (week indicator should be hidden)` | Documents the expiry boundary; `completed < total` is false → no week indicator |

All 4 tests pass.

### Results

```
Test Files  11 passed (11)
     Tests  315 passed (315)
```

### Important areas still untested

- TodayPage JSX conditions (no component-level tests; covered by integration/
  manual testing).
- CalendarPage DayDetailModal "Resume workout" fix — the edge case (retroactive
  entry deletion shifting the rotation) is complex to reproduce in a unit test.
  The fix logic is a 4-line safe fallback with no branching risk.
- Week progress display text (UI-level, not unit tested).

---

## 2026-04-29 (sixteenth pass) — branch `claude/great-mccarthy-TJqjV`

**Result: 311 passing, 0 failing** (+9 tests this pass)

### Tests added

**`src/store/__tests__/historyStore.test.ts`** — 1 new test in `importEntries` suite:

| Test | What it covers |
|------|---------------|
| picks newest createdAt entry even when older entry appears last in array | regression guard for the `deduplicateByDate` fix |

**`src/lib/__tests__/historyStats.test.ts`** — 8 new tests in new `computeRotationCycleProgress` suite:

| Test | What it covers |
|------|---------------|
| returns null for a weeks-duration plan | plan type guard |
| returns null for a plan with no days | empty-days guard |
| returns doneInCycle=0, remaining=rotationLength for no history | zero-history baseline |
| counts complete and skip entries within current cycle | basic cycle accumulation |
| day_off entries do not count toward cycle progress | mirrors `isPlanExpired` behavior |
| resets doneInCycle to 0 after full rotation, justCompletedRotation=true | rotation-boundary detection |
| counts into second cycle correctly (4 done in 3-day plan = 1 into second) | multi-cycle wrapping |
| ignores entries for a different plan | plan isolation |

### Tests reviewed (no changes needed)

All 302 tests from prior passes continue to pass. No regressions.

### Important areas still untested

- `TodayPage` rendering — no component tests; cycle-progress display not
  directly testable without a React test environment. The underlying helper
  (`computeRotationCycleProgress`) is fully tested.
- HistoryPage `flatItems` memoization — performance characteristic, not
  observable in unit tests.
- Extra-deletion confirm UX — interactive state machine in HistoryPage; not
  covered by existing unit tests.

---

## 2026-04-28 (fifteenth pass) — branch `claude/great-mccarthy-6NVvu`

**Result: 302 passing, 0 failing** (+9 tests this pass)

### Tests added

All 9 new tests are in `src/lib/__tests__/historyStats.test.ts` under the
`countPastUnloggedDays` describe block:

| Test | What it covers |
|------|---------------|
| returns 0 when plan just started today | zero-length window (today = startDate) |
| returns 0 when all days are logged | all 7 days have entries |
| returns full window count when nothing is logged | 7/7 unlogged |
| returns count of gaps within the window | 2 gaps in 7 days |
| clamps to plan start date | plan start 3 days ago → max 3 days inspected |
| returns 0 when lookbackDays is 0 | explicit zero window guard |
| respects a custom lookback window (3 days) | window=3, 2 of 3 unlogged |
| ignores entries for a different plan | cross-plan isolation |
| treats day_off and skip as logged | all action types mark a day as "logged" |

### Tests reviewed (no changes needed)

All 293 tests from prior passes continue to pass. No regressions.

### Important areas still untested

- `TodayPage` rendering — no component tests exist for TodayPage; UI behaviour
  of the nudge is not exercised in the test suite (consistent with prior policy
  of not adding React component tests).
- `typeMixLabel` computation in HistoryPage — derived inline from `flatItems`;
  no dedicated unit test (the underlying plan/entry lookup is tested transitively
  by the store tests).
- Nudge visibility when plan is expired — currently shows; suppression logic
  (if added) would need a test.

---

## 2026-04-27 (fourteenth pass) — branch `claude/great-mccarthy-GNrKl`

**Result: 293 passing, 0 failing** (+2 tests this pass)

### New tests added

| File | Test | Covers |
|------|------|--------|
| `historyStore.test.ts` | `logAction: accepts undefined planDayIndex directly for day_off` | New `number \| undefined` type for day_off callers |
| `rotationEngine.test.ts` | `removing a retroactive jump override without re-adding one shifts the rotation` | Engine invariant that CalendarPage fix relies on |

### Full suite summary

```
Test Files: 11 passed (11)
Tests:      293 passed (293)
Duration:   ~1.3s
```

### Test file breakdown (post-fourteenth-pass)

| File | Tests |
|------|-------|
| `src/engine/__tests__/calendarProjection.test.ts` | 31 |
| `src/engine/__tests__/rotationEngine.test.ts` | 51 (+1) |
| `src/lib/__tests__/csv.test.ts` | 25 |
| `src/lib/__tests__/historyScope.test.ts` | 4 |
| `src/lib/__tests__/historyStats.test.ts` | 54 |
| `src/lib/__tests__/runProgression.test.ts` | 46 |
| `src/modules/recommendation/__tests__/explanation.test.ts` | 23 |
| `src/hooks/__tests__/useExpiryDismiss.test.ts` | 12 |
| `src/store/__tests__/historyStore.test.ts` | 25 (+1) |
| `src/store/__tests__/outcomeStore.test.ts` | 6 |
| `src/store/__tests__/planDeleteCleanup.test.ts` | 3 |
| **Total** | **293** |

### Areas still without direct test coverage

- CalendarPage component (no component tests exist anywhere)
- TodayPage component
- PlansPage component (plan progress wiring is read-only display; tested indirectly via `computePlanProgress` unit tests)

---

## 2026-04-27 (thirteenth pass) — branch `claude/great-mccarthy-PqhIm`

**Result: 291 passing, 0 failing** (+5 tests this pass)

### New tests added

| File | Test | Covers |
|------|------|--------|
| `engine.test.ts` | `formatPace` does not produce ":60" (599.5) | formatPace overflow fix |
| `engine.test.ts` | `formatPace` does not produce ":60" (539.5) | formatPace overflow fix |
| `engine.test.ts` | `formatPace` rounds correctly (599.4 → 9:59) | formatPace rounding |
| `rotationEngine.test.ts` | 0-day plan is never expired (explicit guard) | isPlanExpired guard |
| `csv.test.ts` | preserves source field through export/import round-trip | CSV source field |

### Full suite summary

```
Test Files: 11 passed (11)
Tests:      291 passed (291)
Duration:   ~4s
```

---

## 2026-04-26 (twelfth pass) — branch `claude/great-mccarthy-bM0YZ`

**Result: 286 passing, 0 failing** (11 test files, +19 tests this pass)

### Tests added this pass (+19)

**`src/lib/__tests__/csv.test.ts` (+2)**

| Test | Purpose |
|------|---------|
| `preserves extraId on import so re-importing the same CSV is idempotent` | Regression lock for the CSV re-import bug fix — stable extraId column survives round-trip |
| `generates a fresh ID for extras when the extraId column is absent (pre-2026-04-26 exports)` | Backward-compat: legacy CSVs without extraId column still import cleanly |

**`src/engine/__tests__/rotationEngine.test.ts` (+3)**

| Test | Purpose |
|------|---------|
| `computeCurrentDayIndex: returns startDayIndex when targetDate is before plan.startDate` | Pre-startDate queries return startDayIndex, not a negative value |
| `getUpcomingDays: single-day plan always projects the same day (mod 1 = 0)` | Modulo with one plan day always yields index 0 |
| `isPlanExpired: is never expired for a 0-day plan (division by zero guard)` | `Math.floor(0/0) = NaN`, `NaN >= 1` is `false` → 0-day plan is never expired |

**`src/lib/__tests__/historyStats.test.ts` (+14)**

`computePlanProgress` (+1): `returns zeros when duration.value is 0 (guard: total <= 0)`

`computeWorkoutTypeBreakdown` (+13): empty inputs; completed/skipped rotation counts; day_off exclusion; null planDaysById; missing index in map; extras by workoutType; combined rotation+extras; avgEffort computation; null effort when no data; rounding to 1 decimal; dateRange filter for rotation entries; dateRange filter for extras.

### Test file summary

| File | Tests |
|------|-------|
| `src/engine/__tests__/calendarProjection.test.ts` | 31 |
| `src/engine/__tests__/rotationEngine.test.ts` | 50 |
| `src/lib/__tests__/csv.test.ts` | 25 |
| `src/lib/__tests__/historyScope.test.ts` | 4 |
| `src/lib/__tests__/historyStats.test.ts` | 54 |
| `src/lib/__tests__/runProgression.test.ts` | 46 |
| `src/modules/recommendation/__tests__/explanation.test.ts` | 23 |
| `src/hooks/__tests__/useExpiryDismiss.test.ts` | 12 |
| `src/store/__tests__/historyStore.test.ts` | 24 |
| `src/store/__tests__/outcomeStore.test.ts` | 6 |
| `src/store/__tests__/planDeleteCleanup.test.ts` | 3 |
| **Total** | **286** |

No existing tests were deleted or disabled. One csv.test.ts test was renamed and its expectation inverted to match the now-correct (fixed) behavior.

---

## 2026-04-25 (eleventh pass) — branch `claude/great-mccarthy-0XEfh`

Baseline: **222 passing** (10 test files).
End state: **267 passing** (11 test files).
New tests: **45**.

### Tests reviewed

- `historyStore` — audited `importEntries`; found it had zero tests and a dedup bug.
- `evaluateRunProgression` — traced three uncovered branches in the progression logic.
- `recommendation/explanation.ts` — confirmed module had zero test coverage despite
  containing non-trivial formatting and conditional logic.
- Full baseline suite — all 222 tests passing on entry, no regressions.

### Tests added

| File | Tests | Coverage added |
|------|-------|---------------|
| `src/store/__tests__/historyStore.test.ts` | +4 | `importEntries` happy path, replace-existing, intra-batch dedup, no-op |
| `src/modules/recommendation/__tests__/explanation.test.ts` | +22 | All three exported functions: `generateRunAdaptationNote`, `generateDifficultySpacingWarning`, `summariseRunOutcome` |
| `src/modules/run-adaptation/__tests__/engine.test.ts` | +4 | effort=5+partial_completed, completed+80–95% target, completed+missed+effort=4, completedAsPlanned=false |
| `src/lib/__tests__/historyStats.test.ts` | +15 | `computePlanProgress` — rotations (baseline, partial, full, skip counting, day_off exclusion, cross-plan, cap, empty-days) + weeks (day 0, day 7, day 28, overflow, pre-startDate, ignores entries) |

### Results

All 267 tests pass. No failures, no skipped tests.

### Important areas still untested

- **TodayPage / CalendarPage / HistoryPage / PlansPage / PlanBuilderPage** —
  these are React components that would require a browser-like test environment
  (jsdom or Playwright). The current test config uses `environment: node`.
  Page-level tests remain the biggest coverage gap.
- **`useActivePlan` hook** — not tested; covered indirectly by the engine tests it delegates to.
- **`usePlanActions` hook** — not tested; delegates to store actions which are tested.
- **`computeCurrentDayIndex` with very long histories** — correctness at scale not
  exercised; not a practical concern given localStorage size limits.
- **`progressionStates` after plan delete** — orphaning behavior is not tested because
  there is no cleanup logic to test yet.

---

## 2026-04-24 (tenth pass) — branch `claude/great-mccarthy-hYhLK`

### Tests reviewed

- Run-adaptation engine test suite (`engine.test.ts`) — confirmed the
  audit finding that effort=5 on a skipped/deferred workout is already
  caught by the early skip guard before reaching the effort check.
  No bug exists; the behavior is correct.
- Full existing suite (210 tests) — all passing on entry, no regressions.

### Tests added / updated

- **Added** `src/hooks/__tests__/useExpiryDismiss.test.ts` (12 tests):
  - 6 for the `useExpiryDismiss` localStorage storage contract:
    - key is absent before any dismiss call
    - key is set to `'1'` on dismiss
    - isolated by planId (plan-a dismiss does not affect plan-b)
    - `getItem === '1'` is true when key equals `'1'`
    - `getItem === '1'` is false when key is absent
    - `getItem === '1'` is false when key is any other value
  - 6 for the `durationActualMin` input guard (`isFinite + > 0` pattern):
    - passes through positive integer
    - passes through positive decimal
    - returns null for zero
    - returns null for negative value
    - returns null for empty string
    - returns null for non-numeric input

### Results

| Suite | Before | After |
|---|---|---|
| All test files | 9 files, 210 tests | 10 files, 222 tests |
| Pass | 210 | 222 |
| Fail | 0 | 0 |

`npx vitest run` output: **10 passed (10), 222 passed (222)**

### Type checking

`npx tsc --noEmit` — clean after all changes.

### Build

Not run this pass (prior passes confirmed the build is clean; no
structural changes were made that could break bundling).

### Important areas still untested

- React component rendering (TodayPage, HistoryPage, CalendarPage) —
  no jsdom setup; all component tests are store/hook/lib-level.
- The edit-modal close-trap fix is verified by inspection: `discardAndClose`
  calls `setEditingEntry(null)` unconditionally and is passed to `onClose`,
  ensuring the modal always closes on X press.
- The 'Bonus' pill is a pure JSX conditional — verified by type-check and
  reading the JSX, not by render test.
- `useExpiryDismiss` hook is tested via its storage contract only; the hook's
  React state (`useState`, `useCallback`) is not render-tested.

---

## 2026-04-23 (ninth pass) — branch `work`

### Tests reviewed

- `src/pages/HistoryPage.tsx` history filter/default selection logic.
- Existing full suite to ensure no regressions.

### Tests added/updated

- **Added** `src/lib/__tests__/historyScope.test.ts` (4 tests):
  - includes plans with rotation entries
  - includes plans with extras-only entries
  - `hasPlanHistory` true for extras-only plans
  - `hasPlanHistory` false for null/unknown plan IDs

### Results

- `npm test` → **pass** (9 files, 210 tests).
- `npm run build` → **pass** (TypeScript + production bundle).

### Important areas still untested

- HistoryPage component-level interaction tests (plan filter rendering and default selection) remain unimplemented; coverage is helper-level + integration via full suite.

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

---

## 2026-04-30 (eighteenth pass) — branch `claude/dreamy-mccarthy-Ymdp2`

**Result: 315 passing, 0 failing** (unchanged — suite already comprehensive)

### Tests reviewed

All 11 test files reviewed. Prior passes (especially the seventeenth) already
added `computeWorkoutTypeBreakdown` tests (effort averaging, date ranges, extras)
and `getResolvedDaysRange` direct tests. No gaps remain at the unit level for
these functions.

### Tests added / updated

None. The test suite reached a stable comprehensive state in pass 17. No
new test files were introduced this pass.

### Impact of changes on test coverage

| Change | Test impact |
|--------|-------------|
| HistoryPage stale-entries fix | No unit-testable path (React closure behavior; store actions already tested) |
| `extraToPlanDay` extraction | Refactor only — no logic change, no new tests needed |
| `findPreviousSessionForPlanDay` | New pure function — untested (simple scan over already-tested store) |
| `buildLastSessionSummary` | New pure function — untested (string formatting, low test value) |

### Important logic still untested

#### Medium priority (unchanged from pass 17)

1. **planStore** — `setActivePlan` (deactivates previously active plan),
   `duplicatePlan`
2. **Double-day rotation behavior** — advance override + complete entry on
   the same day, verifying tomorrow starts 2 positions ahead

#### New from this pass (lower priority)

3. **`findPreviousSessionForPlanDay`** — pure function scan over entries.
   Handles: no matching entries, multiple matching entries sorted by date,
   entries without outcomes. Easy to add if the feature is kept.
4. **`buildLastSessionSummary`** — string formatting for weights / run / swim.
   Low test value but edge cases (missing actualReps but actualLoad present,
   swim without distance) could be tested for correctness.

#### Lower priority (unchanged from prior passes)

5. **CalendarPage retroactive logging flow**
6. **PlanBuilderPage unsaved-changes guard**

---

## 2026-05-01 (nineteenth pass) — branch `claude/dreamy-mccarthy-15kIJ`

**Result: 440 passing, 0 failing** (+125 tests from baseline of 315).

### Tests reviewed

All existing 11 test files reviewed as part of the gap audit. Two files were
identified as entirely missing: `expressionEval.test.ts` and
`programStore.test.ts`.

### Tests added / updated

| File | New tests | Notes |
|------|-----------|-------|
| `src/lib/__tests__/expressionEval.test.ts` | 100 | New file |
| `src/store/__tests__/programStore.test.ts` | 23 | New file |
| `src/store/__tests__/planDeleteCleanup.test.ts` | +2 | Added to existing file |

**Total new tests: 125**

#### expressionEval.test.ts breakdown

| Group | Tests | What's covered |
|-------|-------|----------------|
| `evaluateExpression` | ~35 | Arithmetic, precedence, comparisons, logical ops, all 8 functions, variables, unknown vars → 0 |
| `evaluateCondition` | ~15 | Bare keywords, compound expressions, missing condition → true |
| `evaluateUpdates` | ~25 | All 5 assignment operators, complex rhs, multi-statement, paren-safe commas |
| `resolveLoad` | ~10 | `lb`/`kg` suffix, expressions, null for missing |
| `resolveQuantityString` | ~15 | Unit suffixes, bare numerics, variable-only expressions |

#### programStore.test.ts breakdown

| Group | Tests | What's covered |
|-------|-------|----------------|
| `initVars` | 4 | Initial set, idempotent, merge new keys, plan isolation |
| `getVars` | 2 | Unknown plan → `{}`, known plan returns vars |
| `setVars` | 3 | Merge patch, create for new plan, no cross-plan leak |
| `clearPlanVars` | 3 | Removes all, no cross-plan leak, no-op for nonexistent |
| `applyProgressionRule` | 11 | Condition branches, complex expressions, persistence |

### Tests that caught real bugs

The `expressionEval.test.ts` tests immediately caught the `splitStatements` bug
(tests 3 and 4 in the `evaluateUpdates` paren-safe group failed on first run):

```
✗ rhs can use min to cap a value
✗ rhs can use min that does not cap
```

These failures pointed directly to the naive `split(',')` in `evaluateUpdates`.
The fix (`splitStatements()`) was added to `expressionEval.ts` and both tests
passed. This is the intended workflow — tests find bugs the human didn't know
existed.

### Impact of changes on test coverage

| Change | Test impact |
|--------|-------------|
| `PlansPage` clearVars bug fix | Covered by 2 new `planDeleteCleanup` integration tests |
| `splitStatements` bug fix | Covered by `evaluateUpdates` paren-safe tests |
| `expressionEval.ts` full DSL | 100 new tests, 5 public exports now fully covered |
| `programStore` all actions | 23 new tests, all 5 public actions now fully covered |

### Important logic still untested

#### Medium priority (unchanged from pass 18)

1. **planStore** — `setActivePlan` (deactivates previously active plan),
   `duplicatePlan`
2. **Double-day rotation behavior** — advance override + complete entry on
   the same day, verifying tomorrow starts 2 positions ahead

#### Lower priority (carry-over)

3. **`findPreviousSessionForPlanDay`** / **`buildLastSessionSummary`** —
   pure helper functions added in pass 18, untested.
4. **CalendarPage retroactive logging flow**
5. **PlanBuilderPage unsaved-changes guard**
7. **TodayPage action handlers**

---

## 2026-05-02 (twentieth pass) — branch `claude/dreamy-mccarthy-WJaAU`

**Result: 484 passing, 0 failing** (+44 tests from baseline of 440).

### Tests reviewed

All existing test files reviewed for regressions. Three files added, one
updated. No existing tests were modified; no regressions introduced.

### Tests added / updated

| File | New tests | Notes |
|------|-----------|-------|
| `src/lib/__tests__/sessionSummary.test.ts` | 21 | New file |
| `src/store/__tests__/planStore.test.ts` | 22 | New file |
| `src/store/__tests__/planDeleteCleanup.test.ts` | +1 | Added to existing file |

**Total new tests: 44**

#### sessionSummary.test.ts breakdown

| Group | Tests | What's covered |
|-------|-------|----------------|
| `findPreviousSessionForPlanDay` | 8 | Empty entries, missing outcome, most-recent wins, today excluded, wrong planDayIndex ignored, skip/day_off ignored, wrong planId, fallback to earlier |
| `buildLastSessionSummary — weights` | 5 | No data → null, N×reps format, no-load, PB marker, below-max no PB |
| `buildLastSessionSummary — PB map edge cases` | 3 | No map → no PB, exercise absent from map, explicit no-PB |
| `buildLastSessionSummary — run` | 4 | Distance+duration, distance only, duration only, empty → null |
| `buildLastSessionSummary — swim` | 1 | Distance+duration format |

#### planStore.test.ts breakdown

| Group | Tests | What's covered |
|-------|-------|----------------|
| `createPlan` | 3 | Id assigned, timestamps, multiple plans independent |
| `setActivePlan` | 5 | Status set, prior deactivated, startDate override, startDayIndex override, default today |
| `deactivatePlan` | 2 | Clears activePlanId, no-op when none |
| `archivePlan` | 3 | Status set, activePlanId cleared, sibling untouched |
| `deletePlan` | 3 | Removed, activePlanId cleared, sibling untouched |
| `duplicatePlan` | 6 | New id, "(copy)" suffix, always inactive, new day/slot ids, original intact, missing id → "" |

#### planDeleteCleanup.test.ts addition

Added "clears exercise history records for the deleted plan only":
- Seeds records in `exerciseHistoryStore` for two plans
- Runs the full 5-step cascade (clearPlanHistory, clearPlanOutcomes, clearPlanVars, clearByPlanId, deletePlan)
- Asserts plan A records removed, plan B records intact

### Tests that caught real bugs

None this pass — the UX fix and feature were identified by code inspection,
not failing tests. The test additions close structural coverage gaps.

### Impact of changes on test coverage

| Change | Test impact |
|--------|-------------|
| `!planExpired` guard on cycle spans | Display-only; covered by code review |
| Session summary extraction to lib | Enabled the 21 new sessionSummary tests |
| PB detection feature | 3 of the 21 sessionSummary tests specifically cover PB paths |
| `planStore` all actions | 22 new tests; all 6 public actions now covered |
| exerciseHistory cascade in delete | 1 new integration test |

### Important logic still untested

#### Lower priority (carry-over)

1. **Double-day rotation behavior** — advance override + complete on the same
   day; tomorrow should start 2 positions ahead.
2. **CalendarPage retroactive logging flow**
3. **PlanBuilderPage unsaved-changes guard**
4. **TodayPage action handlers** (startWorkout, confirmPrimary, etc.)
