# Overnight Changelog

## 2026-05-24 (thirty-eighth pass) — branch `claude/dreamy-mccarthy-oaS1e`

Baseline on entry: **734 passing, 0 failing**. Exit state: **738 passing, 0 failing** (+4 tests).

---

### Change 1 — fix: deferred outcomes no longer fire YAML progression rules

**Summary:** `logOutcomeWithProgression` in `outcomeStore.ts` now excludes
`deferred` from the `session_complete` context variable alongside `skipped` and
`planned`. Previously, deferring a workout (which the history engine maps to a
`day_off` action — no workout performed) would still evaluate progression rules
that check `if: session_complete`, causing variable increments (e.g., `load += 5`)
to fire without any actual workout being completed.

**Why it matters:** YAML-imported plans use progression rules such as
`if: session_complete then load += 2.5` to auto-advance per-exercise load across
sessions. If a `deferred` outcome fires those rules, the user's program variables
drift forward without any work being done — the next session would start with a
higher target weight than warranted. This is a silent data corruption bug with no
runtime error or user-visible warning.

**Files changed:**
- `src/store/outcomeStore.ts` — one-line fix adding `!== 'deferred'` guard
- `src/store/__tests__/outcomeStore.test.ts` — 3 new tests (deferred, completed, skipped)

**Risks / tradeoffs:** The only behavior change is that deferred outcomes no longer
advance YAML progression variables. Users who have already had deferred outcomes
fire their progression rules will not see a rollback of those variables (persisted
state is not retroactively corrected — that would require a migration). New defer
events after this commit are correctly excluded.

**Rollback:** Remove `outcome.completionState !== 'deferred'` from the `session_complete`
expression in `logOutcomeWithProgression`.

---

### Change 2 — fix: deep-clone DrillSpec[] within RunSegment.drills on plan duplication

**Summary:** `deepCloneWorkoutSlot` in `planStore.ts` now maps `s.drills` within
each run segment so that drill objects are independent between the original and
the duplicated plan. Previously `segments.map(s => ({ ...s }))` shallow-cloned
each segment, leaving the `drills` array (and its `DrillSpec` objects) shared.

**Why it matters:** Pass 37's REVIEW_NOTES explicitly called this out as a remaining
recommendation. The same category of bug was fixed for `SetSpec[]` in pass 37 (for
`exercises`/`warmup`) and for top-level `exercises`/`warmup`/`segments` arrays in
pass 34. `RunSegment.drills` was the last remaining shallow-clone gap in the
`duplicatePlan` path. Editing drill names, reps, or sets in one plan after duplication
would silently mutate the other plan's drill specs.

**Files changed:**
- `src/store/planStore.ts` — 4 lines changed in `deepCloneWorkoutSlot` segment mapper
- `src/store/__tests__/planStore.test.ts` — 1 new test for DrillSpec[] isolation

**Risks / tradeoffs:** The only behavior change is that `duplicatePlan` for plans with
run segments containing drills now does an extra `map` over `s.drills`. Drill arrays are
small (typically 2–8 entries) so the performance impact is negligible. Plans without run
drills are unaffected by the `s.drills ?` guard.

**Rollback:** Revert the segment mapper in `deepCloneWorkoutSlot` back to
`segments: slot.segments.map(s => ({ ...s }))`.

---

### Change 3 — fix: nanoid import path in exerciseHistoryStore

**Summary:** `exerciseHistoryStore.ts` imported `nanoid` from
`../engine/rotationEngine` (which re-exports it). Changed to import directly
from `../lib/utils` where `nanoid` is defined.

**Why it matters:** The transitive import creates an unnecessary dependency between
`exerciseHistoryStore` and the rotation engine. If `rotationEngine.ts` ever stops
re-exporting `nanoid` (e.g., during a future refactor), `exerciseHistoryStore` would
silently break. The direct import is self-documenting and correct.

**Files changed:**
- `src/store/exerciseHistoryStore.ts` — 1 import line changed

**Risks / tradeoffs:** Zero behavior change. Same function, same module — different
import path.

**Rollback:** Revert the single import line.

---

### Change 4 — feat: surface progressionRecommendation.note in TodayPage pending hint

**Summary:** The previous-session hint block on TodayPage now shows a `↗ [note]`
line when the prior session's outcome carries a `progressionRecommendation.note`
(e.g., "add 2.5 lb next session"). This is shown only for non-run slots — run slots
already have `todayAdaptationNote` from the run progression state machine and
showing both would be redundant. Only visible when the today card is pending
(`prevSessionOutcome` is computed only when `isPending`).

**Why it matters:** `progressionRecommendation.note` was being computed and stored
in outcomes (by `buildProgressionRecommendation` in the weights progression module)
but never surfaced at decision time. Users who had logged a session that generated a
progression recommendation had to open the outcome modal to see it. Surfacing it
inline at the moment the user is about to start their workout closes the loop —
the guidance appears exactly when it's actionable.

**Files changed:**
- `src/pages/TodayPage.tsx` — 4 lines added: conditional in the `&&` guard, new `<p>` element

**Risks / tradeoffs:** Purely additive. `prevSessionOutcome` is already computed and
`progressionRecommendation` is an optional field — if absent, the guard short-circuits.
No new store subscriptions, no new computation, no risk to users without outcomes.
The `!todayRunSlot` guard ensures run days are unaffected.

**Rollback:** Remove the `!todayRunSlot && prevSessionOutcome?.progressionRecommendation?.note`
condition from the outer `&&` and remove the `<p>` element inside the hint block.

---

## 2026-05-23 (thirty-seventh pass) — branch `claude/dreamy-mccarthy-79X8Y`

Baseline on entry: **732 passing, 0 failing**. Exit state: **734 passing, 0 failing** (+2 tests).

---

### Change 1 — fix: deep-clone SetSpec[] within exercises and warmup on plan duplication

**Summary:** `deepCloneWorkoutSlot` in `planStore.ts` now deep-clones the `sets`
field within each `ExerciseSpec` when it is an array of `SetSpec` objects. Previously,
duplicating a plan produced exercise specs that shared the same `SetSpec` array objects
between the original and the copy, meaning a future edit to one plan's set data would
silently corrupt the other.

**Why it matters:** Pass 34 fixed the top-level `exercises` / `warmup` / `segments`
array references, but missed one nesting level: each `ExerciseSpec.sets` when it is
a `SetSpec[]` (structured sets from YAML import). The bug would manifest if a user
duplicated a YAML-imported plan and then edited per-set details (rep count, load,
rest time) in one plan — the other plan's sets would change too without any user action.
This is a silent data corruption risk with no runtime error.

**Files changed:**
- `src/store/planStore.ts` — added `deepCloneExerciseSpec` helper (10 lines); updated
  `deepCloneWorkoutSlot` to use it for both `exercises` and `warmup`
- `src/store/__tests__/planStore.test.ts` — 2 new tests for SetSpec[] isolation

**Risks / tradeoffs:** The only change to production behavior is that `duplicatePlan`
for plans with structured exercises will do one additional `map` over the sets array.
This is negligible (sets arrays are small). Existing plans without structured exercises
(i.e., manually-built plans or YAML imports where `sets` is a plain number) are
unaffected — the `Array.isArray(ex.sets)` guard is a no-op for non-array sets.

**Rollback:** Revert `planStore.ts` to the prior `slot.exercises.map(e => ({ ...e }))` form.

---

### Change 2 — fix: WeeklyActivityStrip uses newest entry when duplicates exist for a date

**Summary:** The 7-day activity strip used `Array.find()` to look up a history entry
for each day, which returns the first matching element regardless of recency. All other
parts of the engine (rotation pointer computation, today's status resolution) use the
newest `createdAt` when multiple entries exist for the same date. The strip is now
consistent with that behavior. Also wires `computePlanStreak` into the streak stat so
the semantic is explicit.

**Why it matters:** With the existing `find()`, if a date had two entries (e.g., one
created via CSV import and a newer one from the UI), the strip might color that dot
based on the stale imported entry rather than the most-recent user action. In practice
this is rare (deduplication runs on addEntry and importEntries), but the inconsistency
was a latent correctness gap. `computePlanStreak` was a recommendation from pass 25 and
is now used in the streak stat for clearer code intent.

**Files changed:**
- `src/pages/TodayPage.tsx` — 10 lines changed (4 for dedup fix, 6 for planStreak wiring)

**Risks / tradeoffs:** The `planStreak` value is semantically equivalent to the former
`stats.currentStreak` when `planEntries` is pre-filtered (as it is today), so displayed
numbers are unchanged. The dedup fix only affects users who have duplicate entries for the
same date, which is an edge case.

**Rollback:** Revert the `filter + reduce` block back to `find()` and restore
`stats.currentStreak`.

---

### Change 3 — fix: block saving a plan with duration value < 1 in Plan Builder

**Summary:** Both Save buttons in PlanBuilderPage are now disabled when `durationValue < 1`,
and an inline error message explains the constraint. The `handleSave` function also returns
early for this case. A red border on the duration input field signals the problem visually.

**Why it matters:** A `duration.value` of 0 causes `isPlanExpired()` to return `true`
immediately on the start date (weeks-type) or as soon as any entry exists
(rotations-type, since `Math.floor(0 / days.length) >= 0` is always true). This creates
a plan that appears fully complete before the user logs any workouts, showing a "Plan
complete!" banner immediately after activation. The UI input's `|| 1` guard already
prevents 0 from being set through the numeric field, but the YAML editor path
(`applyYamlChanges → setDurationValue`) bypasses it. This fix closes the gap at the
save boundary.

**Files changed:**
- `src/pages/PlanBuilderPage.tsx` — 7 lines changed

**Risks / tradeoffs:** Low risk. The guard only blocks save; it doesn't auto-correct the
value, preserving user awareness. The visual feedback (red border + error text) makes
the problem actionable. Users who set a valid value via YAML then later see this warning
know exactly what to fix.

**Rollback:** Remove the `durationValue < 1` checks from `handleSave` and the two `disabled`
expressions. Remove the red-border conditional and the error `<p>` element.

---

## 2026-05-22 (thirty-sixth pass) — branch `claude/dreamy-mccarthy-9sH8T`

Baseline on entry: **726 passing, 0 failing**. Exit state: **732 passing, 0 failing** (+6 tests).

---

### Change 1 — fix: importOutcomes syncs exercise history with plan/workout context

**Summary:** `outcomeStore.importOutcomes` now calls `syncExerciseHistory` for each
incoming outcome rather than calling `upsertFromOutcome` directly. This gives imported
exercise records the same `planName` and `workoutName` metadata that live-logged records carry.

**Why it matters:** After CSV import, the exercise history store receives weight data
but no plan or workout context (both fields are `null`). This affects how exercise records
appear in the history page stats and any future per-plan filtering. The live logging
path already resolved this context correctly — import was the only gap.

**Files changed:**
- `src/store/outcomeStore.ts` — one-line fix in `importOutcomes`
- `src/store/__tests__/outcomeStore.test.ts` — 6 new tests

**Risks / tradeoffs:** `syncExerciseHistory` looks up plan and workout name from the
current store state. If the plan has been deleted since the outcome was originally
created, `planName` will be `null` — same as today's behavior. No behavior change
for non-weights outcomes (no-op since the function returns early if there's no
`weightsActual.exercises`).

**Rollback:** Revert the single-line change back to `exStore.upsertFromOutcome(o)`.

---

### Change 2 — feat: confirm before bulk-marking unlogged days as Day Off

**Summary:** Added a confirmation modal before the "Mark N as Day Off" bulk action
in TodayPage. The modal lists the dates that will be affected and requires explicit
confirmation before calling `markDaysAsOff`.

**Why it matters:** Without a confirmation step, a single accidental tap on a mobile
screen could silently batch-mark up to 7 past days, affecting the rotation pointer
for all of them. The modal is non-destructive to add (it's purely gating an existing
action) and easy to dismiss.

**Files changed:**
- `src/pages/TodayPage.tsx` — ~30 lines added

**Rollback:** Remove `showCatchupConfirm` state and the `Modal` block; revert the
"Mark N as Day Off" button onClick to call `markDaysAsOff(plan.id, unloggedDates)` directly.
