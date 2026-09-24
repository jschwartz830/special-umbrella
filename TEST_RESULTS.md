# TEST_RESULTS.md
## Overnight Pass — 2026-09-24

---

### Tests reviewed

- **35 test files** covering engine, lib/stats, store, hooks, and module logic
- **1371 pre-existing tests** — all passing before this pass began
- Key files reviewed: `rotationEngine.test.ts`, `historyStats.test.ts`, `historyStore.test.ts`, `exerciseHistoryStore.test.ts`, `outcomeStore.test.ts`, `previousSetsHelper.test.ts`, `sessionSummary.test.ts`

---

### Tests added/updated

**New: `describe('computeDayOfWeekBreakdown', …)` in `src/lib/__tests__/historyStats.test.ts`**

14 new tests covering:

| Test case | Behavior verified |
|-----------|-------------------|
| Empty inputs | Returns 7 entries with count 0 each |
| Monday bucket | Correct isoDay=1 assignment for 2026-06-08 (a Monday) |
| Sunday bucket | Correct isoDay=7 assignment for 2026-06-14 (a Sunday) |
| Multi-week accumulation | Same weekday across two weeks adds counts |
| Skip/day_off exclusion | Only `complete` entries count |
| Extras on correct weekday | Extra workouts counted per day |
| Same-day rotation + extra | Both count independently (count = 2) |
| Deduplication | Two entries same date → count = 1 (not 2) |
| planId scoping | Different-plan entries excluded when planId given |
| All-plans (null planId) | Both plans included when planId is null |
| Future-date guard (entries) | Entries after `today` excluded |
| Future-date guard (extras) | Extras after `today` excluded |
| Today inclusive | Entry on `today` is included in count |
| Full 7-day week | All 7 buckets correctly identified |

**Import updated:** `computeDayOfWeekBreakdown` added to the import line in `historyStats.test.ts`.

---

### Results

```
Test Files  35 passed (35)
     Tests  1385 passed (1385)   ← +14 new tests
  Start at  04:24:51
  Duration  3.19s
```

---

### Important areas still untested

1. **`computeWorkoutTypeBreakdown` future-date behavior without a caller-supplied range**: The function has no built-in `today` guard; it relies on callers to pass `dateRange.to = today`. The existing call site handles this, but a test documenting "without a range, future entries are included" would be valuable defensive documentation.

2. **`computeWeeklyBreakdown` with caller-omitted today bound**: Same pattern. Not a bug (by design), but a test that documents "passing toDate=today is the caller's responsibility" would add clarity.

3. **UI integration tests**: The new `computeDayOfWeekBreakdown` function is not yet called from any page. There are no Playwright/integration tests in this repo (test suite is unit-only). When the function is wired into `HistoryPage`, manual testing of the chart rendering would be important.
