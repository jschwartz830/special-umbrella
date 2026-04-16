# Overnight Changelog

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
