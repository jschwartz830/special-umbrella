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
