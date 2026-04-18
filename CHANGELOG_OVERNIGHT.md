# Overnight Changelog

## 2026-04-18 run — branch `claude/system-improvements-m4b4f`

Baseline: 169 passing, 1 failing (stale CSV test assertion).
End state: **171 tests pass**.

Scope-tight correctness run. Three targeted fixes + one new test. No
engine changes, no schema changes, no new features.

### Commits (oldest → newest)

1. **`dbf4c51` — Add IMPLEMENTATION_PLAN.md section for 2026-04-18 audit**
   Dated architecture re-summary + prioritized plan. No code changes.

2. **`40edf34` — Update stale csv test: planId is preserved, day/slot IDs regenerate**
   Commit `d16e8c2` intentionally started preserving planId on CSV
   import (so previously-exported history CSVs stay cross-referenceable
   across re-imports). The existing test still asserted that planId
   was regenerated, so the suite had been failing since that change
   landed. Flipped the assertion + renamed the test to state the
   current contract; added inline comment explaining why.
   - `src/lib/__tests__/csv.test.ts`
   - **Risk**: none. Test-only change that documents existing behavior.
   - **Rollback**: `git revert 40edf34`.

3. **`90ef6b3` — Clear plan's extra workouts when clearing plan history**
   `clearPlanHistory(planId)` filtered `entries` and `overrides` but
   not `extraEntries`. Deleting a plan left any ad-hoc logged workouts
   (yoga / swim / run / etc. logged outside the rotation) orphaned in
   localStorage. PlansPage's delete flow already calls
   `clearPlanHistory` → `clearPlanOutcomes` → `deletePlan`, so adding
   the filter to `clearPlanHistory` is enough — outcome keys for extras
   are prefixed by `${planId}_` and are already cleared by
   `clearPlanOutcomes`.
   - `src/store/historyStore.ts`
   - **Risk**: low. One-line addition; mirrors the existing pattern
     for `entries` and `overrides`.
   - **Rollback**: `git revert 90ef6b3`.

4. **`aa09ad7` — Correct misleading JSDoc on completionStateToAction**
   The doc on `completionStateToAction` claimed `deferred → day_off
   (does NOT advance rotation)`. `rotationEngine.computeCurrentDayIndex`
   actually advances the pointer for all three action types
   (`complete`, `skip`, `day_off`). Re-worded to state the truth and
   point at the engine function for anyone debugging progression
   semantics. Doc only.
   - `src/modules/workout-outcomes/types.ts`
   - **Risk**: none.
   - **Rollback**: `git revert aa09ad7`.

5. **`59ec028` — Add test for extraEntries cleanup in plan-delete cascade**
   Extends `planDeleteCleanup.test.ts` with a third integration-style
   test: seeds plan A with 2 extras and plan B with 1 extra, creates
   outcomes for each extra via `makeExtraWorkoutInstanceId`, simulates
   the PlansPage delete cascade for plan A, and asserts plan B's extra
   + outcome survive while plan A's are gone. Also adds
   `extraEntries: []` to the `beforeEach` store reset.
   - `src/store/__tests__/planDeleteCleanup.test.ts`
   - **Risk**: none. Test-only.
   - **Rollback**: `git revert 59ec028`.

### Tests

- Before: 169 pass / 1 fail.
- After: **171 pass** (+1 fix, +1 new test).

### User-visible behavior changes

1. Deleting a plan now also removes ad-hoc extra workouts (yoga / swim
   / any off-rotation workout) logged against it. Previously those
   stayed in localStorage forever.

Nothing else affects UI, CSV export/import, rotation advancement, or
the PWA manifest.

### Not implemented (recommendations only)

- `swap_slot` override UI — product decision still needed.
- Double-day bonus outcome capture — needs UX path for a second modal.
- Progression reset button — scope decision (single group vs all).
- Plan-expiry banner dismiss — wants a persisted-dismissal design.

Medium-complexity feature work was intentionally skipped this run to
keep scope narrow around correctness. Baseline was close to clean
(169/170); a pure-correctness run lands the suite green without
layering in anything that needs separate review.

---

## 2026-04-17 run — branch `claude/funny-galileo-6zMOl`

Baseline: 156 tests pass (inherited from 2026-04-16 run).
End state: **170 tests pass**, `npx vite build` succeeds.

All changes are additive or deletions of verified-dead code. The
rotation engine, calendar projection, run-adaptation engine, and CSV
import/export paths were **not** modified.

### Commits (oldest → newest)

1. **`a8227ae` — Add IMPLEMENTATION_PLAN.md for 2026-04-17 audit**
   Dated architecture summary + prioritized plan appended to the file.

2. **`3e83c25` — Clear plan outcomes when deleting a plan**
   `PlansPage` delete handler now calls `clearPlanOutcomes` alongside
   `clearPlanHistory`. Fixes orphaned `WorkoutOutcome` records — the
   function existed and was tested but had never been wired into the UI.
   - `src/pages/PlansPage.tsx`
   - **Risk**: none. Adds cleanup; no engine / no projection changes.
   - **Rollback**: `git revert 3e83c25`.

3. **`2bff88e` — Clear outcome record when history entry is undone or deleted**
   Adds `removeOutcome(instanceId)` to `outcomeStore`. Wired into:
   - `TodayPage` Undo
   - `HistoryPage` entry delete
   - `CalendarPage` Clear button in the day-detail modal
   Keeps the history and outcome stores in lockstep so re-opening the
   OutcomeModal after an Undo no longer pre-populates a stale outcome.
   - `src/store/outcomeStore.ts`, `src/pages/TodayPage.tsx`,
     `src/pages/HistoryPage.tsx`, `src/pages/CalendarPage.tsx`
   - **Risk**: low. The new action is a single Zustand set.
   - **Rollback**: `git revert 2bff88e`.

4. **`32de834` — Remove unused uiStore**
   `useUIStore` had zero importers anywhere in `src/`. Deleted.
   - `src/store/uiStore.ts` (deleted)
   - **Risk**: none. Verified by grep.
   - **Rollback**: `git revert 32de834`.

5. **`78a9152` — Default history plan filter to active plan when available**
   When `activePlanId` is set AND that plan has at least one logged
   entry, `HistoryPage` opens with its filter pre-selected to the active
   plan instead of "All plans". Falls back to "all" otherwise.
   - `src/pages/HistoryPage.tsx`
   - **Risk**: low; UX-only default change. User can still switch filters.
   - **Rollback**: `git revert 78a9152`.

6. **`ddc93d6` — Add tests for removeOutcome and plan-delete cleanup**
   - `removeOutcome` unit tests (single removal, no-op on missing id,
     progressionStates isolation) appended to `outcomeStore.test.ts`.
   - New `planDeleteCleanup.test.ts` — integration-style test that seeds
     two plans, deletes one, and asserts cleanup cascades across the
     three stores and leaves the sibling plan untouched.
   - +137 lines of test code.
   - **Rollback**: `git revert ddc93d6`.

7. **`724ca92` — Add history stats summary to HistoryPage**
   Selected medium-complexity feature, narrow slice:
   - New pure helper `src/lib/historyStats.ts` (`computeHistoryStats`).
   - 9 unit tests covering totals, inclusive windows (7-day, 30-day),
     streak definition (complete or day_off; skip or gap breaks it).
   - 4 stat tiles (Streak / 7-day / 30-day / Total) rendered above the
     entry list in `HistoryPage`. Respects the plan filter — stats
     recompute when the user changes the dropdown.
   - **Risk**: low. Pure derivation, zero engine changes, no new deps.
   - **Rollback**: `git revert 724ca92`.

### Tests

- Before: 156 pass.
- After: 170 pass (+14).
- New files:
  - `src/lib/__tests__/historyStats.test.ts` (9 tests)
  - `src/store/__tests__/planDeleteCleanup.test.ts` (2 tests)
- Additions to existing:
  - `src/store/__tests__/outcomeStore.test.ts` (+3 `removeOutcome` tests)

### User-visible behavior changes

1. Plan delete now truly removes everything — previously outcomes
   leaked into localStorage indefinitely.
2. Undo on Today (and Delete / Clear on History & Calendar) also clears
   the saved outcome — previously re-opening an entry after undoing it
   would re-populate stale outcome fields.
3. HistoryPage opens pre-filtered to the active plan when possible.
4. A 4-tile stats summary now sits above the entry list.

Nothing here affects CSV export/import or the PWA manifest.

---

## 2026-04-16 run

Generated: 2026-04-16

Changes are listed in commit order (oldest first).

---

## 1. Fix Skip button: log history entry instead of advance override

**Commit**: `1f3ed3c`

**Summary**: `handleSkip()` in `TodayPage` was calling `actions.advance()` (which writes an override entry) instead of `actions.skip(planDayIndex)` (which writes a history entry with action='skip').

**Why it mattered**: Clicking Skip did not record any history entry. The day appeared as `past_unlogged` on the calendar. The rotation advanced via override rather than via a logged entry, meaning the behavior was subtly different from what all other parts of the system expected. If overrides were cleared or the rotation was re-computed differently, the skipped day's effect on the rotation would disappear.

**Files changed**: `src/pages/TodayPage.tsx`

**Risk**: Low. The fix aligns Skip with how every other logged action works. Skip now creates a HistoryEntry with action='skip', visible in history and on the calendar.

**Rollback**: `git revert 1f3ed3c`

---

## 2. Fix updateEntryAction: restore planDayIndex when changing away from day_off

**Commit**: `3fa7753`

**Summary**: When the history editor changed an entry from `day_off` to `complete` or `skip`, the `planDayIndex` field stayed `undefined` (because it was `undefined` when the entry was first logged as day_off). The updated function accepts an optional `planDayIndex` parameter and uses it when switching away from day_off.

**Why it mattered**: After a day_off → complete toggle, the history entry would show `planDayIndex = undefined`, causing the plan day display to fall back to "Unknown day". The rotation engine itself ignores `planDayIndex`, so rotation logic was unaffected, but the display was incorrect.

**Files changed**: `src/store/historyStore.ts`

**Risk**: Very low. The function signature extended with an optional parameter — all existing callers are backward compatible.

**Rollback**: `git revert 3fa7753`

---

## 3. Fix getFutureProjection: delegate to getUpcomingDays for consistency

**Commit**: `88bbb71`

**Summary**: `getFutureProjection` in `calendarProjection.ts` had its own projection loop that diverged from `getUpcomingDays` by not applying today's overrides and not advancing for `day_off` entries. Replaced with a simple delegation to `getUpcomingDays`.

**Why it mattered**: `getFutureProjection` is currently unused by active pages, but if called, it would have produced incorrect projections. The inconsistency was also confusing.

**Files changed**: `src/engine/calendarProjection.ts`

**Risk**: Very low. Function is dead code — no callers in active pages. The cleanup reduces confusion for future readers.

**Rollback**: `git revert 88bbb71`

---

## 4. Remove dead isActive=true variable from OutcomeModal

**Commit**: `746509f`

**Summary**: `const isActive = true` in `OutcomeModal.tsx` was always true and existed as a remnant of earlier states where certain form sections would be hidden for non-active completion states. All remaining completion states (completed/partial) show all fields, so the guard was dead code. Removed the variable and its conditional wrappers.

**Why it mattered**: The code pattern `{isActive && (<div>...)}` was confusing to readers — it looks like a meaningful condition but always evaluates to true. Cleaned up 6 unnecessary conditional wrappers.

**Files changed**: `src/components/workout/OutcomeModal.tsx`

**Risk**: None. Purely cosmetic — identical runtime behavior.

**Rollback**: `git revert 746509f`

---

## 5. Add rotation engine test suite (37 tests)

**Commit**: `302fcba`

**Summary**: Added comprehensive tests for `rotationEngine.ts` covering: `mod()`, `computeCurrentDayIndex()` (with various entry types, overrides, startDayIndex, wrap-around, deduplication of duplicate entries), `getTodayResolvedDay()` (all status transitions, override application), `getUpcomingDays()` (projection, wrap-around, override effects, prior day integration), and `isPlanExpired()` (both weeks and rotations modes, day_off exclusion from rotation count).

**Why it mattered**: The rotation engine is the most business-critical piece of logic in the app and had zero test coverage. The tests now document expected behavior, catch regressions, and revealed two test-writing mistakes that clarified how the engine actually works.

**Files changed**: `src/engine/__tests__/rotationEngine.test.ts` (new file)

**Risk**: None. Tests only — no production code changed.

**Rollback**: `git revert 302fcba`

---

## 6. Add unsaved-changes guard to PlanBuilderPage

**Commit**: `9914b84`

**Summary**: Added an `isDirty` flag that is set when any plan metadata or day/slot is edited. The back button now calls `safeNavigate()` instead of `navigate()` directly. If there are unsaved changes, a confirmation modal appears asking "Keep editing" or "Discard". The dirty flag is cleared on successful save.

**Why it mattered**: Users could lose all edits by tapping the back button or navigating away without any warning. This is a common source of frustration in form-heavy UIs.

**Files changed**: `src/pages/PlanBuilderPage.tsx`

**Risk**: Low. The guard only adds a confirmation step — users can still discard. The `isDirty` state is local and doesn't persist.

**Rollback**: `git revert 9914b84`

---

## 7. Add plan expiry/completion indicators

**Commit**: `5805553`

**Summary**: Added `isPlanExpired()` calls to both `TodayPage` and `PlansPage`. On TodayPage, a purple banner appears when the plan has completed all its scheduled rotations/weeks. On PlansPage, the "Active" badge changes to "Complete" (purple) for expired active plans.

**Why it mattered**: `isPlanExpired()` existed in the engine but was never called from the UI. Users had no indication that they'd finished their program.

**Files changed**: `src/pages/TodayPage.tsx`, `src/pages/PlansPage.tsx`

**Risk**: Low. `isPlanExpired()` is a pure function, already tested. The visual indicator is additive.

**Rollback**: `git revert 5805553`

---

## 8. Add plan filter to History page + fix empty state check

**Commit**: `467e225`

**Summary**: When multiple plans have history entries, a dropdown filter appears in the History page header to filter entries by plan. The entry count updates to reflect the filter. An empty message shows when the selected plan has no entries. Also fixed the initial empty-state check to use `entries.length` instead of `sorted.length`, so the empty state doesn't show when only the filter produces zero results.

**Why it mattered**: Users with multiple plans could not easily find entries for a specific plan. All entries were mixed together.

**Files changed**: `src/pages/HistoryPage.tsx`

**Risk**: Very low. The filter is additive. Single-plan users see no change. The empty state fix is strictly correct.

**Rollback**: `git revert 467e225`

---

## 9. Fix notes drift between HistoryEntry and WorkoutOutcome stores

**Commit**: `435d983`

**Summary**: When notes were edited via the History modal, only `HistoryEntry.notes` was updated. `WorkoutOutcome.notes` (in outcomeStore) stayed stale, meaning the `OutcomeModal` on TodayPage would show old notes if "Edit outcome" was tapped. Added `updateOutcomeNotes()` to outcomeStore and calls it in `HistoryPage.saveAndClose()`.

**Why it mattered**: Notes could diverge between two stores, causing confusing UX: history list shows one note, outcome modal shows another.

**Files changed**: `src/store/outcomeStore.ts`, `src/pages/HistoryPage.tsx`

**Risk**: Very low. The new `updateOutcomeNotes` is a simple patch operation on existing state. No-ops when no outcome record exists.

**Rollback**: `git revert 435d983`

---

## 10. Remove duplicated makeWorkoutInstanceId in OutcomeModal

**Commit**: `0863e99`

**Summary**: `OutcomeModal` had a local `buildWorkoutInstanceId()` function that was an exact re-implementation of the exported `makeWorkoutInstanceId()` from `outcomeStore`. Removed the local function and imported the shared one.

**Why it mattered**: The format `${planId}_${calendarDate}` was defined in two places. Any future format change would require updating both.

**Files changed**: `src/components/workout/OutcomeModal.tsx`

**Risk**: None. Behavioral identity — same output, one less definition.

**Rollback**: `git revert 0863e99`

---

## 11. Add historyStore test suite (28 tests)

**Commit**: `cfd4c36`

**Summary**: Added comprehensive tests for `historyStore` covering: `addEntry` deduplication, `logAction` planDayIndex semantics for day_off vs complete/skip, `updateEntryAction` planDayIndex restoration (the bug fixed in commit `3fa7753`), `removeRetroJumpForDate` override filtering by type and planId, `removeEntry`, and `clearPlanHistory`. The persist middleware is mocked as a pass-through so tests run in the Node environment without localStorage.

**Why it mattered**: The historyStore contains business-critical state mutations. The `updateEntryAction` fix (commit `3fa7753`) had no test coverage — this suite now verifies both the happy path and the bug-fixed day_off → complete transition.

**Files changed**: `src/store/__tests__/historyStore.test.ts` (new file)

**Risk**: None. Tests only.

**Rollback**: `git revert cfd4c36`

---

## 12. Add outcomeStore test suite (17 tests)

**Commit**: `efe89fb`

**Summary**: Added tests for `outcomeStore` covering: `makeWorkoutInstanceId` format, `setOutcome`/`getOutcome` deduplication, `updateOutcomeNotes` (including the no-op when outcome is absent and the empty-string → null coercion), `logOutcomeWithProgression` for non-run slots, progression-ineligible run slots, and the full progression advancement path, plus `clearPlanOutcomes` prefix filtering.

**Why it mattered**: `updateOutcomeNotes` was newly added to fix notes drift (commit `435d983`). Testing it validates the new path and documents that it is a no-op when no outcome record exists.

**Files changed**: `src/store/__tests__/outcomeStore.test.ts` (new file)

**Risk**: None. Tests only.

**Rollback**: `git revert efe89fb`

---

## 13. Add getResolvedDaysRange and buildMonthGrid tests (30 tests)

**Commit**: `e0d5eba`

**Summary**: Added tests for `getResolvedDaysRange` (the calendar grid's core function) covering: status assignment for past/today/future, pointer advancement rules (past unlogged = no advance, logged entry = advance, today/future always advance), override application order, rotation boundary wrap, historyEntry attachment, and the documented edge case where dates before `plan.startDate` are passed directly to the engine. Also covers `buildMonthGrid` grid structure (complete weeks × 7 cells, `isCurrentMonth` accuracy, single `isToday` marker, `resolvedDay` attachment).

**Why it mattered**: `getResolvedDaysRange` is the most complex function in the codebase with subtle pointer-advancement rules. Two test assertions had to be corrected during writing, which helped clarify how advance overrides interact with past unlogged days.

**Files changed**: `src/engine/__tests__/calendarProjection.test.ts` (new file)

**Risk**: None. Tests only.

**Rollback**: `git revert e0d5eba`

---

## 14. Fix WorkoutDayCard dynamic Tailwind border class

**Commit**: `2053931`

**Summary**: `WorkoutDayCard` constructed the border color class name at runtime using `border-${meta.bgColor.replace('bg-', '')}`. Tailwind's CSS purger scans source files for complete class name strings — dynamically constructed names (e.g. `border-orange-500`) can be omitted from the production CSS bundle, making the pending-state left border invisible. Fixed by adding a static `borderColor` field to `WorkoutMeta` in `constants.ts` and using `meta.borderColor` directly.

**Why it mattered**: Silent production CSS failure. The pending-state card border (the only visible difference between "today's workout" and a generic future day) could disappear in production builds.

**Files changed**: `src/lib/constants.ts`, `src/components/workout/WorkoutDayCard.tsx`

**Risk**: None. Same visual behavior, now guaranteed to be included in the CSS bundle.

**Rollback**: `git revert 2053931`

---

## 15. Document resolveWorkoutDisplayTarget isFromProgression=false edge case

**Commit**: `6893e35`

**Summary**: Added a test to `engine.test.ts` documenting that when a progression state's `currentTargetDistanceMiles` equals the template's `targetDistanceMiles`, `isFromProgression` is `false` and no adaptation note is shown. This is intentional design (target unchanged → no indicator) but was undocumented.

**Why it mattered**: The edge case was noted in TEST_RESULTS.md as "worth documenting in tests". Now documented with an explanation of when it occurs (progression initialised at baseline or reset to baseline).

**Files changed**: `src/modules/run-adaptation/__tests__/engine.test.ts`

**Risk**: None. Tests only.

**Rollback**: `git revert 6893e35`

---

## 16. Fix buildMonthGrid: don't show pre-plan dates as past_unlogged

**Commit**: `f1971d2`

**Summary**: When viewing a calendar month in which a plan started mid-month (e.g., plan starts Jan 15 but the grid spans from Dec 28), dates before `plan.startDate` were passed to `getResolvedDaysRange`, which returned them as `past_unlogged` with the `startDayIndex` workout shown. Those dates pre-date the plan and should not display workout data. Fixed by clamping `fromDate` to `plan.startDate` before calling `getResolvedDaysRange`. Pre-start cells now have `resolvedDay = undefined` and render as neutral/inactive (the `CalendarPage` already handles this gracefully). Also added a guard for the case where the entire viewed month is before the plan started.

**Why it mattered**: Users viewing the month their plan started would see incorrect workout labels and `past_unlogged` indicators on days before they'd ever used the app.

**Files changed**: `src/engine/calendarProjection.ts`

**Risk**: Low. The CalendarPage already handles `resolvedDay = undefined` (non-interactive neutral cell). The fix is additive — it only restricts the range passed to `getResolvedDaysRange`, not the range of cells rendered.

**Rollback**: `git revert f1971d2`
