# Feature Review — Week Progress Indicator on TodayPage

Date: 2026-04-29
Branch: `claude/dreamy-mccarthy-vrC4L`
Classification: **Keep (review subtitle length on small screens)**

---

## What was actually built

1. `computePlanProgress` imported into `TodayPage` (was already used in
   PlansPage and historyStats — no new helper needed).

2. `weekProgress` — computed inline when `plan.duration.type === 'weeks'`,
   null otherwise. Uses `computePlanProgress(plan, planEntries, today)`.

3. **Subtitle display** in `src/pages/TodayPage.tsx`:
   - Shows nothing for rotation plans (weekProgress is null).
   - Shows "· Week X of Y" while the plan is in progress (`completed < total`).
   - "last week!" micro-label when `completed + 1 === total`.
   - Suppressed once the plan expires; the expiry banner handles that state.

4. **4 unit tests** in `historyStats.test.ts` documenting the boundary
   conditions the UI relies on.

---

## What assumptions were encoded

- `currentWeek = completed + 1` where `completed` = full 7-day periods elapsed.
  "Week 1 of 12" shows from day 0 through day 6 — intentional and accurate.
- `completed < total` guards suppress the display once expired.
- `computePlanProgress` is not re-memoized in TodayPage (consistent with
  `cycleProgress` which is also a direct call).
- "last week!" uses emerald text matching the rotation "last one!" label.

---

## What worked well

- Zero new pure functions — the feature fell entirely out of existing tested
  infrastructure. The entire change is 1 import + 5 computed lines + 10 JSX
  lines.
- Test strategy focused on documenting the specific boundary conditions the UI
  relies on rather than re-testing `computePlanProgress` in bulk.
- Symmetric with the pass-16 rotation cycle display; the UI pattern is
  consistent across both plan types.

---

## What feels risky or incomplete

- **Subtitle length**: "Day 6 of 6 in rotation · Week 12 of 12 · last week!"
  is long. On a 320px-wide device this may wrap. Same concern was flagged for
  the pass-16 rotation display, but has not been evaluated on a real device.
- The two signals (rotation position + week number) are both in the same `<p>`.
  A future pass could separate them: one for plan position, one for plan
  progress.

---

## What I should evaluate tomorrow

1. Open TodayPage on a physical device with a weeks-duration plan mid-progress.
   Does "Day 4 of 6 in rotation · Week 3 of 12" fit on one line or wrap?
2. Does "Week 1 of 12" on day 1 feel informative, or is it surprising? The
   rotation variant hides "0/6 done" at start (bug fixed this pass), but weeks
   shows "Week 1" immediately since it reflects real calendar progress.

---

## Recommended next steps

- Evaluate on a narrow-screen device; if wrapping is an issue, extract into a
  separate `<p>` row or consider a progress pill component.
- If well-received, consider whether PlansPage should also show "Week 3 of 12"
  alongside its progress bar (currently shows a percentage and bar only).

---

## Keep / revise / prototype / reject

**Keep** — the display is additive, reverting has zero data impact, the logic
is correct, and the value for weeks-plan users is clear. Revisit subtitle
layout if wrapping is observed on device.

---

# Feature Review — Rotation Cycle Progress on TodayPage

Date: 2026-04-29
Branch: `claude/great-mccarthy-TJqjV`
Classification: **Keep (review UX placement)**

---

## What was actually built

1. `computeRotationCycleProgress(plan, entries)` — pure function in
   `historyStats.ts`. Filters plan entries by `planId` and
   `action ∈ {complete, skip}`, computes `totalDone % rotationLength` for
   `doneInCycle`, derives `remaining` and `justCompletedRotation`. Returns
   `null` for `weeks`-duration plans or plans with no days.

2. `src/pages/TodayPage.tsx` — imports the helper and displays cycle progress
   inline with the "Day X of N in rotation" subtitle:
   - Normal state: `· 3/6 done`
   - Last workout in cycle: `· 5/6 done · last one!` (emerald text)
   - Just completed a rotation: `· rotation complete!` (emerald text)
   - Returns nothing for `weeks` plans or when `cycleProgress` is `null`.

3. 8 unit tests in `historyStats.test.ts` covering the helper's branches.

---

## What assumptions were encoded

- `day_off` entries don't advance the cycle counter (mirrors `isPlanExpired`).
- `weeks` plans return `null` and see no change on TodayPage.
- "just completed" means `doneInCycle === 0 && totalDone > 0` — detected at
  the moment before the next workout is logged.

---

## What worked well

- Pure helper is easy to test and reason about independently.
- Inline placement in the subtitle keeps the UI change minimal.
- The "last one!" micro-label adds a lightweight motivational moment.
- 8 tests cover all branching paths including multi-cycle wrapping.

---

## What feels risky or incomplete

- The "rotation complete!" text persists until the user logs the next
  workout. There is no timer or dismiss — it may feel like a stale state
  depending on how long between rotations.
- The inline subtitle becomes quite long on small screens:
  "Day 6 of 6 in rotation · 5/6 done · last one!" — could wrap awkwardly.
- `weeks` plans have no equivalent motivational signal.

---

## What I should evaluate tomorrow

1. Open TodayPage on a real device with a rotations plan mid-cycle — does the
   inline text fit comfortably or does it wrap?
2. Complete a full rotation and observe the "rotation complete!" state. Does it
   feel rewarding or like a confusing no-op pending state?
3. Is "last one!" the right phrase, or is "· 1 left" more clear?

---

## Recommended next steps

- If the inline placement feels cramped, move `doneInCycle / rotationLength`
  to the stats bar as a fourth tile ("Cycle: 3/6").
- If the "rotation complete!" state feels off, add a guard:
  show it only on the same day as the completing workout, then suppress.
- For `weeks` plans, consider a "week X of Y" indicator using `computePlanProgress`.

---

## Keep / revise / prototype only / reject

**Keep with optional revision**: the logic is solid and the user value is clear.
The main question is display placement (inline vs. stat tile). Either approach
is a small change. Recommend keeping as-is and evaluating on a real device
before moving it.

---

# Feature Review — Previous-Session Inline Summary (TodayPage)

Date: 2026-04-30
Branch: `claude/dreamy-mccarthy-Ymdp2`
Classification: **Keep — evaluate wording on device**

---

## What was actually built

1. `findPreviousSessionForPlanDay(planId, planDayIndex, currentDate, entries, outcomes)`
   — pure function in `TodayPage.tsx`. Filters `planEntries` for `complete`
   entries matching the exact `planDayIndex`, sorts by descending date, then
   returns the first outcome found.

2. `buildLastSessionSummary(outcome)` — pure function in `TodayPage.tsx`.
   Formats the outcome into a compact string:
   - Weights: `"Last: 3×8 @ 135 lb Bench Press"` (first exercise with data)
   - Run: `"Last: 3.1 mi · 29 min"`
   - Swim: `"Last: 800 m · 20 min"`
   - Other/no data: returns `null`

3. **Render hint** in `src/pages/TodayPage.tsx`:
   - One `<p className="text-xs text-slate-500 -mt-2 ml-1">` line.
   - Visible only when `isPending` and `lastSessionSummary` is non-null.
   - Suppressed in double-day mode to avoid layout clutter.
   - Placed directly after the `WorkoutDayCard` section.

---

## What assumptions were encoded

- Matching by `planDayIndex` is the right "same workout" signal for rotation
  plans. Works well for clean rotation histories; less reliable after
  retroactive edits that change planDayIndex values.
- The first exercise with any actual data is representative. Users with
  multi-exercise plans may want to see more, but one line keeps it readable.
- `isPending` guard means the hint disappears once today is logged (correct —
  once you've done the workout, the hint is no longer needed).
- Run summary uses `actualDistanceMiles` over `targetDistance` to show real
  performance, not planned target.

---

## What worked well

- Zero new store state or props. Everything derived from already-rendered data.
- `findPreviousSessionForPlanDay` is a clean, testable pure function.
- The `-mt-2` spacing pulls the hint visually close to the card without
  competing with the action buttons below.
- TypeScript clean, no new type definitions needed.

---

## What feels risky or incomplete

- **planDayIndex stability**: the planDayIndex that was logged on a past date
  is not always the same as the "canonical" day for that position today
  (overrides, jumps, retroactive edits can shift indices). This is an existing
  concern for `previousSetsByExercise` too — not introduced here.
- **Exercise name truncation**: long exercise names (e.g., "Romanian Deadlift")
  will overflow on narrow screens without CSS truncation. The `<p>` has no
  `truncate` class currently.
- **Single exercise**: users with 4+ exercises logged per session may find
  "Last: 3×8 @ 135 lb Bench Press" incomplete. Future iteration could show
  "Last: 3 exercises" or a scrollable row.
- No test added for the two pure helpers — they are logic-free enough that
  unit tests would be testing string formatting rather than meaningful behavior.
  The `findPreviousSessionForPlanDay` scan logic mirrors the existing
  `findPreviousWeightsOutcome` pattern which is already tested indirectly.

---

## What I should evaluate tomorrow

1. Open TodayPage with a few weeks of history. Does the "Last: 3×8 @ 135 lb
   Bench Press" label feel useful or noisy in the context of the existing card?
2. Does the spacing (`-mt-2`) feel right or is the hint too close to the card?
3. Does "Last:" read naturally, or should it be "Last session:" or "Prev:"?
4. Test on a narrow screen (320px) — does the exercise name need truncation?

---

## Recommended next steps

- Add `truncate` class to the hint `<p>` element to prevent overflow on narrow
  screens (safe, 1-line change).
- If well-received, extend to show 2–3 exercises in a compact row rather than
  one.
- If too noisy, add a user preference in Settings to toggle the hint off.

---

## Keep / revise / prototype only / reject

**Keep** — the feature is purely additive, the data was already computed, and
the value for repeating strength plans is clear. The main open question is
whether the single-exercise display is satisfying or frustrating for complex
plans. Recommend keeping and iterating on the display format based on real use.

---

# Feature Review — Personal Best (PB) Detection in Session Hint

Date: 2026-05-02
Branch: `claude/dreamy-mccarthy-WJaAU`
Classification: **Keep**

---

## What was actually built

1. `buildLastSessionSummary` in `src/lib/sessionSummary.ts` extended with an
   optional `maxLoadByExercise?: Record<string, number>` parameter. When the
   first actual set's load equals `maxLoadByExercise[exerciseName]`, " · PB" is
   appended to the returned string. No behaviour change when the parameter is
   omitted (run/swim callers, tests without PB context).

2. In `TodayPage`:
   - `exerciseRecords = useExerciseHistoryStore(s => s.records)` — first use of
     this store in TodayPage. Single selector minimises re-renders.
   - `maxLoadByExercise = useMemo(...)` — iterates records to build
     `{ exerciseName: maxLoad }` map. Memoized on `exerciseRecords`.
   - `buildLastSessionSummary(prevSessionOutcome, maxLoadByExercise)` — updated
     call site.

3. **Tests** (in `sessionSummary.test.ts`):
   - PB marker shown when load equals all-time max.
   - No PB when load is below max.
   - No PB when the exercise is not in the map.

---

## What assumptions were encoded

- All-time max across all exercise records (including records from deleted
  plans). This is intentional — the load is valid data regardless of which plan
  it was logged under.
- Equality comparison (`=== maxLoadByExercise[exercise]`): PB fires only on an
  exact match to the all-time high. A user who logged 135 lb → 145 lb → 135 lb
  will see "· PB" on the 145 lb session, not the most recent 135 lb one.
- Only weights PB detection. Run and swim are unchanged.

---

## What worked well

- The feature fell entirely out of the existing `exerciseHistoryStore` (which
  has been populated since pass 6 but was only exposed in one place). No schema
  changes, no new store state.
- Extracting `buildLastSessionSummary` to `sessionSummary.ts` this pass made
  the PB parameter a natural extension of an already-refactored function.
- The `maxLoadByExercise` memo is O(n sets) — cheap even for heavy users with
  hundreds of sessions.

---

## What feels risky or incomplete

- **First `exerciseHistoryStore` subscription in TodayPage**: the store is
  large (one record per exercise per session). On an old device with 2+ years
  of data, the memo could be slow. Measured O(n) on records, not sets, so in
  practice at most a few thousand iterations — acceptable.
- **Equality, not range**: "· PB" only fires when the previous session *exactly
  matched* the all-time high. If the user logged 225 lb once, then logged 200 lb
  three times, "· PB" never shows on the 200 lb sessions (correct: they aren't
  PRs), but won't show on new 225 lb sessions if somehow two records exist with
  the same load. Edge case, tolerable.
- **No indicator for run/swim best**: users who primarily track running may feel
  the feature is incomplete. Low priority since run adaptation already gives
  pace/distance guidance.

---

## What I should evaluate

1. Does "Last: 3×8 @ 225 lb Squat · PB" render legibly in the hint line
   alongside the `truncate` class? On a narrow screen the PB marker might be
   clipped. Check on a 360px device.
2. Does the `exerciseHistoryStore` subscription cause any perceptible extra
   render on TodayPage? The store only changes when a workout is logged, so
   steady-state renders are unaffected.
3. Is the PB marker visually distinct enough in muted slate text, or does it
   need colour (e.g., `text-amber-400`)?

---

## Recommended next steps

- If the PB marker is too easy to miss, style "· PB" in `text-amber-400` for
  a gold highlight. One-line CSS change.
- Consider adding a `maxDistanceByType` equivalent for run outcomes in a future
  pass.
- A "personal records" section in HistoryPage or SettingsPage (all-time bests
  per exercise, sortable) is a natural next feature that would use the same
  `maxLoadByExercise` computation.

---

## Keep / revise / prototype only / reject

**Keep** — passive, zero-friction PB detection using fully available data.
The only open question is styling (plain text vs. colour highlight). The
feature is complete and correct; styling can be tuned without any logic change.
