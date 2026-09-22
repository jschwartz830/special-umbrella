# Review Notes — Overnight Audit Pass
**Date:** 2026-09-22

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
