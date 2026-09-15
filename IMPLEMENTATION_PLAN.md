# Overnight Implementation Plan — 2026-09-15

## Architecture Summary

**Stack**: React 18 + TypeScript + Zustand (persisted via localStorage), Vite build, PWA via vite-plugin-pwa, GitHub Pages deploy. Optional cloud sync via Supabase.

**Data flow**:
- `planStore` — plan definitions (days, slots, duration)
- `historyStore` — rotation entries (complete/skip/day_off) + overrides (advance/go_back/jump/swap_slot) + extra (ad-hoc) entries
- `outcomeStore` — rich per-session data (sets, reps, distances, perceived effort) keyed by `workoutInstanceId`
- `exerciseHistoryStore` — denormalized per-exercise session records for fast PR detection
- `mobilityStore` — standalone daily mobility routine completions
- `programStore` — YAML-imported program variables (progression state)
- `settingsStore` — user preferences

**Core engine** (`rotationEngine.ts`): Pure functions that derive workout state from plan + history + overrides. `computeCurrentDayIndex` is the fundamental primitive — all display functions compose on top of it.

**Test infrastructure**: Vitest, 35 test files, 1371 tests, all green.

---

## What Appears Strong

1. **Rotation engine** — clean, pure, well-documented, with 95%+ test coverage. The override model is flexible and handles all edge cases (advance/go_back/jump/swap).
2. **Deduplication discipline** — every stats function handles duplicate entries consistently via a "newest createdAt wins" or Set-based dedup, protecting against CSV import artifacts and cloud-sync races.
3. **Migration pattern** — all stores have `migrateXxxState` functions that are exported and unit-tested, ensuring upgrade paths are safe.
4. **PR detection** — `buildPRFlagsMap` (O(N log N)) provides efficient all-time PR flags for list views, correctly handling same-day comparisons.
5. **Component decomposition** — `TodayPage.tsx` has been progressively split into subcomponents (`TodayBanners`, `TodayPendingCard`, `TodayCompletedSection`, `TodayHabitSummary`, etc.) reducing the rendering surface per component.
6. **Session summary** — `buildLastSessionSummary` handles weights, run, swim, and mobility in a unified function with good edge-case coverage.

---

## Key Issues / Risks

### Bugs

| # | Severity | Description |
|---|----------|-------------|
| 1 | Low | `computePersonalRecords` does not guard against 0-load/0-reps sessions, while `buildPRFlagsMap` does. A bodyweight-only session (load=0) can set a `maxLoadDate` of 0 lb in the PR table. |
| 2 | Medium | **Undo multiple-advance bug**: When a user does two sequential double-day advances in one session, the Undo button removes both extras but only calls `removeLastOverrideByType` once, leaving the rotation pointer one step ahead. |

### Code Smells

| # | Severity | Description |
|---|----------|-------------|
| 3 | Low | `TodayPage.tsx` is 1176 lines with 17 `useState` hooks. Functionally correct but hard to reason about. No immediate fix recommended (it has been improving with each subcomponent extraction). |
| 4 | Low | `computeCurrentStreakDates` has a different parameter order than `computePlanStreak` (`planId` is optional and after `today` in the former, first in the latter). No caller confusion yet but could cause a mispass. |
| 5 | Low | `estimateRunDurationMin` variable substitution uses a broad word-boundary regex that could accidentally match keywords in distance strings, though in practice YAML distance fields are numeric. |

### Missing Test Coverage

| # | Area | Gap |
|---|------|-----|
| 6 | `computePersonalRecords` | No tests for 0-load or 0-reps edge cases |
| 7 | Undo flow (TodayPage) | Multi-advance scenario not covered (component-level, hard to test) |
| 8 | `buildLastSessionSummary` | Mobility session summary path not comprehensively tested |

---

## Prioritized Plan

### Safe to Implement

1. **Fix `computePersonalRecords` 0-load guard** — 3-line change + 2 tests. Consistent with `buildPRFlagsMap`.
2. **Fix Undo multi-advance bug** — Change boolean to counter in TodayPage Undo handler. Narrow, 3-line change.
3. **Feature: "Last Week" Monday summary banner** — New `useLastWeekSummary` hook using existing `computeWeeklyBreakdown`. Dismissable banner in `TodayBanners`. Read-only, no state mutations.

### Recommendations Only (Not Implemented)

4. **Refactor TodayPage session state** — Extract double-day / bonus outcome state into a custom hook or sub-component. High value but medium risk due to the complexity of the flow.
5. **Align `computeCurrentStreakDates` parameter order** — Non-breaking: `planId` could become the first parameter after `today`. Requires updating all call sites. No current bug, so deferred.
6. **Add `isNaN` guard in `estimateRunDurationMin`** — The fallback to `parseFloat → NaN → skip` is correct but undocumented.

---

## Rationale for Sequencing

- Fix #1 (0-load guard) first: trivially safe, adds consistency, adds tests.
- Fix #2 (Undo multi-advance) second: narrow change to one code path, non-breaking.
- Feature #3 (weekly summary) last: all infrastructure already exists, making this a low-risk addition.
