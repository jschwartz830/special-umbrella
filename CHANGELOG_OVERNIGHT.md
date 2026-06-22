# Overnight Changelog — 2026-06-22

## [1] fix: deduplicate calendarDate in computeRotationCycleProgress and computeRotationPlanRemaining

**Summary**: Two functions in `historyStats.ts` were counting raw entry length instead of unique calendar dates, making them inconsistent with `isPlanExpired` and `computePlanProgress` which explicitly deduplicate. Duplicate entries (possible after CSV re-import) would inflate `doneInCycle`, falsely trigger `justCompletedRotation`, and under-report remaining workouts on TodayPage.

**Why it matters**: TodayPage displays both cycle progress and "X workouts left." Inflated counts produce a false "you finished a rotation!" banner and incorrect remaining-workouts count when duplicate entries exist.

**Files changed**:
- `src/lib/historyStats.ts` — replaced `.length` with `new Set(dates).size` in both functions
- `src/lib/__tests__/historyStats.test.ts` — added 2 regression tests (one per function)

**Risk**: None. Both changes are purely additive in correctness; in normal usage (single entry per date) the behavior is identical.

**Rollback**: `git revert 9855b1d`

---

## [2] feat: streak-date ring highlight in CalendarPage

**Summary**: `computeCurrentStreakDates` was exported and tested but never used in any UI component. Wired it into CalendarPage's calendar grid so cells belonging to the current plan-scoped streak display a subtle `ring-1 ring-emerald-500/40` border, making the active streak visible at a glance without disrupting the existing background color system. The `today` cell is exempt (already highlighted in sky-blue).

**Why it matters**: The streak stat is shown on TodayPage but had no calendar-level visual representation. Users can now see exactly which days form their current run at a glance.

**Files changed**:
- `src/pages/CalendarPage.tsx` — added `computeCurrentStreakDates` import, `streakDates` useMemo, `streakRing` class in cell render

**Risk**: Very low. Purely additive rendering change. No state, no logic change.

**Rollback**: `git revert e40002b`

---

# Overnight Changelog — 2026-06-19

## [1] feat: Copy workout to clipboard from TodayPage

**Summary**: Added a copy-to-clipboard button next to "Start Workout" so users can share or save their planned workout as plain text.

**Files changed**:
- `src/pages/TodayPage.tsx` — added `Copy` icon button, `workoutCopied` state, `handleCopyWorkout()` handler
- `src/lib/shareWorkout.ts` — new pure utility `formatWorkoutForClipboard(planDay, planName, dateLabel)`

**Details**:

The copy button appears only when the workout is pending and the active tracker is hidden (same visibility condition as "Start Workout"). Tapping it:

1. Formats the workout as human-readable plain text via `formatWorkoutForClipboard`.
2. Writes to `navigator.clipboard.writeText()` — errors are silently swallowed (clipboard permission denied is a non-fatal failure).
3. The button briefly turns emerald (2 s) to confirm success, then resets.

Example output:
```
Push Day — Mon, Jun 19
Plan: Strength Block

Chest & Shoulders (weights)
  • Bench Press: 5x5 @ 185lb
  • Overhead Press: 4x8 @ 115lb
  • Push-up: 3xmax
```

No new dependencies. Feature is purely additive and independently revertable.

---

## [2] test: add shareWorkout tests (15 cases)

**Summary**: Full test coverage for `formatWorkoutForClipboard` across all slot types and edge cases.

**Files changed**:
- `src/lib/__tests__/shareWorkout.test.ts` — new file

**Details**: Covers day/plan label, rest slot, weight exercises (with/without load), run distance, structured segments, `SetSpec[]`, `structureDescription`, `durationMin`, `notes`, no trailing whitespace, multiple slots.

---

## [3] test: add planDayUtils tests (8 cases)

**Summary**: First-ever tests for `extraToPlanDay()` — this function had zero test coverage despite being used in TodayPage and CalendarPage.

**Files changed**:
- `src/lib/__tests__/planDayUtils.test.ts` — new file

**Details**: Covers id, label, slot count, slot fields, all 8 WorkoutType values, and valid PlanDay shape.

---

## [4] test: add outcomeSortKey tests (9 cases)

**Summary**: First-ever tests for `outcomeSortKey()` — this function had zero test coverage despite being the primary sort key for outcome lists.

**Files changed**:
- `src/lib/__tests__/outcomeSortKey.test.ts` — new file

**Details**: Covers completedAt present, fallback to calendarDate, undefined completedAt, empty string for bad instanceId, relative sort ordering (datetime > date-only, chronological), extra-workout instanceId format, and planIds with underscores.

---

## [5] test: add addOverride tests (6 cases)

**Summary**: `historyStore.addOverride` had no direct test coverage. Added a dedicated describe block.

**Files changed**:
- `src/store/__tests__/historyStore.test.ts` — extended

**Details**: Covers generated id uniqueness, type propagation, appliedAt default vs custom, targetDayIndex for jumps, and accumulation without replacement.

---

**Test count**: 887 → 923 (+36 tests across 3 new files + 1 extended file)
