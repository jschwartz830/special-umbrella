# Review Notes — Overnight Audit Pass
**Date:** 2026-09-22
**Date:** 2026-09-23

---

## Executive Summary

1. **What changed:** Documentation only — no code changes. Full audit pass across stores, domain modules, and test suites.
2. **Highest confidence:** All previously identified issues remain fixed. Logic in all reviewed modules is correct.
3. **Risky:** Nothing risky — no production code changed.
4. **Review first:** Nothing to review — this pass produced no code changes. Carry-forward open items unchanged from 2026-09-14 pass.

All 1371 tests pass (no change).

---

## Audit Scope

Modules reviewed this pass:
- `src/store/historyStore.ts` — Full re-review: entry dedup semantics, `importEntries`/`importExtraEntries` merge logic, `markDaysAsOff` scoped correctly, `updateEntryDate` delete-on-collision intentional, `removeRetroJumpForDate` UTC-safe date slice, `removeLastOverrideByType` sort+first pattern, `migrateHistoryState` v0→v1 backfill
- `src/store/planStore.ts` — `duplicatePlan` uniqueness enumeration, `deepCloneWorkoutSlot`/`deepClonePlanDay` deep-copy for `warmup`/`exercises`/`segments`/`drills`, `migratePlanState` null guards, all four `migrateSlot` migration paths
- `src/store/settingsStore.ts` — `weekStartsOn` field, `migrateSettingsState` safe defaults, cloud hydration wired correctly
- `src/modules/workout-outcomes/types.ts` — `WorkoutOutcome` interface (all fields including `mobilityActual`), `completionStateToAction` mapping, pace/pace formatting helpers
- `src/modules/run-adaptation/selectors.ts` — `resolveWorkoutDisplayTarget` preference chain, `buildAdaptationNote` all switch branches
- `src/lib/__tests__/historyStats.test.ts` — verified comprehensive coverage of all `historyStats` functions
- `src/lib/__tests__/sessionSummary.test.ts` — verified comprehensive coverage of `buildLastSessionSummary` including mobility, zero-distance, PB semantics

---

## Findings

### Fixed this pass

None.

### Confirmed good

- All prior fixes remain in place.
- `historyStore` dedup discipline consistent across all write paths.
- `planStore` deep-clone handles all nested array types.
- `settingsStore` cloud hydration wired to `migrateSettingsState` (fixed 2026-08-26).
- `run-adaptation/selectors.ts` preference chain and all adaptation note branches covered.
- `sessionSummary.test.ts` covers mobility, zero-distance, PB strict-greater-than semantics, priority order, pace guard.

---

## Recommendations (carry-forward)

| Item | Priority | Notes |
|---|---|---|
| `TodayPage` state extraction hook | Low | ~1200-line component; high refactor risk, deferred indefinitely |
| `updateEntryDate` data-loss on collision | Low | Intentional — CalendarPage, HistoryPage, TodayPage callers rely on delete-on-collision behavior |
| `beforeunload` Supabase async flush | Low | Fire-and-forget `pushStore` may not complete before page teardown; `navigator.sendBeacon` alternative requires format compatibility verification |
| Integration test for TodayPage "Last session" PB hint | Low | Unit coverage exists; rendering path still untested |

---

## Test Results

| Suite | Before | After | Delta |
|---|---|---|---|
| All suites | 1371 | 1371 | 0 |

All 1371 tests pass across 35 files. No new tests added this pass.

---

# Review Notes — Overnight Audit Pass
**Date:** 2026-09-14

---

## Executive Summary

1. **What changed:** One comment correction — no behavior changes.
2. **Highest confidence:** The fix is documentation-only; all 1371 tests pass unchanged.
3. **Risky:** Nothing risky.
4. **Review first:** `historyStats.ts:176` — the corrected JSDoc for `computeRotationCycleProgress`. Confirm the new wording accurately reflects the intended distinction.

All 1371 tests pass (no change from previous pass).

---

## Audit Scope

Modules reviewed this pass:
- `src/lib/historyStats.ts` — full re-read; found misleading comment in `computeRotationCycleProgress`
- `src/engine/rotationEngine.ts` — confirmed `day_off` advances the rotation pointer (via `computeCurrentDayIndex`); this is the fact the old comment contradicted
- `src/lib/__tests__/historyStats.test.ts` — reviewed `computeConsecutiveSkips` tests (lines 2070–2225); coverage is complete including the "extras on same day as skip break the streak" case (line 2176)
- `src/store/historyStore.ts` — reviewed for any comment inaccuracies; all correct
- `src/store/outcomeStore.ts` — reviewed for any comment inaccuracies; all correct

---

## Findings

### Fixed this pass

**1. Misleading `computeRotationCycleProgress` JSDoc — `historyStats.ts:176`**

The old comment said:

> `complete` and `skip` entries — `day_off` entries **do not advance the rotation** and are excluded (mirrors `isPlanExpired`).

This is factually incorrect. `day_off` *does* advance the rotation pointer: in `rotationEngine.ts`, `computeCurrentDayIndex` iterates all `HistoryEntry` records (including `day_off`) to advance the pointer. The stats function `computeRotationCycleProgress` excludes `day_off` from the *cycle completion count* only — it counts how many rotation slots have been completed/skipped, which is a different concept from whether the pointer advanced.

The corrected comment reads:

> `complete` and `skip` entries — `day_off` entries **do not count toward cycle completion** and are excluded (mirrors `isPlanExpired`). Note: `day_off` does advance the rotation pointer in rotationEngine; this stat intentionally excludes it from the cycle completion count.

The same error was absent from `computeRotationPlanRemaining` (line 217), which already said "do not count toward rotation completion" — only `computeRotationCycleProgress` needed the fix.

### Confirmed good

- All prior fixes remain in place and passing.
- `computeConsecutiveSkips` test coverage is complete. The edge case of extras-on-skip-day (line 2176: "stops when a day has an extra even if it also has a skip entry") is already covered — no new test needed.
- No new bugs, untested paths, or semantic inconsistencies found in this pass.

---

## Recommendations (carry-forward)

| Item | Priority | Notes |
|---|---|---|
| `TodayPage` state extraction hook | Low | ~1200-line component; high refactor risk, deferred indefinitely |
| `updateEntryDate` data-loss on collision | Low | Intentional — CalendarPage, HistoryPage, TodayPage callers rely on delete-on-collision behavior |
| `beforeunload` Supabase async flush | Low | Fire-and-forget `pushStore` may not complete before page teardown; `navigator.sendBeacon` alternative requires format compatibility verification |
| Integration test for TodayPage "Last session" PB hint | Low | Unit coverage exists; rendering path still untested |

---

## Test Results

| Suite | Before | After | Delta |
|---|---|---|---|
| All suites | 1371 | 1371 | 0 |

All 1371 tests pass across 35 files. No new tests added (comment-only fix).
