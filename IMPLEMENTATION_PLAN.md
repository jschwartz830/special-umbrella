# Implementation Plan

## Pass 58 — 2026-06-16 (branch `claude/dreamy-mccarthy-b56q6q`)

### Observations on entry

- Baseline: **865 passing, 0 failing** — clean baseline inherited from pass 57.
- **`isPlanExpired` rotations path did not deduplicate**: Two history entries on the
  same calendar date (which the store allows transiently) would count as two rotation
  completions, potentially expiring a plan prematurely. `computeCurrentDayIndex` correctly
  deduplicates via a Map; `isPlanExpired` did not.
- **Duplicated "streakable dates" logic**: Both `computeHistoryStats` (~L58–62) and
  `computePlanStreak` (~L525–532) built nearly identical Sets from `entries` and `extras`.
  DRY violation — two places to update if the streakable-action definition ever changes.
- **Multi-slot attribution undocumented in source**: `computeWorkoutTypeBreakdown` only
  counts `slots[0].type` for plan days, but this was only documented in the test file,
  not at the usage site.
- **No exported utility for streak date enumeration**: Callers wanting to highlight
  streak days on a calendar had to re-implement the streak walk inline.

### Decisions

1. **Fix `isPlanExpired` deduplication** (BUG FIX): Count unique calendar dates
   via `new Set(...).size` instead of raw `.length`. Matches the deduplication
   contract of `computeCurrentDayIndex`.

2. **Extract `getStreakDatesSet` helper** (REFACTOR): Single source of truth for
   which dates qualify as "streakable" (`complete` / `day_off` entries + all extras).
   Optional `planId` param handles both global and plan-scoped use cases.

3. **Document single-slot attribution** (DOCS): Add an inline comment at the
   `slots[0]` reference in `computeWorkoutTypeBreakdown`.

4. **Add `computeCurrentStreakDates`** (FEATURE): Returns `Set<string>` of all
   consecutive streak dates ending on (or including) today. Callers can use this
   for calendar highlighting without re-implementing the backward walk.

### Risk assessment

All changes are confined to `src/lib/historyStats.ts` and `src/engine/rotationEngine.ts`
plus their test files. No component files were touched. All changes are additive (new
exports) or narrowing fixes (dedup). Zero new dependencies.

---

## Pass 57 — 2026-06-15 (branch `claude/dreamy-mccarthy-vqeg2i`)

### Observations on entry

- Baseline on entry: **845 passing, 0 failing** — clean exit from pass 56.
- Pass 56 fixed `useActivePlan` stale date, `ProgramVarsPanel` NaN display, added `isPlanExpired` pre-start test, and surfaced `computeLoggedRate` bar on TodayPage.
- Full codebase audit performed this pass.

### Architecture summary (unchanged from pass 56)

**Workout Plan Tracker** — React 18 + TypeScript + Zustand, Vite + Tailwind, deployed to GitHub Pages as a PWA.

**Core data flow:**
1. `planStore` — plan CRUD
2. `historyStore` — rotation entries, overrides, extras
3. `outcomeStore` — per-workout outcomes keyed by `workoutInstanceId`
4. `programStore` — YAML plan progression variables
5. `exerciseHistoryStore` — per-exercise session records
6. `rotationEngine.ts` — pure functions computing today's workout

**Key pages:** TodayPage (~1,212 lines), CalendarPage (~927 lines), HistoryPage (~985 lines)

### What appears strong

- `rotationEngine.ts` is pure functions, thoroughly tested, handles all edge cases
- Plan CRUD migration is robust (historyStore v1, planStore v2)
- All prior audit carry-forwards are handled well; the codebase has improved each pass
- 845 tests across 20 files is substantial coverage for a client-only app of this complexity

### Key issues found in this audit

| Priority | Issue | Status |
|----------|-------|--------|
| Medium | `logOutcomeWithProgression` step 2 has no try/catch — a progression-engine error propagates to TodayPage, leaving the outcome modal open and skipping the rotation advance | **Fixed** |
| Low | `outcomeStore` has no `version` field in persist config — adding one in future without migrate would wipe all outcomes | **Fixed** |
| Low | `deepCloneWorkoutSlot` shallow-clones `runConfig` object (not an array, but still a shared reference) | Recommendation only |
| Low | CalendarPage retroactive date change silently overwrites outcome at target date with no warning | Recommendation only |
| Info | TodayPage (1,212 lines), CalendarPage (927 lines) are large single files | Carry-forward |
| Info | `loggingUpcoming` stores a stale `ResolvedDay` snapshot (should store just `calendarDate`) | Carry-forward |

### Prioritized plan

1. ✅ **try/catch in `logOutcomeWithProgression` step 2** — wrap run-progression calls so a bug in the engine never prevents modal close or rotation advance
2. ✅ **Add `version: 1` to `outcomeStore` persist** — establishes migration baseline; safe no-op migration
3. ✅ **Test: progression error recovery** — 3 new tests confirm outcome is saved and function does not throw when engine throws

### Feature decision

No feature added this pass. The audit found a concrete reliability gap (the try/catch issue) warranting focused attention. Codebase is already feature-rich. Candidate features for the next pass:
1. "New PR" badge after logging a weights session (compare pre/post exercise records)
2. Per-page error boundaries (low risk, high resilience gain)
3. `runConfig` deep clone in `duplicatePlan` (small code change)

### Rationale for sequencing

Bug fix first (try/catch), then migration baseline (version field), then tests that guard the fix. No feature: audit findings indicated stabilization over growth for this pass.

### Carried-forward risks

- `TodayPage.tsx` (~1,212 lines) and `CalendarPage.tsx` (~927 lines) are large
- `outcomeStore` cross-store calls inside `logOutcomeWithProgression`; coupling makes unit-testing harder
- `loggingUpcoming` state in TodayPage stores a stale `ResolvedDay` (should store just `calendarDate`)
- `computeWorkoutTypeBreakdown` credits only `slots[0]` per plan day

---

## Pass 56 — 2026-06-13 (branch `claude/dreamy-mccarthy-qvt8m6`)

### Observations on entry

- Baseline on entry: **844 passing, 0 failing** — clean exit from pass 55.
- Pass 55 fixed NaN propagation in `evaluateUpdates`, fixed `updateEntryDate` dedup collision, and persisted `filterPlanId` in sessionStorage.
- Full codebase audit performed this pass.

### Architecture summary (unchanged from pass 55)

**Workout Plan Tracker** — React 18 + TypeScript + Zustand, Vite + Tailwind, deployed to GitHub Pages as a PWA.

**Core data flow:**
1. `planStore` — plan CRUD
2. `historyStore` — rotation entries, overrides, extras
3. `outcomeStore` — per-workout outcomes keyed by `workoutInstanceId`
4. `programStore` — YAML plan progression variables
5. `exerciseHistoryStore` — per-exercise session records
6. `rotationEngine.ts` — pure functions computing today's workout

**Key pages:** TodayPage (~1,240 lines), CalendarPage (~950 lines), HistoryPage (~985 lines)

### Key issues found in this audit

| Priority | Issue | Status |
|----------|-------|--------|
| Medium | `useActivePlan` computed `today` with a bare `format(new Date())` call — no midnight refresh if no store event fires | **Fixed** |
| Low | `ProgramVarsPanel` rendered 'NaN'/'Infinity' for corrupted program var values | **Fixed** |
| Low | No test for `isPlanExpired` when today < plan.startDate (pre-start plan) | **Fixed** |
| Low | `computeLoggedRate` surfaced in HistoryPage but not TodayPage, where users check daily | **Fixed** (feature) |
| Info | `computeWorkoutTypeBreakdown` credits only `slots[0]` per plan day | Documented (carry-forward) |
| Info | `loggingUpcoming` stores a stale `ResolvedDay` snapshot | Documented (carry-forward) |

### Prioritized plan

1. ✅ **Fix `useActivePlan` stale date** — swap bare `format(new Date())` for `useToday()` hook; TodayPage and any future hook consumers now refresh at midnight without an intervening store event
2. ✅ **Fix `ProgramVarsPanel` NaN/Infinity display** — renders '?' for non-finite values; defensive against any vars that slipped past the pass-55 evaluateUpdates guard
3. ✅ **Test: `isPlanExpired` pre-start plan** — documents the invariant that a weeks-plan with today < startDate returns false
4. ✅ **Feature: logged-rate bar on TodayPage** — `computeLoggedRate` was added to `historyStats` in pass 54 and surfaced in HistoryPage; now also visible on TodayPage below the weekly activity strip

### Rationale for sequencing

Bug fixes first (midnight stale date is the most impactful), then display fix (NaN), then test anchor, then the feature. Feature last because it is purely additive and never blocks the fixes.

### Carried-forward risks

- `TodayPage.tsx` (~1,240 lines) and `CalendarPage.tsx` (~950 lines) are large.
- `outcomeStore` cross-store calls inside `logOutcomeWithProgression`; coupling makes unit-testing harder.
- `loggingUpcoming` state in TodayPage stores a stale `ResolvedDay` (should store just `calendarDate`).
- `computeWorkoutTypeBreakdown` credits only `slots[0]` type for multi-slot plan days.

---

## Pass 55 — 2026-06-12 (branch `claude/dreamy-mccarthy-wh71fb`)

### Observations on entry

- Baseline on entry: **832 passing, 0 failing** — clean exit from pass 54.
- Pass 54 fixed the empty-slots crash in `WorkoutDayCard`, added `computeLoggedRate` + 11 tests, and surfaced the logged-rate bar in HistoryPage.
- Full codebase audit performed: all source files, stores, pages, engine, lib utilities, and all test files.

### Architecture summary (unchanged from pass 54)

**Workout Plan Tracker** — React 18 + TypeScript + Zustand, Vite + Tailwind, deployed to GitHub Pages as a PWA.

**Core data flow:**
1. `planStore` — plan CRUD
2. `historyStore` — rotation entries, overrides, extras
3. `outcomeStore` — per-workout outcomes keyed by `workoutInstanceId`
4. `programStore` — YAML plan progression variables
5. `exerciseHistoryStore` — per-exercise session records
6. `rotationEngine.ts` — pure functions computing today's workout

**Key pages:** TodayPage (~1,220 lines), CalendarPage (~950 lines), HistoryPage (~985 lines)

### Key issues found in this audit

| Priority | Issue | Status |
|----------|-------|--------|
| Medium | `evaluateUpdates` stores NaN/Infinity into programStore vars when ctx.vars contains corrupted values | **Fixed** |
| Medium | `updateEntryDate` raw-field-swap lets two entries coexist at the same (planId, date) | **Fixed** |
| Low | HistoryPage `filterPlanId` resets to default on every page navigation | **Fixed** (sessionStorage persistence) |
| Info | `computeWorkoutTypeBreakdown` credits only first slot per plan day | Documented (carry-forward) |
| Info | `isPlanExpired` does not deduplicate entries before counting | Documented (carry-forward) |

### Prioritized plan

1. ✅ **Fix `evaluateUpdates` NaN/Infinity guard** — prevents cross-variable corruption when YAML progression vars contain bad values; fall back to previous variable value; 4 new tests
2. ✅ **Fix `updateEntryDate` deduplication** — when moving an entry to a date that already has an entry for the same plan, remove the old entry (consistent with `addEntry` semantics); update contract test
3. ✅ **Persist HistoryPage `filterPlanId` across navigations** — sessionStorage key `wpt_history_filterPlanId`; validated against current `plans` on init; falls back gracefully

### Rationale for sequencing

Bug fixes first (NaN guard, dedup fix) — both touch hot paths. Feature last — sessionStorage persistence is purely additive with no store changes.

### Carried-forward risks

- `TodayPage.tsx` (~1,220 lines) and `CalendarPage.tsx` (~950 lines) are large.
- `outcomeStore` cross-store calls inside `logOutcomeWithProgression`; coupling makes unit-testing harder.
- `loggingUpcoming` state in TodayPage stores a stale `ResolvedDay` (should store just `calendarDate`).
- CSV import has no user feedback for skipped/rejected entries.
- `computeWorkoutTypeBreakdown` credits only `slots[0]` type for multi-slot plan days.

---

## Pass 54 — 2026-06-11 (branch `claude/dreamy-mccarthy-q8dj7t`)

### Observations on entry

- Baseline on entry: **821 passing, 0 failing** — clean exit from pass 53.
- Pass 53 added defensive plan.id filters in rotationEngine, moved ID constructors to workoutInstanceId.ts, and fixed the ExtraWorkoutEntry.source comment.
- Full codebase audit performed: all source files, stores, pages, engine, lib utilities, and all test files.

### Architecture summary (unchanged from pass 53)

**Workout Plan Tracker** — React 18 + TypeScript + Zustand, Vite + Tailwind, deployed to GitHub Pages as a PWA.

**Core data flow:**
1. `planStore` — plan CRUD
2. `historyStore` — rotation entries, overrides, extras
3. `outcomeStore` — per-workout outcomes keyed by `workoutInstanceId`
4. `programStore` — YAML plan progression variables
5. `exerciseHistoryStore` — per-exercise session records
6. `rotationEngine.ts` — pure functions computing today's workout

**Key pages:** TodayPage (~1,220 lines), CalendarPage (~950 lines), HistoryPage (~985 lines)

### Key issues found in this audit

| Priority | Issue | Status |
|----------|-------|--------|
| Medium | `WorkoutDayCard` crashes when `planDay.slots` is empty — `slots[0].type` throws TypeError | **Fixed** |
| Low | No "logged rate" metric showing what % of plan days have been logged | **Fixed** (new `computeLoggedRate` + HistoryPage UI) |
| Info | `updateEntryDate` relies on caller contract for deduplication; all callers correct | Documented (carry-forward) |
| Info | `computeWorkoutTypeBreakdown` credits only first slot per plan day | Documented (carry-forward) |
| Info | `isPlanExpired` does not deduplicate entries before counting | Documented (carry-forward) |

### Prioritized plan

1. ✅ **Fix `WorkoutDayCard` empty-slots crash** — `slots[0]?.type ?? 'rest'`, purely defensive
2. ✅ **Add `computeLoggedRate` with 11 tests** — new pure function in historyStats.ts
3. ✅ **Surface logged rate in HistoryPage** — thin progress bar + percentage below stats grid

### Rationale for sequencing

Crash fix first (zero risk, highest priority). Pure utility + tests second (additive, no UI coupling). UI display last so it can be trivially reverted independently of the logic.

### Carried-forward risks (unchanged from pass 53)

- `TodayPage.tsx` (~1,220 lines) and `CalendarPage.tsx` (~950 lines) are large.
- `outcomeStore` cross-store calls inside `logOutcomeWithProgression`; coupling makes unit-testing harder.
- `workoutInstanceId` parsing now defensive (parse uses date regex, handles underscore-heavy planIds).
- `loggingUpcoming` state in TodayPage stores a stale `ResolvedDay` (should store just `calendarDate`).
- CSV import has no user feedback for skipped/rejected entries.
- History page filter state not persisted across page reloads.

---

## Pass 53 — 2026-06-08 (branch `claude/dreamy-mccarthy-B7dXE`)

### Observations on entry

- Baseline on entry: **814 passing, 0 failing** — clean exit from pass 52.
- Pass 52 fixed `computePersonalRecords` date non-determinism, extracted `findPreviousSetsByExercise` to `lib/previousSetsHelper.ts`, and added Personal Records CSV export.
- Full codebase audit performed: all source files, stores, pages, engine, lib utilities, and all test files.

### Architecture summary (unchanged from pass 52)

**Workout Plan Tracker** — React 18 + TypeScript + Zustand, Vite + Tailwind, deployed to GitHub Pages as a PWA.

**Core data flow:**
1. `planStore` — plan CRUD
2. `historyStore` — rotation entries, overrides, extras
3. `outcomeStore` — per-workout outcomes keyed by `workoutInstanceId`
4. `programStore` — YAML plan progression variables
5. `exerciseHistoryStore` — per-exercise session records
6. `rotationEngine.ts` — pure functions computing today's workout

**Key pages:** TodayPage (~1,220 lines), CalendarPage (~950 lines), HistoryPage (~985 lines)

### Key issues found in this audit

| Priority | Issue | Status |
|----------|-------|--------|
| Low | `ExtraWorkoutEntry.source` comment contradicted the actual migration behavior | **Fixed** |
| Low | `makeWorkoutInstanceId`/`makeExtraWorkoutInstanceId` lived in outcomeStore.ts; historyStats.ts hardcoded the format string | **Fixed** (constructors moved to lib/workoutInstanceId.ts) |
| Medium | rotationEngine functions did not filter entries/overrides by plan.id — callers bore the full responsibility; passing unfiltered store data would silently mix plans | **Fixed** (defensive plan.id filters added throughout) |
| Info | No tests documenting plan isolation or swap_slot behavior in rotationEngine | **Fixed** (3 new regression tests) |

### Prioritized plan

1. ✅ **Fix misleading `ExtraWorkoutEntry.source` comment** — 1-line doc fix, zero risk
2. ✅ **Move ID constructors to lib/workoutInstanceId.ts** — colocation + removes hardcoded format in historyStats.ts
3. ✅ **Defensive plan.id filter in rotationEngine** — engine now correct even with unfiltered inputs
4. ✅ **3 new regression-anchor tests** — plan isolation, swap_slot no-op on pointer

### Rationale for sequencing

Documentation first (zero risk). Refactor second (backward compatible, re-export preserves all callers). Engine fix third (additive filter, no behavior change for pre-filtered callers). Tests alongside each change.

### Carried-forward risks (unchanged from pass 52)

- `TodayPage.tsx` (~1,220 lines) and `CalendarPage.tsx` (~950 lines) are large.
- `outcomeStore` has cross-store calls inside `logOutcomeWithProgression`; coupling makes unit-testing harder.
- `workoutInstanceId` parsing now defensive (parse uses date regex, handles underscore-heavy planIds).
- `loggingUpcoming` state in TodayPage stores a stale `ResolvedDay` (should store just `calendarDate`).
- CSV import has no user feedback for skipped/rejected entries.
- History page filter state not persisted across page reloads.

---

## Pass 52 — 2026-06-07 (branch `claude/dreamy-mccarthy-j725m`)

### Observations on entry

- Baseline on entry: **801 passing, 0 failing** — clean exit from pass 51.
- Pass 51 fixed `useToday()` in HistoryPage, DayDetailModal setState-during-render, and wired `computeWorkoutTypeBreakdown` with avgEffort into HistoryPage.
- Full codebase audit performed: all source files, stores, pages, lib utilities.

### Architecture summary (unchanged from pass 51)

**Workout Plan Tracker** — React 18 + TypeScript + Zustand, Vite + Tailwind, deployed to GitHub Pages as a PWA.

**Core data flow:**
1. `planStore` — plan CRUD
2. `historyStore` — rotation entries, overrides, extras
3. `outcomeStore` — per-workout outcomes keyed by `workoutInstanceId`
4. `programStore` — YAML plan progression variables
5. `exerciseHistoryStore` — per-exercise session records
6. `rotationEngine.ts` — pure functions computing today's workout

**Key pages:** TodayPage (~1,220 lines), CalendarPage (~950 lines), HistoryPage (~985 lines)

### Key issues found in this audit

| Priority | Issue | Status |
|----------|-------|--------|
| Medium | `computePersonalRecords` iterated exercise history in arbitrary insertion order; `>` comparison means same-load PR date stays on first occurrence, not most recent | **Fixed** |
| Low | `findPreviousSetsByExercise` duplicated in TodayPage and CalendarPage with identical logic; drift risk on future changes | **Fixed** (extracted to shared lib) |
| Info | Personal Records page section had no export — the only stats table without a CSV download | **Fixed** (feature added) |

### Prioritized plan

1. ✅ **Fix `computePersonalRecords` date non-determinism** — sort records ascending by `calendarDate` before iterating; change `>` to `>=` for both load and reps comparisons so the most recent session matching the PR value gets the date
2. ✅ **Extract `findPreviousSetsByExercise` to `src/lib/previousSetsHelper.ts`** — unifies two identical implementations; TodayPage and CalendarPage both updated to import the shared version
3. ✅ **Personal Records CSV export** — `personalRecordsToCsv` in `csv.ts`, Export CSV button in HistoryPage `PersonalRecordsSection`
4. ✅ **Tests** — 4 new tests in `historyStats.test.ts`, 6 in new `previousSetsHelper.test.ts`, 3 in `csv.test.ts`

### Rationale for sequencing

Bug fix first: the `computePersonalRecords` issue is a user-visible data correctness problem — a user who hit the same PR on a later date would see an old date on their records. Refactor second: extracting `findPreviousSetsByExercise` closes a drift risk before the codebase grows further. Feature third: Personal Records export is strictly additive and uses the infrastructure already proven correct.

---

## Pass 51 — 2026-06-06 (branch `claude/dreamy-mccarthy-HOACg`)

### Observations on entry

- Baseline on entry: **798 passing, 0 failing** — clean exit from pass 50.
- Pass 50 fixed `applyProgressionRule` error guard, `getTodayResolvedDay` 0-day guard, and added ProgramVarsPanel.
- Full codebase audit performed: all source files, stores, pages.

### Architecture summary (unchanged from pass 50)

**Workout Plan Tracker** — React 18 + TypeScript + Zustand, Vite + Tailwind, deployed to GitHub Pages as a PWA.

**Core data flow:**
1. `planStore` — plan CRUD
2. `historyStore` — rotation entries, overrides, extras
3. `outcomeStore` — per-workout outcomes keyed by `workoutInstanceId`
4. `programStore` — YAML plan progression variables
5. `exerciseHistoryStore` — per-exercise session records
6. `rotationEngine.ts` — pure functions computing today's workout

**Key pages:** TodayPage (~1,220 lines), CalendarPage (~950 lines), HistoryPage (~972 lines)

### What appears strong

- Pure-function rotation engine with 798+ tests on entry; all passing.
- Expression evaluator handles YAML progression DSL safely.
- Strong migration patterns in historyStore (v1) and planStore (v2).
- Consistent separation of engine / stores / modules / lib / UI layers.
- Future-entry guards now consistent across all rotation stat functions.

### Key issues found in this audit

| Priority | Issue | Status |
|----------|-------|--------|
| Low | HistoryPage uses stale `today` date (same class as CalendarPage pass 46) | **Fixed** |
| Low | `DayDetailModal` calls own setState during render — strict mode warning | **Fixed** |
| Low | HistoryPage `typeCountMap` doesn't surface avgEffort from outcomes | **Fixed** |
| Low | `computeWorkoutTypeBreakdown` tests only use 'weightlifting' slot type, not 'weights' | **Fixed** (tests added) |
| Info | `WorkoutType` has 'weights' AND 'weightlifting' as separate values | Documented (carry-forward) |
| Info | `findPreviousSetsByExercise` still duplicated in TodayPage and CalendarPage | Documented (carry-forward) |

### Prioritized plan

1. ✅ **Wire `useToday()` into HistoryPage** — same fix as CalendarPage pass 46
2. ✅ **Fix DayDetailModal setState-during-render** — useEffect pattern
3. ✅ **Replace typeCountMap with computeWorkoutTypeBreakdown + avgEffort** — surfaces new data from existing infrastructure
4. ✅ **Add tests** — 3 new tests for computeWorkoutTypeBreakdown with 'weights' type
5. ⬜ 'weights' vs 'weightlifting' naming — cleanup deferred (high churn, no user-visible bug)
6. ⬜ Extract shared `findPreviousSetsByExercise` — deferred (medium refactor)

### Rationale for sequencing

Bug fixes first (useToday and DayDetailModal). Feature last. Tests anchor the production-realistic 'weights' slot type path that HistoryPage now exercises.

---

## Pass 50 — 2026-06-05 (branch `claude/dreamy-mccarthy-UIayl`)

### Observations on entry

- Baseline on entry: **793 passing, 0 failing** — clean exit from pass 49.
- Pass 49 fixed a future-entry guard in rotation stats functions and added "Rotation X of Y" header.
- Full codebase audit performed: all source files read, all stores, engine, both key pages.

### Architecture summary

**Workout Plan Tracker** — React 18 + TypeScript + Zustand, Vite + Tailwind, deployed to GitHub Pages as a PWA.

**Core data flow:**
1. `planStore` — plan CRUD (active plan drives everything else)
2. `historyStore` — rotation entries, overrides, extra workouts (persisted to `wpt_history`)
3. `outcomeStore` — per-workout outcome records keyed by `workoutInstanceId` (persisted to `wpt_outcomes`)
4. `programStore` — YAML plan progression variables (persisted to `wpt_program_vars`)
5. `exerciseHistoryStore` — per-exercise session records for charting (derived from outcomes)
6. `rotationEngine.ts` — pure functions computing today's workout from the above data

**Key pages:**
- `TodayPage.tsx` (1175+ lines) — today's workout, nudges, upcoming preview, double-day flow
- `CalendarPage.tsx` (~950 lines) — retroactive logging, month grid, day detail modals

### What appears strong and well-designed

- Rotation engine is pure functions, thoroughly tested, handles edge cases (overrides, go_back, dedup)
- Zustand stores have clean interfaces; cross-store calls use `.getState()` to avoid circular deps
- historyStore migration (v0→v1) is correct and tested
- Test coverage for core logic (engine, stores, lib) is high (~793 tests passing)
- Double-day flow is architecturally sound (ExtraWorkoutEntry + separate outcome keys)
- Entry deduplication strategy (newest-createdAt wins) is consistent across engine and store

### Key issues found in this audit

| Priority | Issue | Status |
|----------|-------|--------|
| Medium | `applyProgressionRule` not wrapped in try/catch — malformed YAML rule could throw and disrupt the workout log flow | **Fixed** |
| Medium | `getTodayResolvedDay` has no guard for `plan.days.length === 0` — would produce `planDay=undefined` and crash callers | **Fixed** |
| Low | CalendarPage slot fallback `{ id: '', type: 'rest' }` when planDay has no slots — progression skipped silently | Documented |
| Low | Double-day flow only picks `upcoming[0].planDay.slots[0]` — multi-slot days partially supported | Documented |
| Low | `outcomeStore.logOutcomeWithProgression` section 3 (YAML progression) has no outer error guard — now partially addressed by programStore fix | Improved |
| Low | `findPreviousSetsByExercise` O(n) scan per render — exercise history store already has a better index | Documented |
| Low | CalendarPage re-grids entire month on any entry change — scope reduction possible | Documented |

### Prioritized plan

1. ✅ **Error resilience: `applyProgressionRule`** — highest-risk silent failure path
2. ✅ **Empty plan guard in `getTodayResolvedDay`** — correctness fix, mirrors peer functions
3. ✅ **Tests for the above** — 5 new tests covering both fixes
4. ✅ **Feature: Program Variables Inspector** — low-risk, high-value for YAML plan users
5. ⬜ **Slot fallback handling in CalendarPage** — recommend explicit guard, not implemented
6. ⬜ **Calendar re-render optimization** — profile first, not worth blind change
7. ⬜ **Multi-slot double-day support** — product decision needed first

### Rationale for sequencing

Bug fixes first: the `applyProgressionRule` error is the most impactful because it silently breaks YAML plan progression — a key differentiating feature. The empty plan guard is lower real-world risk (hard to create empty plans via UI) but is a correctness issue that makes the function inconsistent with its peers.

Tests before feature: new tests lock in the fixes and give a regression baseline before adding new surface area.

Feature last: ProgramVarsPanel is purely additive; if it had introduced any regressions, the fixes would already be captured in prior commits.

---

## Pass 49 — 2026-06-04 (branch `claude/dreamy-mccarthy-WovqU`)

### Observations on entry

- Baseline on entry: **788 passing, 0 failing** — clean exit state from pass 48.
- Pass 48 fixed `isPlanExpired` future-entry guard, extracted `outcomeSortKey`, wired `computeConsecutiveSkips` to TodayPage.
- Full codebase audit performed: all source files, all tests, all stores, both key pages.

### Key findings

**Bug — `computePlanProgress` (rotations), `computeRotationCycleProgress`, `computeRotationPlanRemaining` all miss the future-entry filter**
Pass 48 fixed `isPlanExpired` with `e.calendarDate <= today` but left these three utility functions unpatched. A CSV import with `calendarDate > today` would:
- Show the wrong rotation number in the cycle bar (inflated `doneInCycle`)
- Show artificially low `rotationPlanRemaining`
- Show inflated `computePlanProgress.completed` for rotations plans

This is a direct inconsistency with the now-correct `isPlanExpired`. Low occurrence in practice but creates confusing UI when it happens.

**UX gap — No "Rotation X of Y" overview for multi-rotation plans**
For weeks-based plans, TodayPage shows "Week 3 of 8" in the header subtext. For rotations-based plans, only within-cycle detail (`3/7 done`, `last one!`) and end-of-plan hints (`2 left to finish`) are shown; there is no "you are in rotation 2 of 4" context. Users tracking a 4-rotation plan cannot tell which rotation they are in without mental arithmetic from the cycle bar.

**Audit finding — `DayDetailModal` calls parent state setter during render (line 729)**
`setDetailTarget(null)` is called when the selected extra can't be found mid-render. This pattern (own-component state update during render) works in React but triggers a strict-mode warning in development. Not user-visible; low priority.

**Audit finding — `WorkoutType` has two synonymous string values: `'weights'` and `'weightlifting'`**
`WORKOUT_TYPES` in CalendarPage uses `'weights'` while the rotation engine test fixtures use `'weightlifting'`. Both appear in `WorkoutType`. This is legacy naming but creates ambiguity when reading stats breakdowns. No user-visible bug exists today.

**All prior risks remain (no new architectural concerns)**
- `TodayPage.tsx` (~1,180 lines) and `CalendarPage.tsx` (~950 lines) — large files, refactor deferred
- `outcomeStore` cross-store coupling in `logOutcomeWithProgression`
- `workoutInstanceId` parsing trusts nanoid charset (base-36, no `_`)

### Decisions

- **Fix future-entry filter in all three stats functions** (BUG, high confidence): Consistent with `isPlanExpired`. `computeRotationCycleProgress` and `computeRotationPlanRemaining` get an optional `today` parameter (backward-compatible). `computePlanProgress` rotations branch adds the guard inline. TodayPage callers updated to pass `today`. Five new regression tests added.

- **Add "Rotation X of Y" to TodayPage header** (FEATURE, low risk): Uses the now-corrected `computePlanProgress` for rotations plans. Only shown when `duration.value > 1`. Mirrors the existing "Week X of Y" display for weeks plans. Hidden when expired. Includes "· last rotation!" parallel to "· last week!".

### Not implemented (recommendations only)

- `DayDetailModal` render-phase state call: acceptable React pattern (own-component derived-state bail-out); document-only.
- `WorkoutType` 'weights' vs 'weightlifting' naming: legacy; no user-visible bug; cleanup deferred to avoid churn.
- `computeWorkoutTypeBreakdown` multi-slot attribution: carry-forward from pass 47.
- `logForDate` day_off + jump interaction: carry-forward from pass 44.

### Architecture summary (unchanged from pass 48)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores. Rotation logic is pure functions in `rotationEngine.ts`. Stats are pure utilities in `historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

### Key strengths (unchanged)

- Pure-function rotation engine with 793 tests on exit; all passing.
- Expression evaluator handles YAML progression DSL safely (no `eval()`).
- Strong migration patterns in historyStore (v1) and planStore (v2).
- Consistent separation of engine / stores / modules / lib / UI layers.
- Future-entry guards now consistent across all rotation stat functions.

### Key risks (carried forward)

- `TodayPage.tsx` (~1,180 lines) and `CalendarPage.tsx` (~950 lines) are large; future refactors into smaller units would reduce cognitive load.
- `outcomeStore` has cross-store calls inside `logOutcomeWithProgression`; coupling makes unit-testing harder.
- `workoutInstanceId` parsing relies on nanoid never generating `_` — holds for the current base-36 charset but would silently break if the charset changes.

---

## Pass 48 — 2026-06-02 (branch `claude/dreamy-mccarthy-lm1Op`)

### Observations on entry

- Baseline on entry: **786 passing, 0 failing** — clean exit state from pass 47.
- Pass 47 added `computeConsecutiveSkips` (pure utility, not yet wired to UI) and 16 tests documenting known gaps.
- Full codebase audit resumed from pass 47 carry-forward list.

### Key findings

**Bug — `isPlanExpired` counts future-dated entries for rotations** (`rotationEngine.ts:251`):
The filter `e.planId === plan.id && (e.action === 'complete' || e.action === 'skip')` had no date guard. An imported or manually-entered `HistoryEntry` with `calendarDate > today` would be counted toward the rotation total, potentially triggering the "Plan complete!" banner while the plan still has future rotations to run. The `weeks`-duration branch correctly uses a date comparison and was unaffected.

**UX gap — Calendar legend missing `past_unlogged` entry** (`CalendarPage.tsx`):
Five legend items (Done, Pending, Upcoming, Day Off, Skipped) but the `past_unlogged` status (`bg-slate-800/20`) had no label, leaving users without a visual key for cells representing workouts missed without any logged action.

**Code duplication — `outcomeSortKey` defined locally in both pages**:
`TodayPage.tsx` (lines ~114–116) and `CalendarPage.tsx` (lines ~38–40) each had an identical local function. No shared utility existed; pass 46 noted this but deferred it.

**Deferred feature now tractable — `computeConsecutiveSkips` wiring**:
Pass 47 added the utility and 15 tests. The function is zero-risk to wire into TodayPage since it's pure and already tested.

### Decisions

- **Fix `isPlanExpired` future-entry bug** (BUG, high confidence): Add `&& e.calendarDate <= today` to the filter. Two new tests verify the fix.
- **Add "Unlogged" to Calendar legend** (UX FIX, trivial): Additive JSX change only.
- **Extract `outcomeSortKey` to shared lib** (REFACTOR, low risk): New file `src/lib/outcomeSortKey.ts`. Both pages updated to import from there.
- **Wire `computeConsecutiveSkips` to TodayPage** (FEATURE, low risk): Amber nudge banner after 3+ consecutive skips, with Calendar shortcut. Suppressed when plan is expired.

### Not implemented (recommendations only)

- **Fix `computeWorkoutTypeBreakdown` multi-slot attribution**: Medium complexity; product decision needed (single-slot behavior is fine for current use).
- **`logForDate` day_off + jump interaction** (carried from pass 44): Still open. Low occurrence probability.
- **`programVarsMap` subscription granularity** (carried from pass 44): Still open. Low impact.

### Architecture summary (unchanged from pass 47)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores: `planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`. Rotation logic is pure functions in `rotationEngine.ts`. Stats are pure utilities in `historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

### Key strengths (unchanged)

- Pure-function rotation engine with 788 tests on exit; all passing.
- Expression evaluator handles YAML progression DSL safely (no `eval()`).
- Strong migration patterns in historyStore (v1) and planStore (v2).
- Consistent separation of engine / stores / modules / lib / UI layers.

### Key risks (carried forward)

- `TodayPage.tsx` (~1,150 lines) and `CalendarPage.tsx` (~950 lines) are large; future refactors into smaller units would reduce cognitive load.
- `outcomeStore` has cross-store calls inside `logOutcomeWithProgression`; coupling makes unit-testing harder.
- `workoutInstanceId` parsing relies on nanoid never generating `_` — holds for the current base-36 charset but would silently break if the charset changes.

---

## Pass 47 — 2026-06-01 (branch `claude/dreamy-mccarthy-iQpbb`)

### Observations on entry

- Baseline on entry: **770 passing, 0 failing** — clean exit state from pass 46.
- Pass 46 fixed CalendarPage unstable sort, stale `now`, retroactive Day Off availability, and added outcome summary preview in DayDetailModal Level 1.
- Full codebase audit performed (fresh read of all key modules, stores, and tests).

### Key findings

**Documented limitation — `computeWorkoutTypeBreakdown` only attributes `slots[0]`** (`historyStats.ts:349`):
For rotation entries where a plan day has 2 slots (double workouts defined in the plan), only the first slot's `type` is counted in the workout-type breakdown stats. The second slot is silently unattributed. No test documents this behavior, so it could be mistaken for a bug.

**Documented design — `buildProgressionRecommendation` null-effort run/swim default** (`workout-outcomes/progression.ts:22`):
Run/swim progress check uses `outcome.perceivedEffort ?? 3`, defaulting to 3 when no effort is logged. This means: complete a run, log no effort → get a "progress" recommendation (3 ≤ 3 threshold). The high-effort regress check correctly uses `?? 0`. The asymmetry is intentional (conservative default promotes progress) but not documented via tests. Pass 40 added a swim null-effort test; no corresponding test existed for the "progress check default = 3" path directly.

**Test gap — `historyStore.updateEntryDate` caller contract** (`historyStore.ts:249`):
`updateEntryDate` mutates `calendarDate` in-place without deduplication. If a second entry already exists at the target date, both will coexist until `computeCurrentDayIndex` resolves the conflict via `createdAt`. Callers must call `removeEntry` first. Correct callers already do this (TodayPage, CalendarPage). No test documents the "what happens when target date already has an entry" behavior.

**New feature — `computeConsecutiveSkips`**:
No function exists to count consecutive skip entries for a plan. This is useful for a "you've been skipping workouts" nudge in TodayPage. The data is already available in `historyStore.entries`; only the aggregation function is missing. Adding to `historyStats.ts` as a pure utility keeps it testable and consistent with the existing stat API.

### Decisions

- **Test: `computeWorkoutTypeBreakdown` multi-slot** (DOCUMENTATION): Add a test documenting that only `slots[0]` type is attributed. No code change to the function.
- **Test: `buildProgressionRecommendation` null-effort progress path** (DOCUMENTATION): Add tests covering the `perceivedEffort: null` → defaults-to-3 → progress path for run and swim slots with `completedAsPlanned: undefined`. Documents the intentional design.
- **Test: `historyStore.updateEntryDate` coexistence scenario** (DOCUMENTATION): Add a test showing that updating to a date that already has an entry does not remove the existing entry — documents the caller contract.
- **Feature: `computeConsecutiveSkips`** (FEATURE, low risk): New pure function in `historyStats.ts`. Counts consecutive skip-only days (complete or day_off breaks the streak) going backwards from yesterday. Exported and covered by tests. Not yet wired into any UI.

### Not implemented (recommendations only)

- **UI integration of `computeConsecutiveSkips` into TodayPage**: Add a nudge after 3+ consecutive skips ("You've skipped your last N workouts — still want to build the habit?"). Deferred: UI changes require browser testing, out of scope for this run.
- **Fix `computeWorkoutTypeBreakdown` to attribute all slots**: Would require callers to pass all slot types (not just `slots[0]`) or restructure the `planDaysById` map. Change is medium-complexity and the current behavior is acceptable for a personal tracker. Documenting.
- **`logForDate` day_off + jump interaction** (carried from pass 44): Still open. Low occurrence probability; deferred.
- **`programVarsMap` subscription granularity** (carried from pass 44): Still open. Low impact.

### Architecture summary (unchanged from pass 46)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores: `planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`. Rotation logic is pure functions in `rotationEngine.ts`. Stats are pure utilities in `historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

### Key strengths (unchanged)

- Pure-function rotation engine with 770 tests on entry; all passing.
- Expression evaluator handles YAML progression DSL safely (no `eval()`).
- Strong migration patterns in historyStore (v1) and planStore (v2).
- Consistent separation of engine / stores / modules / lib / UI layers.

### Key risks (carried forward)

- `TodayPage.tsx` (~1,150 lines) and `CalendarPage.tsx` (~950 lines) are large; future refactors into smaller units would reduce cognitive load.
- `outcomeStore` has cross-store calls inside `logOutcomeWithProgression`; coupling makes unit-testing harder.
- `workoutInstanceId` parsing relies on nanoid never generating `_` — holds for the current base-36 charset but would silently break if the charset changes.

---

## Pass 46 — 2026-05-31 (branch `claude/dreamy-mccarthy-N2mc1`)

### Observations on entry

- Baseline on entry: **770 passing, 0 failing** — clean exit state from pass 45.
- Pass 45 fixed two TodayPage bugs (unstable sort key, stale today date) and added the `useToday` hook. No new issues introduced.
- Deep audit of CalendarPage revealed the same sort-key bug that pass 45 fixed in TodayPage was never ported, plus two other issues.

### Key findings

**Bug — `CalendarPage.findPreviousSetsByExercise` uses unstable sort key** (`CalendarPage.tsx:257`):
Identical to the `findPreviousWeightsOutcome`/`findPreviousSetsByExercise` bug fixed in TodayPage (commit 18adf1f). CalendarPage's version sorts with `(b.completedAt ?? '').localeCompare(a.completedAt ?? '')`, producing non-deterministic ordering for outcomes without `completedAt`. Previous sets shown in CalendarPage's OutcomeModal may display data from an arbitrary session instead of the most recent one.

**Bug — `CalendarPage` stale `now` past midnight** (`CalendarPage.tsx:50`):
`const now = new Date()` is captured at component mount and never updated. If the user keeps CalendarPage open past midnight, `goToToday()` and the `isCurrentMonth` check use the stale date. Pass 45 added `useToday()` specifically to fix this class of issue; CalendarPage was not updated at the same time.

**UX inconsistency — Day Off not available for past dates in Calendar** (`CalendarPage.tsx:566`):
`canDayOff = isToday || isFuture` excluded past dates. TodayPage's "catch-up" flow can call `markDaysAsOff` for unlogged past days (confirmed by the DayDetailModal catch-up dialog). The Calendar's retroactive Day Off was the one entry point that couldn't do this, creating an inconsistency: users logging a missed day retroactively could only pick Complete or Skip, not Day Off.

### Decisions

- **Fix CalendarPage unstable sort** (BUG, high confidence): Port `outcomeSortKey` from TodayPage. Also add `parseWorkoutInstanceId` import needed by the helper.
- **Fix CalendarPage stale `now`** (BUG, high confidence): Replace `const now = new Date()` with `useToday()`. Derive `nowYear`/`nowMonth` from the `YYYY-MM-DD` string to avoid Date object construction for display purposes.
- **Allow Day Off on past dates in Calendar** (UX FIX, low risk): Change `canDayOff` from `isToday || isFuture` to `isPast || isToday || isFuture`. Both Complete/Skip and Day Off are now available for past dates, consistent with TodayPage.
- **Feature: outcome summary preview in DayDetailModal Level 1** (FEATURE, low risk): For completed entries with rich outcomes, show perceived-effort dot indicators (● = 1, ●●●●● = 5) and a truncated italic notes line in the Level 1 overview. Users can scan workout quality at a glance without drilling into the OutcomeModal. Purely additive; no behavior change for workouts without outcome data.

### Not implemented (recommendations only)

- **Extract shared `outcomeSortKey` / `findPreviousSetsByExercise`** to a shared lib utility: The nearly-identical function exists in both TodayPage and CalendarPage. Extracting would reduce future drift but introduces cross-file coupling and is a medium-complexity change.
- **Timezone audit for `parseISO` + `format` in rotation engine**: Potential off-by-one date in UTC-5 to UTC-12 timezones. 127+ PR history without a reported instance suggests most active users are in UTC+. Needs testing in a UTC-5 environment before any change.
- **`logForDate` day_off + jump interaction** (carried from passes 44–45): When a retroactively-logged entry with a jump override is changed to day_off, the jump is removed without re-anchoring. Low occurrence probability; deferred.
- **`programVarsMap` subscription granularity** (carried from passes 44–45): Low impact.

### Architecture summary (unchanged from pass 45)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores: `planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`. Rotation logic is pure functions in `rotationEngine.ts`. Stats are pure utilities in `historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

### Key strengths (unchanged)

- Pure-function rotation engine with 770 tests across 19 files on entry.
- All store mutations are well-guarded and tested.
- Clean separation between engine, store, and UI layers.

### Key risks (carried forward)

- `TodayPage.tsx` (~1,150 lines) and `CalendarPage.tsx` (~520 lines post-trim) are large.
- `outcomeStore` has cross-store calls inside `logOutcomeWithProgression`. Not broken, but coupling makes unit-testing harder.
- `workoutInstanceId` parsing relies on nanoid never generating `_`.

---

## Pass 45 — 2026-05-30 (branch `claude/dreamy-mccarthy-mxssu`)

### Observations on entry

- Baseline on entry: **767 passing, 0 failing** — clean exit state from pass 44.
- Pass 44 fixed `moveByWorkoutInstance` calendarDate propagation, memoized `planExtras` in TodayPage, and added a "Xd ago" date hint to the last-session summary. No new issues introduced.
- Deep audit revealed two correctness bugs and one long-documented staleness risk.

### Key findings

**Bug — `findPreviousWeightsOutcome` and `findPreviousSetsByExercise` use unstable sort key** (`TodayPage.tsx`):
Both helpers compare outcomes using `completedAt ?? ''` as the sort key. When `completedAt` is absent (the typical state for outcomes recorded before `completedAt` became common), every comparison evaluates `'' > ''` (false). The max-scan in `findPreviousWeightsOutcome` returns whichever qualifying outcome happens to appear first in `Object.values()` iteration order — not the most recent. `findPreviousSetsByExercise` has the same issue in its `.sort()` call. For users who have recorded many sessions, the "previous session" hint and the pre-filled set weights in OutcomeModal may silently display data from an arbitrary past session.

**Correctness gap — `totalLogged`/`totalCompleted` include future-dated entries** (`historyStats.ts`):
`computeHistoryStats` computed `totalLogged` as `entries.length + extras.length` with no date filter. A CSV import with future-dated entries silently inflates both counters displayed on the History page. The rest of the function already guards against this: `last7Completed`/`last30Completed` use an `inWindow` predicate bounded by `<= today`, and `longestStreak` was fixed in pass 42. `totalLogged` and `totalCompleted` were the remaining gap.

**Staleness risk — `today` computed once at render in TodayPage** (`TodayPage.tsx`):
`const today = format(new Date(), 'yyyy-MM-dd')` is computed at render time and is not live. If the app stays open past midnight, the Today card, stats, and upcoming section show the previous day's date until the user navigates. Documented since pass 44; now fixed with a `useToday` hook.

### Decisions

- **Fix `findPreviousWeightsOutcome` / `findPreviousSetsByExercise` sort key** (BUG, high confidence) — Extract `outcomeSortKey()` that prefers `completedAt` when present and falls back to the date embedded in `workoutInstanceId`. `parseWorkoutInstanceId` is already imported in TodayPage. No tests added (functions are module-private and tested indirectly via OutcomeModal behavior). No behavior change for outcomes that have `completedAt`; correct ordering for those that don't.

- **Fix `totalLogged`/`totalCompleted` future-date filtering** (CORRECTNESS, high confidence) — Add `calendarDate <= today` filter before counting. Three regression tests cover future-dated rotation entries, future-dated extras, and the `totalCompleted`-only path. No observable change for users without future-dated entries.

- **Add `useToday` hook** (FEATURE, low risk) — New `src/hooks/useToday.ts` initialises from the current date, then schedules a timeout at the next midnight to advance the date and re-arm for subsequent midnights. TodayPage replaces `format(new Date(), ...)` with `useToday()`. No changes to other pages; `CalendarPage` and `HistoryPage` each call `format(new Date(), ...)` independently and can be updated in future passes.

### Not implemented (recommendations only)

- **`CalendarPage` and `HistoryPage` midnight staleness** — Both compute `today` inline and could use `useToday()`. Deferred to a future pass to keep changes reviewable one page at a time.
- **`computePlanStreak` future-date guard** — The backward-walk starts from `today`, so future-dated extras can never extend `currentStreak` (they're never `streakable.has(cursor)` during the backward scan). No bug; no change needed.
- **`isPlanExpired` rotations path counts future entries** — If a user imports future-dated `complete`/`skip` entries, the plan could appear expired. Edge case; documenting.
- **`programVarsMap` subscription granularity** — Still open from pass 44. Low impact.
- **`logForDate` day_off + jump** — Still open from pass 44.

### Architecture summary (unchanged from pass 44)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores: `planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`. Rotation logic is pure functions in `rotationEngine.ts`. Stats are pure utilities in `historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

### Key strengths (unchanged)

- Pure-function rotation engine with 770 tests across 19 files on exit.
- All store mutations are well-guarded and tested.
- Clean separation between engine, store, and UI layers.

### Key risks (carried forward)

- `TodayPage.tsx` (~1,130 lines) and `CalendarPage.tsx` (~950 lines) are large.
- `outcomeStore` has cross-store calls inside `logOutcomeWithProgression`. Not broken, but the coupling makes unit-testing harder.

---

## Pass 44 — 2026-05-30 (branch `claude/dreamy-mccarthy-uCF1X`)

### Observations on entry

- Baseline on entry: **766 passing, 0 failing** — clean exit state from pass 43.
- Pass 43 fixed 6 progression test failures and the `ExtraWorkoutEntry.source` migration. No new issues introduced.
- Deep audit revealed one real bug and one performance defect, both safe to fix.

### Key findings

**Bug — `moveByWorkoutInstance` silently drops `calendarDate` update** (`exerciseHistoryStore.ts`):
When a workout entry is moved to a new calendar date (e.g. via CalendarPage or TodayPage date backfill), `moveByWorkoutInstance` updated the `workoutInstanceId` on all `ExerciseSessionRecord` rows but left `calendarDate` unchanged. This caused PR date attribution (`maxLoadDate`, `maxRepsDate` in `computePersonalRecords`) to show the original date rather than the moved date. It also broke `getByExerciseName`'s chronological sort because that sort key is `calendarDate`. The fix is a two-line addition: parse the new instanceId to extract `calendarDate` and update it alongside the key.

**Performance defect — `planExtras` computed inline in TodayPage** (`TodayPage.tsx`):
`planExtras` was a plain `filter()` call placed after the early `!plan` guard, creating a new array reference on every TodayPage re-render (even when `extraEntries` didn't change). `WeeklyActivityStrip` declares `planExtras` as a `useMemo` dependency; a new reference on every parent render defeats that memo, causing the 7-day strip to recompute unnecessarily. Fixed by lifting `planExtras` into a `useMemo` placed before the early return.

**UX gap — "Last session" hint missing date context** (`TodayPage.tsx`):
The "Last: 3×8 @ 135 lb Bench Press" hint on the today card gave no indication of when the previous session occurred. A user resuming after a gap (injury, travel) or approaching a PR attempt benefits from knowing if their reference session was 3 days ago or 3 weeks ago. Fix: derive the calendarDate from the previous outcome's `workoutInstanceId` (already available) and append "· Xd ago" / "· yesterday" inline.

### Decisions

- **Fix `moveByWorkoutInstance`** (BUG, high confidence) — +1 test. No behavior change for normal flows; only affects users who have moved entries to a different date.
- **Fix `planExtras` memoization** (PERF, high confidence) — No behavior change; pure re-render optimization. Correct after the early return guard because the memo returns `[]` when `activePlanId` is null.
- **Add session date to last-session hint** (UX, low risk) — Purely additive; the display only appears when `prevSessionDaysAgo > 0`. Does not modify `sessionSummary.ts` or its public API; derives the date from the existing `workoutInstanceId`.

### Not implemented (recommendations only)

- **`programVarsMap` subscription granularity** — TodayPage and CalendarPage subscribe to the full `vars` object; changes to any plan's vars cause both pages to re-render even if the active plan's vars are unchanged. Requires a selector per plan or a store split. Low impact since vars only change when the user logs a workout with progression rules.
- **Midnight staleness** — `today` is computed once at render and is not live. If the app stays open past midnight without navigation, dates shown will be stale until the user navigates or refreshes. Mitigation: a `useEffect` that force-updates at midnight, or a periodic revalidation. Documented; not implemented.
- **`CalendarPage.logForDate` day_off + jump interaction** — When a user changes a retroactively-logged entry (that had a jump override) to day_off, the jump is removed without re-anchoring. This can silently shift the rotation pointer for subsequent days. Edge case; low occurrence probability; documenting rather than fixing to avoid unintended side effects.

### Architecture summary (unchanged from pass 43)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores: `planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`. Rotation logic is pure functions in `rotationEngine.ts`. Stats are pure utilities in `historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

### Key strengths (unchanged)

- Pure-function rotation engine with 240+ tests; highly reliable
- Zustand persist migrations (versions 1 and 2) protect existing user data
- Full-stack deduplication (history entries, extra entries, plan duplication naming) handles edge cases correctly
- DSL expression evaluator for progression rules — no `eval()`, fully tested
- Clear separation of concerns: engine / stores / hooks / pages

### Risks (unchanged)

- `TodayPage.tsx` (1100+ lines) and `CalendarPage.tsx` (920+ lines) are large; future refactors into smaller units would reduce cognitive load
- `outcomeStore` and `historyStore` have ad-hoc cross-store calls (`useHistoryStore.getState()` inside outcomeStore) that bypass React's subscription model for occasional reads — safe but unconventional

---

## Pass 43 — 2026-05-29 (branch `claude/dreamy-mccarthy-4tAQK`)

### Observations on entry

- Baseline on entry: **758 passing, 0 failing** — clean exit state from pass 42.
- **6 failing tests in `progression.test.ts`**: PR #121 (`workout-progression-logic`)
  merged since pass 42 added two intentional behavior changes to
  `buildWeightsRecommendation`:
  1. A new guard returns `null` when no exercise has `progressionMode` set.
  2. Volume mode now uses `allSetsHitTarget` instead of always returning `hold`.
  Six tests were written against the old behavior and were failing as a result.
  These are test-correctness issues, not production bugs.
- **`ExtraWorkoutEntry.source` pre-migration risk**: Extras created before the
  `source` field was introduced have `source === undefined`. TodayPage's Undo
  handler treats `undefined` as `'double_day'`, which would silently remove
  manually-added extras on Undo. Recommended across passes 38–42; never
  implemented.

### Decisions

- **Fix 6 failing tests** (CORRECTNESS): Update `progression.test.ts` to match the
  new behavior. Add `progressionMode: 'single'` to exercises in four single-mode tests.
  Fix the volume mode test: update description and split into `progress` (all sets hit
  target) and `hold` (below target). Add `progressionMode: 'single'` to the weightlifting
  legacy type test. Add a new null-path test documenting the `progressionMode` guard.
  Net: 6 fixed + 2 new tests = 760.
- **Fix `ExtraWorkoutEntry.source` migration** (BUG): Add `version: 1` and a
  `migrate` function to `historyStore`'s persist config. Migration sets
  `source: 'history'` on all extras with `source === undefined` (v0 → v1). Extract as
  a named export `migrateHistoryState` so it can be unit-tested directly. 6 new tests.

### Risks

- Test fixes: zero risk — no production code changes.
- `source` migration: very low risk. The migration only touches `extraEntries` and
  only changes `undefined` → `'history'`. Existing extras with explicit source values
  are unchanged. Adding `version: 1` causes Zustand to re-run the migration for all
  existing users on first load — this is safe because the migration is idempotent and
  the persist key (`wpt_history`) is unchanged.

### Architecture summary (unchanged from pass 42)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores:
`planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`.
Rotation logic is a pure function in `rotationEngine.ts`. Stats are pure utilities in
`historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

### Key strengths (unchanged)

- Pure-function engine with 766 tests across 19 files on exit.
- All store mutations are well-guarded and tested.
- Clean separation between engine, store, and UI layers.

### Key risks (carried forward)

- `TodayPage.tsx` (~1,115 lines) and `CalendarPage.tsx` (~950 lines) are large.
- `workoutInstanceId` parsing relies on `nanoid` never generating `_` — holds for
  the custom charset in `lib/utils.ts` but would silently break if the charset changes.
- `outcomeStore` has cross-store calls inside `logOutcomeWithProgression`. Not broken,
  but the coupling makes unit-testing harder.

---

## Pass 42 — 2026-05-28 (branch `claude/dreamy-mccarthy-HtWcw`)

### Observations on entry

- Baseline: **748 passing, 0 failing** — clean baseline from pass 41 + user feedback merge.
- Pass 41 closed the ErrorBoundary and empty-date-save gaps. User feedback commit added swipe
  delete, start delay, timer drift fixes, rest timer +/-15 adjustment, and inline progression
  preview to `ActiveWorkoutTracker`.

**New issues found in user-feedback commit:**

1. **`deleteSet` stale active set timer**: Deleting a set while it was the active timer left
   `activeSetRef` and `activeSetTimer` pointing at a now-invalid index. The per-second interval
   would attempt to increment the deleted set's `setElapsedSeconds`, which may point to a
   different set after deletion (indices shift). Also, the active-set ref was never cleared when
   deleting a higher-indexed set that was after the active one (no index shift, but the UI could
   still show a stale timer state).

2. **Working set numbers included warmup indices**: With warmup sets at indices 0–N,
   working sets were labeled N+1, N+2, … instead of 1, 2, 3. This was a display bug in the
   set-number column that showed "3", "4", "5" for what should be "1", "2", "3".

3. **`getProgressionPreview` opaque labels**: "weights[1]: +5lb" doesn't tell the user what
   load the set is moving from or to. "135 → 140 lb" is far more informative.

**Pre-existing issues (not from the feedback commit):**

4. **`longestStreak` included future-dated entries**: `computeHistoryStats` built the streakable
   set from all entries without filtering to `<= today`. A CSV import with future dates would
   silently inflate the longest streak stat.

5. **`duplicatePlan` name accumulation**: Successive duplications produced "Plan (copy) (copy)
   (copy)". The fix strips any existing copy suffix and uses a numeric counter for collisions.

6. **`isoWeekStart` not directly tested**: The function was only exercised through
   `computeWeeklyBreakdown`. Direct cases (Monday, Sunday boundary, year boundary) were untested.

### Decisions

- **Fix `deleteSet` stale timer** (BUG): After filtering the sets array, also clear
  `activeSetRef` and `activeSetTimer` when the deleted set was active or had an index ≤ the
  active one. Risk: zero — purely protective.
- **Fix working set numbers** (CORRECTNESS): Compute `workingSetNumber` as the count of
  non-warmup sets up to and including `setIdx`, so warmup-present exercises show 1/2/3 not
  3/4/5 for working sets.
- **Improve `getProgressionPreview`** (UX): Replace "weights[N]: +Xlb" with "Set N: A → B lb"
  or collapse to "All sets: A → B lb" when all transitions are the same.
- **Fix `longestStreak`** (CORRECTNESS): Filter `sortedDates` to `<= today` before the
  longest-streak walk. One regression test added.
- **Fix `duplicatePlan` naming** (UX): Strip existing copy suffix, use numeric counter for
  collisions. Three new tests cover the new behavior.
- **Add `isoWeekStart` direct tests** (TEST): Six tests covering Monday, Wednesday, Saturday,
  Sunday, month boundary, and year boundary.

### Risks

- `deleteSet` fix: zero risk — only adds a guard on an already-broken path.
- Working set numbers: purely cosmetic; no data change.
- Progression preview: purely cosmetic display change.
- `longestStreak` filter: change in stat value only for users with future-dated entries (edge case).
- `duplicatePlan` naming: users with "(copy)" plans will see different copy names going forward.

---

## Pass 41 — 2026-05-27 (branch `claude/dreamy-mccarthy-9NxZ6`)

### Observations on entry

- Baseline: **748 passing, 0 failing** — clean baseline from pass 40.
- **No React Error Boundary exists in the component tree**: Any uncaught render or
  hook error causes the full UI to go blank (React 18 unmounts the tree). This has
  been a recurring recommendation across passes 36–40 but was never implemented.
- **`HistoryPage.saveAndClose` does not validate empty date**: When the user clears
  the date input and clicks Save, `editingEntryDate` is `''`. The empty string passes
  the conflict check (`'' !== oldDate` is true, but no existing entry has
  `calendarDate === ''`), so `updateEntryDate(id, '')` is called — corrupting the
  entry's `calendarDate` to `''`. Subsequent renders or lookups that use
  `calendarDate` as a key silently fail. Same structural gap in `saveAndCloseExtra`.
- **`computeCurrentDayIndex` targetDate < startDate has a test**: Test at line 203 of
  rotationEngine.test.ts was added in a prior pass — this item is already covered.

### Decisions

- **Add ErrorBoundary component** (IMPROVEMENT): Create
  `src/components/shared/ErrorBoundary.tsx` as a class component wrapping the full
  `<Routes>` tree in `App.tsx`. Renders a recovery UI with a "Try again" button that
  resets state. No behavior change on the happy path; prevents blank-screen crashes on
  errors. Risk: zero — purely additive.
- **Fix empty date guard in saveAndClose** (BUG): Add `if (!newDate) return` (with
  `setDateConflict(true)`) before the conflict check in `saveAndClose`. Mirror the
  same guard in `saveAndCloseExtra`. The error message shown when `dateConflict` is
  true now distinguishes empty vs. conflict. Risk: near-zero — only adds an early-exit
  guard before logic that was already unreachable safely.

### Risks

- ErrorBoundary: zero risk on happy path. Slight visual change on crash path (recovery
  UI instead of blank screen).
- Empty date guard: no behavior change for valid dates. Only affects the edge case
  where the user explicitly clears the date input before clicking Save.

## Pass 40 — 2026-05-26 (branch `claude/dreamy-mccarthy-8Sa0s`)

### Observations on entry

- Baseline: **743 passing, 0 failing** — clean baseline inherited from pass 39.
- **`planStore.setActivePlan` missing guard for non-existent ID**: If called with a plan ID
  not present in `state.plans`, the function would iterate all existing plans deactivating
  them, then write `updated[id] = { ...undefined, status: 'active', ... }` — spreading
  undefined produces an empty-ish object missing all required Plan fields. `activePlanId`
  would also be set to the invalid ID. This is a silent data corruption path reachable from
  any UI component that passes an unvalidated ID.
- **`buildProgressionRecommendation` null effort swim test missing**: Pass 39 had a run test
  for null `perceivedEffort` defaulting to 3 (progress threshold), but no symmetric swim test.
  The swim branch uses the identical `?? 3` pattern and was untested for this path.
- **History CSV export silently drops swim actuals**: `historyToCsv` only wrote run actuals
  (`actualDistanceMiles`, `actualDurationMin`, `averagePaceSecondsPerMile`, `averageHeartRate`,
  `completedAsPlanned`) to the CSV. The four swim fields (`actualDistanceMeters`,
  `actualDurationMin`, `averagePaceSecondsPer100m`, `completedAsPlanned`) were never exported.
  Users who swim and export/import CSV lose all swim actual data. The import parser also had
  no path to reconstruct `swimActual` from a row.

### Decisions

- **Fix `setActivePlan` guard** (BUG): Add `if (!(id in s.plans)) return s` at the top of
  the setter. No observable change for valid IDs. Prevents state corruption for invalid IDs.
  Risk: zero — strictly a guard on the existing code path.
- **Add swim null effort test** (TEST): One new test for the swim slot: `perceivedEffort: null`
  should resolve to `progress`. Mirrors the existing run test. No code change.
- **Add swim actuals to CSV** (FEATURE): Append four new columns to `HISTORY_HEADERS` after
  the existing run columns. Update both the rotation and extra row builders in `historyToCsv`.
  Update `buildOutcomeFromRow` to parse these columns into `swimActual`. Old CSVs without
  these columns parse as undefined → `swimActual` stays unset (backward compatible).

### Files changed

| File | Change type | Description |
|------|-------------|-------------|
| `src/store/planStore.ts` | fix | Guard `setActivePlan` against non-existent plan ID |
| `src/store/__tests__/planStore.test.ts` | test | Verify guard with `'nonexistent-id'` |
| `src/modules/workout-outcomes/__tests__/progression.test.ts` | test | Swim null effort → progress |
| `src/lib/csv.ts` | feat | Export + import swim actuals in history CSV |
| `src/lib/__tests__/csv.test.ts` | test | Swim actuals round-trip (rotation, extra, empty) |

---

## Pass 39 — 2026-05-25 (branch `claude/dreamy-mccarthy-0z9MJ`)

### Observations on entry

- Baseline: **738 passing, 0 failing** — clean baseline inherited from pass 38.
- **`nanoid` import coupling still present in `csv.ts` and `PlanBuilderPage.tsx`**: Pass 37
  fixed this in `exerciseHistoryStore.ts`, but two more files still imported `nanoid` via the
  rotationEngine re-export instead of directly from `lib/utils`. This is a coupling issue:
  a change to rotationEngine's public API could silently break these utilities.
- **`buildLastSessionSummary` "×undefined" display bug**: When a weights set has `actualReps = null`
  and no `targetReps` value (i.e., `targetReps` is `undefined`), the old ternary
  (`s.actualReps != null ? s.actualReps : s.targetReps`) passed `undefined` directly into the
  template string, producing "Last: 2×undefined @ 135 lb Squat". This surface-level display
  bug would appear for sets with load recorded but no rep count — a real data pattern when
  users log load-only (e.g. timed holds, isometric exercises).
- **No multi-exercise context in session hint**: `buildLastSessionSummary` only shows the first
  exercise from a multi-exercise workout. For programs with 3-6 lifts per session, the user only
  sees e.g. "Last: 3×5 @ 185 lb Squat" with no indication that Bench Press, Deadlift, and rows
  were also logged. Adding "+N more" provides context without changing the single-exercise case.

### Decisions

- **Fix `nanoid` import path in `csv.ts` and `PlanBuilderPage.tsx`** (COUPLING): Change both
  from `'../engine/rotationEngine'` to the canonical source. No behavior change — rotationEngine
  re-exports the same function.
- **Fix `buildLastSessionSummary` "×undefined"** (BUG): Replace the `!= null` ternary with
  nullish coalescing (`s.actualReps ?? s.targetReps ?? null`); when null, fall back to display
  format "N sets" rather than "N×undefined". New tests verify the null and fallback cases.
- **Add "+N more" multi-exercise context** (FEATURE): When more than one exercise in a workout
  has actual data logged, append "(+N more)" to the hint line. Only exercises with at least one
  actual reps or load value are counted, so placeholder/unlogged exercises are excluded.
  Single-exercise workouts are unchanged. New tests verify count, exclusion, and single-ex case.

### Architecture summary (unchanged from pass 38)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores:
`planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`.
Rotation logic is a pure function in `rotationEngine.ts`. Stats are pure utilities in
`historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

---

## Pass 38 — 2026-05-24 (branch `claude/dreamy-mccarthy-oaS1e`)

### Observations on entry

- Baseline: **734 passing, 0 failing** — clean baseline inherited from pass 37.
- **`deferred` completion state fired YAML progression rules**: `logOutcomeWithProgression`
  computes `session_complete` as `!== 'skipped' && !== 'planned'`. The `deferred` state
  maps to `day_off` in the history engine (no workout performed), but was not excluded from
  `session_complete`, so YAML progression rules with `if: 'session_complete'` would fire when
  a workout was deferred. This is a silent data corruption issue: variable increments (e.g.
  load progression) would apply incorrectly on defer rather than only on completion.
- **`RunSegment.drills` still shallow-cloned after pass 37**: Pass 37's REVIEW_NOTES
  documented `drills` within `RunSegment` as a remaining recommendation. Pass 37's fix
  addressed `SetSpec[]` inside `ExerciseSpec.sets`; the `DrillSpec[]` in `RunSegment.drills`
  was still only spread-cloned at the segment level, meaning drill objects were shared between
  the original and duplicated plan.
- **`nanoid` import path in `exerciseHistoryStore`**: The store imported `nanoid` from
  `../engine/rotationEngine` (which re-exports it from `lib/utils`). The import should come
  directly from `lib/utils` to reduce transitive coupling.
- **`progressionRecommendation.note` not surfaced before starting workout**: Outcome records
  carry a `progressionRecommendation.note` field (e.g., "add 2.5 lb next session") from the
  previous session. TodayPage already shows `lastSessionSummary` and `prevSessionOutcome.notes`
  for pending workouts, but the structured progression guidance was not surfaced at decision time.

### Decisions

- **Fix `deferred` in `session_complete`** (BUG): Add `outcome.completionState !== 'deferred'`
  to the `session_complete` guard in `logOutcomeWithProgression`. Three new tests confirm
  the behavior for deferred (no rule fire), completed (rule fires), and skipped (no rule fire).
- **Fix `RunSegment.drills` shallow clone** (DATA INTEGRITY): Extend `deepCloneWorkoutSlot`
  to map `s.drills` inside each segment mapper. Guard matches the existing patterns for
  `warmup`/`exercises`. One new test confirms drill object isolation after `duplicatePlan`.
- **Fix `nanoid` import path** (COUPLING): Change import source from `../engine/rotationEngine`
  to `../lib/utils` in `exerciseHistoryStore.ts`.
- **Fix misleading comment in `workoutInstanceId.ts`** (DOCS): Update the comment to reflect
  that the custom nanoid uses base-36 (no underscores) — the old comment incorrectly described
  nanoid's default alphabet.
- **Surface `progressionRecommendation.note` on TodayPage** (FEATURE): Add a `↗ [note]` line
  to the previous-session hint block for non-run slots. Guard: `!todayRunSlot` prevents
  double-surfacing run progression (which already has `todayAdaptationNote`). Visible only
  when `prevSessionOutcome?.progressionRecommendation?.note` is truthy.

### Architecture summary (unchanged from pass 37)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores:
`planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`.
Rotation logic is a pure function in `rotationEngine.ts`. Stats are pure utilities in
`historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

### Key strengths (unchanged)

- Pure-function engine with 738 tests across 19 files on exit.
- All store mutations are well-guarded and tested.
- Clean separation between engine, store, and UI layers.

### Key risks (carried forward)

- `TodayPage.tsx` (~1,115 lines) and `CalendarPage.tsx` (~950 lines) are large.
- `workoutInstanceId` parsing relies on `nanoid` never generating `_` — holds for
  the custom charset in `lib/utils.ts` but would silently break if the charset changes.
- `outcomeStore` has cross-store calls inside `logOutcomeWithProgression`. Not broken,
  but the coupling makes unit-testing the outcome store harder (requires mock setup for
  `useProgramStore`).

---

## Pass 37 — 2026-05-23 (branch `claude/dreamy-mccarthy-79X8Y`)

### Observations on entry

- Baseline: **732 passing, 0 failing** — clean baseline inherited from pass 36.
- **`deepCloneWorkoutSlot` shallow-clones `SetSpec[]` within `ExerciseSpec`**: When
  `exercises` (or `warmup`) contains a `SetSpec[]` for the `sets` field (vs. a plain
  integer), duplicating a plan produces exercise specs whose `sets` arrays are shared
  between the original and the copy. Mutating sets on one plan would silently affect
  the other. Pass 34 fixed the top-level `exercises` / `warmup` / `segments` array
  references but missed the one additional level of nesting inside each `ExerciseSpec`.
- **`WeeklyActivityStrip` uses `.find()` for entries**: The activity strip dot coloring
  relies on `planEntries.find(e => e.calendarDate === date)`. If multiple entries exist
  for a date (possible via bulk import or edge cases in the store), `find()` returns
  whichever entry appears first in the array—not necessarily the most recent one. All
  other places in the engine (computeCurrentDayIndex, getTodayResolvedDay) correctly
  prefer the newest `createdAt`. The strip was the only outlier.
- **`duration.value = 0` creates plans that expire immediately**: Plan Builder's UI
  input has an `|| 1` guard on `onChange`, but the YAML editor path bypasses it.
  Setting `value: 0` in YAML then applying produces a plan where `isPlanExpired()`
  returns true on the start date (weeks-type) or immediately (rotations-type). The
  Save buttons had no guard against this.
- **`computePlanStreak` never displayed**: Added in pass 25, this function computes
  the plan-scoped streak with correct semantics (filters by planId internally).
  TodayPage was computing an equivalent value via `computeHistoryStats` on pre-filtered
  arrays, but using `computePlanStreak` is more explicit about the intent.

### Decisions

- **Fix `deepCloneWorkoutSlot` for `SetSpec[]`** (BEHAVIOURAL BUG): Extract a
  `deepCloneExerciseSpec` helper that spreads the exercise spec and also maps its
  `sets` array when it is an array (not a plain number). Both `exercises` and `warmup`
  arrays now use this helper. Two new tests confirm per-set cloning.
- **Fix `WeeklyActivityStrip` dedup** (CORRECTNESS): Replace `find()` with the same
  newest-createdAt pattern used by the engine. Change is 4 lines; no logic elsewhere
  is affected.
- **Block saving `duration.value < 1`** (UX): Add inline error text and disable both
  Save buttons when `durationValue < 1`. The existing `handleSave` guard already
  checks `!name.trim()`; the new check is adjacent and follows the same pattern.
- **Wire `computePlanStreak` into streak stat** (SEMANTICS): Replace the
  `stats.currentStreak` reference in the streak stats card with `planStreak`, making
  the code intention explicit. Displayed value is identical since `planEntries` is
  pre-filtered, but future code that widens the entry set would behave correctly.

### Architecture summary (unchanged from pass 36)

React + TypeScript + Zustand + Vite PWA. Core state in five persisted Zustand stores:
`planStore`, `historyStore`, `outcomeStore`, `exerciseHistoryStore`, `programStore`.
Rotation logic is a pure function in `rotationEngine.ts`. Stats are pure utilities in
`historyStats.ts`, `sessionSummary.ts`, and `historyScope.ts`.

### Key strengths (unchanged)

- Pure-function engine with 734 tests across 19 files on exit.
- All store mutations are well-guarded and tested.
- Clean separation between engine, store, and UI layers.

### Key risks (carried forward)

- `TodayPage.tsx` (~1,110 lines) and `CalendarPage.tsx` (~950 lines) are large.
- `workoutInstanceId` parsing relies on `nanoid` never generating `_` — holds for
  the custom charset in `lib/utils.ts` but would silently break if the charset changes.
- `outcomeStore` has cross-store calls inside `logOutcomeWithProgression`. Not broken,
  but the coupling makes unit-testing the outcome store harder.

---

## Pass 36 — 2026-05-22 (branch `claude/dreamy-mccarthy-9sH8T`)

### Observations on entry

- Baseline: **726 passing, 0 failing** — clean baseline inherited from pass 35.
- **`importOutcomes` dropped exercise history context**: After CSV import, exercise
  records in `exerciseHistoryStore` had `planName: null` and `workoutName: null`.
  Not a crash, but affects any UI that tries to filter or display records by name.
- **"Mark N as Day Off" had no confirmation**: A single accidental tap would batch-mark
  up to 7 past days without warning.
- No behavioral bugs in core logic.

### Decisions

- **Fix `importOutcomes` context** (DATA QUALITY): Route through `syncExerciseHistory`
  which already resolves plan/workout name from live store state.
- **Catchup confirmation modal** (UX): Add a confirmation step before bulk-marking.

---

## Pass 35 — 2026-05-21 (branch `claude/dreamy-mccarthy-w8aCb`)

### Observations on entry

- Baseline: **718 passing, 0 failing** — clean baseline inherited from pass 34.
- **Session count shown on upcoming cards**: The session-count hint was displayed
  on today's card only, not upcoming cards.
- **`markDaysAsOff` used multiple `set()` calls**: Each date called `addEntry()`
  individually, triggering N Zustand updates for N days.

### Decisions

- **Session count on upcoming cards** (UX): Pass `sessionCount` to upcoming `WorkoutDayCard`.
- **Batch `markDaysAsOff` into one `set()` call** (PERFORMANCE).
- **Robust `workoutInstanceId` parsing** (BUG FIX): Handle planIds that contain
  underscores by anchoring the date regex properly.

---

## Pass 34 — 2026-05-20 (branch `claude/dreamy-mccarthy-zGJFa`)

### Observations on entry

- Baseline: **708 passing, 0 failing** — clean baseline inherited from pass 33.
- **Shallow-clone bug in `deepCloneWorkoutSlot`** (top-level arrays only).
- **Gap weeks not visible in Weekly Activity panel**.

### Decisions

- **Fix `deepCloneWorkoutSlot`** for top-level `exercises`, `warmup`, `segments` arrays.
- **Feature: `padWeekGaps`** — fills ISO-week holes with zero-count placeholder rows.
