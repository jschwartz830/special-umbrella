# Overnight Changelog — 2026-06-28

## [1] feat: copy-workout button on CalendarPage day detail view

**Summary**: Users can now copy any rotation workout to the clipboard from the CalendarPage day detail modal. A "Copy workout" button appears in the Level 2 rotation detail view (below the workout slot details) for all date types: past, today, upcoming, and future. Tapping it calls `formatWorkoutForClipboard` and writes plain text to the system clipboard. The button turns green for 2 seconds after a successful copy.

**Why it matters**: TodayPage has had this button since pass 61. Extending it to CalendarPage lets users share historical workouts, preview scheduled training blocks, and quickly reference any day's plan without navigating away. This was recommended in both pass 63 and pass 64 review notes.

**Files changed**:
- `src/pages/CalendarPage.tsx` — added `Copy` icon import, `formatWorkoutForClipboard` import, `copied` state in `DayDetailModal`, and button JSX in the Level 2 rotation view.

**Risks / tradeoffs**: Purely additive. `navigator.clipboard.writeText()` errors (permission denied in some embedded contexts) are silently caught — same pattern as TodayPage. The `Copy workout` button is not shown when `isDayOff` since there's no workout content to copy.

**Rollback**: Revert the CalendarPage commit. Zero data model changes.

---

## [2] fix: CardioWorkoutTracker timer now reconciles with wall clock on resume

**Summary**: The cardio session timer previously used simple 1-second interval accumulation (`s + 1` on each tick). On iOS, browsers throttle or fully pause `setInterval` when the page is backgrounded. If a user locked their phone during a run, the displayed time and the duration reported to OutcomeModal would fall behind the actual elapsed time.

**Root cause**: `CardioWorkoutTracker` was authored without the wall-clock pattern that `ActiveWorkoutTracker` uses. The pattern is: store `{ elapsed, time }` as a base; each tick computes `baseElapsed + Math.floor((Date.now() - baseTime) / 1000)` rather than incrementing. A `visibilitychange` handler triggers an immediate reconcile on foreground restore.

**Fix**:
- Added `totalElapsedRef` and `segmentElapsedRef` (ref shadows of state) so callbacks avoid stale-closure bugs without `useCallback` deps.
- Added `wallTotalRef` and `wallSegRef` (`{ elapsed, time }` bases) updated each time the timer starts/resumes.
- Changed the `[isPaused]` effect to capture the current values into `wallTotalRef` / `wallSegRef` on each start, then compute from those bases in the interval.
- Added a `visibilitychange` effect for immediate display update on foreground restore.
- Updated `goNext`, `goPrev`, and `finish` to reset `wallSegRef` on segment advance and use `totalElapsedRef.current` in `onComplete` callbacks.

**Files changed**:
- `src/components/workout/CardioWorkoutTracker.tsx` — 48 insertions, 8 deletions. Pure timer logic refactor; JSX and rendering are unchanged.

**Risks / tradeoffs**: The fix changes internal computation only — no API surface, no data model, no props change. The new approach is identical to the proven `ActiveWorkoutTracker` pattern. `tsc --noEmit` exits clean.

**Rollback**: Revert the CardioWorkoutTracker commit.

---

## [3] test: unit tests for mobilityStore (18 tests)

**Summary**: The `mobilityStore` added in the previous human-authored feature commit had no unit test coverage. Added `src/store/__tests__/mobilityStore.test.ts` with 18 tests covering all 6 store actions and default state.

**Why it matters**: Every other Zustand store in the project has tests. `mobilityStore` is the data layer for the new daily mobility routine feature — bugs in reorder or removal logic could silently corrupt the user's routine. Completing coverage brings the test suite to parity.

**Files changed**:
- `src/store/__tests__/mobilityStore.test.ts` — new file, 195 lines, 25 test files total.

**Risks / tradeoffs**: Tests are read-only. The `persist` middleware is mocked as a pass-through (same pattern as all other store test files). `resetStore` uses `setState` to restore the default routine between tests so they are fully isolated.

**Rollback**: Delete `src/store/__tests__/mobilityStore.test.ts`.

---

# Overnight Changelog — 2026-06-27

## [1] fix: Undo after double-day now removes the advance override

**Problem**: When a user logs a double-day workout, the flow adds an `advance` override to
the history store (to shift the rotation pointer forward) alongside a `double_day`
`ExtraWorkoutEntry`. The Undo button on TodayPage correctly removed the primary entry,
outcome, and double-day extras, but did NOT remove the `advance` override. After pressing
Undo, the rotation pointer remained one step ahead permanently — the user would see the
day-after-next as "upcoming" instead of the correct next day.

**Root cause**: The `advance` override is appended to `historyStore.overrides` by
`actions.advance()` inside the double-day branch of `handleOutcomeConfirm`. The Undo
handler had no mechanism to remove a specific override by type — only
`removeRetroJumpForDate` (date-scoped jump removal) and `clearPlanHistory` (destructive)
existed.

**Fix**:
- Added `removeLastOverrideByType(planId, type)` to `HistoryState` interface and
  implemented it in the Zustand store. It sorts matching overrides by `appliedAt`
  descending and removes only the most recent one — the minimum intervention to undo
  a single double-day's advance.
- Updated the Undo handler to track whether any `double_day` extras were removed, and
  call `removeLastOverrideByType(plan.id, 'advance')` when they were.

**Files changed**:
- `src/store/historyStore.ts` — `HistoryState` interface: added `removeLastOverrideByType`
  signature; `create()` body: added implementation
- `src/pages/TodayPage.tsx` — added `removeLastOverrideByType` store selector; updated
  Undo `onClick` to track `removedDoubleDay` flag and call the new action
- `src/store/__tests__/historyStore.test.ts` — 7 new tests covering the new action

**Risk**: Low. `removeLastOverrideByType` is a targeted filter — it cannot affect entries
or extras, and only touches the most recent override of the named type. The Undo handler
only calls it when it already confirmed a double_day extra was removed, so the code path
is strictly narrower than before. Easily reverted.

---

# Overnight Changelog — 2026-06-26

## [1] fix: enforce 7-day minimum before showing adherence bar

**Problem**: The comment on `loggedRate` in `TodayPage.tsx` stated the adherence bar
was "shown after plan has been active ≥ 7 days so the percentage is meaningful."
However, `computeLoggedRate` returns `0` (not `null`) once `activeDays >= 1`, so
the existing `loggedRate !== null` guard allowed the bar to appear after just 2
calendar days. The 7-day threshold was documented but not enforced in code.

**Fix**: Added `differenceInCalendarDays` import and a `planActiveDays >= 7` guard
alongside the existing null check so the implementation matches the documented intent.

**Files changed**:
- `src/pages/TodayPage.tsx` — `differenceInCalendarDays` import; `planActiveDays`
  computed from `parseISO(today) - parseISO(plan.startDate)`; display condition changed
  from `loggedRate !== null` to `loggedRate !== null && planActiveDays >= 7`

**Risk**: Low. UI-only change; no state mutations, no data model changes. The bar
simply becomes visible later than before (day 7 instead of day 2). Easily reverted.

---

# Overnight Changelog — 2026-06-25

## [1] fix: deduplicate `countPlanDayCompletions` by calendarDate

**Problem**: `countPlanDayCompletions` in `historyStats.ts` counted raw entry records,
not unique dates. Every other stat function (isPlanExpired, computeRotationCycleProgress,
computeRotationPlanRemaining, countTotalUnloggedDays) uses a Set of calendarDates to prevent
CSV-import duplicates from inflating counts. This function did not, so a re-imported CSV
could cause the "Session N" label in TodayPage to report an incorrect (inflated) number.

**Fix**: Collect matching entries' calendarDates into a `Set` and return `dates.size`.

**Files changed**:
- `src/lib/historyStats.ts` — `countPlanDayCompletions` now deduplicates by calendarDate
- `src/lib/__tests__/historyStats.test.ts` — new regression test: two entries for the same date count as one

**Risk**: Low. Pure function change; semantics for the normal case (one entry per date) are identical. Only the duplicate-entry edge case is affected.
