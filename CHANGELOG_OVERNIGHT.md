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

**Rollback**: Revert the test commit. No production impact.

---

# Overnight Changelog — 2026-06-30

## [1] fix: invalid `DayStatus` literal was breaking every production deploy

**Summary**: `TodayPage.tsx` built two synthetic `ResolvedDay` objects using `status: 'upcoming'`, a string that is not a member of the `DayStatus` union (`src/types/index.ts`). `tsc --noEmit` fails on this, and since the production build script is `tsc && vite build`, every push to `main` since commit `20bb8ac` failed CI and silently never deployed to GitHub Pages — confirmed via GitHub Actions run history (3 consecutive failed runs, all on `main`).

**Files changed**:
- `src/pages/TodayPage.tsx` — changed `status: 'upcoming'` to `status: 'future'` at both occurrences (~lines 526, 936). `'future'` is the existing union member used everywhere else for not-yet-started days.

**Risks / tradeoffs**: None — this restores a valid type, doesn't change any runtime behavior (the `'future'` status was almost certainly the intended value all along, just mistyped).

**Rollback**: Revert commit `b8d21d0`. Note: reverting restores the build-breaking state.

---

## [2] fix: deleting a non-advancing double-day extra could strip an unrelated rotation override

**Summary**: The "full plan picker" feature (commit `bcee1f6`) let users pick any plan day — not just the next one in rotation — as a bonus ("double-day") workout. That broke an invariant the delete paths relied on: previously every `source: 'double_day'` extra was created by logging the next-in-rotation day, so it always corresponded 1:1 with an `advance` override. Now a `double_day` extra can exist that never advanced the rotation. Both delete paths (swipe-to-delete and the Undo button) unconditionally removed the plan's most recent `advance` override whenever `extra.source === 'double_day'`, regardless of whether that specific extra caused one. Since `removeLastOverrideByType` removes the single most-recent override of that type for the whole plan (not scoped to the deleted extra), this could silently strip away an unrelated, legitimate advance override belonging to a different action — corrupting the user's rotation pointer with no error or warning.

**Files changed**:
- `src/types/index.ts` — added `advancedRotation?: boolean` to `ExtraWorkoutEntry`, documenting that pre-existing records (created before this field existed) are treated as `true` at call sites via a `??` fallback.
- `src/pages/TodayPage.tsx` — `handleOutcomeConfirm` now computes `willAdvance` and passes `advancedRotation: willAdvance` when creating the extra; `handleUpcomingLog` always sets `advancedRotation: true` (that path always advances). Both delete handlers (`SwipeToDelete onDelete` for "Completed today" extras, and the Undo button's loop) now check `extra.advancedRotation ?? extra.source === 'double_day'` instead of `extra.source === 'double_day'` alone.

**Risks / tradeoffs**: Backward compatible — the `??` fallback means extras created before this field existed behave exactly as before (since they were always 1:1 with an advance). Only newly-created `double_day` extras from the plan-picker flow get the corrected, narrower behavior.

**Rollback**: Revert commit `3e06cc5`. No data migration needed — the new field is optional and additive.

---

## [3] docs: pass 68 audit notes, changelog, and test results

**Summary**: Documentation-only update recording this pass's findings per the standard overnight-routine format.

**Files changed**:
- `IMPLEMENTATION_PLAN.md`, `CHANGELOG_OVERNIGHT.md`, `REVIEW_NOTES.md`, `TEST_RESULTS.md`

**Risks / tradeoffs**: None.

**Rollback**: Revert the docs commit; no functional impact.

---

# Overnight Changelog — 2026-06-29

## [1] fix: AuthGate subscription leak + storeSync error logging

**Summary**: Two bugs found in the Supabase auth integration added by PR #165.

(a) **AuthGate race condition**: The `useEffect` that calls `syncOnLogin()` and then `subscribeStores()` had a subscription leak. If the component unmounted or the user logged out while `syncOnLogin()` was still in-flight, the cleanup function ran before `.then()` fired. After cleanup, `.then()` created subscriptions that were never freed, causing duplicate Supabase pushes on re-login and leaking store listeners.

(b) **storeSync silent errors**: Both `pushStore` (upsert) and `syncOnLogin` (select query) dropped their Supabase `error` response entirely. A network failure or RLS rejection produced no log output, making sync debugging very difficult.

**Files changed**:
- `src/components/auth/AuthGate.tsx` — Added `cancelled` flag pattern: `let cancelled = false` before the async call; `if (!cancelled) unsubscribeStores = subscribeStores()` in `.then()`; `cancelled = true` in cleanup.
- `src/lib/storeSync.ts` — Destructure `error` from upsert and select; `console.error('[storeSync] ...')` on failure.

**Risks / tradeoffs**: Both changes are purely defensive. The AuthGate fix prevents a real but rare edge case (rapid login/logout during a slow network). The storeSync error logging has zero runtime impact when errors don't occur.

**Rollback**: Revert commit `d7572a5`. No data model changes.

---

## [2] feat: surface run progression results in HistoryPage

**Summary**: `RunProgressionState.lastResult` ('progress' / 'hold' / 'regress') has been stored in `outcomeStore.progressionStates` since the run-adaptation module was introduced, but was never shown to users. This was recommended in passes 63, 64, and 65.

Users who have progression-eligible runs in their plan now see, in HistoryPage, a small colored annotation below each run's outcome metrics:
- Green **↑ Progressed — next target: N mi** (when the run triggered a distance increase)
- Amber **↓ Adjusted down — next target: N mi** (when the run triggered a distance decrease)
- Silent (no badge) for "hold" or "none" — avoids visual noise on most workouts

**Implementation**: `OutcomeMetrics` gains an optional `progressionState?: RunProgressionState | null` prop. `HistoryPage` builds a reverse-lookup `Map<instanceId, RunProgressionState>` from `outcomeStore.progressionStates` using `lastCompletedWorkoutInstanceId` as the key. Lookup is O(1) per item; the Map is only rebuilt when `progressionStates` changes.

**Files changed**:
- `src/components/workout/OutcomeMetrics.tsx` — new `progressionState` prop + two conditional render blocks
- `src/pages/HistoryPage.tsx` — import `RunProgressionState`, subscribe to `progressionStates`, build reverse-lookup `useMemo`, pass `progressionState` to `<OutcomeMetrics />`

**Risks / tradeoffs**: Additive. `OutcomeMetrics` already renders `progressionRecommendation` in a similar position. No new data is stored; the display reads existing persisted state. The reverse-lookup avoids scanning `progressionStates` per item.

**Rollback**: Revert commit `9260e11`. No state changes.

---

## [3] test: unit tests for settingsStore (5 tests)

**Summary**: `settingsStore` was the only Zustand store without any test coverage. Added 5 tests covering: default value, setStartDelay basic update, reset to 0, large values, and overwrite of a prior setting.

**Why it matters**: Completing store test parity. All 7 Zustand stores (`historyStore`, `outcomeStore`, `planStore`, `programStore`, `exerciseHistoryStore`, `mobilityStore`, `settingsStore`) now have at least basic test coverage.

**Files changed**:
- `src/store/__tests__/settingsStore.test.ts` — new file, 46 lines

**Risks / tradeoffs**: None — tests are read-only and follow the identical pattern used by all other store test files.

**Rollback**: Delete `src/store/__tests__/settingsStore.test.ts`.

---

# Overnight Changelog — 2026-06-28

## [1] feat: copy-workout button on CalendarPage day detail view

**Summary**: Users can now copy any rotation workout to the clipboard from the CalendarPage day detail modal. A "Copy workout" button appears in the Level 2 rotation detail view (below the workout slot details) for all date types: past, today, upcoming, and future. Tapping it calls `formatWorkoutForClipboard` and writes plain text to the system clipboard. The button turns green for 2 seconds after a successful copy.

**Why it matters**: TodayPage has had this button since pass 61. Extending it to CalendarPage lets users share historical workouts, preview scheduled training blocks, and quickly reference any day's plan without navigating away. This was recommended in both pass 63 and pass 64 review notes.

**Files changed**:
- `src/pages/CalendarPage.tsx` — added `Copy` icon import, `formatWorkoutForClipboard` import, `copied` state in `DayDetailModal`, and button JSX in the Level 2 rotation view.

**Risks / tradeoffs**: Purely additive. `navigator.clipboard.writeText()` errors (permission denied in some embedded contexts) are silently caught — same pattern as TodayPage. The `Copy workout` button is not shown when `isDayOff` since there's no workout content to copy.

**Rollback**: Revert the CalendarPage commit. Zero data model changes.

---

## [2] fix: CardioWorkoutTracker timer now reconciles with wall clock on resume

**Summary**: The cardio session timer previously used simple 1-second interval accumulation (`s + 1` on each tick). On iOS, browsers throttle or fully pause `setInterval` when the page is backgrounded. If a user locked their phone during a run, the displayed time and the duration reported to OutcomeModal would fall behind the actual elapsed time.

**Root cause**: `CardioWorkoutTracker` was authored without the wall-clock pattern that `ActiveWorkoutTracker` uses. The pattern is: store `{ elapsed, time }` as a base; each tick computes `baseElapsed + Math.floor((Date.now() - baseTime) / 1000)` rather than incrementing. A `visibilitychange` handler triggers an immediate reconcile on foreground restore.

**Fix**:
- Added `totalElapsedRef` and `segmentElapsedRef` (ref shadows of state) so callbacks avoid stale-closure bugs without `useCallback` deps.
- Added `wallTotalRef` and `wallSegRef` (`{ elapsed, time }` bases) updated each time the timer starts/resumes.
- Changed the `[isPaused]` effect to capture the current values into `wallTotalRef` / `wallSegRef` on each start, then compute from those bases in the interval.
- Added a `visibilitychange` effect for immediate display update on foreground restore.
- Updated `goNext`, `goPrev`, and `finish` to reset `wallSegRef` on segment advance and use `totalElapsedRef.current` in `onComplete` callbacks.

**Files changed**:
- `src/components/workout/CardioWorkoutTracker.tsx` — 48 insertions, 8 deletions. Pure timer logic refactor; JSX and rendering are unchanged.

**Risks / tradeoffs**: The fix changes internal computation only — no API surface, no data model, no props change. The new approach is identical to the proven `ActiveWorkoutTracker` pattern. `tsc --noEmit` exits clean.

**Rollback**: Revert the CardioWorkoutTracker commit.

---

## [3] test: unit tests for mobilityStore (18 tests)

**Summary**: The `mobilityStore` added in the previous human-authored feature commit had no unit test coverage. Added `src/store/__tests__/mobilityStore.test.ts` with 18 tests covering all 6 store actions and default state.

**Why it matters**: Every other Zustand store in the project has tests. `mobilityStore` is the data layer for the new daily mobility routine feature — bugs in reorder or removal logic could silently corrupt the user's routine. Completing coverage brings the test suite to parity.

**Files changed**:
- `src/store/__tests__/mobilityStore.test.ts` — new file, 195 lines, 25 test files total.

**Risks / tradeoffs**: Tests are read-only. The `persist` middleware is mocked as a pass-through (same pattern as all other store test files). `resetStore` uses `setState` to restore the default routine between tests so they are fully isolated.

**Rollback**: Delete `src/store/__tests__/mobilityStore.test.ts`.

---

# Overnight Changelog — 2026-06-27

## [1] fix: Undo after double-day now removes the advance override

**Problem**: When a user logs a double-day workout, the flow adds an `advance` override to
the history store (to shift the rotation pointer forward) alongside a `double_day`
`ExtraWorkoutEntry`. The Undo button on TodayPage correctly removed the primary entry,
outcome, and double-day extras, but did NOT remove the `advance` override. After pressing
Undo, the rotation pointer remained one step ahead permanently — the user would see the
day-after-next as "upcoming" instead of the correct next day.

**Root cause**: The `advance` override is appended to `historyStore.overrides` by
`actions.advance()` inside the double-day branch of `handleOutcomeConfirm`. The Undo
handler had no mechanism to remove a specific override by type — only
`removeRetroJumpForDate` (date-scoped jump removal) and `clearPlanHistory` (destructive)
existed.

**Fix**:
- Added `removeLastOverrideByType(planId, type)` to `HistoryState` interface and
  implemented it in the Zustand store. It sorts matching overrides by `appliedAt`
  descending and removes only the most recent one — the minimum intervention to undo
  a single double-day's advance.
- Updated the Undo handler to track whether any `double_day` extras were removed, and
  call `removeLastOverrideByType(plan.id, 'advance')` when they were.

**Files changed**:
- `src/store/historyStore.ts` — `HistoryState` interface: added `removeLastOverrideByType`
  signature; `create()` body: added implementation
- `src/pages/TodayPage.tsx` — added `removeLastOverrideByType` store selector; updated
  Undo `onClick` to track `removedDoubleDay` flag and call the new action
- `src/store/__tests__/historyStore.test.ts` — 7 new tests covering the new action

**Risk**: Low. `removeLastOverrideByType` is a targeted filter — it cannot affect entries
or extras, and only touches the most recent override of the named type. The Undo handler
only calls it when it already confirmed a double_day extra was removed, so the code path
is strictly narrower than before. Easily reverted.

---

# Overnight Changelog — 2026-06-26

## [1] fix: enforce 7-day minimum before showing adherence bar

**Problem**: The comment on `loggedRate` in `TodayPage.tsx` stated the adherence bar
was "shown after plan has been active ≥ 7 days so the percentage is meaningful."
However, `computeLoggedRate` returns `0` (not `null`) once `activeDays >= 1`, so
the existing `loggedRate !== null` guard allowed the bar to appear after just 2
calendar days. The 7-day threshold was documented but not enforced in code.

**Fix**: Added `differenceInCalendarDays` import and a `planActiveDays >= 7` guard
alongside the existing null check so the implementation matches the documented intent.

**Files changed**:
- `src/pages/TodayPage.tsx` — `differenceInCalendarDays` import; `planActiveDays`
  computed from `parseISO(today) - parseISO(plan.startDate)`; display condition changed
  from `loggedRate !== null` to `loggedRate !== null && planActiveDays >= 7`

**Risk**: Low. UI-only change; no state mutations, no data model changes. The bar
simply becomes visible later than before (day 7 instead of day 2). Easily reverted.

---

# Overnight Changelog — 2026-06-25

## [1] fix: deduplicate `countPlanDayCompletions` by calendarDate

**Problem**: `countPlanDayCompletions` in `historyStats.ts` counted raw entry records,
not unique dates. Every other stat function (isPlanExpired, computeRotationCycleProgress,
computeRotationPlanRemaining, countTotalUnloggedDays) uses a Set of calendarDates to prevent
CSV-import duplicates from inflating counts. This function did not, so a re-imported CSV
could cause the "Session N" label in TodayPage to report an incorrect (inflated) number.

**Fix**: Collect matching entries' calendarDates into a `Set` and return `dates.size`.

**Files changed**:
- `src/lib/historyStats.ts` — `countPlanDayCompletions` now deduplicates by calendarDate
- `src/lib/__tests__/historyStats.test.ts` — new regression test: two entries for the same date count as one

**Risk**: Low. Pure function change; semantics for the normal case (one entry per date) are identical. Only the duplicate-entry edge case is affected.
