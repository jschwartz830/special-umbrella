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

---

## 2026-04-30 — Overnight Audit (eighteenth pass)

Branch: `claude/dreamy-mccarthy-Ymdp2`.
Baseline on entry: **315 passing, 0 failing**.

### Architecture summary (unchanged)

Stack, store split, and engine layering match all prior audits. No
architectural drift since the seventeenth pass. All previous PRs (#27–#60)
merged, so the baseline already includes active-workout tracking, plan builder,
YAML import, double-day support, CSV import/export, exercise library GUI,
settings version stamp, and week/rotation progress indicators.

### What appears strong and well-designed (unchanged)

- 315-test suite, no regressions across 17 prior passes.
- Pure-function rotation engine with thorough test coverage.
- Clean store isolation: `historyStore`, `outcomeStore`, `planStore`, `programStore`.
- `extraToPlanDay` adapter pattern (used in 3 places) is a clean seam even
  though it is currently duplicated.

### Key issues found this pass

1. **`HistoryPage` stale `entries` closure in `handleOutcomeConfirm`** (LOGIC BUG).
   When a user edits a workout outcome in HistoryPage and changes both the
   `completedAt` date AND the completion state (e.g., from `skip` → `partially_completed`),
   the final `updateAction` call silently fails. The function captures `entries`
   from the React render closure. After calling `updateEntryDate(...)`, the
   closure-captured `entries` still has the entry at the _old_ date, so
   `entries.find(e => e.calendarDate === completedDate)` returns `undefined`,
   and `updateAction` is never called. The outcome saves correctly (it goes
   through `logOutcomeWithProgression`), but the history entry action (shown
   as the label in the list: "Completed" / "Skip" / "Partial") does not update
   to match. Fixed by reading from `useHistoryStore.getState().entries` instead
   of the stale closure, consistent with the TodayPage pattern.

2. **`extraToPlanDay` duplicated in TodayPage, CalendarPage, HistoryPage** (CODE QUALITY).
   Three identical copies of the same 6-line helper across three files. Any
   future extension to extra workout PlanDay construction (e.g., adding notes
   or difficulty) would require updating all three. Extracted to
   `src/lib/planDayUtils.ts` and imported everywhere.

3. **`computeWorkoutTypeBreakdown` under-tested** (TEST GAP).
   The effort-averaging path and date-range filter were untested. Edge cases
   (zero-effort outcomes, extras-only workouts, planDaysById=null) had no
   coverage. Added 7 new tests.

4. **`getResolvedDaysRange` (calendar projection) had no direct tests** (TEST GAP).
   The calendar projection function is the most complex in the engine and
   handles past/today/future pointer logic with overrides. The existing
   calendarProjection test file only tested `buildMonthGrid`. Added 6 direct
   tests covering past-unlogged stall, today boundary, future projection, and
   override application.

### Feature selected: previous-session summary on TodayPage

Added a compact "Last: 3×8 @ 135 lb" or "Last: 2.5 mi in 28 min" inline
hint below today's WorkoutDayCard, visible only when the workout is pending
and a prior session for the same `planDayIndex` exists. This closes the most
common friction point of "what weight did I use last time?" without requiring
the user to open the outcome modal. See FEATURE_PROPOSAL.md for full rationale.

### What appears strong and well-designed (this pass)

- The `primaryPlanDayIndex` pattern in TodayPage (historyEntry?.planDayIndex
  fallback) is solid and already tested indirectly via the engine tests.
- `computeWorkoutTypeBreakdown` is a well-factored pure function that was
  just missing tests for the effort path.

### Prioritized plan

| Priority | Item | Risk | Status |
|----------|------|------|--------|
| 1 | Fix HistoryPage stale entries closure | Low | ✅ Done |
| 2 | Extract extraToPlanDay to shared utility | None | ✅ Done |
| 3 | Add computeWorkoutTypeBreakdown tests | None | ✅ Done |
| 4 | Add getResolvedDaysRange tests | None | ✅ Done |
| 5 | Previous-session inline summary (feature) | Low | ✅ Done |

### Rationale for sequencing

Bug fix first (1), then refactor (2), then tests (3–4) to improve baseline
confidence before adding the feature (5). The feature was selected because
`findPreviousWeightsOutcome` and `previousSetsByExercise` were already computed
at the TodayPage level — adding the summary required no new data fetching.
