# Review Notes — Overnight Audit Pass
**Date:** 2026-08-14
**Branch:** `claude/serene-cori-gxsgmm`

---

## Executive Summary

1. **What changed:** Added `computeAverageWorkoutsPerWeek` to the stats layer with 13 tests; wired it into the Plan Progress modal as a new "Avg / week" row; added a dev-mode warning for malformed YAML expressions; improved doc comment in `workoutInstanceId.ts`.

2. **Highest confidence:** The `computeAverageWorkoutsPerWeek` function and its tests. It's a pure function that follows existing dedup and filtering conventions exactly. The UI wiring is additive (new prop, new conditional row). No existing tests were modified; 13 new tests were added and all pass.

3. **What is risky:** The fractional-denominator choice in `computeAverageWorkoutsPerWeek` — a 3-day-old plan with 3 workouts shows 7.0/week, which is technically correct but could look alarming. This is a product decision, not a bug, but worth reviewing.

4. **What to review first:** The Plan Progress modal in the running app (or its snapshot tests if you add them). The new "Avg / week" row should appear after completing at least one workout, and be absent on a brand-new plan.

---

## Biggest Issues Found During Audit

### 1. Excellent overall test coverage (no blockers)
All 1238 existing tests pass and every critical code path is covered. The engine, stores, stats layer, and expression evaluator each have dedicated test files. No existing tests were broken.

### 2. `computeAverageWorkoutsPerWeek` was missing
A common fitness metric — how consistently am I training each week? — was absent from the stats layer. Every other "plan health" metric was present. **Implemented and tested.**

### 3. `parsePrimary` silent fallback gave zero feedback to YAML authors
Malformed YAML progression expressions (extra commas, unmatched parens in wrong positions) silently returned 0. **Fixed with a dev-mode warning.**

### 4. `parseWorkoutInstanceId` alphabet assumption was undocumented
The function relies on hex-only planIds for correctness but didn't say so. **Documented.**

### 5. Calendar week starts hardcoded to Sunday (not implemented — recommendation only)
`buildMonthGrid` in `calendarProjection.ts` uses `weekStartsOn: 0` (US Sunday convention). International users may expect Monday-first. Fixing this requires a settings preference and more extensive UI work — documented as recommendation only.

### 6. `TodayPage` state density (not implemented — recommendation only)
`TodayPage.tsx` is ~1160 lines after this pass. The component is well-decomposed into sub-components and sub-hooks already, but state initialization (the long sequence of `const` computations before the return) could be extracted into a `useTodayPageStats` hook for clarity.

---

## Improvements Completed

| # | Description | Commit |
|---|---|---|
| 1 | `computeAverageWorkoutsPerWeek` + 13 tests | `0431da5` |
| 2 | Wire avg/week into Plan Progress modal | `d42c6ce` |
| 3 | `parsePrimary` dev-mode warning | `e81e9e8` |
| 4 | `parseWorkoutInstanceId` doc update | `7fcf67c` |

---

## Feature Added

**Feature:** "Average workouts per week" stat in Plan Progress modal.

**Classification:** Keep — this is a pure additive change with strong tests and obvious user value. The fractional denominator edge case (high early average) is documented and easy to tune.

---

## Definitely Keep

- `computeAverageWorkoutsPerWeek` + tests — valuable metric, well-tested, clean API
- Dev-mode warning in `parsePrimary` — zero production risk, helps YAML authors
- `parseWorkoutInstanceId` doc comment — pure documentation improvement

---

## Probably Keep But Tweak

- "Avg / week" modal row — the `×` suffix is a minor style choice; you may prefer `/ wk` or omit the unit suffix entirely. The conditional null-hide is correct and should stay.
- Fractional-week denominator in `computeAverageWorkoutsPerWeek` — if early-plan averages feel misleading, consider adding a minimum-elapsed-days guard (e.g. return null if `daysElapsed < 3`). This is a product decision, not a bug.

---

## Do Not Keep

None — all four changes are purely additive or documentation-only.

---

## Recommendations Only (Not Implemented)

### R1 — Calendar week-start setting
`buildMonthGrid` uses Sunday-first weeks. Add a `weekStartsOn: 0 | 1` setting to `settingsStore` and thread it through `CalendarPage → buildMonthGrid`. Moderate complexity; affects only the calendar view.

### R2 — TodayPage stats extraction hook
Extract the 30+ `const` stat derivations between the early-return guard and the JSX into a `useTodayPageStats(plan, planEntries, planExtras, today, ...)` hook. This makes TodayPage shorter and each stat easier to unit test. No behaviour change — pure refactor.

### R3 — `avgWorkoutsPerWeek` memoization in TodayPage
The `computeAverageWorkoutsPerWeek` call runs on every TodayPage render. For plans with many entries, wrapping in `useMemo([planEntries, planExtras, plan.startDate, today])` is a minor win. Low priority — the function is O(n) and n is typically small.

### R4 — `computeHistoryStats.totalLogged` dedup at stats layer
The function counts raw array length, assuming the store prevents duplicates. This assumption holds now but could be violated by future import paths. Adding `new Set(entries.map(...)).size` dedup at the stats layer would make it defensive. Very low risk currently.

### R5 — YAML progression rule documentation
The expression DSL supported by `expressionEval.ts` is powerful but undocumented in the app itself. A help tooltip or linked doc in `ProgramImportPage` would help YAML authors understand the `then`/`else` update syntax.

---

## Open Questions For You

1. **Fractional avg/week for new plans** — Does 7.0 workouts/week for a plan started 3 days ago (with 3 workouts done) read correctly to you, or would you prefer a `null` return until at least 7 days have elapsed?

2. **"Avg / week" label** — Is `2.5×` the right format, or would `2.5 / wk` or just `2.5` be clearer?

3. **Calendar week start** — Is Sunday-first correct for your use case, or would you like a Monday-first option?

4. **TodayPage refactor** — Would you like a follow-up pass to extract the stats derivations into a dedicated hook? This would make TodayPage easier to test but doesn't change any behaviour.

---

## Known Issues / Incomplete Work

- No visual test (screenshot or component snapshot) for the new Plan Progress modal row. The plan progress modal is not covered by existing component tests, so this change relies on manual verification.
- `avgWorkoutsPerWeek` in TodayPage is not wrapped in `useMemo`. For typical plan sizes (< 500 entries) this is unnoticeable, but could be addressed proactively.

---

## Dependencies Added

None.
