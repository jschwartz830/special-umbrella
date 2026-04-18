# Review Notes — Overnight Audit

## 2026-04-18 run — branch `claude/system-improvements-m4b4f`

### Executive Summary

Fourth-pass audit, building on 2026-04-17. Intentionally narrow:
**5 commits** (1 plan doc, 1 test-correction, 1 real-bug fix, 1 doc
fix, 1 test addition). No engine changes, no new features, no schema
changes.

The baseline was 169 pass / 1 fail — a single stale test assertion.
End state is 171 pass.

### Review first — the real correctness fix

**`90ef6b3` — extraEntries orphaned on plan delete**

`clearPlanHistory(planId)` filtered `entries` and `overrides` but not
`extraEntries`. Any ad-hoc workouts the user logged against a plan
(yoga, swim, etc. logged outside the rotation) stayed in localStorage
after the plan was deleted. They could never surface in the UI (their
planId was gone) but they leaked storage and broke the "delete means
delete" invariant that applies to every other scoped record.

One-line addition to the existing filter call:

```ts
extraEntries: s.extraEntries.filter(e => e.planId !== planId),
```

No UI changes were needed — `PlansPage` already calls `clearPlanHistory`
→ `clearPlanOutcomes` → `deletePlan`, and extra-outcome keys are
prefixed `${planId}_` so `clearPlanOutcomes` already covers them.

### Supporting changes

- **`40edf34`** — stale CSV test assertion flipped. Commit `d16e8c2`
  intentionally started preserving planId on CSV import so previously
  exported history CSVs stay linkable. The test still expected a
  regenerated id and had been failing since that change landed.
- **`aa09ad7`** — JSDoc on `completionStateToAction` had claimed
  `deferred → day_off (does NOT advance rotation)`. The rotation
  engine advances the pointer for all three action types. Doc only.
- **`59ec028`** — new integration test: delete plan A, verify plan A
  extras + their outcomes are gone and plan B's are intact.

### Nothing is risky or destructive

No engine logic changed. No migration. No storage format changed.
Extras filter mirrors the existing pattern for entries/overrides.

### Not implemented (recommendations only)

- `swap_slot` override UI — product decision still needed.
- Double-day bonus outcome capture — needs UX path for second modal.
- Progression-reset UI — scope decision (per-group vs global).
- Plan-expiry banner dismiss — wants a persisted-dismissal design.
- **Medium-complexity feature was intentionally declined**. Baseline
  was already close to clean; the three fixes are pure correctness
  and the audit surfaced no stability concerns. Keeping the scope
  narrow means the review surface is 5 small commits, each
  individually revertable.

### Estimated review time

~10 minutes. Two of the five commits are doc-only, one is a test
correction, one is a 1-line fix, one is a new test.

---

## 2026-04-17 run — branch `claude/funny-galileo-6zMOl`

### Executive Summary

Third-pass audit, building on the 2026-04-16 run. 7 commits: 4 fixes,
1 deletion of dead code, 1 test-only addition, 1 small feature.

**Review first** — the two real correctness fixes:

1. **Orphaned outcomes on plan delete (`3e83c25`)** — `PlansPage` delete
   handler now calls `clearPlanOutcomes` alongside `clearPlanHistory`.
   The `clearPlanOutcomes` function existed and had its own test but
   was never wired into the UI. A high-confidence one-line fix.
2. **Stale outcome after Undo / Delete / Clear (`2bff88e`)** — added
   `removeOutcome(instanceId)` to outcomeStore and called from the three
   entry-removal paths (TodayPage Undo, HistoryPage delete entry,
   CalendarPage clearDate). Keeps the two stores in lockstep; a user
   who undoes a completion and re-opens the OutcomeModal no longer sees
   stale fields.

**Low-risk supporting changes**:

- **Default the History plan filter to active plan (`78a9152`)** —
  pure UX default. Falls back to "all" when no active plan exists or it
  has no entries. Verify by opening HistoryPage with multiple plans.
- **Remove dead `uiStore.ts` (`32de834`)** — verified by grep: zero
  importers anywhere under `src/`.
- **+14 tests (`ddc93d6`, `724ca92`)** — removeOutcome, plan-delete
  cascade, historyStats helper. All green.

**Feature**:

- **History stats row (`724ca92`)** — 4 pure-derived tiles (Streak,
  7-day, 30-day, Total) at the top of HistoryPage. Zero engine
  coupling; recomputed on every render from the currently-filtered
  entries. Streak definition: consecutive days ending today with a
  `complete` or `day_off` entry. Skip or a gap breaks it.

### Open questions / worth reviewing carefully

- **Streak definition**. I chose `complete || day_off` breaks on `skip`.
  That matches "stayed on program" semantics but another valid choice
  is `complete` only. Easy to change via `historyStats.ts`.
- **Active-plan default for HistoryPage filter**. Reasonable for most
  users but a user reviewing all-time history across multiple plans
  will now have to select "All plans" each visit.

### Nothing is risky or destructive

No rotation-engine logic changed. No migration needed. No persisted
storage schema changes. The `removeOutcome` action mirrors the existing
`clearPlanOutcomes` pattern.

### Not implemented (from IMPLEMENTATION_PLAN.md)

- Double-day bonus outcome capture — needs UX design.
- Swap-slot override UI — needs UX design.
- Progression reset button — small UX scope decision.
- Plan ID preservation across CSV import — would change import semantics.

---

## 2026-04-16 run

Generated: 2026-04-16

---

## Executive Summary

### What Changed
10 commits implementing bug fixes, code quality improvements, new tests, and UX enhancements. All changes are on branch `claude/audit-harden-tracker-hIHXy` and have not been merged to main.

### Highest Confidence Changes (Review First)
1. **Skip button bug fix** — the biggest practical bug; Skip was creating an override instead of a history entry. Easy to verify: skip a workout, check the calendar/history to confirm it shows as "skipped" not "unlogged".
2. **updateEntryAction planDayIndex fix** — subtle but correct; changing a day_off to complete/skip now preserves or restores planDayIndex properly.
3. **Rotation engine test suite** — 37 new tests documenting the scheduling contract. Review the test file to verify the expected behaviors match your mental model.

### Risky or Worth Reviewing Carefully
- **Unsaved changes guard in PlanBuilderPage** — functional but touches the state initialization flow. The `isDirty` state starts false, and the `markDirty()` call is added to every mutation handler. If any handler was missed, users could lose changes without a warning. Check by making edits and pressing back.
- **Plan expiry banner on TodayPage** — calls `isPlanExpired()` on every render. Pure function, not expensive, but verify the threshold behavior matches your intent (expires at the START of the day after the last rotation/week).

### What is Risky / Do Not Merge Without Review
Nothing implemented is destructive or data-altering beyond what it should be. All changes are additive or corrective. Each commit is individually revertable. The biggest risk is the Skip bug fix — if there are users with existing data, their past skipped days may have been recorded as advance overrides instead of skip entries. Existing data is unaffected (overrides are still there), but future skips will now correctly go to history.

---

## Biggest Issues Found

### 1. Skip Button Was Broken (FIXED)
`handleSkip()` in `TodayPage.tsx` was calling `actions.advance()` (override) instead of `actions.skip(planDayIndex)` (history entry). This meant:
- Skipped days showed as `past_unlogged` on calendar
- No entry appeared in History
- Rotation advanced via override instead of logged entry (subtly different semantics)

### 2. updateEntryAction Lost planDayIndex (FIXED)
Changing a history entry from `day_off` to `complete` or `skip` via the history editor would leave `planDayIndex = undefined`, causing the entry to display "Unknown day".

### 3. Notes Divergence Across Stores (FIXED)
Editing notes in the history modal only updated `HistoryEntry.notes`. `WorkoutOutcome.notes` stayed stale, so reopening the OutcomeModal on Today page would show old notes.

### 4. getFutureProjection Not Applying Overrides (FIXED)
A helper in `calendarProjection.ts` had its own projection loop that didn't apply today's overrides. This function is currently unused (dead code), so it wasn't causing issues, but the inconsistency was misleading. Replaced with a delegation to `getUpcomingDays`.

### 5. Zero Tests on Rotation Engine (FIXED)
The most critical business logic had no tests. Now has 37 tests.

### 6. No Unsaved Changes Warning (FIXED)
PlanBuilderPage let users navigate away without warning, losing all edits.

### 7. Plan Expiry Invisible to User (FIXED)
`isPlanExpired()` existed in the engine but was never called from the UI.

---

## Improvements Completed

| # | Change | Commit |
|---|--------|--------|
| 1 | Fix Skip button | `1f3ed3c` |
| 2 | Fix updateEntryAction planDayIndex | `3fa7753` |
| 3 | Fix getFutureProjection | `88bbb71` |
| 4 | Remove isActive dead code in OutcomeModal | `746509f` |
| 5 | Add rotation engine test suite (37 tests) | `302fcba` |
| 6 | Unsaved-changes guard in PlanBuilderPage | `9914b84` |
| 7 | Plan expiry indicators (TodayPage + PlansPage) | `5805553` |
| 8 | History page: plan filter + empty state fix | `467e225` |
| 9 | Fix notes drift between two stores | `435d983` |
| 10 | Remove duplicated makeWorkoutInstanceId | `0863e99` |
| 11 | Add historyStore test suite (28 tests) | `cfd4c36` |
| 12 | Add outcomeStore test suite (17 tests) | `efe89fb` |
| 13 | Add getResolvedDaysRange + buildMonthGrid tests (31 tests) | `e0d5eba` |
| 14 | Fix WorkoutDayCard dynamic Tailwind border class | `2053931` |
| 15 | Document isFromProgression=false edge case in tests | `6893e35` |
| 16 | Fix buildMonthGrid: don't show pre-plan dates as past_unlogged | `f1971d2` |

---

## Small Quality-of-Life Features Added

1. **Plan filter on History page** — when you have multiple plans with history, a dropdown lets you filter by plan. Only shown when >1 plan has entries.

2. **Plan completion / expiry banners** — TodayPage shows a purple "Plan complete!" banner when you've hit your rotation/week target. PlansPage shows "Complete" badge instead of "Active" for expired plans.

3. **Unsaved changes guard** — PlanBuilderPage now asks "Keep editing" or "Discard" when you try to navigate away with unsaved edits.

---

## Definitely Keep

- **Skip bug fix** — This is clearly wrong behavior, clearly fixed. No product judgment required.
- **updateEntryAction planDayIndex fix** — Correct behavior, backward compatible.
- **Rotation engine tests** — Adds critical coverage with zero risk.
- **Notes drift fix** — Correctness improvement.
- **makeWorkoutInstanceId dedup** — Simple correctness.

---

## Probably Keep But Tweak

- **Unsaved changes guard** — May want to also intercept bottom nav tabs (the back button is covered; the nav tabs are not). Currently, tapping a bottom nav tab while editing would navigate away without the guard. Fixing this would require a router blocker (react-router's `useBlocker` hook in v6.7+).

- **Plan expiry banner** — The banner shows every day once expired, which could be annoying. You might want:
  - A dismiss button that persists (localStorage key) 
  - Or only show on the first visit after expiry
  - Or just keep it always visible as a gentle reminder

- **History plan filter** — Currently defaults to "All plans". You might want it to default to the active plan.

---

## Recommendations Only, Not Implemented

### High Value, Low Risk

1. ~~**`getResolvedDaysRange` edge case**~~ **FIXED** (`f1971d2`): `buildMonthGrid` now clamps the range to `plan.startDate`, so pre-plan cells are neutral/non-interactive.

2. **History edit → day_off → complete**: When changing a day_off entry to complete via the history editor, `planDayIndex` stays `undefined` because it was never set. The user should be shown a picker to select which plan day was completed. Currently shows "Unknown day".

3. **Double-day outcomes**: When using double-day mode, only the first workout's outcome is captured. The second (bonus) workout advances the rotation via override but has no outcome record. This could be improved by showing a second OutcomeModal after the first.

4. **`useBlocker` for nav tabs**: Extend the unsaved-changes guard to intercept bottom nav tab navigation (in addition to the back button already covered).

5. **`swap_slot` override not wired up in UI**: The `swap_slot` override type exists in the data model and is handled by the engine, but there's no UI to trigger it. Worth implementing or removing the dead code.

### Medium Value

6. **Run config distance vs legacy targetDistance**: In PlanBuilderPage, the "Distance (mi)" field in the basic run section sets `slot.targetDistance` (legacy), while the "Run Config" section's distance field sets `slot.runConfig.targetDistanceMiles`. The selector correctly prioritizes runConfig, but users might set both and be confused. Consider hiding the legacy field when runConfig is defined.

7. **Progression state reset mechanism**: The `reset` action exists in `ProgressionAction` type but nothing in the UI triggers it. If a user wants to reset progression (e.g., after an injury), they'd need to clear all plan outcomes.

8. ~~**WorkoutDayCard dynamic border color**~~ **FIXED** (`2053931`): Added static `borderColor` to `WorkoutMeta`.

9. **Override menu after completion**: The Override button row is shown even after a workout is completed for the day. Applying overrides post-completion affects tomorrow's rotation, which is useful but confusing. Consider adding a tooltip or secondary label clarifying this.

---

## Open Questions for Me

1. **Skip semantics**: Now that Skip correctly logs a history entry, should it continue to advance the rotation like it does? Currently: complete and skip both advance the rotation by 1; day_off also advances. Is this your intended behavior, or should skip NOT advance? (i.e., "skip today's workout but still do it later in the week")

2. **Day_off rotation advancement**: Currently `day_off` advances the rotation (you move on to the next workout). Is this intentional? Many users might expect "day off = pause the rotation, repeat this workout next time".

3. **Multiple plan history**: The history page now shows entries from all plans mixed together (with a filter). Should there be a concept of "archiving" history separately from archiving a plan? Or is the current model (plan history cleared when plan is deleted) correct?

4. **Plan expiry behavior**: When `isPlanExpired()` is true, the plan is still "active" and workouts still project. Should an expired plan auto-deactivate? Or continue as-is until the user explicitly acts?

5. **Progression group IDs**: Currently these are free-text strings typed by the user. Two slots share progression state only if their group IDs match exactly. Is this the right UX, or should there be a picker populated from existing group IDs?

---

## Known Bugs or Unfinished Areas

1. **History edit: day_off → complete loses planDayIndex** (documented, not fixed): Changing a day_off entry to complete via the history editor leaves `planDayIndex = undefined`. The entry displays "Unknown day". To fix properly, the history editor needs a plan day picker for this transition.

2. ~~**Calendar: dates before plan.startDate show as past_unlogged**~~ **FIXED** (`f1971d2`): `buildMonthGrid` now clamps `fromDate` to `plan.startDate`, so pre-plan cells render as neutral/inactive instead of showing incorrect `past_unlogged` workout data.

3. **Double-day second workout outcome not captured**: When double-day mode is used, only the primary workout's outcome is logged. The bonus workout advances the rotation but has no outcome record.

4. **Bottom nav tabs not guarded by unsaved-changes prompt**: The PlanBuilderPage back button is guarded; the bottom nav tabs are not. A user can navigate away via the nav without the confirmation dialog.

5. **`swap_slot` override type is dead code in the UI**: The override type exists in the schema and is processed by the engine, but no user-facing control exists to create one.

6. ~~**WorkoutDayCard dynamic border class**~~ **FIXED** (`2053931`): Added a static `borderColor` field to `WorkoutMeta` in `constants.ts`. `WorkoutDayCard` now uses `meta.borderColor` directly — Tailwind can safely scan it.

---

## Dependencies Added

None. All improvements used existing dependencies only.

---

## Summary for Tomorrow's Review

**What changed**: 10 targeted commits fixing real bugs, cleaning up dead code, adding 37 tests, and adding 3 small UX improvements.

**Highest confidence, review first**:
1. The Skip button fix (commit `1f3ed3c`) — easiest to verify manually
2. The rotation engine test suite (commit `302fcba`) — review test assertions to confirm they match your intent
3. Notes drift fix (commit `435d983`) — correctness improvement with minimal risk

**Risky (review carefully)**:
1. Unsaved changes guard — test edge cases: new plan vs edit plan, save then navigate, navigate via bottom tabs
2. Plan expiry indicators — verify the expiry calculation matches your expectation for both "weeks" and "rotations" duration types

**What I should review first tomorrow**: Start with the Skip bug fix test by clicking Skip on TodayPage and verifying the calendar shows it as "Skipped" and History shows the entry. Then check the rotation engine test file to confirm the behavioral assertions match what you intended.
