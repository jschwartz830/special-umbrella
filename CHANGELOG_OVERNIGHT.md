# Overnight Change Log — 2026-09-15

Three changes shipped in branch `claude/admiring-noether-2d6ce2`.

---

## Fix: `computePersonalRecords` 0-load / 0-reps guard

**File:** `src/lib/historyStats.ts`

Bodyweight-only sessions (`maxLoad = 0`) and unrecorded-reps sessions
(`maxReps = 0`) were being surfaced as personal-record entries in the PR
table with a load or rep count of 0.  `buildPRFlagsMap` already treats 0
the same as null; `computePersonalRecords` now applies the same guard.

Before the fix a Push-up session logged without a weight would set
`maxLoadDate` to that date and display "0 lb PR" in the PR table.

**Tests added:** 3 new cases in `src/lib/__tests__/historyStats.test.ts`
under `describe('computePersonalRecords')`:
- 0-load session → `maxLoad` and `maxLoadDate` are null
- 0-reps session → `maxReps` and `maxRepsDate` are null
- Mixed session (0-load + real-load) → only the real load is the PR

---

## Fix: Undo multi-advance override bug

**File:** `src/pages/TodayPage.tsx`

When a user logs two sequential double-day advances in a single session
and then presses Undo, the previous code used a boolean flag
(`removedDoubleDay`) so only one `advance` override was ever removed from
`historyStore`, leaving the rotation pointer one step ahead.

The flag was replaced with a counter (`advancedRotationCount`) that
increments once per removed extra with `advancedRotation` set.
`removeLastOverrideByType` is then called once per count, correctly
unwinding every advance.

---

## Feature: Last-week recap banner

**Files:** `src/hooks/useLastWeekSummary.ts` (new),
`src/components/today/TodayBanners.tsx`, `src/pages/TodayPage.tsx`

A dismissable "Last week recap" card appears on the Today page on Mondays,
summarising the previous ISO week's activity for the active plan:
completed workouts, bonus sessions, skips, and rest days.

- **Hook** (`useLastWeekSummary`) — pure read-only; returns null on
  non-Mondays or when last week had no logged activity.  Dismissal is
  keyed to `planId + weekStart` so the banner resets automatically each
  new Monday without any manual cleanup.
- **Banner** — sky-toned card at the top of the banners stack, with an
  ✕ dismiss button.  Zero new state mutations; all infrastructure
  (`computeWeeklyBreakdown`, `useDismissableBanner`) was pre-existing.
