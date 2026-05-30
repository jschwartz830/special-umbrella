# Implementation Plan

## Pass 44 — 2026-05-30 (branch `claude/dreamy-mccarthy-abkoz`)

### Observations on entry

- Baseline on entry: **766 passing, 0 failing** — clean exit state from pass 43.
- Pass 43 fixed 6 failing progression tests and the `ExtraWorkoutEntry.source` pre-migration bug.
- Pass 42 fixed `deleteSet` stale timer, working set numbers, progression preview labels,
  `longestStreak` future entry inflation, and `duplicatePlan` name accumulation.

### New issues found this pass

**BUG 1 — `buildWeightsRecommendation` reads `mode` from the wrong exercise (MEDIUM)**

In `src/modules/workout-outcomes/progression.ts` line 103:
```js
const mode = exercises[0].progressionMode ?? 'single'
```

The guard at line 101 ensures at least one exercise has a non-null `progressionMode`, but
the mode is then read unconditionally from `exercises[0]`. If the first exercise lacks a
`progressionMode` (e.g. warmup sets, or a mixed multi-exercise session where only the main
lifts have progressionMode configured), the mode falls back to `'single'` even though the
actual progression mode is set on a later exercise.

Fix: read `mode` from the first exercise that has a non-null `progressionMode`.

**BUG 2 — `TYPE_MIX_LABEL` missing workout types in HistoryPage (MINOR)**

In `src/pages/HistoryPage.tsx`, `TYPE_MIX_LABEL` is defined as:
```js
const TYPE_MIX_LABEL: Partial<Record<WorkoutType, string>> = {
  weights: 'weights',
  run: 'runs',
  swim: 'swims',
  yoga: 'yoga',
  other: 'other',
}
```

Three valid `WorkoutType` values are missing: `long_run`, `recovery_run`, and `weightlifting`.
When users have workouts of these types, `TYPE_MIX_LABEL[t] ?? t` falls back to the raw type
string with underscores (e.g. `"long_run"` instead of `"long runs"`). This makes the training-mix
summary row display raw enum values in production.

Fix: add the three missing entries.

**UX GAP — No "Day Off" quick button on TodayPage (MEDIUM)**

`usePlanActions` exposes a `dayOff()` function, but TodayPage has no UI button that calls it.
The current quick controls are: "Start Workout", "Skip", and "Override" (which opens a modal
with advance/go_back/jump). To log today as a Day Off, the user must navigate to the Calendar
page and log from there — unnecessary friction for a common action (rest day, travel, etc.).

Fix: add a "Day Off" button in the pending controls row, parallel to "Skip". Only shown when
today is pending (same guard as Skip). Uses the existing `actions.dayOff()` and requires no
new state.

**TEST GAPS — Three untested edge cases**

1. `buildWeightsRecommendation` multi-exercise mode: no test covers the case where
   `exercises[0].progressionMode` is null but a later exercise has it — the bug scenario.
2. `computePlanStreak` with extras only and no rotation entries: streak should be counted
   from extras alone (this is in the spec but not directly tested).
3. `computeRotationCycleProgress` with a 1-day plan: the modular arithmetic for a single-day
   rotation is exercised only indirectly.

### Decisions

- **Fix Bug 1** (`progression.ts`): change `exercises[0].progressionMode ?? 'single'` to find
  the first exercise with a non-null `progressionMode`. Safe — the guard above already ensures
  at least one exists.
- **Fix Bug 2** (`HistoryPage.tsx`): add `long_run`, `recovery_run`, `weightlifting` to
  `TYPE_MIX_LABEL`. Pure cosmetic fix; no logic changes.
- **Add Day Off button** (`TodayPage.tsx`): add a "Day Off" button in the pending controls
  alongside "Skip". Calls `actions.dayOff()`. Uses existing `Coffee` icon already imported.
  Only shown when `isPending`. No new state or store methods required.
- **Add 3 targeted tests**: cover the above gaps in `progression.test.ts` and
  `historyStats.test.ts`.

### Risks

- Bug 1 fix: very low. Changes one line in `progression.ts`; the guard above still holds.
  Existing passing tests remain valid.
- Bug 2 fix: zero. Purely additive label-map entries.
- Day Off button: low. Mirrors the existing Skip button implementation exactly. The
  `dayOff()` action is already tested via `historyStore.test.ts`. UI addition is reversible.
- New tests: zero risk.

### Architecture summary (unchanged from pass 43)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores:
`planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`.
Rotation logic is a pure function in `rotationEngine.ts`. Stats are pure utilities in
`historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

### Key strengths (unchanged)

- Pure-function engine with comprehensive test coverage.
- All store mutations are well-guarded.
- Clean separation between engine, store, and UI layers.

### Key risks (carried forward)

- `TodayPage.tsx` (~1,115 lines) and `CalendarPage.tsx` (~950 lines) are large. Candidates
  for component extraction but risk is too high to do in a single overnight pass.
- `findPreviousSetsByExercise` is duplicated in both TodayPage and CalendarPage with slightly
  different semantics. Should be extracted to `sessionSummary.ts` with a shared interface,
  but the differences are subtle enough that this warrants careful review before merging.
- `workoutInstanceId` parsing relies on the nanoid charset never including `_`. Currently safe
  (base-36 charset), but would silently break if the charset changes. Consider an assertion
  in the generator.
- `outcomeStore` has cross-store calls inside `logOutcomeWithProgression`. Functional but makes
  isolated unit-testing harder.

---

## Pass 43 — 2026-05-29 (branch `claude/dreamy-mccarthy-4tAQK`)

### Observations on entry

- Baseline on entry: **758 passing, 0 failing** — clean exit state from pass 42.
- **6 failing tests in `progression.test.ts`**: PR #121 (`workout-progression-logic`)
  merged since pass 42 added two intentional behavior changes to
  `buildWeightsRecommendation`:
  1. A new guard returns `null` when no exercise has `progressionMode` set.
  2. Volume mode now uses `allSetsHitTarget` instead of always returning `hold`.
  Six tests were written against the old behavior and were failing as a result.
  These are test-correctness issues, not production bugs.
- **`ExtraWorkoutEntry.source` pre-migration risk**: Extras created before the
  `source` field was introduced have `source === undefined`. TodayPage's Undo
  handler treats `undefined` as `'double_day'`, which would silently remove
  manually-added extras on Undo. Recommended across passes 38–42; never
  implemented.

### Decisions

- **Fix 6 failing tests** (CORRECTNESS): Update `progression.test.ts` to match the
  new behavior. Add `progressionMode: 'single'` to exercises in four single-mode tests.
  Fix the volume mode test: update description and split into `progress` (all sets hit
  target) and `hold` (below target). Add `progressionMode: 'single'` to the weightlifting
  legacy type test. Add a new null-path test documenting the `progressionMode` guard.
  Net: 6 fixed + 2 new tests = 760.
- **Fix `ExtraWorkoutEntry.source` migration** (BUG): Add `version: 1` and a
  `migrate` function to `historyStore`'s persist config. Migration sets
  `source: 'history'` on all extras with `source === undefined` (v0 → v1). Extract as
  a named export `migrateHistoryState` so it can be unit-tested directly. 6 new tests.

### Risks

- Test fixes: zero risk — no production code changes.
- `source` migration: very low risk. The migration only touches `extraEntries` and
  only changes `undefined` → `'history'`. Existing extras with explicit source values
  are unchanged. Adding `version: 1` causes Zustand to re-run the migration for all
  existing users on first load — this is safe because the migration is idempotent and
  the persist key (`wpt_history`) is unchanged.

### Architecture summary (unchanged from pass 42)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores:
`planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`.
Rotation logic is a pure function in `rotationEngine.ts`. Stats are pure utilities in
`historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

### Key strengths (unchanged)

- Pure-function engine with 766 tests across 19 files on exit.
- All store mutations are well-guarded and tested.
- Clean separation between engine, store, and UI layers.

### Key risks (carried forward)

- `TodayPage.tsx` (~1,115 lines) and `CalendarPage.tsx` (~950 lines) are large.
- `workoutInstanceId` parsing relies on `nanoid` never generating `_` — holds for
  the custom charset in `lib/utils.ts` but would silently break if the charset changes.
- `outcomeStore` has cross-store calls inside `logOutcomeWithProgression`. Not broken,
  but the coupling makes unit-testing harder.

---

## Pass 42 — 2026-05-28 (branch `claude/dreamy-mccarthy-HtWcw`)

### Observations on entry

- Baseline: **748 passing, 0 failing** — clean baseline from pass 41 + user feedback merge.
- Pass 41 closed the ErrorBoundary and empty-date-save gaps. User feedback commit added swipe
  delete, start delay, timer drift fixes, rest timer +/-15 adjustment, and inline progression
  preview to `ActiveWorkoutTracker`.

**New issues found in user-feedback commit:**

1. **`deleteSet` stale active set timer**: Deleting a set while it was the active timer left
   `activeSetRef` and `activeSetTimer` pointing at a now-invalid index. The per-second interval
   would attempt to increment the deleted set's `setElapsedSeconds`, which may point to a
   different set after deletion (indices shift). Also, the active-set ref was never cleared when
   deleting a higher-indexed set that was after the active one (no index shift, but the UI could
   still show a stale timer state).

2. **Working set numbers included warmup indices**: With warmup sets at indices 0–N,
   working sets were labeled N+1, N+2, … instead of 1, 2, 3. This was a display bug in the
   set-number column that showed "3", "4", "5" for what should be "1", "2", "3".

3. **`getProgressionPreview` opaque labels**: "weights[1]: +5lb" doesn't tell the user what
   load the set is moving from or to. "135 → 140 lb" is far more informative.

**Pre-existing issues (not from the feedback commit):**

4. **`longestStreak` included future-dated entries**: `computeHistoryStats` built the streakable
   set from all entries without filtering to `<= today`. A CSV import with future dates would
   silently inflate the longest streak stat.

5. **`duplicatePlan` name accumulation**: Successive duplications produced "Plan (copy) (copy)
   (copy)". The fix strips any existing copy suffix and uses a numeric counter for collisions.

6. **`isoWeekStart` not directly tested**: The function was only exercised through
   `computeWeeklyBreakdown`. Direct cases (Monday, Sunday boundary, year boundary) were untested.

### Decisions

- **Fix `deleteSet` stale timer** (BUG): After filtering the sets array, also clear
  `activeSetRef` and `activeSetTimer` when the deleted set was active or had an index ≤ the
  active one. Risk: zero — purely protective.
- **Fix working set numbers** (CORRECTNESS): Compute `workingSetNumber` as the count of
  non-warmup sets up to and including `setIdx`, so warmup-present exercises show 1/2/3 not
  3/4/5 for working sets.
- **Improve `getProgressionPreview`** (UX): Replace "weights[N]: +Xlb" with "Set N: A → B lb"
  or collapse to "All sets: A → B lb" when all transitions are the same.
- **Fix `longestStreak`** (CORRECTNESS): Filter `sortedDates` to `<= today` before the
  longest-streak walk. One regression test added.
- **Fix `duplicatePlan` naming** (UX): Strip existing copy suffix, use numeric counter for
  collisions. Three new tests cover the new behavior.
- **Add `isoWeekStart` direct tests** (TEST): Six tests covering Monday, Wednesday, Saturday,
  Sunday, month boundary, and year boundary.

### Risks

- `deleteSet` fix: zero risk — only adds a guard on an already-broken path.
- Working set numbers: purely cosmetic; no data change.
- Progression preview: purely cosmetic display change.
- `longestStreak` filter: change in stat value only for users with future-dated entries (edge case).
- `duplicatePlan` naming: users with "(copy)" plans will see different copy names going forward.

---

## Pass 41 — 2026-05-27 (branch `claude/dreamy-mccarthy-9NxZ6`)

### Observations on entry

- Baseline: **748 passing, 0 failing** — clean baseline from pass 40.
- **No React Error Boundary exists in the component tree**: Any uncaught render or
  hook error causes the full UI to go blank (React 18 unmounts the tree). This has
  been a recurring recommendation across passes 36–40 but was never implemented.
- **`HistoryPage.saveAndClose` does not validate empty date**: When the user clears
  the date input and clicks Save, `editingEntryDate` is `''`. The empty string passes
  the conflict check (`'' !== oldDate` is true, but no existing entry has
  `calendarDate === ''`), so `updateEntryDate(id, '')` is called — corrupting the
  entry's `calendarDate` to `''`. Subsequent renders or lookups that use
  `calendarDate` as a key silently fail. Same structural gap in `saveAndCloseExtra`.
- **`computeCurrentDayIndex` targetDate < startDate has a test**: Test at line 203 of
  rotationEngine.test.ts was added in a prior pass — this item is already covered.

### Decisions

- **Add ErrorBoundary component** (IMPROVEMENT): Create
  `src/components/shared/ErrorBoundary.tsx` as a class component wrapping the full
  `<Routes>` tree in `App.tsx`. Renders a recovery UI with a "Try again" button that
  resets state. No behavior change on the happy path; prevents blank-screen crashes on
  errors. Risk: zero — purely additive.
- **Fix empty date guard in saveAndClose** (BUG): Add `if (!newDate) return` (with
  `setDateConflict(true)`) before the conflict check in `saveAndClose`. Mirror the
  same guard in `saveAndCloseExtra`. The error message shown when `dateConflict` is
  true now distinguishes empty vs. conflict. Risk: near-zero — only adds an early-exit
  guard before logic that was already unreachable safely.

### Risks

- ErrorBoundary: zero risk on happy path. Slight visual change on crash path (recovery
  UI instead of blank screen).
- Empty date guard: no behavior change for valid dates. Only affects the edge case
  where the user explicitly clears the date input before clicking Save.

## Pass 40 — 2026-05-26 (branch `claude/dreamy-mccarthy-8Sa0s`)

### Observations on entry

- Baseline: **743 passing, 0 failing** — clean baseline inherited from pass 39.
- **`planStore.setActivePlan` missing guard for non-existent ID**: If called with a plan ID
  not present in `state.plans`, the function would iterate all existing plans deactivating
  them, then write `updated[id] = { ...undefined, status: 'active', ... }` — spreading
  undefined produces an empty-ish object missing all required Plan fields. `activePlanId`
  would also be set to the invalid ID. This is a silent data corruption path reachable from
  any UI component that passes an unvalidated ID.
- **`buildProgressionRecommendation` null effort swim test missing**: Pass 39 had a run test
  for null `perceivedEffort` defaulting to 3 (progress threshold), but no symmetric swim test.
  The swim branch uses the identical `?? 3` pattern and was untested for this path.
- **History CSV export silently drops swim actuals**: `historyToCsv` only wrote run actuals
  (`actualDistanceMiles`, `actualDurationMin`, `averagePaceSecondsPerMile`, `averageHeartRate`,
  `completedAsPlanned`) to the CSV. The four swim fields (`actualDistanceMeters`,
  `actualDurationMin`, `averagePaceSecondsPer100m`, `completedAsPlanned`) were never exported.
  Users who swim and export/import CSV lose all swim actual data. The import parser also had
  no path to reconstruct `swimActual` from a row.

### Decisions

- **Fix `setActivePlan` guard** (BUG): Add `if (!(id in s.plans)) return s` at the top of
  the setter. No observable change for valid IDs. Prevents state corruption for invalid IDs.
  Risk: zero — strictly a guard on the existing code path.
- **Add swim null effort test** (TEST): One new test for the swim slot: `perceivedEffort: null`
  should resolve to `progress`. Mirrors the existing run test. No code change.
- **Add swim actuals to CSV** (FEATURE): Append four new columns to `HISTORY_HEADERS` after
  the existing run columns. Update both the rotation and extra row builders in `historyToCsv`.
  Update `buildOutcomeFromRow` to parse these columns into `swimActual`. Old CSVs without
  these columns parse as undefined → `swimActual` stays unset (backward compatible).

### Files changed

| File | Change type | Description |
|------|-------------|-------------|
| `src/store/planStore.ts` | fix | Guard `setActivePlan` against non-existent plan ID |
| `src/store/__tests__/planStore.test.ts` | test | Verify guard with `'nonexistent-id'` |
| `src/modules/workout-outcomes/__tests__/progression.test.ts` | test | Swim null effort → progress |
| `src/lib/csv.ts` | feat | Export + import swim actuals in history CSV |
| `src/lib/__tests__/csv.test.ts` | test | Swim actuals round-trip (rotation, extra, empty) |

---

## Pass 39 — 2026-05-25 (branch `claude/dreamy-mccarthy-0z9MJ`)

### Observations on entry

- Baseline: **738 passing, 0 failing** — clean baseline inherited from pass 38.
- **`nanoid` import coupling still present in `csv.ts` and `PlanBuilderPage.tsx`**: Pass 37
  fixed this in `exerciseHistoryStore.ts`, but two more files still imported `nanoid` via the
  rotationEngine re-export instead of directly from `lib/utils`. This is a coupling issue:
  a change to rotationEngine's public API could silently break these utilities.
- **`buildLastSessionSummary` "×undefined" display bug**: When a weights set has `actualReps = null`
  and no `targetReps` value (i.e., `targetReps` is `undefined`), the old ternary
  (`s.actualReps != null ? s.actualReps : s.targetReps`) passed `undefined` directly into the
  template string, producing "Last: 2×undefined @ 135 lb Squat". This surface-level display
  bug would appear for sets with load recorded but no rep count — a real data pattern when
  users log load-only (e.g. timed holds, isometric exercises).
- **No multi-exercise context in session hint**: `buildLastSessionSummary` only shows the first
  exercise from a multi-exercise workout. For programs with 3-6 lifts per session, the user only
  sees e.g. "Last: 3×5 @ 185 lb Squat" with no indication that Bench Press, Deadlift, and rows
  were also logged. Adding "+N more" provides context without changing the single-exercise case.

### Decisions

- **Fix `nanoid` import path in `csv.ts` and `PlanBuilderPage.tsx`** (COUPLING): Change both
  from `'../engine/rotationEngine'` to the canonical source. No behavior change — rotationEngine
  re-exports the same function.
- **Fix `buildLastSessionSummary` "×undefined"** (BUG): Replace the `!= null` ternary with
  nullish coalescing (`s.actualReps ?? s.targetReps ?? null`); when null, fall back to display
  format "N sets" rather than "N×undefined". New tests verify the null and fallback cases.
- **Add "+N more" multi-exercise context** (FEATURE): When more than one exercise in a workout
  has actual data logged, append "(+N more)" to the hint line. Only exercises with at least one
  actual reps or load value are counted, so placeholder/unlogged exercises are excluded.
  Single-exercise workouts are unchanged. New tests verify count, exclusion, and single-ex case.

### Architecture summary (unchanged from pass 38)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores:
`planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`.
Rotation logic is a pure function in `rotationEngine.ts`. Stats are pure utilities in
`historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

---

## Pass 38 — 2026-05-24 (branch `claude/dreamy-mccarthy-oaS1e`)

### Observations on entry

- Baseline: **734 passing, 0 failing** — clean baseline inherited from pass 37.
- **`deferred` completion state fired YAML progression rules**: `logOutcomeWithProgression`
  computes `session_complete` as `!== 'skipped' && !== 'planned'`. The `deferred` state
  maps to `day_off` in the history engine (no workout performed), but was not excluded from
  `session_complete`, so YAML progression rules with `if: 'session_complete'` would fire when
  a workout was deferred. This is a silent data corruption issue: variable increments (e.g.
  load progression) would apply incorrectly on defer rather than only on completion.
- **`RunSegment.drills` still shallow-cloned after pass 37**: Pass 37's REVIEW_NOTES
  documented `drills` within `RunSegment` as a remaining recommendation. Pass 37's fix
  addressed `SetSpec[]` inside `ExerciseSpec.sets`; the `DrillSpec[]` in `RunSegment.drills`
  was still only spread-cloned at the segment level, meaning drill objects were shared between
  the original and duplicated plan.
- **`nanoid` import path in `exerciseHistoryStore`**: The store imported `nanoid` from
  `../engine/rotationEngine` (which re-exports it from `lib/utils`). The import should come
  directly from `lib/utils` to reduce transitive coupling.
- **`progressionRecommendation.note` not surfaced before starting workout**: Outcome records
  carry a `progressionRecommendation.note` field (e.g., "add 2.5 lb next session") from the
  previous session. TodayPage already shows `lastSessionSummary` and `prevSessionOutcome.notes`
  for pending workouts, but the structured progression guidance was not surfaced at decision time.

### Decisions

- **Fix `deferred` in `session_complete`** (BUG): Add `outcome.completionState !== 'deferred'`
  to the `session_complete` guard in `logOutcomeWithProgression`. Three new tests confirm
  the behavior for deferred (no rule fire), completed (rule fires), and skipped (no rule fire).
- **Fix `RunSegment.drills` shallow clone** (DATA INTEGRITY): Extend `deepCloneWorkoutSlot`
  to map `s.drills` inside each segment mapper. Guard matches the existing patterns for
  `warmup`/`exercises`. One new test confirms drill object isolation after `duplicatePlan`.
- **Fix `nanoid` import path** (COUPLING): Change import source from `../engine/rotationEngine`
  to `../lib/utils` in `exerciseHistoryStore.ts`.
- **Fix misleading comment in `workoutInstanceId.ts`** (DOCS): Update the comment to reflect
  that the custom nanoid uses base-36 (no underscores) — the old comment incorrectly described
  nanoid's default alphabet.
- **Surface `progressionRecommendation.note` on TodayPage** (FEATURE): Add a `↗ [note]` line
  to the previous-session hint block for non-run slots. Guard: `!todayRunSlot` prevents
  double-surfacing run progression (which already has `todayAdaptationNote`). Visible only
  when `prevSessionOutcome?.progressionRecommendation?.note` is truthy.

### Architecture summary (unchanged from pass 37)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores:
`planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`.
Rotation logic is a pure function in `rotationEngine.ts`. Stats are pure utilities in
`historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

### Key strengths (unchanged)

- Pure-function engine with 738 tests across 19 files on exit.
- All store mutations are well-guarded and tested.
- Clean separation between engine, store, and UI layers.

### Key risks (carried forward)

- `TodayPage.tsx` (~1,115 lines) and `CalendarPage.tsx` (~950 lines) are large.
- `workoutInstanceId` parsing relies on `nanoid` never generating `_` — holds for
  the custom charset in `lib/utils.ts` but would silently break if the charset changes.
- `outcomeStore` has cross-store calls inside `logOutcomeWithProgression`. Not broken,
  but the coupling makes unit-testing the outcome store harder (requires mock setup for
  `useProgramStore`).

---

## Pass 37 — 2026-05-23 (branch `claude/dreamy-mccarthy-79X8Y`)

### Observations on entry

- Baseline: **732 passing, 0 failing** — clean baseline inherited from pass 36.
- **`deepCloneWorkoutSlot` shallow-clones `SetSpec[]` within `ExerciseSpec`**: When
  `exercises` (or `warmup`) contains a `SetSpec[]` for the `sets` field (vs. a plain
  integer), duplicating a plan produces exercise specs whose `sets` arrays are shared
  between the original and the copy. Mutating sets on one plan would silently affect
  the other. Pass 34 fixed the top-level `exercises` / `warmup` / `segments` array
  references but missed the one additional level of nesting inside each `ExerciseSpec`.
- **`WeeklyActivityStrip` uses `.find()` for entries**: The activity strip dot coloring
  relies on `planEntries.find(e => e.calendarDate === date)`. If multiple entries exist
  for a date (possible via bulk import or edge cases in the store), `find()` returns
  whichever entry appears first in the array—not necessarily the most recent one. All
  other places in the engine (computeCurrentDayIndex, getTodayResolvedDay) correctly
  prefer the newest `createdAt`. The strip was the only outlier.
- **`duration.value = 0` creates plans that expire immediately**: Plan Builder's UI
  input has an `|| 1` guard on `onChange`, but the YAML editor path bypasses it.
  Setting `value: 0` in YAML then applying produces a plan where `isPlanExpired()`
  returns true on the start date (weeks-type) or immediately (rotations-type). The
  Save buttons had no guard against this.
- **`computePlanStreak` never displayed**: Added in pass 25, this function computes
  the plan-scoped streak with correct semantics (filters by planId internally).
  TodayPage was computing an equivalent value via `computeHistoryStats` on pre-filtered
  arrays, but using `computePlanStreak` is more explicit about the intent.

### Decisions

- **Fix `deepCloneWorkoutSlot` for `SetSpec[]`** (BEHAVIOURAL BUG): Extract a
  `deepCloneExerciseSpec` helper that spreads the exercise spec and also maps its
  `sets` array when it is an array (not a plain number). Both `exercises` and `warmup`
  arrays now use this helper. Two new tests confirm per-set cloning.
- **Fix `WeeklyActivityStrip` dedup** (CORRECTNESS): Replace `find()` with the same
  newest-createdAt pattern used by the engine. Change is 4 lines; no logic elsewhere
  is affected.
- **Block saving `duration.value < 1`** (UX): Add inline error text and disable both
  Save buttons when `durationValue < 1`. The existing `handleSave` guard already
  checks `!name.trim()`; the new check is adjacent and follows the same pattern.
- **Wire `computePlanStreak` into streak stat** (SEMANTICS): Replace the
  `stats.currentStreak` reference in the streak stats card with `planStreak`, making
  the code intention explicit. Displayed value is identical since `planEntries` is
  pre-filtered, but future code that widens the entry set would behave correctly.

### Architecture summary (unchanged from pass 36)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores:
`planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`.
Rotation logic is a pure function in `rotationEngine.ts`. Stats are pure utilities in
`historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

### Key strengths (unchanged)

- Pure-function engine with 734 tests across 19 files on exit.
- All store mutations are well-guarded and tested.
- Clean separation between engine, store, and UI layers.

### Key risks (carried forward)

- `TodayPage.tsx` (~1,110 lines) and `CalendarPage.tsx` (~950 lines) are large.
- `workoutInstanceId` parsing relies on `nanoid` never generating `_` — holds for
  the custom charset in `lib/utils.ts` but would silently break if the charset changes.
- `outcomeStore` has cross-store calls inside `logOutcomeWithProgression`. Not broken,
  but the coupling makes unit-testing the outcome store harder.

---

## Pass 36 — 2026-05-22 (branch `claude/dreamy-mccarthy-9sH8T`)

### Observations on entry

- Baseline: **726 passing, 0 failing** — clean baseline inherited from pass 35.
- **`importOutcomes` dropped exercise history context**: After CSV import, exercise
  records in `exerciseHistoryStore` had `planName: null` and `workoutName: null`.
  Not a crash, but affects any UI that tries to filter or display records by name.
- **"Mark N as Day Off" had no confirmation**: A single accidental tap would batch-mark
  up to 7 past days without warning.
- No behavioral bugs in core logic.

### Decisions

- **Fix `importOutcomes` context** (DATA QUALITY): Route through `syncExerciseHistory`
  which already resolves plan/workout name from live store state.
- **Catchup confirmation modal** (UX): Add a confirmation step before bulk-marking.

---

## Pass 35 — 2026-05-21 (branch `claude/dreamy-mccarthy-w8aCb`)

### Observations on entry

- Baseline: **718 passing, 0 failing** — clean baseline inherited from pass 34.
- **Session count shown on upcoming cards**: The session-count hint was displayed
  on today's card only, not upcoming cards.
- **`markDaysAsOff` used multiple `set()` calls**: Each date called `addEntry()`
  individually, triggering N Zustand updates for N days.

### Decisions

- **Session count on upcoming cards** (UX): Pass `sessionCount` to upcoming `WorkoutDayCard`.
- **Batch `markDaysAsOff` into one `set()` call** (PERFORMANCE).
- **Robust `workoutInstanceId` parsing** (BUG FIX): Handle planIds that contain
  underscores by anchoring the date regex properly.

---

## Pass 34 — 2026-05-20 (branch `claude/dreamy-mccarthy-zGJFa`)

### Observations on entry

- Baseline: **708 passing, 0 failing** — clean baseline inherited from pass 33.
- **Shallow-clone bug in `deepCloneWorkoutSlot`** (top-level arrays only).
- **Gap weeks not visible in Weekly Activity panel**.

### Decisions

- **Fix `deepCloneWorkoutSlot`** for top-level `exercises`, `warmup`, `segments` arrays.
- **Feature: `padWeekGaps`** — fills ISO-week holes with zero-count placeholder rows.
