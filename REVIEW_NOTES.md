# Review Notes — Overnight Audit

## 2026-04-21 (eighth pass) — branch `claude/epic-cannon-Ltjw1`

### Executive summary

Three commits (plan + two fixes). Both fixes are about ad-hoc
`extraEntries` finally being treated as first-class citizens in the
two places the rest of the codebase already knows about them:
the History stats summary and the CSV round-trip.

Baseline 194 → end state 206 passing tests. No new features, no new
dependencies. One additive schema change to the history CSV header
(backward compatible — legacy CSVs still parse).

**Review first**: `87e78ec` — the CSV fix. It's the data-loss path.
The previous version of `historyToCsv` silently dropped every
ad-hoc workout and every double-day bonus, so a user exporting as
a backup and re-importing after clearing storage would lose all
extras. Verify the round-trip by exporting on a plan that has
extras, clearing `wpt_history` localStorage, importing the CSV, and
confirming the extras are back with their outcomes reattached.

`3f78bae` is the visible UX fix: the stat tiles at the top of
History now include extras in streak/counts. Previously you could
log yoga every day for a week and the Streak tile would still say
"0" while the list above showed seven green rows — now they agree.

### Definitely keep

- `87e78ec` — CSV extras round-trip. The data-loss path is the most
  important finding this pass. Backward-compat with old exports is
  tested.
- `3f78bae` — Stats tiles include extras. Restores consistency with
  the flat list already rendered in the page header.

### Probably keep but worth a look

Nothing this pass — the two behaviour changes are both "stats tiles
should match the list" and "backups should be complete", which
should be uncontroversial.

### Do not keep

Nothing flagged for rejection.

### Recommendations only (not implemented)

- **HistoryPage edit-modal trap on date conflict** — still open
  from all prior passes. Fix wants a dedicated Cancel button or
  "discard draft" affordance.
- **`progressionStates` orphaning** on plan delete — still needs a
  schema change (denormalize `groupId` onto Plan, or a
  planId→groupId map).
- **`swap_slot` override** still has no UI trigger.
- **Plan-expiry banner dismiss** still not implemented.
- **Route upcoming-complete-when-today-logged through ExtraWorkoutEntry**
  — open product question from the seventh pass.

### Open questions for you

1. The history CSV header now includes `entryKind`, `workoutType`,
   `workoutName` (as columns 1, 9, 10). Fine to break strict column
   compatibility with older exports? The parser handles missing
   columns gracefully on import, but any external tooling that was
   parsing the export by column index (rather than by header) would
   need to be updated.
2. Should the import summary also mention extras that were rejected
   for unknown workoutType? Right now they go into `warnings` but
   the summary string only counts successfully imported rows.
3. The stat tiles now render even when there are only extras and no
   rotation entries. Any concern about this surfacing to users
   before they've ever started a plan? (Shouldn't happen in practice
   — you can't log an extra without an active plan — but worth
   flagging.)

### Sanity notes

- `npm run build` is clean.
- `npx tsc --noEmit` is clean.
- `npm test` — 206 passing, 0 failing (194 baseline + 12 new).
- No localStorage schema migration required: the only schema change
  is to the CSV serialization, which is ephemeral.

---

## 2026-04-19 (seventh pass) — branch `claude/gracious-heisenberg-2fsGC`

### Executive summary

Five commits. One real data-loss guard, two refactors, one invariant
test, one plan doc. Baseline 192 → end state 194 passing tests.
No new features, no schema changes, no new dependencies. Every commit
is independently revertable.

**Review first**: `ab5fcd2` — the TodayPage guard. It's a correctness
fix for a silent data-loss path (tap an already-logged-today primary
and then tap any upcoming day → Complete → primary gets overwritten
with no undo trail). Verify by completing today, then tapping an
upcoming workout card and picking Complete — you should now see an
inline error instead of the primary entry disappearing.

The other four commits are low-risk: a pure refactor switching
CalendarPage's action-sync to the same helper HistoryPage uses
(`7a980ca`), extracting the triplicated `OutcomeMetrics` render
block to a shared component (`ee75b11`), and tests that lock the
addEntry replace-on-collision behaviour (`835a030`) so the guard
can't be silently defeated by a future refactor.

### Definitely keep

- `ab5fcd2` — data-loss guard. No behaviour change on the intended
  path; only blocks the broken overwrite.
- `7a980ca` — CalendarPage → `updateEntryAction`. Zero behaviour
  change; matches the existing HistoryPage pattern.
- `835a030` — invariant tests. Tests only.

### Probably keep but worth a look

- `ee75b11` — `OutcomeMetrics` extraction. One stylistic drift
  normalised: CalendarPage's Effort row previously had a narrow
  left-aligned "Effort" label column (`w-10`); the shared component
  uses HistoryPage's inline "Effort:" prefix instead. Visible only
  on the Calendar day-detail modal. Revert or re-tune the component
  layout if you prefer the column form.

### Do not keep

Nothing flagged for rejection.

### Recommendations only (not implemented)

- **HistoryPage edit-modal trap on date conflict**. The edit modal
  uses `onClose={saveAndClose}`, and `saveAndClose` early-returns
  without closing when a date conflict is detected. A user who
  picks a conflicting date and then tries to close via X or backdrop
  is stuck until they either fix the date or delete the entry. Minor
  UX. Proper fix wants a separate Cancel button or a "discard draft"
  affordance; didn't take it this pass because it's a behaviour
  change to an existing implicit-save interaction.
- **`progressionStates` orphaning** on plan delete — still open.
  Needs a schema change (denormalize groupId onto Plan, or a
  planId→groupId map) to clear correctly.
- **`swap_slot` override type** still has no UI trigger.
- **Plan-expiry banner dismiss** still not implemented.
- **Route upcoming-complete-when-today-logged through ExtraWorkoutEntry**
  instead of refusing. This would match the double-day semantics
  (two workouts on one date) and let the user log without needing to
  Undo first. Deferred because it's a bigger UX change: it needs a
  second OutcomeModal path, a rotation-pointer advance decision, and
  a product question about whether this affordance should now always
  route to extras regardless of today's state. The guard is the
  conservative stop-the-bleeding fix; the extras route is the richer
  follow-up.

### Open questions for you

1. Should the "upcoming-as-today when today is logged" case route to
   ExtraWorkoutEntry automatically (like double-day) instead of
   refusing? The guard is explicit ("Undo first") today.
2. Does the OutcomeMetrics layout on the Calendar day-detail modal
   still look right after the extraction? Previously the label was
   in a fixed-width column; now it's inline.
3. HistoryPage edit-modal close-trap on date conflict — small fix,
   but wants a UX call: split Save / Cancel, or allow close-without-save
   by ignoring unsaved date changes?

### Known issues or incomplete work

- Still no React-level component tests. All coverage is store-level.
- The TodayPage guard is verified by store-level tests (replace-on-
  collision behaviour) and by type-check, but no automated UI test
  confirms the inline error actually renders.

### Dependencies added

None.

---

## 2026-04-18 (sixth pass) — branch `claude/overnight-audit-improvements-RzBkA`

### Summary

1. **What changed**: Fixed a data-correctness bug in CalendarPage where
   extra-entry outcomes were being written to the primary rotation slot's
   key (exact peer of the HistoryPage fix from the fifth pass — Calendar
   was missed). Normalized the one inconsistent date-string in TodayPage.
   Added 13 tests for three previously untested store actions. Implemented
   `ExtraWorkoutEntry.source` as the medium-complexity feature, which lets
   Undo on Today spare manually-added extras and only remove double-day
   ones. End state: 192 tests passing (up from 176).

2. **Highest confidence**:
   - `f681c9f` CalendarPage OutcomeModal fix — one-line, identical pattern
     to the fifth-pass HistoryPage fix, no design judgment involved.
   - `762f9bc` store tests — purely additive, no production code changes.
   - `948cfaf` source-field tests — lock the exact filter invariant.

3. **Risky / worth a close look**:
   - `d865ff9` — the source field feature. Conservative assumption: old
     extras without `source` are treated as double_day (removed on Undo).
     If you have manually-added extras from before this upgrade that were
     logged on the same date as a primary workout, hitting Undo on Today
     would still clear them. This is identical to prior behavior, so not
     a regression — but worth knowing.

4. **Review first**: `f681c9f` — the correctness bug. Then `d865ff9` to
   validate the Undo scoping decision.

---

### Definitely keep

- `f681c9f` CalendarPage OutcomeModal fix — correctness bug, no risk.
- `ab8d7f0` TodayPage date normalization — zero behavior change.
- `762f9bc` + `948cfaf` — tests only, no risk.

### Probably keep but tweak

- `d865ff9` ExtraWorkoutEntry.source + Undo scoping. The behavior is
  correct and the schema change is backward-compatible, but you may want
  to reconsider the treatment of old records without a source:
  - **Current**: `source === undefined` → removed on Undo (treats as double_day).
  - **Alternative**: `source === undefined` → kept (treats as history).
    This would be safer for users with existing data but could leave
    orphaned extras after an Undo on older sessions.
  - Changing is one character in `TodayPage.tsx`:
    `ex.source !== 'history'` → `ex.source === 'double_day'`.

### Do not keep

Nothing flagged for rejection.

### Recommendations only (not implemented)

- **progressionStates orphaning**: `clearPlanOutcomes` wipes outcomes
  keyed by `${planId}_*` but `progressionStates` (keyed by free-text
  `progressionGroupId`) are never cleared on plan delete. Fixing properly
  requires either a plan→progressionGroup index or clearing all states
  that haven't been touched in N days. Left as a known storage leak.
- **Visual double-day badge in History**: now that extras carry
  `source: 'double_day'`, History could show a "Via double-day" badge
  instead of the generic "Extra" pill. Trivial to add.
- `swap_slot` override type still has no UI trigger (unchanged from all
  prior audits).
- Plan-expiry banner still shows every day with no dismiss.
- `OutcomeMetrics` render block is duplicated verbatim in CalendarPage
  and HistoryPage — could be extracted to a shared component. Cosmetic
  only; no behavior impact.

### Open questions for you

1. Should old extras (source === undefined) be treated as double_day
   (current: removed on Undo) or history (kept on Undo)?
2. Do you want a "Via double-day" badge in History for extras with
   `source === 'double_day'`? It's a one-line JSX change now that the
   field exists.
3. Should `progressionStates` be cleared on plan delete? If so, we
   need a way to know which progression group IDs belong to a plan
   (e.g., denormalize them onto the Plan record, or store a
   planId→groupId map separately).

### Known issues or incomplete work

- No React-level (component) tests for TodayPage, HistoryPage, or
  CalendarPage. The store-level tests cover data invariants but not UI
  flows. This is unchanged from prior passes.
- The CalendarPage fix (`f681c9f`) is verified by the store-level
  invariant tests (primary and extra outcomes coexist under distinct keys)
  and type-check, but no automated UI test confirms the modal actually
  uses the prop.

### Dependencies added

None.

---

## 2026-04-18 (fifth pass) — branch `claude/add-bonus-workout-outcomes-c1H1R`

### Summary

1. **What changed**: Fixed a user-reported data-loss bug where using the
   "double-day" toggle on Today logged only the primary workout and silently
   dropped the bonus. Also fixed a latent History-page bug uncovered while
   investigating (extra-entry outcomes were overwriting the primary entry's
   outcome for the same date). Six small commits, one of which is
   documentation; end state is 176 tests passing (up from 171).

2. **Highest confidence**:
   - `9b89b44` + `7969378` — OutcomeModal prop + HistoryPage wiring. Purely
     additive on the modal side; fixes a silent data-correctness bug on the
     History side that was writing extras to the wrong key.
   - `283ceb4` — the store tests. No production code, locks invariants.

3. **Risky / worth a close look**:
   - `f2fe0af` — the double-day change introduces a new persistence path
     (ExtraWorkoutEntry) from the Today page. It's contained to the
     `doubleDay` branch, but it's user-visible: a second OutcomeModal pops
     up after the primary is confirmed. UX decision encoded: closing the
     second modal without confirming keeps the extra entry but leaves its
     outcome blank. If you'd rather the bonus outcome modal be mandatory,
     or you'd rather the bonus not persist until its outcome is saved,
     this is the commit to revisit.
   - `28f7905` — Undo on Today now also wipes all of today's extras for
     this plan. If a user somehow has a manually-created extra on today
     (from the History page's Add-workout-for-this-day affordance) and
     hits Undo on Today, that manual extra is now gone too. Edge case;
     documented here rather than conditionalised.

4. **Review first**: `f2fe0af` — it's the user-reported fix and the one
   with user-visible UX choices.

### Definitely keep

- `9b89b44` OutcomeModal prop (enabler + no-op for old callers).
- `7969378` HistoryPage extra-outcome write path (silent data bug fix).
- `283ceb4` store tests.

### Probably keep but tweak

- `f2fe0af` double-day bonus logging. The UX seam worth reconsidering:
  when the user closes the bonus OutcomeModal with the X button rather
  than confirming, the ExtraWorkoutEntry stays but its outcome is
  blank. Alternatives to consider tomorrow:
  - Require the bonus outcome to confirm before the extra is persisted
    (symmetric with the primary flow).
  - Prompt "Discard bonus workout?" on close.
  - Leave as-is (current behaviour matches how ad-hoc extras behave from
    History — blank outcome is allowed).
- `28f7905` Undo-cleans-extras. Decide whether you want Undo to also
  drop manual extras on today, or whether it should be scoped to extras
  created via the double-day flow specifically. Scoping would require
  a flag on `ExtraWorkoutEntry` (e.g. `source: 'history' | 'double_day'`)
  which is a schema change — deliberately not done in this run.

### Do not keep

None flagged for rejection.

### Recommendations only (not implemented)

- Add a visual indicator on today's workout card when a double-day bonus
  is also logged, so the user sees "2 workouts logged today" at a glance.
- Consider a unified "Today's workouts" section on Today page when
  multiple workouts are logged for today — currently only the primary
  is visible after completion.
- `swap_slot` override type still has no UI trigger (unchanged from
  prior audits).
- Plan-expiry banner still shows every day with no dismiss (unchanged).
- The existing `completionStateToAction` comment still misdocuments
  rotation-advance behaviour for `day_off` (noted in earlier audit,
  not touched this run).

### Open questions for you

1. Should the bonus-workout modal be mandatory (block persistence until
   confirmed) or optional (current: extra persists, outcome may be blank)?
2. Should Undo on Today distinguish "double-day bonus" extras from
   manually-logged extras? That's a schema change; I didn't take it.
3. In the double-day case, the primary outcome modal and the bonus
   outcome modal open sequentially. Do you want a single combined UI
   later (two forms in one modal) or is the chained flow fine?

### Known issues or incomplete work

- No component-level test for TodayPage's double-day flow. The
  store-level tests cover the persistence invariants (two workouts
  coexist on one date), but the actual UI flow (click Complete →
  confirm primary → second modal appears → confirm bonus) is not
  automated. Acceptable given this codebase has no React test setup —
  adding one was out of scope.
- Tests were not added for `removeRetroJumpForDate` or other existing
  gaps; this run was scoped to the reported bug + its adjacent issues.

### Dependencies added

None. No `package.json` changes.

---

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
