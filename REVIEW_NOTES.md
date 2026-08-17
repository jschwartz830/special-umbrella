# Review Notes — Overnight Audit Passes

## Pass 4 — 2026-08-17

**Summary:** Dedup consistency audit across `historyStats.ts` + longest-streak feature.

### Issues found and fixed

1. **`computeWeeklyBreakdown` missing dedup** *(bug, low severity)*
   Two `(planId, calendarDate)` entries for the same day inflated weekly
   counts. Fixed with a pre-pass `dateMap` keeping newest `createdAt`.
   No user-visible symptom in typical usage (duplicates are rare in practice),
   but data-import and rapid-log paths can produce them.

2. **`computeWorkoutTypeBreakdown` missing dedup** *(bug, low severity)*
   Same root cause. Both `completed`/`skipped` counts and `avgEffort`/
   `avgDurationMin` averages could be skewed by duplicate entries.
   Fixed with `entryMap` keyed on `planId__calendarDate`.

3. **`computeLongestPlanStreak` missing** *(gap)*
   `computeHistoryStats` exposes `longestStreak` (global). The plan-scoped
   `computePlanStreak` had no longest-streak equivalent. Added
   `computeLongestPlanStreak` and surfaced it in the Plan Progress modal.

### Patterns not changed

- `computeHistoryStats` global streak — already correct (uses `Set<string>`,
  no dedup needed).
- `getStreakDatesSet` — correctly deduplicated (Set semantics).
- `computePlanStreak` / `computeCurrentStreakDates` — same, Set-based.
- `computeWorkoutCompletionRate` — already has the `dateMap` dedup pattern
  (this was the reference for the new fixes).

### Out of scope / deferred

- No `computeLongestPlanStreak` for CalendarPage streak-highlight visualization
  (would require date-set return, not just a count; low demand).
- No `planId`-scoped `computeLongestPlanStreak` exposed in HistoryPage
  (global is sufficient for now; easy to add later).

---

## Pass 3 — 2026-08-16

*See prior REVIEW_NOTES.md for full detail. Summary: expression evaluator
robustness; `computeWorkoutCompletionRate` dedup; calendar/jump interaction bug.*

## Pass 2 — 2026-08-15

*Rotation engine correctness; store migration coverage; test coverage expansion.*

## Pass 1 — 2026-08-14

*Initial codebase audit; IMPLEMENTATION_PLAN.md written; no code changes.*
