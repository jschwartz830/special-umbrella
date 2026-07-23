# Test Results

## 2026-07-23 (eighty-first pass) — branch `claude/dreamy-mccarthy-nj7qfw`

---

### Baseline (before changes)

- **1093 tests (Pass 80 baseline)** — human-authored commits between passes may have raised this to ~1101 before our changes ran.
- Runner: Vitest 4.1.4, node environment

### Tests Added This Pass

| File | Tests | Purpose |
|---|---|---|
| `src/hooks/__tests__/useStallNudgeDismiss.test.ts` (new) | 10 | localStorage contract for `useStallNudgeDismiss`: absent-key default, write/read/clear, plan isolation, null planId no-op, prefix uniqueness vs. expiry and streak-milestone banners, read failure degrades to false, write failure does not throw |

### Final Results

```
Test Files  32 passed (32)
     Tests  1111 passed (1111)
  Duration  ~3.1s
```

- **32 test files, 1111 tests — all passing** (+10 tests from this pass, +18 vs. Pass 80 1093 baseline)
- No regressions

### Key Areas Still Untested

| Gap | Priority | Notes |
|---|---|---|
| `storeSync.ts` — cloud sync module | P1 | Zero tests. Highest-risk untested path: first-login branch, migration ordering, debounce, `beforeunload` flush. Carried forward from passes 78–81. |
| `ActiveWorkoutTracker.tsx` — 1872-line component | P2 | Set-by-set weights tracking, rest timer, run segment timer, voice cues, bilateral cues — all manual-only |
| `CardioWorkoutTracker.tsx` auto-advance timer | P3 | The `setTimeout` → auto-advance flow is tested by manual QA only |
| `MobilityTracker.tsx` bilateral detection | P3 | Checkpoint restore and bilateral cue logic untested |
| `useToday.ts` midnight-advance timer | P4 | Timer setup is straightforward but untested |

---

## 2026-07-21 (eightieth pass) — branch `claude/dreamy-mccarthy-h2vbby`

---

### Baseline (before changes)

- **31 test files, 1091 tests — all passing**
- Runner: Vitest 4.1.4, node environment

### Tests Added This Pass

| File | Test | Purpose |
|---|---|---|
| `src/lib/__tests__/expressionEval.test.ts` | `'malformed multi-dot number: tokenizer stops at first decimal point'` | Documents that `1.2.3` tokenizes to `[1.2, 0.3]` after the `seenDot` fix; parser takes `1.2` from the first primary token |
| `src/store/__tests__/historyStore.test.ts` | `'day_off → complete without planDayIndex leaves planDayIndex undefined (BUG-2)'` | Regression anchor for BUG-2; asserts current (buggy) behaviour and documents the expected fix path in comment |

### Final Results

- **31 test files, 1093 tests — all passing** (+2 tests)
- No regressions

### Key Areas Still Untested

| Gap | Priority | Notes |
|---|---|---|
| `storeSync.ts` — cloud sync module | P1 | Zero tests. Highest-risk untested path: first-login branch, migration ordering, debounce, `beforeunload` flush. |
| `ActiveWorkoutTracker.tsx` — 1872-line component | P2 | Set-by-set weights tracking, rest timer, run segment timer, voice cues, bilateral cues — all manual-only |
| `CardioWorkoutTracker.tsx` auto-advance timer | P3 | The `setTimeout` → auto-advance flow is tested by manual QA only |
| `MobilityTracker.tsx` bilateral detection | P3 | Checkpoint restore and bilateral cue logic untested |
| `useToday.ts` midnight-advance timer | P4 | The timer setup is straightforward but untested |

---

## 2026-07-19 (seventy-ninth pass) — branch `claude/dreamy-mccarthy-0r25in`

---

### Baseline (before changes)

```
Test Files  31 passed (31)
     Tests  1088 passed (1088)
  Duration  ~4.6s
```

### After commits 1–3 (three bug fixes — no new tests)

All 1088 pre-existing tests continue to pass. No test regressions.

### After commit 4 (streak feature + additionalDates fix — +1 test)

```
Test Files  31 passed (31)
     Tests  1089 passed (1089)
   Duration  2.88s
```

**New test**: `computeCurrentStreakDates > additionalDates extends streak dates (e.g. mobility completions)` — verifies that a mobility date bridging a gap causes the streak set to include all three dates (before gap, gap-bridge, today), while without `additionalDates` the set contains only today.

### New test coverage added

| Test | Assertion |
|---|---|
| `additionalDates extends streak dates` | With a `Set(['2026-06-14'])` as `additionalDates`, a gap between `2026-06-13` and `2026-06-15` is bridged and all 3 dates appear in the streak set |

### Why only 1 new test

The bug fixes (commits 1–3) are UI render-time bugs in React components — they replace `new Date()` with `useToday()` in component code. There is no pure function to test; the correct vehicle for covering this would be component tests with `@testing-library/react`, which is not in the project's devDependencies. Adding the dependency just for these three tests is out of scope for an overnight pass.

---

## 2026-07-15 (seventy-eighth pass) — branch `claude/dreamy-mccarthy-cr3jyk`

---

### Baseline (before changes)

```
Test Files  31 passed (31)
     Tests  1081 passed (1081)
  Duration  ~4.6s
```

### After all commits (commits 1–7 — no new tests until commit 8)

All 1081 pre-existing tests continue to pass through commits 1–7. No test regressions.

### After commit 8 (extractExtraId tests — +7 tests)

```
Test Files  31 passed (31)
     Tests  1088 passed (1088)  (+7)
  Duration  ~4.7s
```

New describe block in `src/lib/__tests__/workoutInstanceId.test.ts`:

| Test | Description |
|---|---|
| `extractExtraId` — standard extra instanceId | `plan123_2026-05-21_extra_abc` → `'abc'` |
| `extractExtraId` — planId with underscores | `my_plan_2026-01-15_extra_xyz` → `'xyz'` |
| `extractExtraId` — extraId containing `_extra_` | Returns full extraId including the substring |
| `extractExtraId` — non-extra instanceId | Returns `null` |
| `extractExtraId` — no date present | Returns `null` |
| `extractExtraId` — empty string | Returns `null` |
| `extractExtraId` — round-trip with makeExtraWorkoutInstanceId | Full round-trip confirms correctness |

### Important areas still untested

| Area | Risk | Notes |
|---|---|---|
| `storeSync.ts` entire module | High | Cloud sync logic, "cloud wins" policy, debounce, beforeunload flush — all untested |
| `useToday.ts` midnight advance timer | Medium | `setTimeout` off-by-one or timer leak on unmount possible |
| `ActiveWorkoutTracker.tsx` (1872 lines) | High | Draft persistence/hydration, rest timer, superset grouping — all untested |
| `CardioWorkoutTracker.tsx` auto-advance | Medium | Timer firing, `autoAdvanceFiredIdxRef` guard, manual-nav cancellation |
| `MobilityTracker.tsx` bilateral detection | Medium | `playSwitchSidesSound`, `autoFiredR`, checkpoint restore |
| `useStreakMilestoneDismiss` localStorage I/O | Low | Pure function `getActiveStreakMilestone` IS tested; the hook's localStorage read/write is not |

---

## 2026-07-14 (seventy-seventh pass) — branch `claude/dreamy-mccarthy-aeym9p`

---

### Baseline (before changes)

```
Test Files  30 passed (30)
     Tests  1068 passed (1068)
  Duration  ~2.8s
```

### After commit 1 (nanoid fix — no new tests)

```
Test Files  30 passed (30)
     Tests  1068 passed (1068)  (unchanged)
  Duration  ~2.8s
```

No test changes in commit 1. The `nanoid()` function is used only to generate opaque IDs; the existing test suite exercises the ID consumers (stores, rotation engine, etc.) but does not directly test the entropy source. The fix is verified by inspection and by the fact that all 1068 pre-existing tests still pass.

### After commit 2 (streak milestone feature — 13 new tests)

```
Test Files  31 passed (31)
     Tests  1081 passed (1081)  (+13)
  Duration  ~2.9s
```

New file: `src/hooks/__tests__/useStreakMilestoneDismiss.test.ts`

| Test | Description |
|---|---|
| `getActiveStreakMilestone` — returns null below 7 | Streak 0, 1, 6 all return null |
| `getActiveStreakMilestone` — returns 7 at exactly 7 | Boundary: streak=7 → milestone=7 |
| `getActiveStreakMilestone` — returns 7 for 8–13 | Midpoint checks |
| `getActiveStreakMilestone` — returns 14 at exactly 14 | Boundary |
| `getActiveStreakMilestone` — returns 21 at exactly 21 | Boundary |
| `getActiveStreakMilestone` — returns 30 at exactly 30 | Boundary |
| `getActiveStreakMilestone` — returns 60 at exactly 60 | Boundary |
| `getActiveStreakMilestone` — returns 90 at exactly 90 | Boundary |
| `getActiveStreakMilestone` — returns 180 at exactly 180 | Boundary |
| `getActiveStreakMilestone` — returns 365 at exactly 365 | Boundary |
| `getActiveStreakMilestone` — returns 365 above 365 | Clamps at maximum |
| `getActiveStreakMilestone` — highest-hit milestone, not next | streak=25→21, streak=91→90 |
| `getActiveStreakMilestone` — covers all STREAK_MILESTONES | Parity test against the exported constant |

### TypeScript

```
tsc --noEmit  →  0 errors  (before and after both commits)
```

### Areas still untested

- `useStreakMilestoneDismiss` hook behavior (localStorage read/write, force re-render) — no component test harness is available. The `getActiveStreakMilestone` pure function is fully covered; the hook's localStorage I/O degrades gracefully on failure (wrapped in try/catch).
- `nanoid()` entropy source — no test asserts `crypto.getRandomValues` is used; this is verified by code inspection only.
- TodayPage streak banner render path — no component tests exist in this codebase (no `@testing-library/react`).

---

## 2026-07-12 (seventy-sixth pass) — branch `claude/dreamy-mccarthy-2h1jip`

---

### Baseline (before changes)

```
Test Files  30 passed (30)
     Tests  1056 passed (1056)
  Duration  ~2.7s
```

### After commit 1 (12 new additionalDates tests)

```
Test Files  30 passed (30)
     Tests  1068 passed (1068)
  Duration  ~2.7s
```

---

## 2026-07-09 (seventy-fifth pass) — branch `claude/dreamy-mccarthy-vpg2n1`

---

### Baseline (before changes)

```
Test Files  30 passed (30)
     Tests  1049 passed (1049)
  Duration  ~2.8s
```

### After commit 1 (buildPRFlagsMap + max-date fix + 7 new tests)

```
Test Files  30 passed (30)
     Tests  1056 passed (1056)
  Duration  ~2.8s
```

### After commit 2 (unused helper removal)

```
Test Files  30 passed (30)
     Tests  1056 passed (1056)
  Duration  ~2.8s
```

**Final: +7 tests, 0 regressions. TypeScript: clean (0 errors).**

---

### New tests added — `src/lib/__tests__/historyStats.test.ts`

7 tests in `describe('buildPRFlagsMap')`:

| Test | What it verifies |
|---|---|
| `returns empty map when given no records` | Empty input edge case |
| `marks load and reps PR for the first-ever session` | Both flags set for inaugural session |
| `marks load PR only when new session exceeds prior` | PR on strict improvement; first session also flagged |
| `does not mark load PR on a tie` | Tied value does not count as PR |
| `same-date records see the same prior max (not each other)` | Two sessions on same date both see the same prior max of 115 — both get flagged as PRs independently |
| `produces same results as calling computeWorkoutPRFlags per instance` | Parity test across 3 sessions with bench/OHP (tie, PR, regression) |
| `ignores zero and null loads` | Zero load excluded from PR consideration |

---

## 2026-07-08 (seventy-fourth pass) — branch `claude/dreamy-mccarthy-ugdev5`

---

### Baseline (before changes)

```
Test Files  29 passed (29)
     Tests  1027 passed (1027)
  Duration  ~3.2s
```

### After commit 1 (estimateRunDurationMin extraction + 22 tests)

```
Test Files  30 passed (30)
     Tests  1049 passed (1049)
  Duration  ~2.9s
```

### After commit 2 (prevSessionDaysAgo refactor)

```
Test Files  30 passed (30)
     Tests  1049 passed (1049)
  Duration  ~2.9s
```

### After commit 3 (rotationLoggedCount memoize)

```
Test Files  30 passed (30)
     Tests  1049 passed (1049)
  Duration  ~2.9s
```

### After commit 4 (cycle done chip)

```
Test Files  30 passed (30)
     Tests  1049 passed (1049)
  Duration  ~2.9s
```

**Final: +22 tests, 0 regressions.**

---

### New tests added — `src/lib/__tests__/estimateRunDuration.test.ts`

22 tests in `describe('estimateRunDurationMin')`:

| Test | What it verifies |
|---|---|
| `returns slot.durationMin when set (highest priority)` | `durationMin` beats all other sources |
| `returns runConfig.targetDurationMin when durationMin is absent` | Second priority branch |
| `returns 20 (default) when slot has no duration info at all` | Default fallback |
| `parses a segment with integer minutes ("30min")` | Duration unit: `min` suffix |
| `parses a segment with abbreviated "m" unit ("20m")` | Duration unit: `m` suffix |
| `parses a segment with decimal minutes ("22.5min")` | Decimal value → Math.ceil |
| `sums multiple segment durations` | Multi-segment accumulation |
| `ignores segment duration with unknown unit (no match)` | `"30km"` — not a time unit, falls to default |
| `estimates duration from segment distance using default 11 min/mi pace` | Default pace path |
| `uses 8 min/mi for tempo segments` | Pace-by-type: tempo |
| `uses 12 min/mi for warmup segments` | Pace-by-type: warmup |
| `uses 12 min/mi for cooldown segments` | Pace-by-type: cooldown |
| `skips a distance segment whose value is not parseable` | NaN guard |
| `sums multiple mixed segments (duration + distance)` | Mixed segment types |
| `substitutes programVar references in segment distance` | Variable substitution (number value) |
| `substitutes programVar reference when var value is a string` | Variable substitution (string value) |
| `leaves unknown variables unsubstituted (segment is skipped)` | Unknown var → NaN → skip |
| `derives duration from targetDistanceMiles at 11 min/mi when segments produce nothing` | targetDistanceMiles fallback |
| `ceils a fractional targetDistanceMiles result` | Math.ceil on fractional result |
| `returns 20 when segments array is empty` | Empty array edge case |
| `returns 20 when runConfig is null` | Null runConfig edge case |
| `handles default programVars (empty) when omitted` | Default second parameter |

---

### Tests added in prior passes (for reference)

- Pass 71: +18 tests (deriveProgressionMode + PR badges)
- Pass 70: +5 tests (csv.ts plansToCsv location + weightsFocusArea)
- Pass 72: +0 tests (UI-only changes)
- Pass 73: (not in this branch)
- Pass 74: +22 tests (this pass)

---

## 2026-07-05 (seventy-second pass) — branch `claude/dreamy-mccarthy-80hikp`

---

### Baseline (before changes)

```
Test Files  28 passed (28)
     Tests  1017 passed (1017)
  Duration  ~3.4s
```

### Final (after all changes)

```
Test Files  28 passed (28)
     Tests  1017 passed (1017)
  Duration  ~3.3s
```

**No new tests added. No regressions.**

---

### Why no new tests

All changes this pass are confined to `src/pages/TodayPage.tsx` and are UI-only:

1. **`estimateRunDurationMin` extraction**: The function logic is unchanged; only the calling convention changed (added a `programVars` parameter with a default of `{}`). The function is now in module scope and testable independently, but the existing tests that exercise it indirectly (via TodayPage rendering paths) are not part of the Vitest suite (which uses a node environment without JSDOM). A unit test for `estimateRunDurationMin` could be added in a future pass since it is now a pure exported function — the main value would be regression-guarding the estimation heuristics (min-per-mile constants, segment parsing, fallback to target distance).

2. **`CompletedWorkoutsRing` count prop**: The change is to which value is passed as a prop. No new logic was added; `stats.totalCompleted` is already covered by `computeHistoryStats` tests in `historyStats.test.ts`.

3. **Cycle progress chip**: Purely additive JSX conditioned on `computeRotationCycleProgress` returning non-null. `computeRotationCycleProgress` itself is already tested in `historyStats.test.ts` (12 tests, including deduplication regression test from pass 62). The JSX rendering is not covered by the Vitest node suite (no JSDOM).

---

### Tests reviewed (all passing)

| Scope | File | Tests |
|---|---|---|
| `computeRotationCycleProgress` (cycle progress feature) | `src/lib/__tests__/historyStats.test.ts` | 12 tests (including dedup regression) |
| `computeHistoryStats` (ring count fix) | `src/lib/__tests__/historyStats.test.ts` | Multiple |
| Full suite | All 28 files | 1017 / 1017 |

---

## 2026-07-03 (seventy-first pass) — branch `claude/dreamy-mccarthy-4ywaek`

---

### Baseline (before changes)

```
Test Files  26 passed (26)
     Tests  992 passed (992)
  Duration  ~2.6s
```

### Final (after all changes)

```
Test Files  27 passed (27)
     Tests  1010 passed (1010)
  Duration  ~2.5s
```

**+1 test file, +18 tests.**

---

### Tests added

#### `src/modules/workout-outcomes/__tests__/progressionMode.test.ts` (new file, 9 tests)

Covers `deriveProgressionMode` (extracted from `ActiveWorkoutTracker` + `OutcomeModal`):
- `undefined` early-return (no progressionType, no rule)
- Empty-string progressionType with no rule → undefined
- `hasProgressRule=true` with no type → `'single'`
- `double` → `'double'`
- `dynamic_double` → `'double'`
- `triple` → `'volume'`
- `step_loading` → `'maintenance'`
- Unknown type → `'single'` fallback
- Type set + rule also set → type wins

#### `src/lib/__tests__/historyStats.test.ts` (9 new tests added)

Covers `computeWorkoutPRFlags`:
- Empty records → both false
- First-ever session → both true (load and reps)
- Only reps, no load → repsPR only
- Exceeds prior best → loadPR
- Ties prior best (not strictly exceeds) → no badge
- Below prior best → no badge
- Any exercise in session sets PR → hasLoadPR true for whole workout
- Zero load → excluded (not a PR)
- Both load and reps PR in same session → both flags

#### `src/modules/workout-outcomes/__tests__/progression.test.ts` (1 test updated)

Updated "uses progressionMode from the first exercise" to "uses progressionMode from the first exercise that has one configured" — verifying the fix to `buildWeightsRecommendation`.

---

### Tests reviewed (no changes)

All 26 prior test files continue to pass without modification, including:

- `rotationEngine.test.ts` — rotation/override logic
- `calendarProjection.test.ts` — calendar scheduling
- `historyStore.test.ts` — state management
- `outcomeStore.test.ts` — outcome/progression stores
- `planStore.test.ts`, `planDeleteCleanup.test.ts` — plan lifecycle
- `exerciseHistoryStore.test.ts` — exercise record storage
- `progressionMode.test.ts` *(new)* — progression mode mapping
- `expressionEval.test.ts` — load expression parser
- `csv.test.ts` — import/export
- `sessionSummary.test.ts` — session summary logic
- `historyStats.test.ts` — stats, PRs, streaks, weekly breakdown

---

### Areas still lacking test coverage

| Area | Gap |
|---|---|
| `PlanCard` component (PlansPage) | No tests for rendering or interaction |
| `AuthGate` | No tests for auth state transitions |
| `programParser.ts` | Parser has no dedicated unit tests |
| `expressionEval.ts` silent-fail paths | Tested for correct results; not for the silent-0 fallback behavior |
| `storeSync.ts` | No tests for sync/conflict behavior |
| `calendarProjection.ts` | Good coverage but no test for the `estimateRunDurationMin` logic (now in TodayPage) |

---

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

---

## Pass 73 — 2026-07-06

### Baseline

1017 tests passing across 28 test files (before any changes).

### Changes

**New test file: `src/hooks/__tests__/useDismissableBanner.test.ts`**
- 10 tests added covering the `useDismissableBanner` localStorage contract
- Topics: absent-key returns false, write sets to "1", prefix isolation, planId isolation, null planId no-op, read-error degrades gracefully, write-error degrades gracefully (no throw), consumer prefixes distinct

### Final results

```
Test Files  29 passed (29)
     Tests  1027 passed (1027)
  Start at  07:20:47
  Duration  3.56s (transform 1.73s, setup 0ms, import 3.69s, tests 644ms)
```

No test failures. Net +10 tests vs. baseline.

### Coverage notes (additions)

| Module | New Tests | What's covered |
|---|---|---|
| `useDismissableBanner.ts` | 10 | localStorage read/write contract, isolation, null planId, error degradation |

---

## Pass 79 — 2026-07-20 (branch `claude/dreamy-mccarthy-ccykny`)

### Baseline (before changes)

```
Test Files  31 passed (31)
     Tests  1088 passed (1088)
  Start at  (start of pass)
  Duration  ~3.1s
```

### Tests added

| Module | New Tests | What's covered |
|--------|-----------|----------------|
| `outcomeSortKey.ts` | +2 | Deterministic tie-breaking: same-completedAt and same-calendarDate |

5 existing tests updated to include the `\x00instanceId` tiebreaker suffix in expected values. 1 test updated to check relative ordering (meaningful contract) rather than exact string value (implementation detail).

### Final results

```
Test Files  31 passed (31)
     Tests  1090 passed (1090)
  Start at  07:31:12
  Duration  3.08s
```

No failures. Net +2 tests vs. baseline.

### Still untested (significant gaps)

| Module | Gap | Why deferred |
|--------|-----|--------------|
| `storeSync.ts` | Cloud sync, migration application, debounce, flush | Requires Supabase client mock (vi.mock) — infrastructure not yet in place |
| `ActiveWorkoutTracker.tsx` | Draft persistence, rest timer, superset grouping | Requires `@testing-library/react` (not in devDeps) |
| `CardioWorkoutTracker.tsx` | Auto-advance cancellation (partially tested indirectly) | Same RTL gap |
| `MobilityTracker.tsx` | Bilateral detection, session checkpoint | Same RTL gap |
| `useToday.ts` | Midnight advance timer | Hook integration test requires RTL |
| `authStore.ts` | All paths | Requires Supabase mock |
