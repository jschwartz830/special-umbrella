# Overnight Changelog — Pass 56 (2026-06-14)

## Change 1 — Fix: Remove nanoid relay from rotationEngine

**Commit:** `7234d17`
**Files changed:** `src/engine/rotationEngine.ts`, `src/engine/programParser.ts`

### What changed

`rotationEngine.ts` had a bare re-export of `nanoid` from `../lib/utils`. `programParser.ts` imported `nanoid` via that relay. Both lines were removed/updated so `programParser.ts` imports directly from `'../lib/utils'`.

**Why it matters:** The re-export created a false coupling: a plan parser depended on the rotation engine purely to get a utility function. Removing it makes both files' dependency graphs accurate and eliminates a confusing indirect import.

**Risk:** Zero behaviour change. Verified by running the full test suite (844 → 844 pass).

**Rollback:** `git revert 7234d17`

---

## Change 2 — Test: Add currentStreak future-entry guard tests

**Commit:** `e08fee3`
**Files changed:** `src/lib/__tests__/historyStats.test.ts`

Two new unit tests added to the `computeHistoryStats → currentStreak` section:

1. **Future-dated entries don't inflate streak** — Documents that the backward walk from `today` never reaches future entries, even if they exist in the data.
2. **Extra on same day as skip counts the day once** — Verifies Set-based deduplication prevents double-counting when a rotation skip and an extra both land on the same date.

**Why it matters:** These tests nail down subtle invariants the code already satisfies but had no explicit regression guards for.

**Risk:** Test-only change; no source code modified.

**Rollback:** `git revert e08fee3`

---

## Change 3 — Feature: computeActivityCalendar utility

**Commit:** `e1395b0`
**Files changed:** `src/lib/historyStats.ts`, `src/lib/__tests__/historyStats.test.ts`

Added three exported symbols:

- **`ActivityLevel`** — union type `0 | 1 | 2 | 3`
- **`ActivityCalendarDay`** — shape `{ date, level, hasExtra, action }`
- **`computeActivityCalendar(entries, extras, fromDate, toDate, planId?)`** — pure function mapping a date range to one `ActivityCalendarDay` per day

| Level | Meaning |
|-------|---------|
| 0 | No activity |
| 1 | Skip or day_off only |
| 2 | Rotation complete (no extra) OR extra-only day |
| 3 | Rotation complete + at least one extra ("double-day") |

Added private helper `actionRank` for deduplication priority when multiple rotation entries exist for one date: `complete(2) > skip(1) > day_off(0)`.

Added **15 unit tests** covering: empty range, all-zero days, each level individually, priority deduplication, planId scoping, date-range boundary exclusion, single-day range, and a mixed-week integration case.

**Why it matters:** No existing utility produced per-day activity density across a calendar range. This is a clean building block for a HistoryPage heatmap/contribution graph. Purely additive — reads existing store data, not wired to any page yet.

**Risk:** Additive only. Existing exports unchanged.

**Rollback:** `git revert e1395b0`

---

## Test baseline

| Moment | Tests |
|--------|-------|
| On entry (from pass 55) | 844 pass, 0 fail |
| After change 1 (nanoid fix) | 844 pass, 0 fail |
| After change 2 (streak tests) | 846 pass, 0 fail |
| After change 3 (activity calendar) | 860 pass, 0 fail |

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
