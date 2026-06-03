# Implementation Plan

## Pass 49 — 2026-06-03 (branch `claude/dreamy-mccarthy-yJLmG`)

### Observations on entry

- Baseline on entry: **788 passing, 0 failing** — clean exit state from pass 48.
- Pass 48 fixed `isPlanExpired` future-entry bug, added Calendar "Unlogged" legend item,
  extracted `outcomeSortKey` to shared lib, and wired `computeConsecutiveSkips` to TodayPage.
- Full codebase audit performed (fresh read of all key modules, stores, pages, and tests).

### Key findings

**Bug — `computePlanProgress` (rotations branch): no future-date guard** (`historyStats.ts:127`):
The `rotations` branch filters `entries` only by `planId` and `action`, but not by
`calendarDate <= today`. A future-dated entry (e.g. from a CSV import) would count toward
the rotation total, showing a higher `completed` value than reality. The `weeks` branch
correctly uses `today` (via `dateDiffDays`) but the rotations branch ignores it. The `today`
parameter is already in the signature — this is purely a missing guard in the filter.

**Bug — `computeRotationCycleProgress`: no future-date guard, no `today` parameter**
(`historyStats.ts:165`): Same class as `isPlanExpired` bug fixed in pass 48. The function
takes `plan` and `entries` but no `today`, so it has no way to exclude future-dated entries.
A future-dated `complete` or `skip` entry would shift `doneInCycle` and `justCompletedRotation`
incorrectly — potentially showing a "rotation complete!" banner when it shouldn't.

**Bug — `computeRotationPlanRemaining`: no future-date guard, no `today` parameter**
(`historyStats.ts:193`): Same class again. `done` counts all matching entries regardless of date.
A future-dated entry could show fewer workouts remaining than actually exist.

**Bug — `useActivePlan.ts:14`: stale `today` across midnight** (`hooks/useActivePlan.ts`):
Uses `format(new Date(), 'yyyy-MM-dd')` inline rather than `useToday()`. The `useToday()` hook
was created in pass 45 specifically to solve this class of bug (it auto-updates at midnight via
a `setTimeout`). Without it, `useActivePlan`'s `today` — which propagates to `todayResolved`
and `upcoming` memos — can be stale if nothing triggers a re-render after midnight.

**Bug — `HistoryPage.tsx:140` and `PlansPage.tsx:43`: same stale `today`** (`pages/`):
Both use `format(new Date(), 'yyyy-MM-dd')` as a local constant rather than `useToday()`.
Same root cause and risk as the `useActivePlan` bug above.

**Test gap — no future-date tests for the three stats functions** (`lib/__tests__/historyStats.test.ts`):
`computePlanProgress`, `computeRotationCycleProgress`, and `computeRotationPlanRemaining` lack
tests verifying that future-dated entries are excluded — the same gap that existed for
`isPlanExpired` before pass 48.

### Decisions

- **Fix `computePlanProgress` rotations future-date guard** (BUG, high confidence): Add
  `&& e.calendarDate <= today` to the rotations filter. One-line change + regression tests.

- **Fix `computeRotationCycleProgress` and `computeRotationPlanRemaining` future-date guard**
  (BUG, same class): Add `today: string` parameter to both functions, update their filters,
  and update callers in `TodayPage.tsx`. Add regression tests.

- **Fix `useActivePlan`, `HistoryPage`, and `PlansPage` stale `today`** (BUG, low risk):
  Replace `format(new Date(), ...)` with `useToday()` in all three files.

- **Feature: Plan progress bar on PlansPage** (FEATURE, low risk): Add a thin visual progress
  bar below the text progress metric already displayed on each plan card. Uses the already-computed
  `progress.percentComplete`. Purely additive JSX; no store changes.

### Not implemented (recommendations only)

- **Fix `computeWorkoutTypeBreakdown` multi-slot attribution**: Medium complexity; product decision
  needed (carried from pass 47).
- **`logForDate` day_off + jump interaction** (carried from pass 44): Still open.
- **`programVarsMap` subscription granularity** (carried from pass 44): Still open. Low impact.

### Architecture summary (unchanged from pass 48)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores:
`planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`. Rotation
logic is pure functions in `rotationEngine.ts`. Stats are pure utilities in `historyStats.ts`,
`sessionSummary.ts`, and `historyScope.ts`.

### Key strengths (unchanged)

- Pure-function rotation engine with 788 tests on entry; all passing.
- Expression evaluator handles YAML progression DSL safely (no `eval()`).
- Strong migration patterns in historyStore (v1) and planStore (v2).
- Consistent separation of engine / stores / modules / lib / UI layers.
- Comprehensive test coverage for all core business logic.

### Key risks (carried forward)

- `TodayPage.tsx` (~1,160 lines) and `CalendarPage.tsx` (~950 lines) are large; future
  refactors into smaller units would reduce cognitive load.
- `outcomeStore` has cross-store calls inside `logOutcomeWithProgression`; coupling makes
  unit-testing harder.
- `workoutInstanceId` parsing relies on nanoid never generating `_` — holds for the current
  base-36 charset but would silently break if the charset changes.

---

## Pass 48 — 2026-06-02 (branch `claude/dreamy-mccarthy-lm1Op`)

### Observations on entry

- Baseline on entry: **786 passing, 0 failing** — clean exit state from pass 47.
- Pass 47 added `computeConsecutiveSkips` (pure utility, not yet wired to UI) and 16 tests documenting known gaps.
- Full codebase audit resumed from pass 47 carry-forward list.

### Key findings

**Bug — `isPlanExpired` counts future-dated entries for rotations** (`rotationEngine.ts:251`):
The filter `e.planId === plan.id && (e.action === 'complete' || e.action === 'skip')` had no date guard. An imported or manually-entered `HistoryEntry` with `calendarDate > today` would be counted toward the rotation total, potentially triggering the "Plan complete!" banner while the plan still has future rotations to run. The `weeks`-duration branch correctly uses a date comparison and was unaffected.

**UX gap — Calendar legend missing `past_unlogged` entry** (`CalendarPage.tsx`):
Five legend items (Done, Pending, Upcoming, Day Off, Skipped) but the `past_unlogged` status (`bg-slate-800/20`) had no label, leaving users without a visual key for cells representing workouts missed without any logged action.

**Code duplication — `outcomeSortKey` defined locally in both pages**:
`TodayPage.tsx` (lines ~114–116) and `CalendarPage.tsx` (lines ~38–40) each had an identical local function. No shared utility existed; pass 46 noted this but deferred it.

**Deferred feature now tractable — `computeConsecutiveSkips` wiring**:
Pass 47 added the utility and 15 tests. The function is zero-risk to wire into TodayPage since it's pure and already tested.

### Decisions

- **Fix `isPlanExpired` future-entry bug** (BUG, high confidence): Add `&& e.calendarDate <= today` to the filter. Two new tests verify the fix.
- **Add "Unlogged" to Calendar legend** (UX FIX, trivial): Additive JSX change only.
- **Extract `outcomeSortKey` to shared lib** (REFACTOR, low risk): New file `src/lib/outcomeSortKey.ts`. Both pages updated to import from there.
- **Wire `computeConsecutiveSkips` to TodayPage** (FEATURE, low risk): Amber nudge banner after 3+ consecutive skips, with Calendar shortcut. Suppressed when plan is expired.

### Not implemented (recommendations only)

- **Fix `computeWorkoutTypeBreakdown` multi-slot attribution**: Medium complexity; product decision needed (single-slot behavior is fine for current use).
- **`logForDate` day_off + jump interaction** (carried from pass 44): Still open. Low occurrence probability.
- **`programVarsMap` subscription granularity** (carried from pass 44): Still open. Low impact.

### Architecture summary (unchanged from pass 47)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores: `planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`. Rotation logic is pure functions in `rotationEngine.ts`. Stats are pure utilities in `historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

### Key strengths (unchanged)

- Pure-function rotation engine with 788 tests on entry; all passing.
- Expression evaluator handles YAML progression DSL safely (no `eval()`).
- Strong migration patterns in historyStore (v1) and planStore (v2).
- Consistent separation of engine / stores / modules / lib / UI layers.

### Key risks (carried forward)

- `TodayPage.tsx` (~1,150 lines) and `CalendarPage.tsx` (~950 lines) are large; future refactors into smaller units would reduce cognitive load.
- `outcomeStore` has cross-store calls inside `logOutcomeWithProgression`; coupling makes unit-testing harder.
- `workoutInstanceId` parsing relies on nanoid never generating `_` — holds for the current base-36 charset but would silently break if the charset changes.

---

## Pass 47 — 2026-06-01 (branch `claude/dreamy-mccarthy-iQpbb`)

### Observations on entry

- Baseline on entry: **770 passing, 0 failing** — clean exit state from pass 46.
- Pass 46 fixed CalendarPage unstable sort, stale `now`, retroactive Day Off availability, and added outcome summary preview in DayDetailModal Level 1.
- Full codebase audit performed (fresh read of all key modules, stores, and tests).

### Key findings

**Documented limitation — `computeWorkoutTypeBreakdown` only attributes `slots[0]`** (`historyStats.ts:349`):
For rotation entries where a plan day has 2 slots (double workouts defined in the plan), only the first slot's `type` is counted in the workout-type breakdown stats. The second slot is silently unattributed. No test documents this behavior, so it could be mistaken for a bug.

**Documented design — `buildProgressionRecommendation` null-effort run/swim default** (`workout-outcomes/progression.ts:22`):
Run/swim progress check uses `outcome.perceivedEffort ?? 3`, defaulting to 3 when no effort is logged. This means: complete a run, log no effort → get a "progress" recommendation (3 ≤ 3 threshold). The high-effort regress check correctly uses `?? 0`. The asymmetry is intentional (conservative default promotes progress) but not documented via tests. Pass 40 added a swim null-effort test; no corresponding test existed for the "progress check default = 3" path directly.

**Test gap — `historyStore.updateEntryDate` caller contract** (`historyStore.ts:249`):
`updateEntryDate` mutates `calendarDate` in-place without deduplication. If a second entry already exists at the target date, both will coexist until `computeCurrentDayIndex` resolves the conflict via `createdAt`. Callers must call `removeEntry` first. Correct callers already do this (TodayPage, CalendarPage). No test documents the "what happens when target date already has an entry" behavior.

**New feature — `computeConsecutiveSkips`**:
No function exists to count consecutive skip entries for a plan. This is useful for a "you've been skipping workouts" nudge in TodayPage. The data is already available in `historyStore.entries`; only the aggregation function is missing. Adding to `historyStats.ts` as a pure utility keeps it testable and consistent with the existing stat API.

### Decisions

- **Test: `computeWorkoutTypeBreakdown` multi-slot** (DOCUMENTATION): Add a test documenting that only `slots[0]` type is attributed. No code change to the function.
- **Test: `buildProgressionRecommendation` null-effort progress path** (DOCUMENTATION): Add tests covering the `perceivedEffort: null` → defaults-to-3 → progress path for run and swim slots with `completedAsPlanned: undefined`. Documents the intentional design.
- **Test: `historyStore.updateEntryDate` coexistence scenario** (DOCUMENTATION): Add a test showing that updating to a date that already has an entry does not remove the existing entry — documents the caller contract.
- **Feature: `computeConsecutiveSkips`** (FEATURE, low risk): New pure function in `historyStats.ts`. Counts consecutive skip-only days (complete or day_off breaks the streak) going backwards from yesterday. Exported and covered by tests. Not yet wired into any UI.

### Not implemented (recommendations only)

- **UI integration of `computeConsecutiveSkips` into TodayPage**: Add a nudge after 3+ consecutive skips ("You've skipped your last N workouts — still want to build the habit?"). Deferred: UI changes require browser testing, out of scope for this run.
- **Fix `computeWorkoutTypeBreakdown` to attribute all slots**: Would require callers to pass all slot types (not just `slots[0]`) or restructure the `planDaysById` map. Change is medium-complexity and the current behavior is acceptable for a personal tracker. Documenting.
- **`logForDate` day_off + jump interaction** (carried from pass 44): Still open. Low occurrence probability; deferred.
- **`programVarsMap` subscription granularity** (carried from pass 44): Still open. Low impact.

### Architecture summary (unchanged from pass 46)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores: `planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`. Rotation logic is pure functions in `rotationEngine.ts`. Stats are pure utilities in `historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

### Key strengths (unchanged)

- Pure-function rotation engine with 770 tests on entry; all passing.
- Expression evaluator handles YAML progression DSL safely (no `eval()`).
- Strong migration patterns in historyStore (v1) and planStore (v2).
- Consistent separation of engine / stores / modules / lib / UI layers.

### Key risks (carried forward)

- `TodayPage.tsx` (~1,150 lines) and `CalendarPage.tsx` (~950 lines) are large; future refactors into smaller units would reduce cognitive load.
- `outcomeStore` has cross-store calls inside `logOutcomeWithProgression`; coupling makes unit-testing harder.
- `workoutInstanceId` parsing relies on nanoid never generating `_` — holds for the current base-36 charset but would silently break if the charset changes.

---

## Pass 46 — 2026-05-31 (branch `claude/dreamy-mccarthy-N2mc1`)

### Observations on entry

- Baseline on entry: **770 passing, 0 failing** — clean exit state from pass 45.
- Pass 45 fixed two TodayPage bugs (unstable sort key, stale today date) and added the `useToday` hook. No new issues introduced.
- Deep audit of CalendarPage revealed the same sort-key bug that pass 45 fixed in TodayPage was never ported, plus two other issues.

### Key findings

**Bug — `CalendarPage.findPreviousSetsByExercise` uses unstable sort key** (`CalendarPage.tsx:257`):
Identical to the `findPreviousWeightsOutcome`/`findPreviousSetsByExercise` bug fixed in TodayPage (commit 18adf1f). CalendarPage's version sorts with `(b.completedAt ?? '').localeCompare(a.completedAt ?? '')`, producing non-deterministic ordering for outcomes without `completedAt`. Previous sets shown in CalendarPage's OutcomeModal may display data from an arbitrary session instead of the most recent one.

**Bug — `CalendarPage` stale `now` past midnight** (`CalendarPage.tsx:50`):
`const now = new Date()` is captured at component mount and never updated. If the user keeps CalendarPage open past midnight, `goToToday()` and the `isCurrentMonth` check use the stale date. Pass 45 added `useToday()` specifically to fix this class of issue; CalendarPage was not updated at the same time.

**UX inconsistency — Day Off not available for past dates in Calendar** (`CalendarPage.tsx:566`):
`canDayOff = isToday || isFuture` excluded past dates. TodayPage's "catch-up" flow can call `markDaysAsOff` for unlogged past days (confirmed by the DayDetailModal catch-up dialog). The Calendar's retroactive Day Off was the one entry point that couldn't do this, creating an inconsistency: users logging a missed day retroactively could only pick Complete or Skip, not Day Off.
