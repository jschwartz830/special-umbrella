# Review Notes — Overnight Audit

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
