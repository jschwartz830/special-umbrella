# Implementation Plan — Overnight Audit Run
_Date: 2026-09-17_

## Architecture Summary

**Stack:** React 18 + TypeScript + Zustand (persisted via localStorage) + Vite + Vitest. Deployed to GitHub Pages as a PWA.

**Key layers:**
- **Engine layer** (`src/engine/`) — pure functions. `rotationEngine.ts` owns the rotation pointer and scheduling logic; `calendarProjection.ts` projects engine output onto a calendar grid.
- **Store layer** (`src/store/`) — eight Zustand stores, each persisted independently. Primary: `historyStore` (entries + overrides), `outcomeStore` (workout results keyed by instanceId), `planStore`, `settingsStore`.
- **Library layer** (`src/lib/`) — stateless helpers: `historyStats` (analytics), `sessionSummary` (last-session hint), `expressionEval` (YAML load/progression expressions), `csv` (import/export), `previousSetsHelper`, `storeSync` (Supabase cloud sync).
- **Module layer** (`src/modules/`) — domain logic: `workout-outcomes/progression`, `run-adaptation/engine`, `recommendation/explanation`.
- **Page layer** (`src/pages/`) — React components. `TodayPage` is the primary interactive surface (~1175 lines).

**Data model:** Plans contain PlanDays with slots. HistoryEntries record actions (complete/skip/day_off) per calendar date. OverrideEntries shift the rotation pointer. WorkoutOutcomes (keyed by workoutInstanceId = `planId_YYYY-MM-DD[_extra_...]`) hold detailed metrics.

## What Is Strong

- **Engine purity and test coverage** — `rotationEngine.ts` is a pure function with 65 regression-named tests. Very hard to regress silently.
- **historyStats coverage** — 283 tests, all 23 exported functions covered with edge-case depth.
- **Regression test culture** — Many tests include comments naming the specific bug they prevent. High signal tests, not just coverage.
- **Zustand + localStorage simplicity** — No server round-trips for core app state. Works offline.
- **TypeScript typing** — Types are generally well-named and used consistently.

## Key Issues / Risks

### Bugs (confirmed)
1. **CalendarPage day-header misalignment** (CalendarPage.tsx:45) — DAYS header was hardcoded Sun-first; grid cells shift with weekStartsOn=1. Headers and cells misaligned for Monday-first users. **→ FIXED**
2. **No 404 catch-all route** (App.tsx) — Unknown URLs render a blank shell with no redirect. **→ FIXED**
3. **expressionEval `lbs` regex** (expressionEval.ts:392) — `/lb$/i` didn't strip the plural form; `135lbs` passed through and `0.75 * squatlbs` would silently look up wrong variable. **→ FIXED**
4. **Pace functions divide by zero** (types.ts:140,148) — Zero distance produced Infinity, which could corrupt stored outcome data if stored by a future caller. **→ FIXED**
5. **CSV import: malformed planStartDate silently defaults** (csv.ts:354) — Invalid date strings silently defaulted to today with no warning. **→ FIXED**
6. **CalendarPage selectedIdx stale on modal re-open** (CalendarPage.tsx:604) — `useState` initializer only runs once; if modal opens for same date with different planDayIndex, selectedIdx is stale. **→ DOCUMENTED ONLY** (requires understanding the full modal lifecycle)
7. **removeRetroJumpForDate UTC date slice** (historyStore.ts:191) — Uses `.slice(0,10)` on appliedAt assuming local-time format, but live overrides use UTC ISO. Can mismatch near midnight in UTC-negative zones. **→ DOCUMENTED ONLY** (timezone edge case, very hard to trigger)
8. **Rotation advanced before outcome confirmed in TodayPage** (TodayPage.tsx:619–621) — actions.advance() fires on tap, before OutcomeModal confirmed. **→ DOCUMENTED ONLY** (product decision; Undo exists as recovery)

### Performance
9. **removeLastOverrideByType O(n log n) sort** (historyStore.ts:296) — Sort to find max; reduce is O(n). **→ FIXED**
10. **clearPlanOutcomes parseWorkoutInstanceId per key** (outcomeStore.ts:218) — Called for every outcome key; prefix check suffices. **→ FIXED**
11. **applyOverridesForDate O(dates × overrides)** (rotationEngine.ts:30) — `format(new Date(ov.appliedAt), 'yyyy-MM-dd')` called inside double loop. For a full-year view with 50 overrides: ~18,000 Date constructions per render. **→ DOCUMENTED ONLY** (optimization, not bug)

### Code Quality
12. **calendarProjection dead code + leaky re-export** (calendarProjection.ts:91,97) — Unreachable partial-week flush; `mod` re-exported with no consumers. **→ FIXED**
13. **progression.ts unreachable fallback** (progression.ts:101) — `?? 'single'` on a field already checked as non-null. **→ DOCUMENTED ONLY** (cosmetic)
14. **canDayOff = true dead variable** (CalendarPage.tsx:597) — Always-true; condition simplifies to `!hasEntry`. **→ DOCUMENTED ONLY** (future-proofing comment suggests it was intentional)
15. **Migration types unsound** (historyStore.ts:105, outcomeStore.ts:88) — Migrate returns raw data cast to full store type including methods. **→ DOCUMENTED ONLY** (works at runtime, TypeScript mislead)
16. **storeSync beforeunload async data loss** (storeSync.ts:165) — pushStore is async; browser won't complete the request. Should use keepalive fetch. **→ DOCUMENTED ONLY** (architectural change)

## Prioritized Plan

| Priority | Change | Risk | Status |
|---|---|---|---|
| P0 | Calendar day-header alignment bug | Low | Done |
| P0 | 404 catch-all route | Low | Done |
| P1 | expressionEval lbs regex | Low | Done |
| P1 | Pace functions divide-by-zero guard | Low | Done |
| P1 | CSV planStartDate warning | Low | Done |
| P1 | calendarProjection dead code cleanup | Low | Done |
| P1 | removeLastOverrideByType O(n) reduce | Low | Done |
| P1 | clearPlanOutcomes prefix check | Low | Done |
| P2 | CalendarPage selectedIdx stale | Medium | Documented |
| P2 | removeRetroJumpForDate UTC date | Medium | Documented |
| P3 | applyOverridesForDate pre-compute | Low-medium | Documented |
| P3 | storeSync keepalive | Medium-high | Documented |
| P3 | progression.ts unreachable fallback | Low | Documented |
| P3 | TodayPage rotation advance timing | High (product) | Documented |
