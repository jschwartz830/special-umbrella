# Test Results

## 2026-06-03 (forty-ninth pass) — branch `claude/dreamy-mccarthy-yJLmG`

**Result: 793 passing, 0 failing** (+5 tests vs entry baseline of 788)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 788 |
| Tests added | 5 |
| Tests on exit | 793 |
| Failing | 0 |

### Tests added this pass

All 5 tests in `src/lib/__tests__/historyStats.test.ts`:

| Test | Function | Purpose |
|------|----------|---------|
| `does not count future-dated entries toward rotation progress` | `computePlanProgress` | Regression guard: future entry excluded when `today` provided |
| `does not count future-dated entries when today is provided` | `computeRotationCycleProgress` | Regression guard: future entry excluded when `today` provided |
| `includes all entries when today is omitted (backward-compatible behavior)` | `computeRotationCycleProgress` | Documents that callers without `today` get old behavior |
| `does not count future-dated entries when today is provided` | `computeRotationPlanRemaining` | Regression guard: future entry excluded when `today` provided |
| `includes all entries when today is omitted (backward-compatible behavior)` | `computeRotationPlanRemaining` | Documents backward-compat when `today` omitted |

### Tests reviewed

All 19 test files reviewed on entry. Notable coverage:
- `rotationEngine.test.ts`: 44 tests covering all rotation engine functions; clean
- `historyStats.test.ts`: 152 tests (now 157); comprehensive coverage of all stats functions
- `historyStore.test.ts`: strong coverage of store mutations and migration
- `planDeleteCleanup.test.ts`: integration-style cleanup cascade tests
- `outcomeStore.test.ts`, `planStore.test.ts`: good store-level coverage

### Important areas still untested

- `computeWeeklyBreakdown`: call in HistoryPage uses `addDays(new Date(), -55)` which is stale past midnight — minor, lower priority
- `computeWorkoutTypeBreakdown` multi-slot attribution: documented limitation, test added in pass 47 but function not changed
- UI behavior of progress bar (PlansPage): not unit testable; requires browser testing
- `useActivePlan` midnight refresh with `useToday()`: hook behavior is tested indirectly via component renders but there's no dedicated test for the `useToday()` midnight refresh

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
