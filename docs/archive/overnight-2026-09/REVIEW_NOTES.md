# REVIEW_NOTES.md
## Overnight Pass — 2026-09-24

---

## Executive Summary

1. **What changed**: Added `computeDayOfWeekBreakdown` to `historyStats.ts` with 14 accompanying tests. Added 5 documentation files (this file + IMPLEMENTATION_PLAN, CHANGELOG, TEST_RESULTS, FEATURE_PROPOSAL, FEATURE_REVIEW).
2. **Highest confidence**: The new function is a pure, additive stat helper with full test coverage and no side effects on existing behavior. All 1385 tests pass.
3. **What is risky**: Nothing in this pass is risky. The new function has no UI surface yet; it can be removed with a single file deletion if unwanted.
4. **What to review first**: `src/lib/historyStats.ts` — the new `computeDayOfWeekBreakdown` function at the bottom of the file, starting at the `// ── Day-of-week breakdown ──` section heading.

---

## Biggest Issues Found

No bugs identified. The codebase was already audited in prior overnight passes and is in good shape. Specific areas reviewed:

- **Rotation engine** (`rotationEngine.ts`): Pure, deterministic, well-tested. No issues.
- **History stats** (`historyStats.ts`): All future-date guards are correctly applied. Deduplication is consistent across all functions. No bugs.
- **Stores**: Zustand persist + migration pattern is correct. `exerciseHistoryStore.moveByWorkoutInstance` correctly updates `calendarDate` when re-keying by a new instance ID (not a bug as I initially suspected).
- **Expression evaluator** (`expressionEval.ts`): Parser is correct, handles edge cases gracefully (returns 0 for unknown vars/malformed expressions in production, warns in dev).
- **PR detection** (`buildPRFlagsMap`): The two-pass same-day approach is correct and correctly documented.

**Documented risks (not bugs):**
- `computeWorkoutTypeBreakdown` has no built-in `today` guard — relies on caller. The only call site already handles this (HistoryPage:219, with a comment).
- `computeWeeklyBreakdown` range is caller-controlled. Call site passes `toDate: today`.
- `findBestWeek` has an optional `today` param. Call site passes it.

---

## Improvements Completed

1. **`computeDayOfWeekBreakdown` (new function)**: Pure stat helper counting active workouts per weekday. Full test coverage. Ready to wire into UI.

---

## Definitely Keep

- `computeDayOfWeekBreakdown` + its 14 tests: correct, tested, zero side effects, valuable future UI hook.
- All 5 documentation files.

## Probably Keep But Tweak

- `FEATURE_REVIEW.md` classification is "Keep" but the function needs UI integration to be user-facing. Consider renaming the classification to "Keep — lib only; needs UI" for clarity.

## Do Not Keep

(Nothing in this pass needs to be reverted.)

## Recommendations Only (Not Implemented)

1. **Wire `computeDayOfWeekBreakdown` into `HistoryPage.tsx`**: Add a day-of-week bar chart alongside the weekly breakdown. The function is ready; the only missing piece is the React component + chart rendering.

2. **Add `today` as a required param (not optional) to `computeDayOfWeekBreakdown`**: Makes the future-date guard non-optional at call sites. Lower priority since the existing optional pattern matches `findBestWeek`.

3. **Add explicit `today` param to `computeWorkoutTypeBreakdown` and `computeWeeklyBreakdown`**: Both currently rely on callers to manage the upper bound. A built-in `today` guard would make the API safer for future callers. Not urgent since the single existing call site for each handles this correctly.

4. **Add a `skippedCount` field to `DayOfWeekStat`**: Would enable a stacked bar chart showing completed vs. skipped per day. Requires a product decision on visualization design before implementing.

---

## Open Questions for Me

1. **Where in the UI should `computeDayOfWeekBreakdown` appear?** The HistoryPage plan-detail section seems like the natural home, but it could also appear in a summary widget on the Today page.

2. **Should the bar chart use ISO order (Mon first) or start on the user's `weekStartsOn` preference?** The settings store has a `weekStartsOn: 0 | 1` field (see `calendarProjection.ts`). If the UI starts on Sunday, the chart should probably match.

3. **Should skip entries be included in a separate `skippedCount`?** The current function only tracks completions, which is consistent with the streak and best-week logic. But a stacked bar with "completed" vs "skipped" per day could be informative.

---

## Known Issues / Incomplete Work

- `computeDayOfWeekBreakdown` is not wired into any UI yet. It exists only as a library function.
- No integration tests for the UI; this repo is unit-test-only.

---

## Dependencies Added

None.
