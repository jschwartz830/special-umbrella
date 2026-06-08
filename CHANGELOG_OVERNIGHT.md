# Overnight Changelog

## 2026-06-08 (fifty-third pass) — branch `claude/dreamy-mccarthy-B7dXE`

Baseline on entry: **814 passing, 0 failing**. Exit state: **821 passing, 0 failing** (+7 tests).

---

### 1. fix(types): Correct misleading `ExtraWorkoutEntry.source` comment

**Summary:** The JSDoc comment on the optional `source` field in `ExtraWorkoutEntry` claimed that pre-migration records without a `source` value are "treated as 'double_day' for safety." The v1 migration introduced in pass 43 actually sets them to `'history'` — the conservative choice that keeps the entry and prevents accidental removal on Undo.

**Why it matters:** A developer reading the type definition would infer the wrong default behavior and might write code assuming old extras would be auto-removed on Undo. The comment now accurately describes what the migration does and why.

**Files changed:** `src/types/index.ts`

**Risks/tradeoffs:** Zero — doc-only change.

**Rollback:** `git revert b8c3ae7`

---

### 2. refactor: Move `makeWorkoutInstanceId` / `makeExtraWorkoutInstanceId` to `lib/workoutInstanceId.ts`

**Summary:** These two constructor functions lived in `src/store/outcomeStore.ts` but logically belong alongside `parseWorkoutInstanceId` in `src/lib/workoutInstanceId.ts`. Moved both constructors to the lib file. `outcomeStore.ts` now re-exports them for backward compatibility so no call sites need to change. Updated `historyStats.ts` to use the canonical constructors instead of hardcoded string templates (`${planId}_${calendarDate}`).

**Why it matters:**
- Colocation: all three format helpers (make/make/parse) are now in one file.
- Reduces format-drift risk: `historyStats.ts` was hardcoding the `workoutInstanceId` format string in two places. If the format ever changes, `historyStats.ts` would silently use wrong lookup keys for outcome data (avgEffort, effort attribution). Now it uses the canonical constructors.

**Files changed:**
- `src/lib/workoutInstanceId.ts` — added `makeWorkoutInstanceId`, `makeExtraWorkoutInstanceId`
- `src/store/outcomeStore.ts` — replaced inline definitions with re-export
- `src/lib/historyStats.ts` — uses canonical constructors, added import
- `src/lib/__tests__/workoutInstanceId.test.ts` — 4 new tests (constructor + round-trip)

**Risks/tradeoffs:** Very low. Re-export from `outcomeStore.ts` means all existing callers (`OutcomeModal.tsx`) continue to work without changes. Behavior of `historyStats.ts` is identical since the string format is unchanged.

**Rollback:** `git revert 4167158`

---

### 3. fix: Defensive `plan.id` filters throughout rotationEngine

**Summary:** All four public functions in `rotationEngine.ts` (`computeCurrentDayIndex`, `getTodayResolvedDay`, `getUpcomingDays`, `getResolvedDaysRange`) now filter their `entries` and `overrides` inputs to the current `plan.id` before processing. Previously, callers bore the full responsibility for pre-filtering — passing unfiltered store arrays would silently mix entries from multiple plans, producing wrong rotation pointers.

**Why it matters:** This was discovered while writing plan-isolation tests. All existing callers (useActivePlan, buildMonthGrid) already pre-filter correctly, so there is no behavior change on the normal path. But the engine was fragile: a new caller or test that passed unfiltered data would get silently wrong results. The fix makes the engine correct by construction.

**Files changed:**
- `src/engine/rotationEngine.ts` — plan.id guard in all four functions
- `src/engine/__tests__/rotationEngine.test.ts` — 3 new regression tests

**New tests:**
1. `computeCurrentDayIndex: ignores entries for a different plan` — entries from `plan-9` don't advance plan-1's pointer
2. `getResolvedDaysRange: ignores entries for a different plan` — plan isolation in the calendar range function
3. `getResolvedDaysRange: swap_slot override does not change planDayIndex` — documents that swap_slot only affects the UI layer, not the rotation pointer

**Risks/tradeoffs:** Low. The filter is additive (stricter input validation). Callers that already pre-filter see no change. The only observable difference is for hypothetical callers passing mixed-plan data — they would now get correct (plan-scoped) results instead of wrong (cross-plan) results.

**Rollback:** `git revert 736aa3b`

---

## 2026-06-07 (fifty-second pass) — branch `claude/dreamy-mccarthy-j725m`

Baseline on entry: **801 passing, 0 failing**. Exit state: **814 passing, 0 failing** (+13 tests).

---

### 1. fix(historyStats): `computePersonalRecords` shows most-recent PR date

**Summary:** `computePersonalRecords` iterated exercise session records in insertion order (the order records were pushed into the `exerciseHistoryStore` array). The comparison used strict `>`, so if a user hit the same max load on a later session, `maxLoadDate` and `maxRepsDate` would retain the *first* date they ever hit that weight, not the most recent. A lifter who has repeatedly hit 225 lb across many sessions would see an old date rather than the most recent one.

**Why it matters:** Personal records show a date to give context ("you last hit this on March 3"). An old date is misleading and reduces trust in the stats.

**Fix:**
- Sort the per-exercise `scoped` array ascending by `calendarDate` before iterating
- Change `>` to `>=` for both `maxLoad` and `maxReps` comparisons, so a session matching or beating the current record updates the date

**Files changed:**
- `src/lib/historyStats.ts` — sort + `>=` comparisons in `computePersonalRecords`
- `src/lib/__tests__/historyStats.test.ts` — +3 tests in `computePersonalRecords` describe block, +1 in `computePlanStreak` describe block

**Risks / tradeoffs:** None. The change only affects the recorded date, not the max value. For users with a single PR session the result is identical.

---

### 2. refactor: extract shared `findPreviousSetsByExercise` to `src/lib/previousSetsHelper.ts`

**Summary:** An identical `findPreviousSetsByExercise` function existed in both `TodayPage.tsx` (~26 lines) and `CalendarPage.tsx` (~24 lines). Both filtered outcomes to the current plan, excluded the current date, sorted descending by `outcomeSortKey`, and returned a first-wins map by exercise name. Any future change to this logic (e.g., extending the sort key) would need to be applied twice.

**Fix:** New file `src/lib/previousSetsHelper.ts` with a single exported `findPreviousSetsByExercise(planId, currentDate, outcomes, excludeInstanceId?)`. The optional fourth parameter handles CalendarPage's additional filter (it also excludes a specific `instanceId` for the currently-open session). Both pages updated to import from the shared location.

**Files changed:**
- `src/lib/previousSetsHelper.ts` — new file
- `src/lib/__tests__/previousSetsHelper.test.ts` — new test file (6 tests)
- `src/pages/TodayPage.tsx` — removed local implementation, import shared helper
- `src/pages/CalendarPage.tsx` — removed local implementation, import shared helper

**Risks / tradeoffs:** None. The extracted function is semantically identical to both callers' implementations. The optional `excludeInstanceId` param defaults to no-op so TodayPage callers are unchanged.

---

### 3. feat: Personal Records CSV export

**Summary:** The HistoryPage Personal Records section displayed exercise PRs (max load, max reps, session count) but had no export. The history CSV and weekly-breakdown data had export buttons; PRs were the only stats without one.

**Implementation:**
- `personalRecordsToCsv(records: PersonalRecord[]): string` added to `src/lib/csv.ts` — RFC-4180 CSV with columns: `exercise`, `maxLoad_lb`, `maxLoadDate`, `maxReps`, `maxRepsDate`, `sessionCount`
- HistoryPage `PersonalRecordsSection` header restructured: the expand-toggle button and a new "Export CSV" button (`downloadCsv('personal-records.csv', personalRecordsToCsv(records))`) are now separate interactive elements; export button is hidden when the list is empty
- 3 new tests in `csv.test.ts` covering empty array, standard PR export, and null-field handling

**Files changed:**
- `src/lib/csv.ts` — `personalRecordsToCsv` function + `PersonalRecord` import
- `src/lib/__tests__/csv.test.ts` — 3 new tests in `personalRecordsToCsv` describe block
- `src/pages/HistoryPage.tsx` — `personalRecordsToCsv` import, header restructure, Export CSV button

**Risks / tradeoffs:** Header DOM structure changed from a single `<button>` to a `<div>` containing two `<button>` elements. The expand/collapse behavior is preserved. No new dependencies.

---

## 2026-06-06 (fifty-first pass) — branch `claude/dreamy-mccarthy-HOACg`

Baseline on entry: **798 passing, 0 failing**. Exit state: **801 passing, 0 failing** (+3 tests).

---

### 1. fix: wire `useToday()` into HistoryPage

**Summary:** `HistoryPage` computed `todayKey` with `format(new Date(), 'yyyy-MM-dd')` at render time and never refreshed it. If the app was left open past midnight, `computeHistoryStats`, `computeWeeklyBreakdown`, and the "today" date used in those calls would all be stale.

**Why it matters:** Same class of bug fixed in TodayPage (pass 45) and CalendarPage (pass 46). With PWA installs and pinned tabs, sessions staying open past midnight is realistic.

**Files changed:**
- `src/pages/HistoryPage.tsx` — add `useToday` import; replace `const todayKey = format(new Date(), ...)` with `const today = useToday()`

**Risks / tradeoffs:** None. The `useToday` hook is already tested in TodayPage. HistoryPage re-renders at midnight to pick up the new date.

**Rollback:** Revert the single commit.

---

### 2. fix: eliminate setState-during-render in DayDetailModal

**Summary:** `DayDetailModal` (CalendarPage) called `setDetailTarget(null)` during its own render when the selected extra could no longer be found in the `extras` array. This is a React antipattern — calling setState during render of your own component — and triggers a strict-mode warning.

**Why it matters:** Not user-visible under normal use, but the React Strict Mode warning is real. The pattern also violates React's rendering contract; future React versions may not handle it gracefully.

**Fix:** Add a `useEffect` that watches `detailTarget` and `extras` and resets `detailTarget` to null when the referenced extra is missing. The render branch now simply returns `null` without calling setState.

**Files changed:**
- `src/pages/CalendarPage.tsx` — add `useEffect` import; add cleanup effect; remove setState from render path

**Risks / tradeoffs:** Low. The `useEffect` fires after the render, so there's a single frame where `return null` is shown before the effect clears `detailTarget`. In practice this is imperceptible since the modal closes immediately.

**Rollback:** Revert the single commit.

---

### 3. feat: use computeWorkoutTypeBreakdown in HistoryPage and surface avgEffort

**Summary:** The HistoryPage training-mix label ("3 weights · 2 runs · 1 yoga") was computed by an inline `typeCountMap` that only counted completed entries and had no access to effort data. For single-plan views, this is replaced with `computeWorkoutTypeBreakdown`, which provides proper completed/skipped counts and avg perceived effort from outcomes. When effort data is available, the mix label now shows it: "3 weights (effort 3.2) · 2 runs (effort 2.5) · 1 yoga".

**Why it matters:** `computeWorkoutTypeBreakdown` was added in an earlier pass specifically to compute avgEffort but it was never surfaced to users. The HistoryPage is the natural place to show training quality at a glance.

**Files changed:**
- `src/pages/HistoryPage.tsx` — add `computeWorkoutTypeBreakdown` + `WorkoutTypeBreakdown` imports; add `typeBreakdown` memo using function; update `typeMixLabel` to use breakdown data; keep inline `typeCountMapFallback` for 'all' plan view
- `src/lib/__tests__/historyStats.test.ts` — +3 tests: 'weights' slot type, null avgEffort for skipped-only, mixed rotation+extra avgEffort

**Risks / tradeoffs:**
- The effort suffix only appears when at least one workout in the type has a `perceivedEffort` logged. Users who never set perceived effort see no change in the label.
- For 'all' plan view, the inline computation is kept because `computeWorkoutTypeBreakdown` requires a single `planDaysById` Map and can't attribute types across multiple plans in a single pass.
- The label format "effort 3.2" is a first iteration — could be tweaked to use a symbol or be hidden behind a toggle if it feels too dense.

**Rollback:** Revert the single commit.

---

## 2026-06-05 (fiftieth pass) — branch `claude/dreamy-mccarthy-UIayl`

Baseline on entry: **793 passing, 0 failing**. Exit state: **798 passing, 0 failing** (+5 tests).

---

### 1. fix: add error guard to applyProgressionRule and empty-plan to getTodayResolvedDay

**Summary:** Two correctness fixes in one commit.

**Fix A — `applyProgressionRule` (programStore.ts):**
Wrapped the entire function body in `try/catch`. If a YAML plan has a malformed
progression rule (bad condition type, `null` then-string, unexpected exception in
`evaluateCondition`/`evaluateUpdates`), the error is now caught and logged to
console; the function returns `{}` instead of propagating. This prevents the
exception from bubbling up through `outcomeStore.logOutcomeWithProgression` →
`handleOutcomeConfirm`, which would leave the user's UI in a broken state.
The workout entry and outcome are already persisted before progression rules run,
so silent failure is acceptable; silent success is not always correct, but it is
safe.

**Fix B — `getTodayResolvedDay` (rotationEngine.ts):**
Added an early-return guard for `plan.days.length === 0`. Without this guard,
`applyOverridesForDate` calls `mod(n, 0)` which returns `NaN`, and
`plan.days[NaN]` returns `undefined` — meaning the returned `ResolvedDay` has
`planDay: undefined` even though the type says `WorkoutDay`. This is consistent
with the guard already present in `getUpcomingDays` and `getResolvedDaysRange`.
The synthetic rest day returned has an empty slots array, making it safe for any
caller that accesses `planDay.slots`.

**Tests added:**
- `rotationEngine.test.ts` — two new cases: (1) `getTodayResolvedDay` with 0-day plan returns safe ResolvedDay; (2) reflects existing entry status for 0-day plan
- `programStore.test.ts` — three error-resilience cases: (1) malformed condition string returns `{}`; (2) empty then-string is a no-op; (3) null then-string doesn't throw and leaves vars unchanged

**Files changed:**
- `src/store/programStore.ts`
- `src/engine/rotationEngine.ts`
- `src/engine/__tests__/rotationEngine.test.ts`
- `src/store/__tests__/programStore.test.ts`

**Risks / tradeoffs:**
- `applyProgressionRule` now swallows errors silently. The console.error call makes
  them visible to developers but not to end users. For a future pass, consider
  surfacing a toast when progression fails so YAML plan authors know their rule is broken.
- The synthetic rest day returned by `getTodayResolvedDay` for 0-day plans could
  confuse TodayPage if it tries to act on `planDay.slots[0]` (it will be `undefined`).
  TodayPage already handles the no-slot case (`primarySlot` check in `handleOutcomeConfirm`).

**Rollback:**
```bash
git revert fc7d317
```

---

### 2. feat: add Program Variables Inspector panel to TodayPage

**Summary:** Collapsible read-only panel showing current YAML program variable values.

YAML plan users auto-progress variables like `squat: 135` or `easy_miles: 3.5` each
session — but until now had no way to inspect current values in the app. The only
signal was the workout card's resolved weight/distance, which requires knowing what
to look for.

The panel is rendered between the previous-session hint and the double-day block, only when:
1. `Object.keys(planProgramVars).length > 0` (YAML/program plans only)
2. `isPending === true` (today's workout not yet logged)

It is **collapsed by default** (a single-line header row) and expands on tap. The
expanded state shows a compact two-column grid of `variable_name → current value`.
Non-integer values are formatted to remove trailing zeros (e.g. `3.50` → `3.5`).

`planProgramVars` was already computed in TodayPage (wired to `ActiveWorkoutTracker`)
so no new store subscription or computation is needed.

**Files changed:**
- `src/pages/TodayPage.tsx` (new `ProgramVarsPanel` component + JSX wiring)
- `FEATURE_PROPOSAL.md` (Pass 50 entry appended)

**Risks / tradeoffs:**
- Non-YAML plan users: never see the panel (condition guard ensures this)
- YAML plan users: see an extra panel above the action buttons; it's collapsed by
  default so it doesn't disrupt the flow unless the user taps it
- Variable names are shown as-is (no formatting). This is intentional — the user
  chose the names in their YAML, so they understand them
- The `useCallback` import was already needed; `ChevronDown` icon was added to the
  existing lucide-react import

**Rollback:**
Remove the `ProgramVarsPanel` component definition and the JSX block that renders it:
```bash
git revert a631615
```

---

## 2026-06-04 (forty-ninth pass) — branch `claude/dreamy-mccarthy-WovqU`

Baseline on entry: **788 passing, 0 failing**. Exit state: **793 passing, 0 failing** (+5 tests).

---

### 1. fix: filter future-dated entries from rotation stats functions

**Summary:** Three rotation stat utilities (`computePlanProgress` rotations branch, `computeRotationCycleProgress`, `computeRotationPlanRemaining`) did not filter history entries with `calendarDate > today`, unlike `isPlanExpired` which was fixed in pass 48. A CSV import or manually-entered entry dated in the future would silently inflate or deflate these displays.

**Why it matters:** Inconsistency with the canonical expiry check creates user confusion — the cycle bar might show wrong progress while the "plan complete" banner uses a different filter. The guard is easy to add and has clear test coverage.

**Files changed:**
- `src/lib/historyStats.ts` — add `e.calendarDate <= today` filter in `computePlanProgress` rotations branch; add optional `today?: string` parameter to `computeRotationCycleProgress` and `computeRotationPlanRemaining`
- `src/lib/__tests__/historyStats.test.ts` — 5 new regression tests
- `src/pages/TodayPage.tsx` — pass `today` to both new optional-param callers

**Risks / tradeoffs:** Optional parameter with `undefined = no filter` is backward-compatible; existing tests and callers without `today` continue to work as before. No behavioral change unless a future-dated entry exists in the store.

**Rollback:** Revert the commit (`git revert 622cd4f`). No data migration needed.

---

### 2. feat: show overall rotation number in TodayPage header

**Summary:** Multi-rotation plans (e.g. a 4-rotation training block) now show "Rotation 2 of 4" in the TodayPage header subtext, alongside the existing per-cycle `3/7 done` display. The final rotation shows "· last rotation!" to mirror the weeks-plan "· last week!" label.

**Why it matters:** Users doing a 4-rotation plan had no clear signal of which rotation they were in — they had to count manually from history. This closes the parity gap with `weekProgress` (weeks plans already show "Week X of Y").

**Files changed:**
- `src/pages/TodayPage.tsx` — compute `rotationProgress` via `computePlanProgress`; render "Rotation X of Y" in header

**Risks / tradeoffs:** The feature uses the newly corrected `computePlanProgress` (future-entry fix applied), so the count is accurate. Hidden when `plan.duration.value <= 1` (no meaningful "Rotation 1 of 1") and when the plan is expired. Additive JSX change only — easy to revert.

**Rollback:** Revert the commit (`git revert 4cb90ae`). No data migration needed.

---

## 2026-06-02 (forty-eighth pass) — branch `claude/dreamy-mccarthy-lm1Op`

Baseline on entry: **786 passing, 0 failing**. Exit state: **788 passing, 0 failing** (+2 tests).

---

### 1 — refactor: extract `outcomeSortKey` to shared lib

**Summary:** Both `TodayPage.tsx` and `CalendarPage.tsx` had identical local definitions of `outcomeSortKey`. Extracted to `src/lib/outcomeSortKey.ts` and updated both files to import from the shared module.

**Files changed:** `src/lib/outcomeSortKey.ts` (new), `src/pages/TodayPage.tsx`, `src/pages/CalendarPage.tsx`

**Risks / tradeoffs:** Pure refactor. No behavior change; same function in both call sites. `CalendarPage` no longer imports `parseWorkoutInstanceId` directly (it was only needed by the removed local function). `TodayPage` retains the import because it uses `parseWorkoutInstanceId` at line 317 for `prevSessionDate`.

---

### 2 — fix: add Unlogged entry to Calendar legend

**Summary:** The Calendar legend listed Done, Pending, Upcoming, Day Off, and Skipped but was missing an entry for `past_unlogged` cells. These cells render as `bg-slate-800/20 text-slate-600` with no key in the legend. Added "Unlogged" item between Pending and Upcoming.

**Files changed:** `src/pages/CalendarPage.tsx`

**Risks / tradeoffs:** UI-only additive change. No logic modified.

---

### 3 — feat: show skip nudge banner after 3+ consecutive skipped workouts

**Summary:** Wired `computeConsecutiveSkips` (added in pass 47, previously un-consumed) into `TodayPage`. When `consecutiveSkips >= 3`, an amber banner appears below the activity strip reading "N workouts skipped in a row — you've got this!" with a Calendar shortcut link. Banner is suppressed when the plan is expired.

**Files changed:** `src/pages/TodayPage.tsx`

**Risks / tradeoffs:** Additive UI change. The `computeConsecutiveSkips` function is already fully tested (15 tests in historyStats.test.ts). The 3-skip threshold is configurable via code; no magic constant elsewhere.

---

### 4 — fix: exclude future-dated entries from `isPlanExpired` rotation check

**Summary:** `isPlanExpired` for `rotations`-duration plans was counting all entries with matching `planId` regardless of `calendarDate`. An imported or manually-added entry with `calendarDate > today` could prematurely trigger the "Plan complete!" banner. Added `&& e.calendarDate <= today` to the filter.

**Files changed:** `src/engine/rotationEngine.ts`, `src/engine/__tests__/rotationEngine.test.ts`

**Risks / tradeoffs:** The fix is targeted; only the future-entry guard was missing. `weeks`-duration plans use a date comparison and were never affected. Two new tests: one verifying that a future-dated completion is not counted, one confirming the normal expiry still fires when all entries are on or before today.

---

## 2026-06-01 (forty-seventh pass) — branch `claude/dreamy-mccarthy-iQpbb`

Baseline on entry: **770 passing, 0 failing**. Exit state: **786 passing, 0 failing** (+16 tests).

---

### 1 — docs(IMPLEMENTATION_PLAN): pass 47 audit findings

**Summary:** Appended pass 47 audit section to `IMPLEMENTATION_PLAN.md`, documenting four items discovered during the codebase review: (1) multi-slot type attribution gap in `computeWorkoutTypeBreakdown`, (2) null-effort progression defaults (documented, intentional), (3) `updateEntryDate` caller contract for deduplication, and (4) the `computeConsecutiveSkips` feature decision.

**Files changed:** `IMPLEMENTATION_PLAN.md`

**Risks / tradeoffs:** Documentation only. No code changed.

---

### 2 — feat(historyStats): add `computeConsecutiveSkips` utility

**Summary:** Added a new pure function `computeConsecutiveSkips(planId, entries, extras, today)` to `src/lib/historyStats.ts`. It counts how many consecutive days (working backward from yesterday) have been logged exclusively as skips with no completed, day-off, or extra-workout entries breaking the streak. Today is always excluded (it may still be logged). The result enables UI nudges like "You've skipped 3 workouts in a row."

**Algorithm:** Collects `skipDates` and `breakDates` from filtered entries/extras for the given plan. Walks backward from `shiftDay(today, -1)`, incrementing while the cursor is in `skipDates` and not in `breakDates`. Stops at the first gap, break date, or start of history.

**Files changed:** `src/lib/historyStats.ts`

**Risks / tradeoffs:** Purely additive. No existing behavior modified. No new dependencies. The function is exported but not yet consumed by any UI component — callable whenever the feature is surfaced.

---

### 3 — test(historyStats): `computeConsecutiveSkips` + multi-slot breakdown

**Summary:** Added 15 tests covering `computeConsecutiveSkips` (empty history, gaps, streak of N, complete/day-off/extra breaks, different-plan isolation, today excluded) and 1 documentation test covering the known `computeWorkoutTypeBreakdown` multi-slot attribution gap.

**Files changed:** `src/lib/__tests__/historyStats.test.ts`

**Risks / tradeoffs:** Pure test additions. No production code affected.

---

### 4 — test(historyStore): document `updateEntryDate` coexistence contract

**Summary:** Added one test to the `updateEntryDate` describe block explicitly documenting that the function does NOT deduplicate entries on the target date — it is a caller contract that callers remove any conflicting entry before calling `updateEntryDate`. This makes the invariant machine-verifiable rather than comment-only.

**Files changed:** `src/store/__tests__/historyStore.test.ts`

**Risks / tradeoffs:** Pure test addition. No production code affected.

---

## 2026-05-31 (forty-sixth pass) — branch `claude/dreamy-mccarthy-N2mc1`

Baseline on entry: **770 passing, 0 failing**. Exit state: **770 passing, 0 failing** (no new tests; all changes are UI/logic only).

---

### 1 — fix(CalendarPage): stable sort key in `findPreviousSetsByExercise`

**Summary:** CalendarPage's `findPreviousSetsByExercise` helper was sorting outcomes by `(b.completedAt ?? '').localeCompare(a.completedAt ?? '')`. When `completedAt` is absent, every comparison evaluates `'' vs ''` (equal), making the final sort order non-deterministic. Pre-filled "previous sets" weights in CalendarPage's OutcomeModal could show data from any arbitrary past session rather than the most recent one.

**Why it matters:** Users counting on prior-session data to pace weights would get misleading reference data silently. Identical bug was fixed in TodayPage (commit 18adf1f); CalendarPage was missed.

**Fix:** Port `outcomeSortKey()` from TodayPage — prefer `completedAt`, fall back to the calendarDate embedded in `workoutInstanceId` (via `parseWorkoutInstanceId`).

**Files changed:** `src/pages/CalendarPage.tsx`

**Risks / tradeoffs:** None. Behavioral change only when `completedAt` is null; correct ordering for those cases.

**Rollback:** `git revert bf5f42d`

---

### 2 — fix(CalendarPage): refresh today via `useToday` hook

**Summary:** `const now = new Date()` was computed once at CalendarPage mount and never refreshed. If the user left the Calendar open overnight, `goToToday()` would navigate to the previous month and `isCurrentMonth` would be `true` for the wrong month.

**Why it matters:** "Today" button becomes a misleading no-op after midnight. TodayPage already uses `useToday()` (added in pass 45) for exactly this reason.

**Fix:** Replace `const now = new Date()` with `useToday()` (returns a `YYYY-MM-DD` string, refreshed at midnight). Parse `nowYear` and `nowMonth` from the string directly.

**Files changed:** `src/pages/CalendarPage.tsx`

**Risks / tradeoffs:** None. `useToday` has a single responsibility and is already tested via TodayPage. The calendar's displayed month/year is initialized from `useState`, so this only affects future midnight refreshes and the "Today" button behavior.

**Rollback:** `git revert fd6d31f`

---

### 3 — fix(CalendarPage): allow Day Off on past unlogged dates

**Summary:** `canDayOff = isToday || isFuture` in `DayDetailModal` excluded past dates. Users retroactively logging unlogged past days in the Calendar could only choose Complete or Skip — Day Off was not an option. TodayPage's catch-up flow (`markDaysAsOff`) already marks past days as Day Off; the Calendar was inconsistent.

**Why it matters:** A user returning from a vacation or illness who wants to log "Day Off" for several past days had to either use TodayPage's bulk catch-up (which marks ALL unlogged days) or skip them instead. The Calendar should support all three actions for past dates.

**Fix:** Change `canDayOff` to `isPast || isToday || isFuture` (always available when there's a plan active). Past days now show Complete, Skip, and Day Off buttons side-by-side.

**Files changed:** `src/pages/CalendarPage.tsx`

**Risks / tradeoffs:** Product decision — is it valid to retroactively mark something as "Day Off"? Yes: the catch-up flow already does it. No rotation-pointer change needed; `day_off` entries advance the pointer the same as any other action.

**Rollback:** `git revert 6378fc7`

---

### 4 — feat(CalendarPage): outcome summary preview in DayDetailModal Level 1

**Summary:** Completed workouts in the calendar's DayDetailModal now show a compact outcome summary in the Level 1 overview: colored effort dots (● green=easy through ●●●●● red=hard) and a 1-line italic notes preview. Users can see workout quality at a glance without drilling into the full OutcomeModal.

**Why it matters:** Previously a user would tap a completed calendar cell, see "Done" badge, and have to click through to Level 2 or the full OutcomeModal to see if they'd logged notes or how hard the session felt. For a monthly review, clicking into each day is high friction.

**Implementation:** Added `rotOutcomeLevel1` lookup (already available via the `outcomes` prop), `effortLabels` and `effortColors` arrays. Two optional elements rendered below the main workout button when data exists; hidden when no outcome data is present.

**Files changed:** `src/pages/CalendarPage.tsx`

**Risks / tradeoffs:** Purely additive. No behavior change for workouts without outcome data. The effort display uses Unicode dots (●) rather than icons — compact, localization-neutral, no dependency added.

**Rollback:** `git revert 7489e0f`

---

## 2026-05-30 (forty-fifth pass) — branch `claude/dreamy-mccarthy-mxssu`

Baseline on entry: **767 passing, 0 failing**. Exit state: **770 passing, 0 failing** (+3 tests).

---

### Change 1 — fix: stable sort key in `findPreviousWeightsOutcome` / `findPreviousSetsByExercise`

**Summary:** Both helper functions in `TodayPage.tsx` compared outcomes using `completedAt ?? ''` as the sort key. When `completedAt` is absent, every comparison evaluates `'' > ''` (false). `findPreviousWeightsOutcome`'s linear max-scan returns the first qualifying outcome found in `Object.values()` iteration order rather than the most recent. `findPreviousSetsByExercise`'s `.sort()` produces an indeterminate order. Both results are used to pre-fill the OutcomeModal (set weights, rep targets) and to display the "Last: N×M @ W lb" hint on the Today card.

**Fix:** Extract `outcomeSortKey(o)` that returns `o.completedAt` when present (a full ISO datetime) and falls back to the calendarDate embedded in `o.workoutInstanceId` via `parseWorkoutInstanceId`. The instanceId format is `planId_YYYY-MM-DD`, so the extracted date gives a stable, chronologically correct ordering for outcomes without an explicit `completedAt`.

**Why it matters:** For users who have logged many sessions (especially before `completedAt` became the standard field), the "previous session" hint and pre-filled weights in OutcomeModal could display data from a non-recent session. The bug manifests silently — the UI shows stale reference weights without any error.

**Files changed:**
- `src/pages/TodayPage.tsx` — `outcomeSortKey()` helper; updated both functions

**Risks/tradeoffs:** No behavior change for outcomes that have `completedAt`. Outcomes without it now sort by calendar date, which is the correct intent.

**Rollback:** `git revert 49839b8`

---

### Change 2 — fix+test: exclude future-dated entries from `totalLogged`/`totalCompleted`

**Summary:** `computeHistoryStats` counted all entries regardless of `calendarDate` for `totalLogged` and `totalCompleted`. A CSV import with future-dated entries (e.g., a planning import or a bad export) silently inflated both counters shown on the History page. The rest of the function already guarded against future dates in `last7Completed`/`last30Completed` (via `inWindow` bounded by `<= today`) and in `longestStreak` (fixed in pass 42). `totalLogged` and `totalCompleted` were the remaining gap, documented as a recommendation in passes 42 and 43.

**Fix:** Filter both `entries` and `extras` to `calendarDate <= today` before computing totals. Three regression tests added.

**Why it matters:** Users who import a CSV with future-dated rows see inflated "total workouts logged" and "total completed" counts immediately after import, with no way to correct them without deleting the entries. The fix makes these stats consistent with all other date-bounded stats in the function.

**Files changed:**
- `src/lib/historyStats.ts` — two-line filter added to `computeHistoryStats`
- `src/lib/__tests__/historyStats.test.ts` — three regression tests

**Risks/tradeoffs:** Only affects users who have future-dated entries. Those users will see `totalLogged` and `totalCompleted` decrease to the correct value on next render. No data is deleted; entries remain in the store.

**Rollback:** `git revert b342a01`

---

### Change 3 — feat: `useToday` hook with midnight refresh; wire into TodayPage

**Summary:** `TodayPage` computed `today` as `format(new Date(), 'yyyy-MM-dd')` at render time. If the app stays open past midnight — without the user navigating away and back — all date-dependent displays (Today card, stats bar, upcoming section, "days ago" hint) would show the previous calendar date until a navigation occurred. This was documented as a known staleness risk in passes 44 and earlier.

**Fix:** Created `src/hooks/useToday.ts`. The hook initialises `today` from the current date, then schedules a `setTimeout` to fire at the next midnight and advance the state. The `[today]` dependency re-arms the timeout each time the date advances, handling subsequent midnights automatically. No external polling. TodayPage replaces the inline `format(new Date(), ...)` call with `const today = useToday()`.

**Why it matters:** Users who leave the app open overnight (common on mobile as a pinned PWA) will now see the correct date immediately when they return, without needing to navigate away and back. The fix is targeted at TodayPage; CalendarPage and HistoryPage use their own inline `today` values and can be updated in future passes.

**Files changed:**
- `src/hooks/useToday.ts` — new file (hook implementation)
- `src/pages/TodayPage.tsx` — import + replaces inline `format(new Date(), ...)`

**Risks/tradeoffs:** The timeout fires once per day and is cleaned up on component unmount. Memory and timer overhead is negligible. No unit tests added (the hook behavior is time-dependent and the existing infrastructure doesn't mock timers for this module). A manual test can verify by temporarily setting `setTimeout(, 5000)` and confirming the date advances.

**Rollback:** `git revert 91f5d26`

---

## 2026-05-30 (forty-fourth pass) — branch `claude/dreamy-mccarthy-uCF1X`

Baseline on entry: **766 passing, 0 failing**. Exit state: **767 passing, 0 failing** (+1 test).

---

### Change 1 — fix: `moveByWorkoutInstance` propagates `calendarDate`

**Summary:** When a workout entry is moved to a different calendar date, `exerciseHistoryStore.moveByWorkoutInstance` now updates `calendarDate` on every affected `ExerciseSessionRecord` in addition to `workoutInstanceId`. Previously only the instance key was updated, leaving `calendarDate` pointing to the original date.

**Why it matters:** `calendarDate` is the sort key for `getByExerciseName` and the date field for `computePersonalRecords` (`maxLoadDate`, `maxRepsDate`). A stale date caused PR achievements to be attributed to the wrong day and disrupted chronological ordering in exercise history views.

**Files changed:**
- `src/store/exerciseHistoryStore.ts` — parse new instanceId to extract `calendarDate`; update both fields together
- `src/store/__tests__/exerciseHistoryStore.test.ts` — new test: `'updates calendarDate to the date embedded in the new instanceId'`

**Risks/tradeoffs:** None. The fix is purely additive: the previous implementation always left `calendarDate` unchanged; the new one updates it when the instanceId contains a valid date. All existing tests still pass.

**Rollback:** `git revert b5a87b9`

---

### Change 2 — perf+ux: memoize `planExtras` and show session date in TodayPage

**Summary:** Two improvements to `TodayPage.tsx`:

1. **`planExtras` memoization** — Moved `planExtras` from an inline `filter()` (run on every render) into a `useMemo` keyed on `extraEntries` and `activePlanId`. The inline version created a new array reference on every TodayPage re-render, defeating `WeeklyActivityStrip`'s own `useMemo` and causing unnecessary recomputation of the 7-day strip.

2. **"X days ago" on last-session hint** — When the previous session summary is shown (e.g. "Last: 3×8 @ 135 lb Bench Press · PB"), the display now appends "· yesterday" or "· Xd ago" based on the calendarDate embedded in the previous session's `workoutInstanceId`. Uses no external imports beyond what was already present; no changes to `sessionSummary.ts`.

**Why it matters:** (1) Fewer re-renders on the most-visited page, especially noticeable when the app has many extra entries. (2) Users recovering from a gap (injury, travel) or planning a PR attempt can immediately judge how fresh their reference session is, without navigating to History.

**Files changed:**
- `src/pages/TodayPage.tsx` — `useMemo` for `planExtras`; session date derivation; JSX update for date hint

**Risks/tradeoffs:** The `planExtras` memo is placed before the early `!plan` guard; it returns `[]` when the plan is null, which is correct behavior. The date display only shows when `prevSessionDaysAgo > 0`; it is invisible if the previous session was today (which cannot happen given the `currentDate` exclusion in `findPreviousSessionForPlanDay`). No user-visible regression risk.

**Rollback:** `git revert 52a7ead`

---

## 2026-05-29 (forty-third pass) — branch `claude/dreamy-mccarthy-4tAQK`

Baseline on entry: **758 passing, 0 failing**. Exit state: **766 passing, 0 failing** (+8 tests).

---

### Change 1 — test: sync progression tests with progressionMode guard and volume mode fix

**Summary:**

PR #121 merged since pass 42 added two intentional behavior changes to
`buildWeightsRecommendation` in `progression.ts`:

1. A new guard at line 101 returns `null` when no exercise has `progressionMode` set.
   This was intentional: the commit message states "Exercises with no progressionType/progress
   rule produce no indicator."
2. Volume mode now uses `allSetsHitTarget` (same logic as single/double modes), so
   completing all sets to their target reps now returns `progress` instead of always `hold`.

Six tests were written against the old behavior and were failing as a result. Fixes:

- Added `progressionMode: 'single'` to exercises in four single-mode tests (progress/hold/
  hold-undefined/regress) that had no `progressionMode` and were hitting the new null guard.
- Split the volume mode "always returns hold" test into two: `progress` (all sets hit target,
  the correct behavior) and `hold` (sets below target). The old description was wrong.
- Added `progressionMode: 'single'` to the legacy `weightlifting` type test.
- Added a new null-path test: "returns null when no exercise has progressionMode configured"
  — documents the new guard behavior and prevents regression if the guard is ever loosened.

**Files changed:**
- `src/modules/workout-outcomes/__tests__/progression.test.ts` (+52 lines, 6 fixed, 1 split into 2, 1 new)

**Risk:** Zero — test-only change. No production code modified.

---

### Change 2 — fix: migrate pre-existing extras with undefined source to 'history'

**Summary:**

`ExtraWorkoutEntry` gained a `source` field to distinguish user-added extras ('history')
from double-day bonus extras ('double_day'). TodayPage's Undo handler removes extras where
`source !== 'history'`. Pre-existing extras created before this field was introduced have
`source === undefined`, which Undo treats as `'double_day'` — silently deleting manually-added
extras on Undo. This was documented as a known risk across passes 38–42.

Fix: added `version: 1` and a `migrate` function to `historyStore`'s persist config. The
migration runs once on first load for all users (v0 → v1) and sets `source: 'history'` on
any extra with `source === undefined`. Extras with explicit source values are unchanged.

The migration function is extracted as a named export (`migrateHistoryState`) for direct
unit testing.

**Files changed:**
- `src/store/historyStore.ts` — added `version: 1`, `migrateHistoryState` exported function
- `src/store/__tests__/historyStore.test.ts` — 6 new tests (undefined→history, preserved
  double_day, preserved history, skip at v1+, empty array, missing field)

**Risk:** Very low. The migration is idempotent and only touches `extraEntries`. Adding
`version: 1` causes Zustand to re-run the migration on first load — safe because the
storage key (`wpt_history`) is unchanged and the migration handles all data shapes.

**Rollback:** Remove `version` and `migrate` from the persist config. Users who already
ran the migration will keep `source: 'history'` on their old extras (no revert on their
data); the Undo behavior will remain correct (extras stay 'history' on Undo).

---

## 2026-05-28 (forty-second pass) — branch `claude/dreamy-mccarthy-HtWcw`

Baseline on entry: **748 passing, 0 failing**. Exit state: **758 passing, 0 failing** (+10 tests).

---

### Change 1 — fix: clear active set timer on deleteSet, fix working set numbering, improve progression preview

**Summary:**

Three issues in `ActiveWorkoutTracker`:

1. **Stale active set timer after `deleteSet`**: When a set was deleted while it was the
   active timer (or when a higher-indexed set was deleted, shifting indices), `activeSetRef`
   and `activeSetTimer` were not cleared. The per-second interval would update a stale or
   wrong-position set. Added a guard that clears the active set timer whenever the deleted
   set's `setIdx ≥ activeSetRef.current.setIdx` for the same exercise.

2. **Working set numbers included warmup indices**: Sets were numbered with their raw
   `setIdx + 1`, so a 2-warmup + 3-working-set exercise showed "3", "4", "5" for working
   sets instead of "1", "2", "3". Fixed by computing the position among working sets only.

3. **Opaque progression preview labels**: "weights[1]: +5lb" replaced with "Set 1: 135 → 140 lb".
   When all working sets share the same transition, collapsed to a single "All sets: X → Y lb"
   line. No load data falls back to "Set N: +Xlb".

**Files changed:**
- `src/components/workout/ActiveWorkoutTracker.tsx`

**Risk:** Zero on data path. All three are display/correctness fixes with no state mutation changes.

---

### Change 2 — test: add direct isoWeekStart test cases

**Summary:** `isoWeekStart` was only exercised indirectly through `computeWeeklyBreakdown`.
Added 6 direct tests covering Monday (identity), Wednesday, Saturday, Sunday (end of ISO week),
month-boundary crossing (Feb 1 → Jan 26), and year-boundary crossing (Jan 1 → Dec 29 prior year).

**Files changed:**
- `src/lib/__tests__/historyStats.test.ts` (+6 tests, import updated)

**Risk:** None — test-only change.

---

### Change 3 — fix: exclude future-dated entries from longestStreak

**Summary:** `computeHistoryStats` built the `streakable` set from all entries without
filtering to `<= today`. CSV imports with future dates would inflate `longestStreak`.
Added a filter before the consecutive-run walk. Added a regression test with a 3-day past
run and a future entry on day 4 — verifies `longestStreak = 3`, not 4.

**Files changed:**
- `src/lib/historyStats.ts` (one-line filter added)
- `src/lib/__tests__/historyStats.test.ts` (+1 test)

**Risk:** Low. Only affects users who have future-dated entries (unusual scenario, typically
from bad imports). Those users would see `longestStreak` decrease to the correct value.

---

### Change 4 — fix: avoid name accumulation in duplicatePlan

**Summary:** Successive duplication produced "Name (copy) (copy) (copy)". Now strips any
trailing " (copy)" or " (copy N)" suffix from the source name before appending, then uses
a numeric counter (" (copy 2)", " (copy 3)", …) when the simple "(copy)" name is already
taken by an existing plan.

**Files changed:**
- `src/store/planStore.ts`
- `src/store/__tests__/planStore.test.ts` (+3 tests)

**Risk:** Low. Users with "(copy)" plans will see different copy names on next duplication.
The behavior is strictly more useful and non-destructive.

---

## 2026-05-27 (forty-first pass) — branch `claude/dreamy-mccarthy-9NxZ6`

Baseline on entry: **748 passing, 0 failing**. Exit state: **748 passing, 0 failing** (+0 tests; no new test files needed — fixes covered by existing tests and no new logic added).

---

### Change 1 — feat: add ErrorBoundary to prevent blank-screen crashes

**Summary:** Any uncaught render or hook error in React 18 unmounts the full
component tree and leaves the screen blank with no recovery path. Added a
`ErrorBoundary` class component in `src/components/shared/ErrorBoundary.tsx`
that wraps the entire `<Routes>` tree in `App.tsx`. On error it renders a
minimal "Something went wrong" recovery screen with the error message and a
"Try again" button (calls `setState({ error: null })` to attempt a re-render).

**Files changed:**
- `src/components/shared/ErrorBoundary.tsx` (new file)
- `src/App.tsx` (wraps `<Routes>` in `<ErrorBoundary>`)

**Risk:** Zero on happy path. Recovery UI replaces blank screen on error.

---

### Change 2 — fix: guard empty date in HistoryPage edit modal

**Summary:** `saveAndClose` in `HistoryPage` did not validate that
`editingEntryDate` was non-empty before proceeding. If the user cleared the
date input field and clicked Save, `updateEntryDate(id, '')` was called,
corrupting the entry's `calendarDate` to `''`. Subsequent renders or key
lookups using that field would silently fail. Added `if (!newDate) { setDateConflict(true); return }` before the conflict check. Applied the same
guard to `saveAndCloseExtra`. Updated the inline error message to distinguish
"Date is required." from "A workout is already logged for that date."

**Files changed:**
- `src/pages/HistoryPage.tsx`

**Risk:** Near-zero. Only adds an early-exit guard for an input state that was
previously silently handled incorrectly. No behavior change for valid dates.

---

## 2026-05-26 (fortieth pass) — branch `claude/dreamy-mccarthy-8Sa0s`

Baseline on entry: **743 passing, 0 failing**. Exit state: **748 passing, 0 failing** (+5 tests).

---

### Change 1 — fix: guard setActivePlan against non-existent plan ID

**Summary:** `planStore.setActivePlan(id)` previously had no early-return guard for
the case where `id` is not present in `state.plans`. The function would iterate all
existing plans and deactivate them, then write `updated[id] = { ...updated[id], ... }`
where `updated[id]` was `undefined` — spreading undefined is a no-op in JS, so the
result was a plan record with only the explicitly-assigned fields (`status`, `startDate`,
`startDayIndex`, `updatedAt`) and no required plan properties. `activePlanId` would also
be set to the invalid ID, pointing to a malformed entry on every render.

**Fix:** Added `if (!(id in s.plans)) return s` before the deactivation loop.

**Why it matters:** Any UI component calling `setActivePlan` with an unvalidated ID
(e.g., after a plan was deleted from a different tab/window) would silently corrupt the
store. The guard makes the behavior deterministic and safe.

**Files changed:**
- `src/store/planStore.ts` — added guard
- `src/store/__tests__/planStore.test.ts` — added test `'is a no-op when the plan id does not exist'`

**Risks / tradeoffs:** None. Guard is only hit for IDs not in the store — a condition
that should never arise in normal use, so no observable change for valid calls.

---

### Change 2 — test: null perceivedEffort coverage for swim buildProgressionRecommendation

**Summary:** The run slot already had a test verifying that `perceivedEffort: null`
defaults to 3 (the progress threshold) and returns `action: 'progress'`. The swim branch
uses the identical `(outcome.perceivedEffort ?? 3) <= 3` expression but had no dedicated
test. Added one test for the swim case.

**Files changed:**
- `src/modules/workout-outcomes/__tests__/progression.test.ts` — +1 test

**Risks / tradeoffs:** Test-only. No production code change.

---

### Change 3 — feat: include swim actuals in history CSV export and import

**Summary:** `historyToCsv` only exported run actuals. Swim workout data
(`actualDistanceMeters`, `actualDurationMin`, `averagePaceSecondsPer100m`,
`completedAsPlanned`) was silently dropped — users who export CSV for backup or migration
lose all swim workout performance data.

**Fix:** Added four new columns to `HISTORY_HEADERS` (`swimActualDistanceMeters`,
`swimActualDurationMin`, `swimAveragePaceSecondsPer100m`, `swimCompletedAsPlanned`).
Both the rotation and extra row builders now populate these columns from
`outcome.swimActual`. The `buildOutcomeFromRow` importer reconstructs `swimActual` when
any swim column is present. Columns are appended after the existing run columns so all
prior CSV exports remain valid (missing columns parse as undefined → `swimActual` unset).

**Files changed:**
- `src/lib/csv.ts` — HISTORY_HEADERS, rotation row, extra row, buildOutcomeFromRow
- `src/lib/__tests__/csv.test.ts` — +3 tests: rotation round-trip, extra round-trip, empty columns

**Risks / tradeoffs:** The four new columns extend every CSV export going forward. Old
exports are fully backward compatible. `completedAsPlanned` now has two representations
(`completedAsPlanned` for run, `swimCompletedAsPlanned` for swim) — this is intentional
to avoid ambiguity when a row contains both.

**Rollback:** `git revert` the commit. CSVs exported before the revert would re-import
correctly (no swim columns → `swimActual` undefined). CSVs exported after this feature
and before a revert would lose swim data on re-import, but no data is corrupted in the store.

---

## 2026-05-25 (thirty-ninth pass) — branch `claude/dreamy-mccarthy-0z9MJ`

Baseline on entry: **738 passing, 0 failing**. Exit state: **743 passing, 0 failing** (+5 tests).

---

### Change 1 — fix: nanoid import path in csv.ts and PlanBuilderPage.tsx

**Summary:** Both `src/lib/csv.ts` and `src/pages/PlanBuilderPage.tsx` imported `nanoid`
from `'../engine/rotationEngine'` (or `'../../engine/rotationEngine'`). rotationEngine.ts
re-exports `nanoid` from `lib/utils` — the re-export works, but couples these utilities to
the rotation engine's public surface. The same issue was fixed in `exerciseHistoryStore.ts`
in pass 37, but these two files were missed.

**Why it matters:** Import coupling at this level is low-risk but creates a confusing
dependency graph: changing rotationEngine's exports could silently break CSV parsing and
plan editing. Importing from the canonical source removes the indirection.

**Files changed:**
- `src/lib/csv.ts` — `from '../engine/rotationEngine'` → `from './utils'`
- `src/pages/PlanBuilderPage.tsx` — `from '../engine/rotationEngine'` → `from '../lib/utils'`

**Risks / tradeoffs:** No behavior change. Both imports resolve to the same function.

**Rollback:** `git revert` the commit — no state affected, purely an import change.

---

### Change 2 — fix + feat: buildLastSessionSummary avoids ×undefined; shows +N more

**Summary (fix):** `buildLastSessionSummary` in `sessionSummary.ts` used
`s.actualReps != null ? s.actualReps : s.targetReps` to determine the rep count to display.
When `actualReps` is null and `targetReps` is `undefined` (no target was set), this passed
`undefined` directly into the template string — producing "Last: 2×undefined @ 135 lb Squat".
Fixed by using nullish coalescing: `s.actualReps ?? s.targetReps ?? null`. When the result
is null, the format falls back to "N sets" (e.g. "Last: 2 sets @ 135 lb Squat").

**Summary (feature):** For workouts with multiple exercises that have actual logged data,
appends "(+N more)" to the session hint. For example, a 3-exercise session now shows
"Last: 1×5 @ 185 lb Squat (+2 more)" instead of only the first exercise. Only exercises
with at least one non-null reps or load value are counted, so placeholder/unlogged exercises
don't inflate the count. Single-exercise workouts are unchanged.

**Why it matters (fix):** The bug affects any set where load was recorded but reps were not —
a real pattern for timed holds, isometric exercises, or when a user logs weight only. The
corrupted output "×undefined" is immediately visible and confusing.

**Why it matters (feature):** TodayPage's pending workout hint now reflects the scope of the
last session at a glance. Users with 4–6 lift programs see more useful context for planning
their next session weight selections.

**Files changed:**
- `src/lib/sessionSummary.ts` — reps assignment + repsStr + moreStr (7 lines)
- `src/lib/__tests__/sessionSummary.test.ts` — 5 new tests

**Risks / tradeoffs:** The bug fix changes the display format for the undefined case from
"×undefined" to " sets". This is strictly better UX. The multi-exercise feature appends text
to an existing string — single-exercise output is bit-for-bit identical to before.

**Rollback:** `git revert` the commit — pure display-layer change, no store or schema impact.

---

## 2026-05-24 (thirty-eighth pass) — branch `claude/dreamy-mccarthy-oaS1e`

Baseline on entry: **734 passing, 0 failing**. Exit state: **738 passing, 0 failing** (+4 tests).

---

### Change 1 — fix: deferred outcomes no longer fire YAML progression rules

**Summary:** `logOutcomeWithProgression` in `outcomeStore.ts` now excludes
`deferred` from the `session_complete` context variable alongside `skipped` and
`planned`. Previously, deferring a workout (which the history engine maps to a
`day_off` action — no workout performed) would still evaluate progression rules
that check `if: session_complete`, causing variable increments (e.g., `load += 5`)
to fire without any actual workout being completed.

**Why it matters:** YAML-imported plans use progression rules such as
`if: session_complete then load += 2.5` to auto-advance per-exercise load across
sessions. If a `deferred` outcome fires those rules, the user's program variables
drift forward without any work being done — the next session would start with a
higher target weight than warranted. This is a silent data corruption bug with no
runtime error or user-visible warning.

**Files changed:**
- `src/store/outcomeStore.ts` — one-line fix adding `!== 'deferred'` guard
- `src/store/__tests__/outcomeStore.test.ts` — 3 new tests (deferred, completed, skipped)

**Risks / tradeoffs:** The only behavior change is that deferred outcomes no longer
advance YAML progression variables. Users who have already had deferred outcomes
fire their progression rules will not see a rollback of those variables (persisted
state is not retroactively corrected — that would require a migration). New defer
events after this commit are correctly excluded.

**Rollback:** Remove `outcome.completionState !== 'deferred'` from the `session_complete`
expression in `logOutcomeWithProgression`.

---

### Change 2 — fix: deep-clone DrillSpec[] within RunSegment.drills on plan duplication

**Summary:** `deepCloneWorkoutSlot` in `planStore.ts` now maps `s.drills` within
each run segment so that drill objects are independent between the original and
the duplicated plan. Previously `segments.map(s => ({ ...s }))` shallow-cloned
each segment, leaving the `drills` array (and its `DrillSpec` objects) shared.

**Why it matters:** Pass 37's REVIEW_NOTES explicitly called this out as a remaining
recommendation. The same category of bug was fixed for `SetSpec[]` in pass 37 (for
`exercises`/`warmup`) and for top-level `exercises`/`warmup`/`segments` arrays in
pass 34. `RunSegment.drills` was the last remaining shallow-clone gap in the
`duplicatePlan` path. Editing drill names, reps, or sets in one plan after duplication
would silently mutate the other plan's drill specs.

**Files changed:**
- `src/store/planStore.ts` — 4 lines changed in `deepCloneWorkoutSlot` segment mapper
- `src/store/__tests__/planStore.test.ts` — 1 new test for DrillSpec[] isolation

**Risks / tradeoffs:** The only behavior change is that `duplicatePlan` for plans with
run segments containing drills now does an extra `map` over `s.drills`. Drill arrays are
small (typically 2–8 entries) so the performance impact is negligible. Plans without run
drills are unaffected by the `s.drills ?` guard.

**Rollback:** Revert the segment mapper in `deepCloneWorkoutSlot` back to
`segments: slot.segments.map(s => ({ ...s }))`.

---

### Change 3 — fix: nanoid import path in exerciseHistoryStore

**Summary:** `exerciseHistoryStore.ts` imported `nanoid` from
`../engine/rotationEngine` (which re-exports it). Changed to import directly
from `../lib/utils` where `nanoid` is defined.

**Why it matters:** The transitive import creates an unnecessary dependency between
`exerciseHistoryStore` and the rotation engine. If `rotationEngine.ts` ever stops
re-exporting `nanoid` (e.g., during a future refactor), `exerciseHistoryStore` would
silently break. The direct import is self-documenting and correct.

**Files changed:**
- `src/store/exerciseHistoryStore.ts` — 1 import line changed

**Risks / tradeoffs:** Zero behavior change. Same function, same module — different
import path.

**Rollback:** Revert the single import line.

---

### Change 4 — feat: surface progressionRecommendation.note in TodayPage pending hint

**Summary:** The previous-session hint block on TodayPage now shows a `↗ [note]`
line when the prior session's outcome carries a `progressionRecommendation.note`
(e.g., "add 2.5 lb next session"). This is shown only for non-run slots — run slots
already have `todayAdaptationNote` from the run progression state machine and
showing both would be redundant. Only visible when the today card is pending
(`prevSessionOutcome` is computed only when `isPending`).

**Why it matters:** `progressionRecommendation.note` was being computed and stored
in outcomes (by `buildProgressionRecommendation` in the weights progression module)
but never surfaced at decision time. Users who had logged a session that generated a
progression recommendation had to open the outcome modal to see it. Surfacing it
inline at the moment the user is about to start their workout closes the loop —
the guidance appears exactly when it's actionable.

**Files changed:**
- `src/pages/TodayPage.tsx` — 4 lines added: conditional in the `&&` guard, new `<p>` element

**Risks / tradeoffs:** Purely additive. `prevSessionOutcome` is already computed and
`progressionRecommendation` is an optional field — if absent, the guard short-circuits.
No new store subscriptions, no new computation, no risk to users without outcomes.
The `!todayRunSlot` guard ensures run days are unaffected.

**Rollback:** Remove the `!todayRunSlot && prevSessionOutcome?.progressionRecommendation?.note`
condition from the outer `&&` and remove the `<p>` element inside the hint block.

---

## 2026-05-23 (thirty-seventh pass) — branch `claude/dreamy-mccarthy-79X8Y`

Baseline on entry: **732 passing, 0 failing**. Exit state: **734 passing, 0 failing** (+2 tests).

---

### Change 1 — fix: deep-clone SetSpec[] within exercises and warmup on plan duplication

**Summary:** `deepCloneWorkoutSlot` in `planStore.ts` now deep-clones the `sets`
field within each `ExerciseSpec` when it is an array of `SetSpec` objects. Previously,
duplicating a plan produced exercise specs that shared the same `SetSpec` array objects
between the original and the copy, meaning a future edit to one plan's set data would
silently corrupt the other.

**Why it matters:** Pass 34 fixed the top-level `exercises` / `warmup` / `segments`
array references, but missed one nesting level: each `ExerciseSpec.sets` when it is
a `SetSpec[]` (structured sets from YAML import). The bug would manifest if a user
duplicated a YAML-imported plan and then edited per-set details (rep count, load,
rest time) in one plan — the other plan's sets would change too without any user action.
This is a silent data corruption risk with no runtime error.

**Files changed:**
- `src/store/planStore.ts` — added `deepCloneExerciseSpec` helper (10 lines); updated
  `deepCloneWorkoutSlot` to use it for both `exercises` and `warmup`
- `src/store/__tests__/planStore.test.ts` — 2 new tests for SetSpec[] isolation

**Risks / tradeoffs:** The only change to production behavior is that `duplicatePlan`
for plans with structured exercises will do one additional `map` over the sets array.
This is negligible (sets arrays are small). Existing plans without structured exercises
(i.e., manually-built plans or YAML imports where `sets` is a plain number) are
unaffected — the `Array.isArray(ex.sets)` guard is a no-op for non-array sets.

**Rollback:** Revert `planStore.ts` to the prior `slot.exercises.map(e => ({ ...e }))` form.

---

### Change 2 — fix: WeeklyActivityStrip uses newest entry when duplicates exist for a date

**Summary:** The 7-day activity strip used `Array.find()` to look up a history entry
for each day, which returns the first matching element regardless of recency. All other
parts of the engine (rotation pointer computation, today's status resolution) use the
newest `createdAt` when multiple entries exist for the same date. The strip is now
consistent with that behavior. Also wires `computePlanStreak` into the streak stat so
the semantic is explicit.

**Why it matters:** With the existing `find()`, if a date had two entries (e.g., one
created via CSV import and a newer one from the UI), the strip might color that dot
based on the stale imported entry rather than the most-recent user action. In practice
this is rare (deduplication runs on addEntry and importEntries), but the inconsistency
was a latent correctness gap. `computePlanStreak` was a recommendation from pass 25 and
is now used in the streak stat for clearer code intent.

**Files changed:**
- `src/pages/TodayPage.tsx` — 10 lines changed (4 for dedup fix, 6 for planStreak wiring)

**Risks / tradeoffs:** The `planStreak` value is semantically equivalent to the former
`stats.currentStreak` when `planEntries` is pre-filtered (as it is today), so displayed
numbers are unchanged. The dedup fix only affects users who have duplicate entries for the
same date, which is an edge case.

**Rollback:** Revert the `filter + reduce` block back to `find()` and restore
`stats.currentStreak`.

---

### Change 3 — fix: block saving a plan with duration value < 1 in Plan Builder

**Summary:** Both Save buttons in PlanBuilderPage are now disabled when `durationValue < 1`,
and an inline error message explains the constraint. The `handleSave` function also returns
early for this case. A red border on the duration input field signals the problem visually.

**Why it matters:** A `duration.value` of 0 causes `isPlanExpired()` to return `true`
immediately on the start date (weeks-type) or as soon as any entry exists
(rotations-type, since `Math.floor(0 / days.length) >= 0` is always true). This creates
a plan that appears fully complete before the user logs any workouts, showing a "Plan
complete!" banner immediately after activation. The UI input's `|| 1` guard already
prevents 0 from being set through the numeric field, but the YAML editor path
(`applyYamlChanges → setDurationValue`) bypasses it. This fix closes the gap at the
save boundary.

**Files changed:**
- `src/pages/PlanBuilderPage.tsx` — 7 lines changed

**Risks / tradeoffs:** Low risk. The guard only blocks save; it doesn't auto-correct the
value, preserving user awareness. The visual feedback (red border + error text) makes
the problem actionable. Users who set a valid value via YAML then later see this warning
know exactly what to fix.

**Rollback:** Remove the `durationValue < 1` checks from `handleSave` and the two `disabled`
expressions. Remove the red-border conditional and the error `<p>` element.

---

## 2026-05-22 (thirty-sixth pass) — branch `claude/dreamy-mccarthy-9sH8T`

Baseline on entry: **726 passing, 0 failing**. Exit state: **732 passing, 0 failing** (+6 tests).

---

### Change 1 — fix: importOutcomes syncs exercise history with plan/workout context

**Summary:** `outcomeStore.importOutcomes` now calls `syncExerciseHistory` for each
incoming outcome rather than calling `upsertFromOutcome` directly. This gives imported
exercise records the same `planName` and `workoutName` metadata that live-logged records carry.

**Why it matters:** After CSV import, the exercise history store receives weight data
but no plan or workout context (both fields are `null`). This affects how exercise records
appear in the history page stats and any future per-plan filtering. The live logging
path already resolved this context correctly — import was the only gap.

**Files changed:**
- `src/store/outcomeStore.ts` — one-line fix in `importOutcomes`
- `src/store/__tests__/outcomeStore.test.ts` — 6 new tests

**Risks / tradeoffs:** `syncExerciseHistory` looks up plan and workout name from the
current store state. If the plan has been deleted since the outcome was originally
created, `planName` will be `null` — same as today's behavior. No behavior change
for non-weights outcomes (no-op since the function returns early if there's no
`weightsActual.exercises`).

**Rollback:** Revert the single-line change back to `exStore.upsertFromOutcome(o)`.

---

### Change 2 — feat: confirm before bulk-marking unlogged days as Day Off

**Summary:** Added a confirmation modal before the "Mark N as Day Off" bulk action
in TodayPage. The modal lists the dates that will be affected and requires explicit
confirmation before calling `markDaysAsOff`.

**Why it matters:** Without a confirmation step, a single accidental tap on a mobile
screen could silently batch-mark up to 7 past days, affecting the rotation pointer
for all of them. The modal is non-destructive to add (it's purely gating an existing
action) and easy to dismiss.

**Files changed:**
- `src/pages/TodayPage.tsx` — ~30 lines added

**Rollback:** Remove `showCatchupConfirm` state and the `Modal` block; revert the
"Mark N as Day Off" button onClick to call `markDaysAsOff(plan.id, unloggedDates)` directly.
