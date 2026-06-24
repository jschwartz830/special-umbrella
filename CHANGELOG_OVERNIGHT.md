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

---

# Overnight Changelog — 2026-06-24

## [1] fix: deduplicate calendarDate in computeRotationCycleProgress

**Summary**: Fixed a stat-computation inconsistency where `computeRotationCycleProgress` counted raw entry array length instead of unique calendar dates, causing the cycle counter to inflate when duplicate entries exist for the same day.

**Files changed**:
- `src/lib/historyStats.ts` — replaced `.length` with `new Set(...calendarDate).size`

**Why it matters**: Every other rotation-count function in the codebase (`computePlanProgress`, `isPlanExpired`, `computeCurrentDayIndex`) deduplicates by calendar date. This function was the only exception. A re-imported CSV with two entries for the same day would cause `justCompletedRotation` to fire a cycle too early and `doneInCycle`/`remaining` to display wrong values in TodayPage stats.

**Risks / tradeoffs**: None — the fix makes this function consistent with all peer functions. No store shape or API surface changes.

**Rollback**: `git revert` this commit. The stat will return to the over-counting behaviour.

---

## [2] fix: deduplicate calendarDate in computeRotationPlanRemaining

**Summary**: Same dedup fix applied to `computeRotationPlanRemaining`. The `done` count was inflated by duplicate entries, making the "workouts remaining" display show fewer sessions than the user actually needs to complete the plan.

**Files changed**:
- `src/lib/historyStats.ts` — replaced `.filter(...).length` with `new Set(...calendarDate).size`

**Why it matters**: If a user's remaining count is under-reported, they might think they're nearly done with a plan when they aren't. Low frequency but real impact.

**Risks / tradeoffs**: Same as above — pure alignment with existing pattern, no API change.

**Rollback**: `git revert` this commit.

---

## [3] test: regression tests for calendarDate dedup in rotation stats

**Summary**: Added 2 tests to `historyStats.test.ts` — one per fixed function — that confirm duplicate entries for the same date are counted as one, not two.

**Files changed**:
- `src/lib/__tests__/historyStats.test.ts` — 2 new `it` blocks

**Why it matters**: Both tests explicitly fail against the pre-fix code and pass after. They act as regression guards so this class of inconsistency can't creep back in.

**Risks**: None — purely additive test coverage.

---

**Test count**: 923 → 925 (+2 tests in 1 extended file)
