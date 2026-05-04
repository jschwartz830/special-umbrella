# Feature Proposal — Session Count Indicator on Today's Workout Card

Date: 2026-05-04
Branch: `claude/dreamy-mccarthy-sA0Ai`
Status: **Implemented this run**

## Feature selected

Show a small "×N done" counter next to the workout title on today's pending `WorkoutDayCard`, indicating how many times that specific rotation day has been previously completed.

## Why it was selected

- Directly adjacent to the existing `lastSessionSummary` hint (already shows "Last: 3×225 Bench Press")
- Users frequently want "have I done this workout before, and how many times?" context before starting
- All data is already available at the TodayPage render level (`planEntries` filtered by `planDayIndex`)
- No new data fetching, no new store subscriptions, no state changes
- Narrowest possible slice: one utility function + one optional prop + one badge

## Expected user value

- Motivation: "I've done this 4 times before" → feeling of progress in a repeating plan
- Orientation: on long plans, quickly know if this is a new workout type or a familiar one
- Zero noise: badge only appears when count > 0 (new plans show nothing)

## Implementation scope for this run

- `countPlanDayCompletions(planId, planDayIndex, entries, excludeDate?)` in `historyStats.ts`
- Optional `sessionCount?: number` prop on `WorkoutDayCard`
- Render: `×N done` as a small `text-slate-500` label in the card header
- Computed in `TodayPage` as `todaySessionCount`, passed only to the pending today card
- 5 unit tests for the new utility function

## Assumptions being made

- "Session" = prior `complete` actions for this `planDayIndex`; skips and day-offs are excluded
- Count excludes today (using `excludeDate = today`) so it reflects only prior sessions
- Only shown on today's pending card, not on upcoming or resolved cards

## Open product / UX decisions

- Should skipped sessions count? Currently no. Could argue either way.
- Should upcoming cards also show session count? Not implemented; easy extension.
- Label copy: "×N done" vs "Session N+1" vs a numeric badge. Using "×N done" (shows historical count, not "you are on session N+1").

## Architecture / schema impact

None. No new fields, no schema changes, no new store subscriptions.

## Risks

- WorkoutDayCard prop interface change — additive (`sessionCount?`), zero risk to existing call sites
- Count is O(n) over `planEntries` — negligible for typical data sizes

## Rollback strategy

Remove `sessionCount` prop from WorkoutDayCard, the `todaySessionCount` line in TodayPage, and `countPlanDayCompletions` + its tests from historyStats. Four-file revert, no data migration.

## What is intentionally not being built yet

- "Session N+1" framing (would require count + 1 and different copy)
- Upcoming card session counts
- Milestone/achievement display ("First time!" / "10th session!")
- Streak-per-workout-day tracking

---

# Feature Proposal — Week Progress Indicator on TodayPage

Date: 2026-04-29
Branch: `claude/dreamy-mccarthy-vrC4L`
Status: **Implemented this run**

---

## Feature selected

Week progress indicator on TodayPage for `weeks`-duration plans — display
"Week X of Y" inline in the plan subtitle, mirroring the rotation cycle
progress added in pass 16.

---

## Why selected

Pass 16 added "3/6 done · last one!" for rotation-duration plans, giving
users a clear "how far through the current cycle" signal. Users on
weeks-duration plans (e.g. a 12-week running program) had no equivalent.
Their subtitle showed only "Day X of N in rotation" with no information
about how far through the overall plan they were.

`computePlanProgress` already exists and is already tested for weeks plans.
This feature is purely a display-side addition — no new store logic, no
schema change. Exactly one import line and ~10 lines of JSX.

---

## Expected user value

- Clear orientation: "I'm in Week 3 of 12 — a quarter through."
- Motivational signal on the last week ("last week!"), matching the
  "last one!" label for rotation plans.
- Symmetry: both plan-duration types now surface progress in the same
  subtitle line, with the same visual treatment.

---

## Implementation scope for this run

1. Import `computePlanProgress` in TodayPage (already imported from the
   same module as `computeHistoryStats`).
2. Compute `weekProgress` inline when `plan.duration.type === 'weeks'`
   (null otherwise — no effect on rotation plans).
3. Display "· Week X of Y" in the subtitle only while the plan is in
   progress (`completed < total`). Suppressed when the plan has expired
   (the expiry banner already handles that state).
4. "last week!" micro-label when `completed + 1 === total` (same emerald
   treatment as the rotation "last one!" label).
5. 4 unit tests added to `historyStats.test.ts` covering the current-week
   computation for the weeks-plan case.

---

## Assumptions made

- `currentWeek = completed + 1` (completed = full weeks elapsed, so the
  user is always IN the next week).
- Display is suppressed when `completed >= total` (expired): the plan-
  completion banner already surfaces that state; doubling up would be
  confusing.
- Display is suppressed at plan start for weeks plans when `completed = 0`?
  No — "Week 1 of 12" is informative from day 1. The difference from
  rotation plans (where "0/6 done" was noise) is that weeks progress
  advances automatically with the calendar, so "Week 1 of 12" is always
  accurate and useful. The rotation "0/N" was noise because no action had
  been taken; the weeks "Week 1 of N" reflects real calendar progress.
- `computePlanProgress` is not re-memoized here (matches cycleProgress
  pattern — direct call, already O(n) in entries length).

---

## Open product / UX decisions

- Should the week indicator also show on the stats bar instead of inline?
  Left as inline for now (matches rotation cycle treatment).
- Should expired plans show "Week 12 of 12 · complete!" rather than nothing?
  Deferred — the expiry banner is the canonical signal for that state.
- Rotation plans now show "Day X of N in rotation · 3/6 done"; weeks plans
  will show "Day X of N in rotation · Week 3 of 12". The subtitle grows
  long on small screens. A future pass could consider collapsing one field.

---

## Architecture / schema impact

None. Read-only use of existing `computePlanProgress` helper.

---

## Risks

- Low. Purely additive UI change on a pre-existing computed value.
- The subtitle line becomes longer on weeks plans (same concern as pass 16
  for rotation plans). On a 320px phone, "Day 6 of 6 in rotation · Week 12
  of 12" may wrap. Should evaluate on a real device.

---

## Rollback strategy

Revert the single TodayPage commit. No store, schema, or engine changes.

---

## What is intentionally not being built yet

- Week X of Y display on PlansPage (progress bar already shown there).
- "N days remaining in this week" countdown.
- Week-based streak counting.

---

# Feature Proposal — Previous-Session Inline Summary (TodayPage)

Date: 2026-04-30
Branch: `claude/dreamy-mccarthy-Ymdp2`
Status: **Implemented this run**

---

## Feature selected

**Compact "Last: …" hint below today's pending workout card.**

When today's workout is pending, show a single line like
`Last: 3×8 @ 135 lb` (weights) or `Last: 2.5 mi · 28 min` (run) directly
below the `WorkoutDayCard` on TodayPage.

---

## Why selected

The current TodayPage already calculates `previousSetsByExercise` and
`previousWeightsOutcome` at render time and passes them only to `OutcomeModal`
and `ActiveWorkoutTracker`. There is no surface where the user can see
"what did I do last time?" without opening the outcome modal or starting a
tracked session.

This causes a concrete friction: a user who wants to know whether to add
weight today must navigate away, open History, find the entry, and return.
The data to answer this question is already in the same render cycle.

Chosen because:
- Zero new data-fetching (reuses `allOutcomes` + `planEntries` already held)
- Purely additive — a single hint line, no new component
- Removes the most common navigation round-trip for strength-plan users

---

## Expected user value

- Immediate visibility of last session's weights / distance before
  deciding to "Start Workout" or "Complete"
- Supports the progressive-overload check without opening any modal
- Most useful for repeating strength plans and structured run programs

---

## Implementation scope for this run

1. Add `findPreviousSessionForPlanDay` pure function in TodayPage — searches
   `planEntries` for the most recent `complete` with
   `planDayIndex === primaryPlanDayIndex`, then looks up that date's outcome.
2. Compute `lastSessionSummary: string | null` from the resolved outcome:
   - Weights: first exercise with actual sets → "3×8 @ 135 lb" format
   - Run: distance + duration → "2.5 mi · 28 min"
   - Swim: distance + duration → "800 m · 30 min"
3. Render a single `text-xs text-slate-500` line below WorkoutDayCard.
   Visible only when: isPending, not doubleDay, lastSessionSummary != null.

---

## Assumptions made

- Most recent `complete` matching `planDayIndex` is the right proxy for
  "last time I did this specific workout". Correct for clean rotation plans;
  may occasionally show wrong session after retroactive history edits.
- One representative exercise (first with actual sets) is sufficient.
  Showing all exercises would overflow the card on small screens.
- Run summary prefers actual distance over distance derived from pace —
  uses `runActual.actualDistanceMiles` if available.

---

## Open product / UX decisions

1. **Per-exercise or first-exercise?** Showing only the first exercise keeps
   the hint concise. Future pass could expand to a scrollable row.
2. **Show when skipped/day_off?** Currently suppressed — showing it would
   require "last time you completed X was …" preamble text.
3. **Label wording**: settled on "Last:" as the shortest clear label.

---

## Architecture / schema impact

None. No new store state. No new props on existing components. String computed
locally in TodayPage.tsx from already-available data.

---

## Risks

- Low — purely additive JSX. No store mutations.
- If primaryPlanDayIndex is stale after retroactive edit, hint may show data
  for the wrong planDay. Same caveat already applies to previousSetsByExercise.

---

## Rollback strategy

Remove the three-line JSX block and the `findPreviousSessionForPlanDay`
function. No data migration. No store changes to revert.

---

## What is intentionally not being built yet

- Per-exercise progress arrows (↑/↓ vs. last time)
- Multi-exercise scrollable row
- "Best ever" vs. "last time" toggle
- Run adaptation target inline (already surfaced via `todayAdaptationNote`)

---

# Feature Proposal — Personal Best (PB) Detection in Session Hint

Date: 2026-05-02
Branch: `claude/dreamy-mccarthy-WJaAU`
Status: **Implemented this run**

---

## Feature selected

Extend the "Last: 3×8 @ 135 lb Bench Press" session hint on TodayPage to
append "· PB" when the displayed load equals the user's all-time max load for
that exercise.

---

## Why selected

The previous-session hint (added in pass 18) shows the most recent completed
load. Users often want to know "was that my best?" to decide whether to push
harder today. The `exerciseHistoryStore` already stores per-set load records
and has been populated since pass 6 — the data for PB detection exists and
was only waiting to be surfaced.

The feature required no schema changes, no new store state, and no new API.
The narrowest slice was: compute `maxLoadByExercise` in TodayPage via a
`useMemo` over the already-present `exerciseHistoryStore.records`, then pass
the map as an optional parameter to `buildLastSessionSummary` (already being
refactored and extracted this pass).

---

## Expected user value

- "Last: 3×8 @ 225 lb Squat · PB" immediately tells the user their last session
  was a personal best, motivating them to attempt the same or higher today.
- "Last: 3×8 @ 185 lb Squat" (no PB marker) signals there's room to build.
- Entirely passive — no additional taps or modals. The hint already rendered;
  this just adds a two-character marker when warranted.

---

## Implementation scope for this run

1. `buildLastSessionSummary` in `src/lib/sessionSummary.ts` accepts an optional
   `maxLoadByExercise?: Record<string, number>` parameter. When the first set's
   `actualLoad` equals the map value for that exercise, " · PB" is appended.

2. In `TodayPage`, one new store subscription:
   `const exerciseRecords = useExerciseHistoryStore(s => s.records)`

3. One new `useMemo` computing `maxLoadByExercise` from `exerciseRecords`.

4. `buildLastSessionSummary(prevSessionOutcome, maxLoadByExercise)` — existing
   call updated to pass the map.

5. Tests for the PB marker in `sessionSummary.test.ts` (3 cases: PB shown, no
   PB below max, no PB when exercise not in map).

---

## Assumptions made

- "Personal best" means the highest `actualLoad` in any completed set across
  all logged sessions for that exercise, including today's records. This is
  intentional: if the user logged a heavier set today and then checks tomorrow,
  they'll see "· PB" on yesterday's entry.
- The comparison is equality (`===`), not `>=`. This means a PB is shown
  precisely when the last session hit the all-time high, not just "close to it."
- Only the first displayed exercise is checked (the existing behaviour — one
  exercise per hint line).
- PB detection applies only to weights outcomes. Run and swim hints are
  unchanged.

---

## Open product / UX decisions

- Should "· PB" be highlighted in a different colour (e.g., amber/gold) rather
  than plain slate text? Deferred — keeping it in the same muted style avoids
  visual noise; can be styled later if users find it hard to notice.
- Should swim/run show a distance PB ("· PB" when best-ever distance)?
  Deferred — run adaptation already handles pace/distance targets; this would
  need a separate distance-max calculation.
- Should PB history be time-bounded (e.g., "PB in the last 6 months") rather
  than all-time? Deferred — all-time is the simplest and most motivating signal.

---

## Architecture / schema impact

None. `exerciseHistoryStore` already persists via `wpt_exercise_history`.
`maxLoadByExercise` is derived in TodayPage as a `useMemo` — no persistence,
no migration, no new localStorage key.

---

## Risks

- `exerciseHistoryStore` is subscribed for the first time in TodayPage (all
  other callers go through `outcomeStore.logOutcomeWithProgression`). The
  subscription is a single `.records` selector, so it only re-renders when the
  records array changes (i.e., after a workout is logged).
- All-time PB comparison includes records from deleted plans (planId stored as
  a snapshot). This is a minor inconsistency but not a bug — the load itself is
  valid exercise data.

---

## Rollback strategy

Remove the three lines in TodayPage (`exerciseRecords`, `maxLoadByExercise`,
parameter in `buildLastSessionSummary` call). Remove the optional parameter
from `buildLastSessionSummary` in `sessionSummary.ts`. No data to migrate.

---

## What is intentionally not being built yet

- Run/swim PB detection
- PB in the active workout tracker (live comparison during a session)
- All-time PR board / personal records page
- Time-bounded PB windows (e.g., "PR in last 90 days")
