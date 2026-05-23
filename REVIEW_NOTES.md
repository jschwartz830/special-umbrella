# Review Notes — Overnight Audit

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
