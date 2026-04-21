# Implementation Plan

## 2026-04-21 — Overnight Audit (eighth pass)

Branch: `claude/epic-cannon-Ltjw1`.
Follow-up to the 2026-04-19 seventh-pass audit.
Baseline on entry: **194 passing, 0 failing** (after `npm install`).

### Architecture summary (unchanged)

Stack, store split, and engine layering match all prior audits. No
architectural drift since the seventh pass.

### What appears strong and well-designed (unchanged)

- 194-test suite covers engine/stores/adaptation/lib and now the
  TodayPage upcoming-log guard invariant.
- `OutcomeMetrics` is now a single shared component.
- `historyStore.clearPlanHistory` + `clearPlanOutcomes` correctly
  cascade across entries, overrides, extraEntries, and both primary
  and extra outcome keys.

### Key issues or risks this pass

1. **CSV history export/import silently drops `extraEntries`** (real
   data-loss path). `historyToCsv` only iterates rotation entries;
   `historyFromCsv` only produces rotation entries. The History page's
   "Export history CSV" button claims to export the user's history but
   in fact omits every ad-hoc workout (yoga session, extra run, double-
   day bonus) they've ever logged. A user who exports as a backup and
   then re-imports after clearing storage will silently lose all
   extras and their outcomes. This is especially bad because the
   History page's flat list shows extras counted and rendered — so
   users reasonably assume those rows are part of "history".
   **Priority: high.** Fix: add an optional `entryKind` column
   (`rotation` | `extra`) plus `workoutType` / `workoutName` columns.
   Old CSVs without `entryKind` parse as all-rotation (backward
   compatible). Add an `importExtraEntries` store action and wire it
   into `HistoryPage.handleImport`.

2. **`computeHistoryStats` ignores `extraEntries`** (correctness /
   UX inconsistency). HistoryPage renders a flat list that includes
   both rotation entries and extras (`${flatItems.length} workouts`
   in the header), but the Streak / 7-day / 30-day / Total stat tiles
   only count rotation entries. A user who has been logging only
   ad-hoc yoga every day for a week will see "Streak: 0" despite
   looking at seven green rows above. Fix: have
   `computeHistoryStats` accept `extras` as a second argument and
   treat them as completed workouts for counts and streak. Every
   existing caller lives in HistoryPage, so the blast radius is one
   file.

3. **Still open from prior audits** (recommendations only):
   - HistoryPage saveAndClose trap on date conflict.
   - `progressionStates` orphaning on plan delete (needs schema
     change).
   - `swap_slot` override UI.
   - Plan-expiry banner dismiss.
   - Routing "upcoming-complete when today is already logged" through
     ExtraWorkoutEntry instead of refusing (open question from 7th
     pass).

### Prioritized plan (this pass)

**Safe to implement:**

1. **[SAFE]** Extend `computeHistoryStats` to accept an optional
   `extras` array and include them in the counts / streak. Update
   the one HistoryPage callsite to pass `filteredExtras`. Add tests
   covering extras-only streaks, mixed windows, and the empty-extras
   case (default behavior).
2. **[SAFE]** Add `entryKind` + `workoutType` + `workoutName` columns
   to the history CSV. Export extras as rows and generate new IDs on
   import. Surface extras through `historyFromCsv` as a separate
   `extras` array in `HistoryImportResult`. Add `importExtraEntries`
   to `historyStore`. Wire both through `HistoryPage`. Preserve
   backward compatibility for pre-existing history CSVs.
3. **[SAFE]** Tests for the CSV extras round-trip, including a
   backward-compat test that an old header (no `entryKind`) still
   parses all rows as rotation.

**Not implemented this pass (recommendations only):**

- HistoryPage saveAndClose trap — still wants a dedicated Cancel
  button. Deferred (behavior change to an existing UI affordance).
- `progressionStates` orphaning — still needs a schema change.
- `swap_slot` UI / plan-expiry dismiss — still unchanged.
- Upcoming-complete routing through ExtraWorkoutEntry — still an
  open product question.
- Medium-complexity feature — **declined this pass**. The two
  findings here are both real correctness/data-loss issues; fixing
  them tightens the surface without expanding it. Keeping scope
  narrow.

### Rationale for sequencing

`computeHistoryStats` goes first because it's the smaller, pure-
function change with no persistence implications. CSV extras support
is larger (schema + store action + UI wiring + round-trip tests) and
builds confidence from the simpler change. Tests are written
alongside each commit rather than batched.

---

## 2026-04-19 — Overnight Audit (seventh pass)

Branch: `claude/gracious-heisenberg-2fsGC`.
Follow-up to the 2026-04-18 sixth-pass audit.
Baseline on entry: **192 passing, 0 failing** (after `npm install`).

### Architecture summary (unchanged)

Stack, store split, and engine layering match all prior audits. No
architectural drift since the sixth pass.

### What appears strong and well-designed (unchanged)

- 192-test suite covers engine/stores/adaptation/lib.
- Double-day bonus persistence is end-to-end and Undo is source-scoped.
- OutcomeModal's `workoutInstanceId` prop is a safe caller contract, now
  used consistently across TodayPage, CalendarPage, and HistoryPage.
- `historyStore.clearPlanHistory` handles entries, overrides, and
  extraEntries in a single sweep; `clearPlanOutcomes` covers both primary
  and extra outcome keys via the `${planId}_` prefix.

### Key issues or risks this pass

1. **TodayPage `handleUpcomingLog` silently overwrites today's entry**
   (real data-loss risk). When today is already resolved (primary entry
   logged) and the user opens an upcoming-day modal and taps "Complete",
   `handleUpcomingLog` builds `logDate = today` and calls
   `logAction(plan.id, today, rd.planDayIndex, 'complete')`. Because
   `historyStore.addEntry` dedupes by `(planId, calendarDate)` and
   replaces, today's primary entry is silently overwritten with the
   upcoming slot's `planDayIndex`. The original completion is lost — no
   confirmation, no undo trail. The affordance exists so users can "log
   the upcoming workout I actually did today", but it was never designed
   for the case where today was already logged. **Priority: high.**
   Safest fix is a guard that blocks the overwrite and surfaces an inline
   message ("Today is already logged. Undo it first, or use double-day to
   record both."). Routing the second completion through
   `ExtraWorkoutEntry` (double-day semantics) would be more permissive but
   is a bigger behavior change — defer.

2. **CalendarPage `handleOutcomeConfirm` uses `addEntry` to update the
   action field** on an existing history entry instead of
   `updateEntryAction`. Functionally equivalent — `addEntry`'s
   dedupe-by-date step means the existing id/createdAt are preserved
   through the payload spread — but semantically wrong and fragile: any
   future change to `addEntry`'s dedupe logic would silently break the
   CalendarPage sync path. HistoryPage already uses `updateEntryAction`
   for the same purpose. **Fix: switch CalendarPage to
   `updateEntryAction`; zero behavior change.**

3. **`OutcomeMetrics` render block is duplicated** between CalendarPage
   (as a local helper component) and HistoryPage (inlined twice — once
   for rotation entries and once for extras). Three copies of the same
   effort-dots + run-actuals block drift independently every time we
   touch the design. Pure refactor opportunity.

4. **HistoryPage edit-modal `saveAndClose` can trap the user on a
   date conflict.** The modal's `onClose={saveAndClose}` makes the X
   button and backdrop both trigger save. If the user picked a date that
   already has an entry, `saveAndClose` sets `dateConflict = true` and
   early-returns without calling `setEditingEntry(null)`. The user now
   can't close the modal without either fixing the date or deleting the
   entry. Minor UX issue; deferred this pass — a proper fix wants a
   dedicated Cancel button or an explicit "discard draft" path.

5. **`progressionStates` orphaning on plan delete** — still deferred from
   all prior passes. Needs a schema change or a reverse index; not
   touching this pass.

### Prioritized plan (this pass)

**Safe to implement:**

1. **[SAFE]** Guard `TodayPage.handleUpcomingLog` against overwriting
   today's entry. Inline error message when action='complete' would
   collide with an already-logged today.
2. **[SAFE]** Switch CalendarPage's action-sync from `addEntry` to
   `updateEntryAction`. Matches HistoryPage pattern.
3. **[SAFE]** Extract `OutcomeMetrics` to
   `src/components/workout/OutcomeMetrics.tsx`. Use from CalendarPage and
   HistoryPage (two callsites there).
4. **[SAFE]** Add an invariant-style store test documenting that the
   guard is what prevents data loss — `addEntry` on an existing
   (planId, calendarDate) replaces, and the TodayPage guard relies on
   this. Lock the behavior.

**Not implemented this pass (recommendations only):**

- HistoryPage saveAndClose trap — wants a dedicated Cancel button.
- `progressionStates` orphaning — needs schema change.
- `swap_slot` override UI — unchanged from prior audits.
- Plan-expiry banner dismiss — unchanged from prior audits.
- Medium-complexity feature — **declined this pass**. The baseline is
  stable and the surfaced issues are all correctness or DRY; no feature
  work is needed to unblock or improve stability. Keeping the surface
  area tight.

### Rationale for sequencing

The upcoming-log overwrite fix goes first because it's the only real
data-loss path. CalendarPage's action-sync change is a pure refactor,
zero behavior change. OutcomeMetrics extraction removes the duplication
so future outcome-display changes don't have to be made in three places.
Tests come last to lock the guard's invariant.

---

## 2026-04-18 — Overnight Audit (sixth pass)

Branch: `claude/overnight-audit-improvements-RzBkA`.
Follow-up to the 2026-04-18 fifth-pass audit.
Baseline on entry: **176 passing, 0 failing**.

### Architecture summary (unchanged)

Stack, store split, and engine layering match all prior audits. No
architectural drift since the fifth pass.

### What appears strong and well-designed (unchanged)

- 176-test suite covers engine/stores/adaptation/lib.
- Double-day bonus persistence is now complete end-to-end (fifth pass).
- OutcomeModal's `workoutInstanceId` prop makes it a safe caller contract.
- `historyStore.clearPlanHistory` now correctly handles entries, overrides,
  and extraEntries in a single sweep.

### Key issues or risks this pass

1. **CalendarPage OutcomeModal missing `workoutInstanceId` prop**
   (real data-correctness bug). When the user opens an extra-workout
   outcome from the Calendar day-detail modal — via `openExtraOutcome` —
   the correct `makeExtraWorkoutInstanceId(...)` key is stored in
   `outcomeTarget.instanceId`. But the `OutcomeModal` is rendered without
   `workoutInstanceId={outcomeTarget.instanceId}`, so inside
   `handleConfirm` the modal falls back to
   `makeWorkoutInstanceId(planId, calendarDate)` — the PRIMARY slot's key.
   Result: saving an extra-entry outcome from the Calendar overwrites the
   primary entry's outcome for that date. This is the exact same bug fixed
   in HistoryPage in commit `7969378` (fifth pass); Calendar was missed.
   **Fix: one-line addition identical to the HistoryPage fix.**

2. **TodayPage date string uses `Intl.DateTimeFormat('en-CA')` while every
   other file uses `format(new Date(), 'yyyy-MM-dd')` from date-fns.**
   Both reliably produce `YYYY-MM-DD`, but the inconsistency makes the
   codebase harder to scan and leaves a latent "what if locale changes"
   concern. Cheap to normalise.

3. **`updateEntryDate` / `updateExtraEntryDate` / `clearExtraEntriesForDate`
   have zero store-level tests.** These three actions were added for the
   calendar date-editing feature (fourth pass) but weren't covered in the
   same round. They're used in production flows (Calendar date picker,
   Undo on Today).

4. **ExtraWorkoutEntry has no `source` field** — open question from the
   fifth-pass review. Undo on Today currently wipes ALL of today's extras
   for this plan (including ones manually added from the History or
   Calendar page) because there's no way to distinguish double-day extras
   from user-created ones. Adding an optional `source: 'history' |
   'double_day'` field is a backward-compatible schema change that lets
   Undo be scoped correctly.

5. **`progressionStates` are not cleared when a plan is deleted** — noted
   by the audit agent; orphaned states accumulate in localStorage. Fixing
   this properly requires a plan→progressionGroup mapping that doesn't
   currently exist in the schema. **Documenting only this pass.**

### Prioritized plan (this pass)

**Safe to implement:**

1. **[SAFE]** Fix CalendarPage OutcomeModal — add `workoutInstanceId` prop
   (mirror of the HistoryPage fix; additive, no existing behavior change).
2. **[SAFE]** Normalize TodayPage date string to `format(new Date(), 'yyyy-MM-dd')`.
3. **[SAFE]** Add store tests for `updateEntryDate`, `updateExtraEntryDate`,
   `clearExtraEntriesForDate`.

**Medium-complexity feature (selected):**

4. **[FEATURE]** Add `source?: 'history' | 'double_day'` to
   `ExtraWorkoutEntry`. Update the two creation paths (double-day in
   TodayPage, "add workout for this day" in HistoryPage and CalendarPage).
   Update the Undo handler in TodayPage to only remove extras where
   `source === 'double_day'` (or source is undefined for old data) instead
   of clearing all extras for the date. Add tests for the new scoping.

**Recommendations only (not implemented):**

- `progressionStates` orphaning on plan delete — documented above.
- Outcome metrics component is duplicated in CalendarPage and HistoryPage
  — could be extracted, but purely cosmetic; not blocking.
- `swap_slot` override type still has no UI trigger (unchanged from all
  prior audits).
- Plan-expiry banner still shows every day with no dismiss.

### Rationale for sequencing

The CalendarPage bug is an exact peer of the HistoryPage fix from the
fifth pass — doing it first keeps the two pages consistent and is a
pure correctness win with no design judgment. Date normalisation is free.
Tests come before the feature to establish a clean baseline. The source-
field feature goes last because it depends on the tests establishing the
right mental model of the extra-entry lifecycle.

---

## 2026-04-18 — Overnight Audit (fifth pass)

Branch: `claude/add-bonus-workout-outcomes-c1H1R`.
Follow-up to the 2026-04-18 fourth-pass audit.
Baseline on entry: **171 passing, 0 failing** (after `npm install`).

### Architecture summary (unchanged)

Stack, store split, and engine layering match the prior audits:
- Zustand + localStorage stores: `planStore`, `historyStore`, `outcomeStore`
- Pure `rotationEngine` + `calendarProjection`
- Pure `run-adaptation/engine` for per-group run progression
- React Router, Vite, Tailwind, PWA via `vite-plugin-pwa`
- `historyStore.extraEntries` for ad-hoc workouts logged outside the rotation
  (used by History page; outcomes keyed via `makeExtraWorkoutInstanceId`)

### What appears strong and well-designed (unchanged)

- 171-test suite covers engine/stores/adaptation/lib.
- Stores are small, purely functional where possible, and each has its own
  test file.
- Outcome cleanup on plan delete + entry removal is wired through
  `clearPlanOutcomes` / `removeOutcome`.

### Key issues or risks this pass

1. **Double-day bonus workout logs only one workout** (user-reported; also open
   from prior audits). When double-day is toggled on and the user presses
   Complete, `handleOutcomeConfirm` logs the primary workout as a HistoryEntry
   at today, advances rotation past the bonus, and does NOT capture the
   bonus workout at all. The user expects two workouts to be recorded on the
   same date. `HistoryEntry` is keyed by `(planId, calendarDate)` so a
   naive second `logAction` on the same date would replace the first. The
   existing `ExtraWorkoutEntry` bucket (already used by History page for
   ad-hoc logs) is the right mechanism for the bonus — multiple can exist
   per date and each has its own outcome instance id via
   `makeExtraWorkoutInstanceId`. **Priority: high — user requested this run.**

2. **`OutcomeModal` ignores caller-supplied instance IDs** (latent bug).
   The modal always rebuilds `workoutInstanceId` from `makeWorkoutInstanceId(planId, calendarDate)`
   inside `handleConfirm`. `HistoryPage.openOutcomeForExtra` tracks the
   correct extra-instance id in `outcomeTarget.instanceId`, but when the
   user confirms, the outcome ends up saved under the primary key (plan+date),
   not the extra's key. Today this means: editing an outcome on an extra
   entry in History writes to the primary entry's outcome slot. This will
   block the double-day fix if not addressed. Fix: add an optional
   `workoutInstanceId` prop on OutcomeModal; callers who need a
   non-default id pass it in.

3. **Still open from prior audits** (recommendations only, unchanged):
   - `swap_slot` override type still has no UI trigger.
   - No progression-reset UI.
   - Plan-expiry banner shows every day once expired (no dismiss).

### Prioritized plan (this run)

**Safe to implement:**

1. **[SAFE]** Add optional `workoutInstanceId` prop to OutcomeModal
   (backward-compatible — default falls through to existing behaviour).
2. **[SAFE]** Fix the HistoryPage extra-outcome write path to use the extra's
   instance id (now that OutcomeModal accepts it). Prevents cross-writing.
3. **[USER PRIORITY]** Log the double-day bonus workout:
   - Primary remains a HistoryEntry at today (unchanged).
   - Bonus is persisted as an ExtraWorkoutEntry at today, with its outcome
     keyed by `makeExtraWorkoutInstanceId`.
   - Rotation still advances one extra step to skip past the bonus.
   - UX: after the primary OutcomeModal confirms, a second OutcomeModal
     opens for the bonus workout. The user can confirm or close; closing
     keeps the ExtraWorkoutEntry but leaves the outcome blank (matches
     how ad-hoc extras already work in History).
4. **[SAFE]** Tests: store-level test proving that two workouts on the same
   date land in separate buckets and survive reload.

**Explicitly out of scope for this run:**

- Rewriting the OutcomeModal to own its instance-id logic beyond the prop.
- Adding a separate "bonus" visual treatment in History — existing
  ExtraWorkoutEntry rendering already covers it.
- Undo/redo for the bonus — out of scope; the existing extra-entry
  History UI already supports edit/delete.
- The medium-complexity feature slot — this run's scope is the user's
  reported bug plus supporting fixes; stabilization first.

### Rationale for sequencing

The instance-id plumbing fix (item 1) unblocks both the History-extra
latent bug (item 2) and the double-day fix (item 3). Doing them in that
order makes each commit small and individually revertable: OutcomeModal
change alone is a no-op with existing callers, the HistoryPage fix is
a one-line instance-id wiring change, and the TodayPage change is
self-contained to the double-day path.

---

## 2026-04-18 — Overnight Audit (fourth pass)

Branch: `claude/system-improvements-m4b4f`.
Follow-up to the 2026-04-17 audit.
Baseline on entry: **169 passing, 1 failing** (1 stale assertion in `csv.test.ts`).

### Architecture summary (unchanged)

Stack, store split, and engine layering are identical to the 2026-04-17 write-up:
- `planStore` / `historyStore` / `outcomeStore`, all Zustand + localStorage
- Pure `rotationEngine` + `calendarProjection`
- Pure `run-adaptation/engine` for per-group run progression
- React Router, Vite, Tailwind, PWA via `vite-plugin-pwa`

Single new wrinkle since the last pass: `historyStore` now also owns an
`extraEntries` array (ad-hoc workouts logged on any day outside the rotation).

### What appears strong and well-designed

- Test suite is now comprehensive across engine/stores/adaptation (170 total).
- Rotation engine and calendar projection are still pure and clearly tested.
- Outcome cleanup on plan delete + entry removal is wired up in most paths
  (added in the 2026-04-17 pass).

### Key issues or risks

1. **Stale test expectation in `csv.test.ts`** (correctness-of-tests). The
   existing test `'generates fresh IDs on import'` expects `plans[0].id` to
   differ from the source planId. But commit `d16e8c2` intentionally changed
   the CSV import to **preserve planId** so exported history CSVs stay
   cross-referenceable. Day and slot IDs are still regenerated. The test was
   not updated to match — it now fails. Suite is green except for this one.

2. **Plan delete leaves `extraEntries` orphaned** (real data-correctness bug).
   `clearPlanHistory(planId)` only filters `entries` and `overrides` — not
   `extraEntries`. When a user deletes a plan, any ad-hoc workouts they
   logged for it remain in `localStorage` forever. Orphaned extras will
   never surface in the UI (they're scoped by planId that no longer exists)
   but they leak storage and are inconsistent with the existing cleanup
   pattern applied to entries, overrides, and outcomes.

3. **Misleading comment in `completionStateToAction`** (documentation bug).
   The JSDoc claims `'deferred → day_off (does NOT advance rotation)'`, but
   `rotationEngine.computeCurrentDayIndex` advances the pointer on all three
   action types (`complete`, `skip`, `day_off`). A reader debugging the
   progression semantics would be actively misled. Cheap to correct.

4. **Unused `minStepMiles` / `maxStepMiles` on `RunWorkoutConfig`** (not a
   bug). They round-trip through CSV but the adaptation engine doesn't read
   them. Intentional future-compat; leave alone.

5. **Still open from prior audits** (recommendations only):
   - `swap_slot` override type has no UI trigger (dead code path in engine).
   - Double-day bonus workout has no outcome capture.
   - No progression-reset UI.
   - Plan-expiry banner shows every day once expired (no dismiss).

### Prioritized plan (this run)

**Safe to implement:**

1. **[SAFE]** Fix the stale `csv.test.ts` assertion to match current intent:
   planId preserved, day & slot IDs regenerated. Restores green baseline.
2. **[SAFE]** Extend `clearPlanHistory` (or add `clearPlanExtraEntries`) so
   the Plan-delete flow removes orphaned extra entries too. Wire it up in
   `PlansPage`. Mirror of the fix done last pass for outcomes.
3. **[SAFE]** Correct the misleading JSDoc on `completionStateToAction`.
4. **[SAFE]** Add a small integration test: plan delete removes extras +
   their outcomes, leaves other plans' extras untouched.

**Recommendations only (not implemented this run):**

- `swap_slot` UI — needs product decision on scope.
- Double-day bonus outcome — needs UX path for a second OutcomeModal.
- Progression reset button — scope decision (single group vs. all).
- Expiry-banner dismiss — trivial but wants a persisted-dismissal design.
- Medium feature: **deferred** to keep the run narrowly focused on
  correctness; nothing in the audit suggests the codebase is destabilised.

### Rationale for sequencing

The failing test is both a blocker for a clean run and a 1-line fix; it goes
first. The extras-cleanup bug mirrors an already-established pattern (outcome
cleanup from 2026-04-17), has a clear test shape, and is genuinely user-
visible if someone browses devtools storage. Doc correction is free. Keeping
the scope tight this run — no new features, no architectural churn.

---

## 2026-04-17 — Overnight Audit (third pass)

Branch: `claude/funny-galileo-6zMOl`.
Follow-up to the 2026-04-16 audit (branch `claude/audit-harden-tracker-hIHXy`).
Baseline: 156 tests pass.

### Architecture summary

**Stack**: React 18 + TypeScript + Zustand + React Router + Vite + Tailwind. PWA built
via `vite-plugin-pwa`. Deployed to GitHub Pages.

**Stores** (all `zustand/persist`, localStorage-backed):
- `planStore` — CRUD on plans, active plan pointer, duplication, bulk import.
- `historyStore` — logged `HistoryEntry` (complete/skip/day_off) + `OverrideEntry`
  (advance/go_back/jump/swap_slot). Deduplicates by (planId, calendarDate).
- `outcomeStore` — rich per-workout outcomes keyed by `${planId}_${calendarDate}` and
  per-group run progression state.

**Pure engine**: `rotationEngine.ts` computes the rotation pointer at any date from
history entries + overrides; `calendarProjection.ts` extends that to build a month grid.
`modules/run-adaptation/engine.ts` evaluates whether a completed run should progress,
hold, or regress distance targets.

### Product capability summary

- Rotation-based workout tracker — you define a repeating day sequence, the app tells
  you which day it is today.
- Complete / skip / day_off actions, plus overrides (advance, go_back, jump) on any
  date, retroactive calendar logging.
- Run progression: completed runs with good effort auto-increase distance targets for
  the next run in the same group.
- CSV import/export for plans and for history+outcomes.
- PWA-installable, offline-capable.

### What appears strong and well-designed

- **Rotation engine**: single source of truth, pure, extensively tested (37 tests).
  Same function computes today, upcoming, and calendar ranges — no duplication.
- **Store separation**: history vs. outcomes are decoupled so the rotation logic
  doesn't depend on rich outcome data. Import/export round-trips through well-defined
  CSV schemas.
- **Test coverage**: 156 tests across engine, stores, adaptation. The rotation engine,
  run adaptation engine, and both persistent stores all have coverage.
- **Calendar projection**: clamps `fromDate` to `plan.startDate` so pre-plan cells
  render as neutral — a subtle but important fix from the prior pass.

### Key issues or risks

1. **Orphaned outcomes on plan delete**. `PlansPage` delete handler calls
   `clearPlanHistory(planId)` but NOT `clearPlanOutcomes(planId)`. The function exists
   in `outcomeStore` and is tested — just never wired up. Deleted plans leave their
   `WorkoutOutcome` records in localStorage forever. Growth is small but the
   inconsistency between the two cleanup paths is a correctness bug.

2. **Undo on TodayPage leaves outcome intact**. `Undo` calls `removeEntry` but not
   anything on the outcome store. If a user undoes a completion, the OutcomeModal will
   pre-populate from the stale outcome next time they open it. This is arguably a
   feature (preserve partial entry) but is undocumented.

3. **`uiStore.ts` is dead code**. `useUIStore` is defined but never imported anywhere.

4. **CSV round-trip identity loss**. `plansFromCsv` assigns new plan IDs on every
   import. If a user then imports history for the same plan, the history refers to the
   old (pre-import) plan ID, and rows get skipped with a warning. The workflow works
   once per session but isn't idempotent. Documented as a known limitation.

5. **History filter defaults to "All plans"**. With one active plan and occasional
   history from old plans, the default shows everything — arguably noisy. Minor UX.

6. **Double-day: only the primary workout's outcome is captured** (noted in prior
   audit, still open).

7. **No clear "reset progression" UI** (noted in prior audit, still open).

8. **No indicator when a plan has no next-workout ahead** — once `isPlanExpired`
   returns true, the banner shows but the upcoming list still projects. Consistent with
   previous audit decision.

### Prioritized plan

**Safe to implement in this run:**

1. **[SAFE]** Wire `clearPlanOutcomes` into the plan delete flow — fixes orphaned data.
2. **[SAFE]** Clear the matching outcome when a history entry is deleted (Undo on
   Today + Delete in History editor + Clear on Calendar day modal). Preserves the rule
   that a workout instance is only "outcome-present" if it's been logged.
3. **[SAFE]** Default the History plan filter to the active plan when an active plan
   exists; fall back to "All" when activePlanId is null or the active plan has no
   entries.
4. **[SAFE]** Remove dead `uiStore.ts`.
5. **[SAFE]** Add integration-style store test for plan-delete cascading cleanup.
6. **[SAFE]** Add test for "Undo also removes outcome" (history + outcome store).

**Medium-complexity feature candidate (optional):**

7. **[SELECTED]** Small History stats summary at the top of HistoryPage —
   read-only: total workouts, current streak, 7/30-day completion counts. Adjacent,
   zero engine changes, derives from existing state.

**Recommendations only (not implemented):**

- Double-day bonus outcome capture — requires a UX path for a second OutcomeModal.
- Swap-slot override UI — design + implementation needed.
- Progression reset button — small UX decision about scope (one group vs. all).
- Plan ID preservation across CSV import — would change import semantics.

### Rationale for sequencing

Start with the orphaned-data bug because it's pure correctness. Then expand the Undo
behavior to remove outcomes too — it's a related correctness fix (keeps the two stores
in lockstep). Default filter and dead-code removal are trivial. Tests close the loop.
Feature work last and only if stable.
