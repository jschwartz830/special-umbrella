# Review Notes — Overnight Audit

## 2026-05-06 (twenty-third pass) — branch `claude/dreamy-mccarthy-9Dgx6`

### Executive summary

1. **What changed:** 2 commits — 4 new edge-case tests for `buildLastSessionSummary`
   and a `WeeklyActivityStrip` feature on TodayPage.
2. **Highest confidence:** The tests are purely additive. The `WeeklyActivityStrip`
   is isolated (local component, no new store subscriptions) and can be reverted
   with a single line deletion.
3. **What is risky:** Nothing in this pass touches state management, rotation logic,
   or persistence. The feature is visually additive only.
4. **Review first:** Open TodayPage and verify the 7-dot strip looks correct across
   plans with mixed history (complete, skip, day_off, extras, empty days).

---

### Biggest issues found

1. **`buildLastSessionSummary` edge cases untested** — the empty-exercises and
   all-null-sets paths fell through correctly in the implementation but had no
   test anchors. Fixed with 4 new tests.
2. **TodayPage stats bar is aggregate-only** — no day-by-day visualization requires
   navigating to Calendar. Added `WeeklyActivityStrip` to bridge this gap.
3. **Streak resets to 0 each morning** — the current "strict" streak definition
   means a 30-day streak appears to vanish before the user logs today. Documented
   as a recommendation but not changed (product decision).

---

### Improvements completed

| # | Type | Description |
|---|------|-------------|
| 1 | Tests | 4 edge-case tests for `buildLastSessionSummary` |
| 2 | Feature | `WeeklyActivityStrip` on TodayPage |

---

### Medium-complexity feature explored

**WeeklyActivityStrip** — see FEATURE_PROPOSAL.md and FEATURE_REVIEW.md.

Classification: **Keep**

---

### Definitely keep

- The 4 new `buildLastSessionSummary` tests — pure regression anchors, zero risk.

### Probably keep but tweak

- `WeeklyActivityStrip` — the feature itself is sound. You may want to tweak:
  - Dot size (`w-2.5 h-2.5` currently; `w-3 h-3` for better tap targets)
  - Whether the "extra-only" dot (sky) is visually distinct enough from "complete" (emerald)
  - Whether to show the strip on expired plans (currently yes)

### Do not keep

- Nothing in this pass needs reverting.

### Recommendations only (not implemented)

1. **Streak grace period / pending state** — show "🔥 30" (in amber) rather than
   "🔥 0" when today is pending but yesterday had a complete entry. This is a
   product decision; the strict behaviour is defensible but jarring.
2. **Plan builder `duration.value > 0` validation** — carry-over from prior passes.
3. **Narrow Zustand selectors in CalendarPage** — performance, not urgent.
4. **Expression evaluator UI error surface** — malformed YAML progression rules
   fail silently; showing a toast or badge would aid debugging.

---

### Open questions for me

1. Do you want the activity strip to show all 7 days or just past days (hiding
   today and future)? Current behaviour: shows today with a ring indicator.
2. Should the streak show 0 or the prior streak count when today is pending?
3. Is the "extra-only" sky dot (ad-hoc workouts with no rotation entry) useful,
   or does it add visual noise?

---

### Known issues or incomplete work

- None. All planned work is complete and tests pass.

---

### Dependencies added

- None. `addDays` and `parseISO` from `date-fns` were added to the import but
  `date-fns` was already a listed dependency.

---

## 2026-05-04 (twenty-first pass) — branch `claude/dreamy-mccarthy-sA0Ai`

### Executive summary

1. **What changed:** 4 commits — 17 new `getResolvedDaysRange` tests, `isPlanExpired` zero-value guard, exercise history orphan fix on backdate, and a session count badge on today's pending card.
2. **Highest confidence:** The `isPlanExpired` fix and the orphan cleanup are the most clear-cut correctness improvements. The tests are purely additive.
3. **What is risky:** The session count feature changes WorkoutDayCard's prop interface (additive, optional). The backdate fix removes an outcome before writing the new one — safe since `removeOutcome` is idempotent, but it changes observable behavior when overwriting existing entries.
4. **Review first:** Start with the backdate fix (`TodayPage.tsx:308`, `CalendarPage.tsx:211`) — it's the most consequential behavior change and deserves manual testing if you've backdated workouts.

---

### Biggest issues found

1. **`getResolvedDaysRange` had zero tests** despite being the calendar projection function used by CalendarPage. Fixed.
2. **`isPlanExpired` silently expired plans with `duration.value = 0`** by always returning `true`. Fixed.
3. **Exercise history orphaned when backdating over an existing complete entry** — old weights records stayed in `exerciseHistoryStore` if the new outcome had no weights data. Fixed.

---

### Improvements completed

| # | Type | Description |
|---|------|-------------|
| 1 | Tests | 17 `getResolvedDaysRange` tests covering all status/pointer/override scenarios |
| 2 | Fix | `isPlanExpired` guard for `value <= 0` on rotations-based plans |
| 3 | Fix | `removeOutcome` cleanup in backdate path of TodayPage + CalendarPage |
| 4 | Tests | 5 `countPlanDayCompletions` tests in historyStats |

---

### Small feature added

**Session count indicator on today's workout card.**

When today's workout is pending, the plan day card shows "×N done" next to the workout name, counting prior completions of this specific rotation day. Uses new `countPlanDayCompletions()` in `historyStats.ts` and an optional `sessionCount` prop on `WorkoutDayCard`. Fully additive — no existing behavior changed.

Classification: **Keep** — the data is free (already computed), the display is minimal, and it directly addresses the "how many times have I done this?" question without requiring history navigation.

---

### Definitely keep

- `getResolvedDaysRange` tests — pure test additions, zero risk
- `isPlanExpired` guard — prevents a definite silent bug
- `countPlanDayCompletions` tests — pure additions

### Probably keep but tweak

- **Exercise history orphan fix** — correct behavior, but worth a manual backdate test before merging to verify edge cases (backdating a weights workout over a prior weights workout, backdating a run over a prior weights workout, etc.)
- **Session count feature** — works well functionally; the "×N done" label style is minimal and readable, but you may prefer different phrasing ("Session N" / "Done N times" / a number badge)

### Do not keep

Nothing in this pass warrants rejection.

### Recommendations only (not implemented)

1. **Plan builder validation** — prevent creating a plan with `duration.value = 0`; the `isPlanExpired` fix is a safety net but the real fix is UI validation.
2. **Narrow Zustand selectors** — CalendarPage subscribes to `s.outcomes` (whole object). Switch to a per-key selector for the rendered modal to reduce re-renders.
3. **Progression system documentation** — `logOutcomeWithProgression` runs two parallel progression systems. Document which one is authoritative and the migration path.
4. **Expression evaluator error reporting** — typos in progression rule expressions silently return 0. Surface errors in the progression rule UI.

---

### Open questions for you

- Should "×N done" show for plan days that were only _skipped_ previously, not completed? Current implementation counts only `complete` actions.
- Should the session count badge appear on upcoming cards too, not just today's pending card? It's computed lazily so it could easily be extended.
- When backdating overwrites an existing entry, should the UI warn the user? Currently it silently removes the old entry and outcome.

---

### Known issues / incomplete work

- `WorkoutDayCard` session count is only passed from `TodayPage` for the today card; upcoming cards don't show it. This is intentional for this pass but easy to extend.
- No integration test covering the full backdate-overwrite flow. Manual testing recommended.

### Dependencies added

None.

---

## 2026-04-29 (seventeenth pass) — branch `claude/dreamy-mccarthy-vrC4L`

### Executive summary

1. **What changed**: Three bug fixes (cycle-progress noise, missing bonus-modal
   prop, calendar resume wrong planDay) and one medium feature (week progress
   indicator for weeks-duration plans). 315 tests now pass (was 311).

2. **What is highest confidence**: All three bug fixes — each is a narrow
   correction to a specific misbehaviour, with no secondary effects. The
   bonus-modal fix is one line. The cycle-progress fix is one condition change.
   The calendar resume fix adds 4 lines and has a safe fallback.

3. **What is risky**: The week progress subtitle text grows longer on small
   screens ("Day 6 of 6 in rotation · Week 12 of 12 · last week!"). This is
   the same wrapping concern noted for the pass-16 rotation cycle display. Both
   should be evaluated on a real device.

4. **What to review first**: The TodayPage subtitle on a narrow screen with both
   plan types. If it wraps awkwardly, moving the week/cycle progress to a
   second line or a separate stat tile is easy.

---

### Biggest issues found this pass

All prior high-severity issues from passes 1–16 remain fixed and stable.

1. **"0/N done" displayed at plan start** — subtitle noise before any workouts
   logged; now suppressed until `doneInCycle > 0`.

2. **Missing `previousSetsByExercise` in bonus OutcomeModal** — historical
   weight prefill was silently absent for double-day bonus workouts.

3. **"Resume workout" in CalendarPage used projected planDay** — retroactive
   history edits caused the tracker to load the wrong exercises.

---

### Improvements completed

| # | Item | Type | Confidence |
|---|------|------|------------|
| 1 | Suppress "0/N done" at plan start | UX bug | High |
| 2 | Pass `previousSetsByExercise` to bonus modal | UX gap | High |
| 3 | Calendar resume uses logged planDayIndex | Logic bug | High |
| 4 | Week progress indicator on TodayPage | Feature | High |

---

### Small features added

None.

---

### Medium-complexity feature explored

**Week progress indicator on TodayPage for weeks-duration plans** — implemented.
See FEATURE_PROPOSAL.md and FEATURE_REVIEW.md.

---

### Definitely keep

- All three bug fixes — narrow, safe, no tradeoffs.

### Probably keep but tweak

- Week progress subtitle — review wrapping on small screens. If it wraps,
  consider a second-line or stat-tile approach.

### Do not keep

- Nothing recommended for removal.

### Recommendations only (not implemented)

- **Subtitle line length audit**: With both the rotation day index and
  week/cycle progress, the subtitle can reach 50+ characters. A future pass
  could extract this into a two-line compact display or a dedicated "progress
  chip" row below the header.

- **"Resume workout" in Calendar level-2**: The rotation detail view (level 2)
  doesn't have a "Resume workout" button — only "View & Edit Workout Details"
  and "Clear entry". Adding a resume button at level 2 would be consistent with
  level 1, but is currently not a gap users are likely to notice.

- **`importExtraEntries` update vs. add**: Re-importing a CSV with modified extra
  entries won't update existing ones (ID-based skip). Consider adding an
  "overwrite on re-import" mode, documented with a warning. Low priority.

---

### Open questions for me

1. Does "Week 3 of 12" in the subtitle read well alongside "Day 4 of 6 in
   rotation" on your device? Should one be made more prominent?

2. The "rotation complete!" text persists until the next workout is logged
   (noted in pass 16). Is this still acceptable UX or should there be an
   auto-dismiss after, e.g., a day?

3. For the CalendarPage resume fix: do you routinely delete/edit past entries
   in ways that shift the rotation? If not, this fix is theoretical safety;
   if yes, it matters in practice.

---

### Known issues / incomplete work

- Week progress subtitle length on narrow screens — needs manual testing.
- "Resume workout" not available in CalendarPage DayDetailModal level-2 view
  (rotation detail). Left for a future pass.

---

### Dependencies added

None.

---

## 2026-04-29 (sixteenth pass) — branch `claude/great-mccarthy-TJqjV`

### Executive summary

1. **What changed**: One correctness fix (`deduplicateByDate` ordering), one
   performance fix (memoize `flatItems`), one UX safety fix (confirm before
   deleting extras), and one medium feature (rotation cycle progress on
   TodayPage with 9 new tests). 311 tests now pass (was 302).

2. **What is highest confidence**: The `deduplicateByDate` fix — it corrects a
   real inconsistency with documented engine behavior and is directly tested.
   The memoization fix — pure refactor with no behavior change. The delete
   confirm — additive UI guard matching existing patterns.

3. **What is risky**: The cycle-progress display on TodayPage is low risk but
   the "rotation complete!" state shows until the user logs the next workout —
   evaluate whether that brief state feels correct or confusing.

4. **What to review first**: The TodayPage header — "Day X of N in rotation ·
   3/6 done". Is the inline placement readable or does it feel crowded? If so,
   moving it to a separate stat tile is easy.

---

### Biggest issues found this pass

All prior high-severity issues from passes 1–15 remain fixed and stable.

1. **`deduplicateByDate` insertion-order inconsistency** — could silently store
   the wrong entry when an import batch arrived in reverse-chronological order.
   Fixed with a `createdAt` sort.

2. **`flatItems` not memoized in HistoryPage** — performance issue; full list
   rebuild on every store subscription notification.

3. **Immediate extra deletion in list view** — UX safety gap; no confirmation
   before permanent data deletion.

---

### Improvements completed

| # | Item | Type | Confidence |
|---|------|------|------------|
| 1 | `deduplicateByDate` sort by `createdAt` | Bug | High |
| 2 | Memoize `flatItems` in HistoryPage | Performance | High |
| 3 | Confirm before inline extra deletion | UX safety | High |
| 4 | `computeRotationCycleProgress` + TodayPage display | Feature (medium) | Medium |

---

### Definitely keep

- Fix 1 (`deduplicateByDate`): Correctness fix with test coverage.
- Fix 2 (`flatItems` memo): Zero risk, measurable improvement.
- Fix 3 (delete confirm): Matches existing modal confirm UX.

### Probably keep but review UX

- Feature 4 (cycle progress): The logic is solid and well-tested. The
  display is minimal (inline text). Main question is whether the "rotation
  complete!" state feels natural or like a false pending state.

### Do not keep

- Nothing to revert.

### Recommendations only (not implemented)

- **Extract `extraToPlanDay` + `WORKOUT_TYPES`** to a shared utility (`src/lib/workoutHelpers.ts`
  or `src/lib/planHelpers.ts`). The function appears identically in TodayPage,
  CalendarPage, and HistoryPage. Low risk, but touches 3 files and adds a new
  shared dependency — worth doing in a dedicated cleanup pass.

- **Move `PlanCard` outside `PlansPage`** body. Defining a React component
  inside another component means it's re-created on every render (no memoization
  can help). Trivial to fix but touching PlansPage while it's not the focus of
  this pass seems unnecessary.

- **Dismissible unlogged-days nudge** (TodayPage). The nudge from pass 15 has
  no dismiss button. If users find it noisy for intentional rest periods, add a
  per-plan dismiss similar to the expiry banner (`useExpiryDismiss` pattern).

- **Suppress cycle progress when plan is expired**. If `isPlanExpired` is true,
  the "rotation complete!" text appears redundantly alongside the expiry banner.
  Add a guard: `cycleProgress && !planExpired`.

---

### Open questions for me

1. Does the inline "3/6 done · last one!" header feel right, or should cycle
   progress be a separate tile in the stats bar?
2. Should the "rotation complete!" flash persist until the next workout is
   logged, or disappear after N seconds?
3. Is the two-tap delete confirm for extras in the list view sufficient, or
   would a modal (matching rotation entry behavior) feel more consistent?

---

### Known issues / incomplete work

- None introduced in this pass. Prior known issues (e.g. nudge false positives
  for intentional rest periods) documented in pass-15 notes.

### Dependencies added

- None.

---

## 2026-04-28 (fifteenth pass) — branch `claude/great-mccarthy-6NVvu`

### Executive summary

1. **What changed**: One cosmetic consistency fix (`.replace` → `.replaceAll`
   in 3 files), one small feature (training-mix summary in HistoryPage), and
   one medium feature (past-unlogged-days nudge on TodayPage with 9 new tests).
   302 tests now pass (was 293).

2. **What is highest confidence**: The `replaceAll` fix — no behavior change for
   current values; the training mix — purely additive UI from existing data; and
   the pure `countPastUnloggedDays` helper — fully tested with clear invariants.

3. **What is risky**: The TodayPage nudge may show false positives for users who
   intentionally took time off. The "may be stalled" wording and muted styling
   mitigate this but don't eliminate it.

4. **What to review first**: The TodayPage nudge UX. Does it feel helpful or
   noisy? If noisy, add dismissibility in the next pass.

---

### Biggest issues found this pass

All prior high-severity issues from passes 1–14 remain fixed and stable. This
pass found only cosmetic/consistency issues.

1. **Three `.replace` calls** — should be `.replaceAll` for correctness and
   consistency with the pass-13 fix. No user-visible impact today.

2. **`computeWorkoutTypeBreakdown` had no UI home** — the pure function from
   pass 12 was untethered. Now surfaces in HistoryPage.

3. **Rotation stall invisible to users** — no signal when past unlogged days
   were causing the rotation pointer to appear wrong.

---

### Improvements completed

| # | Item | Type | Confidence |
|---|------|------|-----------|
| 1 | `replaceAll` in HistoryPage, CalendarPage, TodayPage | Bug (cosmetic) | High |
| 2 | Training-mix summary in HistoryPage | Feature (small) | High |
| 3 | `countPastUnloggedDays` helper + tests | Feature (medium) | High |
| 4 | Unlogged-days nudge on TodayPage | Feature (medium) | Medium |

---

### Definitely keep

- `replaceAll` fix — zero risk, correct behaviour
- `countPastUnloggedDays` helper and its 9 tests — clean, isolated, well-covered
- Training-mix summary — additive, useful at a glance, easy to revert

### Probably keep but tweak

- TodayPage nudge — useful, but may need dismissibility if users find it noisy
  when they intentionally skipped workouts. Evaluate after a few days of use.

### Do not keep

- Nothing to remove this pass.

### Recommendations only (not implemented)

- **Dismissible nudge**: If the nudge generates noise complaints, wire in a
  `useExpiryDismiss`-style localStorage dismiss that auto-clears when count = 0.
- **"Mark all as day off"**: Quick-action button in the nudge to batch-log all
  N missing days as day_off without going to CalendarPage.
- **`progressionStates` orphaning on plan delete**: Still deferred. Still needs
  a reverse index (planId → progressionGroupId set) or a periodic orphan sweep.
- **TodayPage size**: Now ~930 lines. Still above the threshold for comfortable
  editing; still recommend splitting into smaller components in a daytime session.
- **Nudge on expired plans**: Nudge shows after plan expiry. Consider suppressing
  when `planExpired === true` in a follow-up.

---

### Open questions

1. Is 7 days the right lookback window for the nudge? Users away for 10 days see
   "7 days" capped — should it show the actual gap?
2. Should the nudge be suppressed when the plan is expired?
3. Should the training-mix count skips as well as completions? Currently skipped
   rotation entries are excluded (only completed + all extras).

---

### Known issues / incomplete work

- Nudge is not dismissible (intentional, documented in FEATURE_REVIEW.md).
- Nudge shows even after plan expiry (minor, documented as open question).

---

### Dependencies added

None.

---

## 2026-04-27 (fourteenth pass) — branch `claude/great-mccarthy-GNrKl`

### Executive summary

1. **What changed**: Two bug fixes (`logAction` type + CalendarPage jump
   re-anchor), two features (plan progress on PlansPage cards, Today button
   on CalendarPage), and 2 new tests. All 293 tests pass.
2. **What is highest confidence**: The `logAction` type fix — zero behavior
   change, pure type cleanup. The plan progress display — pure read-only
   wiring of an already-tested function.
3. **What is risky**: The CalendarPage jump re-anchor fix changes a subtle
   override-management decision. It is provably more correct, but since
   there are no CalendarPage component tests, the fix can only be verified
   manually.
4. **What to review first**: `e72e96a` (CalendarPage fix). Trigger the
   scenario: log a past date via CalendarPage, let it create a jump override,
   then open that same date again and re-confirm the same workout without
   changing the day index. Verify the rotation for subsequent dates is
   unchanged before and after.

---

### Bug severity assessment

| Bug | Severity | Was it user-visible? |
|-----|----------|---------------------|
| `logAction` planDayIndex type | Low | No — `-1` was silently discarded anyway |
| CalendarPage jump re-anchor | Medium | Yes — re-confirming a retroactively-logged day could silently shift the rotation |

---

### Improvements completed

| # | Change | Confidence |
|---|---|---|
| 1 | `logAction` type: `number` → `number | undefined` | High |
| 2 | CalendarPage `logForDate`: re-anchor jump on removal | High |
| 3 | PlansPage: show `computePlanProgress` on plan cards | High |
| 4 | CalendarPage: "Today" button to jump back to current month | High |

---

### Definitely keep

- `fd0debc` — type cleanup, zero risk.
- `f48a501` — surfaces a production-ready utility. Pure display. Zero risk.
- Today button (in `e72e96a`) — additive, zero risk.

### Probably keep but verify manually

- `e72e96a` (jump re-anchor fix) — correct by reasoning and test, but no
  component tests exist. Manually verify the scenario before shipping.

### Do not keep

- Nothing from this pass warrants removal.

### Recommendations only (not implemented)

- **TodayPage extraction**: still ~1700 lines; still the biggest maintenance
  risk. No overnight fix — requires daytime UI testing.
- **`progressionStates` orphaning on plan delete**: wasted storage only;
  no correctness risk. Needs a plan→progressionGroup index to fix cleanly.
- **Wire `computeWorkoutTypeBreakdown` to History or Today page**: pure
  function added in twelfth pass, still no UI entry point.
- **Add `computePlanProgress` to the active-plan header on TodayPage**:
  now showing on PlansPage; could also show on TodayPage to reinforce
  plan progress while working out.

---

### Open questions for the developer

1. For the CalendarPage jump re-anchor: should `day_off` also re-anchor?
   Currently it does not — a `day_off` on a day that had a jump removes the
   jump and does not re-add it. The rotation advances from the natural pointer
   position. Is this the intended behavior, or should `day_off` also preserve
   the rotation anchor?
2. For plan progress on PlansPage: is the "X/Y done (Z%)" text the right
   format? An alternative is a thin progress bar. Easy to change.
3. Any plans for TodayPage extraction? It's now past 1700 lines and growing.

---

### Known issues / incomplete work

- CalendarPage has no component tests. The jump re-anchor fix is correct
  by reasoning and the engine regression test, but manual verification is
  recommended.
- `computeWorkoutTypeBreakdown` remains wired to no UI entry point.

### Dependencies added

None.

---

## 2026-04-27 (thirteenth pass) — branch `claude/great-mccarthy-PqhIm`

### Executive summary

Four bugs fixed, one medium feature added, five new tests. All 291 tests pass.
No regressions. The fixes are all isolated, targeted, and low-risk.

### Bug severity assessment

| Bug | Severity | Was it user-visible? |
|-----|----------|---------------------|
| `formatPace` second-overflow | Medium | Yes — "9:60 /mi" in pace display |
| `isPlanExpired` 0-day guard | Low | No — implicit NaN was accidentally correct |
| `replaceAll` in TodayPage | Low | Yes — but only affects hypothetical multi-underscore types |
| CSV `source` field lost | Medium | Yes — affects Undo behavior after CSV re-import |

### Feature assessment

The stats bar is a read-only, purely additive UI element using existing logic.
It introduces no new state, no new stores, and no new edge cases. Risk is low.
The implementation correctly scopes stats to the active plan (not all plans).

### Remaining recommendations

1. **`logAction` planDayIndex type** — misleading but not dangerous. Track for
   next large refactor session.
2. **`progressionStates` orphaning** — wasted storage only; no correctness risk.
3. **TodayPage size (~1700 lines)** — needs daytime extraction session with
   careful UI review and component testing.

### What to verify during review

- [ ] `formatPace(599.5)` renders as "10:00 /mi" in the app (pace display).
- [ ] Stats bar renders correctly with a plan that has 0 completed entries
      (all three tiles should show 0).
- [ ] CSV re-import of an exported file preserves source on extra entries
      (check Undo behavior still works after round-trip).
- [ ] 0-day plan does not show as expired (edge case; defensive).

---

## 2026-04-26 (twelfth pass) — branch `claude/great-mccarthy-bM0YZ`

### Executive summary

1. **What changed**: One bug fix (CSV extras re-import idempotency), four
   edge-case tests, and one medium-complexity feature (`computeWorkoutTypeBreakdown`
   pure utility + 14 tests). 19 new tests total. No UI changes.
2. **What is highest confidence**: The CSV fix. It's the only correctness issue
   found and directly impacts users who re-import backup CSVs.
3. **What is risky**: Nothing high-risk. The breakdown utility is pure and additive;
   the edge-case tests are purely informational.
4. **What to review first**: The `extraId` column addition to the history CSV format
   (affects any downstream tooling or scripts that parse the CSV).

---

### Biggest issues found

**Bug (medium)**: `historyFromCsv` always generated a fresh `nanoid()` for
`ExtraWorkoutEntry` records. Re-importing the same CSV created duplicate extras
because `importExtraEntries` deduplicates by ID, but IDs were always new. Fixed.

**Edge cases (low, untested)**: Four engine/stats behaviors were correct but
had no tests: `computeCurrentDayIndex` with `targetDate < startDate`, single-day
plan in `getUpcomingDays`, 0-day plan in `isPlanExpired`, `duration.value = 0`
in `computePlanProgress`. All four now have tests.

**Recommendation (low)**: `logAction` in historyStore accepts `planDayIndex: number`
as required but ignores it for `day_off`. The type signature misleads callers.
Not fixed (touches all callsites); documented for daytime review.

**Recommendation (open from prior passes)**: `progressionStates` are not cleared
when a plan is deleted (needs schema change to build a plan→group mapping).
Still unaddressed.

**Recommendation (open from prior passes)**: TodayPage is ~1700+ lines and
continues growing. Modular extraction is needed.

---

### Improvements completed

| # | Change | Confidence |
|---|---|---|
| 1 | Fix CSV extras re-import — `extraId` column added | High |
| 2 | Edge-case tests: targetDate before startDate (engine) | High |
| 3 | Edge-case tests: single-day plan getUpcomingDays | High |
| 4 | Edge-case tests: 0-day plan isPlanExpired | High |
| 5 | Edge-case tests: duration.value=0 computePlanProgress | High |

---

### Small features added

None this pass (only the medium-complexity feature below).

---

### Medium-complexity feature explored

**`computeWorkoutTypeBreakdown`** — a pure function in `src/lib/historyStats.ts`
that aggregates per-workout-type completion counts, skips, and average effort from
history entries, extras, and outcomes. 14 unit tests. **No UI integration** — the
function is production-ready; the developer decides when and where to surface it.

**Classification: Keep** (see FEATURE_REVIEW.md for full evaluation).

---

### Definitely keep

- CSV `extraId` fix — correctness bug affecting re-imports.
- All four edge-case tests — purely informational, zero risk.
- `computeWorkoutTypeBreakdown` — pure function, fully tested, ready for UI wiring.

### Probably keep but tweak

- `computeWorkoutTypeBreakdown` multi-slot attribution: currently first-slot-only.
  Review if your plans have two-slot days and you want both types counted.

### Do not keep

- Nothing from this pass warrants removal.

### Recommendations only (not implemented)

- Fix `logAction` type: `planDayIndex: number | undefined` for `day_off` callers.
- Clear `progressionStates` on plan delete (needs schema change).
- Extract TodayPage into smaller components (1700+ lines).
- Add `computeWorkoutTypeBreakdownForPlan(plan, entries, extras, outcomes)` convenience
  wrapper so callers don't have to construct the Map manually.
- Add a "Today" jump button on CalendarPage for quick month navigation.

---

### Open questions for the developer

1. Is re-importing a history CSV something users actually do? If not, the CSV
   `extraId` fix is low-urgency but still correct to ship.
2. For `computeWorkoutTypeBreakdown`: should multi-slot days be attributed to both
   types, or just the first? What does your plan structure look like?
3. Is there a plan for TodayPage extraction, or should it be accepted as-is?

---

### Known issues / incomplete work

- `computeWorkoutTypeBreakdown` has no UI integration. The developer must wire it
  to surface it to users.
- The backward-compat test for old CSVs without `extraId` uses a manually
  constructed CSV string (not generated by `historyToCsv`). This is intentional
  (it's testing a format that `historyToCsv` no longer emits) but means that
  test will always use a hand-crafted string.

---

### Dependencies added

None.

---

## 2026-04-25 (eleventh pass) — branch `claude/great-mccarthy-0XEfh`

### Executive summary

1. **What changed**: One bug fix (`importEntries` intra-batch deduplication),
   two test-coverage gaps closed (`recommendation/explanation.ts` at 0 → 22 tests,
   `evaluateRunProgression` edge cases +4 tests), and one medium-complexity feature
   (`computePlanProgress` pure helper + 15 tests). 45 new tests total. No UI changes.
2. **What is highest confidence**: The `importEntries` fix and both test additions.
   The fix is strictly more correct (enforces an invariant the engine relies on);
   the tests are purely additive.
3. **What is risky**: Nothing high-risk. `computePlanProgress` is a pure function
   with no store coupling or UI changes; risk is limited to formula correctness,
   which is fully covered by 15 tests.
4. **What you should review first**: `29444c5` (importEntries fix) — specifically
   whether the last-wins semantics for intra-batch duplicates match your expectations
   for CSV imports. The alternative would be first-wins or error-on-duplicate.

### Biggest issues found

- **`importEntries` intra-batch dedup bug** (correctness, medium): A malformed or
  programmatically-generated CSV with two rows sharing the same `(planId,
  calendarDate)` would create two entries in the store for that key, violating the
  invariant that `computeCurrentDayIndex` and the UI both rely on.
- **Zero test coverage on `recommendation/explanation.ts`** (test gap, low):
  `summariseRunOutcome` has pace formatting logic that could regress silently.
- **Three uncovered branches in `evaluateRunProgression`** (test gap, low):
  The "completed but just missed 95% target" case is a meaningful edge that
  affects user experience (hold instead of progress).

### Improvements completed

- Fixed `historyStore.importEntries` to deduplicate within the incoming batch before
  appending to the store (last-wins per `(planId, calendarDate)`).
- Added 22 tests for `recommendation/explanation.ts` (all three exported functions).
- Added 4 tests for uncovered `evaluateRunProgression` branches.
- Added 4 tests for `importEntries` (the entire surface was previously untested).

### Small features added

None this pass. All non-feature changes are bug fix or test additions.

### Medium-complexity feature explored

**`computePlanProgress` helper** — **Keep** (see FEATURE_REVIEW.md).

Pure function that returns `{ completed, total, percentComplete }` for any plan.
Supports both `rotations` (entry-based) and `weeks` (calendar-based) duration types.
15 tests. No UI coupling. Prerequisite for a future progress bar in PlansPage.

### Definitely keep

- `29444c5` — `importEntries` dedup fix. Correctness issue; zero behavior change on
  well-formed CSVs (which is what the UI always generates).
- `3395e74` — `recommendation/explanation.ts` tests. Pure value, no risk.
- `7d2cbc3` — `evaluateRunProgression` edge-case tests. Documents subtle branching.
- `0c4d145` — `computePlanProgress` feature. Fully tested pure function.

### Probably keep but tweak

Nothing this pass.

### Do not keep

Nothing this pass.

### Recommendations only (not implemented)

- **TodayPage extraction**: at 1,700+ lines, TodayPage is the biggest maintenance
  risk in the codebase. Splitting it into smaller components (e.g., separating the
  override controls, the upcoming list, and the double-day flow) would improve
  testability and readability, but it requires thorough manual UI testing to do safely.
- **`progressionStates` orphaning on plan delete**: deleting a plan leaves orphaned
  `RunProgressionState` records in localStorage. Fixing this cleanly requires a
  plan→progressionGroup reverse index that doesn't exist in the current schema.
- **`logAction` planDayIndex type**: the parameter is required even for `day_off`
  (where it is immediately discarded). Should be optional or accept `undefined`.
  Low-risk one-line change but touches the public API of `historyStore`.
- **Wire `computePlanProgress` into PlansPage**: show "2 / 4 rotations" or
  "Week 5 of 8" on each plan card. Pure read-only display; no engine changes needed.

### Open questions for you

1. For `importEntries` intra-batch dedup: is **last-wins** the right semantic?
   The alternative is **first-wins** (preserve the earlier row) or **warn-and-skip**.
   Last-wins matches the store's own `addEntry` behavior (newer write replaces older).
2. For `computePlanProgress` with weeks-type plans: should partial weeks be surfaced?
   Currently "6 days into week 1" shows 0 completed weeks. A `daysElapsed` field could
   complement `completed` without changing the semantics.
3. Should `computePlanProgress` be wired into PlansPage this week, or do you want
   to decide the UI treatment first?

### Known issues or incomplete work

- `computePlanProgress` has no UI entry point yet. Intentional for this run.

### Dependencies added

None.

---

## 2026-04-24 (tenth pass) — branch `claude/great-mccarthy-hYhLK`

### Executive summary

1. **What changed**: Two correctness fixes (edit-modal close-trap in History,
   negative duration guard in OutcomeModal), one additive visual improvement
   ('Bonus' pill for double-day extras), one medium-complexity feature
   (dismissible plan-expiry banner), and 12 new tests.
2. **What is highest confidence**: The edit-modal trap fix and duration guard.
   Both are pure correctness, zero behavior change on the happy path.
3. **What is risky**: Nothing high-risk. The feature adds a localStorage key
   that, if cleared, simply re-shows the banner — graceful degradation by design.
4. **What you should review first**: `b079a9e` (edit-modal trap) — trigger it
   by opening a History entry, changing the date to one that already has an entry,
   then clicking X. Before this fix: modal stayed open. After: modal closes and
   discards the draft.

### Biggest issues found

- **Edit-modal close-trap** (UX, high): History edit modal had no way to close
  without a valid save when a date conflict occurred. Deferred since the fifth pass;
  finally resolved.
- **durationActualMin negative guard** (correctness, medium): OutcomeModal accepted
  negative duration values silently and stored them. Adjacent fields already used
  the `isFinite + > 0` pattern; this one was missed.

### Improvements completed

- Fixed HistoryPage edit-modal close-trap: separated `discardAndClose` (X / backdrop)
  from `saveAndClose` (Save button) so the user can always exit the modal.
- Fixed OutcomeModal `durationActualMin` to reject negative and zero values.
- Added 'Bonus' pill in HistoryPage for extras with `source === 'double_day'`.
- Added 12 tests for the new hook and the duration guard pattern.

### Small features added

- 'Bonus' badge for double-day extras in History (one-liner building on the sixth-pass
  `source` field that was added specifically to enable this).

### Medium-complexity feature explored

**Dismissible plan expiry banner** — **Keep** (see FEATURE_REVIEW.md).

Added `useExpiryDismiss` hook: per-plan localStorage key, isolated by planId,
graceful fallback on localStorage failure. TodayPage hides the banner when
dismissed and shows a × button to trigger it. No store coupling.

### Definitely keep

- `b079a9e` — Edit-modal close-trap fix. Five passes overdue; low risk.
- `4994634` — Duration guard fix. One-line correctness improvement.
- `76a9231` — 'Bonus' pill. Surfaces the source field that was always there.
- `dfe3803` — Tests. Lock the storage contract and duration guard behavior.

### Probably keep but tweak

- `9c91919` — Dismissible expiry banner. Core implementation is solid. One
  potential tweak: the × button is small (13px icon) and sits next to 'Plans →',
  which could cause accidental taps on mobile. Consider a slightly larger hit
  target if that's reported. See FEATURE_REVIEW.md for more.

### Do not keep

- Nothing flagged for rejection.

### Recommendations only (not implemented)

- **`progressionStates` orphaning on plan delete** — still needs a schema
  change (denormalize progressionGroupId onto Plan, or a planId→groupId map).
  Accumulates in localStorage indefinitely. Known storage leak.
- **`swap_slot` override UI** — the override type exists in the engine but has
  no UI trigger. Still needs a product decision on scope.
- **Un-dismiss expiry banner from Plans page** — currently the only way to
  un-dismiss is clearing localStorage. Low priority unless users report it.
- **HistoryPage edit-modal: no Cancel button on the extra-edit flow** —
  `editingExtra` modal uses `onClose={() => setEditingExtra(null)}` (correct,
  no trap here), but the inline delete button in that modal doesn't ask for
  confirmation. Minor UX inconsistency.

### Open questions for you

1. Is the 'Bonus' pill color (violet) the right visual distinction from 'Extra'
   (sky blue)? Both are on a dark background; violet reads well but may clash
   with the purple progression-state badge elsewhere.
2. Should clicking × on the expiry banner also navigate to Plans? Or is silent
   dismiss the right behavior?
3. The edit-modal close now discards unsaved changes on X — is that the right
   call, or would you prefer a "Discard changes?" confirm on close?

### Known issues or incomplete work

- No React-level component tests. All coverage is store/hook/lib-level.
  The edit-modal fix is verified by inspection and type-check, not automation.
- `useExpiryDismiss` initialState uses a lazy initializer that runs once at
  mount time. If the same planId key is written before mount (e.g., by an
  SSR-like setup), the hook correctly reads it. If the key is cleared after
  mount but before dismiss, the banner re-shows on next mount (correct behavior).

### Any dependencies added

None.

---

## 2026-04-23 (ninth pass) — branch `work`

### Executive summary

1. **What changed**: fixed a History page filter bug where plans with only `extraEntries` could be treated as if they had no history; extracted and tested reusable history-scope helpers; refreshed overnight review docs.
2. **What is highest confidence**: helper-level logic + focused tests (`historyScope.test.ts`) and a minimal HistoryPage wiring change.
3. **What is risky**: very low risk; behavior intentionally broadens filter eligibility to include extras, which matches existing History list behavior.
4. **What you should review first**: `src/pages/HistoryPage.tsx` + new `src/lib/historyScope.ts` to confirm the extras-only plan visibility behavior is desired.

### Biggest issues found

- History plan-filter/default logic depended only on rotation entries, excluding extras-only plans from plan-history detection.

### Improvements completed

- Added `getPlansWithHistory` and `hasPlanHistory` helpers for consistent history activity detection across entries and extras.
- Updated HistoryPage to use helper-based detection and clearer naming (`activePlanHasHistory`).
- Added tests covering entries-only, extras-only, null/unknown IDs.

### Small features added

- None.

### Medium-complexity feature explored

- None this pass (stability-focused run).

### Definitely keep

- History filter/default fix for extras-only plans.
- New helper tests.

### Probably keep but tweak

- Consider whether to co-locate history-scope helpers in an existing util file if you prefer fewer small files.

### Do not keep

- None identified.

### Recommendations only (not implemented)

- History edit modal conflict close-trap UX adjustment.
- Progression-state cleanup on plan delete (schema/index decision required).

### Open questions for you

1. Should extras-only activity also drive any other UI defaults (e.g., dashboard or plan list badges)?
2. Do you want a component-level test harness for page-level filtering behavior, or continue with helper-level tests only?

### Known issues or incomplete work

- No UI/component tests for History page interactions (unchanged).

### Any dependencies added

- None.

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

---

## 2026-04-30 (eighteenth pass) — branch `claude/dreamy-mccarthy-Ymdp2`

### Executive summary

1. **What changed**: One logic bug fix (stale closure in HistoryPage), one
   refactor (extracted shared `extraToPlanDay`), and one medium feature
   (previous-session inline summary on TodayPage). Test count unchanged at
   315 (suite was already comprehensive from prior passes).

2. **What is highest confidence**: The HistoryPage stale-entries fix is a
   narrow, well-reasoned correction to a real bug. The `extraToPlanDay`
   extraction is a pure refactor — identical logic, fewer files. Both are safe
   to keep without careful review.

3. **What is risky**: The previous-session summary feature uses `planDayIndex`
   as the "same workout" key. This is reliable for clean rotation histories
   but can show the wrong session after retroactive edits. Evaluate on a real
   device with several weeks of history.

4. **What I should review first**: Open HistoryPage, find a past entry,
   change both the date and the completion state (e.g., to "Partial") and save.
   Verify the list label updates to "Partial" instead of staying as "Skip" or
   "Complete".

---

### Bugs found and fixed

#### 1. HistoryPage stale `entries` closure (LOGIC BUG — fixed)

**File**: `src/pages/HistoryPage.tsx` — `handleOutcomeConfirm`

When editing a workout outcome that changes both `completedAt` date AND
completion state, the `updateAction` call at the end of the handler used the
React closure-captured `entries` array. After `updateEntryDate` moved the entry
to the new date, the closure was stale, so `entries.find(...)` at the new date
returned `undefined` and `updateAction` was silently skipped.

**Fix**: Use `useHistoryStore.getState().entries` for the post-move lookup.

**Confidence**: High. Well-understood React closure trap. Pattern matches
TodayPage's existing usage.

---

### Code quality improvements

#### 2. `extraToPlanDay` shared utility (REFACTOR — completed)

**Files**: `src/lib/planDayUtils.ts` (new), TodayPage, CalendarPage, HistoryPage

Extracted the identical 6-line `extraToPlanDay` helper from three files into
`src/lib/planDayUtils.ts`. No logic changes, no new tests needed.

**Confidence**: High. Pure refactor. TypeScript confirmed clean.

---

### Feature implemented

#### 3. Previous-session inline summary on TodayPage

**File**: `src/pages/TodayPage.tsx`

Added a compact `"Last: 3×8 @ 135 lb Bench Press"` or `"Last: 2.5 mi · 28 min"`
hint line below today's pending `WorkoutDayCard`. Scoped to `planDayIndex`
so rotation plans show the relevant session.

**Two new pure functions** added to TodayPage.tsx:
- `findPreviousSessionForPlanDay` — history scan, no side effects
- `buildLastSessionSummary` — string formatter

**Confidence**: Medium. Logic is simple and isolated. Main open questions are
UX: is one exercise enough? Does "Last: …" read naturally?

---

### Definitely keep

- HistoryPage stale-entries fix (bug fix, zero risk)
- `extraToPlanDay` extraction (pure refactor, improves maintainability)

### Probably keep but tweak

- Previous-session summary — keep the feature, but consider:
  - Adding `truncate` class to prevent overflow on narrow screens
  - Evaluating whether the exercise name is too long ("Romanian Deadlift")
  - Testing "Last:" vs "Prev:" wording

### Do not keep

Nothing to remove.

### Recommendations only (not implemented)

1. **Subtitle length**: The plan subtitle can grow long on small screens
   ("Day 6 of 6 in rotation · Week 12 of 12 · last week!"). Consider
   splitting into two `<p>` elements or a compact progress pill.

2. **`buildWeightsRecommendation` progression mode** (`progression.ts`):
   Uses `exercises[0].progressionMode` to determine mode for the whole
   workout. If a session has mixed-mode exercises (unlikely but possible),
   the recommendation may be wrong. Low priority — YAML programs control
   the schema and typically use uniform modes.

3. **Upcoming log "Already logged" state in TodayPage** is dead code:
   `getUpcomingDays` never sets `historyEntry` on returned items, so
   `loggingUpcoming.rd.historyEntry` is always `undefined` in TodayPage.
   The "Already logged" branch in the upcoming modal is unreachable. Safe
   to remove or leave as defensive code.

---

### Open questions for me

1. After the HistoryPage fix: does the history list label now update correctly
   when you change both date AND completion state in one edit?

2. For the previous-session hint: is matching by `planDayIndex` the right
   "same workout" signal, or would you prefer matching by exercise names
   (more resilient to rotation pointer changes)?

3. Should the previous-session hint show for skipped/day_off entries too
   (showing the last completed session regardless of how recent days were
   logged)?

---

### Known issues or incomplete work

- **`truncate` on session hint**: The `"Last: …"` hint has no CSS overflow
  protection. A long exercise name (≥ 30 chars) will overflow on a 320px
  screen. One-line fix: add `truncate` to the `<p>`.
- **No test for previous-session helpers**: `findPreviousSessionForPlanDay`
  and `buildLastSessionSummary` are pure functions but untested. Low priority
  given their simplicity, but future iterations should add coverage.

---

### Dependencies added

None.

---

## 2026-05-01 (nineteenth pass) — branch `claude/dreamy-mccarthy-15kIJ`

**Baseline**: 315 passing, 0 failing → **Exit**: 440 passing, 0 failing (+125).

---

### Executive summary

Two real bugs were found and fixed. A critical test gap (zero coverage of the
expression evaluator and program store) was closed with 125 new tests. The tests
themselves surfaced the second bug. No feature work was done — the codebase
needed stabilization first.

---

### Biggest issues found this pass

1. **`evaluateUpdates` silently zeroed min/max-capped update expressions** —
   Any YAML program rule using `easy_miles = min(easy_miles + 0.5, 8)` would
   quietly set `easy_miles` to 0 rather than the capped value. This is a data
   corruption bug for anyone using the running program feature with distance caps.

2. **PlansPage delete handler left orphaned program vars** — `clearPlanVars` was
   never called when deleting a plan. For YAML-imported plans this left stale
   state in the persistence layer. Harmless for most users (plans are rarely
   deleted and IDs are nanoid), but violates the cleanup contract.

---

### Improvements completed

| # | Change | Risk | Rollback |
|---|--------|------|---------|
| 1 | `PlansPage` delete: add `clearVars` call | None | 1-line revert |
| 2 | `expressionEval`: paren-aware `splitStatements` | None | Revert to naive split |
| 3 | 100 tests for `expressionEval.ts` | None | Delete file |
| 4 | 23 tests for `programStore` | None | Delete file |

---

### Definitely keep

- `splitStatements()` in `expressionEval.ts` — fixes silent data corruption.
- `clearVars` in `PlansPage` delete handler — fixes orphan leak.
- Both new test files — 125 tests covering previously untested critical paths.

### Probably keep

- Two new integration tests in `planDeleteCleanup.test.ts` — directly verify
  the bug fix and the no-op edge case.

### Do not keep / recommendations only

- Nothing was added as a recommendation-only item this pass.

---

### Open questions

1. Are there other YAML update expressions in the wild that rely on `min`/`max`
   caps? If so, existing stored `easy_miles` values may already be 0 from prior
   evaluations and would need manual reset.

2. Should `programStore.applyProgressionRule` warn (console.warn) when an
   update expression evaluates to 0 due to a parse error, rather than silently
   accepting 0?

---

### Known issues or incomplete work

- **`truncate` on session hint** (carry-over from pass 18): The `"Last: …"` hint
  has no CSS overflow protection on narrow screens.
- **`findPreviousSessionForPlanDay` / `buildLastSessionSummary`** still untested
  (carry-over from pass 18). Low priority.
- **`planStore.setActivePlan` / `duplicatePlan`** still untested (carry-over
  from pass 17). Medium priority.

---

### Dependencies added

None.

---

<<<<<<< claude/dreamy-mccarthy-WJaAU
## 2026-05-02 (twentieth pass) — branch `claude/dreamy-mccarthy-WJaAU`

**Baseline**: 440 passing, 0 failing → **Exit**: 484 passing, 0 failing (+44).

---

### Executive summary

One UX fix, one refactor that enabled testability, one medium feature (PB
detection), and three test files closing long-standing gaps. All carry-over
items from passes 17–19 are now resolved.

---

### Biggest issues found this pass

1. **Cycle/week progress spans had no `planExpired` guard** — "3/6 done" and
   "rotation complete!" were both visible alongside the "Plan complete!" banner.
   Contradictory UX on a state users hit once per plan.

2. **`findPreviousSessionForPlanDay` and `buildLastSessionSummary` were untested
   pure functions** — both were inlined in a page component making them
   structurally untestable without a full render. Carry-over from pass 18.

3. **`planStore` had zero unit tests** — the six public store actions (including
   `duplicatePlan` and `setActivePlan`) were exercised only via UI. Carry-over
   from pass 17.

4. **`planDeleteCleanup` didn't cover `exerciseHistoryStore`** — the integration
   test verified 4 of 5 cleanup steps but left the exercise-history cascade
   unverified.

---

### Improvements completed

| # | Change | Risk | Rollback |
|---|--------|------|---------|
| 1 | TodayPage: `!planExpired` guard on cycle spans | None | 1-commit revert |
| 2 | Extract session summary helpers to `src/lib/sessionSummary.ts` | None | Revert commit |
| 3 | PB detection in session hint | Low | Remove 3 TodayPage lines + opt param |
| 4 | 21 tests for `sessionSummary.ts` | None | Delete file |
| 5 | 22 tests for `planStore` | None | Delete file |
| 6 | +1 test in `planDeleteCleanup` for exerciseHistory cascade | None | Delete test |

---

### Definitely keep

- `!planExpired` guard — fixes real UX contradiction.
- `sessionSummary.ts` extraction — enables testability; zero behaviour change.
- All three new test files — closes the remaining test gaps from passes 17–19.

### Probably keep

- PB detection feature — passive, zero-friction. The only question is whether
  `" · PB"` in muted slate text is visible enough. Could style with
  `text-amber-400` in a follow-up if users find it easy to miss.

### Do not keep / recommendations only

- Consider styling `" · PB"` in amber/gold for more visibility.
- A "Personal Records" section on HistoryPage or SettingsPage is a natural
  next feature using the same `maxLoadByExercise` computation.
- Run/swim PB detection deferred — run adaptation already handles distance
  guidance; would need a separate `maxDistanceByType` computation.

---

### Open questions

1. Should `" · PB"` have distinct colour styling? Currently in the same muted
   `text-slate-500` as the rest of the hint — easy to miss on a quick glance.

2. Is there a case where `findPreviousSessionForPlanDay` returns the wrong
   session after retroactive history edits that shift planDayIndex values? If
   so, the hint shows stale data. The same concern applies to
   `previousSetsByExercise` (pre-existing, not introduced here).
=======
## 2026-05-03 (twentieth pass) — branch `claude/dreamy-mccarthy-SwIxl`

### Executive summary

1. **What changed**: 29 new unit tests for `exerciseHistoryStore` (no prior
   coverage), and the Personal Records feature added to the History tab — a
   collapsible table showing per-exercise best weight, best reps, and session
   count. A dead-code bug in `PersonalRecordsSection` was found and fixed. 469
   tests now pass (was 440).

2. **What is highest confidence**: The test suite — all 29 new tests are
   straightforward unit tests against pure logic with no external dependencies.
   The `computePersonalRecords` function is a single-pass reduce with clear
   invariants. The dead-code fix is mechanical (removed unreachable branch).

3. **What is risky**: `PersonalRecordsSection` is a new UI component that hasn't
   been browser-tested. The component is display-only with no side effects, so
   the risk is limited to visual rendering (layout, overflow, empty states).

---

### What changed

#### Test: `exerciseHistoryStore` (29 new tests)

`src/store/__tests__/exerciseHistoryStore.test.ts` — new file. Covers all six
public methods of the store added in PR #66 that had zero prior coverage.

Notable: the `upsertFromOutcome` method parses `planId` and `calendarDate` from
the `workoutInstanceId` string. Both the standard format (`planId_date`) and the
extra format (`planId_date_extra_id`) are tested. The idempotency invariant
(second call replaces, not appends) is verified explicitly.

#### Feat: Personal Records in History tab

`src/pages/HistoryPage.tsx` — new `PersonalRecordsSection` component, new
`computePersonalRecords` pure function, new `PersonalRecord` interface. The
section renders only when there are records; it collapses by default.

Dead-code fix: `{hasMore && !expanded && (...)}` was inside `{expanded && (...)}`,
making the `!expanded` guard always `false`. Removed the dead branch and
simplified the component to a plain toggle.
>>>>>>> main

---

### Known issues or incomplete work

<<<<<<< claude/dreamy-mccarthy-WJaAU
- **`" · PB"` styling** — plain slate text may be too subtle. Evaluate on
  device; `text-amber-400` is a one-line CSS change.
- **Run/swim PB** — no PB detection for run or swim outcomes.
- **Double-day rotation behavior** — advance override + complete on the same
  day still untested.
=======
- **`computePersonalRecords` unit tests** not yet written. The function is
  exported and easily testable; carrying forward as a low-priority gap.
- **`truncate` overflow on exercise names** in the PR table — long exercise
  names may overflow the first column on narrow screens. Low priority.
- **`truncate` on session hint** (carry-over from pass 18). Low priority.
- **`findPreviousSessionForPlanDay` / `buildLastSessionSummary`** still
  untested. Low priority.
- **`planStore.setActivePlan` / `duplicatePlan`** still untested. Medium.
>>>>>>> main

---

### Dependencies added

None.

---

## Pass 22 — 2026-05-05

### Summary

Five changes landing on this pass:

1. **PB detection fixed** (`sessionSummary.ts`): was using first set with data;
   now uses the set with maximum `actualLoad`, so warmup sets no longer mask
   a true personal best. Two new tests with mixed warmup/working set fixtures.

2. **Nudge suppressed when plan expired** (`TodayPage.tsx`): added
   `!planExpired &&` guard so "rotation may be stalled" doesn't contradict the
   "Plan complete!" banner.

3. **Dead code removed** (`TodayPage.tsx`): the "Already logged" branch in the
   upcoming workout modal was provably unreachable (`getUpcomingDays` never
   sets `historyEntry` on future `ResolvedDay` objects). Removed ~33 lines of
   dead JSX and the `handleUpcomingClear` helper.

4. **`computePersonalRecords` extracted** (`historyStats.ts`): moved from
   `HistoryPage.tsx` where it was untestable, to `historyStats.ts` alongside
   other pure stats helpers. 7 unit tests added.

5. **`progressionStates` orphaning fixed** (`outcomeStore.ts`, `PlansPage.tsx`):
   added `removeProgressionStates(groupIds)` action; plan delete handler now
   collects and clears progression group IDs before removing the plan. 2
   integration tests added.

### Remaining open items

- Plan builder UI should validate `duration.value > 0` (no crash, just bad UX)
- Narrow Zustand selectors in CalendarPage (performance, not urgent)
- Document progression system migration path (legacy RunProgressionState vs new ProgressionRecommendation)
- Expression evaluator should surface errors to UI for malformed progression rules
- `PlanCard` defined inside `PlansPage` function body (low priority)

### Dependencies added

None.
