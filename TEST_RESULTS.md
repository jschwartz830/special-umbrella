# Test Results — Overnight Audit Run
_Date: 2026-09-17_

## Baseline

**Before changes:** 35 test files, 1371 tests — all pass.

**After changes:** 35 test files, 1377 tests — all pass.

6 new tests added.

---

## Tests Reviewed

### Engine layer
- **rotationEngine.test.ts** — 65 tests. Well-structured with regression anchors. Covers all exported functions including edge cases (0-day plans, duplicate dates, future overrides, plan isolation, all override types).
- **calendarProjection.test.ts** — 43 tests (was 15 before recent additions). Covers grid dimensions, weekStartsOn=0/1, resolvedDay propagation, plan isolation.
- **programParser.test.ts** — present, not re-reviewed this run.

### Library layer
- **historyStats.test.ts** — 283 tests across all 23 exported functions. Exceptional depth.
- **sessionSummary.test.ts** — 55 tests. Covers all branches including PB detection, multi-exercise "+N more", run/swim/mobility paths.
- **previousSetsHelper.test.ts** — 10 tests. Core paths covered.
- **planDayUtils.test.ts** — 8 tests. Complete for its scope.
- **expressionEval.test.ts** — 124 → 126 tests. Added `lbs`/`LBS` plural suffix cases.
- **csv.test.ts** — 35 tests. Good coverage of import/export round-trips.
- **historyScope.test.ts**, **outcomeSortKey.test.ts**, **shareWorkout.test.ts**, **storeSync.test.ts**, **workoutInstanceId.test.ts** — present and passing.

### Store layer
- **9 store test files** — 356 tests, all pass.

### Module layer
- **progression.test.ts** — 35 tests. Covers all progression modes and edge cases.
- **progressionMode.test.ts** — present and passing.
- **types.test.ts** — 137 → 141 tests. Added zero-distance guards for pace functions.

### Hook layer
- **useDismissableBanner.test.ts**, **useExpiryDismiss.test.ts**, **useStreakMilestoneDismiss.test.ts** — all passing.

---

## Tests Added

| File | Tests Added | What They Cover |
|---|---|---|
| `src/modules/workout-outcomes/__tests__/types.test.ts` | 4 | `derivePaceSecondsPerMile(0, ...)` and `(-1, ...)` return 0 not Infinity; same for `deriveSwimPaceSecondsPer100m` |
| `src/lib/__tests__/expressionEval.test.ts` | 2 | `resolveLoad('135lbs', ...)` and `resolveLoad('225LBS', ...)` correctly strip plural suffix |

---

## Important Areas Still Untested

1. **UI layer** — `TodayPage`, `CalendarPage`, `HistoryPage`, and all other page components have no tests. Logic embedded in JSX (e.g., double-day advance flow, CalendarPage modal state machine) is only tested indirectly through the engine regression anchors.

2. **CalendarPage selectedIdx stale state** — Cannot easily be unit-tested without a React test harness. The `useState` initializer only runs once; re-opening the modal with a different `planDayIndex` leaves `selectedIdx` stale.

3. **removeRetroJumpForDate timezone edge** — A test would require mocking timezone offsets, which the current test setup doesn't provide.

4. **storeSync beforeunload** — Async behavior during page teardown cannot be tested in a Vitest unit environment.

5. **stableExtraId idempotency** — The CSV round-trip hash function for extra workout IDs has no test asserting that the same CSV rows in different orders produce the same IDs.

6. **Integration: store + engine combined** — No tests verify that a historyStore write followed by a rotationEngine read produces the expected calendar state end-to-end.
