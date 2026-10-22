# CHANGELOG_OVERNIGHT.md
## Overnight Pass — 2026-09-24

---

### Change 1: Add `computeDayOfWeekBreakdown` to historyStats

**Summary:** New pure function that counts active workouts per ISO weekday (Mon–Sun) for a given plan. Returns an array of 7 `DayOfWeekStat` objects — always ordered Monday through Sunday — with a `count` of 0 for days that had no qualifying activity.

**Why it matters:** The existing analytics cover weekly totals and workout-type breakdowns, but don't surface which days of the week a user tends to work out. This function enables the History page (or a future stats widget) to show a "your busiest training days" view without any architectural changes.

**Design decisions:**
- Counts only `complete` rotation entries and extras — same definition of "active workout" used by `findBestWeek` and the streak logic. Skip and day_off entries are intentionally excluded.
- Deduplicates rotation entries by `(planId, calendarDate)` — consistent with the one-advancement-per-date invariant used throughout the file.
- Optional `today` upper-bound guard: when provided, future-dated entries are excluded. Mirrors the same pattern in `computeHistoryStats` and `findBestWeek`.
- `planId: null` aggregates across all plans (global day-of-week pattern).
- ISO weekday numbering (1=Mon, 7=Sun) matches `isoWeekStart` and the rest of the file.

**Files changed:**
- `src/lib/historyStats.ts` — new `computeDayOfWeekBreakdown` function + `DayOfWeekStat` interface + private `isoDay` helper

**Risks / tradeoffs:**
- Pure additive change; no existing call sites affected.
- Not wired into any UI yet — a deliberate choice to let the developer decide where to surface it. See FEATURE_REVIEW.md.

**Rollback:** Delete the `computeDayOfWeekBreakdown` function, `DayOfWeekStat` interface, and `isoDay` helper from `historyStats.ts`. No other files depend on it.

---

### Change 2: Add tests for `computeDayOfWeekBreakdown`

**Summary:** 14 new test cases covering: empty inputs, Monday/Sunday bucket assignment, multi-week accumulation, skip/day_off exclusion, extra entries, same-day rotation + extra, duplicate-entry dedup, planId scoping, all-plans (null planId), future-date guard, today-inclusive upper bound, and full 7-day week validation.

**Why it matters:** The new function is data-critical (drives potential UI display) and should not regress silently. The tests document the intended behavior at every edge case.

**Files changed:**
- `src/lib/__tests__/historyStats.test.ts` — added `computeDayOfWeekBreakdown` import and 14 new tests in a new `describe` block

**Risks / tradeoffs:** None — purely additive.

**Rollback:** Delete the `describe('computeDayOfWeekBreakdown', …)` block and remove the import from the test file.

---

### Change 3: Add IMPLEMENTATION_PLAN.md

**Summary:** Documents the architecture, product capabilities, strengths, risks, and improvement plan for this overnight pass.

**Files changed:** `IMPLEMENTATION_PLAN.md` (new)

---

### Change 4: Add CHANGELOG_OVERNIGHT.md, REVIEW_NOTES.md, TEST_RESULTS.md, FEATURE_PROPOSAL.md, FEATURE_REVIEW.md

**Summary:** Required end-of-run deliverable documents.

**Files changed:** Documentation files only (new).
