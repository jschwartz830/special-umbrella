# Implementation Plan

## 2026-04-29 — Overnight Audit (seventeenth pass)

Branch: `claude/dreamy-mccarthy-vrC4L`.
Baseline on entry: **311 passing, 0 failing**.
Exit state: **315 passing, 0 failing** (+4 tests).

### Architecture summary (unchanged)

Stack, store split, and engine layering match all prior audits. No
architectural drift since the sixteenth pass. All previous PRs (#27–#54)
merged into this branch, so the baseline already includes active-workout
tracking, historical workout logging, plan builder, YAML import, double-day
support, CSV import/export, drag-and-drop, settings tab, and the rotation
cycle progress indicator.

### What appears strong and well-designed (unchanged)

- 315-test suite covering engine, stores, adaptation, lib, CSV, and
  recommendation.
- All prior bug fixes from passes 1–16 remain stable; no regressions.
- Clean separation between pure engine logic and React UI.
- `computePlanProgress` and `computeRotationCycleProgress` are well-tested
  pure helpers that UI can safely build on.

### Key issues found this pass

1. **"0/N done" cycle progress shown at plan start** (UX BUG).
   `cycleProgress.doneInCycle === 0` at the start of a rotations plan
   (no history yet), and the prior condition `!justCompletedRotation` was
   true, so "0/3 done" was displayed in the subtitle. This is noise — no
   action has been taken. Fixed by checking `doneInCycle > 0`.

2. **`bonusOutcome` OutcomeModal missing `previousSetsByExercise`** (UX GAP).
   The double-day bonus workout modal (opens automatically after confirming
   the primary workout) did not receive the `previousSetsByExercise` prop.
   This meant historical weight data was unavailable for pre-filling in the
   bonus modal, even though the data was already computed and used by the
   primary and upcoming workout modals. One-line fix.

3. **`CalendarPage` "Resume workout" used projected `planDay` not logged one**
   (LOGIC BUG). The "Resume workout" link in the DayDetailModal level-1 view
   passed `resolved.planDay` to `startHistoricalResume`. If earlier entries
   were deleted or edited after a workout was logged, the rotation projection
   for that date could point to a different day than was actually logged.
   The `ActiveWorkoutTracker` would then show the wrong exercises. Fixed by
   using `resolved.historyEntry?.planDayIndex ?? resolved.planDayIndex` to
   look up the correct `PlanDay`, with a safe fallback. Mirrors TodayPage's
   `primaryPlanDayIndex` pattern.

4. **`weeks`-duration plans had no progress signal on TodayPage** (FEATURE GAP).
   Pass 16 added "3/6 done" for rotation plans. Weeks plans showed only
   "Day X of N in rotation" with no calendar-week progress. `computePlanProgress`
   already computed this correctly and was already tested. Added "Week X of Y"
   inline with an optional "last week!" micro-label, symmetric with the
   rotation cycle treatment.

### What appears strong and well-designed (this pass)

- The `computePlanProgress` / `computeRotationCycleProgress` split is paying
  off: the weeks-plan feature required zero new pure logic, only one import
  and ~10 JSX lines.
- The `historyEntry?.planDayIndex` fallback pattern now consistently applied
  in TodayPage (primaryPlanDayIndex), CalendarPage DayDetailModal (resume),
  and CalendarPage `openEditOutcome`.

### Prioritized plan

| Priority | Item | Risk | Status |
|----------|------|------|--------|
| 1 | Fix "0/N done" at plan start | None | ✅ Done |
| 2 | Pass previousSetsByExercise to bonus modal | None | ✅ Done |
| 3 | CalendarPage resume uses correct planDay | Low | ✅ Done |
| 4 | Week progress indicator on TodayPage | Low | ✅ Done |
| 5 | Tests for week-progress boundary conditions | None | ✅ Done |

### Rationale for sequencing

Bugs first (items 1–3), in order of user-facing impact. The feature (4)
was selected because it reuses existing, tested infrastructure with minimal
new surface area and creates parity between the two plan-duration types.
