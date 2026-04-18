# Implementation Plan

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
