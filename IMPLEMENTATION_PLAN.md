# Implementation Plan

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
