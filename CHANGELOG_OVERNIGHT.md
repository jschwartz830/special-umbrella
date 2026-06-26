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
