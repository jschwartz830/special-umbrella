# Implementation Plan

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
