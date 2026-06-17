# Overnight Changelog — 2026-06-17

## [1] Fix: deduplicate same-date entries in `computePlanProgress` (rotations)

**Summary**: `computePlanProgress` for rotation-based plans now counts unique calendar dates via `new Set(...)` before dividing by `plan.days.length`, matching the deduplication contract already in `isPlanExpired` (fixed in pass 58).

**Why it matters**: `isPlanExpired` uses `Set`-based deduplication so that two entries on the same date (e.g. from a re-imported CSV) count as one rotation advancement. `computePlanProgress` was still using `planEntries.length` (raw count), creating an inconsistency: progress % could appear higher than what the engine would consider "completed." For a 2-day plan with 4 entries but only 3 unique dates, the old code produced `floor(4/2) = 2` rotations (100%), while `isPlanExpired` correctly computed `floor(3/2) = 1` rotation (50%).

**Files changed**: `src/lib/historyStats.ts` (~6 lines), `src/lib/__tests__/historyStats.test.ts` (+15 lines, 1 new test)

**Rollback**: `git revert <sha>` on the "fix computePlanProgress deduplication" commit

---

## [2] Docs: fix misleading JSDoc in `resolveQuantityString` for `"10m"`

**Summary**: The `resolveQuantityString` JSDoc incorrectly stated that `"10m"` returns `{ unit: 'min' }` (minutes). The regex `mi|km|m|s|min|h` matches `'m'` first (before `'min'`), so `"10m"` always returns `{ unit: 'm' }` (meters). Updated comment and noted that `"10min"` is required for minutes.

**Why it matters**: Any caller relying on the documented behavior for `"10m"` → minutes would be surprised at runtime. The corrected documentation prevents misuse of the API.

**Files changed**: `src/lib/expressionEval.ts` (1 comment line), `src/lib/__tests__/expressionEval.test.ts` (+4 lines, 1 new test)

**Rollback**: `git revert <sha>` on the "fix resolveQuantityString doc" commit

---

## [3] Feature: add `findBestWeek` utility to `historyStats.ts`

**Summary**: New exported function `findBestWeek(planId, entries, extras)` returns the `WeeklyBreakdown` with the highest `completed + extras` count across all recorded weeks for a given plan. Returns `null` if there are no entries. Delegates week computation to the existing `computeWeeklyBreakdown`.

**Why it matters**: The weekly breakdown table already exists on the History page but there is no programmatic way to surface "your best week" for stats displays, motivational banners, or future PR-style callouts. This function fills that gap as a pure utility with no side effects.

**Files changed**: `src/lib/historyStats.ts` (+26 lines), `src/lib/__tests__/historyStats.test.ts` (+120 lines, 11 new tests)

**Rollback**: `git revert <sha>` on the "add findBestWeek utility" commit — purely additive, no callers to update.

---

## Pass 58 — 2026-06-16

## [1] Fix: deduplicate entries by date in `isPlanExpired` rotations path

**Summary**: `isPlanExpired` (rotations mode) now counts unique calendar dates via `new Set(...).size` instead of raw entry count. This matches the deduplication contract already in `computeCurrentDayIndex`, which uses a Map to keep only the newest entry per date.

**Why it matters**: The history store's `addEntry()` prevents exact duplicates, but nothing prevents two entries on the same date with different `createdAt` timestamps. Without deduplication, those two entries would count as two separate rotation completions, potentially expiring a plan prematurely (e.g., a 2-day plan with both entries on day 1 would register as 1 full rotation after a single day). The fix is defensive hardening that aligns `isPlanExpired` with the rest of the engine.

**Files changed**: `src/engine/rotationEngine.ts` (~3 lines), `src/engine/__tests__/rotationEngine.test.ts` (+12 lines, 1 new test)

**Rollback**: `git revert 9832df2`

---

## [2] Refactor: extract `getStreakDatesSet` helper, eliminate duplicated logic

**Summary**: Extracted a new exported function `getStreakDatesSet(entries, extras, planId?)` from the inline Set-building logic that was duplicated in both `computeHistoryStats` and `computePlanStreak`. Both functions now call the helper.

**Why it matters**: The definition of "streakable" (complete/day_off entries + all extra workouts) was encoded in two separate places, 470 lines apart. Adding a new action type (e.g., a future "partial" action) would require updating both independently. The extracted helper is the single source of truth.

**Files changed**: `src/lib/historyStats.ts` (+16 lines, 2 call-site simplifications), `src/lib/__tests__/historyStats.test.ts` (+80 lines, 12 new tests)

**Rollback**: `git revert 9e7924c`

---

## [3] Docs: clarify single-slot attribution in `computeWorkoutTypeBreakdown`

**Summary**: Added an inline comment at the `slots[0]` usage in `computeWorkoutTypeBreakdown` explaining that only the primary (first) slot's type is attributed for dual-slot days.

**Why it matters**: Dual-slot plan days (e.g., weights + run on the same day) only have their first slot counted toward the workout type breakdown. This was documented in the test file but not at the usage site, leaving future readers to guess at the intent.

**Files changed**: `src/lib/historyStats.ts` (+2 comment lines)

**Rollback**: `git revert 997428f`

---

## [4] Feature: `computeCurrentStreakDates` for calendar streak highlighting

**Summary**: Added a new exported function `computeCurrentStreakDates(entries, extras, today, planId?)` that returns `Set<string>` of consecutive streak dates ending on or including today, by walking backward through `getStreakDatesSet`. Fully tested with 9 cases.

**Why it matters**: Calendar views that want to highlight streak days currently have no way to get the set of dates forming the active streak without re-implementing the backward walk. This function provides that utility. It also validates the `getStreakDatesSet` refactor — any regression in the helper would be caught by these tests.

**Files changed**: `src/lib/historyStats.ts` (+18 lines), `src/lib/__tests__/historyStats.test.ts` (+80 lines, 9 new tests)

**Rollback**: `git revert a0cfce7`

---

# Overnight Changelog — 2026-06-15

## [1] Fix: guard run-progression calls with try/catch in `logOutcomeWithProgression`

**Summary**: Wrapped the `evaluateRunProgression` / `applyRunProgressionDecision` block in `outcomeStore.logOutcomeWithProgression` in a try/catch that logs the error and swallows it.

**Why it matters**: `setOutcome` fires first (step 1), so the outcome data is always persisted. But without a guard, any exception in the progression engine propagates back to TodayPage's `handleOutcomeConfirm`. That function has no try/catch, so an exception would: leave the outcome modal open, skip the rotation advance (`actions.advance()`), and abort the double-day bonus flow — even though the workout data was already saved. The fix mirrors the existing guard in `programStore.applyProgressionRule` (added in pass 50).

**Files changed**: `src/store/outcomeStore.ts` (lines 119–133, ~10 lines changed)

**Risks / tradeoffs**: Errors in the progression engine are now silent (console.error only). A future run-progression bug would be harder to notice. This is the correct trade-off for a UI critical path: the outcome is already saved and the user shouldn't see an error screen for a background computation.

**Rollback**: Revert to the version without the try/catch. No data was at risk.

---

## [2] Fix: add persist `version: 1` to `outcomeStore`

**Summary**: Added `version: 1` and an identity `migrate` function to the `wpt_outcomes` Zustand persist config.

**Why it matters**: Without a version field, adding one in future would cause Zustand to wipe the store for all users (it clears the store when `storedVersion < currentVersion` and there is no `migrate` function). The `historyStore` and `planStore` both already have versioned persist configs. This change brings `outcomeStore` into alignment and establishes a safe baseline for future schema changes.

**Files changed**: `src/store/outcomeStore.ts` (4 lines added)

**Risks / tradeoffs**: When users first open the app with this change, Zustand detects stored version 0 < current version 1 and calls the migrate function. Since the function is an identity (`(persisted) => persisted as OutcomeState`), all existing outcomes are preserved unchanged. The only side effect is writing `version: 1` into localStorage. This is safe and idempotent.

**Rollback**: Remove `version` and `migrate` from the persist config. Users who have already received version 1 will have Zustand downgrade silently (stored version 1 > current version 0 is treated as "ahead of expected version" — Zustand returns the stored state unchanged in this case).

---

## [3] Test: verify `logOutcomeWithProgression` recovers from run-progression errors

**Summary**: Added a new test file `src/store/__tests__/outcomeStoreProgressionErrorRecovery.test.ts` with 3 tests that mock `evaluateRunProgression` to throw and assert safe behavior.

**Why it matters**: Guards the try/catch fix. Confirms that: (1) the function does not propagate the error to the caller, (2) the outcome is still persisted, and (3) no progression state is written when the engine throws before returning a decision.

**Files changed**: `src/store/__tests__/outcomeStoreProgressionErrorRecovery.test.ts` (new file, 112 lines)

**Risks / tradeoffs**: None. The test file uses `vi.mock` for module-level isolation and does not affect other test files.

---

# Overnight Changelog — 2026-06-13

## [1] Fix: `useActivePlan` stale date at midnight

**Summary**: Replaced the bare `format(new Date(), 'yyyy-MM-dd')` call in `useActivePlan` with the `useToday()` hook.

**Why it matters**: `useToday()` sets a `setTimeout` to fire at the exact millisecond of the next calendar midnight and updates the date string via `useState`. Without this, `useActivePlan` only recomputed `today` when one of its Zustand store dependencies changed. On a day when the user left the app open overnight without any store event, `todayResolved` and `upcoming` would still reference yesterday's date until the next user interaction.

**Before**: `const today = format(new Date(), 'yyyy-MM-dd')` — recomputed on every render but never reactively updated at midnight.
**After**: `const today = useToday()` — holds state in `useState`, auto-refreshes at midnight.

**Files changed**: `src/hooks/useActivePlan.ts` (2 lines changed)

**Risks / tradeoffs**: `useToday` uses `useState` + `useEffect`, so every component that calls `useActivePlan` now re-renders at midnight. This is the correct and expected behaviour — it is exactly what the rest of TodayPage already did via its own `useToday` call.

**Rollback**: revert the import and replace `useToday()` with `format(new Date(), 'yyyy-MM-dd')`.

---

## [2] Fix: ProgramVarsPanel NaN/Infinity display

**Summary**: Added a `Number.isFinite(value)` guard in the `ProgramVarsPanel` component that formats program variable values for display.

**Why it matters**: If a program variable holds NaN or Infinity (possible for vars written before the pass-55 `evaluateUpdates` guard was added), the old formatting path called `value.toFixed(2)` on NaN, which renders as the string `"NaN"`. Now non-finite values render as `"?"`, which is an honest sentinel that doesn't look like a number.

**Before**: `Number.isInteger(value) ? value : value.toFixed(2).replace(/\.?0+$/, '')`
**After**: `!Number.isFinite(value) ? '?' : Number.isInteger(value) ? value : value.toFixed(2).replace(/\.?0+$/, '')`

**Files changed**: `src/pages/TodayPage.tsx` (1 line changed)

**Risks / tradeoffs**: Zero — the guard fires only for NaN/Infinity, which are invalid program variable values.

**Rollback**: remove the `!Number.isFinite(value) ? '?' :` prefix.

---

## [3] Test: `isPlanExpired` returns false for pre-start weeks plan

**Summary**: Added a test case in the `isPlanExpired` / `weeks-based duration` describe block for the scenario where today < plan.startDate.

**Why it matters**: The weeks expiry logic computes `endDate = startDate + value*7` and returns `today >= endDate`. When today is before startDate it is always before endDate too — the function correctly returns false. The test pins this invariant so future changes to the comparison direction (e.g. accidentally flipping `<` to `>`) are caught immediately.

**Files changed**: `src/engine/__tests__/rotationEngine.test.ts` (+10 lines, 1 test)

**Risks / tradeoffs**: None — pure test addition.

**Rollback**: delete the added test case.

---

## [4] Feature: Plan logging-adherence bar on TodayPage

**Summary**: Surfaced `computeLoggedRate` on TodayPage as a thin horizontal progress bar below the 7-day activity strip. Shows "X% logged" with a sky-blue fill proportional to the rate.

**Why it matters**: The streak, 7-day count, and total-done stats on TodayPage are all about workout completion. None of them answer "what fraction of my plan days have I actually recorded?" — a user who sometimes forgets to log gets no signal about their logging gaps other than the stall nudge (which is scoped to the last 7 days). The logged rate bar shows the full-plan picture and is a gentle motivational reminder to keep the log current.

`computeLoggedRate` was added in pass 54 and is already well-tested. HistoryPage already shows it per-plan. This commit makes it accessible on the daily-use screen where it provides immediate feedback.

**Visibility rules** (inherited from `computeLoggedRate`):
- Returns `null` when the plan started today or in the future → bar is hidden
- Returns 0–100 integer → bar always shown when the plan has past days

**Files changed**: `src/pages/TodayPage.tsx` (+1 import, +5 computation lines, +14 JSX lines)

**Risks / tradeoffs**: Purely additive JSX; no data model or store changes. The element adds one thin row to the TodayPage layout and may feel slightly redundant for users who never forget to log (they'd see 100% perpetually). No action or dismissal needed — it is a read-only indicator.

**Rollback**: remove the `loggedRate` computation line and the JSX block between the WeeklyActivityStrip and the unlogged-days nudge.

---

# Overnight Changelog — 2026-06-12

## [1] Fix: NaN/Infinity guard in `evaluateUpdates` (`expressionEval.ts`)

**Summary**: Added an `isFinite` guard after each arithmetic operation in `evaluateUpdates`. If the result of an assignment is NaN or Infinity, the previous value of the variable is kept instead.

**Why it matters**: YAML progression rules are user-authored strings. If a program variable in `programStore` contains a corrupted value (e.g. NaN persisted in localStorage from an earlier bad write), an expression like `bench = squat * 0.85` would propagate the NaN to `bench`, corrupting a previously clean variable. With the guard, each assignment is validated before being stored, so NaN/Infinity cannot spread across variables through derived expressions.

**Before**: `result[varName] = cur + rhsVal` — no validation, NaN/Infinity silently persisted.
**After**: `result[varName] = isFinite(next) ? next : cur` — falls back to previous value on bad result.

**Files changed**: `src/lib/expressionEval.ts` (5 lines changed), `src/lib/__tests__/expressionEval.test.ts` (+4 tests)

**Risks / tradeoffs**: The fallback-to-previous behaviour means a YAML rule with a NaN input is a silent no-op rather than a crashing error. This is the safer choice for a user-facing app where YAML errors should degrade gracefully. The downside is that silent no-ops can hide YAML bugs; a future improvement could surface a warning.

**Rollback**: `git revert <commit>`

---

## [2] Fix: `updateEntryDate` now deduplicates on target-date collision

**Summary**: When moving a rotation entry to a new date, if another entry for the same `(planId, calendarDate)` pair already exists, it is now removed. The moved entry wins, consistent with `addEntry` semantics.

**Why it matters**: Before this fix, `updateEntryDate` was a raw field swap with no deduplication. If a caller moved an entry to a date that already had an entry for the same plan, the store would end up with two entries sharing the same `(planId, calendarDate)`. The rotation engine resolves this by newest-`createdAt`, so the output was deterministic, but the store held redundant data that could cause subtle bugs if the `createdAt` values happened to be identical. The fix eliminates the redundant data at the source.

**Before**: `entries.map(e => e.id === id ? { ...e, calendarDate: newDate } : e)` — no dedup.
**After**: Move the entry, then filter out any other entry at `(planId, newDate)`.

**Existing callers** (TodayPage, CalendarPage): both already called `removeEntry(planId, newDate)` before `updateEntryDate`, so their behaviour is unchanged. The fix just makes the store itself correct by construction.

**Files changed**: `src/store/historyStore.ts` (7 lines), `src/store/__tests__/historyStore.test.ts` (test updated)

**Risks / tradeoffs**: Zero risk. Callers that already pre-deleted see no difference. Callers that forgot are now safe.

**Rollback**: `git revert <commit>`

---

## [3] Feature: HistoryPage `filterPlanId` persists across navigations (sessionStorage)

**Summary**: The plan filter dropdown in HistoryPage now saves its selection to `sessionStorage` under key `wpt_history_filterPlanId`. On page re-mount, it restores the saved value if the stored plan still exists in the current `plans` map; otherwise falls back to the default (active plan with history, or 'all').

**Why it matters**: Before this fix, navigating away from HistoryPage and back always reset the filter to the active plan. Users reviewing history for an archived plan had to re-select it on every navigation, which was friction for the most common history-review pattern (switching to Calendar or Today and coming back).

**Implementation**: `const SESSION_FILTER_KEY = 'wpt_history_filterPlanId'` module-level constant. `useState` lazy initializer reads from `sessionStorage` and validates the stored ID against `plans`. The setter wrapper writes to `sessionStorage` before calling `setFilterPlanIdRaw`. No `useEffect` or extra state — the persistence is piggy-backed on the existing setter.

**Files changed**: `src/pages/HistoryPage.tsx` (+9 lines net; 1 line replaced with 8)

**Risks / tradeoffs**:
- `sessionStorage` is cleared when the browser tab is closed — the filter resets on a fresh session, which is the expected behavior.
- If a planId stored in sessionStorage no longer exists (plan was deleted), the fallback logic correctly returns the default.
- No new dependencies.

**Rollback**: `git revert <commit>`

---

# Overnight Changelog — 2026-06-11

## [1] Fix: `WorkoutDayCard` safe access for empty `planDay.slots`

**Summary**: Changed `WORKOUT_META[planDay.slots[0].type]` to `WORKOUT_META[planDay.slots[0]?.type ?? 'rest']`.

**Why it matters**: If `planDay.slots` is empty — reachable via a YAML-imported plan with no days, or when the rotation engine's 0-day guard generates a synthetic rest day — the original code throws `TypeError: Cannot read properties of undefined (reading 'type')`, blanking the screen. The fix falls back to the `'rest'` meta entry, which has safe defaults for all fields.

**Files changed**: `src/components/workout/WorkoutDayCard.tsx` (1 line)

**Risks / tradeoffs**: Zero behavioral change for all plans with at least one slot (all normal plans). Only the pending card's left-border color (`meta.borderColor`) is affected by this line, and only when `isPending` is true. Falling back to `'rest'` styling is a safe visual choice for an edge case that doesn't exist through normal plan creation.

**Rollback**: `git revert ce442de`

---

## [2] Feature: `computeLoggedRate` in historyStats + 11 tests

**Summary**: Added a new pure function `computeLoggedRate(planId, entries, planStartDate, today)` that returns the percentage of past plan days (from `planStartDate` up to, but not including, `today`) that have at least one history entry logged (any action: complete, skip, or day_off). Returns `null` when the plan started today or in the future.

**Why it matters**: The existing stats (`totalCompleted`, streak, last7/30) only count completions or consecutive days. They don't answer "how consistently am I recording activity?" — a user who logs every day but skips half their workouts has a high `totalCompleted` relative to their streak, but no single metric shows the underlying adherence pattern. `computeLoggedRate` fills this gap: it measures logging consistency, not workout success.

**Semantic distinction from existing stats**:
- `totalCompleted` — only counts `complete` actions
- `currentStreak` — requires consecutive days
- `computeLoggedRate` — counts any logged day (including skips and day-offs)

**Files changed**: `src/lib/historyStats.ts` (+32 lines), `src/lib/__tests__/historyStats.test.ts` (+80 lines, 11 new tests)

**Risks / tradeoffs**: Purely additive. No existing code changes. The function is exported but not yet wired to critical paths; removing it later would only require deleting the function and its tests.

**Rollback**: `git revert f468ab8`

---

## [3] Feature: Logged-rate progress bar in HistoryPage stats

**Summary**: Added a thin horizontal progress bar and `N% logged` label below the four-tile stats grid in HistoryPage. Only shown when viewing a single plan (hidden for "All plans" view) and only when the plan has past days to measure (i.e., `computeLoggedRate` returns non-null).

**Why it matters**: Users tracking a plan can now see at a glance how consistently they've been logging. A plan in week 8 with 45% logged signals under-recording; 95% signals strong tracking hygiene. The bar complements but doesn't replace the streak and 7-day counts.

**Implementation**: `loggedRate` is computed via `useMemo` keyed on `filterPlanId`, `filteredEntries`, `plans`, and `today`. The bar is a flex row with an inline `width: N%` style — no new dependencies.

**Files changed**: `src/pages/HistoryPage.tsx` (+23 lines)

**Risks / tradeoffs**:
- Minor visual addition below the stats grid; does not change the grid layout.
- If `filterPlanId === 'all'`, `loggedRate` is `null` and nothing renders — no regressions for users who view all plans.
- For plans that started today, `loggedRate` is `null` — the bar is hidden, avoiding a misleading 0%.

**Rollback**: `git revert c434ce7`
