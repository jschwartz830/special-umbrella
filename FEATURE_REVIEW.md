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
