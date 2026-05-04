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

# Feature Proposal — Personal Records Section in History Tab

Date: 2026-05-03
Branch: `claude/dreamy-mccarthy-SwIxl`
Status: **Implemented this run**

---

## Feature selected

A collapsible **Personal Records** section at the top of the History tab that
lists, per exercise: best weight ever lifted, best reps in a single set, session
count, and the date each PR was achieved.

---

## Why selected

The `exerciseHistoryStore` (added in the previous session, PR #66) was designed
precisely to enable this view. Its `records` array already contains per-session
`maxLoad` and `maxReps` values. No new data collection, no schema changes, no
new dependencies — the store just needed a display surface.

---

## Alternatives considered

| Option | Cost | Note |
|---|---|---|
| Full per-exercise trend chart | High | Requires a charting library |
| PR badges inline on each history entry | Medium | Cross-entry comparison at render time |
| **Collapsible table in History tab** | **Low** | Reuses existing store data, one new component |

---

## Scope

In scope:
- `PersonalRecordsSection` collapsible component in `HistoryPage.tsx`
- `computePersonalRecords(records, planId)` pure helper — exported and testable
- `PersonalRecord` TypeScript interface — exported
- Plan-filter scoping via existing `filterPlanId` state

Out of scope (future):
- Per-exercise history trend charts
- Volume PRs (total weight moved in a session)
- PR progress arrows (↑/↓ vs. last session)

---

## Risks

Low. Read-only. No writes. No store mutations. The only new state is a
`boolean` inside the component.

---

## Rollback strategy

Delete the `PersonalRecordsSection` component, the `computePersonalRecords`
helper, the `PersonalRecord` interface, and the three `useMemo`/JSX lines in
`HistoryPage`. No data migration needed.
