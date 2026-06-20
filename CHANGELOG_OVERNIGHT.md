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
