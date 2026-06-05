# Feature Proposals

## Pass 49 — 2026-06-04 (branch `claude/dreamy-mccarthy-WovqU`)

### Feature selected

**"Rotation X of Y" in TodayPage header for multi-rotation plans**

### Why it was selected

Weeks-based plans already show "Week 3 of 8" context in the header. Rotation-based plans show only within-cycle detail (`3/7 done`, `last one!`) but give no overview of which rotation the user is in. Users doing a 4-rotation training block must count from history to know whether they're in rotation 1 or 4. This closes the information parity gap with a narrow, additive change.

### Expected user value

- At-a-glance orientation: "I'm in rotation 2 of 4" vs "I'm on day 3 of 7 in this cycle"
- Motivation: seeing "last rotation!" parallels the existing "last week!" celebratory hint
- No extra taps or navigation required

### Implementation scope for this run

- Compute `rotationProgress` via `computePlanProgress(plan, planEntries, today)` (already correctly future-filtered as of this pass)
- Add one conditional `<span>` to the existing header subtext in TodayPage
- No new state, no new store, no new utility functions

### Assumptions being made

- A plan with `duration.value === 1` doesn't need a rotation indicator ("Rotation 1 of 1" is noise)
- The `computePlanProgress` return value (number of completed full rotations) is the right source of truth for "which rotation are we in"
- Expired plans should not show a rotation number (banner takes precedence)

### Open product / UX decisions

- Should the Plans list also show a compact rotation indicator?
- Should the CalendarPage month header show which rotation that month falls in?

### Architecture or schema impact

None. Read-only use of existing computed values.

### Risks

- Information density in the header subtext grows. The "Rotation X of Y" only renders when `rotationProgress.completed < rotationProgress.total` (not expired), so it doesn't stack with the expiry banner. It does stack with `cycleProgress.doneInCycle/rotationLength`, but each piece displays in different contexts.

### Rollback strategy

`git revert 4cb90ae` — removes the `rotationProgress` compute and the conditional JSX span.

### What is intentionally not being built yet

- Per-plan rotation indicator in Plans list
- CalendarPage month-header rotation context

---

## Pass 47 — 2026-06-01 (branch `claude/dreamy-mccarthy-iQpbb`)

### Feature selected

`computeConsecutiveSkips` — a pure library function that counts how many consecutive days a user has only logged "skip" entries for a given plan, counting backwards from yesterday.

### Why it was selected

This was the clearest candidate for a purely additive, zero-risk feature in this pass:

- The codebase has `computePlanStreak` (consecutive completions) but no equivalent "consecutive skip" counter. This creates an asymmetry: the app can reward consistency but cannot notice or surface a concerning skip streak.
- Implementation is trivially parallel to `computePlanStreak`: scan filtered entries into two sets (`skipDates`, `breakDates`), then walk back from `shiftDay(today, -1)`. No store changes, no component changes.
- The function is composable with any future notification, coaching nudge, or stats surface — it produces a simple number.
- Other feature candidates (extraction of `findPreviousSetsByExercise` into a shared utility, `programVarsMap` selector memoization) were lower-value or required more architectural surface area than appropriate for a single pass.

### Expected user value

- A user who keeps clicking "Skip" on workouts can be shown "You've skipped 3 in a row — want to revisit your schedule?" — friendly accountability without the app requiring it.
- A coach or plan designer reviewing history could see skip streaks in a stats panel.
- The function is symmetric with `computePlanStreak`, making both accessible to any future stats dashboard.

### Implementation scope for this run

- Modified: `src/lib/historyStats.ts` — exported `computeConsecutiveSkips` function (~30 lines)
- Modified: `src/lib/__tests__/historyStats.test.ts` — 15 new tests
- Not changed: any UI component, store, or router

### Assumptions being made

- "Today" is excluded because the user may still log today. Counting from yesterday is conservative and correct.
- Any gap in the skip sequence (a date not in skipDates and not yet in history) stops the streak. A date with no entry at all is not a skip.
- Extras for the same plan break the streak (completing an extra is not skipping).
- Extras for a different plan do not break the streak (different plan's activity doesn't count against this plan's streak).

---

## Pass 45 — 2026-05-30 (branch `claude/dreamy-mccarthy-mxssu`)

### Feature selected

`useToday` hook with midnight date refresh for TodayPage.

### Why it was selected

This has been documented as a known staleness risk since pass 44 and earlier. It is the single cleanest, most self-contained feature available:

- Identified risk: if the app stays open past midnight, `today` is stale. On TodayPage this means wrong date on the Today card, wrong stats, wrong "upcoming" projections, and a stale "days ago" hint.
- The fix requires only a new 20-line hook and a one-line change in TodayPage.
- No architectural decisions, no ambiguous product choices, no store schema changes.
- Other feature candidates (avg effort in training mix, `programVarsMap` selector) are higher-effort or higher-risk.

The bug fixes in this pass were high-confidence and left room for one small feature. The audit found no major instability requiring stabilization first (all 767 tests passed on entry).

### Expected user value

Users who pin the app as a PWA or leave it open on a tablet overnight will see the correct date immediately when they return, without needing to navigate away and back. The "Today" card, stats bar, and upcoming section all update atomically at midnight.

### Implementation scope for this run

- New file: `src/hooks/useToday.ts` (one `useState` + one `useEffect`, 25 lines)
- Updated: `src/pages/TodayPage.tsx` — import + one-line replacement of `format(new Date(), 'yyyy-MM-dd')`
- Not changed: CalendarPage, HistoryPage (deferred; same fix applies but one page at a time)

### Assumptions being made

- A single `setTimeout` per day is acceptable overhead in a mobile PWA context.
- Users care about the date being correct at midnight (not just on first load).
- The `[today]` dependency correctly re-arms the timer on each midnight crossing.

### Open product / UX decisions

None. The date display is a factual value with no ambiguity.

### Architecture or schema impact

None. No store changes. No new imports beyond `useState`/`useEffect` from React and `format` from `date-fns` (already available in the project).

### Risks

- If the device clock is wrong, the timeout may fire too early or too late. This is inherent to relying on system time and not specific to this fix.
- If TodayPage is unmounted and remounted across midnight (e.g., the user navigates away and back), the new mount recalculates the timeout correctly. No issue.

### Rollback strategy

`git revert 91f5d26` — reverts the hook file creation and TodayPage import/usage. The hook has no state in any store or localStorage, so there is no migration risk on rollback.

### What is intentionally not being built yet

- CalendarPage / HistoryPage `useToday` wiring — deferred to a future pass.
- Tests with fake timers for the hook — documented as missing; straightforward to add with `vi.useFakeTimers()` if desired.

---

## Pass 43 — 2026-05-29 (branch `claude/dreamy-mccarthy-4tAQK`)

### Feature selected

`ExtraWorkoutEntry.source` store migration — set `source: 'history'` on all
pre-existing extra entries that have `source === undefined`.

### Why it was selected

This has been a documented risk since the `source` field was introduced (passes 38–42).
TodayPage's Undo handler removes extras where `source !== 'history'`. Pre-existing extras
with `source: undefined` fall into this bucket and would be silently deleted on Undo —
even if the user explicitly added them via Calendar or History.

The migration is:
1. **Clearly adjacent** — directly fixes an existing store field's migration gap.
2. **Low risk** — only changes `undefined` → `'history'`; no other fields touched.
3. **Narrowly scoped** — one store file, one migration function, 6 unit tests.
4. **Easy to review and revert** — remove `version` + `migrate` from persist config.

### Expected user value

Users who have extras logged before the `source` field was introduced (i.e., any user
who used the app before pass N where `source` was added) will no longer risk having those
extras silently removed when they press Undo. This is a correctness fix disguised as a
feature — the user-facing change is "Undo no longer deletes your old manually-added extras."

### Implementation scope for this run

- `migrateHistoryState(persisted, fromVersion)` exported function in `historyStore.ts`
- `version: 1` in persist config (Zustand runs migration on first load)
- 6 direct unit tests for the migration function

### Assumptions being made

- Pre-existing extras (before `source` was introduced) were added via History/Calendar,
  not via the double-day flow. This is true because the double-day flow was introduced
  at the same time as the `source` field, so no double-day extras exist without a source.
- `undefined` → `'history'` is the safe default. If we're wrong and some `undefined`
  extras ARE double-day extras, the worst outcome is they survive an Undo instead of
  being removed. This is less bad than silently deleting a user-added extra.

### Open product / UX decisions

- None. The migration is purely protective and has no visible UX change except that
  Undo no longer removes old extras.

### Architecture or schema impact

- `historyStore` persist config gains `version: 1` and `migrate` — consistent with
  `planStore` which already has `version: 2` and a migration.
- No localStorage key change. Zustand handles the version check internally.

### Risks

- Very low. The migration runs once on first load. If the migration function throws
  (it shouldn't — it handles all data shapes), Zustand falls back to its reset
  behavior. The function is guarded against null/undefined data.

### Rollback strategy

Remove `version` and `migrate` from `historyStore`'s persist config. Users who already
ran the migration will keep `source: 'history'` on their migrated extras — this is the
correct state, so no rollback of data is needed.

### What is intentionally not being built yet

- Retroactive double-day source detection (identifying which old undefined-source extras
  were created by the double-day flow). This is theoretically possible by cross-referencing
  with history entries, but the risk is too high and the benefit too low.

---

## Pass 42 — 2026-05-28 (branch `claude/dreamy-mccarthy-HtWcw`)

**No medium-complexity feature attempted this pass.**

The user-feedback commit added substantial new features (swipe delete, countdown timer, rest
timer improvements, progression preview). Stabilizing and correcting those features was the
right priority. The audit found four low-risk, high-value fixes that were all implemented.
No new feature was selected to avoid scope creep on a code base that was recently extended.

---

## Pass 40 — Feature Proposal — Swim Actuals in History CSV

Date: 2026-05-26
Branch: `claude/dreamy-mccarthy-8Sa0s`
Status: **Implemented this run**

## Feature selected

Include swim workout actual data in the history CSV export and import.

## Why it was selected

The history CSV is the app's primary backup and migration path. `historyToCsv` already
exports run actuals (distance, duration, pace, heart rate, completedAsPlanned). Swim
actuals (`actualDistanceMeters`, `actualDurationMin`, `averagePaceSecondsPer100m`,
`completedAsPlanned`) were silently omitted — not a silent failure but a silent data loss.
Any user who swims and exports for backup will lose all swim performance data on re-import.
This is a correctness gap with zero design ambiguity: the data model already has `swimActual`
on `WorkoutOutcome`, the import path already handles run actuals via the same column-lookup
pattern, and the change is purely additive.

## What was proposed

1. Append four new header columns (`swimActualDistanceMeters`, `swimActualDurationMin`,
   `swimAveragePaceSecondsPer100m`, `swimCompletedAsPlanned`) to `HISTORY_HEADERS`
   after the existing run columns.
2. Write `outcome.swimActual` fields into both rotation and extra row builders.
3. Add a `swimActual` reconstruction block to `buildOutcomeFromRow`.
4. Add round-trip tests.

## What was not proposed

- No UI changes — swim data export is transparent to users.
- No schema version bump — column additions are backward compatible with header-based parsing.
- No merging of `completedAsPlanned` into a shared column — the run and swim interpretations
  are distinct enough to warrant separate columns and separate reconstruction paths.

---

# Feature Proposal — Surface progressionRecommendation.note on TodayPage

Date: 2026-05-24
Branch: `claude/dreamy-mccarthy-oaS1e`
Status: **Implemented this run**

## Feature selected

Show the previous session's `progressionRecommendation.note` as a `↗ [note]` line
in the pre-workout hint block on TodayPage, alongside the existing `lastSessionSummary`
and `prevSessionOutcome.notes` lines.

## Why it was selected

`buildProgressionRecommendation` in `modules/workout-outcomes/progression.ts` produces
structured progression guidance for weights outcomes (e.g., "add 2.5 lb next session",
"maintain current load") and stores it in `WorkoutOutcome.progressionRecommendation`.
This field was computed and persisted but never surfaced at decision time — users had to
open the outcome modal to see it. Surfacing it inline on TodayPage closes the loop: the
guidance appears exactly when the user is deciding how to approach their next session.

## Why it was not selected for run slots

Run progression is already handled separately through the `todayAdaptationNote` pathway
(using `generateRunAdaptationNote` + `RunProgressionState` from the progression state
machine). Run days that have a progression note in `prevSessionOutcome` would show it
alongside `todayAdaptationNote`, creating redundant and potentially conflicting guidance.
The `!todayRunSlot` guard prevents this overlap.

## Expected user value

- Weights users who trigger auto-progression see "↗ add 2.5 lb next session" directly
  on the pending card before tapping "Start Workout" — no modal navigation required.
- Users without progression rules or outcomes see no change (the guard short-circuits).
- Consistent with existing `prevSessionOutcome.notes` display (same hint block, same visibility conditions).

## Implementation scope for this run

Minimal: 4 lines in `TodayPage.tsx`:
1. Added `!todayRunSlot && prevSessionOutcome?.progressionRecommendation?.note` to the
   outer `&&` condition that shows the hint block.
2. Added a `<p className="text-xs text-sky-700 truncate">↗ {note}</p>` element inside
   the block, rendered only when `!todayRunSlot` and the note exists.

## Assumptions being made

- `progressionRecommendation.note` is a user-readable string already formatted by
  `buildProgressionRecommendation` — no additional formatting is needed here.
- The `!todayRunSlot` guard is the right discriminator. A day can have multiple slots
  (e.g., run + weights double-day), but `todayRunSlot` is the first run-type slot in
  `todayResolved.planDay.slots`. If any run slot is present, the hint is suppressed.
- `truncate` CSS is acceptable for long notes (full note accessible in outcome modal).

## Open product / UX decisions

1. Should the `↗` arrow prefix be something else (e.g., a `TrendingUp` icon)?
2. Should the color be `text-sky-700` or a more muted `text-slate-500` / `text-slate-400`
   to match the existing summary line style? Sky-colored text may feel out of place in
   the otherwise slate-toned hint block.
3. Should this be shown even when `lastSessionSummary` is null (just notes or just the
   progression hint)? Currently yes — the `||` condition allows any one of the three
   to trigger the hint block.

## Architecture / schema impact

None. `progressionRecommendation` is already on `WorkoutOutcome`; `prevSessionOutcome`
is already computed in TodayPage. No new store subscriptions, no new computation.

## Risks

- Minimal. Purely additive conditional rendering — the guard ensures no regression for
  run slots or slots without prior outcomes.
- If `progressionRecommendation.note` is unexpectedly long, it truncates at the container
  width. Acceptable given the existing truncation pattern for `prevSessionOutcome.notes`.

## Rollback strategy

Remove the `!todayRunSlot && prevSessionOutcome?.progressionRecommendation?.note`
condition from the outer `&&` and remove the `<p>` element inside the hint block.
No data migration. No store changes.

## What is intentionally not being built yet

- Showing the note for run slots in a way that doesn't conflict with `todayAdaptationNote`.
- Per-exercise progression notes (only the slot-level note is shown; exercise-level notes
  in `ex.progressionRecommendation` are not surfaced on TodayPage).
- Expansion / tooltip for the full progression context object (just the `note` string).
- Writing the recommendation back from TodayPage (read-only display only).

---

# Feature Proposal — Gap Weeks in Weekly Activity Panel

Date: 2026-05-20
Branch: `claude/dreamy-mccarthy-zGJFa`
Status: **Implemented this run**

## Feature selected

Gap weeks — fill the Weekly Activity panel with zero-count placeholder rows for any ISO
weeks between the first and last active week that have no logged entries.

## Why it was selected

`computeWeeklyBreakdown` (pass 31) returns only weeks with activity. If a user took two
weeks off, the panel jumped from week 4 to week 7 with no indication of the gap. This
made the panel optimistic and inconsistent: a user with 6 good weeks, then 2 missed weeks,
then 1 more week would see 7 rows that looked like consecutive progress rather than 6+1
with a visible break.

The fix was the next logical step after the Weekly Activity panel was wired in pass 32.

## Expected user value

- **Honest consistency view**: gaps are visible at a glance — "I had two missed weeks in
  April" is legible without scrolling the full history list.
- **Accountability**: seeing a grey row for a missed week is a mild motivational signal
  without being heavy-handed.
- **No learning curve**: gap rows look like ordinary rows but are visually muted, so
  users understand them intuitively.

## Implementation scope for this run

1. Export `isoWeekStart` from `historyStats.ts` (was private) for use by callers.
2. Add `WeeklyBreakdown.isEmpty?: boolean` optional flag.
3. Add `padWeekGaps(weeks: WeeklyBreakdown[]): WeeklyBreakdown[]` — pure utility that
   fills holes between the first and last week with zero-count placeholder rows.
4. 5 unit tests for `padWeekGaps` in `historyStats.test.ts`.
5. Update `weeklyBreakdown` useMemo in `HistoryPage` to call `padWeekGaps` before reversing.
6. Update `WeeklyActivitySection` to render gap rows with muted styling and "No activity" text.

## Assumptions being made

- Gap rows are only filled between the first and last active week in the displayed range,
  not before the first or after the last active week.
- The 8-week window is unchanged; gap filling just makes existing gaps visible.
- "No activity" text and "—" count are clear enough for users — no tooltip needed.

## Open product / UX decisions

1. Should gap rows be rendered at all for very long gaps (e.g., 6 empty rows in a row)?
   Currently shown; could be capped at N to avoid excessive grey rows.
2. Clicking a gap row could navigate to Calendar to that week. Not implemented.
3. Should the current week appear as a gap row if today is mid-week and no entry exists yet?
   Currently: yes, if the current week is inside the range and has no activity yet.

## Architecture / schema impact

`WeeklyBreakdown` gains an optional `isEmpty?: boolean` field. No store changes, no
localStorage changes, no breaking changes to existing callers (the field is optional).

## Risks

- A user with only one active week in the 8-week window gets a single row (no change,
  since `padWeekGaps` requires ≥ 2 weeks to fill).
- A user whose only active week is the most recent one also gets a single row (no change).
- Very inactive users (only 2 active weeks in 8 weeks) may see up to 5 gap rows, which
  could feel verbose. Low probability; and the visual cue is still useful.

## Rollback strategy

`git revert d2ac3fb` reverts `historyStats.ts`, `historyStats.test.ts`, and
`HistoryPage.tsx`. No data migration, no store schema changes, no downstream effects.

## What is intentionally not being built yet

- Filling gaps before the first active week or after the last active week
- Clicking a gap row to navigate to Calendar
- Configurable gap row appearance (e.g., a "rest block" label vs. "No activity")
- Cross-plan gap visibility

---

# Feature Proposal — Weekly Activity Panel in HistoryPage

Date: 2026-05-18
Branch: `claude/dreamy-mccarthy-THUP4`
Status: **Implemented this run**

## Feature selected

Weekly Activity panel — a collapsible "Recent Weeks" section in HistoryPage that displays
the last 8 weeks of workout activity, newest first, using the `computeWeeklyBreakdown`
utility added in pass 31.

## Why it was selected

`computeWeeklyBreakdown` was added in pass 31 with 15 tests but had zero UI consumers.
It was the most obvious pending follow-up from that pass. The feature is:
- Fully adjacent (uses existing utility, existing data, existing design patterns)
- Narrowly scoped (one new component, one memo computation)
- Immediately testable (the utility is already tested; the UI is simple)
- Easy to revert (one component + one JSX insertion point)

## Expected user value

Weekly consistency is the metric most users care about during a training program.
The existing stats grid (streak, 7-day, 30-day, total) gives aggregate numbers but no
week-by-week breakdown. A user who completed 3 workouts last week, 5 the week before,
and 1 the week before that can see the pattern at a glance without scrolling through
individual log entries.

## Implementation scope for this run

- Add `addDays` to date-fns import in HistoryPage
- Import `computeWeeklyBreakdown` and `WeeklyBreakdown` type from `lib/historyStats`
- Add `weeklyBreakdown` useMemo (last 8 weeks, reversed to newest-first, hidden for "All plans")
- Add `WeeklyActivitySection` component (collapsible, 3-column grid: date range, context, done count)
- Insert `<WeeklyActivitySection>` between PersonalRecordsSection and the workout list

## Assumptions being made

- "All plans" filter: weekly breakdown is per-plan, so the panel is hidden when no
  specific plan is selected.
- 8 weeks (~56 days) is a reasonable default window. Most plan cycles are 4–12 weeks.
- Newest-first order matches the workout list ordering convention.
- Expanding by default is preferable to collapsed-by-default for immediate visibility.

## Open product / UX decisions

1. Collapsed vs. expanded default — currently expanded. Could be a personal preference.
2. "All plans" weekly breakdown — possible via cross-plan aggregation, not implemented.
3. Date range — hardcoded to 8 weeks; could be user-configurable.
4. Empty weeks — currently omitted. Could show them as grey rows for gap visibility.
5. Label format — "May 12–18" vs. "This week / Last week" relative labels.

## Architecture / schema impact

None. No new stores, no schema changes. Pure UI wiring of existing utility.

## Risks

- The component defaults to expanded (`useState(true)`). If the section is large (many
  active weeks), it could push personal records and the workout list below the fold.
  Mitigated by the collapsible design.
- Hidden for "All plans" filter — users with multiple plans who never select a specific
  plan won't see the panel. This is a known limitation, not a bug.

## Rollback strategy

`git revert e47af7c` removes all UI changes. No data, no store, no schema affected.

## What is intentionally not being built yet

- Cross-plan weekly aggregation
- Week sparklines / visual bar charts
- Configurable date range
- Comparison to previous period ("↑ 2 more workouts than last 8 weeks")

---

# Feature Proposal — Weekly Workout Breakdown Utility

Date: 2026-05-17
Branch: `claude/dreamy-mccarthy-UaphK`
Status: **Implemented this run**

## Feature selected

`computeWeeklyBreakdown` — a new pure utility function in `historyStats.ts` that aggregates workout history into per-ISO-week buckets.

## Why it was selected

The existing stats layer has:
- `computeHistoryStats` — rolling totals and streaks
- `computePlanProgress` — overall plan progress
- `computeRotationCycleProgress` — within-cycle progress
- `computeWorkoutTypeBreakdown` — per-type aggregation

Missing: per-week grouping. This is a natural gap — users often think about their training in weekly blocks ("how many days did I work out this week?"). The data is already in historyStore; only the grouping logic was missing.

## Expected user value

Once wired into a UI (HistoryPage or TodayPage), users can:
- See their weekly consistency at a glance (e.g., "3 days completed, 1 skip, 1 day off")
- Compare current week to recent weeks without scrolling through the calendar
- Identify weeks where extra workouts filled in missed rotation days

## Implementation scope for this run

- New function `computeWeeklyBreakdown(planId, entries, extras, fromDate, toDate): WeeklyBreakdown[]`
- New interface `WeeklyBreakdown { weekStart, weekEnd, completed, skipped, dayOffs, extras, totalLogged }`
- Private helper `isoWeekStart(date)` — Monday of the ISO week containing `date`
- 15 tests covering all edge cases
- No UI changes — function is ready for future wiring

## Assumptions being made

- ISO week (Monday start) is the correct week anchor. This differs from the CalendarPage grid which uses Sunday start. If the UI needs Sunday-based weeks, the `isoWeekStart` helper is the only place to change.
- Weeks with no activity are omitted (not padded with zeros). Callers that need to show empty weeks must fill gaps themselves.
- `planId` is always passed — no global (cross-plan) weekly breakdown in this slice.

## Open product / UX decisions

1. **Monday vs. Sunday week start** — ISO standard (Monday) chosen; needs confirmation if UI uses Sunday-aligned weeks.
2. **Range selection** — caller controls fromDate/toDate. Should the default range be the plan's full duration, or just the last N weeks?
3. **Empty weeks** — omitted for now. UI must decide whether to fill or skip.

## Architecture or schema impact

None. Pure utility function with no store or component dependencies.

## Risks

None. The function is purely additive. Removing it requires reverting one commit.

## Rollback strategy

`git revert 2f9d724`

## What is intentionally not being built yet

- UI component showing the weekly breakdown chart or table
- Cross-plan (global) weekly breakdown
- Sunday-based week variant
- Aggregation by workout type within each week

---

# Feature Proposal — Rotation Plan Remaining Counter

Date: 2026-05-15
Branch: `claude/dreamy-mccarthy-rtcbO`
Status: **Implemented this run**

## Feature selected

Surface how many workouts remain to complete a rotations-based plan in the TodayPage
header subtitle, visible only during the final rotation.

## Why it was selected

The existing cycle-progress indicator shows "N/M done" within the current rotation but
nothing about how many workouts remain to finish the whole plan. Users near the end of a
multi-rotation plan have no way to tell they are close to completion without mentally
computing `(total_rotations − rotations_done) × days_per_rotation − done_in_cycle`.
A "3 left to finish" label adds meaningful motivation at exactly the moment it matters
most, without cluttering earlier phases.

## Expected user value

- Motivation near the finish line.
- Clear signal to start thinking about a follow-up plan.
- Consistent with the "last one!" / "last week!" patterns already present.

## Implementation scope for this run

- `computeRotationPlanRemaining(plan, entries): number | null` in `historyStats.ts`
- 11 unit tests
- TodayPage header: one JSX conditional spanning 4 lines

## Assumptions being made

- "Final rotation" (remaining ≤ plan.days.length) is the right visibility threshold.
- Users prefer seeing the label only near the end, not from day one ("42 left to finish"
  is demotivating; "3 left to finish" is motivating).

## Open product / UX decisions

- Visibility threshold is a judgment call. Could be `≤ 2 × plan.days.length` (two
  rotations left) or `=== 1` (only the last workout). Chosen threshold is one rotation.
- Should the label appear on the expiry banner ("plan complete!") day? Currently suppressed
  since `!planExpired` hides it when remaining === 0.

## Architecture / schema impact

None. Pure computation over existing store data. No store changes.

## Risks

- Minimal. The label is a single additive JSX element. Removing it fully reverts the UX.
- The function has no side effects and is fully unit-tested.

## Rollback strategy

Remove the `rotationPlanRemaining` computation and the JSX conditional in TodayPage (~6
lines). Remove the import. All tests still pass since no existing behavior changed.

## What is intentionally not being built yet

- Display for weeks-based plans (no obvious "workouts remaining" metric for time-based plans)
- A progress bar or visual indicator (the text label keeps it minimal)
- Notifications or push reminders when near plan completion

---

# Feature Proposal — All-Time Best Streak (`longestStreak`)

Date: 2026-05-14
Branch: `claude/dreamy-mccarthy-nJAOH`
Status: **Implemented this run**

## Feature selected

Surface the user's all-time best consecutive-day workout streak alongside the current
streak on TodayPage, providing motivational context when the current streak is below the
personal best.

## Problem statement

TodayPage's stats bar showed only the *current* streak. After a streak break, users had no
way to see their historical best — a piece of data that is both motivating (aiming to beat
it) and informative (shows long-term consistency). The data was available but never computed.

## Design

**Data layer**: Add `longestStreak: number` to `HistoryStats`. Compute it inside
`computeHistoryStats` by:
1. Collecting all qualifying dates into the existing `streakable` Set.
2. Sorting them (YYYY-MM-DD lexicographic sort is correct date order).
3. Walking the sorted array, resetting a run counter on any gap > 1 day, tracking the max.

O(n log n) where n = number of distinct qualifying dates — negligible for typical history
sizes (< 1000 entries).

**UI layer**: In TodayPage's streak tile, conditionally render a muted `"Best: N"` line
below the current streak count, visible only when `longestStreak > currentStreak`. When
the user is on their all-time best streak, the sub-label is hidden (no noise, no redundancy).

## Alternatives considered

- **Separate tile**: A dedicated "Best Streak" tile would add visual weight for data that
  is mostly static. Sub-label approach is lighter.
- **Persist longestStreak in store**: Not needed — it can always be recomputed from history.
  Avoids store schema migration.
- **Show even when equal**: Decided against — "Best: 5" when current is also 5 is redundant.

## Risk

Low. The `longestStreak` field is purely additive to a read-only interface. No store
serialization, no breaking changes to existing callers (all callers only read stats fields
they need). Type-checker enforces the new field throughout.

---

# Feature Proposal — Swim Pace Derivation in Session Summary Hint

Date: 2026-05-13
Branch: `claude/dreamy-mccarthy-JEVCy`
Status: **Implemented this run**

## Feature selected

Derive swim pace from distance + duration in `buildLastSessionSummary` when
`averagePaceSecondsPer100m` is absent or is 0 (bad-data). The derivation
mirrors the existing run pace derivation added in pass 24/25.

## Why it was selected

The session summary hint on TodayPage already surfaces `x m · y min` for
swim workouts. If no GPS or manual pace was recorded, the hint is less useful
than it could be — the user can see how far and how long, but not how fast.
The derivation formula is identical to the one already proven for run:

```
pace (s/100m) = (durationMin × 60) / (distanceMeters / 100)
```

This is:
1. **Low-risk** — a single formula, results fed to the existing `formatSwimPace`
   function whose output format and edge cases are already tested.
2. **Consistent** — the run block already derives pace with identical guard
   logic (store=0 → bad data → fall back to derived). This mirrors it exactly.
3. **Useful** — many swim logging apps record only distance + time, not pace.
   Without derivation, swim hints are uniformly pace-free even when pace is
   fully calculable.

## What was not selected and why

**Showing derived pace visually differently** (e.g. a "~" prefix to signal
estimation) was considered and rejected. The run block does not distinguish
stored vs. derived pace in the hint. Treating swim differently would add
inconsistency; and at this stage the hint is already considered a useful-but-
rough signal, not a certified data point.

**Adding a UI setting to disable derivation** was rejected as premature. No
user has asked to suppress derived pace; if one does, the opt-out can be added
at that time.

## How the feature was implemented

In `src/lib/sessionSummary.ts`, the swim block was extended from:

```typescript
if (swim.actualDistanceMeters != null) parts.push(...)
if (swim.actualDurationMin != null) parts.push(...)
if (swim.averagePaceSecondsPer100m != null) parts.push(formatSwimPace(...))
```

to the same stored-vs-derived pattern used in the run block:

```typescript
const storedSwimPace = swim.averagePaceSecondsPer100m != null && swim.averagePaceSecondsPer100m > 0
  ? swim.averagePaceSecondsPer100m : null
const derivedSwimPace = storedSwimPace == null &&
  swim.actualDistanceMeters != null && swim.actualDistanceMeters > 0 &&
  swim.actualDurationMin != null && swim.actualDurationMin > 0
    ? (swim.actualDurationMin * 60) / (swim.actualDistanceMeters / 100) : null
const swimPace = storedSwimPace ?? derivedSwimPace
if (swimPace != null) parts.push(formatSwimPace(swimPace))
```

This means:
- Stored pace (> 0) always wins.
- Stored pace of 0 is treated as bad data (same as run); derivation kicks in.
- If only distance or only duration is present, no pace is shown.

## Test coverage added

7 new or updated tests in `src/lib/__tests__/sessionSummary.test.ts`:

| Test | Purpose |
|------|---------|
| formats swim with distance, duration, and derived pace | Core happy path |
| rounds swim distance to the nearest whole meter (with derived pace) | Float rounding check |
| includes swim pace when averagePaceSecondsPer100m is present | Stored pace wins |
| derives swim pace when averagePaceSecondsPer100m is null | Null → derive |
| derives swim pace when stored is 0 (bad data fallback) | 0 → derive |
| does not derive swim pace when only distance (no duration) | Derivation requires both |
| prefers stored swim pace over derived when both are available | Priority test |

---

# Feature Proposal — Previous Session Notes in TodayPage Hint

Date: 2026-05-13
Branch: `claude/dreamy-mccarthy-G6yaB`
Status: **Implemented this run**

## Feature selected

Show the previous session's notes as a second hint line below the existing
"Last: …" workout summary on TodayPage, when the workout is pending and
the prior session has non-empty notes.

## Why it was selected

The "Last: …" hint (added in pass 18, extended in passes 20/24/25) already
surfaces the most useful pre-workout data: what weight was used, how far was
run, pace. But athlete notes capture the qualitative signal that numbers can't:
"left shoulder tight", "ready to go heavier", "form broke down at set 4".

Currently, those notes are stored in the outcome but invisible at decision
time. A user who writes "add 5 lb next time" has to remember to open the
outcome modal to retrieve that note — which most won't do. Surfacing it
automatically turns notes from a filing system into an active coaching tool.

## Expected user value

- Intermediate-to-advanced users who write session notes will see their own
  advice at the moment it's actionable.
- Users who don't write notes see no change.
- No learning curve — the note just appears below the existing hint.

## Implementation scope for this run

- Narrowest viable slice: render `prevSessionOutcome.notes` as one italic
  `<p>` below `lastSessionSummary` in TodayPage.
- Reuse existing `prevSessionOutcome` which is already computed one line above.
- Same visibility guard as `lastSessionSummary` (pending + no double-day).
- Truncate with CSS to prevent layout breakage on long notes.

## Assumptions being made

- Notes are written by the user for themselves and are useful across sessions.
- Truncation at the hint level is acceptable; the full note is accessible via
  "Edit outcome".
- Italic `"…"` framing is a reasonable visual treatment; it's easy to revise.

## Open product / UX decisions

1. **Length threshold**: Should notes longer than N chars be suppressed rather
   than truncated? Could reduce noise for very long self-authored notes.
2. **When both are shown**: If `lastSessionSummary` is null but notes exist,
   should the notes still show? Current implementation: yes (the `||` condition
   handles either/both being truthy).
3. **Label**: No "Last session:" label precedes the notes — they follow the
   summary and are visually distinct via italic. Consider adding a subtle label
   if users find the note's origin ambiguous.

## Architecture or schema impact

None. `prevSessionOutcome?.notes` is `string | null | undefined` on the
existing `WorkoutOutcome` type. No new fields, no new store subscriptions.

## Risks

- Long notes truncated by CSS (`truncate`) may leave users unsure if the note
  is complete. Acceptable since the full note is one tap away.
- If `prevSessionOutcome` changes identity on every render (unlikely given
  memoization via `findPreviousSessionForPlanDay`), there is no extra re-render
  cost beyond the existing computation.

## Rollback strategy

Single-commit change to `TodayPage.tsx`. `git revert 643014e`. No data
migration, no store changes, no downstream effects.

## What is intentionally not being built yet

- Notes displayed for completed state (only shown when pending).
- Notes from extras or double-day sessions (only rotation history entries).
- A "notes history" panel or expandable view.
- Ability to edit the note directly from the hint.

---

# Feature Proposal — Auto-Derive Pace in Run Session Summary
# Feature Proposal — Plan-Scoped Streak (`computePlanStreak`)

Date: 2026-05-12
Branch: `claude/dreamy-mccarthy-OjsGg`
Status: **Implemented this run (logic layer only; UI wiring deferred)**

## Feature Selected

`computePlanStreak(planId, entries, extras, today): number` — a plan-scoped
consecutive-day streak counter exported from `src/lib/historyStats.ts`.

## Why It Was Selected

The current global streak (`computeHistoryStats.currentStreak`) aggregates
across all plans and extra workouts. For a user who finishes one plan and
starts another, the streak count carries over from the previous plan's
history. This produces noise ("30-day streak" when most of those days belong
to a different program).

A plan-scoped streak:
- Gives the user a cleaner signal: "You've been consistent on *this* plan for N days."
- Naturally integrates with the TodayPage stats bar (current streak, 7-day, total).
- Requires no store changes, no schema changes, no UI changes to ship a safe version.

## Expected User Value

Users following a specific training program benefit from seeing how long they
have maintained *that program* without a gap — independent of other workouts
they may log. This is a common feature in dedicated fitness apps (e.g., Strava
challenges, Garmin "streak for this activity type") and maps naturally to the
plan-centric model here.

## Implementation Scope for This Run

- Add `computePlanStreak` to `src/lib/historyStats.ts` — ~20 lines of pure logic.
- Add 12 tests covering: zero entries, today-only, consecutive days, gap breaks,
  day_off counts, skip does not count, extras rescue a skip-only day, multi-plan
  isolation, Set deduplication.
- Export from `historyStats.ts` (no re-export barrel needed).
- **Not wiring into UI this run** — the function exists but is not yet called
  from any component. UI integration is deferred so this pass remains small and
  reviewable.

## Assumptions Being Made

- Same streak semantics as global streak: `complete` or `day_off` entries count;
  `skip` alone does not; extras always count.
- The function does not need to know about the plan's start date (entries before
  plan start should not exist in practice; not guarded).
- A "plan streak" should not cross into another plan's history even if the user
  had back-to-back plans that share a calendar date. Scoping by `planId` is
  sufficient.

## Open Product / UX Decisions

- **Where to surface it:** TodayPage stats bar (replacing or supplementing global
  streak), HistoryPage plan header, or plan cards on PlansPage.
- **Label:** "streak" vs "active streak" vs "plan streak" — all reasonable.
- **Edge case:** if the active plan changes mid-streak, should the old plan's
  streak remain visible? Current impl: each planId has its own independent count.

## Architecture / Schema Impact

None. Pure function, no state, no persistence, no store changes.

## Risks

- Unused export until UI is wired. Not a runtime risk; minor style concern.
- Semantic mismatch with global streak if user sees both at once (one could be
  higher than the other depending on extra workouts for other plans). Acceptable
  — they measure different things.

## Rollback Strategy

`git revert` the feature commit. No migration needed. No data modified.

## What Is Intentionally Not Being Built Yet

- UI component/prop changes
- "Longest streak" all-time record for a plan
- Streak freeze / grace day mechanics
- Integration with the plan expiry or progress indicators

---

# Feature Proposal — Pace Display in Run Session Summary

Date: 2026-05-07
Branch: `claude/dreamy-mccarthy-Q6elc`
Status: **Implemented this run**

## Feature selected

**Include pace in the "Last session" run hint on TodayPage.**

When the previous run outcome includes `averagePaceSecondsPerMile`, append a
formatted pace string (e.g., "9:02 /mi") to the existing hint, producing:
"Last: 3.1 mi · 28 min · 9:02 /mi" instead of "Last: 3.1 mi · 28 min".

## Why it was selected

- `RunWorkoutActual.averagePaceSecondsPerMile` has been captured in `OutcomeModal`
  and persisted since the type was defined, but was never surfaced in the hint.
- Pace is the primary performance metric for most runners (more meaningful than
  distance + duration separately).
- `formatPace` already exists in `workout-outcomes/types.ts` and is now tested.
- Zero new data capture, zero store changes, one guarded `if` statement.
- Bundled with the run distance float-rounding fix (same function, same commit).

## Expected user value

- Runners immediately see "Last: 3.1 mi · 28 min · 9:02 /mi" — all three key
  metrics at a glance without opening any modal.
- Supports the "should I try to go faster today?" decision alongside the
  existing distance/duration context.

## Implementation scope for this run

1. Round `actualDistanceMiles` to 1 decimal in `buildLastSessionSummary` (display bug fix).
2. Import `formatPace` from `../modules/workout-outcomes/types` in `sessionSummary.ts`.
3. Append `formatPace(run.averagePaceSecondsPerMile)` to the run summary parts array
   when the field is non-null.
4. Update tests: add rounding test and pace display test to `sessionSummary.test.ts`.

## Assumptions being made

- Only appended when `averagePaceSecondsPerMile` is explicitly non-null. Deriving
  pace from distance + duration is deferred (product decision).
- String length increase is acceptable; the hint is already a single scrollable line.

## Open product / UX decisions

1. **Auto-derived pace**: if both distance and duration are logged but pace is absent,
   should pace be computed and shown? Deferred — could surprise users if approximate.
2. **Swim pace**: identical pattern exists for `averagePaceSecondsPer100m`. Deferred
   because `/100m` notation is less universally familiar.

## Architecture / schema impact

None. No new fields, no new stores, no schema changes.

## Risks

- Low. If `averagePaceSecondsPerMile` is 0 (user accident), displays "0:00 /mi" — odd
  but harmless. A `> 0` guard is a possible future improvement.

## Rollback strategy

Revert the `sessionSummary.ts` change (2 lines added, 1 modified) and the two new
tests. No data migration required.

## What is intentionally not being built yet

- Auto-derive pace from distance + duration when field is absent
- Swim pace display
- Pace trend comparison (faster/slower than average)
- Target pace vs. actual pace delta

---

# Feature Proposal — 7-Day Activity Strip on TodayPage

Date: 2026-05-06
Branch: `claude/dreamy-mccarthy-9Dgx6`
Status: **Implemented this run**

## Feature selected

Add a row of 7 coloured dots to TodayPage, one per day for the last 7 calendar
days ending today. Each dot indicates that day's activity status at a glance.

## Why it was selected

The TodayPage stats bar shows aggregate totals (streak, 7-day count, lifetime
count) but no structural breakdown of *which* days were active. To see that,
users currently need to navigate to the Calendar page. The activity strip closes
this gap with no additional user action.

This was chosen over other candidates because:
- All required data (`planEntries`, `planExtras`, `today`) is already computed
  in TodayPage — zero new store subscriptions needed.
- The implementation is isolated to a single local component function.
- It directly complements the existing "This week: N done" stat by showing
  the same window day-by-day.

## Expected user value

- Quickly visible: "I've done 5 of the last 7 days — I missed Wednesday and Friday"
- Pattern recognition without Calendar navigation
- Today's dot provides visual confirmation of pending/complete state
- Extras (ad-hoc workouts) are shown in sky blue, distinguishing bonus activity

## Implementation scope for this run

- `WeeklyActivityStrip` component added to `src/pages/TodayPage.tsx` (~51 lines)
- Placed between the stats bar and the unlogged-days nudge
- Rendered unconditionally when a plan is active (same guard as the rest of the page)
- Date arithmetic via `date-fns` (`addDays`, `parseISO`) — already a dependency
- 7 days, oldest left, today right; today's dot has an additional ring

## Assumptions being made

- 7 days is the right window (matches the "This week" rolling window in the stats bar).
- Showing today's dot (even when pending) is useful — gives context for the current state.
- 5 status states are sufficient: complete, day_off, skip, extra-only, empty.
- Day labels as single letters (M, T, W, etc.) are readable at `text-[9px]`.

## Open product / UX decisions

1. Should the strip be hidden on expired plans? Currently shown (data still meaningful).
2. Should the "extra-only" dot (sky) be a different colour or pattern from "complete"?
3. Should the strip show 7 days or the current calendar week (Mon–Sun)?
4. Dot size: `w-2.5 h-2.5` (current) vs. slightly larger for easier reading.

## Architecture or schema impact

None. No new stores, no schema changes, no new utilities exported.

## Risks

- `addDays(parseISO(today), -i)` uses UTC date arithmetic. If the user's local
  timezone is significantly behind UTC, `today` (YYYY-MM-DD) might be "off by
  one" relative to what they see on their device. This is an existing risk shared
  by all date logic in the app and not introduced by this change.
- Visual crowding on very small screens — dots are `w-2.5 h-2.5` which is 10px,
  with 7 items spread across the full width. Should be fine at 320px+ viewports.

## Rollback strategy

Remove the `<WeeklyActivityStrip … />` render call (1 line) and the
`WeeklyActivityStrip` function definition (~51 lines) from `TodayPage.tsx`.
Remove `addDays, parseISO` from the `date-fns` import if no longer needed.
No data migration or store changes required.

## What is intentionally not being built yet

- Click interaction (tapping a dot to open that day's detail in Calendar)
- Tooltip or popover showing the date/action on hover
- Custom date range (currently hardcoded to last 7 days)
- Week-view alignment (Mon–Sun calendar week vs. rolling 7-day window)

---

# Feature Proposal — Session Count Indicator on Today's Workout Card

Date: 2026-05-04
Branch: `claude/dreamy-mccarthy-sA0Ai`
Status: **Implemented this run**

## Feature selected

Show a small "×N done" counter next to the workout title on today's pending `WorkoutDayCard`, indicating how many times that specific rotation day has been previously completed.

## Why it was selected

- Directly adjacent to the existing `lastSessionSummary` hint (already shows "Last: 3×225 Bench Press")
- Users frequently want "have I done this workout before, and how many times?" context before starting
- All data is already available at the TodayPage render level (`planEntries` filtered by `planDayIndex`)
- No new data fetching, no new store subscriptions, no state changes
- Narrowest possible slice: one utility function + one optional prop + one badge

## Expected user value

- Motivation: "I've done this 4 times before" → feeling of progress in a repeating plan
- Orientation: on long plans, quickly know if this is a new workout type or a familiar one
- Zero noise: badge only appears when count > 0 (new plans show nothing)

## Implementation scope for this run

- `countPlanDayCompletions(planId, planDayIndex, entries, excludeDate?)` in `historyStats.ts`
- Optional `sessionCount?: number` prop on `WorkoutDayCard`
- Render: `×N done` as a small `text-slate-500` label in the card header
- Computed in `TodayPage` as `todaySessionCount`, passed only to the pending today card
- 5 unit tests for the new utility function

## Assumptions being made

- "Session" = prior `complete` actions for this `planDayIndex`; skips and day-offs are excluded
- Count excludes today (using `excludeDate = today`) so it reflects only prior sessions
- Only shown on today's pending card, not on upcoming or resolved cards

## Open product / UX decisions

- Should skipped sessions count? Currently no. Could argue either way.
- Should upcoming cards also show session count? Not implemented; easy extension.
- Label copy: "×N done" vs "Session N+1" vs a numeric badge. Using "×N done" (shows historical count, not "you are on session N+1").

## Architecture / schema impact

None. No new fields, no schema changes, no new store subscriptions.

## Risks

- WorkoutDayCard prop interface change — additive (`sessionCount?`), zero risk to existing call sites
- Count is O(n) over `planEntries` — negligible for typical data sizes

## Rollback strategy

Remove `sessionCount` prop from WorkoutDayCard, the `todaySessionCount` line in TodayPage, and `countPlanDayCompletions` + its tests from historyStats. Four-file revert, no data migration.

## What is intentionally not being built yet

- "Session N+1" framing (would require count + 1 and different copy)
- Upcoming card session counts
- Milestone/achievement display ("First time!" / "10th session!")
- Streak-per-workout-day tracking

---

# Feature Proposal — Week Progress Indicator on TodayPage

Date: 2026-04-29
Branch: `claude/dreamy-mccarthy-vrC4L`
Status: **Implemented this run**

---

## Feature selected

Week progress indicator on TodayPage for `weeks`-duration plans — display
"Week X of Y" inline in the plan subtitle, mirroring the rotation cycle
progress added in pass 16.

---

## Why selected

Pass 16 added "3/6 done · last one!" for rotation-duration plans, giving
users a clear "how far through the current cycle" signal. Users on
weeks-duration plans (e.g. a 12-week running program) had no equivalent.
Their subtitle showed only "Day X of N in rotation" with no information
about how far through the overall plan they were.

`computePlanProgress` already exists and is already tested for weeks plans.
This feature is purely a display-side addition — no new store logic, no
schema change. Exactly one import line and ~10 lines of JSX.

---

## Expected user value

- Clear orientation: "I'm in Week 3 of 12 — a quarter through."
- Motivational signal on the last week ("last week!"), matching the
  "last one!" label for rotation plans.
- Symmetry: both plan-duration types now surface progress in the same
  subtitle line, with the same visual treatment.

---

## Implementation scope for this run

1. Import `computePlanProgress` in TodayPage (already imported from the
   same module as `computeHistoryStats`).
2. Compute `weekProgress` inline when `plan.duration.type === 'weeks'`
   (null otherwise — no effect on rotation plans).
3. Display "· Week X of Y" in the subtitle only while the plan is in
   progress (`completed < total`). Suppressed when the plan has expired
   (the expiry banner already handles that state).
4. "last week!" micro-label when `completed + 1 === total` (same emerald
   treatment as the rotation "last one!" label).
5. 4 unit tests added to `historyStats.test.ts` covering the current-week
   computation for the weeks-plan case.

---

## Assumptions made

- `currentWeek = completed + 1` (completed = full weeks elapsed, so the
  user is always IN the next week).
- Display is suppressed when `completed >= total` (expired): the plan-
  completion banner already surfaces that state; doubling up would be
  confusing.
- Display is suppressed at plan start for weeks plans when `completed = 0`?
  No — "Week 1 of 12" is informative from day 1. The difference from
  rotation plans (where "0/6 done" was noise) is that weeks progress
  advances automatically with the calendar, so "Week 1 of 12" is always
  accurate and useful. The rotation "0/N" was noise because no action had
  been taken; the weeks "Week 1 of N" reflects real calendar progress.
- `computePlanProgress` is not re-memoized here (matches cycleProgress
  pattern — direct call, already O(n) in entries length).

---

## Open product / UX decisions

- Should the week indicator also show on the stats bar instead of inline?
  Left as inline for now (matches rotation cycle treatment).
- Should expired plans show "Week 12 of 12 · complete!" rather than nothing?
  Deferred — the expiry banner is the canonical signal for that state.
- Rotation plans now show "Day X of N in rotation · 3/6 done"; weeks plans
  will show "Day X of N in rotation · Week 3 of 12". The subtitle grows
  long on small screens. A future pass could consider collapsing one field.

---

## Architecture / schema impact

None. Read-only use of existing `computePlanProgress` helper.

---

## Risks

- Low. Purely additive UI change on a pre-existing computed value.
- The subtitle line becomes longer on weeks plans (same concern as pass 16
  for rotation plans). On a 320px phone, "Day 6 of 6 in rotation · Week 12
  of 12" may wrap. Should evaluate on a real device.

---

## Rollback strategy

Revert the single TodayPage commit. No store, schema, or engine changes.

---

## What is intentionally not being built yet

- Week X of Y display on PlansPage (progress bar already shown there).
- "N days remaining in this week" countdown.
- Week-based streak counting.

---

# Feature Proposal — Previous-Session Inline Summary (TodayPage)

Date: 2026-04-30
Branch: `claude/dreamy-mccarthy-Ymdp2`
Status: **Implemented this run**

---

## Feature selected

**Compact "Last: …" hint below today's pending workout card.**

When today's workout is pending, show a single line like
`Last: 3×8 @ 135 lb` (weights) or `Last: 2.5 mi · 28 min` (run) directly
below the `WorkoutDayCard` on TodayPage.

---

## Why selected

The current TodayPage already calculates `previousSetsByExercise` and
`previousWeightsOutcome` at render time and passes them only to `OutcomeModal`
and `ActiveWorkoutTracker`. There is no surface where the user can see
"what did I do last time?" without opening the outcome modal or starting a
tracked session.

This causes a concrete friction: a user who wants to know whether to add
weight today must navigate away, open History, find the entry, and return.
The data to answer this question is already in the same render cycle.

Chosen because:
- Zero new data-fetching (reuses `allOutcomes` + `planEntries` already held)
- Purely additive — a single hint line, no new component
- Removes the most common navigation round-trip for strength-plan users

---

## Expected user value

- Immediate visibility of last session's weights / distance before
  deciding to "Start Workout" or "Complete"
- Supports the progressive-overload check without opening any modal
- Most useful for repeating strength plans and structured run programs

---

## Implementation scope for this run

1. Add `findPreviousSessionForPlanDay` pure function in TodayPage — searches
   `planEntries` for the most recent `complete` with
   `planDayIndex === primaryPlanDayIndex`, then looks up that date's outcome.
2. Compute `lastSessionSummary: string | null` from the resolved outcome:
   - Weights: first exercise with actual sets → "3×8 @ 135 lb" format
   - Run: distance + duration → "2.5 mi · 28 min"
   - Swim: distance + duration → "800 m · 30 min"
3. Render a single `text-xs text-slate-500` line below WorkoutDayCard.
   Visible only when: isPending, not doubleDay, lastSessionSummary != null.

---

## Assumptions made

- Most recent `complete` matching `planDayIndex` is the right proxy for
  "last time I did this specific workout". Correct for clean rotation plans;
  may occasionally show wrong session after retroactive history edits.
- One representative exercise (first with actual sets) is sufficient.
  Showing all exercises would overflow the card on small screens.
- Run summary prefers actual distance over distance derived from pace —
  uses `runActual.actualDistanceMiles` if available.

---

## Open product / UX decisions

1. **Per-exercise or first-exercise?** Showing only the first exercise keeps
   the hint concise. Future pass could expand to a scrollable row.
2. **Show when skipped/day_off?** Currently suppressed — showing it would
   require "last time you completed X was …" preamble text.
3. **Label wording**: settled on "Last:" as the shortest clear label.

---

## Architecture / schema impact

None. No new store state. No new props on existing components. String computed
locally in TodayPage.tsx from already-available data.

---

## Risks

- Low — purely additive JSX. No store mutations.
- If primaryPlanDayIndex is stale after retroactive edit, hint may show data
  for the wrong planDay. Same caveat already applies to previousSetsByExercise.

---

## Rollback strategy

Remove the three-line JSX block and the `findPreviousSessionForPlanDay`
function. No data migration. No store changes to revert.

---

## What is intentionally not being built yet

- Per-exercise progress arrows (↑/↓ vs. last time)
- Multi-exercise scrollable row
- "Best ever" vs. "last time" toggle
- Run adaptation target inline (already surfaced via `todayAdaptationNote`)

---

# Feature Proposal — Personal Best (PB) Detection in Session Hint

Date: 2026-05-02
Branch: `claude/dreamy-mccarthy-WJaAU`
Status: **Implemented this run**

---

## Feature selected

Extend the "Last: 3×8 @ 135 lb Bench Press" session hint on TodayPage to
append "· PB" when the displayed load equals the user's all-time max load for
that exercise.

---

## Why selected

The previous-session hint (added in pass 18) shows the most recent completed
load. Users often want to know "was that my best?" to decide whether to push
harder today. The `exerciseHistoryStore` already stores per-set load records
and has been populated since pass 6 — the data for PB detection exists and
was only waiting to be surfaced.

The feature required no schema changes, no new store state, and no new API.
The narrowest slice was: compute `maxLoadByExercise` in TodayPage via a
`useMemo` over the already-present `exerciseHistoryStore.records`, then pass
the map as an optional parameter to `buildLastSessionSummary` (already being
refactored and extracted this pass).

---

## Expected user value

- "Last: 3×8 @ 225 lb Squat · PB" immediately tells the user their last session
  was a personal best, motivating them to attempt the same or higher today.
- "Last: 3×8 @ 185 lb Squat" (no PB marker) signals there's room to build.
- Entirely passive — no additional taps or modals. The hint already rendered;
  this just adds a two-character marker when warranted.

---

## Implementation scope for this run

1. `buildLastSessionSummary` in `src/lib/sessionSummary.ts` accepts an optional
   `maxLoadByExercise?: Record<string, number>` parameter. When the first set's
   `actualLoad` equals the map value for that exercise, " · PB" is appended.

2. In `TodayPage`, one new store subscription:
   `const exerciseRecords = useExerciseHistoryStore(s => s.records)`

3. One new `useMemo` computing `maxLoadByExercise` from `exerciseRecords`.

4. `buildLastSessionSummary(prevSessionOutcome, maxLoadByExercise)` — existing
   call updated to pass the map.

5. Tests for the PB marker in `sessionSummary.test.ts` (3 cases: PB shown, no
   PB below max, no PB when exercise not in map).

---

## Assumptions made

- "Personal best" means the highest `actualLoad` in any completed set across
  all logged sessions for that exercise, including today's records. This is
  intentional: if the user logged a heavier set today and then checks tomorrow,
  they'll see "· PB" on yesterday's entry.
- The comparison is equality (`===`), not `>=`. This means a PB is shown
  precisely when the last session hit the all-time high, not just "close to it."
- Only the first displayed exercise is checked (the existing behaviour — one
  exercise per hint line).
- PB detection applies only to weights outcomes. Run and swim hints are
  unchanged.

---

## Open product / UX decisions

- Should "· PB" be highlighted in a different colour (e.g., amber/gold) rather
  than plain slate text? Deferred — keeping it in the same muted style avoids
  visual noise; can be styled later if users find it hard to notice.
- Should swim/run show a distance PB ("· PB" when best-ever distance)?
  Deferred — run adaptation already handles pace/distance targets; this would
  need a separate distance-max calculation.
- Should PB history be time-bounded (e.g., "PB in the last 6 months") rather
  than all-time? Deferred — all-time is the simplest and most motivating signal.

---

## Architecture / schema impact

None. `exerciseHistoryStore` already persists via `wpt_exercise_history`.
`maxLoadByExercise` is derived in TodayPage as a `useMemo` — no persistence,
no migration, no new localStorage key.

---

## Risks

- `exerciseHistoryStore` is subscribed for the first time in TodayPage (all
  other callers go through `outcomeStore.logOutcomeWithProgression`). The
  subscription is a single `.records` selector, so it only re-renders when the
  records array changes (i.e., after a workout is logged).
- All-time PB comparison includes records from deleted plans (planId stored as
  a snapshot). This is a minor inconsistency but not a bug — the load itself is
  valid exercise data.

---

## Rollback strategy

Remove the three lines in TodayPage (`exerciseRecords`, `maxLoadByExercise`,
parameter in `buildLastSessionSummary` call). Remove the optional parameter
from `buildLastSessionSummary` in `sessionSummary.ts`. No data to migrate.

---

## What is intentionally not being built yet

- Run/swim PB detection
- PB in the active workout tracker (live comparison during a session)
- All-time PR board / personal records page
- Time-bounded PB windows (e.g., "PR in last 90 days")

---

## Pass 33 Feature Proposal — Quick catch-up: batch-mark unlogged days as Day Off

**Date:** 2026-05-19
**Branch:** `claude/dreamy-mccarthy-I8ssV`
**Status:** Implemented

### Problem

The 7-day stall nudge on TodayPage alerts the user when recent days have no
history entry, indicating the rotation pointer may be stalled. Previously, the
only action was to navigate to Calendar, open each unlogged date, and manually
log Day Off — up to 7 individual interactions for a user returning from a
multi-day break.

### Proposed solution

Add a "Mark N as Day Off" button to the stall nudge row. One tap batch-logs a
`day_off` entry for every unlogged date in the 7-day lookback window. The nudge
auto-dismisses after the action because all dates now have entries.

### Implementation scope

**Minimal**:
- `getUnloggedPastDates` (pure function, 15 lines) — returns the actual date
  strings instead of a count, enabling the batch action
- `markDaysAsOff` (store action, 5 lines) — loops over dates, calls `addEntry`
  for each
- TodayPage nudge UI — replace single `<button>` with `<div>` + two child buttons

**No new dependencies.** No new stores. No schema changes.

### User-facing behaviour

Before: Nudge shows "3 days in the past week without entries — rotation may be
stalled" as a single tappable area that navigates to Calendar.

After: Same message, with two actions:
- **Calendar →** (sky) — navigates to Calendar for manual editing
- **Mark 3 as Day Off** (amber) — batch-logs Day Off for all 3 dates, nudge
  disappears immediately

### Risks

- **Destructive if misused**: If the user has actually been working out but
  forgot to log, pressing "Mark as Day Off" would incorrectly set those days as
  day_off rather than complete. However, `addEntry` dedup semantics mean this is
  recoverable — the user can go to Calendar and change the action for any date.
- **No undo**: No explicit undo button. Mitigated by the Calendar path always
  being available for corrections.

### Rollback

Remove `getUnloggedPastDates` from historyStats (keep `countPastUnloggedDays`).
Remove `markDaysAsOff` from historyStore interface and implementation.
Revert TodayPage nudge JSX to original `<button onClick=navigate('/calendar')>`.
No data migration needed — existing history entries are unaffected.

---

## Pass 35 Feature Proposal — Session count on upcoming workout cards

**Date:** 2026-05-21  
**Branch:** `claude/dreamy-mccarthy-w8aCb`  
**Status:** Implemented

### Problem

When TodayPage shows upcoming workout days (the next N days in the rotation), each `WorkoutDayCard` renders without any indication of how many times that workout has been done before. Users who follow repeating rotation plans have no quick visual confirmation that "I've done this one 4 times" before the workout shows up again.

The same gap existed for the today card in an earlier pass (Pass 21) and was closed then — this proposal closes the same gap for upcoming cards.

### Existing infrastructure

- `WorkoutDayCard` already accepts an optional `sessionCount: number` prop. When provided and non-zero, it renders a muted "×N done" badge below the workout name.
- `countPlanDayCompletions(planId, planDayIndex, entries)` already exists in `src/lib/historyStats.ts` and is tested. Returns the number of `complete` entries for the given `(planId, planDayIndex)` pair.
- The today card in `TodayPage` already uses both. The upcoming cards did not.

### Implementation

Added `upcomingSessionCounts` `useMemo` in TodayPage:

```typescript
const upcomingSessionCounts = useMemo(() => {
  if (!plan) return {} as Record<string, number>
  return Object.fromEntries(
    upcoming.map(rd => [
      rd.calendarDate,
      countPlanDayCompletions(plan.id, rd.planDayIndex, planEntries),
    ]),
  )
}, [plan, upcoming, planEntries])
```

Passed `sessionCount={upcomingSessionCounts[rd.calendarDate]}` to each upcoming `WorkoutDayCard`.

### Trade-offs

- **No new dependencies** — pure wiring of existing logic.
- **No new tests needed** — `countPlanDayCompletions` is already tested; the memo is a straight delegation.
- **Visual impact** — badge only appears when count > 0. New plans and single-pass workouts show no badge (no visual noise).
- **Memo complexity** — `upcomingSessionCounts` depends on `[plan, upcoming, planEntries]` — the same deps already used by nearby memos.

### Rollback

Remove `upcomingSessionCounts` memo. Remove `sessionCount={upcomingSessionCounts[rd.calendarDate]}` from the upcoming `WorkoutDayCard` JSX. No data changes.
