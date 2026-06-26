# Test Results

## 2026-06-26 (sixty-fourth pass) — branch `claude/dreamy-mccarthy-fxnzht`

---

### Baseline (before changes)

```
Test Files  24 passed (24)
     Tests  936 passed (936)
  Duration  ~2.7s
```

### Final run (after fix)

```
Test Files  24 passed (24)
     Tests  936 passed (936)
  Duration  ~2.7s
```

No new tests added this pass — the fixed code path is a UI display condition with no
testable pure-function equivalent (TodayPage is a React component, not covered by the
Vitest node suite).

TypeScript: `tsc --noEmit` exits clean with no errors.

---

### Changes verified

The adherence bar fix in `TodayPage.tsx` adds a `differenceInCalendarDays` call from
date-fns (already a project dependency). TypeScript confirms the import is valid and
the new variable type is `number`, compatible with the `>= 7` comparison. No regressions
in the existing test suite.

---

## 2026-06-25 (sixty-third pass) — branch `claude/dreamy-mccarthy-nmt6dy`

---

### Baseline (before changes)

```
Test Files  24 passed (24)
     Tests  935 passed (935)
  Duration  ~2.5s
```

### Final run (after fix + new test)

```
Test Files  24 passed (24)
     Tests  936 passed (936)
  Duration  ~2.5s
```

---

### New test added

**`src/lib/__tests__/historyStats.test.ts`** — `countPlanDayCompletions` suite:

> `deduplicates by calendarDate — two entries for the same date count as one`
>
> Simulates a CSV re-import creating a duplicate `complete` entry for the same
> (planId, calendarDate, planDayIndex). Verifies count is 2 (unique dates), not 3 (raw records).

---

### Test suite coverage summary

| Module | Tests | Coverage notes |
|---|---|---|
| `rotationEngine.ts` | ~80 | All branches including symmetric modulo, leap years, skips |
| `historyStats.ts` | ~200 | All stat functions, deduplication, streak, weekly breakdown |
| `expressionEval.ts` | ~120 | All operators, NaN/Infinity guards, nested parens, assignment |
| `run-adaptation/engine.ts` | ~30 | All 6 outcome paths, effort thresholds, distance thresholds |
| `workout-outcomes/progression.ts` | ~40 | Single/double/volume/run/swim modes |
| `sessionSummary.ts` | ~20 | Pace derivation, stored-zero fallback, PB detection |
| `workoutInstanceId.ts` | ~10 | Round-trip parse, underscore-in-planId |
| Other utilities | ~30 | outcomeSortKey, planDayUtils, addOverride |
