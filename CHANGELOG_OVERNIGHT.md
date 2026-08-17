# Overnight Changelog — 2026-08-17

## Bug Fixes

### `computeWeeklyBreakdown` — dedup rotation entries by calendarDate
**File:** `src/lib/historyStats.ts`

The function iterated raw `HistoryEntry[]` without deduplication. If a user's
store contains duplicate `(planId, calendarDate)` entries (possible during rapid
retroactive logging or data import), weekly counts (`completed`, `skipped`,
`dayOffs`, `totalLogged`) would be inflated — one workout counted twice in the
same ISO week.

**Fix:** Added a pre-pass `dateMap` keyed on `calendarDate` (planId already
filtered) that keeps only the entry with the highest `createdAt`. The counting
loop then iterates the deduplicated map. This matches the pattern already in use
by `computeWorkoutCompletionRate`.

**Tests added:** 2 new cases in `describe('computeWeeklyBreakdown')`.

---

### `computeWorkoutTypeBreakdown` — dedup rotation entries by (planId, date)
**File:** `src/lib/historyStats.ts`

Same class of bug: the rotation-entry loop did not deduplicate. Duplicate
entries inflated per-type `completed`/`skipped` counts and skewed `avgEffort`
and `avgDurationMin` (outcome data was double-counted).

**Fix:** Pre-pass `entryMap` keyed on `${planId}__${calendarDate}`, newest
`createdAt` wins. The counting loop then iterates the deduped map.

**Tests added:** 3 new cases in `describe('computeWorkoutTypeBreakdown')`.

---

## Features

### `computeLongestPlanStreak` — new export in `historyStats.ts`
**File:** `src/lib/historyStats.ts`

Added `computeLongestPlanStreak(planId, entries, extras, today, additionalDates?)`.
Accepts the same arguments as `computePlanStreak` but walks the full sorted
history rather than just backward from today, returning the length of the
longest consecutive-day run ever recorded.

Reuses the existing `getStreakDatesSet` building block — the same day-qualification
rules (complete/day_off/extras count; skip alone does not; `additionalDates`
bridging) and the same plan-scoping behaviour (null = global).

**Tests added:** 13 new cases in a new `describe('computeLongestPlanStreak')` block.

---

### Longest streak row in Plan Progress modal
**Files:** `src/pages/TodayPage.tsx`, `src/components/today/TodayPlanProgressModal.tsx`

`TodayPage` now computes `longestPlanStreak` (global/mobility-inclusive,
matching `planStreak`) and passes it as a new `longestPlanStreak` prop to
`TodayPlanProgressModal`.

The modal shows a `🏆 N days` "Longest streak" row immediately below
"Current streak" when `longestPlanStreak > 0`. Hidden for new users before
any history exists.

---

## Test Suite

| Pass | Tests |
|------|-------|
| Before | 1262 |
| After  | 1280 |
| New    | +18  |

All 1280 tests pass. TypeScript strict-mode clean (`tsc --noEmit` exits 0).
