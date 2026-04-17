# Implementation Plan

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
