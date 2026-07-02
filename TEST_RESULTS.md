# Test Results

## 2026-07-02 (seventieth pass) — branch `claude/dreamy-mccarthy-jy89cx`

---

### Baseline (before changes)

```
Test Files  26 passed (26)
     Tests  987 passed (987)
  Duration  ~3.0s
```

### New tests added: 0

No new tests this pass. The change is a pure mechanical consolidation of a data constant; no logic was altered that would benefit from new test coverage. The `WORKOUT_TYPE_OPTIONS` export is a declarative value — equality with the previous inline definitions is verified implicitly by the unchanged behavior of all 987 existing tests.

### Final (after changes)

```
Test Files  26 passed (26)
     Tests  987 passed (987)
  Duration  ~3.0s
```

_After commit 1 only._

### Additional tests added (commit 2): +5

**`src/lib/__tests__/csv.test.ts`** — 5 new tests covering the CSV fixes found by the background audit agent:
1. `round-trips slot location and weightsFocusArea via the tags column` — verifies that `gym`/`upper` and `home`/`lower` survive a plansToCsv → plansFromCsv round-trip
2. `round-trips slots with only location (no weightsFocusArea)` — `outdoor` location alone, no focus area
3. `rejects fractional perceivedEffort values from manually-edited CSVs` — `1.7` must produce `perceivedEffort: undefined`
4. `accepts integer perceivedEffort values 1–5` — all 5 valid values accepted
5. `rejects out-of-range perceivedEffort (0 or 6)` — boundary values rejected

### Final (after all changes)

```
Test Files  26 passed (26)
     Tests  992 passed (992)
  Duration  ~2.7s
```

Net: **+5 tests, 0 regressions**.

---

## 2026-07-01 (sixty-ninth pass) — branch `claude/dreamy-mccarthy-4cykvp`

---

### Baseline (before changes)

```
Test Files  26 passed (26)
     Tests  966 passed (966)
  Duration  ~3.3s
```

### New tests added: 21

All 21 new tests are in `src/store/__tests__/mobilityStore.test.ts`.

| Describe block | Tests | New? |
|---|---|---|
| `addExerciseFromLibrary` | 5 | ✓ new |
| `loadPreset` | 5 | ✓ new |
| `startSession` | 5 | ✓ new |
| `saveCheckpoint` | 3 | ✓ new |
| `clearSession` | 3 | ✓ new |
| `resetStore()` isolation fix | — | ✓ updated |

### Final run (after all changes)

```
Test Files  26 passed (26)
     Tests  987 passed (987)
  Duration  ~3.3s
```

No regressions. TypeScript: `tsc --noEmit` exits clean.

---

### Test suite coverage summary (updated)

| Module | Tests | Coverage notes |
|---|---|---|
| `rotationEngine.ts` | ~80 | All branches including symmetric modulo, leap years, skips |
| `historyStats.ts` | ~210 | All stat functions, deduplication, streak, weekly breakdown, best week |
| `expressionEval.ts` | ~120 | All operators, NaN/Infinity guards, nested parens, assignment |
| `run-adaptation/engine.ts` | ~30 | All 6 outcome paths, effort thresholds, distance thresholds |
| `workout-outcomes/progression.ts` | ~40 | Single/double/volume/run/swim modes |
| `sessionSummary.ts` | ~20 | Pace derivation, stored-zero fallback, PB detection |
| `workoutInstanceId.ts` | ~10 | Round-trip parse, underscore-in-planId |
| `mobilityStore.ts` | **39** | All 11 actions (6 original + 5 new), default state, session lifecycle — **was 18** |
| `settingsStore.ts` | 5 | Default value + setStartDelay action |
| Other utilities | ~30 | outcomeSortKey, planDayUtils, addOverride |

### Still untested (no unit tests)

- React components (TodayPage, CalendarPage, HistoryPage, MobilityPage, MobilityTracker, etc.) — UI components require RTL or Playwright. Both pass 68 bugs lived here.
- `storeSync.ts` / `authStore.ts` — require mocking the Supabase client
- `CardioWorkoutTracker` timer logic — depends on `Date.now()` and `setInterval` which are blocked in Vitest node environment
- mobilityStore v1→v2 migration — bypassed by the `persist` mock (acceptable; migration is a trivial one-field insertion)

---

## 2026-06-30 (sixty-eighth pass) — branch `claude/dreamy-mccarthy-4vdzsq`

---

### Baseline (before changes)

```
Test Files  26 passed (26)
     Tests  966 passed (966)
  Duration  ~3.1s
```

### New tests added: none

Both fixes this pass (the `DayStatus` type correction and the override-removal data-corruption fix) live entirely inside `TodayPage.tsx`'s event handlers — React component logic with no pure-function equivalent to unit test, consistent with the long-standing gap noted in every prior pass (no RTL/Playwright infra exists). This is a real gap: both bugs fixed this pass were in exactly this untested surface area. Introducing component-test infrastructure is a deliberate, cross-cutting decision flagged as a recommendation in `REVIEW_NOTES.md` rather than added ad hoc this pass.

### Final run (after all changes)

```
Test Files  26 passed (26)
     Tests  966 passed (966)
  Duration  ~3.1s
```

No regressions. TypeScript: `tsc --noEmit` exits clean (this was the failure being fixed — confirmed it now passes). `npm run build` succeeds end-to-end.

---

### Test suite coverage summary (unchanged)

| Module | Tests | Coverage notes |
|---|---|---|
| `rotationEngine.ts` | ~80 | All branches including symmetric modulo, leap years, skips |
| `historyStats.ts` | ~210 | All stat functions, deduplication, streak, weekly breakdown, best week |
| `expressionEval.ts` | ~120 | All operators, NaN/Infinity guards, nested parens, assignment |
| `run-adaptation/engine.ts` | ~30 | All 6 outcome paths, effort thresholds, distance thresholds |
| `workout-outcomes/progression.ts` | ~40 | Single/double/volume/run/swim modes |
| `sessionSummary.ts` | ~20 | Pace derivation, stored-zero fallback, PB detection |
| `workoutInstanceId.ts` | ~10 | Round-trip parse, underscore-in-planId |
| `mobilityStore.ts` | 18 | All 6 actions, default state, edge cases |
| `settingsStore.ts` | 5 | Default value + setStartDelay action |
| Other utilities | ~30 | outcomeSortKey, planDayUtils, addOverride |

### Still untested (no unit tests)

- React components (TodayPage, CalendarPage, HistoryPage, etc.) — UI components require RTL or Playwright. Both bugs fixed this pass lived here.
- `storeSync.ts` / `authStore.ts` — require mocking the Supabase client (Supabase SDK is not a simple mock)
- `CardioWorkoutTracker` timer logic — depends on `Date.now()` and `setInterval` which are blocked in Vitest node environment
- `ActiveWorkoutTracker` audio scheduling and wake lock

---

## 2026-06-29 (sixty-seventh pass) — branch `claude/dreamy-mccarthy-hhiaa3`

---

### Baseline (before changes)

```
Test Files  25 passed (25)
     Tests  961 passed (961)
  Duration  ~3.0s
```

(961 reflects 18 new tests added this pass versus the 943 baseline from pass 66, plus additional tests from human-authored commits between passes.)

### New tests added: `settingsStore` (5 tests)

File: `src/store/__tests__/settingsStore.test.ts` (new file)

| Suite | Tests | Covers |
|---|---|---|
| default state | 1 | startDelaySeconds defaults to 0 |
| setStartDelay | 4 | update, reset to 0, large values, overwrite |

### Final run (after all changes)

```
Test Files  26 passed (26)
     Tests  966 passed (966)
  Duration  ~3.1s
```

5 new tests pass. No regressions in existing suite. TypeScript: `tsc --noEmit` exits clean.

---

### Test suite coverage summary (updated)

| Module | Tests | Coverage notes |
|---|---|---|
| `rotationEngine.ts` | ~80 | All branches including symmetric modulo, leap years, skips |
| `historyStats.ts` | ~210 | All stat functions, deduplication, streak, weekly breakdown, best week |
| `expressionEval.ts` | ~120 | All operators, NaN/Infinity guards, nested parens, assignment |
| `run-adaptation/engine.ts` | ~30 | All 6 outcome paths, effort thresholds, distance thresholds |
| `workout-outcomes/progression.ts` | ~40 | Single/double/volume/run/swim modes |
| `sessionSummary.ts` | ~20 | Pace derivation, stored-zero fallback, PB detection |
| `workoutInstanceId.ts` | ~10 | Round-trip parse, underscore-in-planId |
| `mobilityStore.ts` | 18 | All 6 actions, default state, edge cases |
| `settingsStore.ts` | 5 | Default value + setStartDelay action |
| Other utilities | ~30 | outcomeSortKey, planDayUtils, addOverride |

### Still untested (no unit tests)

- React components (TodayPage, CalendarPage, HistoryPage, etc.) — UI components require RTL or Playwright
- `storeSync.ts` / `authStore.ts` — require mocking the Supabase client (Supabase SDK is not a simple mock)
- `CardioWorkoutTracker` timer logic — depends on `Date.now()` and `setInterval` which are blocked in Vitest node environment
- `ActiveWorkoutTracker` audio scheduling and wake lock

---

## 2026-06-28 (sixty-sixth pass) — branch `claude/dreamy-mccarthy-7v05ht`

---

### Baseline (before changes)

```
Test Files  24 passed (24)
     Tests  943 passed (943)
  Duration  ~2.4s
```

(943 reflects 7 tests added by the previous overnight pass plus 7 tests from the human-authored
commits that landed between pass 65 and this pass.)

### New tests added: `mobilityStore` (18 tests)

File: `src/store/__tests__/mobilityStore.test.ts` (new file)

| Suite | Tests | Covers |
|---|---|---|
| default routine | 2 | 7 exercises, no completions |
| addExercise | 3 | append, unique id, length increment |
| removeExercise | 4 | by id, no-op for unknown id, order preservation, length decrement |
| reorderExercise | 3 | from/to index, same-index no-op, length invariant |
| logCompletion | 3 | keyed by date, overwrite, independent dates |
| removeCompletion | 3 | by date, no-op for missing date, leaves other dates intact |

### Final run (after all changes)

```
Test Files  25 passed (25)
     Tests  961 passed (961)
  Duration  ~2.4s
```

18 new tests pass. No regressions in existing suite. TypeScript: `tsc --noEmit` exits clean.

---

### Test suite coverage summary (updated)

| Module | Tests | Coverage notes |
|---|---|---|
| `rotationEngine.ts` | ~80 | All branches including symmetric modulo, leap years, skips |
| `historyStats.ts` | ~210 | All stat functions, deduplication, streak, weekly breakdown, best week |
| `expressionEval.ts` | ~120 | All operators, NaN/Infinity guards, nested parens, assignment |
| `run-adaptation/engine.ts` | ~30 | All 6 outcome paths, effort thresholds, distance thresholds |
| `workout-outcomes/progression.ts` | ~40 | Single/double/volume/run/swim modes |
| `sessionSummary.ts` | ~20 | Pace derivation, stored-zero fallback, PB detection |
| `workoutInstanceId.ts` | ~10 | Round-trip parse, underscore-in-planId |
| `mobilityStore.ts` | 18 | All 6 actions, default state, edge cases |
| Other utilities | ~30 | outcomeSortKey, planDayUtils, addOverride |

### Still untested (no unit tests)

- React components (TodayPage, CalendarPage, HistoryPage, etc.) — UI components require RTL or Playwright
- `CardioWorkoutTracker` timer logic — depends on `Date.now()` and `setInterval` which are blocked in Vitest node environment
- `ActiveWorkoutTracker` audio scheduling and wake lock
- `programStore.applyProgressionRule` side effects

---

## 2026-06-27 (sixty-fifth pass) — branch `claude/dreamy-mccarthy-zak0k0`

---

### Baseline (before changes)

```
Test Files  24 passed (24)
     Tests  936 passed (936)
  Duration  ~2.7s
```

### New tests added: `removeLastOverrideByType` (7 tests)

File: `src/store/__tests__/historyStore.test.ts`

| Test | Covers |
|---|---|
| removes the most recently added advance override | basic happy path |
| only removes the newest by appliedAt, not all matching | N-override accumulation case |
| removes a single matching override and leaves store empty | single-item edge case |
| does not remove overrides of other types | type isolation |
| does not touch overrides for other plans | plan isolation |
| is a no-op when there are no matching overrides | missing type |
| is a no-op when the store is empty | empty state |

### Final run (after changes)

```
Test Files  24 passed (24)
     Tests  943 passed (943)
  Duration  ~2.4s
```

All 7 new tests pass. No regressions in existing suite.

---

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
