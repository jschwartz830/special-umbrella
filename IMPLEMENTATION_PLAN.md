# Implementation Plan — Overnight Audit

Generated: 2026-04-16

---

## Architecture Summary

**Stack**: React 18 + TypeScript + Zustand, built with Vite. Deployed to GitHub Pages as a PWA. All state persisted to localStorage via Zustand persist middleware.

**Three localStorage stores**:
- `wpt_plans` — plan definitions (days, slots, metadata, duration)
- `wpt_history` — logged workout entries + rotation override entries
- `wpt_outcomes` — rich outcome records + run progression states

**Core rotation engine** (`src/engine/rotationEngine.ts`) is a pure functional module. It takes plans + history + overrides as inputs and deterministically computes:
- The current rotation pointer for any date
- Today's resolved workout
- Upcoming workouts
- Calendar grid resolved days

**Run progression** (`src/modules/run-adaptation/`) is a separate pure module that evaluates and applies adaptive distance targets based on completion outcomes and perceived effort.

**Hook layer** (`src/hooks/`) derives reactive state from stores for use in pages.

---

## Current Product Capabilities

- Create / edit / duplicate / archive / delete workout plans
- Plans have N days in a rotation, each day with 1–2 workout slots
- Activate a plan at a chosen start date + rotation offset
- Log workouts as: complete, skip, day off — from Today page or Calendar (retroactive)
- Rich outcome logging: completion state, effort, run actuals (distance/time/pace), notes
- Run adaptation: distance progression with progress/hold/regress evaluation
- Override rotation: advance, go back, jump to specific day
- Double-day feature: do two rotation days on one calendar day
- Calendar month view with workout status indicators
- History log with edit / delete capability
- Difficulty spacing warning (back-to-back hard workouts)

---

## What Already Seems Strong

1. **Rotation engine** is well-designed: pure functions, overrides are processed cleanly before reading plan day, symmetric modulo handles go_back correctly.
2. **Run progression** is properly separated, fully testable, and has good test coverage (26 tests).
3. **Override semantics** (advance/go_back/jump/swap_slot) are well-documented and consistently applied.
4. **Retroactive logging** (calendar) correctly clears stale jump overrides before writing.
5. **Type system** is comprehensive and well-organized. Re-exports from types/index.ts are clean.
6. **backward compatibility** — new fields (runConfig, difficulty, tags) are optional on WorkoutSlot.
7. **Empty states** exist for all major pages.
8. **addEntry deduplication** — correctly replaces existing entry for same (planId, calendarDate).

---

## Key Risks / Weak Points Found

### CRITICAL BUGS

#### 1. Skip button creates override instead of history entry (TodayPage.tsx:112)
`handleSkip()` calls `actions.advance()` (logOverride 'advance') instead of `actions.skip(planDayIndex)` (logAction 'skip'). This means:
- Skipped days appear as `past_unlogged` on calendar (not skipped)
- No entry in history log
- Rotation advances via override instead of history entry
- If the override is cleared for any reason, rotation breaks

#### 2. updateEntryAction loses planDayIndex when toggling from day_off (historyStore.ts:111)
When a user changes a logged day_off to complete or skip in the history editor, the existing planDayIndex is undefined (set to undefined when logged as day_off). The update function preserves this undefined value, so the entry incorrectly shows planDayIndex=undefined for a complete/skip action.

### SIGNIFICANT ISSUES

#### 3. getFutureProjection inconsistent with getUpcomingDays (calendarProjection.ts:95)
`getFutureProjection` doesn't apply today's overrides before projecting forward, and doesn't advance for day_off entries. The function appears to be dead code (not called from any active page), but the inconsistency is confusing.

#### 4. Notes duplication across two stores
`WorkoutOutcome.notes` and `HistoryEntry.notes` both store the same note text when completing a workout. Editing notes in the history modal only updates `HistoryEntry.notes` — the outcome notes stay stale. Low impact since both are displayed from different contexts, but creates divergence.

#### 5. isActive=true dead code in OutcomeModal (OutcomeModal.tsx:99)
`const isActive = true` is declared but the comment explains why — the variable is a dead branch. Confusing to future readers.

### UX GAPS

#### 6. No unsaved changes warning in PlanBuilderPage
Users can navigate away (back button, bottom nav) without saving and lose all edits without any warning.

#### 7. No plan expiry / completion indicator
`isPlanExpired()` exists in the engine but isn't called from anywhere in the UI. Users have no visual indication their plan is expired.

#### 8. History page shows all entries from all plans without clear plan attribution
The plan name is shown inline but plans are not grouped or filtered. With multiple plans this becomes hard to scan.

#### 9. Double-day doesn't capture the second workout's outcome
When using double-day mode, only one OutcomeModal is shown (for today's workout). The bonus workout's outcome is never logged. The rotation advances correctly but outcomes are incomplete.

#### 10. Override menu always visible (even when unneeded)
The Override button row appears even when a workout is already completed for the day. Overrides applied after completion don't have a meaningful effect.

### TEST COVERAGE GAPS

- Rotation engine (rotationEngine.ts) has zero tests
- historyStore, planStore, outcomeStore have zero tests
- Page components have zero tests
- The only tested module is run-adaptation (26 tests) which is well-covered

---

## Prioritized Action Plan

### Phase 1 — Critical bug fixes (highest confidence, highest impact)

1. **Fix Skip button** (TodayPage.tsx) → change `actions.advance()` to `actions.skip(planDayIndex)`
2. **Fix updateEntryAction** (historyStore.ts) → restore planDayIndex when changing away from day_off
3. **Fix getFutureProjection** (calendarProjection.ts) → align with getUpcomingDays behavior; mark as dead code if unused

### Phase 2 — Code quality

4. **Remove `isActive=true` dead code** (OutcomeModal.tsx)
5. **Document or remove getFutureProjection** (unused but potentially misleading)

### Phase 3 — Tests

6. **Add rotation engine tests** — computeCurrentDayIndex with overrides, getUpcomingDays, isPlanExpired edge cases
7. **Add historyStore behavior tests** — updateEntryAction planDayIndex restoration

### Phase 4 — UX improvements

8. **Unsaved changes guard** in PlanBuilderPage
9. **Plan expiry indicator** on TodayPage and PlansPage
10. **History page enhancements** — clearer plan attribution, filter by plan

### Phase 5 — Documentation

11. Create CHANGELOG_OVERNIGHT.md (per change)
12. Create REVIEW_NOTES.md (summary for review)

---

## Rationale for Sequencing

Bug fixes come first because they affect correctness of the core user flow (skip → shows unlogged → confusing rotation behavior). Tests come before UX improvements so regressions are caught. UX improvements are lower risk and can be reviewed/reverted independently. Documentation comes last so it accurately reflects completed work.
