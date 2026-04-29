# Feature Proposal — Rotation Cycle Progress on TodayPage

Date: 2026-04-29
Branch: `claude/great-mccarthy-TJqjV`
Status: **Implemented this run**

---

## Feature selected

Rotation cycle progress indicator on TodayPage. For `rotations`-duration plans,
show how many workouts have been logged in the **current** rotation cycle and
how many remain, inline with the existing "Day X of N in rotation" subtitle.

---

## Why selected

The existing "Day X of N in rotation" text shows the rotation *pointer* (which
workout slot is active today), not progress through the cycle. Users had no
direct answer to "how close am I to finishing this rotation?" without mentally
tracking logged workouts themselves. The nudge is small, additive, and requires
no new UI infrastructure.

---

## Expected user value

- Motivational milestone awareness: "I've done 5 of 6 — almost there!"
- Celebrates completing a full rotation with a brief "rotation complete!" state.
- Differentiates the pointer position from actual workout completion count.

---

## Implementation scope for this run

1. Pure helper `computeRotationCycleProgress(plan, entries)` in `historyStats.ts`.
2. Import and compute `cycleProgress` in `TodayPage`.
3. Display inline with the existing subtitle — no new UI components.
4. 8 unit tests covering all branches of the helper.

---

## Assumptions made

- `day_off` entries do not count toward cycle progress (mirrors `isPlanExpired`
  and `computePlanProgress` — day_off advances the calendar but not the rotation).
- `weeks`-duration plans return `null` (cycle concept doesn't apply).
- Display only when `cycleProgress !== null` (i.e., rotations plans only).

---

## Open product / UX decisions

- Should "rotation complete!" persist until the next workout is logged, or
  auto-dismiss after a short delay?
- Should the cycle progress appear inline (current approach) or as a fourth
  stat tile in the stats bar?
- Should a completed rotation trigger a more prominent celebration (e.g., the
  confetti / party-popper banner already used for plan expiry)?

---

## Architecture / schema impact

- No schema changes. New pure function only reads existing `HistoryEntry[]`.
- No store changes.

---

## Risks

- Low. The feature is purely additive and display-only.
- The "rotation complete!" micro-state (doneInCycle === 0 after ≥1 full cycle)
  shows briefly and resolves once the next workout is logged. Could feel like
  a stale/wrong state to some users.

---

## Rollback strategy

Revert the single commit that adds the helper call in TodayPage. The helper
itself can stay in `historyStats.ts` (it's tested and inert if not called).

---

## What is intentionally not built yet

- Prominent rotation-complete celebration (deferred — the expiry banner pattern
  already handles plan completion; a per-rotation celebration is a different UX).
- Cycle progress on Plans page or Calendar page.
- `weeks`-plan equivalent (days remaining in the week, etc.).
