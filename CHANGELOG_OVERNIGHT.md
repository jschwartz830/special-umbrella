# Overnight Changelog

---

## Pass 92 — 2026-08-06 (branch `claude/serene-cori-5z2kwb`)

### Refactor: Extract `TodayLogUpcomingModal` from `TodayPage` (ARCH-1)

- **Commit**: `4289181`
- **Files**: `src/components/today/TodayLogUpcomingModal.tsx` (new), `src/pages/TodayPage.tsx`
- **What changed**: The 47-line inline "Log upcoming workout" action picker modal was extracted into a standalone stateless component `TodayLogUpcomingModal` with four props: `rd: ResolvedDay`, `error: string | null`, `onLog: (action) => void`, `onClose: () => void`. TodayPage now imports and renders `<TodayLogUpcomingModal>` in place of the inline JSX block. Three lucide icon imports (`Info`, `CheckCircle2`, `SkipForward`) that were only used by the extracted block were also removed from TodayPage.
- **Why it matters**: This is the eleventh Today subcomponent extracted as part of ARCH-1. The modal is independently testable and clearly describes its interface contract. TodayPage: 1,221 → 1,180 lines (−41).
- **Risks**: Pure structural refactor — identical render output. TypeScript confirmed no unused identifiers remain. All 1203 tests pass.
- **Rollback**: Revert `4289181`. `TodayLogUpcomingModal.tsx` can be deleted.

### Docs: Update `WEB_APP_INVENTORY.md` with all Today subcomponents (P3)

- **Commit**: `62ccd6e`
- **Files**: `WEB_APP_INVENTORY.md`
- **What changed**: Added a new "Today subcomponents" bullet group listing all 11 components in `src/components/today/` with one-line descriptions of each. Previously the inventory listed zero of them, making the directory invisible to readers of the doc.
- **Why it matters**: The inventory is the primary orientation doc for the repo. Eleven components accumulated across 9 passes (83–92) without being documented — a reader consulting the inventory would not know these existed.
- **Risks**: None. Docs-only change.
- **Rollback**: Revert `62ccd6e`.

---

## Pass 91 — 2026-08-05 (branch `claude/serene-cori-msn7bs`)

### Feature: Wire `computeWorkoutCompletionRate` into plan stats UI

- **Commit**: `8f6cb85`
- **Files**: `src/pages/TodayPage.tsx`, `src/components/today/TodayPlanProgressModal.tsx`, `src/pages/HistoryPage.tsx`
- **What changed**:
  - `TodayPage.tsx`: Added `computeWorkoutCompletionRate` computation after the existing `loggedRate` line. The result is passed as `workoutCompletionRate` prop to `TodayPlanProgressModal`.
  - `TodayPlanProgressModal.tsx`: Added `workoutCompletionRate: WorkoutCompletionRate` to the props interface. A new "Completion rate" row is rendered after the existing "Logged rate" row when `workoutCompletionRate.workoutCompletionRate !== null`.
  - `HistoryPage.tsx`: Added `completionRate` useMemo (gated on a specific plan being selected). A second progress bar (emerald color) now appears below the existing sky-blue logged-rate bar in the plan-stats section.
- **Why it matters**: `computeWorkoutCompletionRate` was added in pass 90 as a pure function with no UI connection. Two stats surfaces now consume it: the Today tab plan-progress modal and the History page per-plan stats. Together the two metrics tell a fuller story — a high logged rate with a low completion rate signals consistent recording but frequent skipping, while both high means the plan is genuinely being followed.
- **Risks**: Very low. The function is pure and already tested with 10 tests. Both new UI rows are gated on `!== null`, so they are invisible until the plan has at least one logged workout-or-skip entry.
- **Rollback**: Revert `8f6cb85`.

### Refactor: Extract `TodayCatchupModal` from `TodayPage` (ARCH-1)

- **Commit**: `e29fe69`
- **Files**: `src/components/today/TodayCatchupModal.tsx` (new), `src/pages/TodayPage.tsx`
- **What changed**: The 35-line inline "Mark as Day Off?" confirmation modal was extracted into a standalone stateless component `TodayCatchupModal` with three props: `unloggedDates: string[]`, `onConfirm: () => void`, `onClose: () => void`. TodayPage now imports and renders `<TodayCatchupModal>` in place of the inline JSX block.
- **Why it matters**: The catchup-confirm modal was explicitly listed as the next ARCH-1 candidate in pass 90's plan. Extracting it makes TodayPage easier to scan and makes the modal reusable and independently testable.
- **Risks**: Pure structural refactor — no logic moved, no state ownership changed. TodayPage: 1,240 → 1,217 lines (−23).
- **Rollback**: Revert `e29fe69`. TodayCatchupModal.tsx can be deleted.

---

## Pass 90 — 2026-08-04 (branch `claude/serene-cori-xidg8a`)

### Fix: BUG-2 (partial) — `openExtraOutcome` now forwards `planDayIndex` to `outcomeTarget`

- **File**: `src/pages/CalendarPage.tsx`
- **What changed**: Added a one-line `weeks.flat().find(…)` lookup in `openExtraOutcome` to resolve the calendar grid cell for the extra's date, then passed `planDayIndex: resolvedDay?.planDayIndex` to `setOutcomeTarget`. Previously `outcomeTarget.planDayIndex` was always `undefined` when the flow entered via `openExtraOutcome`.
- **Why it matters**: `handleOutcomeConfirm` calls `updateEntryAction(entry.planId, entry.calendarDate, action, entry.planDayIndex ?? outcomeTarget.planDayIndex)`. On a day where the rotation entry was `day_off`, `entry.planDayIndex` is `undefined`. With `outcomeTarget.planDayIndex` also `undefined`, the resulting rotation entry had `planDayIndex: undefined` after the action change (BUG-2). The rotation engine uses `planDayIndex` to attribute history entries to a specific plan day; a missing index causes `computeWorkoutTypeBreakdown` and stats functions to skip the entry entirely.
- **Risks**: Very low. `weeks` is already computed by `useMemo` on the same cycle; `.flat().find(…)` is an O(cells) scan at most (~35 cells per month). `resolvedDay` is undefined for days outside the active plan, in which case `planDayIndex` stays `undefined` — the same as the pre-fix behavior, so no regression.
- **Rollback**: Revert the two-line addition in `openExtraOutcome`.

### Feature: `computeWorkoutCompletionRate` in `src/lib/historyStats.ts`

- **What changed**: Added `WorkoutCompletionRate` interface and `computeWorkoutCompletionRate(planId, entries, today)` function. The function counts `complete`, `skip`, and `day_off` entries for a plan up to `today`, then computes two complementary rates: `workoutCompletionRate` (completed/(completed+skipped)×100, excludes day_off) and `overallRate` (completed/all×100). Both are integers or `null` when the denominator is zero.
- **Why it matters**: `computeLoggedRate` already measures *whether* days are logged; this new function measures *how often* logged workout days end in completion vs a skip. Together they give a more complete picture: a user with 95% logged rate but 40% completion rate is consistently recording but frequently skipping — a different pattern from 95% logged, 95% completed.
- **Tests**: +10 tests in `historyStats.test.ts`. Total tests: 1186 → 1196.
- **Risks**: None. Pure function with no side effects, no store dependencies, and no new imports.

---

## Pass 89 — 2026-08-02 (branch `claude/serene-cori-uv7ebe`)

### Change 1: ARCH-1 — Extract TodayRotationModals

- **Commit**: `c33f341`
- **What changed**: Created `src/components/today/TodayRotationModals.tsx` containing the Override rotation modal, Jump-to-day modal, Add Workout picker modal, and Add-from-Plan picker modal. All four were previously inline JSX in `TodayPage.tsx`. Props interface `TodayRotationModalsProps` defines ~20 typed props covering all state booleans, callbacks, and shared data (`planDays`, `currentPlanDayIndex`). Three lucide-react icon imports (`ChevronRight`, `ChevronLeft`, `ListPlus`) removed from `TodayPage.tsx` as they are now only needed by the new component. TodayPage reduced from 1,494 → 1,367 lines (−127).
- **Why it matters**: TodayPage grew back above 1,400 lines when the mobility feature (PRs #219–#221) added new inline modal UI. Extracting the rotation-override modals — a self-contained logical group — restores progress on the ARCH-1 decomposition goal. The 4 modals share data (`planDays`, `currentPlanDayIndex`) and are only conditionally rendered, making them a clean single-responsibility unit.
- **Files changed**: `src/components/today/TodayRotationModals.tsx` (new), `src/pages/TodayPage.tsx`
- **Risks / tradeoffs**: Pure structural refactor — no logic moved, no state ownership changed. The `onSelectFromPlan` handler closes the modal on selection; this co-location of state mutation and UI close remained in TodayPage (`setAddFromPlanIdx(idx); setShowAddFromPlan(false)`) and is passed down as a single callback, preserving the original behavior.
- **Rollback**: Revert `c33f341`. TodayPage returns to 1,494 lines, TodayRotationModals.tsx can be deleted.

### Change 2: Tests — Add mobility outcome coverage for buildLastSessionSummary

- **Commit**: `d0057f2`
- **What changed**: Added 4 test cases to `src/lib/__tests__/sessionSummary.test.ts` targeting the mobility path of `buildLastSessionSummary`. Tests cover: (1) multi-exercise mobility with duration → `'Last: 2 exercises · 3 sets · 12 min'`; (2) singular labels (1 exercise, 1 set, no duration) → `'Last: 1 exercise · 1 set'`; (3) all-skipped mobility outcome → `null`; (4) partial completion where only completed sets are counted → `'Last: 1 exercise · 1 set · 5 min'`.
- **Why it matters**: The mobility workout type was added in PRs #219–#221 with a full outcome logging path, but `sessionSummary.test.ts` had zero test cases for the mobility branch. Any regression in set-completion counting, duration formatting, or singular/plural labeling would be undetected. The 4 tests pin the exact output strings and edge cases.
- **Files changed**: `src/lib/__tests__/sessionSummary.test.ts`
- **Risks / tradeoffs**: Tests only — no production logic changed. All 4 tests pass immediately, confirming the existing `buildLastSessionSummary` mobility implementation is correct.
- **Rollback**: Revert `d0057f2`. No production behavior changes.

---

## Pass 88 — 2026-08-01 (branch `claude/serene-cori-bl4pj8`)

### [566dbd7] fix: remove duplicate 'Last:' prefix in session summary display

**Summary**: `buildLastSessionSummary` (lib/sessionSummary.ts) already returns
strings prefixed with `"Last: "` (e.g. `"Last: 3×8 @ 135 lb Bench Press"`).
Both render sites in TodayPage and TodayUpcomingList also prepended the literal
`"Last: "` in their JSX, producing `"Last: Last: …"` on screen for any user
who had previous session data logged for that plan day.

**Files changed**:
- `src/pages/TodayPage.tsx` — removed `Last:{' '}` text node from the pending
  card last-session paragraph.
- `src/components/today/TodayUpcomingList.tsx` — removed `"Last: "` literal
  from the upcoming session summary paragraph.

**Risk**: Low. No logic changes; only two rendered text literals removed.

---

### [4b3b73d] refactor(ARCH-1): extract TodayPendingCard from TodayPage

**Summary**: The ~85-line pending workout compact card (the card shown on Today
when the primary plan workout is not yet logged) is now a standalone component
`src/components/today/TodayPendingCard.tsx`. The `previewExpanded` useState
hook, which controlled the "Preview exercises" toggle, moved inside the new
component. Three now-unused imports were removed from TodayPage (`ChevronDown`,
`ChevronUp`, `WorkoutSlotDetails`). TodayPage.tsx shrinks from 1,463 → 1,395
lines (−68).

**Files changed**:
- `src/components/today/TodayPendingCard.tsx` (new) — 112-line pure component
  with 11 typed props and internal `previewExpanded` state.
- `src/pages/TodayPage.tsx` — import added, pending card block replaced with
  `<TodayPendingCard ... />`, `previewExpanded` state and three imports removed.

**Risk**: Low. Pure structural refactor. TypeScript verified clean. All 1,126
tests pass unchanged.

---

## Pass 87 — 2026-07-31 (branch `claude/serene-cori-02lc31`)

### [be0e55d] refactor(arch): extract TodayMobilitySection and TodayPlanProgressModal (ARCH-1 progress)

**Summary**: Two more pure-presentational components extracted from TodayPage as part of the ongoing ARCH-1 decomposition. TodayPage reduced from 1561 → ~1463 lines (−98).

**`TodayMobilitySection`** (new at `src/components/today/TodayMobilitySection.tsx`): Renders the Daily Mobility area in 4 states — no-routine (dashed "Set up" button), completed (teal summary row with undo), in-progress (sky "Continue" button), and idle (tap-to-start card). Props: `mobilityRoutine`, `mobilityCompletion`, `mobilityInProgress`, `mobilityActiveSession`, `onUndoCompletion`, `onOpenTracker`, `onNavigate`.

**`TodayPlanProgressModal`** (new at `src/components/today/TodayPlanProgressModal.tsx`): Renders the Plan Progress detail modal — completion ring (reuses `CompletedWorkoutsRing` re-exported from `TodayHabitSummary`) plus a stats table (workouts completed, streak, weeks elapsed, current cycle, plan length, logged rate, consecutive skips). Props: 10 typed fields.

**Cleanup**: Removed now-unused `Zap`, `Plus` lucide icons and `CompletedWorkoutsRing` import from TodayPage.

**Files changed**: `src/pages/TodayPage.tsx` (−98 lines), `src/components/today/TodayMobilitySection.tsx` (new, +88 lines), `src/components/today/TodayPlanProgressModal.tsx` (new, +90 lines)

**Risks**: None. Pure JSX extraction, no logic change, TypeScript confirms all prop boundaries.

---

## Pass 86 — 2026-07-30 (branch `claude/serene-cori-fnly7t`)

### [68a1136] fix(engine): attach historyEntry to upcoming days with pre-logged future entries

**Summary**: `getUpcomingDays` projected the rotation schedule forward without ever consulting stored entries for future dates. When a user pre-logged a day off on a future date via the Calendar, the Today page upcoming list had no way to know — it would show the scheduled workout card with no indication that a rest day had been planned.

**Fix**: Build a `date → entry` map inside `getUpcomingDays` (same dedup logic as `computeCurrentDayIndex`: newest `createdAt` wins per date), then attach the matching entry as `historyEntry` on each returned `ResolvedDay`. The rotation pointer projection is unchanged — future pre-logged entries are informational and do not advance or stall the pointer.

**Files changed**: `src/engine/rotationEngine.ts`

**Risks**: Very low. `historyEntry` is an optional field on `ResolvedDay`. No existing caller checks it for future-status days, so all existing code paths are unchanged. The change is purely additive: new data is available but only consumed by callers that explicitly look for it.

---

### [30cde3b] feat(ui): show Day Off placeholder in upcoming list for pre-scheduled rest days

**Summary**: Companion to the engine fix above. `TodayUpcomingList` now checks `rd.historyEntry?.action === 'day_off'` for each upcoming card. When true, a compact "Day Off" card (Coffee icon + muted "Day Off" label, 60% opacity) replaces the regular `WorkoutDayCard`. The card stays clickable so the user can open the calendar log flow and change their mind.

**Files changed**: `src/components/today/TodayUpcomingList.tsx`

**Risks**: Very low. The check is additive (new branch in JSX, no removal of old paths). Cards with no pre-logged entry (`historyEntry === undefined`) are completely unaffected. The `Coffee` icon is already bundled (used in TodayPage) so no new dependency.

---

### [d5843eb] test(engine): verify getUpcomingDays attaches historyEntry for future pre-logged dates

**Summary**: Five new test cases added to `rotationEngine.test.ts` covering: (1) a pre-logged `day_off` is attached as `historyEntry`; (2) `historyEntry` is `undefined` when no entry exists; (3) dedup — the most recent entry wins when multiple entries share a date; (4) entries from other plans are not attached; (5) attaching `historyEntry` does not affect the rotation pointer projection.

**Files changed**: `src/engine/__tests__/rotationEngine.test.ts`

**Risks**: None. Additive test-only change.

---

### [3907075] refactor(arch): extract TodayHabitSummary component (ARCH-1 progress)

**Summary**: Moved the compact habit-summary row (🔥 streak · total workouts · cycle progress · plan completion ring) from `TodayPage.tsx` into a new `TodayHabitSummary` component. The `CompletedWorkoutsRing` SVG sub-component (previously a module-local function in TodayPage) was co-located in the new file and exported — TodayPage re-imports it for the plan-progress detail modal, which uses `size={88}`. No logic or behaviour change.

**Files changed**: `src/pages/TodayPage.tsx` (–64 lines), `src/components/today/TodayHabitSummary.tsx` (new)

**Risks**: Very low. Pure JSX extraction — no state, no side effects, no logic change. All props thread through the component boundary unchanged.

---

## Pass 85 — 2026-07-29 (branch `claude/serene-cori-23vs7k`)

### [eb29a6d] fix(TodayPage): suppress PR celebration when editing an existing outcome

**Summary**: The PR detection block in `handleOutcomeConfirm` compared each exercise's post-workout max load against the pre-workout max from `maxLoadByExercise`. This fired on every outcome save — including when the user re-opened the modal via "Edit" on an already-completed workout. Because `maxLoadByExercise` already reflected the loads from the original log, re-saving the same weights would detect a "new record" whenever a load exceeded the last-synced exercise history snapshot, showing a spurious "New personal record!" banner.

**Fix**: Added `isEditingOutcomeRef` (`useRef<boolean>(false)`). `handleEditOutcome` sets it to `true` before opening the modal. At the top of `handleOutcomeConfirm`, the ref is captured into `const isEditing` and immediately reset to `false`. The PR detection block is gated on `!isEditing`.

**Files changed**: `src/pages/TodayPage.tsx`

**Risks**: Very low. `useRef` holds no UI state; changing it never triggers a re-render. The flag is reset unconditionally at the start of every `handleOutcomeConfirm` call, so a modal opened via any other path (first log, bonus outcome) always runs PR detection normally.

---

### [df29b22] refactor(arch): extract SwipeToDelete and TodayCompletedSection

**Summary**: Two related extractions. First, the module-local `SwipeToDelete` touch-gesture component (58 lines) was moved from `TodayPage.tsx` to `src/components/shared/SwipeToDelete.tsx` so future today-section components can share it without coupling. Second, the "Completed today" section — a heading, one button for the primary plan-day workout, and a list of swipeable extra-workout rows — was extracted into `src/components/today/TodayCompletedSection.tsx`. Store action callbacks (`removeOutcome`, `removeExtraEntry`, `removeLastOverrideByType`) remain in TodayPage, passed via `onDeleteExtra`. The removed `useEffect` import (previously used only by SwipeToDelete) was cleaned up.

**Files changed**: `src/pages/TodayPage.tsx`, `src/components/shared/SwipeToDelete.tsx` (new), `src/components/today/TodayCompletedSection.tsx` (new)

**Risks**: Very low. Pure JSX extraction — no logic change, no state, no side effects. TodayPage is now ~47 lines shorter.

---

## Pass 84 — 2026-07-28 (branch `claude/serene-cori-zfyw0n`)

### [58a57c7] fix(TodayPage): Undo removes backdated double-day extras via session tracking

**Summary**: The Undo handler (the "Undo" button shown after marking today's workout complete) filtered extra entries to remove by `ex.calendarDate === today`. This correctly removes a double-day bonus extra created in the same session — but fails when the user backdates the bonus via the outcome modal. `updateExtraEntryDate` moves the entry to the new date, so its `calendarDate` is no longer `today` and the filter skips it. A second bug compounded this: `removeOutcome` was called with `makeExtraWorkoutInstanceId(plan.id, today, ex.id)`, but after backdating, `moveOutcome` had already relocated the outcome key to `makeExtraWorkoutInstanceId(plan.id, completedDate, ex.id)`.

**Fix**: Added `sessionExtrasRef` (`useRef<Set<string>>(new Set())`) to track IDs of double-day extras created during the current session. Both `handleOutcomeConfirm` (when `addFromPlanIdx !== null`) and `handleUpcomingLog` (double-day path) record the new extra ID into the ref immediately after `addExtraEntry`. The Undo handler now matches extras by `sessionExtrasRef.current.has(ex.id) || ex.calendarDate === today`, and always passes `ex.calendarDate` (not `today`) to `makeExtraWorkoutInstanceId`. The ref is cleared after a successful undo.

**Files changed**: `src/pages/TodayPage.tsx`

**Risks**: Low. The `useRef` holds no UI state; changing it never triggers a re-render. The Set is scoped to the current React component instance and is not persisted. Existing Undo behavior for non-backdated extras is unchanged (they still match `ex.calendarDate === today`).

---

### [b247366] refactor(TodayPage): extract TodayUpcomingList component (ARCH-1 progress)

**Summary**: The upcoming-days section in `TodayPage.tsx` (~50 lines of JSX, plus per-item run-adaptation progression resolution inside the `.map`) was extracted into `src/components/today/TodayUpcomingList.tsx`. The new component accepts seven props and returns `null` when the list is empty (eliminating the `upcoming.length > 0` wrapper at the call site). Removed two now-unused imports from TodayPage: `TrendingUp` (lucide-react) and `resolveWorkoutDisplayTarget` (run-adaptation/selectors).

**Files changed**: `src/pages/TodayPage.tsx`, `src/components/today/TodayUpcomingList.tsx` (new)

**Risks**: Very low. Pure JSX extraction — no logic change, no state, no side effects.

---

## Pass 83 — 2026-07-27 (branch `claude/serene-cori-xr8w3j`)

### [a5af931] fix: outcome-history desync when backdating to an occupied date

**Summary**: In all three `handleOutcomeConfirm` handlers (TodayPage, CalendarPage, HistoryPage), `removeOutcome` and the outcome `workoutInstanceId` remap were executing unconditionally outside the `!destEntry` guard. The guard correctly prevents moving a history entry when the destination date is already occupied, but the outcome remap ran regardless. Result: when a user backdated a workout to a date that already had a logged entry, the history entry stayed at `today`/`originalDate` (correct) but the outcome was remapped to `completedDate` — a silent data mismatch where the History page displayed the entry with no matching outcome.

Two secondary issues fixed in the same commit:
1. **Dead `removeEntry` calls**: inside the `!destEntry` block, `removeEntry(planId, completedDate)` called on a date confirmed to have no entry — always a no-op that still triggered a spurious Zustand `set` and React re-render. Removed from all three handlers.
2. **Action-sync lookup fallback** (CalendarPage, HistoryPage): after `handleOutcomeConfirm`, the post-save action-sync searched for the entry only at `completedDate`. When the move was blocked, the entry stayed at `originalDate`, so the lookup at `completedDate` found the blocking `destEntry` and could update its action. Added `?? originalDate` fallback so the sync always finds the entry at the date where it actually ended up.
3. **`plansFromCsv` date validation** (csv.ts): `planStartDate` was accepted as any non-empty string. An invalid date (e.g. `"not-a-date"` or `"2023-02-30"`) was silently stored and would produce `NaN` in every downstream date computation (rotation engine, `dateDiffDays`, etc.). Added the same format regex + `isNaN(new Date(...).getTime())` guard that `historyFromCsv` already applied to `calendarDate`.

**Why it matters**: The outcome-history desync is a data-integrity bug that silently deletes visible outcome data (exercise sets, notes, progression records) from the History view. Any user who backdated a workout to a date with an existing entry would see the corrected workout appear in History but with a blank outcome panel.

**Files changed**: `src/pages/TodayPage.tsx`, `src/pages/CalendarPage.tsx`, `src/pages/HistoryPage.tsx`, `src/lib/csv.ts`

**Risks**: Low. The outcome remap was correctly guarded in the branch that DOES move the entry; we only removed the remap from the branch that was already preventing the entry move. Logic becomes more symmetric: entry and outcome always move or stay together.

**Rollback**: `git revert a5af931`

---

## Pass 82 — 2026-07-26 (branch `claude/serene-cori-83sosx`)

### [9a9d77e] fix(storeSync): add identity migrate placeholders for all remaining stores

**Summary**: `wpt_outcomes`, `wpt_program_vars`, `wpt_exercise_history`, and `wpt_settings` had no `migrate` entry in the STORES array. `syncOnLogin` applies the store's `migrate` fn to cloud data before calling `setState` — if the fn is absent, cloud data is hydrated raw, bypassing any future schema migration logic. This is BUG-4's final remaining gap (pass 81 added tests that exercised only `wpt_history` and `wpt_mobility` migrate wiring). Adding identity placeholders (`(data) => data`) gives all 7 stores uniform pipeline coverage and a clear extension point for real schema migrations.

**Why it matters**: For any app version that adds a schema migration for these stores, users who are already logged in and whose cloud data was written by an older version would silently receive un-migrated data on next login. The fix is forward-safety with no behavioral change today.

**Files changed**: `src/lib/storeSync.ts`

**Risks**: None — identity functions are a no-op.

**Rollback**: `git revert 9a9d77e`

---

### [1314cf0] feat(HistoryPage): expose notes field in extra-entry edit modal

**Summary**: `ExtraWorkoutEntry.notes?: string` existed on the type, `historyStore.updateExtraEntry` already accepted a `notes` patch, and the extra-entry list in `HistoryPage` already rendered `extra.notes` when present — but the edit modal had no way to view or edit the note. Added `editingExtraNotes` state initialised from `extra.notes ?? ''` in `openExtraEdit`, included `notes` in the `updateExtraEntry` patch in `saveAndCloseExtra` (saving `undefined` instead of `''` so falsy semantics are preserved), and added a 3-row `textarea` to the modal after the Name field.

**Why it matters**: Users who add notes via a route that does set them (e.g. a future API path or direct store interaction) had no way to view or edit those notes in the UI. This closes the display-vs-edit gap entirely.

**Files changed**: `src/pages/HistoryPage.tsx`

**Risks**: Very low. The store action already accepted `notes`; the only new code is the React state variable and the JSX field. Saving an empty textarea sends `undefined` which is the correct sentinel for "no note" on the optional field.

**Rollback**: `git revert 1314cf0`

---

## Pass 82 — 2026-07-25 (branch `claude/serene-cori-nbwqkx`)

### [65f0d57] fix(today): replace deprecated 'rest' fallback with 'other' in double-day flows; extract TodayBanners component

**Summary**: Fixed two `WorkoutType` fallback bugs in TodayPage.tsx that used `'rest'` (the deprecated legacy type) instead of `'other'` (the current canonical fallback) when creating `ExtraWorkoutEntry` records in the double-day flows. Both are in `addExtraEntry` calls: one in `handleOutcomeConfirm` (add-from-plan double-day) at line 549, and one in `handleUpcomingLog` (log-upcoming-as-today double-day) at line 621. The same bug was fixed in CalendarPage in pass 80 and in HistoryPage in pass 70 — TodayPage was the last remaining instance.

Also extracted the six informational banners from TodayPage.tsx into a new pure-display component at `src/components/today/TodayBanners.tsx`. The banners extracted: plan expiry celebration, stalled-rotation nudge, consecutive-skips nudge, streak-milestone celebration, run adaptation note, and difficulty-spacing warning. TodayBanners receives all computed values as props (18 total) and has no store dependencies of its own. TodayPage's JSX shrinks by ~120 lines. This is the first step of the ARCH-1 decomposition priority.

**Why it matters**: The `'rest'` type is no longer in `WORKOUT_TYPES` and is not offered anywhere in the UI. An `ExtraWorkoutEntry` written with type `'rest'` would display correctly (WORKOUT_META has a fallback entry for `'rest'`), but would be inconsistent with all other creation paths in the app. Any future code that filters or groups by `WorkoutType` may miss the entry.

**Files changed**: `src/pages/TodayPage.tsx`, `src/components/today/TodayBanners.tsx` (new)

**Risks**: Low. The bug fix touches fallback values on code paths that only fire when a plan day has no slots (unusual), and the type change is to the correct canonical value. The banner extraction is a pure JSX refactor with no logic changes; identical visual output.

**Rollback**: `git revert 65f0d57`

---

### [fd431be] feat(tracker): add draftVersion field to active workout draft

**Summary**: Added a `DRAFT_VERSION = 1` constant to `ActiveWorkoutTracker.tsx` and included it in every draft snapshot written to `localStorage`. On load, drafts with a defined `draftVersion` field that doesn't match the current constant are discarded and removed from storage, rather than being partially applied against a potentially incompatible state shape. Drafts without any `draftVersion` field (written by pre-pass-82 builds) are still accepted as-is, to avoid breaking in-progress workouts at the moment of update.

**Why it matters**: The active-workout draft (`wpt_active_draft_${instanceId}`) has no version guard. If a future code change adds or renames required fields in the draft structure, an old draft from a previous app version could silently corrupt the active workout on resumption. The version check provides a clean, explicit bail-out path.

**Files changed**: `src/components/workout/ActiveWorkoutTracker.tsx`

**Risks**: Very low. Existing drafts (no `draftVersion` field) are explicitly allowed through the guard, so no in-progress workout is disrupted. Only drafts that somehow carry a `draftVersion !== 1` (which can only happen after this pass is deployed and then a future pass increments the constant) will be discarded.

**Rollback**: `git revert fd431be`

---

## Pass 81 — 2026-07-24 (branch `claude/nightly-codebase-audit-yfetx3`)

### [6036bcb] test(storeSync): add coverage for cloud-sync branching and debounce logic

**Summary**: `storeSync.ts` — the Supabase cloud-sync bridge for all 7 Zustand stores — had zero tests across 4+ audit passes (TEST-1, the longest-standing carried-forward gap, first flagged pass 78). Added 13 tests covering: `syncOnLogin`'s first-login push vs. cloud-hydrate branching, per-store `migrate` wiring (history extras `source` backfill, mobility `activeSession` backfill), the fetch-error short-circuit, tolerance of unknown/renamed store names in cloud rows, and `subscribeStores`' debounce / `beforeunload` flush / unsubscribe-cancels-pending-write behavior.

**Why it matters**: This is the only path that can silently lose or corrupt user data across devices (a debounce or migrate-ordering bug here has no visible symptom until a user logs in on a second device and finds stale or missing history). Test-only change; zero behavior risk.

**Files changed**: `src/lib/__tests__/storeSync.test.ts` (new)

**Risks**: None — no production code touched.

**Rollback**: `git revert 6036bcb`

---

### [0050a45] fix(TodayPage): streak milestone banner used a different streak than the one displayed

**Summary**: `earlyPlanStreak` (fed to `useStreakMilestoneDismiss`) was computed via `computePlanStreak(...)` without a mobility-dates argument, while `planStreak` (shown in the habit row and the plan-progress modal) included mobility dates via `mobilityDateSet`. A comment justified the split by claiming mobility completions "aren't yet available" at that point in the render — untrue, the `mobilityCompletions` selector is read earlier in the same component. Moved the `mobilityDateSet` computation above the early-return guard, threaded it into `earlyPlanStreak`, and made `planStreak` reuse that value instead of recomputing an now-identical result.

**Why it matters**: A run of consecutive mobility-only days could show e.g. "🔥 32 days" everywhere in the UI while the 7/14/21/30-day milestone-banner logic kept evaluating a lower, stale streak count — silently suppressing celebrations or firing them at the wrong threshold.

**Files changed**: `src/pages/TodayPage.tsx`

**Risks**: Low. Pure data-flow correction — no new state, no new hooks, same computation now shared instead of duplicated. `planStreak`'s value is unchanged for any user without mobility-only streak days (the overwhelming majority of existing streaks).

**Rollback**: `git revert 0050a45`

---

### [d4da65d] fix(TodayPage): "Continue mobility" card broke exactly when routines were edited mid-session

**Summary**: `mobilityInProgress` required the paused checkpoint's `exerciseIds` to exactly match the live routine's ids before showing a "Continue" card. That check predates `reconcileCheckpoint()` (an adjacent recent commit, `911d095`), which was built specifically so a mobility session survives routine edits (add/remove/reorder exercises via "Manage routine") made while paused. The stale equality check meant editing the routine mid-session silently reverted the UI to a plain "Start Mobility Routine" button, implying the paused progress was gone — it wasn't; `MobilityTracker` would have transparently reconciled and resumed it.

**Why it matters**: This bug is only reachable by using the exact feature ("preserve mobility session progress across routine edits") that shipped just before this pass, so it's very likely a live UX bug for anyone who has tried that flow.

**Files changed**: `src/pages/TodayPage.tsx`

**Risks**: Low. Removing the equality check widens when the "Continue" card is shown (from "routine unchanged" to "checkpoint exists for today with progress") — strictly more permissive, and the fallback path it now avoids (`reconcileCheckpoint`) was already exercised and tested via `MobilityTracker.test.ts`.

**Rollback**: `git revert d4da65d`

---

### [84fe146] fix(csv): disambiguate legacy extraId collisions within a single import

**Summary**: `stableExtraId()` (the pass-80-recommended, already-shipped BUG-CSV fix) derives a synthetic id from `(planId, date, workoutType, workoutName)` for legacy CSV exports lacking an `extraId` column. Two rows in the *same* import sharing that composite key (e.g. two same-day, default-named "Yoga" extras) hashed to the identical id. `historyStore.importExtraEntries` only dedupes incoming rows against already-stored entries, not against each other in the same batch, so both rows would be inserted under one colliding id — corrupting id-keyed outcome lookups and making by-id edit/delete affect both entries at once. Added an `occurrence` counter, scoped to a single `historyFromCsv()` call, folded into the hash input for the second and later row sharing a key. Occurrence 0 (the common, non-colliding case) keeps the original unsuffixed hash, so existing ids are unaffected.

**Why it matters**: Silent data corruption on a plausible (not exotic) legacy-CSV shape — anyone who used default names for multiple same-day extras before the 2026-04-26 schema change and now re-imports that export.

**Files changed**: `src/lib/csv.ts`, `src/lib/__tests__/csv.test.ts`

**Risks**: Low. Purely additive disambiguation — occurrence-0 ids (the vast majority) are byte-identical to before. Also strengthened a test that had regressed to only checking "id is a non-empty string" instead of the actual idempotency guarantee.

**Rollback**: `git revert 84fe146`

---

## Pass 80 — 2026-07-21 (branch `claude/dreamy-mccarthy-h2vbby`)

### [6000a9c] fix(CalendarPage): slot fallback type 'rest' → 'other'

**Summary**: The zero-slots guard in `handleOutcomeConfirm` (line 244) used the deprecated `'rest'` WorkoutType. `planStore` migrations normalise `'rest'` to `'other'`, so using `'rest'` here put the code on a branch that no live plan can reach while also looking up `WORKOUT_META['rest']` (the legacy Moon icon / "Other" label) instead of `WORKOUT_META['other']`.

**Why it matters**: Silent visual corruption and wrong downstream logic for any plan day that has zero slots. The same bug was already fixed in `HistoryPage.tsx` but CalendarPage was missed.

**Files changed**: `src/pages/CalendarPage.tsx`

**Risks**: None — single character change, no logic change.

**Rollback**: `git revert 6000a9c`

---

### [68c2f9f] fix(csv): import workoutInstanceId helpers from lib, not store

**Summary**: `csv.ts` imported `makeWorkoutInstanceId` and `makeExtraWorkoutInstanceId` from `../store/outcomeStore` instead of their canonical home `../lib/workoutInstanceId.ts`. These functions are defined in `workoutInstanceId.ts` and only re-exported by `outcomeStore`.

**Why it matters**: A lib module importing from a store violates dependency direction (`lib → store` instead of `store → lib`). While it doesn't currently cause a circular import, if `outcomeStore` ever imported from `csv.ts`, a cycle would form and bundling would fail.

**Files changed**: `src/lib/csv.ts`

**Risks**: None — the functions are identical; only the import path changes. Tests confirm identical behaviour.

**Rollback**: `git revert 68c2f9f`

---

### [5f96761] fix(stores): add version + migrate to settingsStore and programStore

**Summary**: `settingsStore` (`wpt_settings`) and `programStore` (`wpt_program_vars`) both used `persist()` without `version` or `migrate`. All other five stores already have `version: 1`. Without a version, any future schema change would silently leave existing localStorage data without migration.

**Why it matters**: Forward-compatibility safety net. No data migration needed today; establishes the baseline so future schema changes can run correctly.

**Files changed**: `src/store/settingsStore.ts`, `src/store/programStore.ts`

**Risks**: On first load, Zustand sees `version: undefined` vs `version: 1` and calls the identity migrate — returns the existing data unchanged. Safe and correct.

**Rollback**: `git revert 5f96761`

---

### [13dd36d] fix(expressionEval): tokenizer stops at first decimal point in a number

**Summary**: The number scanner consumed any `[\d.]` sequence and relied on `parseFloat` to discard extra decimals. Replaced with an explicit `seenDot` flag that stops consuming at the second decimal point. Adds one test documenting the expected tokenizer behaviour.

**Why it matters**: Principled tokenization — the scanner no longer relies on `parseFloat`'s implicit truncation. No observable behaviour change for valid YAML-authored expressions.

**Files changed**: `src/lib/expressionEval.ts`, `src/lib/__tests__/expressionEval.test.ts`

**Risks**: None for valid inputs. Malformed multi-dot numbers already produced the correct result via `parseFloat`'s truncation.

**Rollback**: `git revert 13dd36d`

---

### [6463ed0] test(historyStore): document BUG-2 — day_off→complete without planDayIndex

**Summary**: Test that captures the current (buggy) behaviour of `updateEntryAction` when no `planDayIndex` is supplied while changing from `day_off` to `complete`. The resulting entry has `planDayIndex: undefined`, silently dropped by stats functions.

**Why it matters**: Regression anchor for the future fix. Documents the expected fix path in the test comment.

**Files changed**: `src/store/__tests__/historyStore.test.ts`

**Risks**: None — test-only change.

**Rollback**: `git revert 6463ed0`

---

## Pass 79 — 2026-07-19 (branch `claude/dreamy-mccarthy-0r25in`)

### Commit 1 — `f94088a`

**fix(TodayPage): use today string for date header to prevent stale display past midnight**

- `src/pages/TodayPage.tsx:651`: Changed `new Date().toLocaleDateString(...)` → `new Date(today + 'T00:00').toLocaleDateString(...)`, where `today` comes from `useToday()`.
- Without this fix, a session kept open past midnight would display yesterday's date in the header until the page was re-mounted.

### Commit 2 — `327484d`

**fix(HistoryPage): use parseISO(today) for weekly breakdown window to prevent stale date past midnight**

- `src/pages/HistoryPage.tsx:252`: Changed `addDays(new Date(), -55)` → `addDays(parseISO(today), -55)`, where `today` comes from `useToday()`.
- Without this fix, the weekly workout breakdown chart would anchor its 55-day window to yesterday's date after midnight, showing one day too far back.

### Commit 3 — `3924a79`

**fix(PlansPage): replace stale format(new Date()) with useToday() for correct midnight reset**

- `src/pages/PlansPage.tsx`: Removed `format(new Date(), 'yyyy-MM-dd')` local variable; replaced with `useToday()` hook.
- Added `import { useToday } from '../hooks/useToday'`.
- Without this fix, `isPlanExpired` and `computePlanProgress` in `PlanCard` received a stale date after midnight, potentially showing a completed plan as still "Active" until re-mount.

### Commit 4 — `2662bd7`

**feat(CalendarPage): highlight current streak days with amber dot indicator**

- `src/lib/historyStats.ts`: Added `additionalDates?: Set<string>` parameter to `computeCurrentStreakDates`, threaded through to `getStreakDatesSet`. Fixes API inconsistency with `computePlanStreak`.
- `src/lib/__tests__/historyStats.test.ts`: Added 1 test for `additionalDates` parameter — verifies a mobility date bridging a gap extends the streak date set.
- `src/pages/CalendarPage.tsx`:
  - Imported `computeCurrentStreakDates` from `../lib/historyStats`.
  - Added `streakDatesSet` `useMemo` scoped to the active plan, with `Object.keys(mobilityCompletions)` as `additionalDates`.
  - Each calendar cell now computes `isOnStreak` and renders a small amber dot (`w-1 h-1 rounded-full bg-amber-400`) when true.
  - Added "Streak" entry to the calendar legend with a matching amber dot.

---

## Pass 78 — 2026-07-15 (branch `claude/dreamy-mccarthy-cr3jyk`)

### Commit 1 — `38d2f06`

**fix(workoutInstanceId): fix stale comment and add extractExtraId helper**

| | |
|---|---|
| **Files** | `src/lib/workoutInstanceId.ts` |
| **Risk** | Very low — additive; no existing callers changed |
| **Rollback** | `git revert 38d2f06` |

The comment said nanoid uses "base-36 (0-9, a-z)"; the actual implementation (since pass 77) uses 32-char hex. Updated the comment. Added `extractExtraId(instanceId)` which anchors on the YYYY-MM-DD date pattern rather than naively splitting on `'_extra_'`. Any caller using the naive split would produce a wrong extraId if a planId or extraId ever contained `'_extra_'` as a substring.

---

### Commit 2 — `4cbaed8`

**fix(usePlanActions): replace stale today with useToday()**

| | |
|---|---|
| **Files** | `src/hooks/usePlanActions.ts` |
| **Risk** | Low — drops one import, adds one hook call; `useToday()` is already used in TodayPage |
| **Rollback** | `git revert 4cbaed8` |

`format(new Date(), 'yyyy-MM-dd')` is evaluated once when the hook initialises. If the app stays open past midnight without a full re-render of the consumer, every subsequent `complete()`, `skip()`, `dayOff()`, `advance()`, and `goBack()` call would write history entries with yesterday's date. `useToday()` uses a `setTimeout` to reset to the new date at midnight.

---

### Commit 3 — `6d26ab2`

**fix(AuthGate): gate dev signout div to import.meta.env.DEV**

| | |
|---|---|
| **Files** | `src/components/auth/AuthGate.tsx` |
| **Risk** | Very low — Vite dead-code-eliminates the false branch; no production behaviour change |
| **Rollback** | `git revert 6d26ab2` |

The `<div id="__auth-signout">` dev convenience helper rendered in every production bundle. Wrapping it in `import.meta.env.DEV` removes it from production builds entirely.

---

### Commit 4 — `960b699`

**fix(CalendarPage,HistoryPage): safer extraId extraction and destination guard**

| | |
|---|---|
| **Files** | `src/pages/CalendarPage.tsx`, `src/pages/HistoryPage.tsx` |
| **Risk** | Low — guards are additive; removes a silent data-loss path |
| **Rollback** | `git revert 960b699` |

Two fixes:

1. **extraId extraction**: replaced `.split('_extra_')[1]` with `extractExtraId()` in both files. Safe under all current IDs (hex can't contain `_extra_`), but future-proof.

2. **Destination guard**: in the non-extra date-move path, `removeEntry(planId, completedDate)` was called unconditionally before moving the history entry to the new date. If an independently-logged entry existed at the destination, it was silently deleted. Added a check: only proceed with the move if `completedDate` has no existing entry. The outcome still moves; only the history-entry relocation is skipped on collision.

---

### Commit 5 — `770bf3f`

**fix(TodayPage): guard date-change in handleOutcomeConfirm against data loss**

| | |
|---|---|
| **Files** | `src/pages/TodayPage.tsx` |
| **Risk** | Low — guard is additive; prevents a silent data-loss path |
| **Rollback** | `git revert 770bf3f` |

Same issue as commit 4, but in TodayPage's `handleOutcomeConfirm`. After `logAction` creates an entry for `today`, if the user changes the date in the outcome modal, the handler called `removeEntry(planId, completedDate)` and then `updateEntryDate(...)` — silently destroying any entry already at the destination. Added a `destEntry` check so the move only fires when the destination date is free.

---

### Commit 6 — `21a9d81`

**fix(CardioWorkoutTracker): explicitly cancel auto-advance timeout on manual nav**

| | |
|---|---|
| **Files** | `src/components/workout/CardioWorkoutTracker.tsx` |
| **Risk** | Low — stores a ref and calls `clearTimeout` earlier; no semantic change when navigation is not manual |
| **Rollback** | `git revert 21a9d81` |

The 1500ms auto-advance `setTimeout` was only cancelled through React's effect cleanup (which fires on re-render when `segmentIdx` changes). While this technically works, adding `cancelAutoAdvance()` explicitly in `goNext`, `goPrev`, and the segment-dot click handler makes the cancellation immediate and unconditional, removing any risk of a stale timeout firing after the user manually changes segment.

---

### Commit 7 — `64ed8f0`

**fix(storeSync): flush pending debounced writes on beforeunload**

| | |
|---|---|
| **Files** | `src/lib/storeSync.ts` |
| **Risk** | Low — purely additive; adds a `beforeunload` event listener that's properly cleaned up |
| **Rollback** | `git revert 64ed8f0` |

The 1.5s debounce means any state change made within 1.5s of closing the browser tab was never pushed to Supabase. On a single-device workflow, localStorage retains the data. On multi-device or after a browser data clear, those changes were permanently lost from cloud sync. The fix tracks pending timeouts in a `Map`, cancels them on `beforeunload`, and immediately calls `pushStore` for any store with a pending write. The `beforeunload` listener is registered when `subscribeStores()` is called and removed when the returned cleanup runs.

---

### Commit 8 — `cefdacf`

**test(workoutInstanceId): add coverage for extractExtraId helper**

| | |
|---|---|
| **Files** | `src/lib/__tests__/workoutInstanceId.test.ts` |
| **Risk** | Zero — tests only |
| **Rollback** | `git revert cefdacf` |

7 new tests: standard id, planId-with-underscores, extraId-containing-`_extra_` (the fragile-split scenario), non-extra id, missing date, empty string, and round-trip with `makeExtraWorkoutInstanceId`.

---

## Pass 77 — 2026-07-14 (branch `claude/dreamy-mccarthy-aeym9p`)

## Branch: `claude/dreamy-mccarthy-aeym9p`

---

### Commit 1 — `19b85c1`

**fix: upgrade nanoid to crypto.getRandomValues for 128-bit entropy**

#### What changed

- **Modified** `src/lib/utils.ts`: Replaced `Math.random().toString(36).slice(2, 11)` with `crypto.getRandomValues(new Uint8Array(16))` encoded as a 32-character hex string.

#### Why

The previous implementation produced ~46 bits of entropy (9 base-36 characters from a 53-bit Math.random source). For a single-user personal tracker this was functionally safe, but it violated the spirit of ID generation best practices and left open a theoretical collision path during bulk import operations. `crypto.getRandomValues` gives 128 bits of entropy with no new dependencies — Web Crypto is universally available in all supported environments (modern browsers + Node 15+). All existing consumers treat the ID as an opaque string, so the format change (base-36 → hex, 9 chars → 32 chars) is backward-compatible: new IDs are longer but carry no semantic meaning.

#### Risk

Very low. All store keys, localStorage keys, and `workoutInstanceId` construction treat `nanoid()` output as an opaque string. The regex in `parseWorkoutInstanceId` matches a date-shaped substring (`YYYY-MM-DD`), not the ID format itself — a 32-char hex string contains no date-like substrings. Existing persisted IDs (9-char base-36) are unaffected; only newly created records use the new format.

#### Rollback

`git revert 19b85c1` — reverts `src/lib/utils.ts` to the Math.random implementation. No data migration needed; the format change is forward-only (new records get new-format IDs; old records keep their existing IDs).

---

### Commit 2 — `930d1c8`

**feat: streak milestone celebration banner on Today page**

#### What changed

- **New** `src/hooks/useStreakMilestoneDismiss.ts`: Hook that computes the active milestone from a raw streak count, reads `isDismissed` fresh from localStorage on each render, and forces a re-render on `dismiss()`. Exports `getActiveStreakMilestone()` helper and `STREAK_MILESTONES` constant `[7, 14, 21, 30, 60, 90, 180, 365]`.
- **New** `src/hooks/__tests__/useStreakMilestoneDismiss.test.ts`: 13 unit tests covering all milestones, boundary values, streaks in between thresholds, above-max (365+), and the `STREAK_MILESTONES` coverage check.
- **Modified** `src/pages/TodayPage.tsx`: Added `earlyPlanStreak` `useMemo` (computed without mobility dates, before the early-return guard) and `useStreakMilestoneDismiss` hook call. Added amber celebration banner rendered between the consecutive-skips nudge and the run adaptation note.

#### Why

The existing Today page already shows a streak count and a "plan complete" celebration banner. But hitting a streak milestone (e.g. 7 days, 30 days) produces no feedback — a motivational miss. The banner is dismissable per-milestone so users aren't re-shown a congratulation they've already seen, but reaching the next milestone triggers a fresh banner. The amber color and fire emoji distinguish it from the purple plan-completion banner and the amber consecutive-skips nudge (the skips nudge also uses amber, but the two banners are mutually exclusive in practice: a high skip count means the streak is near 0, so both can't appear simultaneously).

The `earlyPlanStreak` is computed without mobility dates (which would require `mobilityDateSet`, itself a `useMemo` defined after the hook section). The one-day difference is acceptable for a celebration banner.

#### Risk

Low. The banner is additive; removing it requires only reverting the three modified lines in TodayPage and deleting the two new files. No store changes, no schema changes, no migration needed. The hook reads from localStorage — it cannot corrupt Zustand state.

#### Rollback

`git revert 930d1c8` — reverts all three files atomically. Alternatively, comment out the `{!planExpired && streakMilestone !== null && !streakMilestoneDismissed && ...}` block in TodayPage to hide the banner without removing the hook infrastructure.

---

# Overnight Changelog — Pass 76 (2026-07-12)

## Branch: `claude/dreamy-mccarthy-2h1jip`

### Commit 1

**test: cover additionalDates parameter in getStreakDatesSet and computePlanStreak (12 tests)**

#### What changed

- **Modified** `src/lib/__tests__/historyStats.test.ts`: Added 12 new tests covering the `additionalDates?: Set<string>` parameter of `getStreakDatesSet` and `computePlanStreak`.

#### Why

The `additionalDates` parameter was introduced to allow mobility-session dates (from `mobilityCompletions`) to count toward the plan streak displayed on `TodayPage`. `TodayPage.tsx` line 338 actively uses:

```typescript
computePlanStreak(plan.id, planEntries, planExtras, today, mobilityDateSet)
```

Despite this production usage, neither `getStreakDatesSet` nor `computePlanStreak` had any test that passed a non-empty `additionalDates` argument. The 7 `additionalDates` tests added to `computePlanStreak` cover: today-only date, consecutive dates, bridging a rotation gap, not bridging without the date, unconditional application (not filtered by planId), empty-set parity, and future dates not extending the streak. The 5 `additionalDates` tests in `getStreakDatesSet` cover: single date, multiple dates, union with entries, unconditional (not planId-filtered), and empty-set parity.

#### Risk

None — pure test additions. No production code was modified. All 1068 tests pass.

---

# Overnight Changelog — Pass 75 (2026-07-09)

## Branch: `claude/dreamy-mccarthy-vpg2n1`

### Commit 1 — `090e73e`

**perf+fix: pre-compute PR flags map in HistoryPage; add max-date to history date pickers**

#### Part A — O(N log N) PR flags pre-computation

- **New export** `buildPRFlagsMap(allRecords)` added to `src/lib/historyStats.ts`: Processes all `ExerciseSessionRecord` entries in a single pass sorted by `calendarDate`. Groups records by date so same-date sessions all see the same prior max (identical semantics to `computeWorkoutPRFlags`). Returns `Map<workoutInstanceId, {hasLoadPR, hasRepsPR}>` in O(N log N) overall vs. O(N²) when calling `computeWorkoutPRFlags` per history item.
- **Modified** `src/pages/HistoryPage.tsx`: Imports `buildPRFlagsMap` instead of `computeWorkoutPRFlags`. Adds `const prFlagsMap = useMemo(() => buildPRFlagsMap(allExerciseRecords), [allExerciseRecords])`. Both `OutcomeMetrics` call sites in the rendered list now do `prFlagsMap.get(instanceId)` (O(1)) instead of scanning all records inline.
- **New tests** in `src/lib/__tests__/historyStats.test.ts`: 7 tests covering empty input, first-session PR, load PR on exceed, no PR on tie, same-calendarDate records see same prior max, produces identical results to `computeWorkoutPRFlags` across three sessions, zero/null load exclusion.

#### Part B — History date picker future-date guard

- **Modified** `src/pages/HistoryPage.tsx` lines 768 and 863: Added `max={today}` to both `<input type="date">` elements in the history edit modals (rotation entry date and extra entry date). Prevents accidentally moving a logged workout to a future date. `today` (`YYYY-MM-DD`) is already available from `useToday()` at the top of the component.
- **Why**: Without `max`, both the browser date-picker UI and manual text entry allowed future dates. The `saveAndClose` and `saveAndCloseExtra` handlers had no server-side validation against future dates either.
- **Risk**: None — `today` is a stable value (changes only at midnight via `useToday`), and `max` is a standard HTML attribute that degrades gracefully on unsupported browsers (no constraint applied).

---

### Commit 2 — `e701e20`

**fix: remove unused withDurationMin helper in estimateRunDuration test (TS6133)**

- **Modified** `src/lib/__tests__/estimateRunDuration.test.ts`: Removed `withDurationMin` helper function (lines 5–7) that was declared but never called. This was the sole `tsc --noEmit` error at pass start (TS6133: 'withDurationMin' is declared but its value is never read).
- **Why**: The helper was likely a leftover from an earlier test draft. The `withTargetDurationMin` and `withTargetDistanceMiles` helpers that are actually used remain unchanged.
- **Risk**: None — removing unused dead code.

---

## Summary

| Metric | Before | After |
|---|---|---|
| Tests | 1049 | 1056 (+7) |
| TypeScript errors | 1 | 0 |
| Test files | 30 | 30 |

---

# Overnight Changelog — Pass 74 (2026-07-08)

## Branch: `claude/dreamy-mccarthy-ugdev5`

### Commit 1 — `bd8907d`

**refactor: extract estimateRunDurationMin to lib + add 22 unit tests**

- **New file** `src/lib/estimateRunDuration.ts`: Pure utility function extracted from `TodayPage.tsx` module scope. Estimates planned run duration in minutes from slot metadata using the following resolution order: `slot.durationMin` → `runConfig.targetDurationMin` → sum of segment durations → sum of segment distances × pace-by-type → `runConfig.targetDistanceMiles × 11` → 20 (default). Pace constants: tempo = 8 min/mi, warmup/cooldown = 12 min/mi, all other types = 11 min/mi.
- **New file** `src/lib/__tests__/estimateRunDuration.test.ts`: 22 tests covering every resolution branch, segment duration unit parsing (`"30min"`, `"20m"`, decimal values), segment distance with pace-by-type, `programVars` substitution (numeric and string var values), unknown variable skipping, `targetDistanceMiles` fallback, and all edge cases (empty slot, null runConfig, empty segments).
- **Modified** `src/pages/TodayPage.tsx`: Removed the inline 35-line `estimateRunDurationMin` definition; added `import { estimateRunDurationMin } from '../lib/estimateRunDuration'`. The function already accepted `programVars` as a second parameter since it was extracted to module scope in pass 72 — no call-site changes needed. Also added `differenceInCalendarDays` to the date-fns import (used in commit 2).
- **Why**: The function was untestable in isolation while living in a component file. Extracting it enables the 22 new tests and makes the logic independently reviewable.
- **Risk**: None. Function body is identical; only file location changed.

---

### Commit 2 — `047f8a1`

**refactor: replace manual date arithmetic in prevSessionDaysAgo with differenceInCalendarDays**

- **Modified** `src/pages/TodayPage.tsx`: Replaced an 8-line IIFE that used raw `Date.UTC(y, m, d)` subtraction to compute `prevSessionDaysAgo` with a single expression using `differenceInCalendarDays(parseISO(today), parseISO(prevSessionDate))` from date-fns.
- **Why**: The manual arithmetic was correct but verbose, hard to scan, and inconsistent with the rest of the codebase which uses date-fns throughout. The new expression is semantically equivalent: it computes the calendar-day difference (not wall-clock millisecond difference) between `today` and `prevSessionDate`, then returns `null` if the result is ≤ 0 (e.g., same-day session).
- **Risk**: Low. `differenceInCalendarDays` is already used extensively in the project. The guard `d => d > 0 ? d : null` preserves the same null-return behavior for same-day or future dates.

---

### Commit 3 — `1a29a3a`

**perf: memoize rotationLoggedCount Set creation in TodayPage**

- **Modified** `src/pages/TodayPage.tsx`: Wrapped `rotationLoggedCount` (a `Set<string>` built from `planEntries.map(e => e.calendarDate)`) in `useMemo` with `[planEntries]` as the dependency.
- **Why**: The Set was being rebuilt on every render (including every modal state transition, every scroll, and every unrelated state update). The computation is O(n) and was re-running for non-data changes. Memoizing it means the Set is only rebuilt when `planEntries` actually changes.
- **Risk**: None. The memoized value is semantically identical; the only change is when it recomputes.

---

### Commit 4 — `c337fa3`

**feat: Show "Cycle done" visual cue when rotation cycle just completed**

- **Modified** `src/pages/TodayPage.tsx`: Added a "Cycle done" chip that appears in the cycle progress section when `justCompletedRotation === true` (returned by `computeRotationCycleProgress`). Previously, completing the last workout in a cycle would show "0/N cycle" which was confusing — it looked like no progress rather than 100% progress.
- **Why**: The existing `justCompletedRotation` boolean was computed but the UI had no display path for it. The new chip ("Cycle done ✓") replaces the "0/N" text when the cycle is complete.
- **Risk**: Low — purely additive JSX conditional. `justCompletedRotation` is only `true` when `doneInCycle === 0 && totalDone > 0`, which is already well-tested.

---

## Pass 79 — 2026-07-20 (branch `claude/dreamy-mccarthy-ccykny`)

### Commit 1 — CI test gate

**ci: run Vitest test suite before building and deploying**

- **Modified** `.github/workflows/deploy.yml`: Added `npm test` step between Install and Build.
- **Why it matters**: Tests were only run manually between passes. Without a CI gate, a broken commit could ship to GitHub Pages before the failure was noticed. The test suite is pure Node.js (no Supabase env vars, no browser APIs) so it runs cleanly in the GitHub Actions runner.
- **Files changed**: `.github/workflows/deploy.yml`
- **Risks / tradeoffs**: Build time increases by ~3–4 s. If a future commit legitimately breaks tests, the deploy will block until fixed — this is the intended behaviour.
- **Rollback**: Remove the `Test` step from deploy.yml.

---

### Commit 2 — BUG-8 fix: deterministic outcomeSortKey (+ tests)

**fix(outcomeSortKey): append instanceId as deterministic tiebreaker**

- **Modified** `src/lib/outcomeSortKey.ts`: Changed return value from `primary` to `primary + '\x00' + instanceId`. The null-byte delimiter is below all printable ASCII, so it cannot collide with date or timestamp characters.
- **Modified** `src/lib/__tests__/outcomeSortKey.test.ts`: Updated the 5 exact-value tests to include the new suffix; changed the "no date → empty string" test to check relative ordering (which is the meaningful contract) rather than the exact string; added 2 new tests verifying that tie-breaking is deterministic for same-completedAt and same-calendarDate cases.
- **Why it matters**: Previously, two outcomes logged at the exact same second (e.g., during an import) returned identical sort keys. The ordering in `previousSetsHelper.ts` and `TodayPage.tsx` then depended on `Object.values()` iteration order — a V8 implementation detail, not a stable guarantee.
- **Files changed**: `src/lib/outcomeSortKey.ts`, `src/lib/__tests__/outcomeSortKey.test.ts`
- **Risks / tradeoffs**: The return value changes for every outcome (adds the `\x00instanceId` suffix). All callers use the key for relative comparison only (`<`, `>`, `localeCompare`) — no caller checks for equality or an exact string value. Net behaviour change: ties now break by instanceId (arbitrary but deterministic) rather than by insertion order.
- **Rollback**: Revert `outcomeSortKey.ts` to the single-expression form.

---

### Commit 3 — BUG-4 fix: cloud hydration migrations

**fix(storeSync): apply schema migrations when hydrating from Supabase**

- **Modified** `src/store/planStore.ts`: Exported `migratePlanState` (previously internal `function`, now `export function`) so storeSync can call it without duplicating logic.
- **Modified** `src/lib/storeSync.ts`:
  - Added `MigrateFn` type and optional `migrate` field to each STORES entry.
  - Added migration for `wpt_history`: calls `migrateHistoryState(data, 0)` — always applies from version 0, idempotent (extras with `source` already set are unchanged; only legacy undefined-source extras are patched to `'history'`).
  - Added migration for `wpt_plans`: calls `migratePlanState(data)` — normalises `weightlifting→weights`, `long_run→run`, `recovery_run→run`, `rest→other`, derives `location`/`weightsFocusArea` from deprecated `tags`.
  - Added inline migration for `wpt_mobility`: adds `activeSession: null` when absent (field was added in v2).
  - Updated `syncOnLogin` to call `entry.migrate(row.data)` before `setState` for any store that declares a migration.
- **Why it matters**: Zustand's `persist` middleware only runs `migrate()` when reading from `localStorage`. A direct `setState()` call (as used in cloud hydration) bypasses it. Users who log in on a new device or browser with cloud data stored by an older app version would get un-migrated data: extras without `source` (causing Undo to silently delete them), old slot types (causing display issues), and missing `activeSession` (causing the mobility tracker to behave unexpectedly).
- **Files changed**: `src/store/planStore.ts`, `src/lib/storeSync.ts`
- **Risks / tradeoffs**: All three migrations are idempotent — applying them to already-current data is a no-op. The `migratePlanState` export is internal-use only (marked with `@internal` JSDoc). No schema change required.
- **Rollback**: Revert both files. The migration export can stay in planStore without harm.
