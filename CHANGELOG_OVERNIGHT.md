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
