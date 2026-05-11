# Implementation Plan

## Pass 22 — 2026-05-05 (branch `claude/dreamy-mccarthy-phNna`)

### Observations on entry

- Baseline: **537 passing, 0 failing** (after `npm install` on fresh env).
- `buildLastSessionSummary` used `ex.sets.find(...)` (first set with any data)
  for both display and PB comparison, meaning a warmup set (135 lb) would be
  shown instead of the heavier working sets (185 lb), and the PB detection would
  miss a true personal best if the first set was a warmup.
- The unlogged-days nudge ("N days without entries — rotation may be stalled")
  had no guard against `planExpired`, so it could appear alongside the "Plan
  complete!" banner — contradictory UX.
- The upcoming workout modal had a dead `historyEntry` branch: `getUpcomingDays`
  never populates `historyEntry` on `ResolvedDay` objects it returns, so the
  "Already logged — show status + edit/clear" branch was unreachable.
- `computePersonalRecords` and its `PersonalRecord` interface were defined as
  `export` inside `HistoryPage.tsx` — untestable without rendering the page.
- `progressionStates` in `outcomeStore` were never removed on plan delete,
  creating a permanent storage leak for run-progression plans. Deferred since
  pass 15.

### Decisions

- **Fix PB detection** — use heaviest set (by `actualLoad`) for both display
  and PB comparison; add 2 targeted tests with mixed warmup/working sets.
- **Suppress unlogged-days nudge when plan expired** — one-character conditional
  change; no test needed (behavior is visually obvious).
- **Remove dead upcoming modal branch** — pure deletion of ~33 lines, reduces
  confusion; safe because the branch was provably unreachable.
- **Extract `computePersonalRecords` to `historyStats.ts`** — adds testability
  without changing behavior; add 7 unit tests.
- **Fix `progressionStates` orphaning** — add `removeProgressionStates` to
  `outcomeStore`; wire into `PlansPage` delete handler; add 2 integration tests.

### Prioritized plan

| Priority | Item | Risk | Status |
|----------|------|------|--------|
| 1 | Suppress nudge when plan expired | None | ✅ Done |
| 2 | Remove dead upcoming modal branch | None | ✅ Done |
| 3 | Fix PB detection (heaviest set) + tests | Low | ✅ Done |
| 4 | Extract computePersonalRecords + tests | None | ✅ Done |
| 5 | Fix progressionStates orphaning + tests | Low | ✅ Done |

### Exit state

**548 passing, 0 failing** (+11 tests from baseline).

### Carry-over open items

- Plan builder UI should validate `duration.value > 0` (no crash, just bad UX)
- Narrow Zustand selectors in CalendarPage (performance, not urgent)
- Document progression system migration path (legacy RunProgressionState vs new ProgressionRecommendation)
- Expression evaluator should surface errors to UI for malformed progression rules
- `PlanCard` component defined inside `PlansPage` function body (no memoization; low priority)

---

## 2026-04-29 — Overnight Audit (seventeenth pass)

Branch: `claude/dreamy-mccarthy-vrC4L`.
Baseline on entry: **311 passing, 0 failing**.
Exit state: **315 passing, 0 failing** (+4 tests).

### Architecture summary (unchanged)

Stack, store split, and engine layering match all prior audits. No
architectural drift since the sixteenth pass. All previous PRs (#27–#54)
merged into this branch, so the baseline already includes active-workout
tracking, historical workout logging, plan builder, YAML import, double-day
support, CSV import/export, drag-and-drop, settings tab, and the rotation
cycle progress indicator.

### What appears strong and well-designed (unchanged)

- 315-test suite covering engine, stores, adaptation, lib, CSV, and
  recommendation.
- All prior bug fixes from passes 1–16 remain stable; no regressions.
- Clean separation between pure engine logic and React UI.
- `computePlanProgress` and `computeRotationCycleProgress` are well-tested
  pure helpers that UI can safely build on.

### Key issues found this pass

1. **"0/N done" cycle progress shown at plan start** (UX BUG).
   `cycleProgress.doneInCycle === 0` at the start of a rotations plan
   (no history yet), and the prior condition `!justCompletedRotation` was
   true, so "0/3 done" was displayed in the subtitle. This is noise — no
   action has been taken. Fixed by checking `doneInCycle > 0`.

2. **`bonusOutcome` OutcomeModal missing `previousSetsByExercise`** (UX GAP).
   The double-day bonus workout modal (opens automatically after confirming
   the primary workout) did not receive the `previousSetsByExercise` prop.
   This meant historical weight data was unavailable for pre-filling in the
   bonus modal, even though the data was already computed and used by the
   primary and upcoming workout modals. One-line fix.

3. **`CalendarPage` "Resume workout" used projected `planDay` not logged one**
   (LOGIC BUG). The "Resume workout" link in the DayDetailModal level-1 view
   passed `resolved.planDay` to `startHistoricalResume`. If earlier entries
   were deleted or edited after a workout was logged, the rotation projection
   for that date could point to a different day than was actually logged.
   The `ActiveWorkoutTracker` would then show the wrong exercises. Fixed by
   using `resolved.historyEntry?.planDayIndex ?? resolved.planDayIndex` to
   look up the correct `PlanDay`, with a safe fallback. Mirrors TodayPage's
   `primaryPlanDayIndex` pattern.

4. **`weeks`-duration plans had no progress signal on TodayPage** (FEATURE GAP).
   Pass 16 added "3/6 done" for rotation plans. Weeks plans showed only
   "Day X of N in rotation" with no calendar-week progress. `computePlanProgress`
   already computed this correctly and was already tested. Added "Week X of Y"
   inline with an optional "last week!" micro-label, symmetric with the
   rotation cycle treatment.

### What appears strong and well-designed (this pass)

- The `computePlanProgress` / `computeRotationCycleProgress` split is paying
  off: the weeks-plan feature required zero new pure logic, only one import
  and ~10 JSX lines.
- The `historyEntry?.planDayIndex` fallback pattern now consistently applied
  in TodayPage (primaryPlanDayIndex), CalendarPage DayDetailModal (resume),
  and CalendarPage `openEditOutcome`.

### Prioritized plan

| Priority | Item | Risk | Status |
|----------|------|------|--------|
| 1 | Fix "0/N done" at plan start | None | ✅ Done |
| 2 | Pass previousSetsByExercise to bonus modal | None | ✅ Done |
| 3 | CalendarPage resume uses correct planDay | Low | ✅ Done |
| 4 | Week progress indicator on TodayPage | Low | ✅ Done |
| 5 | Tests for week-progress boundary conditions | None | ✅ Done |

### Rationale for sequencing

Bugs first (items 1–3), in order of user-facing impact. The feature (4)
was selected because it reuses existing, tested infrastructure with minimal
new surface area and creates parity between the two plan-duration types.

---

## 2026-04-30 — Overnight Audit (eighteenth pass)


Branch: `claude/dreamy-mccarthy-Ymdp2`.
Baseline on entry: **315 passing, 0 failing**.

### Architecture summary (unchanged)

Stack, store split, and engine layering match all prior audits. No
architectural drift since the seventeenth pass. All previous PRs (#27–#60)
merged, so the baseline already includes active-workout tracking, plan builder,
YAML import, double-day support, CSV import/export, exercise library GUI,
settings version stamp, and week/rotation progress indicators.

### What appears strong and well-designed (unchanged)

- 315-test suite, no regressions across 17 prior passes.
- Pure-function rotation engine with thorough test coverage.
- Clean store isolation: `historyStore`, `outcomeStore`, `planStore`, `programStore`.
- `extraToPlanDay` adapter pattern (used in 3 places) is a clean seam even
  though it is currently duplicated.

### Key issues found this pass

1. **`HistoryPage` stale `entries` closure in `handleOutcomeConfirm`** (LOGIC BUG).
   When a user edits a workout outcome in HistoryPage and changes both the
   `completedAt` date AND the completion state (e.g., from `skip` → `partially_completed`),
   the final `updateAction` call silently fails. The function captures `entries`
   from the React render closure. After calling `updateEntryDate(...)`, the
   closure-captured `entries` still has the entry at the _old_ date, so
   `entries.find(e => e.calendarDate === completedDate)` returns `undefined`,
   and `updateAction` is never called. The outcome saves correctly (it goes
   through `logOutcomeWithProgression`), but the history entry action (shown
   as the label in the list: "Completed" / "Skip" / "Partial") does not update
   to match. Fixed by reading from `useHistoryStore.getState().entries` instead
   of the stale closure, consistent with the TodayPage pattern.

2. **`extraToPlanDay` duplicated in TodayPage, CalendarPage, HistoryPage** (CODE QUALITY).
   Three identical copies of the same 6-line helper across three files. Any
   future extension to extra workout PlanDay construction (e.g., adding notes
   or difficulty) would require updating all three. Extracted to
   `src/lib/planDayUtils.ts` and imported everywhere.

3. **`computeWorkoutTypeBreakdown` under-tested** (TEST GAP).
   The effort-averaging path and date-range filter were untested. Edge cases
   (zero-effort outcomes, extras-only workouts, planDaysById=null) had no
   coverage. Added 7 new tests.

4. **`getResolvedDaysRange` (calendar projection) had no direct tests** (TEST GAP).
   The calendar projection function is the most complex in the engine and
   handles past/today/future pointer logic with overrides. The existing
   calendarProjection test file only tested `buildMonthGrid`. Added 6 direct
   tests covering past-unlogged stall, today boundary, future projection, and
   override application.

### Feature selected: previous-session summary on TodayPage

Added a compact "Last: 3×8 @ 135 lb" or "Last: 2.5 mi in 28 min" inline
hint below today's WorkoutDayCard, visible only when the workout is pending
and a prior session for the same `planDayIndex` exists. This closes the most
common friction point of "what weight did I use last time?" without requiring
the user to open the outcome modal. See FEATURE_PROPOSAL.md for full rationale.

### What appears strong and well-designed (this pass)

- The `primaryPlanDayIndex` pattern in TodayPage (historyEntry?.planDayIndex
  fallback) is solid and already tested indirectly via the engine tests.
- `computeWorkoutTypeBreakdown` is a well-factored pure function that was
  just missing tests for the effort path.

### Prioritized plan

| Priority | Item | Risk | Status |
|----------|------|------|--------|
| 1 | Fix HistoryPage stale entries closure | Low | ✅ Done |
| 2 | Extract extraToPlanDay to shared utility | None | ✅ Done |
| 3 | Add computeWorkoutTypeBreakdown tests | None | ✅ Done |
| 4 | Add getResolvedDaysRange tests | None | ✅ Done |
| 5 | Previous-session inline summary (feature) | Low | ✅ Done |

### Rationale for sequencing

Bug fix first (1), then refactor (2), then tests (3–4) to improve baseline
confidence before adding the feature (5). The feature was selected because
`findPreviousWeightsOutcome` and `previousSetsByExercise` were already computed
at the TodayPage level — adding the summary required no new data fetching.

---

## 2026-05-01 — Overnight Audit (nineteenth pass)

Branch: `claude/dreamy-mccarthy-15kIJ`.
Baseline on entry: **315 passing, 0 failing**.

### Architecture summary (unchanged)

Stack and layering match all prior audits. No architectural drift since pass 18.

### What appears strong and well-designed (unchanged)

- 315-test suite stable across 18 passes, no regressions.
- Pure-function rotation engine with excellent coverage.
- Clean store isolation; Zustand + localStorage persistence is solid.
- `getResolvedDaysRange` (added in pass 18) now has direct test coverage.
- `computeWorkoutTypeBreakdown` coverage added in pass 18.
- `extraToPlanDay` refactored into `src/lib/planDayUtils.ts` in pass 18.

### Key issues found this pass

1. **Plan delete does not call `clearPlanVars`** (DATA LEAK BUG).
   `PlansPage.tsx` delete handler calls `clearPlanHistory + clearPlanOutcomes + deletePlan`
   but never `useProgramStore.clearPlanVars`. YAML-imported plan variables (weights,
   run distances, etc.) remain in `wpt_program_vars` localStorage entry indefinitely
   after the plan is deleted. Over repeated import-delete cycles this accumulates
   unboundedly. Fix is a one-line addition.

2. **`expressionEval.ts` has zero unit tests** (CRITICAL TEST GAP).
   The DSL parser + evaluator is the core engine for all YAML plan progressions.
   It implements a recursive-descent parser (tokenizer → AST → evaluator) with
   multiple code paths: arithmetic, comparison, logical operators, 8 built-in
   functions, variable resolution, and multi-statement update expressions with
   5 assignment operators. Zero tests. Any regression silently breaks all
   YAML-imported plan progressions.

3. **`programStore.applyProgressionRule` has no unit tests** (TEST GAP).
   The bridge between `expressionEval.ts` and persistent program vars has no coverage.
   This integration path (condition evaluation → var updates → store write) is
   exercised only indirectly by the UI. Added a focused test file covering the
   main paths: condition true → applies `then`, condition false → applies `else`,
   condition false with no `else` → no-op, vars updated correctly.

4. **`planDeleteCleanup.test.ts` does not assert `clearPlanVars`** (TEST GAP).
   The integration test that validates plan-delete cascades does not include
   program variables, leaving the above bug untested.

### Feature selected

None this pass. The test gaps (items 2–4) and confirmed bug (item 1) provide
sufficient stabilisation work. No clearly scoped adjacent feature met the bar:
- All obvious adjacent features touch UI pages that cannot be browser-tested
- The existing stats infrastructure is already well-designed; adding more stats
  without UI testing would be premature

### Prioritized plan

| Priority | Item | Risk | Status |
|----------|------|------|--------|
| 1 | Fix `clearPlanVars` missing from delete handler | Very low | ✅ Done |
| 2 | Update planDeleteCleanup test to cover vars | None | ✅ Done |
| 3 | Add `expressionEval.test.ts` | None | ✅ Done |
| 4 | Add `programStore.test.ts` | None | ✅ Done |

### Rationale for sequencing

Bug fix first (confirmed data leak with simple fix), then close the test loop
on the delete behavior, then the largest test gap (expressionEval), then the
programStore integration layer. Feature work explicitly skipped per audit rules
(stabilisation over expansion when test coverage is lacking).

---

## 2026-05-02 — Overnight Audit (twentieth pass)

Branch: `claude/dreamy-mccarthy-WJaAU`.
Baseline on entry: **440 passing, 0 failing**.
Exit state: **484 passing, 0 failing** (+44 tests).

### Architecture summary (unchanged)

Stack, store split, and engine layering match all prior audits. No
architectural drift since the nineteenth pass. All previous PRs (#27–#63)
merged into this branch.

### What appears strong and well-designed (unchanged)

- 484-test suite now covering engine, stores, adaptation, lib, CSV,
  recommendation, session summary, and planStore.
- All prior bug fixes from passes 1–19 remain stable; no regressions.
- `exerciseHistoryStore` has been accumulating data since pass 6 and is now
  read for the first time in TodayPage for PB detection.

### Key issues found this pass

1. **Cycle/week progress text shown when plan is expired** (UX noise).
   The subtitle showed "3/6 done" and "rotation complete!" alongside the
   purple "Plan complete!" banner. Redundant and contradictory. Fixed with
   `!planExpired` guard on both rotation cycle spans. The weeks-plan span
   was already guarded by `completed < total`.

2. **`findPreviousSessionForPlanDay` + `buildLastSessionSummary` untested**
   (TEST GAP — carry-over from pass 18). Both helpers were pure functions
   inlined in TodayPage with zero test coverage. Extracted to
   `src/lib/sessionSummary.ts` and covered with 21 tests.

3. **`planStore.setActivePlan` / `duplicatePlan` (and other actions) untested**
   (TEST GAP — carry-over from pass 17). Created `planStore.test.ts` with
   22 tests covering all six public store actions.

4. **`planDeleteCleanup.test.ts` did not assert `clearExerciseHistory`**
   (TEST GAP). The PlansPage delete handler calls `clearByPlanId` on
   `exerciseHistoryStore` as step four, but this was never verified in the
   integration test. Added import, `beforeEach` reset, and one new test.

### Feature selected: PB detection in session hint

Extended `buildLastSessionSummary` to append " · PB" when the previous
session's displayed load equals the user's all-time max for that exercise.
Uses `exerciseHistoryStore.records` (first TodayPage subscription) via a
single `useMemo`. Fully tested (3 additional tests in `sessionSummary.test.ts`).

See FEATURE_PROPOSAL.md and FEATURE_REVIEW.md for full rationale.

### Prioritized plan

| Priority | Item | Risk | Status |
|----------|------|------|--------|
| 1 | Suppress cycle/week progress when expired | None | ✅ Done |
| 2 | Extract session summary helpers to lib | None | ✅ Done |
| 3 | Tests for session summary helpers | None | ✅ Done |
| 4 | `planStore.test.ts` (22 tests) | None | ✅ Done |
| 5 | `planDeleteCleanup` exerciseHistory coverage | None | ✅ Done |
| 6 | PB detection feature | Low | ✅ Done |

### Rationale for sequencing

Test gap first (directly verifies the store the feature depends on), then fix
the implementation bug, then commit the feature with clean tests and types.

---

## Pass 21 — 2026-05-04 (branch `claude/dreamy-mccarthy-sA0Ai`)

### Observations on entry

- Baseline: **469 passing, 0 failing** (after node_modules install on fresh env).
- `getResolvedDaysRange` — despite being the core calendar-range resolver used
  by `CalendarPage` — had **zero tests** (pass 18 added 6 `buildMonthGrid` tests
  to `calendarProjection.test.ts` but didn't test `getResolvedDaysRange` itself).
- `isPlanExpired` had a silent bug: a rotations-based plan with `duration.value === 0`
  would always return `true` (`Math.floor(n / days) >= 0` is always true), triggering
  a "Plan complete!" banner immediately. `computePlanProgress` already guards against
  `total <= 0`; `isPlanExpired` did not.
- Exercise history orphan bug in backdate paths: when backdating a workout to a
  date that already had a complete entry with weights data, the old outcome's
  `exerciseHistoryStore` records were not cleaned up if the new outcome had no
  weights data. `setOutcome → syncExerciseHistory` only syncs the new outcome,
  leaving old records orphaned.
- No obvious regressions from pass 20.

### Decisions

- **Add `getResolvedDaysRange` tests** — highest priority test gap, critical calendar logic.
- **Fix `isPlanExpired` zero-value bug** — confirmed silent bug, one-line fix.
- **Fix exercise history orphaning** — data integrity fix in both backdate paths.
- **Feature: session count indicator on today's card** — adjacent, narrow, uses existing data.

### Prioritized plan

| Priority | Item | Risk | Status |
|----------|------|-------|--------|
| 1 | Add `getResolvedDaysRange` tests (17 tests) | None | ✅ Done |
| 2 | Fix `isPlanExpired` for `value <= 0` | Very low | ✅ Done |
| 3 | Fix exercise history orphaning on backdate | Low | ✅ Done |
| 4 | Session count indicator on today's card | Low | ✅ Done |

### Exit state

**493 passing, 0 failing** (+24 tests from baseline).

### Carry-over open items

- Plan builder UI should validate `duration.value > 0` (no crash, just bad UX)
- Narrow Zustand selectors in CalendarPage (performance, not urgent)
- Document progression system migration path (legacy RunProgressionState vs new ProgressionRecommendation)
- Expression evaluator should surface errors to UI for malformed progression rules

---

## Pass 23 — 2026-05-06 (branch `claude/dreamy-mccarthy-9Dgx6`)

### Observations on entry

- Baseline: **548 passing, 0 failing** (after `npm install` on fresh env).
- `buildLastSessionSummary` had no tests for the edge case where
  `weightsActual.exercises` is an empty array or where all sets have `null`
  reps AND `null` load. Both paths are handled correctly by the implementation
  (the `Array.find` returns `undefined` and the code falls through), but
  without tests these are unguarded regression surfaces.
- TodayPage shows aggregate stats (streak, 7-day count, total) but no
  day-by-day activity visualization. Users must navigate to Calendar to see
  which specific days they completed. A 7-day activity strip would provide
  immediate at-a-glance context with no new data dependencies.
- The streak counter resets to 0 each morning until the user logs today's
  workout. Technically correct per spec ("consecutive days ending at today
  inclusive") but creates jarring UX where a 30-day streak appears to vanish
  every morning. Documented as a recommendation; not changed (product decision).

### Decisions

- **Add edge case tests for `buildLastSessionSummary`** — 4 tests: empty
  exercises array, all-null sets, fallthrough to run data when weights has no
  actual data, and explicit null return confirmation.
- **Implement WeeklyActivityStrip feature** — 7-dot visualization of the last
  7 days on TodayPage. Each dot colored by status: complete = emerald, day_off
  = amber, skip = slate ring, extra-only = sky, empty = subtle ring. Today's
  dot has a ring highlight. No new store subscriptions, no new utilities —
  derived purely from `planEntries` and `planExtras` already in scope.

### Prioritized plan

| Priority | Item | Risk | Status |
|----------|------|------|--------|
| 1 | Edge case tests for buildLastSessionSummary (4 tests) | None | ✅ Done |
| 2 | WeeklyActivityStrip feature on TodayPage | Low | ✅ Done |

### Exit state

**551 passing, 0 failing** (+3 net tests from baseline).

### Carry-over open items

- Streak display is "strict" (0 until today is logged); product decision —
  recommend evaluating a grace-period or "pending" streak display.
- Plan builder UI should validate `duration.value > 0` (no crash, just bad UX)
- Narrow Zustand selectors in CalendarPage (performance, not urgent)
- Document progression system migration path (legacy RunProgressionState vs new ProgressionRecommendation)
- Expression evaluator should surface errors to UI for malformed progression rules

---

## Pass 24 — 2026-05-07 (branch `claude/dreamy-mccarthy-Q6elc`)

### Observations on entry

- Baseline: **551 passing, 0 failing** (after `npm install` on fresh env).
- `src/modules/workout-outcomes/progression.ts` — `buildProgressionRecommendation`
  has **zero tests** despite being core business logic surfaced to users after every
  logged workout. This was the highest-priority test gap.
- **`buildWeightsRecommendation` allCompleted logic bug**: for `mode === 'single'`,
  the function filters sets to `completedSets = sets.filter(s => s.completed)` then
  checks `allCompleted = completedSets.every(s => s.completed)`. Since `completedSets`
  only contains already-completed sets, `every(s => s.completed)` is trivially `true`.
  This means single-mode always returns 'progress' when there are any completed sets,
  even if the user failed half their sets. The 'hold' recommendation path was dead code.
- `src/modules/workout-outcomes/types.ts` utilities (`completionStateToAction`,
  `derivePaceSecondsPerMile`, `formatPace`, `formatSwimPace`) have no tests.
- `buildLastSessionSummary` renders `actualDistanceMiles` as raw float (e.g. `3.14159`
  would display "3.14159 mi"). No existing test caught this because all test values
  (`3.1`, `5`, `4`) happen to be clean representations. Defensive rounding adds
  correctness for any precision float that could arrive from GPS imports or
  copy-paste from external sources.

### Architecture summary (unchanged)

Stack, store split, and engine layering match all prior audits. No architectural
drift since pass 23. All previous PRs (#27–#78) merged.

### Key issues found this pass

1. **`buildWeightsRecommendation` — `allCompleted` trivially true** (LOGIC BUG).
   See observations above. Fix: compute `allCompleted` from the full unfiltered set
   list rather than the already-filtered `completedSets`. Impact: single-mode plans
   now correctly return 'hold' (with "repeat current load" note) when a user only
   partially completes their sets, and 'progress' only when all sets are finished.

2. **`buildProgressionRecommendation` has zero tests** (TEST GAP). Core business
   logic — determines the "what to do next" hint shown after every logged workout.
   Added a comprehensive test suite covering all slot types, all action outcomes,
   and edge cases.

3. **`workout-outcomes/types.ts` utilities untested** (TEST GAP). `completionStateToAction`,
   `derivePaceSecondsPerMile`, `formatPace`, `formatSwimPace`, and `deriveSwimPaceSecondsPer100m`
   have no tests. These feed pace display and history labeling throughout the app.

4. **`buildLastSessionSummary` raw float display** (DISPLAY BUG). Round
   `actualDistanceMiles` to 1 decimal before string interpolation.

### Feature selected: pace display in run session summary

When `averagePaceSecondsPerMile` is present in `RunWorkoutActual`, append
the formatted pace to the "Last session" hint on TodayPage (e.g.,
"Last: 3.1 mi · 28 min · 9:02 /mi"). This field is already captured in
`OutcomeModal` and stored in `RunWorkoutActual`; it was silently discarded
in the display layer. Uses the existing `formatPace` utility.

See FEATURE_PROPOSAL.md for full rationale.

### Prioritized plan

| Priority | Item | Risk | Status |
|----------|------|------|--------|
| 1 | Fix `buildWeightsRecommendation` allCompleted bug | Low | ✅ Done |
| 2 | Add `buildProgressionRecommendation` test suite | None | ✅ Done |
| 3 | Add `workout-outcomes/types.ts` utility tests | None | ✅ Done |
| 4 | Fix `buildLastSessionSummary` run distance rounding | Very low | ✅ Done |
| 5 | Pace display in run session summary (feature) | Low | ✅ Done |

### Rationale for sequencing

Bug fix first (1), then tests that confirm the fix and add baseline coverage (2–3),
then the display fix that affects the same file as the feature (4), then the feature
itself (5) on a clean test-covered foundation.

### Carry-over open items

- Streak display is "strict" (0 until today is logged); product decision —
  recommend evaluating a grace-period or "pending" streak display.
- Plan builder UI should validate `duration.value > 0` (no crash, just bad UX)
- Narrow Zustand selectors in CalendarPage (performance, not urgent)
- Document progression system migration path (legacy RunProgressionState vs new ProgressionRecommendation)
- Expression evaluator should surface errors to UI for malformed progression rules
- `derivePaceSecondsPerMile` is not called by `buildLastSessionSummary` — if
  `averagePaceSecondsPerMile` is absent but distance + duration are both present,
  pace could be derived automatically. Deferred as a product decision.

---

## Pass 25 — 2026-05-11 (branch `claude/dreamy-mccarthy-3SEA4`)

### Observations on entry

- Baseline: **609 passing, 0 failing** (after `npm install` on fresh env).
- REVIEW_NOTES from pass 24 flagged `averagePaceSecondsPerMile` as "probably keep
  but tweak": add a `> 0` guard to prevent "0:00 /mi" if the field is accidentally
  stored as 0. Simple defensive guard, deferred from pass 24.
- REVIEW_NOTES from pass 24 also flagged swim pace as "ready to implement when
  desired" — `averagePaceSecondsPer100m` is captured in `SwimWorkoutActual` and
  `formatSwimPace` exists and is tested (added pass 24), but was never surfaced in
  the session summary hint. Mirrors the run pace feature added in pass 24.
- No new bugs or regressions found in the core engine, stores, or test suite.

### Architecture summary (unchanged)

Stack, store split, and engine layering match all prior audits. No architectural
drift since pass 24. All previous PRs (#27–#91) merged into this branch.

### What appears strong and well-designed (unchanged)

- 609-test suite stable across 24 prior passes; no regressions.
- Pure-function rotation engine with thorough coverage.
- Clean store isolation: historyStore, outcomeStore, planStore, programStore.
- `buildLastSessionSummary` and `findPreviousSessionForPlanDay` are well-extracted,
  fully-tested pure functions in `src/lib/sessionSummary.ts`.

### Key issues found this pass

1. **`averagePaceSecondsPerMile === 0` could produce "0:00 /mi" in the hint** (DISPLAY BUG).
   The existing null guard `!= null` passes through a value of `0`, which `formatPace`
   would render as "0:00 /mi". While 0 is not a realistic pace, defensive data handling
   is correct. Closed the "probably keep but tweak" item from pass 24 REVIEW_NOTES.

2. **Swim pace not shown in session summary** (FEATURE GAP — from pass 24 carry-over).
   `averagePaceSecondsPer100m` is captured in `OutcomeModal` and stored in
   `SwimWorkoutActual`, but was never surfaced in `buildLastSessionSummary`. The exact
   same pattern as run pace (added pass 24) was straightforward to apply. Same `> 0`
   guard applied for consistency.

### Decisions

- **Fix run pace `> 0` guard** — 1-line change, closes carry-over item.
- **Add swim pace to session hint** — 1-line change, mirrors run pace pattern, 0 new
  store dependencies.
- **Do NOT auto-derive pace** from distance + duration when stored pace is null — kept
  as deferred product decision per pass 24 notes. Swim pace auto-derive similarly deferred.

### Prioritized plan

| Priority | Item | Risk | Status |
|----------|------|------|--------|
| 1 | Fix run pace `> 0` guard + test | None | ✅ Done |
| 2 | Add swim pace to session hint + tests | None | ✅ Done |

### Rationale for sequencing

Both changes are in the same function and test file; batched into one commit for
reviewability. Bug fix first (item 1), feature additive on top (item 2).

### Exit state

**613 passing, 0 failing** (+4 tests from baseline).

### Carry-over open items

- Streak display is "strict" (0 until today is logged); product decision.
- Plan builder UI should validate `duration.value > 0` (no crash, just bad UX).
- Narrow Zustand selectors in CalendarPage (performance, not urgent).
- Document progression system migration path.
- Expression evaluator should surface errors to UI for malformed progression rules.
- Auto-derive run pace from distance + duration when `averagePaceSecondsPerMile` is
  null — deferred as product decision.
- Auto-derive swim pace from distance + duration — deferred, same rationale.
