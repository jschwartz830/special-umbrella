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

## Pass 62 — 2026-06-23

### Change 1: Fix discard-changes dialog for new outcome forms

**Summary**: Removed `existingOutcome &&` from `handleClose` in `OutcomeModal`, so the "Discard changes?" confirmation appears whenever the form is dirty — not just when editing an existing outcome.

**Why it matters**: A user who fills in effort, run distance, and notes, then accidentally taps the X button, would previously lose all that data silently. The discard warning should protect any form with unsaved changes, regardless of whether it's a new log or an edit.

**Files changed**: `src/components/workout/OutcomeModal.tsx`

**Risk**: None — the only behavior change is that a new (not existing) dirty form now shows a confirmation before closing.

**Rollback**: Revert the single-line change to `handleClose`.

---

### Change 2: Fix floating-point rounding in run progression distance

**Summary**: Added `Number.EPSILON` to `roundMiles` in the run-adaptation engine: `Math.round((miles + Number.EPSILON) * 100) / 100`.

**Why it matters**: Without epsilon, values exactly at a rounding midpoint (e.g. `1.005`) can round down due to binary floating-point representation: `1.005 * 100 = 100.4999...`. This is correct defensive practice for any function that rounds decimal values derived from arithmetic.

**Files changed**: `src/modules/run-adaptation/engine.ts`

**Risk**: Negligible. With the default 0.5-mile step, this fix produces no change in observable behavior. Only custom sub-0.5-mile step sizes could expose the underlying issue.

**Rollback**: Revert the comment + epsilon change to `roundMiles`.

---

### Change 3: Previous session notes hint in OutcomeModal

**Summary**: Added an optional `prevNotes` prop to `OutcomeModal`. When logging a *new* (not editing) workout, if the previous session for the same plan day had notes, they appear as a read-only italic hint above the notes textarea: _Last time: "felt tight in the hips"_.

**Why it matters**: Users often don't remember what they wrote last session. The hint surfaces this context at exactly the right moment — while they're filling in today's notes — without requiring navigation away.

**Files changed**: `src/components/workout/OutcomeModal.tsx`, `src/pages/TodayPage.tsx`

**Risk**: Additive-only. The prop is optional; CalendarPage and HistoryPage are unaffected. The hint is hidden when `prevNotes` is empty or when editing an existing outcome.

**Rollback**: Remove the `prevNotes` prop from OutcomeModal's interface/destructuring, remove the hint JSX block, and remove `prevNotes={...}` from TodayPage's OutcomeModal call.

---

**Test count**: 923 → 923 (no change — existing 923 tests still pass; changes were to runtime behavior, not new logic branches requiring new tests)
