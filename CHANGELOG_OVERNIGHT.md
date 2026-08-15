# Overnight Changelog

---

## 2026-08-15

### Change 1 — `fix(hooks): re-check date on visibilitychange to handle device wake from sleep`

**Summary:** Added a `visibilitychange` event listener to `useToday` that calls `tick()` whenever the page becomes visible. The existing `setTimeout`-based midnight refresh remains, but was insufficient on its own: when a device sleeps and the OS pauses or delays the timer, the app would display "yesterday" until something forced a React re-render. The visibility listener catches the device-wake edge case immediately.

**Why it matters:** TodayPage is a time-gated view — it resolves workouts by the current local date. Showing the wrong date (from a prior day) would display yesterday's workout as "today" and block the user from logging. This is a silent UX failure that only appears after leaving the device asleep past midnight.

**Files changed:**
- `src/hooks/useToday.ts` — added `handleVisibility` function and `visibilitychange` listener within the same `useEffect`; cleanup removes both the timer and the listener

**Design decisions:**
- The listener is registered inside the same `useEffect` as the `setTimeout` so a single cleanup removes both. No new `useEffect` needed.
- The `[today]` dependency ensures both the timer and the listener are re-registered each time the date advances, so no stale closure issues.

**Risks / tradeoffs:**
- `visibilitychange` fires on every tab-switch/app-background even when the date hasn't changed. The `setToday` call is stable-by-value (React bails out when the new value equals the current), so the cost is just one `format(new Date(), 'yyyy-MM-dd')` call per visibility event — negligible.

**Rollback:** Revert the `fix(hooks)` commit. The hook reverts to `setTimeout`-only behavior with no other changes.

---

### Change 2 — `refactor(progression): simplify allSetsHitTarget to single parameter`

**Summary:** Simplified the private `allSetsHitTarget` function in `progression.ts` from two parameters (`allSets`, `completedSets`) to one (`sets`). The original split ran the `completed` flag check over `allSets` and the `targetReps` check only over the pre-filtered `completedSets`. Since `completedSets` was defined as `allSets.filter(s => s.completed)`, both checks could be expressed as a single `sets.every(s => { if (!s.completed) return false; ... })`. All three call sites updated.

**Why it matters:** The two-parameter signature was confusing — both parameters referred to the same logical set at different filter stages. A reader might assume the parameters could differ independently (e.g. pass different arrays), but in practice they never did. The single-parameter version is easier to read, easier to test, and harder to misuse.

**Files changed:**
- `src/modules/workout-outcomes/progression.ts` — function signature reduced to 1 param, body rewritten as a single `every()` call, three call sites updated

**Risks / tradeoffs:** No behaviour change. All three call sites previously passed `(allSets, completedSets)` where `completedSets = allSets.filter(s => s.completed)`. The unified `every` predicate is semantically equivalent.

**Rollback:** Revert the `refactor(progression)` commit.

---

### Change 3 — `fix(historyStats): deduplicate rotation entries in totalLogged and totalCompleted`

**Summary:** `computeHistoryStats` now collapses rotation `entries` to a `Set` keyed by `planId__calendarDate` before counting `totalLogged` and `totalCompleted`. Previously the function counted raw array length, relying on the store's write-time dedup invariant. That invariant holds under normal use but can be violated by `importEntries` on older persisted data. The fix makes the stats layer independently safe.

**Why it matters:** If `totalLogged` or `totalCompleted` were inflated by duplicate entries, the Plan Progress modal would show a completion rate > 100% and plan expiry logic could fire prematurely. Making the stats layer deduplicate defensively mirrors the pattern already used by `isPlanExpired` and `computePlanProgress`.

**Files changed:**
- `src/lib/historyStats.ts` — `totalLogged` and `totalCompleted` now use `Set`-based dedup

**Design decisions:**
- The key `planId__calendarDate` matches the existing convention used by `deduplicateByDate` in `historyStore.ts`.
- `extras` are intentionally not deduplicated: extra workouts allow multiple per day by design (e.g. morning run + afternoon weights), so counting them by array length is correct.

**Risks / tradeoffs:** Very low risk. The only observable change is that duplicate rotation entries (which shouldn't exist in healthy data) no longer inflate the count. Correct data produces identical output.

**Rollback:** Revert the `fix(historyStats)` commit.

---

## 2026-08-14

**Date:** 2026-08-14

---

## Change 1 — `feat(historyStats): add computeAverageWorkoutsPerWeek`

**Summary:** Added `computeAverageWorkoutsPerWeek(planId, entries, extras, planStartDate, today)` to `src/lib/historyStats.ts`. Returns the average number of active workout sessions per week since the plan started, rounded to one decimal place. Returns `null` when there are no active sessions or the plan hasn't started yet.

**Why it matters:** Average workouts/week is a universally understood training frequency metric missing from the stats layer. It gives users quick context on their training consistency and is safer than raw totals because it accounts for how long the plan has been running.

**Files changed:**
- `src/lib/historyStats.ts` — new exported function + doc comment
- `src/lib/__tests__/historyStats.test.ts` — 13 new tests (import line updated + new `describe` block)

**Design decisions:**
- Counts `complete` entries + extras; excludes `skip` and `day_off` (mirrors training-output semantics used by `findBestWeek`)
- Deduplicates completed dates by calendarDate, matching `isPlanExpired` / `computePlanProgress`
- Denominator is `max(1, daysElapsed / 7)` so a plan started today divides by 1 (not zero)
- Denominator uses fractional weeks so a 3-day-old plan with 3 workouts shows 7.0/week rather than 1.0/week

**Risks / tradeoffs:**
- Fractional denominator means early-plan average can look high (e.g. 7.0/week after 3 consecutive days). This is mathematically correct but may surprise users. The `null` guard for zero sessions avoids the worst case (Infinity).
- Could add a minimum-days threshold (e.g. return null for plans < 3 days old) if the high early values prove confusing in practice.

**Rollback:** Revert the `feat(historyStats)` commit. No existing code depends on this function.

---

## Change 2 — `feat(ui): surface avg workouts/week in Plan Progress modal`

**Summary:** Wired the new `computeAverageWorkoutsPerWeek` into `TodayPage` and passed it as a new `avgWorkoutsPerWeek` prop to `TodayPlanProgressModal`. The modal renders a new row "Avg / week  2.5×" between "Completion rate" and "Consecutive skips" when the value is non-null.

**Why it matters:** The Plan Progress modal is where users check their training stats. Adding average frequency gives a quick "am I training enough?" signal alongside the existing per-workout completion rate.

**Files changed:**
- `src/pages/TodayPage.tsx` — import addition, one `const avgWorkoutsPerWeek = ...` line, prop added to JSX
- `src/components/today/TodayPlanProgressModal.tsx` — new optional prop in interface, new row in JSX

**Design decisions:**
- Row is hidden when `avgWorkoutsPerWeek === null`, so brand-new plans and skip-only plans show no spurious data
- Label is "Avg / week" for brevity; value displayed as `2.5×` (the `×` reads naturally as "times per week")

**Risks / tradeoffs:**
- Adds one row to the modal, which may feel crowded on small screens. Consider collapsing it behind "show more" if the modal becomes too tall.
- `avgWorkoutsPerWeek` is computed at render time in TodayPage (not memoized). Since it involves a Set construction and array filter, it runs on every render. For a plan with thousands of entries, this could be non-trivial — wrapping in `useMemo` is a low-effort follow-up.

**Rollback:** Revert the `feat(ui)` commit.

---

## Change 3 — `fix(expressionEval): warn in dev when parsePrimary receives unexpected token`

**Summary:** Added a `console.warn` in development mode when `parsePrimary()` encounters an unexpected token (e.g. a bare comma or unmatched rparen in expression position). Previously these cases were silently ignored and returned 0.

**Why it matters:** YAML progression rule authors have no feedback when they write malformed expressions like `squat += (5, 3)`. The silent 0 return meant the variable appeared to update correctly but was actually set to 0 — a subtle data corruption. Dev-mode warnings make authoring errors visible immediately.

**Files changed:**
- `src/lib/expressionEval.ts` — 6 lines added after the final `parsePrimary` fallback

**Risks / tradeoffs:**
- Only fires in development (`import.meta.env.DEV`). Production behaviour is unchanged — no throws, no console noise.
- The warning fires for structural syntax errors (wrong token in wrong place), not for unknown identifiers or unknown function names, which already have well-defined 0 semantics.

**Rollback:** Revert the `fix(expressionEval)` commit. One-file, six-line change.

---

## Change 4 — `docs(workoutInstanceId): document hex-alphabet safety assumption`

**Summary:** Updated the doc comment on `parseWorkoutInstanceId` to explicitly state that the function is safe only because nanoid planIds use a hex alphabet, and that the function must be revisited if the alphabet changes.

**Why it matters:** The function's correctness depends on an implicit invariant (hex IDs cannot contain date-like substrings). Without documentation, a future maintainer might change the ID generator without realising the impact on ID parsing.

**Files changed:**
- `src/lib/workoutInstanceId.ts` — doc comment expanded

**Risks / tradeoffs:** Documentation-only change. No runtime impact.

**Rollback:** Revert the `docs(workoutInstanceId)` commit.
