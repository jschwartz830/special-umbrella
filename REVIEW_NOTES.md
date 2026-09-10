# Review Notes — Overnight Audit Pass
**Date:** 2026-09-10

---

## Executive Summary

One bug found and fixed this pass: `buildWeightsRecommendation` in `progression.ts` had no explicit `maintenance` mode case. When `step_loading` exercises were logged, the recommendation fell through to the single-mode branch and returned `mode: 'single'` with "Single progression: add 2.5-5 lb" notes — incorrect for step loading. Fix adds an explicit `maintenance` branch. Three new tests lock in the corrected behavior. All 1367 tests pass after this pass.

---

## Audit Scope

Modules reviewed this pass:
- `src/modules/workout-outcomes/progression.ts` — `buildProgressionRecommendation`, `buildWeightsRecommendation`, `allSetsHitTarget`
- `src/modules/workout-outcomes/progressionMode.ts` — `deriveProgressionMode` (cross-reference)
- `src/modules/workout-outcomes/types.ts` — `ProgressionRecommendation`, `LoggedExerciseActual` (cross-reference)

---

## Findings

### Bug fixed

**`buildWeightsRecommendation` — missing `maintenance` mode branch (progression.ts:136):**
`buildWeightsRecommendation` handled `single`, `double`, and `volume` modes explicitly, but had no case for `maintenance`. When `step_loading` exercises are logged, `deriveProgressionMode` maps `step_loading` → `progressionMode: 'maintenance'`. The function then skipped over the `double` and `volume` if-blocks (mode was neither) and fell through to the single-mode fallback at line 149, returning:
```
{ discipline: 'weights', mode: 'single', action: 'progress'|'hold', note: 'Single progression: add 2.5-5 lb...' }
```
This note is incorrect for step loading. The `ProgressionRecommendation.mode` type already includes `'maintenance'` as a valid member, so a correctly structured response existed in the type system — just not in the branch logic.

**Fix:** Added explicit `maintenance` branch before the single fallback. Returns `mode: 'maintenance'` with step-loading-appropriate notes: "Step loading: all sets completed — add load at next checkpoint." (progress) and "Step loading: hold load and complete all target reps before advancing." (hold). The regress path is shared (effort >= 5 check fires before mode dispatch).

**Test coverage:** Three new tests in `progression.test.ts` — `maintenance` + progress, `maintenance` + hold, `maintenance` + regress.

### Confirmed good

- **`buildProgressionRecommendation`:** Now handles weights (with `single`/`double`/`volume`/`maintenance` modes), run, and swim slot types. Returns `null` for unsupported types (mobility, other). For weights, only generates a recommendation when `progressionMode` is explicitly set — correct opt-in gate. `allSetsHitTarget` correctly returns `false` for non-completed sets and applies `actualReps >= targetReps` for numeric targets; string targets (rep ranges, AMRAP) pass on completion alone — correct for those target types.

- **`deriveProgressionMode`:** Returns `undefined` when neither `progressionType` nor `hasProgressRule` is set (correct opt-in gate). All four mappings (`double`/`dynamic_double` → `'double'`, `triple` → `'volume'`, `step_loading` → `'maintenance'`, fallback → `'single'`) are correct and tested. The gap was downstream in `buildWeightsRecommendation`, not here.

---

## Recommendations (carry-forward)

| Item | Priority | Notes |
|---|---|---|
| `TodayPage` state extraction hook | Low | ~1200-line component; high refactor risk, deferred indefinitely |
| `updateEntryDate` data-loss on collision | Low | Intentional — CalendarPage, HistoryPage, TodayPage callers rely on delete-on-collision behavior |
| `beforeunload` Supabase async flush | Low | Product decision needed; `navigator.sendBeacon` alternative requires format compatibility verification |
| Integration test for TodayPage "Last session" PB hint | Low | Unit coverage exists; rendering path still untested |

---

## Test Results

| Suite | Before | After | Delta |
|---|---|---|---|
| All suites | 1364 | 1367 | +3 |

All 1367 tests pass across 35 files. 3 new tests added in `progression.test.ts` covering the `maintenance` mode fix.
