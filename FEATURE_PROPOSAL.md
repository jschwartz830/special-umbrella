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
