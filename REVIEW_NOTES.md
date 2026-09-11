# Review Notes — Overnight Audit Pass
**Date:** 2026-09-11

---

## Executive Summary

The codebase is in excellent shape. All 1364 tests pass. No bugs were found this pass. The audit covered the history/outcome/program store pipeline: `historyStore.ts`, `outcomeStore.ts`, `programStore.ts`, and the `planDeleteCleanup` integration test suite. All logic verified correct, error-resilient, and well-tested. All prior audit gaps remain resolved.

---

## Audit Scope

Modules reviewed this pass:
- `src/store/historyStore.ts` — entry deduplication, `importEntries`, `importExtraEntries`, `markDaysAsOff`, `updateEntryDate`, `migrateHistoryState`
- `src/store/outcomeStore.ts` — `logOutcomeWithProgression`, `syncExerciseHistory`, `moveOutcome`, `importOutcomes`, `removeOutcome`, `clearPlanOutcomes`, `migrateOutcomeState`
- `src/store/programStore.ts` — `initVars`, `getVars`, `setVars`, `clearPlanVars`, `applyProgressionRule`, `migrateProgramState`
- `src/store/__tests__/planDeleteCleanup.test.ts` — integration cascade-delete coverage

---

## Findings

### Confirmed good

- **`historyStore.ts` entry deduplication:** `addEntry` filters by `(planId, calendarDate)` before inserting, so only one entry per workout-date pair exists per plan. `deduplicateByDate` (used in `importEntries`) sorts by `createdAt` ascending and uses a `Map` — last-write wins on same-date pairs within a batch. Both paths correctly isolate by `planId`.

- **`historyStore.ts` importExtraEntries:** Deduplicates by `id`, not by `(planId, calendarDate)` — correct because multiple extras can share a date. Re-imports are safe (idempotent by `id`).

- **`historyStore.ts` markDaysAsOff:** Builds a `Set` of target dates, filters out existing entries for `(planId, date)` pairs in that set, then appends the new `day_off` entries. Correctly scoped to the given `planId`.

- **`historyStore.ts` updateEntryDate:** Moves the target entry to `newDate`, then removes any pre-existing entry on `(planId, newDate)` — intentional delete-on-collision behavior relied upon by CalendarPage, HistoryPage, and TodayPage callers.

- **`historyStore.ts` migrateHistoryState:** Backfills `source: 'history'` for extras missing the `source` field (v0→v1 migration). Correctly uses `e.source === undefined` as the guard.

- **`outcomeStore.ts` logOutcomeWithProgression:** All three progression paths (recommendation build, run progression engine, YAML program rules) are individually wrapped in `try/catch`. A bug in any single path cannot prevent the outcome from being persisted or the log modal from closing. Per-exercise YAML progression iterates `slot.exercises` with per-exercise `try/catch`. Correct defensive design.

- **`outcomeStore.ts` syncExerciseHistory:** Resolves `planName` and `workoutName` by cross-referencing `planStore` and `historyStore` via `getState()` — correct cross-store pattern. Returns early if no `weightsActual.exercises` or if `parseWorkoutInstanceId` fails.

- **`outcomeStore.ts` moveOutcome:** Atomically removes the old key, inserts under the new key with updated `workoutInstanceId` field, and calls `exerciseHistoryStore.moveByWorkoutInstance`. Correctly handles the case where `oldInstanceId` doesn't exist (no-op via `if (!existing) return s`).

- **`outcomeStore.ts` importOutcomes:** Last-writer-wins per `workoutInstanceId` (correct for outcomes, which use `workoutInstanceId` as identity rather than a reliable timestamp). Calls `syncExerciseHistory` for each imported outcome to carry `planName`/`workoutName` context.

- **`outcomeStore.ts` clearPlanOutcomes:** Uses `parseWorkoutInstanceId` to filter by `planId` — correctly handles both regular (`planId_date`) and extra (`planId_date_extra_extraId`) instance IDs. Cascades to `exerciseHistoryStore.clearByPlanId`.

- **`programStore.ts` applyProgressionRule:** Wraps `evaluateCondition`/`evaluateUpdates` in `try/catch`, logs the error with full context, returns `{}` on failure. Correct defensive design — a malformed YAML rule cannot crash the outcome log flow.

- **`programStore.ts` initVars:** Idempotent — only sets vars that don't already exist (`!(k in merged)`). Safe to call on re-activation.

- **`programStore.ts` migrateProgramState:** Backfills `vars: {}` for old snapshots missing the field. Correct.

- **`planDeleteCleanup` integration test:** Covers all six cascade steps: `clearPlanHistory`, `clearPlanOutcomes`, `clearPlanVars`, `clearByPlanId` (exerciseHistory), `removeProgressionStates`, and `deletePlan`. Tests verify plan B is untouched after plan A deletion across all stores. Also covers: activePlanId null-out, extra-workout cascade, program vars (no-op for non-YAML plans), progression states (no-op for empty groupIds).

### No new edge cases or bugs found this pass.

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
| All suites | 1364 | 1364 | 0 |

All 1364 tests pass across 35 files. No new tests added this pass (no new code paths found to cover).
