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
