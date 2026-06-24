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

# Overnight Changelog — 2026-06-21

## [1] fix: align computeRotationCycleProgress and computeRotationPlanRemaining with isPlanExpired deduplication

**Summary**: Both functions counted raw `entries.length` without deduplicating by calendarDate, unlike `isPlanExpired` which uses a Set. Fixed both to use the same Set-based dedup, making all three rotation-count functions consistent.

**Files changed**:
- `src/lib/historyStats.ts` — `computeRotationCycleProgress` and `computeRotationPlanRemaining` now deduplicate via `new Set(…dates)`

**Why it matters**: A malformed CSV import could produce two entries for the same date. Previously, `isPlanExpired` would show the plan as not-yet-expired while `computeRotationCycleProgress` would count the day twice — producing a "1/3 done this rotation" display that's actually wrong.

**Risks**: None. Behaviour is identical for stores with no duplicate dates (the normal case). The fix only matters when duplicates exist.

**Rollback**: Revert `src/lib/historyStats.ts`.

---

## [2] feat: add countTotalUnloggedDays utility

**Summary**: New exported function in `historyStats.ts` that scans ALL history (no lookback cap) to return the total number of unlogged days since plan start.

**Files changed**:
- `src/lib/historyStats.ts` — new `countTotalUnloggedDays` function

**Why it matters**: Enables UI to show the full scope of a rotation stall, separate from the bounded list used for catch-up actions.

**Rollback**: Remove the function and its import from TodayPage.

---

## [3] fix: extend unlogged-days catch-up window from 7 to 14 days

**Summary**: The stall-detection nudge on TodayPage previously looked back only 7 days. Users returning after two weeks would only see half their gap in the catch-up list. Now looks back 14 days. Also surfaces older gap count if gaps exist beyond 14 days.

**Files changed**:
- `src/pages/TodayPage.tsx` — `lookbackDays=14`, updated nudge text, new `olderUnloggedCount` display

**Why it matters**: A 14-day gap is a common return-from-vacation scenario. The user needs to see all affected dates to understand the full stall before deciding whether to bulk-mark them as Day Off.

**Tradeoffs**: 14 days is still a cap. Users returning after a month will now see 14 recent gaps + an older count, not all gaps individually. The catch-up action only fixes the visible 14; older gaps need Calendar. This is intentional — a 30+ item list in the catch-up modal would be overwhelming.

**Rollback**: Change `lookbackDays=14` back to `7` in TodayPage and update nudge text.

---

## [4] feat: personal record celebration banner on TodayPage

**Summary**: After logging a workout with weights, the app now detects if any exercise hit a new personal record (all-time max load exceeded) and shows a dismissible amber banner.

**Files changed**:
- `src/pages/TodayPage.tsx` — `newPRs` state, detection in `handleOutcomeConfirm`, banner JSX, Trophy icon

**Why it matters**: The app already tracked PRs via `exerciseHistoryStore` and displayed them in HistoryPage, but there was no in-context feedback at the moment of achievement. Adding it closes the immediate-feedback loop that motivates continued logging.

**Implementation**: Snapshot `maxLoadByExercise` before calling `logOutcomeWithProgression` (the store update is sync but the memoized value in the component is still pre-workout). Compare each completed set's `actualLoad` against the snapshot. Difference > 0 means PR.

**Risks**: 
- Banner appears if the user _edits_ a workout and the edit increases a load above the pre-edit record. This is technically correct (they did set a PR) but may feel unexpected if they're re-logging an old session with corrected data. Acceptable for v1.
- Dismissing the banner with the X button or clicking Undo both clear `newPRs`. 

**Rollback**: Remove `newPRs` state, detection block in `handleOutcomeConfirm`, and banner JSX from TodayPage. Remove Trophy from lucide import.

---

## [5] docs: document local date-string timezone convention in rotationEngine.ts

**Summary**: Added a block comment explaining that all calendarDate values are local-timezone YYYY-MM-DD strings and documenting the known limitation for timezone travelers.

**Files changed**:
- `src/engine/rotationEngine.ts` — block comment after imports

**Rollback**: Remove the comment block.

---

## [6] test: 12 new tests for deduplication fixes and new utilities

**Summary**: Tests for the two deduplication fixes, `countTotalUnloggedDays`, and the 14-day lookback behavior.

**Files changed**:
- `src/lib/__tests__/historyStats.test.ts` — 4 new `describe` blocks, 12 new test cases

**Test count**: 923 → 935 (+12 tests)
