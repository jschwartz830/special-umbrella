# Review Notes — Overnight Audit

## 2026-05-29 (forty-third pass) — branch `claude/dreamy-mccarthy-4tAQK`

### Executive summary

1. **What changed:** Two targeted changes. (1) Fixed 6 failing tests in
   `progression.test.ts` that were left behind by PR #121 (workout progression
   logic improvements merged after pass 42). (2) Fixed a long-documented data
   risk: pre-existing `ExtraWorkoutEntry` records with `source: undefined` can
   be silently deleted by TodayPage's Undo — migrated them to `source: 'history'`.
2. **Highest confidence:** Both changes are purely protective. The test fixes are
   mechanical (add `progressionMode`, update expectations to match new behavior).
   The migration is a one-time store fix that only changes `undefined` → `'history'`
   — it cannot regress any existing functionality.
3. **Risks:** Near zero. The migration adds `version: 1` to `wpt_history` persist
   config; Zustand will re-run it on first load for all users. The migration is
   idempotent and handles all data shapes including missing fields.
4. **Review first:** The test changes confirm PR #121 behavior. Check that the new
   volume mode test (`progress` when all sets hit target) matches what you see in the
   app. Verify the null guard test ("returns null when no progressionMode") is
   intentional — if you want exercises without `progressionMode` to still generate a
   recommendation, that guard should be removed and the tests reverted accordingly.

---

### Biggest issues found

1. **6 failing tests in `progression.test.ts`** — PR #121 changed two behaviors:
   (a) `buildWeightsRecommendation` now returns `null` when no exercise has
   `progressionMode` set; (b) volume mode now uses `allSetsHitTarget` instead of
   always returning `hold`. Six tests written against the old behavior were failing.
   Fixed by adding `progressionMode: 'single'` where needed and updating volume mode
   expectations.

2. **`ExtraWorkoutEntry.source` migration gap** — Extras created before the `source`
   field was introduced have `source: undefined`. TodayPage's Undo handler treats
   `undefined` the same as `'double_day'`, silently removing manually-added extras.
   Recommended in REVIEW_NOTES across passes 38–42. Implemented as a v0→v1 migration
   in `historyStore`'s persist config.

---

### Improvements completed

| # | Type | Description | Files |
|---|------|-------------|-------|
| 1 | fix (tests) | Sync 6 failing progression tests with new behavior | progression.test.ts |
| 2 | fix (data safety) | Migrate `source: undefined` extras to `source: 'history'` | historyStore.ts + test |
| 3 | test | New null-guard test for `progressionMode` requirement | progression.test.ts |
| 4 | test | 6 direct `migrateHistoryState` tests | historyStore.test.ts |

Test count: **758 → 766** (+8).

---

### Definitely keep

- **Progression test fixes** — The 6 tests were genuinely wrong after PR #121. The
  fixes document the current intended behavior. Zero risk.
- **`source` migration** — Closes a known data-safety gap. The migration is idempotent,
  well-tested, and the correct semantic (old extras should not be Undo-deleted).

### Probably keep but tweak

- **`progressionMode` null-guard test** — This test documents that exercises without
  `progressionMode` produce no recommendation. If you decide the guard is too strict
  (you want a default 'single' recommendation even without explicit configuration),
  remove the guard from `progression.ts` and this test together.

### Do not keep

- Nothing in this pass.

---

### Recommendations only (not implemented)

1. **`computeHistoryStats` `totalLogged` future-date filtering**: `totalLogged` counts
   ALL entries regardless of date. A future-dated entry (e.g., from a bad CSV import)
   inflates this stat. Low priority since `last7Completed`/`last30Completed` already
   bound by `<= today` in their `inWindow` check, and `currentStreak` starts from `today`
   going backward.

2. **`ActiveWorkoutTracker` exercise-deletion stale ref**: Deleting an exercise (not a
   set) doesn't clear `activeSetRef` if it was pointing at the deleted exercise. The
   same pattern as the `deleteSet` fix in pass 42 applies here. Low urgency since the
   exercise-deletion path is not yet in the UI.

3. **Surface expression evaluator errors in ProgramImportPage** — Malformed YAML
   progression rules fail silently. Repeated recommendation; still unimplemented.

4. **`HistoryPage typeCountMap` vs `computeWorkoutTypeBreakdown`** — Duplication
   between HistoryPage's inline type-count logic and the shared utility. The shared
   utility also provides `avgEffort` per type, which is not surfaced anywhere.

---

### Open questions

1. **Is the `progressionMode` guard the intended behavior?** PR #121 says "Exercises
   with no progressionType/progress rule produce no indicator." Is this the right
   design? If you want a fallback recommendation even for exercises without explicit
   progression config, remove the guard in `buildWeightsRecommendation` line ~101.

2. **Should the volume mode test expectation (`progress` when all sets hit target)
   match your experience in the app?** With the new `allSetsHitTarget`, logging 3 sets
   all hitting their rep targets in volume mode should now show "↗ add volume next
   session" on the pending card.

---

### Known issues / incomplete work

- The `deferred` progression fix from pass 38 is forward-only. Historical progressions
  that fired while `deferred` are not corrected — still no retroactive recomputation.
- Pre-migration extras already on users' devices with `source: undefined` will be
  correctly migrated on first load after this deploy.

---

### Dependencies added

None.

---

## 2026-05-28 (forty-second pass) — branch `claude/dreamy-mccarthy-HtWcw`

### Executive summary

1. **What changed:** Four targeted fixes across `ActiveWorkoutTracker`, `historyStats`,
   and `planStore`. No new features — the user-feedback commit was recent enough that
   stabilizing it was higher priority than adding new capabilities.
2. **Highest confidence:** All four changes are strictly additive guards or one-line corrections.
   The `deleteSet` timer fix and the working set numbering fix address observable bugs in the
   active workout UI. The `longestStreak` filter and `duplicatePlan` naming fix address
   statistical and UX annoyances respectively.
3. **Risks:** Near zero across all four changes. The `longestStreak` change could reduce a
   displayed stat for users with future-dated entries; all others are invisible on the happy path.
4. **Review first:** Trigger the `deleteSet` path in the workout tracker with an active timer
   running, then swipe-delete that set — the timer should stop. Check a plan with warmup sets
   to confirm working set numbers show 1/2/3 not 3/4/5. Duplicate the same plan twice and
   verify the second copy gets "(copy 2)" not "(copy) (copy)".

---

### Biggest issues found

1. **`deleteSet` stale active set timer** — Deleting a set while its timer was running left
   `activeSetRef` pointing at an invalid index. The per-second interval would attempt to update
   a non-existent (or wrong) set on the next tick. Fixed by clearing `activeSetRef` and
   `activeSetTimer` whenever `deleteSet` is called for the active set or any set with a
   lower index.

2. **Working set numbers included warmup positions** — The set index column used raw `setIdx + 1`
   regardless of warmup rows. With 2 warmup sets, the first working set showed "3" instead of "1".
   Fixed by counting working-set position among working sets only.

3. **`getProgressionPreview` opaque format** — "weights[1]: +5lb" gives no context about current
   load or next target. Replaced with "Set 1: 135 → 140 lb" and "All sets: 135 → 140 lb"
   (collapsed when all sets share the same transition).

---

### Improvements completed

| # | Type | Description | Files |
|---|------|-------------|-------|
| 1 | fix (correctness) | `deleteSet` clears stale active set timer + working set numbering | ActiveWorkoutTracker.tsx |
| 2 | improvement (UX) | Progression preview shows load transition "X → Y lb" | ActiveWorkoutTracker.tsx |
| 3 | fix (correctness) | `longestStreak` excludes future-dated entries | historyStats.ts |
| 4 | fix (UX) | `duplicatePlan` avoids name accumulation, adds numeric counter | planStore.ts |
| 5 | test | Direct `isoWeekStart` test cases (6 new tests) | historyStats.test.ts |
| 6 | test | `longestStreak` future-date regression test | historyStats.test.ts |
| 7 | test | `duplicatePlan` naming behavior (3 new tests) | planStore.test.ts |

Test count: **748 → 758** (+10).

---

### Definitely keep

- **`deleteSet` stale timer fix** — Closes a real bug path. Zero risk.
- **Working set numbering** — Cosmetic correctness; no behavior change.
- **`longestStreak` future-date filter** — One line; makes the stat correct.
- **`duplicatePlan` naming** — Strictly more useful; existing "(copy)" plans unaffected.
- **`isoWeekStart` tests** — Direct coverage for a function used throughout weekly stats.

### Probably keep but tweak

- **Progression preview format** — "All sets: 135 → 140 lb" is much better than
  "weights[1]: +5lb". Could consider showing the exercise name in the header rather than
  per-set, but the current format is a clear improvement.

### Do not keep

- Nothing in this pass.

---

### Recommendations only (not implemented)

1. **`computeHistoryStats` future-date filtering for `totalLogged` / `last30`**: The same
   `<= today` filter should arguably apply to `last7Completed` and `last30Completed` windows —
   currently a future-dated entry would appear in those windows if the calendarDate falls in
   the window. Low likelihood; document for a future pass.

2. **`ExtraWorkoutEntry.source` migration**: Pre-migration extras with `source: undefined` are
   treated as `'double_day'` (removed on Undo). Users who added extras via History/Calendar
   before this field was introduced could have their extras removed by Undo. Consider a migration
   that sets `source: 'history'` on all extras with `source === undefined`. No urgency — only
   affects Undo behavior for old extras.

3. **CSV import post-parse validation**: Complex nested structures (exercises, segments)
   serialized as JSON within CSV cells have no structural validation after parse. A malformed
   import could persist invalid shapes. Low practical risk but worth noting.

4. **`ActiveWorkoutTracker` set-index stability after exercise deletion**: Deleting an exercise
   (not a set) doesn't clear `activeSetRef` either. If `activeSetRef.exIdx` pointed at the
   deleted exercise, the ticker could mismatch. Same pattern as the deleteSet fix, worth
   addressing in a future pass.

---

### Open questions

1. Should the progression preview show the **exercise name** (not "Set N") when an exercise
   has a single working set? E.g. "Squat: 135 → 140 lb" instead of "Set 1: 135 → 140 lb".

2. Should `longestStreak` be capped at today for `computePlanStreak` too? Currently only
   `computeHistoryStats.longestStreak` is fixed; `computePlanStreak` still includes future-dated
   extras if they exist.

---

### Known issues / incomplete work

- `deleteExercise` (not yet implemented — users can only replace exercises, not delete whole
  exercises from the tracker) would have the same stale-ref issue as `deleteSet`. If it's ever
  added, the same guard pattern applies.

---

### Dependencies added

None.

---

## 2026-05-27 (forty-first pass) — branch `claude/dreamy-mccarthy-9NxZ6`

### Executive summary

1. **What changed:** Added a React ErrorBoundary to prevent blank-screen crashes
   (recommended 5 consecutive passes, now implemented). Fixed a silent data
   corruption bug in `HistoryPage`: clearing the date input and clicking Save
   would corrupt `calendarDate` to `''`.
2. **Highest confidence:** ErrorBoundary is purely additive — no behavior on
   the happy path. Empty date guard is a one-liner early exit.
3. **Risks:** Near zero. Both changes are strictly protective.
4. **Review first:** Try editing a history entry, clearing the date field, and
   clicking Save — confirm the inline "Date is required." error appears and no
   data is written. To test ErrorBoundary: it can be exercised by temporarily
   throwing in a component, but the normal happy path is unaffected.

---

### Biggest issues found

1. **Missing ErrorBoundary** — recommended in passes 36–40, now implemented.
   React 18 unmounts the full tree on any uncaught render error, leaving a
   completely blank screen with no recovery path. The ErrorBoundary wraps
   `<Routes>` in `App.tsx` and renders a minimal recovery UI.

2. **`HistoryPage.saveAndClose` silent corruption on empty date** — If the user
   cleared the date input and clicked Save, `editingEntryDate` was `''`. The
   conflict check (`'' !== oldDate`) evaluated to true, `moveOutcome` was called
   with a malformed key, and `updateEntryDate(id, '')` set `calendarDate = ''`.
   Any subsequent lookup using `calendarDate` as a key would silently return
   nothing. The same gap existed in `saveAndCloseExtra` (silent no-op there due
   to absence of a conflict check, but `moveOutcome` + `updateExtraEntryDate`
   would be called with `''`).

---

### Improvements completed

| # | Type | Description | Files |
|---|------|-------------|-------|
| 1 | improvement | Add ErrorBoundary wrapping app root | ErrorBoundary.tsx (new), App.tsx |
| 2 | fix (correctness) | Guard empty date in HistoryPage edit modal | HistoryPage.tsx |

---

### Definitely keep

- **ErrorBoundary** — Purely additive. Prevents blank-screen UX on any future
  uncaught error. Zero risk.
- **Empty date guard** — Closes a silent data corruption path. Minimal change.
  Error message is user-visible and informative.

### Probably keep but tweak

- Nothing in this pass.

### Do not keep

- Nothing in this pass.

### Recommendations only (not implemented)

- **`typeCountMap` in HistoryPage vs `computeWorkoutTypeBreakdown`**: HistoryPage
  maintains a manually-computed `typeCountMap` useMemo that duplicates logic in
  `computeWorkoutTypeBreakdown`. The two differ in detail (typeCountMap uses
  flatItems; `computeWorkoutTypeBreakdown` takes raw entries + planDaysById Map).
  Unifying is medium complexity with moderate refactor risk — deferred to a future
  pass.
- **Surface expression evaluator errors in ProgramImportPage**: Malformed YAML
  progression rules fail silently (errors caught and swallowed in
  `evaluateExpression`/`evaluateCondition`). Surfacing these at import time would
  aid debugging of YAML programs. Medium complexity.

---

### Known issues or incomplete work

- None from this pass.

### Dependencies added

- None.

---

## 2026-05-26 (fortieth pass) — branch `claude/dreamy-mccarthy-8Sa0s`

### Executive summary

1. **What changed:** Fixed `setActivePlan` spreading `undefined` onto unknown plan IDs
   (silent data corruption). Added swim actuals export/import to history CSV (data loss fix
   for swim users). Added test coverage for the swim null-effort progression path.
2. **Highest confidence:** The `setActivePlan` guard is a one-line early return — no behavior
   change for valid IDs, unambiguously correct for invalid ones. The CSV swim columns are
   purely additive; backward compatibility is guaranteed by the existing header-based parser.
3. **Risks:** Near zero. All three changes are additive or protective. The CSV change extends
   the column count of every future export, which is invisible to users.
4. **Review first:** Export a history CSV for a plan with at least one logged swim workout.
   Verify that `swimActualDistanceMeters` (and the other swim columns) appear in the file with
   the correct values. Re-import that CSV and confirm `swimActual` is restored on the outcome.

---

### Biggest issues found

1. **`setActivePlan` silent corruption on unknown ID** — If called with a plan ID not in
   `state.plans`, the function would deactivate all existing active plans and then write
   `updated[id] = { ...undefined, status: 'active', ... }`. Spreading `undefined` is a no-op
   in JS, so the resulting object has only the four explicitly-assigned fields and none of the
   required Plan fields (`name`, `days`, `duration`, etc.). `activePlanId` is also set to the
   invalid ID. This is reachable from any component that calls `setActivePlan` without first
   validating that the ID exists (e.g., after a plan was deleted in another tab).

2. **Swim actuals silently dropped in CSV export** — `historyToCsv` only wrote run actuals
   to the CSV. The four swim fields were never included. `buildOutcomeFromRow` had no swim
   parsing path. Any swim user who exports CSV for backup and re-imports loses all swim
   performance data. This was a structural gap — the data model had `swimActual` since the
   swim feature was added, but the CSV layer never caught up.

---

### Improvements completed

| # | Type | Description | Files |
|---|------|-------------|-------|
| 1 | fix (correctness) | Guard `setActivePlan` against non-existent plan IDs | planStore.ts + test |
| 2 | test | Swim null `perceivedEffort` → `progress` in `buildProgressionRecommendation` | progression.test.ts |
| 3 | feat (data integrity) | Swim actuals in history CSV export + import | csv.ts + csv.test.ts |

---

### Definitely keep

- **`setActivePlan` guard** — Silent data corruption path closed. Zero risk. One-line fix.
- **Swim CSV actuals** — Correctness fix for swim users. Backward compatible. Well-tested.
- **Swim null effort test** — Symmetric coverage with the existing run test. No risk.

### Probably keep but tweak

- Nothing in this pass.

### Do not keep

- Nothing in this pass.

### Recommendations only (not implemented)

- **`computeCurrentDayIndex` targetDate < startDate edge case**: When `targetDate` is before
  `plan.startDate`, `differenceInCalendarDays` returns a negative number and the loop body
  never executes — the function returns `startDayIndex`. Reasonable behavior but has no
  dedicated test. Low risk to add a guard test.
- **`computeWorkoutTypeBreakdown` avgEffort not surfaced**: The function computes `avgEffort`
  per workout type and is well-tested, but HistoryPage uses a manually-computed `typeCountMap`
  instead. Replacing with `computeWorkoutTypeBreakdown` would reduce duplication and expose
  effort data per type.
- **CSV swim pace derivation on import**: If a swim row has distance + duration but no pace
  column, the pace is currently left undefined. Could derive `averagePaceSecondsPer100m` from
  the two present values, matching what the app does for run actuals.

---

### Open questions for me

- Is separating `completedAsPlanned` (run) and `swimCompletedAsPlanned` (swim) the right
  design? Could merge into a single `completedAsPlanned` column shared by both types, since
  each row has a single workout type. The current approach is more explicit and avoids any
  future ambiguity; the merged approach reduces columns. Either works — current choice is the
  more conservative one.

---

### Known issues or incomplete work

- None from this pass.

### Dependencies added

- None.

---

## 2026-05-25 (thirty-ninth pass) — branch `claude/dreamy-mccarthy-0z9MJ`

### Executive summary

1. **What changed:** Fixed two more stale `nanoid` import paths (csv.ts, PlanBuilderPage.tsx).
   Fixed `buildLastSessionSummary` producing "×undefined" when a set has no rep data. Added
   "+N more" exercise count hint for multi-exercise workouts.
2. **Highest confidence:** The `nanoid` import fix is purely mechanical — no behavior change.
   The "×undefined" fix is a clear display bug with a minimal, well-tested correction.
3. **Risks:** None significant. The "+N more" feature adds text to an existing hint string and
   is entirely additive — single-exercise workouts are unchanged.
4. **Review first:** Check TodayPage's pending workout hint for a weights day that logged
   multiple exercises in the prior session. Should now show "(+N more)". Verify the hint
   still looks correct for a single-exercise workout (no suffix expected).

---

### Biggest issues found

1. **`buildLastSessionSummary` "×undefined" display bug** — When a set records load but not
   reps (e.g. timed holds, isometric work, or load-only entries), `actualReps` is null and
   `targetReps` may be undefined. The old `!= null` ternary passed `undefined` directly into
   the template string, producing "Last: 2×undefined @ 135 lb Squat". Fixed.
2. **`nanoid` import coupling in csv.ts and PlanBuilderPage.tsx** — Pass 37 fixed this in
   exerciseHistoryStore but these two files were missed. Both now import directly from
   `lib/utils`. No behavior change, cleaner dependency graph.

---

### Improvements completed

| # | Type | Description | Files |
|---|------|-------------|-------|
| 1 | fix (coupling) | `nanoid` imports from canonical `lib/utils` in csv.ts + PlanBuilderPage | 2 |
| 2 | fix (bug) | "×undefined" → "N sets" fallback in `buildLastSessionSummary` | 1 |
| 3 | feat | "+N more" exercise count suffix for multi-exercise workout hints | 1 (+1 test) |

---

### Definitely keep

- All three changes. The `nanoid` fix is mechanical with no risk. The "×undefined" fix is
  clearly correct. The "+N more" feature is small, reversible, and improves UX for complex
  programs.

### Probably keep but tweak

- Nothing in this pass.

### Do not keep

- Nothing in this pass.

### Recommendations only (not implemented)

- **`computeWorkoutTypeBreakdown` avgEffort not surfaced**: The `computeWorkoutTypeBreakdown`
  function in `historyStats.ts` computes `avgEffort` per workout type and is well-tested, but
  this data is not used in HistoryPage (which uses a manually-computed `typeCountMap` instead).
  Replacing `typeCountMap` with `computeWorkoutTypeBreakdown` and showing avg effort alongside
  each type in the stats summary would be a natural next step.
- **`computeCurrentDayIndex` targetDate < startDate edge case**: When `targetDate` is before
  `plan.startDate`, `differenceInCalendarDays` returns a negative number and the loop body
  never executes — the function returns `startDayIndex`. This is reasonable behavior but
  has no dedicated test. Low risk to add a guard test.
- **HistoryPage `typeCountMap` vs `computeWorkoutTypeBreakdown`**: The HistoryPage computes
  a manual type count inline rather than using the shared `computeWorkoutTypeBreakdown` utility.
  Consolidating these would reduce duplication and expose `skipped` / `avgEffort` data.

---

### Open questions for me

- Is "N sets" (vs "N×undefined") the right fallback label for load-only sets? An alternative
  would be to omit the sets/reps segment entirely when no rep count is available, showing
  just "@ 135 lb Squat". Both are better than "×undefined"; this is a UX preference call.
- Is "+N more" the right level of verbosity for the session hint, or would you prefer just
  showing the number of exercises without the qualifier (e.g. "3 exercises" as the prefix)?

---

### Known issues or incomplete work

- None from this pass.

### Dependencies added

- None.

---

## 2026-05-24 (thirty-eighth pass) — branch `claude/dreamy-mccarthy-oaS1e`

### Executive summary

1. **What changed:** Fixed `deferred` outcomes firing YAML progression rules (silent data
   corruption). Fixed `RunSegment.drills` shallow-clone in plan duplication (last remaining
   gap after passes 34 and 37). Fixed `nanoid` import path coupling in `exerciseHistoryStore`.
   Updated a misleading comment in `workoutInstanceId.ts`. Added a `↗ [note]` progression
   hint to TodayPage's pending workout card.
2. **Highest confidence:** The `deferred` fix and the `nanoid` import fix are both tiny and
   unambiguous. The `RunSegment.drills` fix closes the last known shallow-clone gap — it has
   a test and follows the exact same pattern as the passes 34 and 37 fixes.
3. **Feature confidence:** The TodayPage `progressionRecommendation.note` feature is minimal
   — 4 lines, no new computation, reuses already-computed data. The `!todayRunSlot` guard
   correctly prevents double-surfacing for run days.
4. **Review first:** Verify the `↗ note` appears on a weights pending card that has a prior
   session with a progression recommendation. Also verify it does not appear on a run day
   (even if `prevSessionOutcome.progressionRecommendation.note` is set).

---

### Biggest issues found

1. **`deferred` completion state fired YAML progression rules** — `logOutcomeWithProgression`
   excluded `skipped` and `planned` from `session_complete` but not `deferred`. Since
   `deferred` maps to `day_off` (no workout done), any progression rule guarded by
   `session_complete` would fire on a defer. For load-progression rules (`load += 2.5`), this
   advances the per-exercise target weight without any actual workout, silently corrupting the
   program's state machine.

2. **`RunSegment.drills` shallow-clone in `duplicatePlan`** — The final nesting level
   unfixed after passes 34 and 37: `DrillSpec` objects inside `RunSegment.drills` were
   shared between original and copy. Drill edits on one plan would silently affect the other.
   This was documented in pass 37's REVIEW_NOTES as an open recommendation.

3. **Transitive `nanoid` import** — `exerciseHistoryStore` imported from `rotationEngine`
   instead of the source `lib/utils`. Minor coupling issue with silent breakage risk.

---

### Improvements completed

| Change | File(s) | Tests |
|--------|---------|-------|
| Fix `deferred` in `session_complete` | `outcomeStore.ts`, `outcomeStore.test.ts` | +3 |
| Fix `RunSegment.drills` deep-clone | `planStore.ts`, `planStore.test.ts` | +1 |
| Fix `nanoid` import path | `exerciseHistoryStore.ts` | (refactor) |
| Fix misleading comment | `workoutInstanceId.ts` | (docs) |
| Surface `progressionRecommendation.note` hint | `TodayPage.tsx` | (visual) |

---

### Definitely keep

- **`deferred` `session_complete` fix** — Correct semantic. Zero risk. Stops silent variable
  drift for YAML program users who defer workouts.
- **`RunSegment.drills` deep-clone fix** — Closes the last known shallow-clone gap. Has a test.
  The pattern is identical to passes 34 and 37 and is unambiguously correct.
- **`nanoid` import fix** — Strictly better coupling. Zero behavior change.

### Probably keep but tweak

- **`progressionRecommendation.note` hint** — The feature is correct and minimal. You may
  want to adjust the `↗` prefix character or color (`text-sky-700`) to match your visual
  preferences. Currently uses `truncate` — if the note is long, you may want to allow a
  second line or add a tooltip.

### Do not keep

Nothing this pass.

---

### Recommendations only (not implemented)

- **Error boundary around the app root** — No `React.ErrorBoundary` wraps the router or
  any page. A thrown error in any component crashes the entire UI with no recovery path.
  A top-level boundary with a "Reload the app" message would provide a graceful fallback.
- **Narrow Zustand selectors in CalendarPage** — The page subscribes to entire store slices.
  Narrowing selectors to only the fields each section needs would reduce unnecessary
  re-renders on any store update.
- **Surface expression evaluator errors in ProgramImportPage** — Malformed YAML progression
  rules fail silently (evaluator returns 0). A visible parse error in the import wizard
  would help debugging.
- **Retroactive correction for already-fired `deferred` progressions** — The `deferred`
  fix is forward-only. Users who already had deferred outcomes fire their YAML progression
  variables will not see a rollback. A migration utility to recompute `programStore.vars` from
  the logged outcome history would fix historical drift, but is complex and risky.

---

### Open questions for you

1. Should the `↗ note` line be hidden when `lastSessionSummary` is null but notes exist?
   Currently it renders in either case (same `||` condition as notes). This is consistent
   behavior but the `↗` hint without a summary line above it might feel detached.
2. Should the progression note color (`text-sky-700`) be more muted (e.g., `text-slate-500`)
   to match the summary line, or more prominent to stand out as actionable guidance?

---

### Known issues or incomplete work

- The `deferred` fix is forward-only — historical progressions that fired incorrectly are
  not corrected. Acceptable for now; a retroactive fix requires a full outcomes-to-vars
  recomputation.

---

### Dependencies added

None.

---

## 2026-05-23 (thirty-seventh pass) — branch `claude/dreamy-mccarthy-79X8Y`

### Executive summary

1. **What changed:** Fixed a nested shallow-clone bug in plan duplication (SetSpec[] arrays
   within ExerciseSpecs were shared between original and copy). Fixed WeeklyActivityStrip to
   use the newest entry when duplicates exist for a date. Blocked saving plans with duration
   < 1 in Plan Builder. Wired `computePlanStreak` into the streak stat for semantic clarity.
2. **Highest confidence:** All four changes are small, well-scoped, and guarded by tests.
   The deepClone fix (change 1) and the duration validation (change 3) are the most important.
3. **Slightly riskier:** None of the changes touch the rotation engine or store mutation paths.
   All risk is UI-level and reversible.
4. **Review first:** The Plan Builder duration validation — verify the red-border and error
   message appear when `durationValue < 1`, and that both Save buttons are correctly disabled.
   Also confirm the strip dedup fix doesn't change the displayed colors for normal users.

---

### Biggest issues found

1. **`deepCloneWorkoutSlot` nested shallow-clone bug** — Pass 34 fixed the top-level
   array references for `exercises` / `warmup` / `segments`, but missed one level deeper:
   each `ExerciseSpec.sets` when it is a `SetSpec[]`. Duplicating a YAML-imported plan
   with structured set specs (not just a plain count) would share those per-set objects
   between both plans. Future edits to one plan's sets would silently affect the other.

2. **`WeeklyActivityStrip` entry dedup inconsistency** — The only place in the codebase
   using `Array.find()` for entries rather than preferring newest createdAt. Rare in
   practice (store dedup runs on add/import), but a latent correctness gap.

3. **`duration.value = 0` via YAML editor** — The UI number field already guards against
   0 via `|| 1`, but the YAML editor path could set 0 directly and the Save button
   would proceed, creating a plan that instantly appears expired.

---

### Improvements completed

| Change | File(s) | Tests |
|--------|---------|-------|
| Fix SetSpec[] deep-clone in duplicatePlan | `planStore.ts`, `planStore.test.ts` | +2 |
| Fix WeeklyActivityStrip entry dedup | `TodayPage.tsx` | (visual) |
| Wire `computePlanStreak` into streak stat | `TodayPage.tsx` | (semantic) |
| Block save when duration < 1 | `PlanBuilderPage.tsx` | (visual) |

---

### Definitely keep

- **SetSpec[] deep-clone fix** — Data correctness issue. The extra array map is O(small)
  and the test coverage makes regressions impossible. Keep unconditionally.
- **Duration < 1 validation** — Closes a silent data corruption path where a plan's
  expiry logic fires immediately. Risk is near-zero.

### Probably keep but tweak

- **WeeklyActivityStrip dedup + planStreak** — Both changes are correct but the observable
  effect is zero for users without duplicate entries and pre-filtered data. Worth keeping
  for code clarity; no visual diff to verify unless you inject duplicate entries.

### Do not keep

Nothing this pass.

---

### Recommendations only (not implemented)

- **Error boundary around the app root** — No `React.ErrorBoundary` wraps the router or
  any page. A thrown error in any component crashes the entire UI with no recovery path.
  A top-level boundary with a "Reload the app" message would provide a graceful fallback.
- **Narrow Zustand selectors in CalendarPage** — The page subscribes to entire store
  slices. Narrowing selectors to only the fields each section needs would reduce
  unnecessary re-renders on any store update.
- **Surface expression evaluator errors in ProgramImportPage** — Malformed YAML progression
  rules fail silently (evaluator returns 0). A visible parse error in the import wizard
  would help debugging.
- **`duplicatePlan` deep-clone drills within RunSegment** — `RunSegment.drills` is a
  `DrillSpec[]`. Currently cloned as `{ ...s }` (shallow), so `drills` arrays are
  shared between plans. Lower risk than the SetSpec fix (drills are rarely edited
  post-import), but worth noting.

---

### Open questions for you

1. Should the duration validation error block in Plan Builder show immediately on load
   (if the plan was saved with a bad value) or only after the user interacts? Currently
   it shows immediately if `durationValue < 1`, which could be jarring on first load.
2. Do you want the streak stat labeled "Streak" or "Plan Streak" to make explicit that
   it counts only this plan's qualifying days?

---

### Known issues or incomplete work

- None from this pass. All changes were implemented and committed.

---

### Dependencies added

None.

---

## 2026-05-22 (thirty-sixth pass) — branch `claude/dreamy-mccarthy-9sH8T`

### Executive summary

1. **What changed:** Fixed a data quality gap in CSV import (`outcomeStore.importOutcomes`
   now carries plan/workout context to exercise history records). Added a confirmation
   modal before the "Mark N as Day Off" bulk action in TodayPage.
2. **Highest confidence:** The `importOutcomes` fix is a one-line change that routes
   through the existing `syncExerciseHistory` helper — the same path used by live
   logging. Zero risk of regression.
3. **Slightly riskier:** The confirmation modal adds a state variable and a new Modal
   render to TodayPage. The logic is simple but the page is already large; test manually.
4. **Review first:** The catch-up confirmation modal UX — verify the date list renders
   correctly, the confirmation fires `markDaysAsOff` as expected, and cancel leaves no
   state changes.

---

### Biggest issues found

1. **`outcomeStore.importOutcomes` dropped exercise history context** — All prior passes
   missed this. After CSV import, exercise records in `exerciseHistoryStore` had
   `planName: null` and `workoutName: null`. Not a crash, but affects any UI that
   tries to filter or display records by plan/workout name.

2. **"Mark N as Day Off" had no confirmation** — Pass 33 added this quick-action
   button; no prior pass added a safety gate. A single accidental tap on a scrolling
   mobile screen would batch-mark up to 7 past days without warning.

---

### Improvements completed

| Change | File(s) | Tests |
|--------|---------|-------|
| Fix `importOutcomes` exercise history context | `outcomeStore.ts` | +6 in outcomeStore.test.ts |
| Catch-up confirmation modal | `TodayPage.tsx` | (visual — no unit tests) |

---

### Definitely keep

- **`importOutcomes` context fix** — No behavioral change for the common path. Strictly
  better data quality for imported outcomes. Risk is near-zero.

### Probably keep but tweak

- **Catch-up confirmation modal** — The UX choice is good; the implementation is minimal.
  You may want to adjust the date format (currently "Wednesday, May 20") or the modal
  copy if the tone feels too formal. The confirm button color (amber) matches the action
  type but you might prefer a different style.

### Do not keep

Nothing this pass.

---

### Recommendations only (not implemented)

- **Wire `computePlanStreak` into TodayPage stats bar** — The function was added in
  pass 25 and is tested but never displayed. Could replace or supplement the global
  streak with a plan-scoped one.
- **Validate `duration.value > 0` in Plan Builder** — Setting `value: 0` silently
  creates a plan that expires immediately. A validation warning at create/edit time
  would prevent user confusion.
- **Surface expression evaluator errors in UI** — Malformed YAML progression rules
  fail silently. A visible error message in ProgramImportPage would help debugging.
- **Narrow Zustand selectors in CalendarPage** — The page subscribes to entire store
  slices; narrowing to only the needed fields would reduce unnecessary re-renders.

---

### Open questions for you

1. Should the catch-up modal list dates oldest-first or newest-first? Currently it
   matches `unloggedDates` order (newest-first). Oldest-first might read more naturally
   as a chronological list.
