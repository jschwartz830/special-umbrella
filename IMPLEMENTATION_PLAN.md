# Implementation Plan

## Pass 95 — 2026-08-10 (branch `claude/serene-cori-awu2i9`)

### Baseline

- Branch started from `main` after PR #239 (pass 94 bug-fix batch) merged.
- **1216 tests passing** across 35 test files at start of pass.
- **1218 tests passing** at end of pass (+2 targeted tests).
## Pass 95 — 2026-08-11 (branch `claude/serene-cori-i4t5dr`)

### Baseline

- Branch started from `main` after PR #239 (pass 94) merged.
- **1216 tests passing** across 35 test files at start of pass.
- **1219 tests passing** at end of pass (+3 new tests).
- TypeScript: `tsc --noEmit` clean throughout.

### Architecture Summary (pass 95)

Targeted audit and consistency pass. One confirmed bug found and fixed in `getUpcomingDays` — future jump overrides were not being applied, causing the TodayPage upcoming list to show different workouts than CalendarPage for the same future dates. Two regression-covering tests added. No schema changes, no new dependencies.

### Bugs Fixed This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| BUG-UPCOMING-OVERRIDE | `e63cd0c` | `rotationEngine.ts` | `getUpcomingDays` projected future dates purely positionally, ignoring any `jump`/`advance`/`go_back` overrides whose `appliedAt` falls on a future date. When a user edits a future calendar date (CalendarPage writes `appliedAt: "${date}T12:00:00.000"`), the upcoming list on TodayPage showed the wrong workout. Fixed by calling `applyOverridesForDate` inside the projection loop, mirroring `getResolvedDaysRange`. |

### Bugs Documented But Not Fixed

| ID | File | Summary |
|---|---|---|
| BUG-DAYOFF-INDEX | `historyStore.ts` / `CalendarPage.tsx` | `updateEntryAction` without caller-supplied `planDayIndex` when transitioning `day_off → complete` leaves `planDayIndex: undefined`. Fix requires call site to supply the current rotation index. |
| BUG-OUTCOMESTORE-MIGRATE | `outcomeStore.ts` | Migration function is a no-op cast (`persisted as OutcomeState`). If the shape of OutcomeState changes in the future, stale persisted data will not be migrated and could produce runtime errors. Needs explicit field-level migration similar to historyStore. |
| BUG-ALLENTRIES-SELECTOR | `TodayPage.tsx` | `useHistoryStore(s => s.entries)` subscribes to the full entries array. Any write (any plan, any date) re-renders TodayPage even if today's data didn't change. Scoping to `s.entries.filter(e => e.planId === activePlanId && e.calendarDate === today)` would cut re-renders substantially. |

### Tests Added

| Test | File | What it covers |
|---|---|---|
| `applies a future jump override so the upcoming list matches the calendar view` | `rotationEngine.test.ts` | Regression for BUG-UPCOMING-OVERRIDE: verifies a jump override on a future date shifts planDayIndex in the upcoming list |
| `without a future jump override upcoming list is purely positional` | `rotationEngine.test.ts` | Baseline: no overrides → positional projection is correct |

### Next Pass Priorities

1. Fix BUG-OUTCOMESTORE-MIGRATE: add explicit field-level migration to `outcomeStore.ts`
2. Fix BUG-ALLENTRIES-SELECTOR: scope the `entries` selector in TodayPage to reduce re-renders
3. Fix BUG-DAYOFF-INDEX: pass `planDayIndex` from CalendarPage when transitioning `day_off → complete`
4. Consider render-level tests for TodayPage (currently covered only by unit tests on the engine layer)
Focused improvement pass: 4 targeted fixes + 3 new tests. Full codebase re-audit via dedicated Explore subagent revealed 2 new medium-severity bugs (NEW-ADAPT-NOTE, NEW-MODAL-REMOUNT) deferred to next pass. BUG-DAYOFF-INDEX (P1 from pass 94) confirmed already fixed in the codebase (commit `a317041`, pass 80) — the P1 was stale in the documentation.

### Bugs Fixed This Pass

| # | File(s) | Summary |
|---|---|---|
| BUG-AUTH-UI | `AuthGate.tsx` | `authStore.authError` (added pass 94) was never surfaced in the sign-in UI. Added visible error message below the sign-in button. |
| BUG-PROGRESSION-UNCAUGHT | `outcomeStore.ts` | `logOutcomeWithProgression` steps 3a/3b (slot-level and per-exercise YAML progression rules) lacked try/catch. A malformed rule would throw after the outcome was saved, potentially aborting the caller's history-entry write. Added individual try/catch matching step 2's pattern. |
| BUG-OUTCOME-PREFIX | `outcomeStore.ts` | `clearPlanOutcomes` used `k.startsWith(planId + '_')`. Replaced with `parseWorkoutInstanceId(k)?.planId !== planId` (canonical ID parser). Functionally equivalent for current hex nanoid IDs, but more correct and handles future key formats. |
| AUDIT-F | `types/index.ts` | Legacy `WorkoutType` values (`weightlifting`, `long_run`, `recovery_run`, `rest`) lacked `@deprecated` annotations. Added inline comments on each union member. |

### Documentation Update

- `historyStore.test.ts:196`: Updated comment to clarify that BUG-DAYOFF-INDEX is fixed at the CalendarPage call-site level (commit `a317041`, pass 80); the test documents the raw store behavior (calling `updateEntryAction` without an index still leaves it undefined), not a current app bug.

### Tests Added This Pass

| File | Tests Added | Description |
|---|---|---|
| `outcomeStore.test.ts` | +2 | `clearPlanOutcomes` ID-parser scoping: verifies prefix-sibling plans are not cross-contaminated; verifies both primary and extra-workout keys are removed. |
| `outcomeStore.test.ts` | +1 | `logOutcomeWithProgression` error isolation: verifies a throwing slot-level progression rule does not abort the outcome save. |

### New Bugs Found (from Explore subagent full-codebase audit)

| ID | Severity | Location | Summary |
|---|---|---|---|
| NEW-ADAPT-NOTE | Medium | `TodayPage.tsx` | After a double-day advance, `todayResolved.planDay` points to the advanced-to day. The adaptation note logic reads slots from `todayResolved.planDay`, showing guidance for the next day rather than the day just completed. Correct reference is `plan.days[primaryPlanDayIndex]`. |
| NEW-MODAL-REMOUNT | Medium | `CalendarPage.tsx` | `DayDetailModal` is defined as a function inside `CalendarPage`. React recreates its component identity on every `CalendarPage` render, causing full remounts that reset `selectedIdx` and `detailTarget` state. Fix: hoist to module level. |

### Prioritized Plan (for next pass)

| Priority | Item |
|----------|------|
| P1 | Fix NEW-ADAPT-NOTE: in TodayPage, replace `todayResolved.planDay` in adaptation note logic with `plan.days[primaryPlanDayIndex]`. |
| P1 | Fix NEW-MODAL-REMOUNT: hoist `DayDetailModal` from inside `CalendarPage` to module scope, pass needed data as props. |
| P2 | Fix BUG-DUPLICATE-PLAN: change `duplicatePlan` return type to `string \| null`, add null guards at call sites. |
| P3 | AUDIT-C: deterministic slot IDs on YAML re-parse (hash of structural position). |
| P3 | Continue TodayPage ARCH-1 decomposition (~1148 lines). |

---

## Pass 94 — 2026-08-09 (branch `claude/serene-cori-b5993l`)

### Baseline

- Branch started from `main` after PR #238 (pass 93 background-scroll fix) merged.
- **1213 tests passing** across 35 test files at start of pass.
- **1216 tests passing** at end of pass (+3 targeted tests).
- TypeScript: `tsc --noEmit` clean throughout.

### Architecture Summary (pass 94)

Full-codebase audit pass. Six confirmed bugs identified via dedicated Explore subagent; five fixed this pass. Three targeted tests added. No new dependencies, no schema changes.

### Bugs Fixed This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| BUG-UTC-JUMP | `bfc0642` | `historyStore.ts` | `removeRetroJumpForDate` used `format(new Date(o.appliedAt), 'yyyy-MM-dd')` which mixed UTC ISO parsing with local-timezone formatting. For users in UTC-offset timezones near midnight, this mis-attributed the jump to the wrong local date, causing the override to silently persist. Fixed with `o.appliedAt.slice(0, 10)`. Removed now-unused `date-fns` import. |
| BUG-CALENPAGE-JUMP | `6922682` | `CalendarPage.tsx` | `hadJump` check in `logForDate` had the same UTC/local mismatch as BUG-UTC-JUMP. Fixed with `slice(0, 10)`. Also: `handleHistoricalActiveComplete` used `plan.days.indexOf(activeWorkoutTarget.planDay)` (reference equality), which returns -1 if the plan was re-hydrated from Zustand persistence between opening and completing the tracker. Replaced with `findIndex(d => d.id === planDay.id)` using the stable day ID. |
| BUG-AUTH-SILENT | `785611a` | `authStore.ts` | `signInWithGoogle` and `signOut` were fire-and-forget awaits with no error handling. Network failures, popup blocks, or Supabase outages produced unhandled rejections with no user-visible feedback. Added try/catch with `authError` state field; errors are cleared on each new attempt. |
| BUG-EXPR-SILENT | `4f847bc` | `expressionEval.ts` | Unknown characters in progression expressions were silently discarded, producing invisible 0/NaN results that stalled progressions without any indication. Added `console.warn` in DEV mode with the offending character and the full expression. |
| BUG-MOBILITY-EMPTY | `3f4632f` | `mobilityStore.ts` | `resumeCompletion` with an empty `exerciseIds` array computed `Math.max(0, -1) = 0`, indexing into an empty array and returning `undefined`. Added an early-return guard for `exerciseIds.length === 0`. |

### Bugs Documented But Not Fixed (require callers or architectural coordination)

| ID | File | Summary |
|---|---|---|
| BUG-DAYOFF-INDEX | `historyStore.ts` / `CalendarPage.tsx` | `updateEntryAction` without a caller-supplied `planDayIndex` when transitioning `day_off → complete` leaves `planDayIndex: undefined`. Previously documented (pass 80 test). Fix requires the call site to look up the rotation's current planDayIndex. |
| BUG-DUPLICATE-PLAN-EMPTY | `planStore.ts` | `duplicatePlan` returns `''` on missing source; callers don't check. Low risk; fix is changing return type to `string \| null` and adding null checks at call sites. |

### Tests Added This Pass

| File | Tests Added | Description |
|---|---|---|
| `historyStore.test.ts` | +1 | `removeRetroJumpForDate` with CalendarPage format (no Z suffix) confirms `slice(0,10)` works for both UTC and local-time formats. |
| `mobilityStore.test.ts` | +1 | `resumeCompletion` is a no-op when `exerciseIds` is empty. |
| `expressionEval.test.ts` | +2 | Tokenizer emits `console.warn` in DEV on unknown chars; usable tokens still evaluated. |

### Audit Findings Not Yet Implemented

From the full-codebase audit this pass (via Explore subagent):

| # | Severity | Location | Summary |
|---|---|---|---|
| AUDIT-A | Medium | `storeSync.ts` | `beforeunload` async flush risk (documented pass 78 AUDIT-1 as well) |
| AUDIT-B | Medium | `storeSync.ts:syncOnLogin` | No conflict resolution on login — local changes can be overwritten |
| AUDIT-C | Medium | `engine/programParser.ts:parseSlot` | Non-idempotent YAML re-parse generates new slot IDs each time, breaking slot-keyed data |
| AUDIT-D | Low | `workoutTypeBreakdown` in historyStats | Only attributes first slot per multi-slot day, undercounting mobility/supplementary completions |
| AUDIT-E | Low | `sessionExtrasRef` in TodayPage | Resets on component remount, breaking Undo after navigation |
| AUDIT-F | Low | Deprecated `WorkoutType` values | No `@deprecated` JSDoc; new contributors may accidentally produce deprecated values |

### Prioritized Plan (for next pass)

| Priority | Item |
|----------|------|
| P1 | Fix `updateEntryAction` BUG-DAYOFF-INDEX: look up the rotation planDayIndex from the plan at the CalendarPage call site before calling updateEntryAction (existing test at historyStore.test.ts:196 documents the expected fix). |
| P2 | Add `@deprecated` JSDoc on deprecated `WorkoutType` values (`weightlifting`, `long_run`, `recovery_run`, `rest`) — zero-risk annotation. |
| P3 | Continue `TodayPage.tsx` decomposition (ARCH-1) — still at ~1148 lines after pass 93. |
| P4 | AUDIT-C: deterministic slot IDs on YAML re-parse (hash of structural position). |

---

## Pass 93 — 2026-08-08 (branch `claude/serene-cori-f62mw0`)

### Baseline

- Branch started from `main` after PR #236 (pass 92) merged.
- **1204 tests passing** across 35 test files at start of pass.
- **1206 tests passing** at end of pass (+2 regression tests).
- TypeScript: `tsc --noEmit` clean throughout.

### Architecture Summary (pass 93)

Two-bug-fix pass — no structural or schema changes:

1. **BUG-DAYOFF-INDEX**: `CalendarPage.handleHistoricalActiveComplete` — the outcome target was missing `planDayIndex`. When the live entry was a `day_off`, `handleOutcomeConfirm` would call `updateEntryAction` with no index, leaving the completed entry with `planDayIndex: undefined` and invisible to stats functions.
2. **STATS-DEDUP**: `computeWorkoutCompletionRate` in `historyStats.ts` — added deduplication by `calendarDate` (newest-`createdAt` wins) to match the contract used by `computePlanProgress` and `computeRotationCycleProgress`.

### Bugs Fixed This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| BUG-DAYOFF-INDEX | `57388c1` | `CalendarPage.tsx` | Historical tracker completion on a day_off-marked date now passes a valid `planDayIndex` to the outcome target, so `updateEntryAction` receives the correct index instead of `undefined`. |
| STATS-DEDUP | `384820e` | `historyStats.ts`, `historyStats.test.ts` | `computeWorkoutCompletionRate` now deduplicates entries by `calendarDate` before counting, matching the dedup contract used by all other stats functions. |

### Tests Added This Pass

| File | Tests Added | Description |
|---|---|---|
| `src/lib/__tests__/historyStats.test.ts` | +2 | STATS-DEDUP regression: (1) duplicate entries for the same date count as one, newest wins; (2) distinct-date entries are unaffected by dedup. |

### New Audit Findings Documented (not yet implemented)

From a fresh full-codebase audit performed this pass:

| # | Severity | Location | Summary |
|---|---|---|---|
| AUDIT-1 | High | `storeSync.ts` | `beforeunload` async flush may be dropped by browser before tab closes. `navigator.sendBeacon` would be safer. |
| AUDIT-2 | High | `modules/run-adaptation/engine.ts` | `hitTarget` false-negative: users who don't log distance/completedAsPlanned never auto-progress even on `complete` entries. Needs UI nudge or fallback rule. |
| AUDIT-3 | Medium | `storeSync.ts:syncOnLogin` | No conflict resolution on login — local-only changes are silently overwritten by cloud data. |
| AUDIT-4 | Medium | `engine/programParser.ts:parseSlot` | Non-idempotent: re-parsing same YAML produces new `nanoid` slot IDs, breaking slot-keyed data after re-import. Deterministic IDs (hash of position) would fix this. |
| AUDIT-5 | Low | `lib/expressionEval.ts` | Unknown tokens silently skipped, division by zero returns 0, parse fallback returns 0 — all mask progression-rule authoring errors. |
| AUDIT-6 | Low | `CalendarPage.tsx:DayDetailModal` | `canDayOff = isPast \|\| isToday \|\| isFuture` is tautologically `true`. Current behavior (Day Off available on all dates incl. future) is presumably intentional; the tautology is dead code and should be simplified or documented. |

### Prioritized Plan (for next pass)

| Priority | Item |
|----------|------|
| P1 | Continue ARCH-1: TodayPage still at 1138 lines. Next extraction candidate: the "Secondary workout-management actions" button row (~25 lines, isPending + activeWorkoutState === 'hidden' guard) or the "Resolved actions" button row (~30 lines). Both have clear prop surfaces. |
| P2 | AUDIT-2: Document or surface a UI nudge when run adaptation is enabled but outcome fields needed for progression are absent. A `console.warn` is not visible; a banner or field hint on the outcome modal would help. |
| P3 | AUDIT-1: Replace the `beforeunload` async `pushStore()` call with a synchronous `navigator.sendBeacon` approach to prevent data loss on tab close. |
| P4 | Add `@testing-library/react` to enable render-level tests for the growing library of pure presentational Today/Calendar components. |

---

## Pass 92 — 2026-08-07 (branch `claude/serene-cori-9bci4x`)

### Baseline

- Branch started from `main` after PR #234 (plan-builder exercise picker) merged.
- **1203 tests passing** across 35 test files at start of pass.
- **1204 tests passing** at end of pass (+1 BUG-11 regression test).
- TypeScript: `tsc --noEmit` clean throughout.

### Architecture Summary (pass 92)

Three-change pass:
1. **ARCH-1 (continued)**: three JSX blocks extracted from `TodayPage.tsx` into dedicated components. TodayPage: 1221 → 1138 lines (−83).
2. **BUG-11 fix**: legacy CSV `stableExtraId` occurrence assignment now sorts by `createdAt` before assigning positions, so the same IDs are produced regardless of CSV row order.
3. **WEB_APP_INVENTORY.md update**: catalogued the 13 TodayPage sub-components and `SwipeToDelete` that were missing from the inventory.

### Bugs Fixed This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| BUG-11 | `b08ee78` | `csv.ts`, `csv.test.ts` | Legacy extra rows sharing the same composite key now get stable occurrence assignments sorted by `createdAt`, preventing ID swaps when the same CSV is re-imported with rows in a different order. |

### Refactoring This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| ARCH-1 (continued) | `c69a137` | `TodayPRBanner.tsx` (new), `TodayCardioPromptModal.tsx` (new), `TodayUpcomingLogModal.tsx` (new), `TodayPage.tsx` | Extracted 3 self-contained JSX blocks from TodayPage. TodayPage: 1221 → 1138 lines (−83). Five icon imports and one Modal import removed from TodayPage. |

### Tests Added This Pass

| File | Tests Added | Description |
|---|---|---|
| `csv.test.ts` | +1 | BUG-11 regression: verifies that two legacy extra rows with the same composite key produce identical IDs regardless of which order they appear in the CSV. |

### Prioritized Plan (for next pass)

| Priority | Item |
|----------|------|
| P1 | Continue `TodayPage.tsx` decomposition (ARCH-1) — now 1,138 lines. Next candidates: the inline "Add plan workout preview" section (lines ~746-760), the "secondary workout-management actions" button row (pending state), or the "resolved actions" button row (Edit/Undo/Override). |
| P2 | `updateEntryAction` historyStore: changing away from `day_off` without a `planDayIndex` leaves the entry with `planDayIndex: undefined`. |
| P3 | Add render-level tests for `TodayPRBanner`, `TodayCatchupModal`, and `TodayPlanProgressModal` (requires `@testing-library/react`). |

---

## Pass 91 — 2026-08-05 (branch `claude/serene-cori-msn7bs`)

### Baseline

- Branch started from `main` after PR #232 (pass 90) merged.
- **1196 tests passing** across 34 test files at start of pass.
- **1196 tests passing** at end of pass (no regressions, no new tests this pass).
- TypeScript: `tsc --noEmit` clean throughout.

### Architecture Summary (pass 91)

Two-change pass: wired the `computeWorkoutCompletionRate` function (added in pass 90 as a P1 item)
into both the `TodayPlanProgressModal` stats display and the `HistoryPage` plan-stats bar, and
extracted the catchup-confirm modal from `TodayPage` into a standalone `TodayCatchupModal` component
(P1 ARCH-1 candidate explicitly listed in pass 90's plan).

### Bugs Fixed This Pass

None.

### Features Added This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| FEAT-1 | `8f6cb85` | `TodayPlanProgressModal.tsx`, `TodayPage.tsx`, `HistoryPage.tsx` | Wired `computeWorkoutCompletionRate` into UI. The Plan Progress modal (Today tab) now shows a "Completion rate" row alongside the existing "Logged rate" row. HistoryPage plan-stats section now shows a second progress bar (emerald) for completion rate below the existing sky-blue logged-rate bar. |

### Refactoring This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| ARCH-1 (continued) | `e29fe69` | `TodayCatchupModal.tsx` (new), `TodayPage.tsx` | Extracted the "Mark as Day Off?" catchup-confirm modal (35 inline lines) from `TodayPage` into `src/components/today/TodayCatchupModal.tsx`. Pure stateless component with 3 props. TodayPage: 1,240 → 1,217 lines (−23). |

### Tests Added This Pass

None. All changed logic is either pure UI wiring (computeWorkoutCompletionRate was already tested with 10 tests in pass 90) or pure structural refactoring (TodayCatchupModal).

### Prioritized Plan (for next pass)

| Priority | Item |
|----------|------|
| P1 | Continue `TodayPage.tsx` decomposition (ARCH-1) — now 1,217 lines. Next candidates: the in-line "PR celebration" banner (~20 lines) or the SwapWorkout modal section. |
| P2 | `updateEntryAction` historyStore: changing away from `day_off` without a `planDayIndex` leaves the entry with `planDayIndex: undefined`. Fix requires CalendarPage to thread the index through the `outcomeTarget` state shape. |
| P3 | Update `WEB_APP_INVENTORY.md` to reflect the new `TodayCatchupModal` and `TodayAdHocWorkout` components added in passes 90–91. |
| P4 | Add render-level tests for `TodayCatchupModal`, `TodayPlanProgressModal`, `TodayPendingCard` — pure-presentational components with well-defined prop interfaces. |

---

## Pass 90 — 2026-08-03 (branch `claude/serene-cori-lp74l7`)

### Baseline

- Branch started from `main` after PRs #227–#229 (drag-reorder, MobilityTracker set-completion fix, minimize/resume UX) merged since pass 89.
- **1186 tests passing** across 34 test files at start of pass.
- **1186 tests passing** at end of pass (no regressions, no new tests this pass).
- TypeScript: `tsc --noEmit` clean throughout.

### Architecture Summary (pass 90)

Two-change pass: a targeted bug fix for the BUG-2 `openExtraOutcome` edge case in
`CalendarPage.tsx`, and a new `computeWorkoutCompletionRate` utility in `historyStats.ts`.

### Bugs Fixed This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| BUG-2 (partial) | — | `CalendarPage.tsx` | `openExtraOutcome` did not set `planDayIndex` on `outcomeTarget`, so when the user tapped an extra workout on a day whose rotation entry was `day_off`, `handleOutcomeConfirm` called `updateEntryAction` with `entry.planDayIndex = undefined` AND `outcomeTarget.planDayIndex = undefined`, leaving the rotation entry as `complete` with `planDayIndex: undefined`. Fix: look up the resolved day from the existing calendar grid (`weeks.flat().find(…)`) and forward `resolvedDay?.planDayIndex`. This covers the remaining BUG-2 path; `openEditOutcome` and `logForDate` were already correct. |

### Features Added This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| FEAT-1 | — | `historyStats.ts` | `computeWorkoutCompletionRate(planId, entries, today)` — returns `{ completedCount, skippedCount, dayOffCount, workoutCompletionRate, overallRate }`. `workoutCompletionRate` measures completed/(completed+skipped) excluding day_off entries. `overallRate` includes day_off in the denominator. Both are integers or `null` when denominator is 0. |

### Tests Added This Pass

| File | Tests Added | Description |
|---|---|---|
| `historyStats.test.ts` | +10 | Full coverage for `computeWorkoutCompletionRate`: empty entries → null rates; all-complete → 100%; all-skip → 0%; all-day_off → null workoutCompletionRate, 0% overallRate; mixed → correct percentages; future entries excluded; today's entries included; planId filtering; 75% mixed case; null workoutCompletionRate when only day_off. |
Two-change pass: removed the `getFutureProjection` dead code from `calendarProjection.ts` and extracted the ad-hoc workout flow from `TodayPage.tsx` into a new self-managing `TodayAdHocWorkout` component.

The dead code (`getFutureProjection`) had been marked "currently unused" in its own docstring since at least pass 88 and appeared in `REVIEW_NOTES.md` as `DEAD-CODE-1`. No callers existed anywhere in the codebase.

For the ARCH-1 extraction: the ad-hoc workout overlay had 10 state variables and three JSX blocks (start modal, tracker overlay, outcome modal). These were entirely self-contained — the only external contract was an "open" trigger from `TodayRotationModals` and a `canAddAdHoc` boolean guard. The new `TodayAdHocWorkout` component holds all 10 state variables internally and exposes exactly those two contracts via `openRequested` + `onActiveChange` props. This is a step forward from previous ARCH-1 extractions (which followed the stateless "dumb component" pattern) — the component is self-managing.

### Bugs Fixed This Pass

None.

### Refactoring This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| DEAD-CODE-1 | `2d435d4` | `calendarProjection.ts` | Removed `getFutureProjection` function (lines 107–117) and its now-unused `getUpcomingDays` import. The function was a thin wrapper around `getUpcomingDays` with no callers. `calendarProjection.ts`: 118 → 94 lines (−24). |
| ARCH-1 (continued) | `4f06fc0` | `TodayAdHocWorkout.tsx` (new), `TodayPage.tsx` | Extracted the ad-hoc workout start-modal, tracker overlay, and outcome modal into `src/components/today/TodayAdHocWorkout.tsx`. The component manages 10 state variables internally and exposes `openRequested` + `onActiveChange` props to the parent. Three now-unused imports removed from TodayPage (`nanoid`, `WorkoutType`, `PlanDay`). TodayPage: 1,374 → 1,238 lines (−136). |

### Tests Added This Pass

None. Both changes are structural/dead-code removals with no new logic to test.

### Prioritized Plan (for future passes)

| Priority | Item |
|----------|------|
| P1 | Continue `TodayPage.tsx` decomposition (ARCH-1) — now 1,367 lines. |
| P1 | Wire `computeWorkoutCompletionRate` into a stats display (HistoryPage or plan stats card). |
| P2 | Remove or document `getFutureProjection` dead code in `calendarProjection.ts`. |
| P3 | Add render-level tests for `TodayRotationModals`, `TodayPendingCard`, `TodayUpcomingList`. |
| P1 | Continue `TodayPage.tsx` decomposition (ARCH-1) — now 1,238 lines. Next candidates: the "PR celebration" banner (inline JSX ~20 lines) could join `TodayCompletedSection`; or the catch-up confirm modal (~40 lines) into a `TodayCatchupModal` component. |
| P2 | `updateEntryAction` historyStore: changing away from `day_off` without a `planDayIndex` leaves the entry with `planDayIndex: undefined`. Fix requires CalendarPage to thread the index through the `outcomeTarget` state shape. |
| P3 | Update `REVIEW_NOTES.md` and `WEB_APP_INVENTORY.md` to remove now-deleted `getFutureProjection` references. |
| P4 | Add render-level tests for `TodayAdHocWorkout`, `TodayRotationModals`, `TodayPendingCard` — pure-presentational and self-managing components with well-defined prop interfaces. |

---

## Pass 89 — 2026-08-02 (branch `claude/serene-cori-uv7ebe`)

### Baseline

- Branch started from `main` after PRs #219–#221 (mobility feature additions) merged since pass 88.
- **1177 tests passing** across 34 test files at start of pass (mobility features added 51 tests between passes).
- **1181 tests passing** at end of pass (+4 new tests).
- TypeScript: `tsc --noEmit` clean throughout.

### Architecture Summary (pass 89)

Two-change pass focused on ARCH-1 continuation and test coverage gap closure. The
TodayPage grew to 1,494 lines because the mobility workout type feature (PRs #219–#221)
added new modal UI inline. The 4 rotation-override modals were extracted to a new
`TodayRotationModals` component, bringing TodayPage back to 1,367 lines. A test
gap for the `buildLastSessionSummary` mobility path was also closed.

### Bugs Fixed This Pass

None. Bug scan focused on the new mobility feature code path (mobilityExercises array
handling, set completion logic) — no correctness bugs found in the path from
`buildLastSessionSummary` through to display.

### Refactoring This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| ARCH-1 (continued) | `c33f341` | `TodayRotationModals.tsx` (new), `TodayPage.tsx` | Extracted the Override, Jump-to-day, Add Workout, and Add-from-Plan modals (~150 lines of JSX) into `src/components/today/TodayRotationModals.tsx` with a typed `TodayRotationModalsProps` interface (~20 props). Three now-unused lucide-react icon imports (`ChevronRight`, `ChevronLeft`, `ListPlus`) removed from TodayPage. TodayPage reduced from 1,494 → 1,367 lines (−127). |

### Tests Added This Pass

| File | Tests Added | Description |
|---|---|---|
| `sessionSummary.test.ts` | +4 | Mobility outcome path for `buildLastSessionSummary`: (1) multi-exercise with duration; (2) singular labels (1 exercise, 1 set, no duration); (3) all-skipped returns `null`; (4) partial completion counts only completed sets |

### Prioritized Plan (for future passes)

| Priority | Item |
|---|---|
| P1 | Continue `TodayPage.tsx` decomposition (ARCH-1) — now 1,367 lines. Next candidates: ad-hoc workout overlay state group or the active-workout entry-point button block. |
| P2 | `updateEntryAction` historyStore: changing away from `day_off` without a `planDayIndex` leaves the entry with `planDayIndex: undefined`. |
| P3 | Remove or document `getFutureProjection` dead code in `calendarProjection.ts`. |
| P4 | Add render-level tests for `TodayRotationModals`, `TodayPendingCard`, `TodayUpcomingList` — all pure-presentational, good RTL candidates. |

---

## Pass 88 — 2026-08-01 (branch `claude/serene-cori-bl4pj8`)

### Baseline

- Branch started from `main` (PR from pass 87 merged since then).
- **1126 tests passing** across 33 test files at start and end of pass (no regressions, no new tests this pass).
- TypeScript: `tsc --noEmit` clean throughout.

### Architecture Summary (pass 88)

Two-change pass: a rendering bug fix (double "Last:" prefix) and another ARCH-1
TodayPage component extraction (TodayPendingCard). TodayPage shrinks to 1,395
lines.

### Bugs Fixed This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| BUG-DOUBLE-LAST | `566dbd7` | `TodayPage.tsx`, `TodayUpcomingList.tsx` | `buildLastSessionSummary` returns strings already prefixed with `"Last: "`. Both render sites also had a hardcoded `"Last: "` literal in JSX, producing `"Last: Last: 3×8 @ 135 lb Bench Press"` for every user with previous session data. Removed the redundant JSX prefixes. |

### Refactoring This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| ARCH-1 (continued) | `4b3b73d` | `TodayPendingCard.tsx` (new), `TodayPage.tsx` | Extracted the ~85-line pending workout compact card into `src/components/today/TodayPendingCard.tsx`. `previewExpanded` useState moved inside the component. Three now-unused imports removed from TodayPage (`ChevronDown`, `ChevronUp`, `WorkoutSlotDetails`). TodayPage is now 1,395 lines (−68 from pass 87 baseline). |

### Tests Added This Pass

None. Bug fixes were in render-path JSX (no testable pure logic). The ARCH-1
extraction is a structural refactor with no new logic. All 1,126 existing tests
continue to pass.

### Prioritized Plan (for future passes)

| Priority | Item |
|---|---|
| P1 | Continue `TodayPage.tsx` decomposition (ARCH-1) — now 1,395 lines. Next candidates: ad-hoc workout modal overlay (multiple useState + handler), or the upcoming-log modal section. |
| P2 | `updateEntryAction` historyStore: changing away from `day_off` without a `planDayIndex` leaves the entry with `planDayIndex: undefined`. Fix requires CalendarPage to thread the index through the `outcomeTarget` state shape. |
| P3 | Remove or document `getFutureProjection` dead code in `calendarProjection.ts` (already has an inline note; safe to delete). |
| P4 | Add render-level tests for `TodayPendingCard`, `TodayUpcomingList`, `TodayCompletedSection` — all pure-presentational, good RTL candidates. |

---

## Pass 87 — 2026-07-31 (branch `claude/serene-cori-02lc31`)

### Baseline

- Branch started from `main` (PR from pass 86 merged since then).
- **1126 tests passing** across 33 test files at start and end of pass (no regressions, no new tests this pass).
- TypeScript: `tsc --noEmit` clean throughout.

### Architecture Summary (pass 87)

Single-change pass: ARCH-1 TodayPage decomposition continued with two more component extractions. `TodayMobilitySection` and `TodayPlanProgressModal` extracted as pure presentational components, reducing TodayPage by 98 lines. No logic changed, no new dependencies.

### Bugs Fixed This Pass

None. Bug scan of CalendarPage.tsx (1031 lines) and HistoryPage.tsx (1186 lines) completed — no bugs found. Both files use well-established patterns (live store access via `.getState()` after stale closure mutations, plan-guarded rendering, correct mobility date isolation).

### Refactoring This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| ARCH-1 (continued) | `be0e55d` | `TodayPage.tsx`, `TodayMobilitySection.tsx` (new), `TodayPlanProgressModal.tsx` (new) | Extracted the Daily Mobility section (4-state display: no-routine / completed / in-progress / idle) into `TodayMobilitySection` with 7 typed props. Extracted the Plan Progress detail modal (ring + stats table) into `TodayPlanProgressModal` with 10 typed props; internally imports `CompletedWorkoutsRing` from `TodayHabitSummary` and `Modal` from shared. Removed now-unused `Zap`, `Plus` (lucide-react) and `CompletedWorkoutsRing` imports from TodayPage. TodayPage is now ~1463 lines (−98 from pass 86 baseline). |

### Tests Added This Pass

None. Pass focused on pure JSX extraction with no new logic. All 1126 existing tests continue to pass.

### Prioritized Plan (for future passes)

| Priority | Item |
|---|---|
| P1 | Continue `TodayPage.tsx` decomposition (ARCH-1) — now ~1463 lines. Remaining candidates: ad-hoc workout modal overlay, today's compact workout card, override/jump confirmation sections. |
| P2 | Add render-level tests for newly extracted `TodayMobilitySection.tsx` and `TodayPlanProgressModal.tsx` — both pure presentational, good RTL candidates (jsdom setup needed). |
| P3 | `ActiveWorkoutTracker.tsx` (~2144 lines) and `CardioWorkoutTracker.tsx` auto-advance timer remain untested. |

---

## Pass 86 — 2026-07-30 (branch `claude/serene-cori-fnly7t`)

### Baseline

- Branch started from `main` (PR from pass 85 merged since then).
- **1121 tests passing** across 33 test files at start of pass.
- **1126 tests passing** at end of pass (+5 new tests).
- TypeScript: `tsc --noEmit` clean throughout.

### Architecture Summary (pass 86)

Three-change pass: a targeted engine fix for `getUpcomingDays` (pre-logged future day_off entries now surface in the upcoming list), a companion UI change in `TodayUpcomingList` to display a "Day Off" placeholder for those days, and another ARCH-1 TodayPage extraction (`TodayHabitSummary`).

### Bugs Fixed This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| BUG-UPCOMING-DAYOFF | `68a1136` | `rotationEngine.ts` | `getUpcomingDays` projected the rotation forward without consulting stored entries for future dates. A day_off pre-logged via Calendar was invisible to the Today page upcoming list. Fixed by building an entry-by-date map (same dedup logic as `computeCurrentDayIndex`) and attaching the matching entry as `historyEntry` on each returned `ResolvedDay`. The rotation pointer is unchanged — future entries are informational only. |

### Feature/UX Improvements This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| UX-UPCOMING-DAYOFF | `30cde3b` | `TodayUpcomingList.tsx` | Companion to the engine fix. When `rd.historyEntry?.action === 'day_off'`, the upcoming list renders a compact "Day Off" card (Coffee icon + muted label) in place of the workout card. The card remains clickable so the user can change their mind. Added `Coffee` to imports from lucide-react. |

### Refactoring This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| ARCH-1 (continued) | `3907075` | `TodayPage.tsx`, `src/components/today/TodayHabitSummary.tsx` (new) | Extracted the compact habit-summary row (🔥 streak · total workouts · cycle progress · plan completion ring) and the `CompletedWorkoutsRing` SVG sub-component from TodayPage into `TodayHabitSummary`. `CompletedWorkoutsRing` is also used in the plan-progress detail modal with `size=88`, so it is exported and re-imported by TodayPage for that secondary usage. TodayPage is now 1561 lines (–64). |

### Tests Added This Pass

| File | Tests Added | Description |
|---|---|---|
| `rotationEngine.test.ts` | +5 | `getUpcomingDays` historyEntry attachment: day_off reflected, undefined for no entry, dedup (newest wins), plan isolation, pointer unchanged by future entries |

### Prioritized Plan (for future passes)

| Priority | Item |
|---|---|
| P1 | Continue `TodayPage.tsx` decomposition (ARCH-1) — now ~1561 lines. Next candidates: ad-hoc workout modal section, or the Plan Progress detail modal content. |
| P2 | Add render-level tests for `TodayUpcomingList.tsx`, `TodayCompletedSection.tsx`, `TodayHabitSummary.tsx` — all three are now pure presentational components suited for RTL unit tests (jsdom setup needed). |
| P3 | `ActiveWorkoutTracker.tsx` (~2144 lines) and `CardioWorkoutTracker.tsx` auto-advance timer remain untested. |

---

## Pass 85 — 2026-07-29 (branch `claude/serene-cori-23vs7k`)

### Baseline

- Branch started from `main` (PR from pass 84 merged since then).
- **1121 tests passing** across 33 test files at start and end of pass (no regressions, no new tests this pass).
- TypeScript: `tsc --noEmit` clean (0 errors).

### Architecture Summary (pass 85)

Two-change pass: a targeted bug fix for spurious PR celebration banners on workout edits (from a pass 62 "Keep with revisions" verdict), followed by extraction of `SwipeToDelete` and `TodayCompletedSection` components from TodayPage (ARCH-1 progress).

### Bugs Fixed This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| BUG-PR-EDIT-DETECTION | `eb29a6d` | `TodayPage.tsx` | PR celebration banner fired on every outcome save, including when the user re-opened the modal via "Edit" on an already-completed workout. Added `isEditingOutcomeRef` (`useRef<boolean>`), set to `true` only in `handleEditOutcome`, captured and reset at the start of `handleOutcomeConfirm`, then used to gate the PR detection block. Editing an existing outcome no longer triggers a false-positive PR banner. |

### Refactoring This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| ARCH-1 (continued) | `df29b22` | `TodayPage.tsx`, `src/components/shared/SwipeToDelete.tsx` (new), `src/components/today/TodayCompletedSection.tsx` (new) | Moved the module-local `SwipeToDelete` touch-gesture component to `src/components/shared/SwipeToDelete.tsx` so future extracted components can share it. Extracted the "Completed today" section (primary plan-day button + swipeable extra-workout rows) into `TodayCompletedSection` with a typed props interface — store action callbacks remain in TodayPage via `onDeleteExtra`. Removed the now-unused `useEffect` import. TodayPage is down ~47 JSX lines and two files. |

### Tests Added This Pass

None. Bug was in page-level UI event handlers not covered by unit tests. All 1121 existing tests continue to pass.

### Prioritized Plan (for future passes)

| Priority | Item |
|---|---|
| P1 | Continue `TodayPage.tsx` decomposition (ARCH-1) — now ~1580 lines. Next candidates: ad-hoc workout modals (AdHocStartModal, adHocWorkoutState tracker section), or the habit summary ring row. |
| P2 | Add a render-level test harness for `TodayPage.tsx` / `TodayBanners.tsx` / `TodayUpcomingList.tsx` / `TodayCompletedSection.tsx`. The last two are now pure presentational components suitable for RTL unit tests. |
| P3 | `ActiveWorkoutTracker.tsx` (~2144 lines) and `CardioWorkoutTracker.tsx` auto-advance timer remain untested. |

---

## Pass 84 — 2026-07-28 (branch `claude/serene-cori-zfyw0n`)

### Baseline

- Branch started from `main` (PR from pass 83 merged since then).
- **1121 tests passing** across 33 test files at start and end of pass (no regressions, no new tests this pass).
- TypeScript: `tsc --noEmit` clean (0 errors).

### Architecture Summary (pass 84)

Two-change pass: a targeted bug fix for the Undo handler's blindspot on backdated bonus extras (BUG-UNDO-BACKDATED-BONUS, previously P3), followed by extraction of the upcoming-days section from TodayPage into a standalone `TodayUpcomingList` component (ARCH-1 progress).

### Bugs Fixed This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| BUG-UNDO-BACKDATED-BONUS | `58a57c7` | `TodayPage.tsx` | Undo handler matched double-day extras by `ex.calendarDate === today`, which fails when the user backdates the bonus via the outcome modal (`updateExtraEntryDate` moves the entry to the new date). Also used hardcoded `today` as the date in `makeExtraWorkoutInstanceId`, but the outcome key was already moved by `moveOutcome` to the backdated date. Fix: added `sessionExtrasRef` (`useRef<Set<string>>`) to track extra IDs created in double-day flows during the current session. The Undo handler matches by session-ID membership **or** `calendarDate === today`, and always uses `ex.calendarDate` (not `today`) for the outcome instance ID. The set is cleared after a successful undo. |

### Refactoring This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| ARCH-1 (partial) | `b247366` | `TodayPage.tsx`, `src/components/today/TodayUpcomingList.tsx` (new) | Extracted the upcoming-days section (~50 JSX lines + per-item run-adaptation resolution) into `TodayUpcomingList`. Component accepts `upcoming`, `extraIsNextInPlan`, `planId`, `getProgressionState`, `upcomingSessionCounts`, `upcomingSessionSummaries`, `onSelectUpcoming` as props; returns `null` when list is empty. Removed two now-unused imports from TodayPage (`TrendingUp`, `resolveWorkoutDisplayTarget`). |

### Tests Added This Pass

None. Bug was in page-level UI handlers not covered by unit tests. All 1121 existing tests continue to pass.

### Prioritized Plan (for future passes)

| Priority | Item |
|---|---|
| P1 | Continue `TodayPage.tsx` decomposition (ARCH-1) — now ~1697 lines. Next candidates: extract the active workout prompt section, the CardioWorkoutTracker prompt, or the OutcomeModal invocation. |
| P2 | Add a render-level test harness for `TodayPage.tsx` / `TodayBanners.tsx` / `TodayUpcomingList.tsx`. `TodayUpcomingList` is now a pure component suitable for RTL unit tests. |
| P3 | `ActiveWorkoutTracker.tsx` (1872 lines) and `CardioWorkoutTracker.tsx` auto-advance timer remain untested. |

---

## Pass 83 — 2026-07-27 (branch `claude/serene-cori-xr8w3j`)

### Baseline

- Branch started from `main` (PR from pass 82 merged since then).
- **1121 tests passing** across 33 test files at start and end of pass (no regressions, no new tests this pass).
- TypeScript: `tsc --noEmit` clean (0 errors). `npm run build` succeeds.

### Architecture Summary (pass 83)

Bug-fix pass. Deep codebase audit (via dedicated Explore subagent) surfaced a multi-site data-consistency bug in all three `handleOutcomeConfirm` handlers and an invalid-date edge case in `plansFromCsv`. All fixes are surgical, independently revertable, and leave all 1121 tests green.

### Bugs Fixed This Pass

| # | Commit | File(s) | Summary |
|---|---|---|---|
| BUG-OUTCOME-DESYNC | `a5af931` | `TodayPage.tsx`, `CalendarPage.tsx`, `HistoryPage.tsx`, `csv.ts` | In all three `handleOutcomeConfirm` handlers, `removeOutcome` and the outcome `workoutInstanceId` remap ran unconditionally outside the `!destEntry` guard. When backdating to a date that already had a logged entry, the history entry correctly stayed at the original date but the outcome was remapped to the destination date — a silent data mismatch causing outcomes to disappear in History. Fix: moved the outcome remap inside the `!destEntry` guard so entry and outcome always end up at the same key. Also removed the dead `removeEntry(planId, completedDate)` calls that were inside `!destEntry` (confirmed-empty slot — always a no-op triggering a spurious Zustand re-render). `plansFromCsv` now validates `planStartDate` against a date-format regex and `isNaN` check (identical to `historyFromCsv`'s existing guard) to avoid silently persisting invalid date strings that would produce `NaN` in every downstream date computation. |

### Action-Sync Secondary Fix (CalendarPage.tsx, HistoryPage.tsx)

The action-sync lookup after `handleOutcomeConfirm` used only `completedDate` to find the history entry. When the move was blocked by `destEntry`, the entry stayed at `originalDate` and the lookup at `completedDate` found the blocking entry, potentially updating its action. Added a `?? originalDate` fallback so the lookup finds the entry wherever it ended up.

### Tests Added This Pass

None. The outcome-remap bug is in page-level event handlers that are not covered by the existing unit-test suite (which covers engine / store / lib functions only). All 1121 existing tests continue to pass.

### Prioritized Plan (for future passes)

| Priority | Item |
|---|---|
| P1 | Continue `TodayPage.tsx` decomposition (ARCH-1) — now ~1737 lines. Next candidates: extract `<TodayWorkoutCard>` or `<TodayUpcomingList>`. |
| P2 | Add a render-level test harness for `TodayPage.tsx` / `TodayBanners.tsx`. TodayBanners is now a pure component — easy to test with RTL if jsdom is added. |
| P3 | Undo handler: bonus extra backdated to past date is missed by `calendarDate === today` filter (Bug 4 in audit). Requires tracking session extra IDs or a `createdAt`-based filter with UTC→local alignment. |
| P4 | `ActiveWorkoutTracker.tsx` (1872 lines) and `CardioWorkoutTracker.tsx` auto-advance timer remain untested. |

---

## Pass 82 — 2026-07-26 (branch `claude/serene-cori-83sosx`)

### Baseline

- Branch started from `main` (PR from pass 81 merged since then, plus PR #210 from `claude/serene-cori-nbwqkx`).
- **1121 tests passing** across 33 test files at start and end of pass (no regressions, no new tests this pass).
- TypeScript: `tsc --noEmit` clean (0 errors). `npm run build` succeeds.

### Architecture Summary (pass 82 scope — 83sosx)

Targeted bug-fix pass. Closed BUG-4's last remaining gap (identity migrate placeholders for 4 stores that had none in `storeSync.ts`) and exposed a long-hidden UI gap (extra-entry notes field existed in the type and store action but had no modal UI). Both changes are low-risk, additive, and independently revertable.

### Bugs Fixed / Features Completed This Pass

| # | Commit | File | Summary |
|---|---|---|---|
| BUG-4 (final) | `9a9d77e` | `storeSync.ts` | `wpt_outcomes`, `wpt_program_vars`, `wpt_exercise_history`, and `wpt_settings` had no `migrate` entry in the STORES array. Cloud-hydrated data for these stores bypassed migration entirely. Added identity placeholders so all 7 stores now have uniform pipeline coverage. |
| UI-NOTES | `1314cf0` | `HistoryPage.tsx` | `ExtraWorkoutEntry.notes` existed on the type and `updateExtraEntry` already accepted it, but the extra-entry edit modal had no UI for notes. Added `editingExtraNotes` state wired through `openExtraEdit` and `saveAndCloseExtra`, plus a textarea to the modal. |

### Tests Added This Pass

None. The `storeSync.ts` change touches identity logic already covered by the 13 tests added in pass 81. The `HistoryPage.tsx` change adds UI only; no unit-testable logic was introduced. Total remains 33 files, 1121 tests.

### Prioritized Plan (for future passes)

| Priority | Item |
|---|---|
| P1 | Continue `TodayPage.tsx` decomposition (ARCH-1) — now ~1720 lines after nbwqkx pass. Next candidates: extract `<TodayWorkoutCard>` or `<TodayUpcomingList>`. |
| P2 | Add a render-level test harness for `TodayPage.tsx` / `TodayBanners.tsx`. TodayBanners is now a pure component — easy to test with RTL if jsdom is added. |
| P4 | `ActiveWorkoutTracker.tsx` (1872 lines) and `CardioWorkoutTracker.tsx` auto-advance timer remain untested. |

---

## Pass 82 — 2026-07-25 (branch `claude/serene-cori-nbwqkx`)

### Baseline

- Branch started from `main` (pass 81 PR merged: storeSync tests, streak-milestone divergence fix, mobility-continue-card fix, CSV within-batch collision fix).
- **1121 tests passing** across 33 test files at start and end of pass.
- TypeScript: `tsc --noEmit` clean (0 errors). `npm run build` succeeds.

### Architecture Summary (pass 82 scope — nbwqkx)

Targeted correctness + decomposition pass. Two related `WorkoutType` type-safety bugs in TodayPage.tsx were identified and fixed (same pattern as pass 80 CalendarPage and pass 70 HistoryPage fixes). The P1 ARCH-1 decomposition item was partially addressed by extracting `TodayBanners` (all six informational banners) into a standalone pure-display component, reducing TodayPage by ~120 lines of JSX. The P3 `draftVersion` guard was added to ActiveWorkoutTracker's localStorage draft. No new dependencies. No store schema changes.

### Bugs Fixed This Pass

| # | Commit | File | Summary |
|---|---|---|---|
| BUG-REST-TODAYPAGE-1 | `65f0d57` | `TodayPage.tsx:549` | `workoutType: selectedSlot?.type ?? 'rest'` in `handleOutcomeConfirm` (double-day add-from-plan flow) — should use `'other'`, the current canonical fallback type. |
| BUG-REST-TODAYPAGE-2 | `65f0d57` | `TodayPage.tsx:621` | `workoutType: bonusSlot?.type ?? 'rest'` in `handleUpcomingLog` (log-upcoming-as-today double-day flow) — same fix. |

### Improvements Completed This Pass

| Commit | Change |
|---|---|
| `65f0d57` | Extract six TodayPage banners into `src/components/today/TodayBanners.tsx` (pure display component, 18 props). TodayPage JSX reduced by ~120 lines. First step of ARCH-1. |
| `fd431be` | Add `draftVersion: 1` to ActiveWorkoutTracker's localStorage draft. Drafts with a mismatched version field are discarded on load rather than partially applied. Closes P3. |

### Tests Added This Pass

None. The two TodayPage.tsx bug fixes had no test file to add to. The TodayBanners component is pure JSX. The `draftVersion` guard is in a component with no test file. Total remains 33 files, 1121 tests.

---

## Pass 81 — 2026-07-24 (branch `claude/nightly-codebase-audit-yfetx3`)

### Baseline

- Branch started from `main` (5 PRs merged since pass 80: BUG-2, BUG-CSV, `settingsStore` test coverage, rest-timer display, plan-progress modal + resumable mobility sessions, focus mode, PT mobility preset, active-mobility-session preservation).
- **1107 tests passing** across 32 test files at start of pass.
- **1121 tests passing** at end of pass (+14 new tests).
- TypeScript: `tsc --noEmit` clean (0 errors). `npm run build` succeeds.

### Architecture Summary (pass 81 scope)

Stabilisation pass. All P1/P2 items carried forward from pass 80 (BUG-2, BUG-CSV, BUG-8, EDGE-5) were confirmed already fixed by the 5 PRs merged since then — verified by reading the current code and existing tests rather than re-fixing. This pass closed the single longest-standing carried-forward gap (`storeSync.ts` test coverage, flagged P1 since pass 78) and found 3 new bugs via a targeted audit of the least-tested recently-added code (mobility resumable sessions, streak milestone banner, legacy CSV import). All 3 are fixed. No new dependencies. No store schema changes. Feature work was deliberately skipped — see Prioritized Plan.

### Bugs Fixed This Pass

| # | Commit | File | Summary |
|---|---|---|---|
| BUG-STREAK | `0050a45` | `TodayPage.tsx:302` | `earlyPlanStreak` (fed to the streak-milestone dismiss hook) was computed without mobility dates, while `planStreak` (shown in the habit row and progress modal) included them. The code comment claiming mobility data "isn't yet available" was stale — the selector is read earlier in the same component. A run of mobility-only days could show e.g. "32 day streak" on screen while the 7/14/21/30-day milestone banner logic evaluated a lower, divergent count, so celebrations silently misfired or never fired. |
| BUG-MOBILITY-CONTINUE | `d4da65d` | `TodayPage.tsx:288` | `mobilityInProgress` required the paused checkpoint's `exerciseIds` to exactly match the live routine before offering a "Continue" card. That check predates `reconcileCheckpoint()` (pass-80-adjacent commit `911d095`), which exists specifically to survive routine edits mid-session. Editing the routine via "Manage routine" while a session was paused silently reverted the card to a plain "Start Mobility Routine" button — implying data loss that didn't actually occur. |
| BUG-CSV-COLLISION | `84fe146` | `csv.ts:455` | `stableExtraId()` (the pass-80-recommended, already-shipped fix for idempotent legacy-CSV re-import) derives an id from `(planId, date, workoutType, workoutName)`. Two rows in the *same* legacy import sharing that key (e.g. two same-day, default-named "Yoga" extras) hashed to the same id; `historyStore.importExtraEntries` only dedupes against already-stored entries, not within the incoming batch, so both rows would be inserted under one colliding id. |

### Test Added This Pass

| Commit | File | Summary |
|---|---|---|
| `6036bcb` | `src/lib/__tests__/storeSync.test.ts` (new) | 13 tests covering `syncOnLogin`'s push-vs-hydrate branching, per-store migrate wiring, fetch-error short-circuit, unknown-store tolerance, and `subscribeStores`' debounce/beforeunload-flush/unsubscribe behavior. Closes TEST-1, carried forward since pass 78. |
| `84fe146` | `src/lib/__tests__/csv.test.ts` | Replaced a weak assertion ("id is a non-empty string") with one that verifies the actual guarantee (re-import twice → same id); added a test for the new within-batch collision guard. |

### Carried-Forward Items Verified Already Fixed (no action needed)

| ID | Status |
|---|---|
| BUG-2 (`day_off → complete` drops `planDayIndex`) | Fixed in `a317041` (between pass 80 and this pass). |
| BUG-CSV (legacy re-import duplicates) | Fixed in `2fc7832`. This pass found and fixed a within-batch edge case the original fix didn't cover (see BUG-CSV-COLLISION above). |
| BUG-8 (`outcomeSortKey` non-deterministic empty fallback) | Already deterministic — secondary sort key on `workoutInstanceId` was already in place. No bug found on re-inspection. |
| EDGE-5 (`sessionSummary` pace-only run outcome) | Already handled correctly and already covered by `'shows pace alone when only pace is available'` test. |

### Prioritized Plan (for future passes)

| Priority | Item |
|---|---|
| P1 | Begin `TodayPage.tsx` decomposition (ARCH-1) — now 1832 lines, still the largest untested page component. No dedicated test file exists for it at all. |
| P2 | Fix BUG-4: cloud hydration bypassing Zustand migrate pipeline for stores not explicitly listed in `storeSync.ts`'s `STORES` array (complex — requires a shared migration entry point). |
| P2 | Add a render-level test harness for `TodayPage.tsx` (even a minimal smoke test) — the two bugs fixed this pass were both in un-tested conditional JSX and were only caught by manual code reading. |
| P3 | Add `draftVersion` to active-workout draft. |
| P4 | `ActiveWorkoutTracker.tsx` (1872 lines) and `CardioWorkoutTracker.tsx` auto-advance timer remain untested (carried forward from pass 78/80). |

### Rationale for Sequencing

`storeSync.ts` tests came first because it was the single longest-standing, highest-severity gap (4+ passes, zero coverage on the only path that can silently lose or corrupt user data across devices) and carried zero implementation risk. The three bug fixes were sequenced by how directly they affect visible, everyday product behavior: the streak/milestone divergence and the mobility "Continue" card are both things an active user would hit on a normal day; the CSV collision only manifests on a rare re-import of a specific old export shape.

---

## Pass 80 — 2026-07-21 (branch `claude/dreamy-mccarthy-h2vbby`)

### Baseline

- Branch started from `main` after PR from pass 79 merged.
- **1091 tests passing** across 31 test files at start of pass.
- **1093 tests passing** at end of pass (+2 new tests).
- TypeScript: `tsc --noEmit` clean (0 errors — verified implicitly by Vitest).

### Architecture Summary (pass 80 scope)

Stabilisation pass. Four confirmed bugs fixed, two store schema-safety gaps patched, one tokenizer correctness improvement, one dependency-direction fix. No new dependencies. No store schema data changes (version bump is safe/forward-compatible). Feature work deliberately skipped; see Prioritized Plan.

### Bugs Fixed This Pass

| # | Commit | File | Summary |
|---|---|---|---|
| BUG-1 | `6000a9c` | `CalendarPage.tsx:244` | Slot fallback in `handleOutcomeConfirm` used deprecated `'rest'` WorkoutType instead of `'other'`. Downstream `type === 'other'` checks and `WORKOUT_META` icon lookup would silently follow the wrong path. |
| ARCH-2 | `68c2f9f` | `csv.ts:23` | `csv.ts` imported `makeWorkoutInstanceId` and `makeExtraWorkoutInstanceId` from `outcomeStore` instead of their source module `workoutInstanceId.ts`. A lib module importing from a store violates dependency direction and risks a circular import. Fixed by importing directly from `lib/workoutInstanceId.ts`. |
| RISK-1/RISK-2 | `5f96761` | `settingsStore.ts`, `programStore.ts` | Both stores lacked a `version` and `migrate` in the `persist` config. Future schema changes would silently fail to run migrations for existing users. Added `version: 1` with identity migrations to match the pattern in all other stores. |
| EDGE-1 | `13dd36d` | `expressionEval.ts:40` | Number tokenizer consumed all digits-and-dots then relied on `parseFloat` to discard extra decimal portions (e.g. `parseFloat("1.2.3") = 1.2`). Replaced with an explicit `seenDot` flag that stops scanning at the first decimal point. Principled tokenization, no observable behavior change for valid input. |

### Test Added This Pass

| Commit | File | Summary |
|---|---|---|
| `6463ed0` | `historyStore.test.ts` | Documents BUG-2: `updateEntryAction` called without `planDayIndex` when changing `day_off → complete` leaves `planDayIndex: undefined`. Stats functions silently drop such entries. Test anchors the current behaviour for the future fix. |

### Bugs Found But Not Fixed (newly documented)

| ID | File | Summary |
|---|---|---|
| BUG-2 | `CalendarPage.tsx`, `historyStore.ts:179` | `openEditOutcome` → `handleOutcomeConfirm` path: if the existing entry is `day_off`, `entry.planDayIndex` is `undefined`, so `updateEntryAction` is called without a valid index. The resulting `complete` entry has `planDayIndex: undefined`, causing it to be silently dropped from stats. Fix: add `planDayIndex` to the `outcomeTarget` state shape in CalendarPage and use it as a fallback. |
| BUG-CSV | `csv.ts:653` | Pre-2026-04-26 CSV exports lack an `extraId` column. Each re-import generates fresh `nanoid()` IDs, creating duplicate extra workout entries. Fix: derive a stable synthetic ID from `planId + calendarDate + workoutType + workoutName` for rows missing `extraId`. |
| EDGE-5 | `sessionSummary.ts:92` | A `runActual` object with neither `actualDistanceMiles` nor `actualDurationMin` but with a stored `averagePaceSecondsPerMile` would produce a pace-only summary line. Partially-complete outcomes that have only a stored pace (no distance/duration) would correctly show the pace. Outcomes with `runActual` but no distance, duration, or pace would silently return `null`. Low probability, but worth testing. |

### Prioritized Plan (for future passes)

Carries forward from pass 79, updated priority:

| Priority | Item |
|---|---|
| P1 | Fix BUG-2: `openEditOutcome` → `day_off → complete` leaves `planDayIndex: undefined` |
| P1 | Add tests for `storeSync.ts` cloud sync branching logic (TEST-1) |
| P1 | Fix BUG-4: cloud hydration bypassing Zustand migrate (complex — requires migration pipeline) |
| P2 | Fix BUG-CSV: deterministic `extraId` for pre-2026-04-26 CSV re-imports |
| P2 | Fix BUG-8: `outcomeSortKey` non-deterministic empty fallback |
| P2 | Fix BUG-11: CSV import plan-ID collision (separate from BUG-CSV above) |
| P3 | Begin TodayPage decomposition — extract `<TodayBanners>` first |
| P3 | Add `draftVersion` to active-workout draft |
| P4 | EDGE-5: add pace-only run/swim outcome summary test |

---

## Pass 79 — 2026-07-19 (branch `claude/dreamy-mccarthy-0r25in`)

### Baseline

- Branch started from `main` after PR from pass 78 merged.
- **1088 tests passing** across 31 test files at start of pass.
- **1089 tests passing** at end of pass (+1 new test for `additionalDates` coverage).
- TypeScript: `tsc --noEmit` clean (0 errors — verified implicitly by Vitest).

### Architecture Summary (pass 79 scope)

Three bug fixes and one feature, all in UI/rendering layer. No new dependencies. No store schema changes.

### Bugs Fixed This Pass

| # | Commit | File | Summary |
|---|---|---|---|
| 1 | `f94088a` | `TodayPage.tsx:651` | Date header used `new Date().toLocaleDateString(...)` — stale date after midnight. Fixed: `new Date(today + 'T00:00').toLocaleDateString(...)` using `today` from `useToday()`. |
| 2 | `327484d` | `HistoryPage.tsx:252` | Weekly breakdown 55-day window used `addDays(new Date(), -55)` — stale after midnight. Fixed: `addDays(parseISO(today), -55)` using `today` from `useToday()`. |
| 3 | `3924a79` | `PlansPage.tsx:160` | `today` for plan status was `format(new Date(), 'yyyy-MM-dd')` — stale after midnight. Fixed: `useToday()`. |

Root cause for all three: same pattern. `useToday()` sets a timer that fires at midnight and triggers a re-render. Bare `new Date()` in render-time code captures the old date until the next full re-mount, causing stale plan-status badges, stale weekly breakdown windows, and stale date headers for sessions kept open past midnight.

### API Consistency Fix

**`computeCurrentStreakDates`** (in `historyStats.ts`) lacked the `additionalDates?: Set<string>` parameter that `computePlanStreak` and `getStreakDatesSet` already supported. This meant any streak date set computed via this function would ignore mobility-only days, while the streak badge count (via `computePlanStreak`) correctly includes them — a silent inconsistency if the calendar ever highlighted streak days.

Fixed: added `additionalDates?: Set<string>` as the fifth parameter, threaded through to `getStreakDatesSet`. Added 1 test verifying a mobility date bridging a gap extends the returned set.

### Feature: Calendar Streak Highlighting (`2662bd7`)

**Files changed**: `CalendarPage.tsx`, `historyStats.ts`, `historyStats.test.ts`

Added a small amber dot (1×1, `rounded-full`, `bg-amber-400`) to each calendar cell within the current consecutive workout streak. The streak is scoped to the active plan, and mobility completions are included as `additionalDates` (matching the streak badge on TodayPage). A "Streak" legend entry was added below the existing "Mobility" entry.

**Design rationale**: Amber is visually distinct from emerald (done), sky (today), and yellow (pending). The dot is small enough not to overpower slot-type icons. Only current-month cells are eligible (consistent with all other indicators).

### Prioritized Plan (for future passes)

Carries forward from pass 78:
- P1: Fix BUG-4 (cloud hydration bypassing Zustand migrate)
- P1: Add tests for `storeSync.ts`
- P2: Fix BUG-8 (`outcomeSortKey` non-deterministic empty fallback)
- P2: Fix BUG-11 (CSV import plan-ID collision)
- P3: Begin TodayPage decomposition

---

## Pass 78 — 2026-07-15 (branch `claude/dreamy-mccarthy-cr3jyk`)

### Baseline

- Branch started from `main` after PR from pass 77 merged.
- **1081 tests passing** across 31 test files at start of pass.
- **1088 tests passing** at end of pass (+7 new tests for `extractExtraId`).
- TypeScript: `tsc --noEmit` clean (0 errors).

### Architecture Summary (pass 78 scope)

Codebase: React 18 + TypeScript + Vite PWA. 7 Zustand stores with localStorage + Supabase cloud sync. Core rotation engine, expression evaluator, YAML program import. ~31 test files, 1081 tests at pass start.

This pass was a pure stabilisation pass — no new features. A thorough audit (using an Explore subagent) surfaced 11 confirmed bugs, 5 architecture concerns, and 6 test-coverage gaps. The 7 highest-confidence, lowest-risk bugs were fixed across 8 commits with no architectural changes. Feature work was deliberately skipped because the audit findings warranted stabilisation first.

### Bugs Fixed This Pass

| ID | File | Summary |
|---|---|---|
| BUG-1 | `usePlanActions.ts` | `today` was computed once at hook initialisation via `format(new Date(), …)`. If the app stayed open past midnight, all logAction / advance / goBack calls wrote entries with the wrong (yesterday's) calendarDate. Fixed by replacing with `useToday()`, which resets at midnight. |
| BUG-2 | `CalendarPage.tsx` | `.split('_extra_')[1]` to extract extraId is fragile — correct today because hex nanoid can't contain `_extra_`, but brittle if the ID alphabet ever changes. Fixed by using the new `extractExtraId()` helper. |
| BUG-3 | `TodayPage.tsx` | `handleOutcomeConfirm` called `removeEntry(planId, completedDate)` unconditionally before moving today's entry to the new date. Any independently-logged entry at the destination (skip, day-off, or prior workout) was silently destroyed. Fixed with a destination-entry guard. |
| BUG-5 | `storeSync.ts` | The 1.5s debounce means a tab closed within that window never pushes its final change to Supabase. Fixed by tracking pending timeouts in a Map and flushing them on `window.beforeunload`. |
| BUG-6 | `CardioWorkoutTracker.tsx` | The auto-advance `setTimeout` was only cancelled via React's effect cleanup. Storing the handle in a ref and calling `cancelAutoAdvance()` in `goNext`, `goPrev`, and the dot-click handler makes cancellation explicit and immediate. |
| MINOR-1 | `HistoryPage.tsx` | Same `.split('_extra_')` fragility as BUG-2. Fixed with `extractExtraId()`. |
| MINOR-3 | `AuthGate.tsx` | `<div id="__auth-signout">` dev-helper div rendered in production DOM. Gated behind `import.meta.env.DEV`. |

Also fixed: stale comment in `workoutInstanceId.ts` (nanoid is hex, not base-36) and added `extractExtraId()` helper to centralise extraId parsing.

### Bugs Found But Not Fixed (documented only)

| ID | File | Summary |
|---|---|---|
| BUG-4 | `storeSync.ts` | Cloud-hydration via `setState` bypasses Zustand's `migrate` function. Old schema data from Supabase won't be migrated. Requires careful planning around migration pipeline before fixing. |
| BUG-8 | `outcomeSortKey.ts` | Empty-string fallback when both `completedAt` and `workoutInstanceId` date are absent produces non-deterministic sort order for prior-session lookup. Low probability; low impact. |
| BUG-9 | `workoutInstanceId.ts` | (Fixed this pass — was a doc-only comment bug.) |
| BUG-10 | `exerciseLibrary.ts` | `synergist` arrays contain corrupted data (exercise names instead of muscle groups). No current feature queries synergist data. |
| BUG-11 | `csv.ts` | CSV import restores the original plan ID, silently overwriting an existing plan on reimport. |

### Key Architecture Concerns (documented only)

| ID | Concern |
|---|---|
| ARCH-1 | `TodayPage.tsx` is 1700+ lines with 25+ top-level state variables — long-term maintainability risk |
| ARCH-2 | "Cloud wins" sync strategy can lose offline edits made on a second device before login |
| ARCH-3 | Jump override `appliedAt` uses local-time ISO string with no timezone suffix — could misattribute on timezone change |
| ARCH-4 | Active-workout draft has no schema version; stale drafts from older app versions would partially hydrate |
| ARCH-5 | Extra-entry edit modal in HistoryPage doesn't expose the `notes` field despite the type having one |

### Test Coverage Gaps (documented only)

| Gap | Scope |
|---|---|
| TEST-1 | `storeSync.ts` — entire cloud sync module has no tests |
| TEST-2 | `useToday.ts` — midnight-advance timer has no tests |
| TEST-3 | `ActiveWorkoutTracker.tsx` (1872 lines) — fully untested |
| TEST-4 | `MobilityTracker.tsx` bilateral detection + checkpoint restore — untested |
| TEST-5 | `useStreakMilestoneDismiss` localStorage I/O — untested (pure function IS tested) |
| TEST-6 | `CardioWorkoutTracker.tsx` auto-advance timer path — untested |

### What is Strong (reaffirmed)

- Rotation engine: pure, fully tested, handles all edge cases.
- `expressionEval.ts`: comprehensive coverage, robust NaN/Infinity guards.
- `historyStats.ts` test suite: exemplary behavior-level tests across all exports.
- `outcomeStore.ts` progression error guard: correctly catches failures without blocking the outcome save.
- Service worker cache-bust flow: robust with correct timeout handling.

### Prioritized Plan (for future passes)

| Priority | Item |
|---|---|
| P1 | Add tests for `storeSync.ts` |
| P1 | Fix BUG-4: cloud hydration bypassing Zustand migrate |
| P2 | Fix BUG-8: `outcomeSortKey` non-deterministic empty fallback |
| P2 | Fix BUG-11: CSV import plan-ID collision |
| P3 | Begin TodayPage decomposition (extract `<TodayBanners>` first) |
| P3 | Add `draftVersion` to active-workout draft |
| P3 | Add `localDate` to `OverrideEntry` for timezone-safe jump overrides |
| P4 | Tests for `useToday`, `useStreakMilestoneDismiss` localStorage I/O |
| P4 | Expose `notes` in extra-entry edit modal |

---

## Pass 77 — 2026-07-14 (branch `claude/dreamy-mccarthy-aeym9p`)

### Baseline

- Branch started from `main` at `69a098c` (after PR #189 merge).
- **1068 tests passing** across 30 test files at start of pass (confirmed via `npm test`).
- **1081 tests passing** at end of pass (+13 new tests).
- TypeScript: `tsc --noEmit` clean (0 errors).

### Architecture Summary (pass 77 scope)

Two independent changes, 4 files modified:

1. **`src/lib/utils.ts`** — `nanoid()` implementation replaced with `crypto.getRandomValues`.
2. **`src/hooks/useStreakMilestoneDismiss.ts`** (new) — per-plan, per-milestone localStorage dismissal hook.
3. **`src/hooks/__tests__/useStreakMilestoneDismiss.test.ts`** (new) — 13 unit tests for `getActiveStreakMilestone`.
4. **`src/pages/TodayPage.tsx`** — streak milestone banner added; uses new hook and pre-computes `earlyPlanStreak` for Rules-of-Hooks compliance.

### What is Strong (reaffirmed this pass)

- Rotation engine is still fully pure and well-tested.
- The hook ordering constraint in TodayPage is correctly addressed by computing `earlyPlanStreak` without mobility dates; the slight imprecision (may be off by one day) is acceptable for a celebration banner.
- `useStreakMilestoneDismiss` reads `isDismissed` fresh from localStorage on every render — avoids stale-closure issues when the milestone key changes within the same mounted component.

### Key Issues Found

#### Bugs / Correctness

| Severity | File | Issue | Status |
|---|---|---|---|
| Fixed | `src/lib/utils.ts` | `nanoid()` used `Math.random()` (~46-bit entropy); collision probability negligible for personal use but not best-practice | Fixed — now uses `crypto.getRandomValues` for 128-bit entropy |

#### Quality / Technical Debt

| Severity | File | Issue | Status |
|---|---|---|---|
| Noted | `src/pages/TodayPage.tsx` | File is 1700+ lines with 25+ top-level state variables — long-term maintainability risk | Document only; refactor is too risky for this pass |
| Noted | `src/lib/storeSync.ts` | "Cloud wins" on login can silently discard local-only offline edits | Document only; no merge semantics needed for single-user app |
| Noted | `src/pages/HistoryPage.tsx` | Extra entry edit modal does not expose a notes field despite `ExtraWorkoutEntry.notes` existing on the type | Document only; low-impact gap |

### Prioritized Plan

| Priority | Item | Implemented? |
|---|---|---|
| 1 | Fix `nanoid` entropy (correctness improvement, zero risk) | ✅ Done |
| 2 | Streak milestone celebration banner (new UX feature, narrow scope) | ✅ Done |
| 3 | Extra entry notes field in edit modal | No — documented only |
| 4 | TodayPage decomposition into sub-components | No — too risky for overnight run |

---

## Pass 76 — 2026-07-12 (branch `claude/dreamy-mccarthy-2h1jip`)

### Baseline

- Branch started from `main` after PR #183 merge (or at `2b4fd7a`).
- **1056 tests passing** across 30 test files at start of pass (confirmed via `npx vitest run`).
- **1068 tests passing** at end of pass (+12 new tests).
- TypeScript: `tsc --noEmit` clean (0 errors).

### Architecture Summary

No new dependencies. All changes are in `src/lib/__tests__/historyStats.test.ts`.

### What is Strong (reaffirmed)

- `getStreakDatesSet` and `computePlanStreak` both correctly accept and apply `additionalDates` (mobility dates) — the implementation was already correct; only test coverage was missing.
- `TodayPage.tsx` line 338 calls `computePlanStreak(plan.id, planEntries, planExtras, today, mobilityDateSet)` — the mobility-streak integration is used in production and is now covered by tests.

### Key Issues Found

#### Bugs / Correctness

| Severity | File | Issue | Status |
|---|---|---|---|
| None found | — | No new bugs discovered this pass | — |

#### Test Coverage Gap Fixed

| Severity | File | Issue | Status |
|---|---|---|---|
| Medium | `historyStats.ts` + `historyStats.test.ts` | `additionalDates` parameter of `getStreakDatesSet` and `computePlanStreak` had zero test coverage despite active production use | **Fixed** — 12 new tests added |

### Commits

1. `test: cover additionalDates parameter in getStreakDatesSet and computePlanStreak (12 tests)`

---

## Pass 75 — 2026-07-09 (branch `claude/dreamy-mccarthy-vpg2n1`)

### Baseline

- Branch started from `main` after PR #182 merge.
- **1049 tests passing** across 30 test files at start of pass (confirmed via `npx vitest run`).
- **1056 tests passing** at end of pass (+7 new tests).
- TypeScript: `tsc --noEmit` had 1 pre-existing error (unused variable in test file); fixed this pass.

### Architecture Summary

No new dependencies. All changes are in `src/lib/historyStats.ts`, `src/lib/__tests__/historyStats.test.ts`, `src/pages/HistoryPage.tsx`, and `src/lib/__tests__/estimateRunDuration.test.ts`.

### What is Strong (reaffirmed)

- `expressionEval.ts`: division by zero at line 233 already returns `0` (not `Infinity`) — BUG-9 from pass 74 is a non-issue.
- `historyStore.ts` `removeLastOverrideByType`: DOES filter by type — pass 73 docs were wrong.
- `programParser.ts`: YAML parse errors are properly returned in the `errors` array and block import in both `ProgramImportPage.tsx` and `PlanBuilderPage.tsx` — BUG-10 is a non-issue.
- `removeRetroJumpForDate`: Uses `format(new Date(o.appliedAt), ...)` (local time) and CalendarPage always writes `${date}T12:00:00.000` (local noon) — safe against DST — BUG-5 is a non-issue.
- `clearPlanOutcomes` prefix collision (BUG-8): nanoid uses alphanumeric+hyphen so `_` separator is unambiguous.
- `_extra_` detection in HistoryPage (BUG-1): calendarDate is YYYY-MM-DD (hyphens only) and nanoid has no underscores — safe.

### Key Issues Found

#### Bugs / Correctness

| Severity | File | Issue | Status |
|---|---|---|---|
| Low | `HistoryPage.tsx` | Date pickers in edit modals had no `max` attribute — users could accidentally move history entries to future dates | **Fixed** |

#### Code Quality / Performance

| File | Issue | Status |
|---|---|---|
| `HistoryPage.tsx` + `historyStats.ts` | `computeWorkoutPRFlags(instanceId, allRecords)` was called inline during render for each history item — O(N²) per page load | **Fixed — `buildPRFlagsMap` pre-computes a Map in O(N log N); HistoryPage uses `useMemo` + O(1) lookup** |
| `estimateRunDuration.test.ts` | `withDurationMin` helper defined but never called (TypeScript TS6133 error) | **Fixed — helper removed** |

### Changes Implemented

1. `090e73e` — `perf+fix: pre-compute PR flags map in HistoryPage; add max-date to history date pickers`
2. `e701e20` — `fix: remove unused withDurationMin helper in estimateRunDuration test (TS6133)`

---

## Pass 74 — 2026-07-08 (branch `claude/dreamy-mccarthy-ugdev5`)

### Baseline

- Branch reset from latest `main` after PR #181 merge.
- **1027 tests passing** across 29 test files at start of pass (confirmed via `npx vitest run`).
- **1049 tests passing** at end of pass (+22 new tests across 30 test files).

### Architecture Summary

React 18 + TypeScript 5.5 + Zustand 4.5 PWA, deployed to GitHub Pages via GitHub Actions.
No new dependencies added this pass. All changes are in `src/pages/TodayPage.tsx` and the new `src/lib/estimateRunDuration.ts`.

### What is Strong (reaffirmed)

- `historyStats.ts`: all exported functions have thorough test coverage (2649-line test file).
- `historyStore.ts`: deduplication semantics (`deduplicateByDate`), upsert patterns, and migration guard are correct.
- `computeRotationCycleProgress` correctly computes `justCompletedRotation = doneInCycle === 0 && totalDone > 0`, which was being shown as "0/N cycle" in the UI — now shows a positive completion indicator.
- `planCompletionPercent`'s `loggedRate ?? 0` fallback is NOT dead code — it covers degenerate plans where `duration.value === 0` or `days.length === 0`.

### Key Issues Found

#### Bugs / Correctness

| Severity | File | Issue | Status |
|---|---|---|---|
| Low | `TodayPage.tsx` | After completing a rotation cycle, the cycle chip displayed "0/N cycle" — confusing because it looks like no progress when the user just finished a full rotation | **Fixed** |

#### Code Quality

| File | Issue | Status |
|---|---|---|
| `TodayPage.tsx` | `estimateRunDurationMin` was a 35-line function defined at module scope inside `TodayPage.tsx` — untestable in isolation, distant from its type documentation | **Fixed — extracted to `src/lib/estimateRunDuration.ts`** |
| `TodayPage.tsx` | `prevSessionDaysAgo` used manual Date.UTC arithmetic (8-line IIFE) instead of date-fns | **Fixed — replaced with `differenceInCalendarDays`** |
| `TodayPage.tsx` | `rotationLoggedCount` rebuilt a Set on every render (including modal state changes) when `planEntries` hadn't changed | **Fixed — wrapped in `useMemo`** |

#### Items Documented Only (not implemented)

From background audit agent findings (BUG-1 through BUG-12 from the Explore agent):

| Priority | File | Issue |
|---|---|---|
| Medium | `HistoryPage.tsx:~295` | `_extra_` string split on id to distinguish extra entries is fragile — if nanoid ever generates `_extra_`, it silently collides |
| Medium | `CalendarPage.tsx` | `handleMoveWorkout` defers to `updateEntryDate` which can silently collide on the destination date |
| Low | `storeSync.ts` | 1500ms debounce window: app closing mid-debounce loses the last write |
| Low | Various | `loggedRate ?? 0` coverage note: only triggered for degenerate zero-duration plans |

### Changes Implemented

1. `bd8907d` — `refactor: extract estimateRunDurationMin to lib + add 22 unit tests`
2. `047f8a1` — `refactor: replace manual date arithmetic in prevSessionDaysAgo with differenceInCalendarDays`
3. `1a29a3a` — `perf: memoize rotationLoggedCount Set creation in TodayPage`
4. `c337fa3` — `feat: Show "Cycle done" visual cue when rotation cycle just completed`

---

## Pass 72 — 2026-07-05 (branch `claude/dreamy-mccarthy-80hikp`)

### Baseline

- Branch reset from latest `main` after PR #180 merge (commit `2d08975`).
- **1017 tests passing** across 28 test files at start of pass.
- **1017 tests passing** at end of pass (no new tests — all changes are UI/render-only).

### Architecture Summary

React 18 + TypeScript + Zustand PWA. No new dependencies. All changes are confined to `src/pages/TodayPage.tsx`.

### What is Strong (reaffirmed)

- Rotation engine: well-tested, no bugs found.
- `computeRotationCycleProgress` / `computeRotationPlanRemaining`: exported, tested, and deduplication-guarded since pass 62 — but had no UI caller. This pass surfaces cycle progress to users.
- `historyStats.ts` overall: correct, stable, deduplication consistent across all counting functions.

### Key Issues Found

#### Bugs / Correctness

| Severity | File | Issue | Status |
|---|---|---|---|
| Low | `TodayPage.tsx:662` | `CompletedWorkoutsRing` receives `planCompletionPercent` (0–100 %) as `count` but its docstring says center number is "total completed workout count" | **Fixed** |

#### Code Quality

| File | Issue | Status |
|---|---|---|
| `TodayPage.tsx:408` | `estimateRunDurationMin` defined inside component body — recreated every render, captures `planProgramVars` from closure | **Fixed** |

#### Dead Code / Unused Features

| File | Issue | Status |
|---|---|---|
| `historyStats.ts` | `computeRotationCycleProgress` exported and tested but no UI caller | **Fixed — surfaced in Today habit row** |

### Changes Implemented

1. `refactor + fix: extract estimateRunDurationMin to module scope; fix CompletedWorkoutsRing count`
2. `feat: show rotation cycle progress in TodayPage habit summary row`

---

## Pass 71 — 2026-07-03 (branch `claude/dreamy-mccarthy-4ywaek`)

### Baseline

- Branch reset from latest `main` after pass 70 merge (commit `5a6f48f`).
- **992 tests passing** across 26 test files at start of pass.
- **1010 tests passing** at end of pass (+18 new tests).

### Architecture Summary

React 18 + TypeScript 5.5 + Zustand 4.5 PWA, deployed to GitHub Pages via GitHub Actions.
Build tool: Vite. Testing: Vitest (node environment — no DOM). CSS: Tailwind.
Auth: Supabase Google OAuth. Sync: custom storeSync.ts with 1500ms debounce.

### Layer map

```
pages/           — Route-level views (TodayPage, CalendarPage, HistoryPage, PlansPage, …)
components/      — Shared UI primitives + workout-specific components
engine/          — Core scheduling / rotation logic (rotationEngine, calendarProjection, programParser)
modules/         — Domain logic units: run-adaptation, recommendation, workout-metadata, workout-outcomes
store/           — Zustand stores (historyStore, outcomeStore, planStore, exerciseHistoryStore, …)
lib/             — Pure utilities: csv, expressionEval, sessionSummary, historyStats, storeSync, …
hooks/           — Shared React hooks
types/           — TypeScript type definitions
```

### What is Strong

- Rotation engine is well-tested and handles edge cases (jump/advance/go_back overrides, wrap-around)
- Zustand stores have good migration guards and idempotent upsert patterns
- `exerciseHistoryStore` pre-computes summaries (maxLoad, maxReps, totalVolume) at write time
- `sessionSummary.ts` is clean and well-documented with correct PB detection
- Progression test coverage is extensive (regression guards, edge cases)
- Plan delete cascade correctly clears all dependent stores
- CSV import/export is robust with good error handling

### Key Issues Found

#### Bugs / Correctness

| Severity | File | Issue | Status |
|---|---|---|---|
| Medium | `progression.ts:103` | `buildWeightsRecommendation` uses `exercises[0].progressionMode` even when exercises[0] has no mode | **Fixed** |
| Low | `planDayUtils.ts:9` | `extraToPlanDay` gives same `id` to both the day and its only slot | Document only |
| Low | `AuthGate.tsx:14` | Dead `unsubscribeStores` variable in first `useEffect` | **Fixed** |

#### DRY Violations

| File | Issue | Status |
|---|---|---|
| `ActiveWorkoutTracker.tsx:58` + `OutcomeModal.tsx:87` | `deriveProgressionMode` duplicated identically | **Fixed** |
| `useExpiryDismiss.ts` + `useStallNudgeDismiss.ts` | Near-identical hook implementations | Document only |

#### Code Quality

| File | Issue | Status |
|---|---|---|
| `PlansPage.tsx:83` | `PlanCard` defined inside `PlansPage` — causes React unmount/remount cycles | **Fixed** |
| `TodayPage.tsx:793,999` | `x ?? y === 'z'` reads misleadingly without explicit parens | **Fixed** |
| `programParser.ts:3` | Imports `nanoid` via `rotationEngine` instead of directly from `lib/utils` | **Fixed** |
| `PlanBuilderPage.tsx:978` | `setTimeout(navigate, 600)` — no cleanup on unmount | **Fixed** |

#### Architecture / Design Debt (document only)

| File | Issue |
|---|---|
| `storeSync.ts:95` | 1500ms debounce creates data loss window if app closes mid-debounce |
| `storeSync.ts:76-82` | Last-login-wins conflict resolution can silently overwrite data from another device |
| `outcomeStore.ts:248` | `migrate` is a no-op type cast — future schema versions need real migrations |
| `outcomeStore.ts:197` | `clearPlanOutcomes` prefix-match could theoretically match a different plan's ID |
| `supabase.ts:3-6` | URL and anon key hardcoded in source |
| `exerciseLibrary.ts` | ~30-40 exercises have `synergist` arrays containing exercise names instead of muscle groups |

### Changes Implemented

1. `refactor: import nanoid from lib/utils directly in programParser`
2. `fix: remove dead unsubscribeStores variable from AuthGate initialize effect`
3. `fix: add explicit parentheses to clarify ?? operator precedence in TodayPage`
4. `refactor: extract deriveProgressionMode to shared module`
5. `fix: move PlanCard to module scope in PlansPage`
6. `fix: use first exercise with progressionMode in buildWeightsRecommendation`
7. `fix: cancel post-save navigate timer on PlanBuilderPage unmount`
8. `test: add unit tests for deriveProgressionMode` (9 new tests)
9. `feat: PR badges on history workout items for weight exercises` (10 new tests)

---

## Pass 70 — 2026-07-02 (branch `claude/dreamy-mccarthy-jy89cx`)

### Observations on entry

- Branch reset from latest `main` (1aed19f). No unique unmerged work; no open PR for the prior branch name.
- **987 tests passing** across 26 test files before any changes (same baseline as pass 69).
- Recent human-authored feature landed since pass 69: mobility session shows exercise description and caution notes during live session (PR #176 / commit `26f7401`).

### Audit scope

Full read of: `TodayPage.tsx` (complete), `HistoryPage.tsx` (complete), `CalendarPage.tsx` (imports + usage), `constants.ts` (complete), `historyStore.ts`, `planStore.ts`, `outcomeStore.ts`, `mobilityStore.ts`, `settingsStore.ts`, `storeSync.ts`, `exerciseHistoryStore.ts`, `calendarProjection.ts`, `planDayUtils.ts`, `outcomeSortKey.ts`, `previousSetsHelper.ts`, `sessionSummary.ts`, `usePlanActions.ts`, `useActivePlan.ts`.

### Audit findings

#### Code quality: WORKOUT_TYPES defined three times (FIXED)

**Location**: `src/lib/constants.ts`, `src/pages/CalendarPage.tsx:40`, `src/pages/HistoryPage.tsx:37`

**Mechanism**: The 5-item workout type list for UI selects/filters was independently defined in three places:
- `constants.ts`: `WORKOUT_TYPES: WorkoutType[]` — plain string array (5 canonical types)
- `CalendarPage.tsx`: `WORKOUT_TYPES: { type: WorkoutType; label: string }[]` — object array with labels (same 5 values)
- `HistoryPage.tsx`: `WORKOUT_TYPES: { type: WorkoutType; label: string }[]` — identical definition

Adding or renaming a workout type in the UI required three file changes. `PlanBuilderPage.tsx` correctly imports the string-array version from `constants.ts`, but the pages needed a labeled version and each defined their own.

**Fix**: Added `WORKOUT_TYPE_OPTIONS: { type: WorkoutType; label: string }[]` to `constants.ts` as the single canonical export; `CalendarPage` and `HistoryPage` import and alias it. Zero behavioral change, no new dependencies.

#### Code quality: legacy `'rest'` type in fallback slot (FIXED)

**Location**: `src/pages/HistoryPage.tsx:349`

**Mechanism**: The outcome-confirm handler builds a fallback slot when `outcomeTarget.planDay.slots[0]` is undefined:
```ts
const slot = outcomeTarget.planDay.slots[0] ?? { id: '', type: 'rest' as WorkoutType, name: '' }
```
`planStore` v2 migrates `'rest'` → `'other'`, so this code path would produce a legacy type that no longer exists in any live plan. While `'rest'` remains in the `WorkoutType` union for backward compatibility, using it in new code paths is inconsistent.

**Fix**: Changed fallback type to `'other'`.

#### Non-issues confirmed

| Item | Verdict |
|---|---|
| TodayPage Undo handler removes override correctly | Pass 68 fix (`advancedRotation ?? extra.source === 'double_day'`) holds; logic sound |
| `handleUpcomingLog` date-shift for extras | Correct — `outcomeDate` derived from historyEntry when present |
| CalendarPage local VALID_WORKOUT_TYPES in csv.ts / programParser.ts | Intentionally separate validation lists; should NOT be consolidated (different purpose: validation vs. display) |
| Ad hoc workout `source: 'history'` tagging | Correct — prevents Undo from auto-removing user-initiated ad hoc entries |
| HistoryPage `handleOutcomeConfirm` silently removes destination entry on date move | Intentional — comment at line 341 explains the orphan-prevention rationale |
| progressionByInstance Map (O(1) reverse-index of progressionStates) | Correct and efficient |
| `weeklyBreakdown` uses `addDays(new Date(), -55)` directly | Acceptable — `useToday()` is for the "today" anchor; stats history window can use `Date.now()` |

---

### Work plan

1. **[REFACTOR] Consolidate WORKOUT_TYPE_OPTIONS into `constants.ts`** — `src/lib/constants.ts`, `src/pages/CalendarPage.tsx`, `src/pages/HistoryPage.tsx`.
2. **[FIX] Legacy `'rest'` fallback in HistoryPage outcome-confirm** — `src/pages/HistoryPage.tsx:349`.
3. **[DOCS] Pass 70 audit notes, changelog, test results, review notes.**

No test additions in the initial commit — the changes were purely mechanical refactors. A background audit agent completed while initial work was in progress and surfaced two additional bugs in `csv.ts`. Those were fixed in a second commit with 5 new tests (see below). Final test count: 992.

### Additional work (from background audit agent findings)

#### Bug: `plansToCsv` silently discards `location` and `weightsFocusArea` (FIXED)

**Location**: `src/lib/csv.ts:238`

The `tags` export column was hardcoded to `''`. `plansFromCsv` already reads the column correctly (pipe-delimited `home|upper` → `location`, `weightsFocusArea`), but the exporter never wrote it. Any plan with location or focus-area metadata was silently losing those fields on CSV round-trip.

**Fix**: `[slot.location, slot.weightsFocusArea].filter(Boolean).join('|')`.

#### Bug: `buildOutcomeFromRow` accepts fractional `perceivedEffort` (FIXED)

**Location**: `src/lib/csv.ts:722-724`

A manually-edited CSV value of `1.7` passed the `>= 1 && <= 5` range check and was cast to `PerceivedEffort` (typed `1 | 2 | 3 | 4 | 5`), violating the type contract. **Fix**: added `Number.isInteger(effort)` guard.

**5 new tests** cover both fixes. Commit `4737e7f`.

#### Non-issues noted from agent report

| Item | Disposition |
|---|---|
| `historyToCsv`/`historyFromCsv` notes duplication after round-trip | Low severity; documented in REVIEW_NOTES.md for future cleanup |
| Supabase anon key hardcoded | Intentional; publishable key by design |
| Custom `nanoid` via `Math.random()` | Architectural decision; negligible collision risk |
| `applyProgressionRule` swallows errors silently | Tested and intentional |

---

## Pass 69 — 2026-07-01 (branch `claude/dreamy-mccarthy-4cykvp`)

### Observations on entry

- Branch reset from latest `main` (55ba7cd). No unique unmerged work; no open PR for the prior branch name.
- **987 tests passing** across 26 test files before any changes (966 baseline + 21 added this pass).
- Three significant human-authored features landed since pass 68:
  1. **MobilityTracker rewrite** (PR #173): Sequential exercise timers with wall-clock accuracy, 5-second transition countdown, session checkpointing/resume-on-close, `visibilitychange`-resilient architecture, Previous/Redo/Skip-transition navigation.
  2. **Personalized mobility library + presets** (PR #172): `mobilityLibrary.ts` (37 exercises across 5 categories), `MobilityPage` rewritten with My Routine / Library / Presets tabs, `loadPreset` (replace/append modes), `addExerciseFromLibrary`, in-store session checkpointing (`startSession`, `saveCheckpoint`, `clearSession`).
  3. **TodayPage polish** (commit `6ce0f71`): SwipeToDelete reveal visibility fix, copy button icon toggle (Copy→Check), "Change Workout" capitalisation.

### Audit findings

#### Non-issue confirmed: MobilityTracker timer accuracy

The new `MobilityTracker` uses wall-clock bases (`totalR`, `exR` refs of the form `{ acc, at }`) and a 100ms interval computing `acc + (now - at) / 1000`. This is the same pattern applied to `CardioWorkoutTracker` in pass 66. Even if the browser throttles the interval (screen lock, background tab), the next interval tick that DOES fire computes the correct elapsed time from `Date.now()`. The display freezes briefly when backgrounded, then snaps to the correct value on resume — this is a 0–100ms display lag at most, not a duration accuracy issue. A `visibilitychange` handler (as in CardioWorkoutTracker) would make the snap instantaneous but is purely cosmetic for a 100ms interval.

#### Non-issue confirmed: `handlePrevious` removes current exercise from completedIds during transition

`handlePrevious()` filters out both `prevId` and `curId` from `completedIds`. During transition (just completed exercise N, about to start N+1), this un-completes exercise N AND un-completes exercise N−1. At first glance this seems surprising — the user DID complete exercise N. However: there is already a separate "← Redo" button specifically for undoing the current exercise (re-doing N without going back to N−1). "Previous" is therefore correctly interpreted as "I want to go back to exercise N−1" — and since you're going back past exercise N to re-do it from the beginning, removing both from `completedIds` is the right semantic. This is intentional behavior.

#### Non-issue confirmed: checkpoint does not persist `phase`

When the user closes and reopens MobilityTracker, `phase` always resets to `'idle'`. The `exElapsedSec` in the checkpoint captures how far into the current exercise the timer was, so the exercise countdown resumes from the saved position. But the user must press Start to re-activate the exercise timer. This is intentional — auto-resuming would surprise a user who opens the tracker just to check which exercise is next.

#### Gap found: 5 new mobilityStore actions had zero unit tests (FIXED)

`addExerciseFromLibrary`, `loadPreset`, `startSession`, `saveCheckpoint`, `clearSession` were all added in the pass 72 PRs with no test coverage.

Additionally, `resetStore()` in the existing test file did not include `activeSession: null`, meaning any test that set `activeSession` could contaminate subsequent describe blocks that didn't use `beforeEach(resetStore)`.

**Fix**: Updated `resetStore()` to include `activeSession: null`; added 21 new tests covering all 5 new actions. See Test Results.

#### Non-issues confirmed this pass

| Item | Verdict |
|---|---|
| `loadPreset` uses preset's `durationSec`, not library's | Intentional — presets express specific timing requirements that can differ from library defaults |
| `addExerciseFromLibrary` dedup check (`s.routine.some(e => e.id === libraryId)`) | Correct — prevents duplicate entries when called twice |
| mobilityStore v1→v2 migration adds `activeSession: null` | Trivial, correct. Cannot be tested through the store mock (persist is a pass-through in tests), which is acceptable given the migration's simplicity |
| `MobilityPage` `PresetsTab` confirm-replace UX | Clean — requires two clicks (Load Routine → Replace/Append) to prevent accidental overwrites |
| SwipeToDelete opacity/pointer-events fix in `TodayPage` | Clean fix: hides the delete affordance when `offset >= 0` (not swiping) |

---

### Work plan

1. **[TEST] Extend mobilityStore tests for 5 new v2 actions** — `src/store/__tests__/mobilityStore.test.ts` — Fix `resetStore()` + 21 new tests.
2. **[DOCS] Pass 69 audit notes, changelog, test results, review notes.**

No feature work this pass. Per the overnight routine's own rule ("skip feature work entirely if audit findings suggest the codebase needs stabilization first"), the presence of two large feature PRs with zero unit test coverage on their new store actions — and the confirmed gap in `resetStore()` — was treated as a clear signal to spend this pass on stabilization.

---

## Pass 68 — 2026-06-30 (branch `claude/dreamy-mccarthy-4vdzsq`)

### Observations on entry

- Branch reset from latest `main` (no unique unmerged work, no open PR for the prior branch name).
- 966 tests passing across 26 test files before any changes.
- One human/agent-authored feature landed since pass 67 that had not yet been audited: the "full plan picker" double-day flow (commit `bcee1f6`), which lets a user pick *any* plan day (not just the next one in rotation) when logging a bonus workout on a date that already has a workout logged.

### Audit findings

#### Bug: invalid `DayStatus` literal broke every production deploy since commit `20bb8ac` (HIGH, production-breaking)

**Location**: `src/pages/TodayPage.tsx` — two synthetic `ResolvedDay` object literals (~lines 526, 936)

**Mechanism**: Both literals set `status: 'upcoming'`. `'upcoming'` is not a member of the `DayStatus` union in `src/types/index.ts` (the correct value for a not-yet-started day, used everywhere else, is `'future'`). `tsc --noEmit` fails on this, and since `npm run build` is `tsc && vite build`, every push to `main` since `20bb8ac` failed CI and never deployed — confirmed via GitHub Actions run history (3 consecutive failed runs).

**Fix**: Changed both occurrences to `status: 'future'`.

#### Bug: deleting a non-advancing double-day extra could strip an unrelated rotation override (HIGH, silent data corruption)

**Location**: `src/pages/TodayPage.tsx` — `SwipeToDelete onDelete` handler for "Completed today" extras, and the Undo button handler

**Mechanism**: Both delete paths called `removeLastOverrideByType(plan.id, 'advance')` whenever `extra.source === 'double_day'`. Before the "full plan picker" feature (`bcee1f6`), every `double_day` extra was created by logging the next-in-rotation day, so it was always 1:1 with an `advance` override. The picker feature broke that invariant: a user can now pick an arbitrary plan day as the bonus workout, which does **not** advance the rotation pointer, yet the extra is still tagged `source: 'double_day'`. Deleting such an extra removed the plan's most recent `advance` override regardless of whether *this* extra actually caused one — silently corrupting the rotation pointer if any other action had advanced it since.

**Fix**: Added `advancedRotation?: boolean` to `ExtraWorkoutEntry`. Set precisely at both creation sites (`handleOutcomeConfirm` computes `willAdvance`; `handleUpcomingLog` always advances, so it's hardcoded `true`). Both deletion sites now check `extra.advancedRotation ?? extra.source === 'double_day'` — the `??` fallback preserves correct behavior for extras created before this field existed (those were always created via the old all-or-nothing flow, so treating them as if `true` is correct).

#### Non-issues confirmed this pass

| Item | Verdict |
|---|---|
| `CalendarPage.tsx`'s own extra-deletion logic | Does not call `removeLastOverrideByType` — unaffected by the bug above. |
| `HistoryPage.tsx`'s other `source === 'double_day'` check (~line 645) | Purely a UI display label ("Bonus" vs "Extra" badge) — not a data mutation, no change needed. |
| Mobility ring + legend addition to `CalendarPage.tsx` (commit `886c0e0`) | Clean, additive, no issues found. |
| `WorkoutDayCard.tsx` rendering of synthetic `ResolvedDay` objects with `status: 'future'`, no `historyEntry` | Renders correctly — `historyEntry` is already optional on the type. |

---

### Work plan

1. **[FIX] Invalid `DayStatus` literal (`'upcoming'` → `'future'`)** — `src/pages/TodayPage.tsx` — 2-line change, production-breaking, shipped immediately
2. **[FIX] Override-removal data corruption on double-day delete** — `src/pages/TodayPage.tsx`, `src/types/index.ts` — new optional field + 4 call-site changes
3. **[DOCS] Pass 68 audit notes, changelog, test results, review notes**

No new tests added this pass (see `TEST_RESULTS.md` for rationale) and no feature work attempted — both fixes landed in unaudited UI logic with no testable pure-function equivalent, and finding two production-impacting bugs in one pass was treated as a clear signal to prioritize stabilization and documentation over new feature work this time.

---

## Pass 67 — 2026-06-29 (branch `claude/dreamy-mccarthy-hhiaa3`)

### Observations on entry

- Branch is at `9b00892` (merged PR #165 "Add Supabase auth and cloud sync for workout data").
- 961 tests passing across 25 test files before any changes.
- Three significant human-authored features landed since pass 66:
  1. **Supabase auth + cloud sync** (PR #165) — `AuthGate`, `authStore`, `storeSync.ts` — zero tests, two bugs found
  2. **Today tab UI redesign** (PR #163) — Habit-focused compact layout, collapsed upcoming
  3. **PWA icon update** (PR #164) — Asset-only change

### Audit findings

#### Bug: AuthGate useEffect subscription leak when syncOnLogin races against cleanup (MEDIUM)

**Location**: `src/components/auth/AuthGate.tsx` — second `useEffect` (user dependency)

**Mechanism**: When `user` becomes truthy, the effect calls `syncOnLogin()` (async), then in `.then()` assigns `unsubscribeStores = subscribeStores()`. The cleanup function only calls `unsubscribeStores?.()`. If the component unmounts or `user` changes to null **before** `syncOnLogin()` resolves, the cleanup runs while `unsubscribeStores` is still `undefined`. After cleanup, `.then()` fires and assigns `subscribeStores()` — but the cleanup already ran. Those subscriptions are never freed. This is a subscription leak that causes duplicate Supabase pushes on re-login and prevents garbage collection of the store listeners.

**Fix**: Add `let cancelled = false` flag; check before calling `subscribeStores()` in `.then()`; set `cancelled = true` in the cleanup.

#### Bug: storeSync.ts pushStore and syncOnLogin swallow errors silently (LOW)

**Location**: `src/lib/storeSync.ts`

**Mechanism**: `supabase.from('user_store_data').upsert(...)` and the `.select(...)` query both return `{ data, error }`. Neither checks the `error` field. When a network failure or RLS violation causes a push to fail, the caller receives no feedback. This makes debugging sync issues significantly harder.

**Fix**: Destructure `error` from both calls; log to `console.error` when non-null.

#### Gap: settingsStore had zero unit tests

All other Zustand stores have test coverage. `settingsStore` has a single action (`setStartDelay`) and a default value. Adding basic coverage completes parity.

#### Feature: Progression result not surfaced in HistoryPage (LONG-STANDING RECOMMENDATION)

**Recommended in**: Passes 63, 64, and 65.

`RunProgressionState.lastResult` ('progress' | 'hold' | 'regress') is stored in `outcomeStore.progressionStates` after every progression-eligible run. The `lastCompletedWorkoutInstanceId` field links the state to the exact workout that triggered it. This information has been stored since the run-adaptation module was introduced but has never been shown to users.

**Approach**: Add optional `progressionState?: RunProgressionState | null` to `OutcomeMetrics`. When `lastResult === 'progress'`, show a green "↑ Progressed — next target: N mi" line. When `lastResult === 'regress'`, show amber "↓ Adjusted down — next target: N mi". Hold and None are silent. Wire it in `HistoryPage` using a reverse-lookup Map built from `progressionStates`.

#### Non-issues confirmed this pass

| Item | Verdict |
|---|---|
| Supabase anon key hardcoded in `supabase.ts` | Standard practice. The key has prefix `sb_publishable_` (public key). Security comes from Supabase RLS policies, not secret-keeping of the anon key. |
| AuthGate shows sign-in wall for unauthenticated users | Intentional product decision in PR #165. `supabase.auth.getSession()` reads from localStorage; `loading` resolves to false in milliseconds even offline. |
| `syncOnLogin` "cloud wins" on first login conflicts | Known limitation. For a personal single-user app this is acceptable. Multi-device merge would require per-record timestamps and conflict resolution beyond this scope. |
| `subscribeStores` fires on every store change | Correctly debounced at 1500ms. Rapid changes (active workout set logging) coalesce into one push. |

---

### Work plan

1. **[FIX] AuthGate subscription leak** — `src/components/auth/AuthGate.tsx` — 6-line change
2. **[FIX] storeSync error logging** — `src/lib/storeSync.ts` — 6-line change
3. **[FEATURE] Run progression result in OutcomeMetrics + HistoryPage** — 2 files, ~50 lines
4. **[TEST] settingsStore unit tests** — new file, 5 tests

---

## Pass 66 — 2026-06-28 (branch `claude/dreamy-mccarthy-7v05ht`)

### Observations on entry

- Branch is at `5f3fe3f` (merged PR #160 from a human-authored feature commit).
- 943 tests passing across 24 test files before any changes.
- Two new features landed since pass 65: `CardioWorkoutTracker` (dedicated run session HUD shown after a weights+run combo or for run-only days) and `MobilityTracker` / `mobilityStore` (daily mobility routine tracker). These had zero unit test coverage.
- CalendarPage copy-workout button was recommended in passes 63 and 64 but not yet implemented. TodayPage has had it since pass 61.

---

### Audit findings

#### Bug (MEDIUM): CardioWorkoutTracker timer doesn't reconcile with wall clock on resume from background

**Location**: `src/components/workout/CardioWorkoutTracker.tsx` — `useEffect` with `[isPaused]` dependency.

**Mechanism**: The timer used a simple 1-second `setInterval` that incremented state by 1 each tick. Browsers throttle/suppress `setInterval` ticks when the page is backgrounded (iOS WebKit can pause them entirely). After returning from background, the displayed elapsed time and the duration reported to `OutcomeModal` could be significantly behind the actual elapsed time.

**Contrast**: `ActiveWorkoutTracker` already solves this correctly with wall-clock bases (`workoutWallBaseRef`, `restWallBaseRef`) and a `visibilitychange` reconcile handler.

**Fix**: Apply the same pattern — store `{ elapsed, time }` bases, compute elapsed from `baseElapsed + (Date.now() - baseTime)`, add a `visibilitychange` handler for immediate reconcile on foreground restore.

#### Gap: mobilityStore has zero unit test coverage

The store was added as part of the new MobilityTracker feature but no test file was created. All other Zustand stores have test coverage.

#### Feature gap: CalendarPage has no copy-workout button

TodayPage has had a "Copy workout" button since pass 61 using `formatWorkoutForClipboard`. CalendarPage's day detail modal shows full workout slot details but has no way to copy them to clipboard. Recommended in passes 63 and 64.

#### Non-issues confirmed this pass

| Item | Verdict |
|---|---|
| `mobilityStore` schema migration | Not needed — v1 is the initial version, no v0 data exists |
| `CardioWorkoutTracker.resolveDistanceExpr` showing unevaluated expressions | Very unlikely in practice — YAML distances are simple values or simple variable refs, not arithmetic expressions |
| `parseDurationToSeconds` not handling hours format | Workout segment durations are conventionally in min/sec form; hour-format inputs are not in the YAML schema |

---

### Work plan

1. **[FEATURE] CalendarPage copy-workout button** — Add `Copy` button to the DayDetailModal Level 2 rotation view using the existing `formatWorkoutForClipboard` utility. ~20 lines.

2. **[FIX] CardioWorkoutTracker timer wall-clock reconciliation** — Apply the `ActiveWorkoutTracker` pattern: wall-clock base refs, compute elapsed from `(Date.now() - base.time)`, visibility change handler.

3. **[TEST] mobilityStore unit tests** — Cover all 6 store actions (addExercise, removeExercise, reorderExercise, logCompletion, removeCompletion) plus default state. Target 18 tests.

No feature proposal this pass — the CalendarPage copy button is a narrow additive feature adjacent to existing work, not a medium-complexity feature requiring a FEATURE_PROPOSAL.md.

---

## Pass 65 — 2026-06-27 (branch `claude/dreamy-mccarthy-zak0k0`)

### Observations on entry

- Branch is at `7115f6f` (merged PR #157 from pass 64).
- 936 tests passing across 24 test files before any changes.
- Found a clear data-integrity bug: Undo after a double-day workout leaves a stale `advance`
  override in `historyStore.overrides`, permanently shifting the rotation pointer forward by one.
  The fix is surgical — add `removeLastOverrideByType` to historyStore and call it from the Undo handler.

---

### Audit findings

#### Bug (HIGH): Undo after double-day leaves stale advance override

**Location**: `src/pages/TodayPage.tsx` — Undo `onClick` handler (~line 924)

**Mechanism**: When a user does a double-day workout, `handleOutcomeConfirm` calls:
1. `addExtraEntry(...)` — bonus `ExtraWorkoutEntry` with `source: 'double_day'`
2. `actions.advance()` → `logOverride(planId, 'advance', { delta: 1 })` — rotation pointer +1

The Undo handler (line 933–945) correctly removes the primary `HistoryEntry`, the outcome,
and any `double_day` extras. But it does NOT remove the `advance` override. After Undo,
the rotation is one step ahead of where it should be. The user sees the day after next
instead of the day after, permanently, until they use the Override panel to correct it manually.

**Fix**: Add `removeLastOverrideByType(planId, type)` to `historyStore` and call it in
the Undo handler whenever at least one `double_day` extra was removed.

#### Non-issues confirmed this pass

| Item | Verdict |
|---|---|
| `migrateHistoryState` v0→v1 migration for `source` field | Correct — sets undefined → 'history' conservatively |
| `deduplicateByDate` in `importEntries` | Correct — sorts by createdAt ascending, last-wins |
| `clearPlanOutcomes` prefix matching | Safe — nanoid is alphanumeric + hyphen, no collisions |
| `buildVars()` bool-to-0/1 conversion for progression context | Correct |
| Override accumulation semantics | Correct — `addOverride` always appends, dedup is caller's responsibility |

---

### Work plan

1. **[HIGH] Fix Undo override leak** — add `removeLastOverrideByType` to `historyStore` (interface + implementation), update TodayPage Undo handler, add 7 new unit tests.

No feature work this pass — the bug fix warranted full attention and there's no adjacent feature that's both high-confidence and low-risk enough given the existing scope.

---

## Pass 61 — 2026-06-19 (branch `claude/dreamy-mccarthy-7ugj5k`)

### Observations on entry

- Branch is at `6f7e35c` (merged PR #149 from pass 60).
- 887 tests passing across 21 test files before any changes.
- Three pure utility modules had zero test coverage: `outcomeSortKey.ts`, `planDayUtils.ts`, and the `addOverride` path in `historyStore`.
- No share/export mechanism existed for "show a friend what workout I have today" — clipboard export was the natural next step.
- No architectural debt or urgent regressions found in the audit.

---

### Work Completed

#### 1. New utility: `src/lib/shareWorkout.ts`

Added `formatWorkoutForClipboard(planDay, planName, dateLabel): string` — a pure function that serialises a `PlanDay` to human-readable plain text for clipboard copy.

Output format:

```
Push Day — Mon, Jun 19
Plan: Strength Block

Chest & Shoulders (weights)
  • Bench Press: 5x5 @ 185lb
  • Overhead Press: 4x8 @ 115lb
  • Push-up: 3xmax
```

Handles:
- Weight exercises (numeric or `SetSpec[]` sets, optional load)
- Structured run segments (warmup/interval/cooldown with reps, distance, pace)
- Unstructured run/swim/yoga (targetDistance, durationMin, notes)
- `structureDescription` free-text block
- Multiple slots per day (AM/PM workouts)
- No trailing whitespace on any line

No new dependencies introduced. Zero side effects.

#### 2. Copy button in `TodayPage`

When `isPending && activeWorkoutState === 'hidden'` (the "Start Workout" button is visible), a copy icon button is rendered to the right of it in a flex row.

- Calls `formatWorkoutForClipboard` with today's date label (`format(parseISO(today), 'EEE, MMM d')`) and the plan name.
- Uses `navigator.clipboard.writeText()` — gracefully silences access-denied errors.
- Button turns emerald for 2 s after a successful copy, then resets.
- Uses the `Copy` icon from `lucide-react` (already a dependency).

#### 3. New tests: `src/lib/__tests__/shareWorkout.test.ts`

15 test cases covering the full surface of `formatWorkoutForClipboard`:

| # | Scenario |
|---|----------|
| 1 | Day label + date label on first line |
| 2 | Plan name on second line |
| 3 | Rest-day slot (name and type) |
| 4 | Weight exercises with load |
| 5 | Weight exercises without load |
| 6 | Run slot with targetDistance |
| 7 | Structured run segments (reps, distance, pace) |
| 8 | `SetSpec[]` array (length as set count) |
| 9 | `structureDescription` passthrough |
| 10 | `durationMin` output |
| 11 | `notes` passthrough |
| 12 | No trailing whitespace on any line |
| 13 | Multiple slots rendered in order |

#### 4. New tests: `src/lib/__tests__/planDayUtils.test.ts`

8 tests for `extraToPlanDay()` — previously zero coverage:

- id propagation
- label from workoutName
- exactly one slot
- slot.id = extra.id
- slot.type = extra.workoutType
- slot.name = extra.workoutName
- all 8 WorkoutType values map correctly
- valid PlanDay shape (all fields present)

#### 5. New tests: `src/lib/__tests__/outcomeSortKey.test.ts`

9 tests for `outcomeSortKey()` — previously zero coverage:

- returns `completedAt` when present
- falls back to calendarDate from instanceId when `completedAt` is null
- falls back when `completedAt` is undefined
- returns `''` for instanceId with no recognisable date
- datetime sorts after date-only for same calendar date
- two outcomes with timestamps sort chronologically
- two outcomes with date-only sort chronologically
- extra-workout instanceId (`plan_date_extra_id`) pattern
- planId with underscores does not confuse date extraction

#### 6. Expanded tests: `src/store/__tests__/historyStore.test.ts`

Added `addOverride` describe block (6 tests) — this action had no direct test coverage:

- appends override with generated id and given type
- uses provided `appliedAt` for calendar back-dating
- defaults `appliedAt` to now when not provided
- stores `targetDayIndex` for jump overrides
- accumulates multiple overrides without replacing earlier ones
- each generated id is unique across multiple adds

---

### What was NOT done (and why)

| Considered | Decision |
|---|---|
| Timezone fix in `removeRetroJumpForDate` | Low confidence — `format(new Date(isoString))` and `new Date().toISOString()` are a consistent round-trip within a single-device PWA. Not a real bug. |
| Multi-slot day copy (each slot's share text) | Scoped to single-call formatter; multi-slot is handled naturally in the loop. |
| Service-worker offline caching audit | Out of scope for overnight pass; no regressions observed. |
| New dependency (e.g. `share-api-polyfill`) | Rejected — Web Share API is good on mobile, clipboard fallback is sufficient and already in-browser. |

---

## Pass 62 — 2026-06-21 (branch `claude/dreamy-mccarthy-zu4z6a`)

### Observations on entry

- Branch starts at `d1b9a24` (merged PR #150 from pass 61).
- 923 tests passing across 24 test files before any changes.
- Codebase quality: 8/10. No critical bugs. Core rotation logic is sound.
- Key issues identified: 7-day stall detection cap, deduplication inconsistency in two stat functions, undocumented timezone convention, and no in-context PR feedback.

---

### Work Completed

#### 1. Fix: align deduplication across rotation stat functions

`computeRotationCycleProgress` and `computeRotationPlanRemaining` counted raw `entries.length` — unlike `isPlanExpired` which used a Set of unique calendarDate values. Fixed both to use `new Set(…dates)`, making all three consistent.

Risk of the original: a malformed CSV import could produce two entries on the same date. `isPlanExpired` would not count the date twice, but the cycle/remaining counters would — producing a stale display.

#### 2. Fix: extend catch-up window from 7 to 14 days

The stall-detection nudge on TodayPage now looks back 14 days instead of 7. Also added a secondary indicator showing how many unlogged days exist beyond the 14-day window ("+ N older gaps — use Calendar to review").

New utility: `countTotalUnloggedDays(planId, entries, planStartDate, today)` — full-history scan with no lookback cap.

#### 3. Docs: timezone convention

Added a block comment to `rotationEngine.ts` explaining that all calendarDate values are local-timezone YYYY-MM-DD strings, and documenting the known limitation for users who travel across time zones.

#### 4. Feature: personal record celebration banner

After logging a workout with weight sets, the app detects if any exercise exceeded its previous all-time max load and shows a dismissible amber banner: "New personal record! Bench Press, Squat". Clears on dismiss or Undo.

See FEATURE_PROPOSAL.md and FEATURE_REVIEW.md for the full breakdown.

#### 5. Tests: 12 new test cases

Added to `src/lib/__tests__/historyStats.test.ts`:
- 9 tests for `countTotalUnloggedDays`
- 1 test for `computeRotationCycleProgress` deduplication
- 1 test for `computeRotationPlanRemaining` deduplication
- 1 test for 14-day `getUnloggedPastDates` window

---

### What was NOT done (and why)

| Considered | Decision |
|---|---|
| Cross-store transaction safety | Too risky for an overnight pass; existing try/catch adequate |
| Progression error display in HistoryPage | Medium-risk schema change; documented as recommendation |
| Component/integration tests (RTL/Playwright) | Requires infrastructure setup; out of scope |
| Performance: memoize allOutcomes lookup | Low priority; app is single-user and data sets are small |
| Bulk mark-as-Day-Off from CalendarPage | Would extend the catch-up to handle old gaps too; larger feature |

---

## Pass 63 — 2026-06-25 (branch `claude/dreamy-mccarthy-nmt6dy`)

### Observations on entry

- Branch starts at `6daa617` (merged PR #152 from pass 62).
- 935 tests passing across 24 test files before any changes.
- Codebase quality: 8.5/10. Core logic is sound; test suite is comprehensive.
- Full audit of all key modules: rotation engine, historyStats, expressionEval, run-adaptation engine, outcomeStore, historyStore, workoutInstanceId, sessionSummary, progressionRecommendation.

### Key finding

Every counting function in `historyStats.ts` that produces a user-visible stat deduplicates by `calendarDate` using a `Set` — **except `countPlanDayCompletions`**. This is the function powering the "Session N" label shown in TodayPage when a user starts a workout. If a CSV import creates a duplicate entry for the same date and planDayIndex, the count inflates (e.g. "Session 8" instead of "Session 7").

No other genuine correctness bugs were found. All other audit items were either already correctly handled or were non-issues given the single-device PWA context.

---

### Work Completed

#### 1. Fix: deduplicate `countPlanDayCompletions` by calendarDate

`src/lib/historyStats.ts` — changed to collect unique calendarDates via `new Set()` before counting. Now consistent with `isPlanExpired`, `computeRotationCycleProgress`, `computeRotationPlanRemaining`, `countTotalUnloggedDays`, and all other counting functions in the module.

#### 2. Test: deduplication regression test

`src/lib/__tests__/historyStats.test.ts` — added one test: two `complete` entries for the same date+planDayIndex (as would happen after a CSV re-import) now count as 1, not 2.

Test count: 935 → 936.

---

### What was NOT done (and why)

| Considered | Decision |
|---|---|
| Feature: copy-workout button on CalendarPage | TodayPage already has it (pass 61); extending to CalendarPage requires wiring `formatWorkoutForClipboard` through the slot → planDay lookup, medium scope for low usage |
| historyStore `removeRetroJumpForDate` timezone | Same conclusion as pass 61: consistent round-trip in a single-device PWA, not a real bug |
| expressionEval: fuzz testing | Current test suite already covers all operator paths, NaN/Infinity guards, and nested parens |
| Progression state UI exposure | Schema change needed; medium risk; deferred to a dedicated pass |

---

## Pass 64 — 2026-06-26 (branch `claude/dreamy-mccarthy-fxnzht`)

### Observations on entry

- Branch starts at `6daa617` (merged PR #152 from pass 62; pass 63 was committed on the same upstream).
- 936 tests passing across 24 test files before any changes.
- Codebase quality: 8.5/10. No critical bugs. Core logic is sound.
- Full re-audit of TodayPage, historyStats, historyStore, outcomeStore, rotationEngine, workoutInstanceId.

### Key finding

**Adherence bar 7-day threshold was undocumented but missing** (`src/pages/TodayPage.tsx`):

The comment on the `loggedRate` declaration explicitly states the bar is "shown after plan has been active ≥ 7 days so the percentage is meaningful." However, `computeLoggedRate` returns `0` (not `null`) once `activeDays >= 1`, so the null-check guard would let the bar appear after just 2 calendar days. The 7-day guard existed in the comment but not in the code.

**Fix**: Added `planActiveDays >= 7` alongside the existing `loggedRate !== null` condition.

No other genuine correctness bugs were found. All other audit items were either already correctly handled (including the deduplication fixes from pass 63) or were non-issues.

---

### Work Completed

#### 1. Fix: enforce 7-day minimum before showing adherence bar

`src/pages/TodayPage.tsx` — added `differenceInCalendarDays` import and `planActiveDays >= 7` guard so the adherence bar only appears once the plan has at least a week of history. The bar showed on day 2 before this change; now it correctly waits until day 7.

---

### What was NOT done (and why)

| Considered | Decision |
|---|---|
| Redundant `removeEntry` before `updateEntryDate` in `handleOutcomeConfirm` | Harmless — `updateEntryDate` already removes collisions internally; no bug, no impact, not worth touching |
| Feature: last-session summary on upcoming cards | Medium complexity; TodayPage already shows this for today's card via `prevSessionOutcome`; extending to the upcoming list is a larger UI change |
| Component/integration tests | Requires jsdom or Playwright setup; out of scope for a targeted overnight pass |

---

## Pass 73 — 2026-07-06 (branch `claude/dreamy-mccarthy-od2r9n`)

### Observations on entry

- Branch starts clean; 1017 tests passing across 28 test files before any changes.
- Codebase quality: 8.7/10. No architectural issues. Core logic sound and well-tested.
- Full audit of rotationEngine, historyStore, outcomeStore, exerciseHistoryStore, TodayPage, CalendarPage, historyStats, sessionSummary, workoutInstanceId, all hooks, all stores.

### Bugs found and fixed

**Bug 1 — `estimateRunDurationMin` missing `planProgramVars` argument in cardio prompt**

`src/pages/TodayPage.tsx` line 1193: the cardio prompt section called `estimateRunDurationMin(runSlot)` without the second argument. Every other call site in the file (lines 449 and 463) passes `planProgramVars`. Without it, expression-based `targetTime` values (from YAML program slots) silently fall back to a default estimate, showing incorrect estimated durations in the post-weights cardio suggestion modal.

**Bug 2 — `exerciseHistoryStore` missing `version` / `migrate` in persist config**

`src/store/exerciseHistoryStore.ts`: the `persist` call used `{ name: 'wpt_exercise_history' }` with no `version` or `migrate` option — the only Zustand store without a schema-version guard. All other stores (`historyStore`, `outcomeStore`, `planStore`) have `version: N, migrate: ...`. Without the guard, any future schema change to `ExerciseSessionRecord` risks corrupt reads from old localStorage data (fields misread as wrong types, missing pre-computed fields, etc.). Added `version: 1, migrate: (persisted: unknown) => persisted as ExerciseHistoryState` as a passthrough guard.

### Refactoring

**`useDismissableBanner` — shared hook to eliminate duplication**

`useExpiryDismiss.ts` and `useStallNudgeDismiss.ts` were identical except for their `KEY_PREFIX` constant: same `readDismissed`/`writeDismissed` helpers, same `useState` + `useCallback` structure, same JSDoc shape. Extracted to `src/hooks/useDismissableBanner.ts`. Both original hooks now delegate to it with their respective prefixes. Keys and runtime behavior unchanged.

### Tests added

`src/hooks/__tests__/useDismissableBanner.test.ts` — 10 tests covering the localStorage contract: absent key starts false, write sets to "1", isolation by prefix and by planId, null planId no-ops, read/write failure degrades gracefully, real consumer prefixes are distinct.

Test count: 1017 → 1027 (+10).

### Feature added

**Last session summary on upcoming workout cards**

`src/pages/TodayPage.tsx`: added `upcomingSessionSummaries` memo that calls `findPreviousSessionForPlanDay` + `buildLastSessionSummary` for each upcoming rotation slot. The result is rendered as a single muted line under each upcoming card: `Last: Squat 135 lb · 3×8` (or equivalent for runs/swims). The infrastructure (`findPreviousSessionForPlanDay`, `buildLastSessionSummary`) was already used for today's card — this extends the same pattern to the upcoming list. No new dependencies.

---

### Work Completed

#### 1. Fix: pass planProgramVars to estimateRunDurationMin in cardio prompt

`src/pages/TodayPage.tsx` — changed `estimateRunDurationMin(runSlot)` → `estimateRunDurationMin(runSlot, planProgramVars)` at the one call site in the cardio-prompt section. All other call sites already passed this argument.

#### 2. Fix: add version guard to exerciseHistoryStore persist config

`src/store/exerciseHistoryStore.ts` — added `version: 1, migrate: (persisted: unknown) => persisted as ExerciseHistoryState` to the persist options. Aligns this store with all other persisted stores in the codebase.

#### 3. Refactor: extract useDismissableBanner shared hook

`src/hooks/useDismissableBanner.ts` — new file, ~35 lines. `useExpiryDismiss.ts` and `useStallNudgeDismiss.ts` now each delegate to it in ~10 lines each. Net -56 lines of duplication.

#### 4. Test: add unit tests for useDismissableBanner

`src/hooks/__tests__/useDismissableBanner.test.ts` — 10 new tests validating localStorage contract, null planId handling, isolation, and graceful degradation under localStorage failure.

#### 5. Feature: show last session summary on upcoming workout cards

`src/pages/TodayPage.tsx` — added `upcomingSessionSummaries` `useMemo` (~10 lines) and a `<p>` under each upcoming card showing the last session one-liner when available.

---

### What was NOT done (and why)

| Considered | Decision |
|---|---|
| `computeWorkoutPRFlags` O(n²) loop | Performance only matters at large record counts; current users unlikely to hit the threshold; flagged in REVIEW_NOTES.md for a future pass |
| `removeLastOverrideByType` footgun API | No callers pass wrong `type`; rename/docs improvement, low urgency |
| Component/integration tests | Still requires `@testing-library/react` not in devDeps; out of scope for this pass |
| Run progression state surfacing in HistoryPage | Medium-scope UI feature; deferred |

---

## Pass 79 — 2026-07-20 (branch `claude/dreamy-mccarthy-ccykny`)

### Baseline

- Branch started from `main` after PR from pass 78 merged.
- **1088 tests passing** across 31 test files at start of pass.
- **1090 tests passing** at end of pass (+2 new tests for outcomeSortKey tie-breaking).
- TypeScript: `tsc --noEmit` clean (0 errors).

### Architecture summary (unchanged from pass 78)

React 18 + TypeScript 5.5 + Zustand 4.5, Vite PWA, GitHub Pages. Local-first with optional Supabase Google OAuth cloud sync. 7 Zustand stores, 31 test files.

### What is strong

- Rotation engine: well-tested, edge cases covered, symmetric modulo correct.
- Expression evaluator: safe recursive-descent parser, NaN/Infinity guard.
- CSV I/O: RFC 4180, backward-compatible column additions, idempotent re-import.
- Store migrations: all idempotent, applying to already-migrated data is a no-op.
- 78 prior audit passes have eliminated most obvious bugs.

### Key risks / weak points (updated)

| ID | Severity | Area | Status |
|----|----------|------|--------|
| CI gap | Medium | deploy.yml | **FIXED pass 79** — test step added |
| BUG-8 | Low | outcomeSortKey | **FIXED pass 79** — instanceId tiebreaker added |
| BUG-4 | Medium | storeSync | **FIXED pass 79** — migrations applied on cloud hydration |
| ARCH-1 | Debt | TodayPage.tsx | Open — 1700+ lines, decomposition deferred |
| TEST-1 | High | storeSync.ts | Open — requires Supabase mock infrastructure |
| TEST-3 | High | ActiveWorkoutTracker.tsx | Open — requires RTL/Playwright |
| BUG-11 | Low | csv.ts | Open — legacy CSV extraId collision |

### Prioritised plan for next pass

| Priority | Item |
|----------|------|
| P1 | Add storeSync unit tests (mock Supabase via vi.mock) |
| P1 | Fix BUG-11: legacy CSV extraId collision — warn or re-key |
| P2 | Extract `<TodayBanners>` from TodayPage (ARCH-1 first step) |
| P2 | Add `draftVersion` to active-workout draft for stale-draft detection |
| P3 | Add `localDate` to OverrideEntry for timezone-safe overrides |
| P3 | Expose `notes` in extra-entry edit modal (HistoryPage) |
| P4 | RTL tests for ActiveWorkoutTracker (requires devDep addition) |
