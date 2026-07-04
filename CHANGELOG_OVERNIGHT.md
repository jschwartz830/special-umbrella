# Overnight Changelog — Pass 71 (2026-07-04)

## Branch: `claude/dreamy-mccarthy-16z0ml`

### Commit 1 — `958144b`

**fix: usePlanActions — use useToday() hook instead of frozen date**

- `src/hooks/usePlanActions.ts`: Replaced `format(new Date(), 'yyyy-MM-dd')` with `useToday()`. Removed the now-unused `date-fns/format` import.

**Why**: `format(new Date(), ...)` is captured once at render time and never updates. If a user starts a workout before midnight and completes it after midnight, `complete()` and `skip()` were logging the workout to the previous calendar day. `useToday()` fires a state update at midnight and triggers a re-render, so the `today` value is always current.

**Impact**: Correctness fix — workouts logged in the minutes around midnight now land on the correct calendar date. Zero test-count change (React hook behavior isn't exercised by Vitest node tests). TypeScript: `tsc --noEmit` exits clean.

---

### Commit 2 — `64d7604`

**test: document regression-floor no-op when slot has no targetDistanceMiles**

- `src/modules/run-adaptation/__tests__/engine.test.ts`: New test in the `regress path` describe block.

**What the test covers**: When `slot.runConfig.targetDistanceMiles` is `undefined`, the regression baseline falls back to the current target distance. `Math.max(currentTarget - step, currentTarget)` evaluates to `currentTarget`, so the engine produces action `'regress'` with `nextTargetDistanceMiles` equal to the current value — effectively a hold. The test asserts this behavior and the inline comment explains the limitation (no original distance anchor = can't regress below it).

**Why**: The no-op regress case was previously not covered by any test. A future reader changing the fallback expression (`?? targetDistance`) might inadvertently break the floor invariant without realizing a test existed to document intent.

**Impact**: +1 test (992 → 993). No production code changed.

---

# Overnight Changelog — Pass 70 (2026-07-02)

## Branch: `claude/dreamy-mccarthy-jy89cx`

### Commit 1 — `915860b`

**refactor: consolidate WORKOUT_TYPE_OPTIONS into constants.ts**

- `src/lib/constants.ts`: Added `WORKOUT_TYPE_OPTIONS: { type: WorkoutType; label: string }[]` — canonical labeled workout type list for UI selects and filters.
- `src/pages/CalendarPage.tsx`: Removed local `WORKOUT_TYPES` duplicate; imports `WORKOUT_TYPE_OPTIONS` from constants. No behavior change.
- `src/pages/HistoryPage.tsx`: Same consolidation; also fixed fallback slot type in `handleOutcomeConfirm`: `'rest'` → `'other'` (planStore v2 migrates `'rest'` to `'other'`; using the legacy type in new code is inconsistent).

**Impact**: Zero behavior change. Adding a new workout type to the filter/select UI now requires one file edit instead of three. All 987 tests pass.

---

### Commit 2 — `4737e7f`

**fix: csv.ts — export slot location/weightsFocusArea in tags column; reject fractional perceivedEffort**

#### Changes

- `src/lib/csv.ts`:
  - **`plansToCsv` (line 238)**: The `tags` column was always exported as `''`, silently discarding `slot.location` and `slot.weightsFocusArea`. Fixed: now exports `[slot.location, slot.weightsFocusArea].filter(Boolean).join('|')`. The importer already parsed this pipe-delimited format correctly — the exporter simply wasn't producing it.
  - **`buildOutcomeFromRow` (line 722)**: Added `Number.isInteger(effort)` guard before the 1–5 range check. A manually-edited CSV value of `1.7` previously passed the range check and was cast to `PerceivedEffort` (typed `1|2|3|4|5`), violating the type contract.
- `src/lib/__tests__/csv.test.ts`: 5 new tests — tags round-trip with both fields, location-only round-trip, fractional effort rejection, integer effort acceptance (all 5 values), out-of-range effort rejection.

#### Impact

- **Data integrity**: Plan slots with `location` or `weightsFocusArea` are now faithfully preserved through a CSV export/import round-trip.
- **Type safety**: `perceivedEffort` is always stored as a valid `1|2|3|4|5` integer after import.
- 992 tests passing (+5 from baseline).

---

# Overnight Changelog — 2026-07-01

## [1] test: extend mobilityStore tests for new v2 actions (21 new tests)

**Summary**: The MobilityTracker rewrite (PRs #172 and #173) added 5 new store actions to `mobilityStore` — `addExerciseFromLibrary`, `loadPreset`, `startSession`, `saveCheckpoint`, `clearSession` — with no unit test coverage. Additionally, the existing `resetStore()` helper did not include `activeSession: null`, creating a risk of state leakage between describe blocks now that `activeSession` is part of the store.

**Why it matters**: Every other Zustand store (and their action sets) has unit test coverage. The mobility store is the data layer for the daily mobility routine feature — its session state and preset logic should be verified to behave correctly under all expected inputs. The `resetStore()` gap was a latent test-isolation risk.

**Files changed**:
- `src/store/__tests__/mobilityStore.test.ts` — `resetStore()` now includes `activeSession: null`; added 5 new describe blocks covering all 5 new actions (21 tests). The `MobilitySessionCheckpoint` type is now also imported and used in tests.

**Risks / tradeoffs**: Tests are read-only. The `persist` middleware is mocked as a passthrough (same pattern as all other store test files). The v1→v2 migration (`activeSession: null` insertion) is not directly tested because the migration runs inside the `persist` middleware (bypassed by the mock) — this is noted as an acceptable gap given the migration's triviality (one-field insertion).

**Test count**: 966 → 987 (+21). No regressions.
