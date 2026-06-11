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
