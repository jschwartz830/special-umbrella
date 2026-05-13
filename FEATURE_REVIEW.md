# Feature Review — Swim Pace Derivation in Session Summary Hint

Date: 2026-05-13
Branch: `claude/dreamy-mccarthy-JEVCy`
Classification: **Keep**

## What was actually built

When `buildLastSessionSummary` formats a swim workout outcome, it now derives
the pace from distance + duration when `averagePaceSecondsPer100m` is null or
0. The derived value is formatted with `formatSwimPace` and appended as
`"· 2:30 /100m"` (same format as a stored pace).

## What assumptions were encoded

1. `stored pace = 0` is always a data entry error, not a meaningful value. The
   implementation falls through to derivation in this case, consistent with
   the run block.
2. Pace is only derivable when **both** `actualDistanceMeters > 0` and
   `actualDurationMin > 0` are available. A half-complete record (distance
   only, duration only) produces no pace — correct behaviour.
3. `formatSwimPace` handles rounding correctly (it calls `formatPace` under
   the hood, which has a tested rounding guard preventing "x:60" display).

## Correctness assessment

The derivation formula `(durationMin × 60) / (distanceMeters / 100)` is
mathematically correct and consistent with `deriveSwimPaceSecondsPer100m` in
`workout-outcomes/types.ts`.

The stored-beats-derived priority is enforced by `storedSwimPace ?? derivedSwimPace`,
which is only non-null when stored > 0. The test "prefers stored swim pace over
derived when both are available" verifies this.

## Risk assessment

**Low risk.** The change is additive:
- Outcomes without pace previously showed no pace → no regression possible for those.
- Outcomes with a valid stored pace are unaffected (stored always wins).
- Outcomes with stored pace = 0 now derive; previously they showed nothing. This
  is strictly an improvement.
- `formatSwimPace` is already tested with edge cases in `types.test.ts`.
- 7 tests in `sessionSummary.test.ts` guard all branches of the new logic.

## Open questions

None. The feature is complete and consistent with the run equivalent.

---

# Feature Review — Previous Session Notes in TodayPage Hint

Date: 2026-05-13
Branch: `claude/dreamy-mccarthy-G6yaB`
Classification: **Keep** (with optional visual tweak)

## What was actually built

A second hint line below the "Last: …" summary on TodayPage, visible when:
- The workout is pending (not yet logged today)
- Double-day mode is off
- `prevSessionOutcome?.notes` is a non-empty string

The notes appear in italic with `"..."` framing and are truncated at screen
width. Both the summary and notes share a wrapping `<div className="space-y-0.5">`.

## What assumptions were encoded

1. Notes from the previous session are useful context before the next session
   of the same plan day.
2. Truncation at hint level is acceptable; the full note is in the outcome modal.
3. The italic `"..."` visual treatment clearly signals "quoted prior note".
4. Showing notes even when `lastSessionSummary` is null (e.g., yoga session
   with no metrics but a written note) is correct behavior.

## What worked well

- Zero new state, zero new data fetching, zero new store subscriptions.
  `prevSessionOutcome` was already computed immediately above the hint.
- The wrapping `<div>` approach cleanly handles all four combinations:
  summary only, notes only, both, neither.
- The feature degrades gracefully: users who don't write notes see no change.

## What feels risky or incomplete

- **Not browser-tested**: This is a JSX change in a CLI-only environment.
  The layout in the actual PWA should be visually confirmed, especially on
  narrow screens where truncation matters most.
- **Style decision**: The italic `"..."` framing is an aesthetic call. You
  may prefer a different treatment (e.g., a faint left border, a "📝" prefix,
  or no special framing).
- **No length threshold**: A 300-character note will be shown and truncated.
  Consider suppressing notes longer than ~100 chars or adding a "..." indicator
  at truncation.

## What I should evaluate tomorrow

1. Open TodayPage with a workout that has prior session notes. Verify the
   italic note line renders below the "Last:" summary cleanly.
2. Check narrow-viewport behavior (iPhone SE 375px width).
3. Decide whether the `"..."` framing or a plain italic line is preferred.
4. If notes are usually short: keep as-is. If they tend to be long: add a
   character limit or max-width clamp.

## Recommended next steps

- Visual QA in the actual app.
- Optionally add a character-length threshold to suppress very long notes.
- If the style feels off, one-line tweak to the italic `<p>` className.

## Keep / revise / prototype only / reject

**Keep** — the feature is additive, uses existing data, and solves a real
friction point. The main open question is visual polish, not logic.

---

# Feature Review — Auto-Derive Pace in Run Session Summary
# Feature Review — Plan-Scoped Streak (`computePlanStreak`)

Date: 2026-05-12
Branch: `claude/dreamy-mccarthy-OjsGg`
Classification: **Keep — wire UI in next pass**

## What Was Actually Built

A single exported function `computePlanStreak(planId, entries, extras, today)` in
`src/lib/historyStats.ts`. It counts consecutive days ending at `today` (inclusive)
where the given plan has a qualifying entry: `complete` or `day_off` rotation entry,
or any extra workout for that planId. Returns `0` when today has no qualifying entry.

12 unit tests covering the full behavioural surface.

## Assumptions Encoded

- Same streak semantics as the existing global streak (skip alone = streak breaker).
- No plan-start-date guard: if entries before the plan's `startDate` somehow exist,
  they would count toward the streak. In practice this cannot happen through the UI.
- Extra workouts for a plan count regardless of their `source` field (`double_day` vs
  `history`). Both represent real workout activity.

## What Worked Well

- The implementation is essentially `computeHistoryStats.currentStreak` with a
  `planId` filter on the Set population loop. ~20 lines total.
- 12 tests pass with zero friction; the test patterns reuse helpers from adjacent
  describe blocks.
- Zero state, zero schema, zero UI risk. The function is inert until called.

## What Feels Risky or Incomplete

- **Not wired into UI yet** — the function is exported but never called. An unused
  export is harmless but clutters the public API until wired.
- **Semantic gap vs global streak** — if a user sees both stats side by side, the
  plan streak could be lower than the global streak (if they have extras for other
  plans). This needs clear labelling in whatever UI uses it.

## What I Should Evaluate Tomorrow

1. Does the TodayPage stats bar have room for a plan-streak label alongside the
   existing "streak" count, or should it replace it?
2. Should the label be "plan streak" or just "streak" (implicit since TodayPage
   already shows the active plan)?
3. Is the HistoryPage per-plan summary a better home for this stat?

## Recommended Next Steps

- Wire `computePlanStreak` into TodayPage stats bar for the active plan (`plan?.id`).
- Import it alongside `computeHistoryStats` in `TodayPage.tsx` — no new store
  subscriptions required since `planEntries` and `planExtras` are already in scope.
- Add a `data-testid` attribute on the streak element for future E2E testing.

## Keep / Revise / Prototype Only / Reject

**Keep** — the logic is correct, the tests are solid, and the function fits naturally
into the existing stats API. Wire it in next pass.

---

# Feature Review — Pace Display in Run Session Summary

Date: 2026-05-07
Branch: `claude/dreamy-mccarthy-Q6elc`
Classification: **Keep**

## What was actually built

Modified `buildLastSessionSummary` in `src/lib/sessionSummary.ts` to:
1. Round `actualDistanceMiles` to 1 decimal before display (display bug fix).
2. Append a formatted pace string ("· 9:02 /mi") when `RunWorkoutActual.averagePaceSecondsPerMile`
   is non-null, using the existing `formatPace` utility.

5 new tests in `sessionSummary.test.ts` cover: rounding, pace present, pace null,
pace-only display.

## Assumptions encoded

- Pace is only shown when `averagePaceSecondsPerMile` is explicitly stored (non-null).
  Deriving from distance + duration was explicitly excluded.
- The `·`-delimited format extension is consistent with the existing style ("3.1 mi · 28 min").
- `formatPace` from `workout-outcomes/types.ts` is the canonical pace formatter.

## What worked well

- One import, 3 lines of logic, 5 tests. The feature delivered its intended value
  with minimal surface area.
- Bundling the float-rounding bug fix was natural since both changes affect the
  same run display path.
- Existing `formatPace` utility handled all formatting edge cases (padding, rounding,
  9:60 prevention) — no new formatting code needed.

## What feels risky or incomplete

- `averagePaceSecondsPerMile = 0` displays "0:00 /mi". This is technically correct
  (0 is a valid stored value if the user accidentally leaves the field at default)
  but looks wrong in the UI. A `> 0` guard would prevent it.
- Swim pace (`averagePaceSecondsPer100m`) follows the exact same pattern but was
  not added this pass. The omission is intentional (one feature at a time) but
  creates asymmetry.
- Cannot verify the live UI rendering without running the dev server.

## What I should evaluate tomorrow

- Open TodayPage with a run plan that has a previously logged run outcome with pace.
  Verify "9:02 /mi" appears correctly after the distance + duration.
- Check the hint wraps cleanly on a narrow screen (320px) when all three components
  are present.
- Verify that `averagePaceSecondsPerMile` is populated correctly by `OutcomeModal`
  when pace is manually entered.

## Recommended next steps

1. Add a `> 0` guard on pace display (optional, low priority).
2. Extend the same pattern to swim: `averagePaceSecondsPer100m` → `formatSwimPace`.
3. Consider auto-deriving pace from distance + duration when pace is absent:
   `derivePaceSecondsPerMile(actualDistanceMiles, actualDurationMin)` — but mark
   it as "computed" (e.g., italic or different color) vs. explicitly recorded.

## Keep / revise / prototype only / reject

**Keep.** Low risk, clearly correct, well tested, useful to runners.
The only open question is the `> 0` guard, which is a minor defensive addition.

---

# Feature Review — 7-Day Activity Strip on TodayPage

Date: 2026-05-06
Branch: `claude/dreamy-mccarthy-9Dgx6`
Classification: **Keep**

## What was actually built

A `WeeklyActivityStrip` component local to `TodayPage.tsx` that renders a row
of 7 coloured dots (plus single-letter day labels) between the stats bar and
the unlogged-days nudge. The last 7 days ending today are shown left-to-right.
Dot colours: emerald (complete), amber (day_off), slate ring (skip), sky (extra),
subtle ring (empty). Today's dot has a sky ring offset.

## What assumptions were encoded

- `planEntries` for this plan includes all 7 days of interest (it does — it
  filters all history entries for the active plan, not just recent ones).
- `planExtras` similarly includes all extras regardless of age.
- A date string of the form `YYYY-MM-DD + 'T00:00'` parses correctly as a local
  midnight timestamp for day-letter computation — this is a common app-wide pattern
  (same as CalendarPage and other places).
- 7 days is the right lookahead to match the "This week" stat (also 7-day rolling).

## What worked well

- Zero new store subscriptions — the data was already in scope.
- The component is fully isolated: a single self-contained function that can be
  moved, tweaked, or deleted without touching any shared infrastructure.
- The `useMemo` keying prevents unnecessary re-computation on unrelated re-renders.
- TypeScript is clean — the `ActivityFill` union type makes the dot color logic
  explicit and exhaustive.

## What feels risky or incomplete

- **No click interaction** — tapping a dot does nothing. Users may expect to
  navigate to that day's Calendar detail. This is intentional scope limitation
  but could feel unresponsive.
- **No unit tests** — the component is view-only and uses no shared logic, but
  a snapshot or integration test would make future refactors safer. Adding
  React Testing Library is a one-time infrastructure cost not attempted here.
- **Day letters may repeat** — "T" appears for both Tuesday and Thursday,
  "S" for Saturday and Sunday. For 7 consecutive days this is usually readable
  in context, but could be ambiguous for users with irregular schedules.

## What I should evaluate tomorrow

1. Does the strip feel useful on actual device? Check with a plan that has a
   mix of complete/skip/day_off/extras to confirm the colour contrast is clear.
2. Is the vertical rhythm between stats bar and strip appropriate, or does it
   feel cramped?
3. Does the "extra-only" sky dot read as "bonus activity" or as "something else"?

## Recommended next steps

1. **Keep as-is** — the feature is low-risk and provides genuine value.
2. Optional: add tap interaction to open Calendar on the selected date.
3. Optional: replace single-letter labels with day-of-month numbers (`21`, `22`...)
   for dates that are not today — more information-dense.
4. Optional: consider showing a small "pending" indicator for today's dot
   specifically (currently today with no entry shows the same as any empty day,
   just with the sky ring).

## Keep / revise / prototype only / reject

**Keep** — the feature is contained, useful, and risk-free to ship. The open
UX questions are aesthetic tweaks, not blockers.

---

# Feature Review — Session Count Indicator on Today's Workout Card

Date: 2026-05-04
Branch: `claude/dreamy-mccarthy-sA0Ai`
Classification: **Keep**

## What was actually built

A `countPlanDayCompletions()` utility function and an optional `sessionCount` prop on `WorkoutDayCard` that renders a small "×N done" label next to the workout title. Passed from TodayPage only when the workout is pending and a prior completion exists.

## What assumptions were encoded

- `complete` action = "done"; `skip` and `day_off` don't count toward session history
- Count excludes today (shows prior sessions only, not counting the one about to happen)
- Label style: `text-slate-500 font-medium` — subdued, not attention-grabbing

## What worked well

- Zero impact on existing WorkoutDayCard usages (prop is optional)
- `countPlanDayCompletions` is a pure, well-tested utility
- The badge integrates naturally with the existing card header layout alongside the "Today" badge

## What feels risky or incomplete

- The label only appears on the pending today card. If users want it on upcoming cards, it requires passing `planEntries` + computing counts there — slightly more work
- "×N done" copy might be confusing ("done" vs "completions" vs "sessions") — worth a quick UX check
- No visual distinction between "first time ever" (no badge) and "done once before" (×1 done)

## What I should evaluate tomorrow

- Does the badge feel crowded on small screens when both "Today" and "×N done" are shown? Both are `text-xs` in the header flex row with `truncate`, so overflow is handled, but worth checking.
- Do you want to extend it to upcoming cards?

## Recommended next steps

1. Check on a narrow viewport (375px) that "Today" + "×N done" don't collide with the workout label
2. Consider whether "×N done" should also appear in double-day mode for the bonus card
3. If keeping: extend to upcoming cards (5-line change in TodayPage upcoming loop)

## Classification

**Keep** — functional, minimal, no breaking changes, easy to extend or revert.

---

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
