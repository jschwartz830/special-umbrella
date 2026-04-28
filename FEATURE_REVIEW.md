# Feature Review — Past Unlogged Days Nudge (TodayPage)

Date: 2026-04-28
Branch: `claude/great-mccarthy-6NVvu`
Classification: **Keep**

---

## What was actually built

1. `countPastUnloggedDays(planId, entries, planStartDate, today, lookbackDays = 7)`
   — pure function in `historyStats.ts`. Iterates backward from yesterday
   for up to `lookbackDays`, skipping days before `planStartDate`. Returns the
   number of days that have no entry for the given plan.

2. `src/pages/TodayPage.tsx` — a clickable info banner rendered below the stats
   bar when `unloggedCount > 0`. Clicking navigates to CalendarPage. Styled as
   a muted slate button (not a warning) to convey "informational, not alarming."

3. 9 unit tests for `countPastUnloggedDays` covering all edge cases from the proposal.

---

## What assumptions were encoded

- A 7-day lookback is sufficient signal without overwhelming users who have been
  away for weeks. The count is capped at 7 (not the total since plan start).
- Any day with ANY history entry (complete, skip, day_off) is "logged" — only
  days with NO entry are counted.
- Not dismissible. The nudge is transient; it disappears as the user logs days.

---

## What worked well

- The pure helper is small (12 lines) and completely isolated from the rotation
  engine. It avoids calling `getResolvedDaysRange` (which would add coupling and
  cost), using a simple set-based lookup instead.
- The tests cover all the nuances (plan start clamping, lookbackDays = 0, cross-
  plan isolation, day_off treated as logged) without being brittle.
- Styling is intentionally muted so it doesn't compete with the expiry banner or
  adaptation note.

---

## What feels risky or incomplete

- **False positives for intentional rest**: A user who took a planned vacation
  week will see "7 days…" every time they open the app until they retroactively
  log all those days. Mildly annoying but not harmful.
- **No dismissibility**: Could become noisy for users who chose not to log past
  workouts (e.g., they know they didn't work out and don't want to log it). A
  follow-up pass could add a per-day "mark all as day off" quick action.
- The nudge shows even when the plan has expired, which is a minor UX edge case.

---

## What to evaluate tomorrow

1. Does the nudge appear correctly when you skip a few days and come back?
2. Does it disappear after logging those days from CalendarPage?
3. Does it feel appropriately subtle or does it compete with other banners?
4. Is 7 days the right window? (Users who check in daily will never see it;
   users who come back after 10 days still see "7" not "10".)

---

## Recommended next steps

- If the false-positive annoyance is reported: add a dismiss with `useExpiryDismiss`-
  style localStorage, auto-clearing when the count drops to 0.
- Consider a "Mark all as day off" quick action in the nudge for users who just
  want to clear the stall without individually logging each day.
- Long-term: show the actual dates in a collapsed list on tap.

---

## Verdict: **Keep**

The feature is small, isolated, and solves a real UX gap (the silent rotation
stall). The nudge is appropriately muted and all tests pass. Recommend keeping
as-is; add dismissibility if user feedback indicates it's annoying.

---

# Feature Review — Compact Stats Bar (TodayPage)

Date: 2026-04-27
Branch: `claude/great-mccarthy-PqhIm`
Classification: **Keep**

## Assessment

The stats bar is purely additive with no state mutations, no new stores, and
no new edge cases. It reuses `computeHistoryStats` which is well-tested.

### Strengths
- Zero new logic — all metrics come from an existing, tested function.
- Scoped correctly (active plan only), consistent with the rest of the page.
- Visually matches the existing dark-slate design language.
- Gracefully handles 0 entries (all tiles show 0).

### Concerns
- None identified. The tile row is narrow enough to fit on small screens
  (three equal-width flex items with minimal padding).

### Verdict

Keep. The feature adds genuine value (ambient streak awareness reduces the need
to navigate to History) with negligible risk.

---

# Feature Review — Workout Type Breakdown Utility

Date: 2026-04-26
Branch: `claude/great-mccarthy-bM0YZ`
Classification: **Keep**

---

## What was actually built

`computeWorkoutTypeBreakdown(entries, extras, outcomes, planDaysById, dateRange?)` in
`src/lib/historyStats.ts` plus 14 unit tests. Returns a `WorkoutTypeBreakdown`
(a `Partial<Record<WorkoutType, WorkoutTypeStat>>`) with completed/skipped counts
and average effort per type.

## What assumptions were encoded

1. Rotation entry type comes from the plan day's first slot. Multi-slot days
   (lifting + run) are attributed to the first slot only.
2. All extras count as "completed" (matching `computeHistoryStats` semantics).
3. Average effort is rounded to 1 decimal place.
4. `day_off` entries are excluded — they have no specific workout type.

## What worked well

- Clean accumulator pattern with two separate maps (counts + effort sums) avoids
  mutable running-average complexity.
- `planDaysById = null` gracefully skips all rotation entries, making the function
  usable for extras-only queries.
- The dateRange filter is composable — callers can pre-filter or pass a window.
- 14 tests cover all branches and edge cases cleanly.

## What feels risky or incomplete

- **No UI integration**: The function exists but nothing renders it. A developer
  must wire it into HistoryPage to get user-visible value.
- **Multi-slot attribution**: First-slot-only attribution is a documented assumption
  but may surprise users on days with a lift + run pair.
- **planDaysById construction**: The caller must build the Map from the active plan's
  `days` array. This is simple but not obvious. A convenience wrapper that accepts
  a `Plan` directly would improve DX.

## What I should evaluate tomorrow

1. Is the first-slot attribution for multi-slot days acceptable, or should we count
   both slot types?
2. Does the HistoryPage stats section feel like the right place to expose per-type
   breakdown, or is this better as a standalone analytics screen?
3. Should the function also accept a full `Plan` type (instead of the `planDaysById`
   Map) for simpler callsites?

## Recommended next steps

- Wire into HistoryPage stats section as a collapsible "by type" table below the
  existing 4-tile summary.
- Consider adding a `computeWorkoutTypeBreakdownForPlan(plan, entries, extras, outcomes)`
  convenience wrapper.

## Classification: **Keep**

The function is pure, tested, and ready to use. It fills a real gap in the stats
module. No UI integration needed before merging — the developer can choose if/how
to surface it.

---

# Feature Review — Plan Progress Computation

Date: 2026-04-25
Branch: `claude/great-mccarthy-0XEfh`
Classification: **Keep**

## What was actually built

- `computePlanProgress(plan, entries, today)` added to `src/lib/historyStats.ts`.
  Returns `{ completed, total, percentComplete }` for both `rotations` and `weeks`
  duration types.
- `PlanProgress` interface exported from the same file.
- 15 new tests added to `src/lib/__tests__/historyStats.test.ts`.

## What assumptions were encoded

- **Weeks-type**: progress is purely calendar-based (floor of elapsed days / 7),
  capped at `total`. History entries are ignored — consistent with how
  `isPlanExpired` works for `weeks` plans.
- **Rotations-type**: only `complete` and `skip` entries count (mirrors
  `isPlanExpired`). `day_off` entries are excluded. Cross-plan entries are
  filtered by `plan.id`.
- **Rounding**: percentComplete is `Math.round`, capped at 100. This means
  1 of 8 weeks = 13% (not 12.5%).
- **Pre-startDate**: returns 0 completed (no negative progress).

## What worked well

- The formula for both duration types is simple, consistent with existing
  `isPlanExpired` logic, and fully tested.
- Pure function — zero side effects, no store coupling, easy to test.
- The `dateDiffDays` helper avoids `date-fns` dependency for a simple
  subtraction, consistent with the pattern used in `historyStats.shiftDay`.

## What feels risky or incomplete

- **No UI yet**: the function is useful but invisible to the user without
  a PlansPage or TodayPage change. Intentional for this run.
- **Partial-week feedback**: a user on day 6 of week 1 sees 0 completed weeks.
  This might feel misleading. A `daysFraction` or `inProgress` field could
  supplement without changing the core semantics.

## What you should evaluate tomorrow

1. Does PlansPage want to show progress inline on each plan card?
2. Should `percentComplete` be displayed as a progress bar or just text?
3. Is the weeks formula (purely calendar-based, ignoring entries) intuitive?
   A case can be made that if you logged 20 workouts in 3 weeks, you should
   see "3 weeks" not "0 weeks," but the current approach is simpler and matches
   `isPlanExpired`.

## Recommended next steps

- Wire `computePlanProgress` into PlansPage to show "2 / 4 rotations" or
  "Week 5 of 8" on each plan card. This is a read-only display change.
- Consider a lightweight progress bar component (Tailwind `w-full bg-gray-200`
  with an inner `bg-blue-500` div) for PlansPage.

## Keep / revise / prototype only / reject

**Keep** — the function is correct, fully tested, and creates no coupling.
It is a prerequisite for any progress display. The only follow-up needed is
UI wiring, which should be a separate commit.

---

# Feature Review — Dismissible Plan Expiry Banner

Date: 2026-04-24
Branch: `claude/great-mccarthy-hYhLK`
Classification: **Keep**

## What was actually built

- `src/hooks/useExpiryDismiss.ts` — a 35-line hook that reads/writes a
  per-plan localStorage key (`wpt_expiry_dismissed_v1_<planId>`). Exports
  `{ isDismissed, dismiss }`. Catches localStorage exceptions so missing
  or blocked storage degrades gracefully (banner stays visible).
- TodayPage updated: reads `{ isDismissed: expiryBannerDismissed, dismiss:
  dismissExpiryBanner }` from the hook. The banner is hidden when
  `isDismissed` is true. A small `×` button (aria-labeled "Dismiss")
  triggers `dismissExpiryBanner`. No store changes.
- 6 storage-contract tests in `src/hooks/__tests__/useExpiryDismiss.test.ts`.

## Assumptions Encoded

1. Per-plan dismissal is the right granularity — new plans start fresh
   automatically because they have a different planId.
2. Dismissed once means dismissed permanently (no TTL, no re-surface).
3. localStorage failure → banner remains visible (fail-open, not fail-closed).

## What Worked Well

- Extremely narrow scope: one new file, five changed lines in TodayPage.
- Zero coupling to any store or engine logic.
- Per-plan isolation falls out naturally from the key design — no explicit
  "reset on plan change" logic needed.

## What Feels Risky or Incomplete

- No way to un-dismiss from the UI. The only escape hatch is clearing
  localStorage (`wpt_expiry_dismissed_v1_<planId>`). This is acceptable
  for now but might frustrate a power user who accidentally dismisses.
- The banner disappears immediately on click with no animation or
  confirmation. Fine given the stakes (can always see via Plans page), but
  the snap-to-hidden may feel abrupt on slow devices.

## What I Should Evaluate Tomorrow

1. Does the dismiss feel intentional, or does the × feel too easy to
   accidentally tap on mobile?
2. Should the Plans page show a "Completed" badge for expired plans
   (already done) AND note when the expiry banner was dismissed?
3. Is there a future need to re-surface the banner after a plan is
   re-activated or cycled? If so, the current hook would need a `reset()`
   path (one extra localStorage.removeItem call).

## Recommended Next Steps

- Ship as-is; the friction reduction is real and the implementation is
  minimal.
- If users report accidental dismissal, add a "Show again" option to the
  Plans page or a brief undo toast.
- Consider the `dismiss()` + optional TTL variant only if the "permanent
  dismiss" assumption proves wrong.

## Classification

**Keep.** The narrowest viable slice works — one hook, one banner change,
six tests. No architectural decisions encoded. Fully reversible with one
commit revert.

---

# Feature Review — ExtraWorkoutEntry.source Field

Date: 2026-04-18
Feature commit: `d865ff9`
Classification: **Keep with one open tweak decision**

## What was actually built

An optional `source?: 'history' | 'double_day'` field on
`ExtraWorkoutEntry`. Three call sites updated:
- TodayPage double-day bonus → `'double_day'`
- HistoryPage "Add workout for this day" → `'history'`
- CalendarPage "Add workout for this day" → `'history'`

Undo on TodayPage now filters: removes extras where
`source !== 'history'` (i.e., double_day and old records without a
source). Extras tagged `'history'` survive Undo.

## What assumptions were encoded

- Old `ExtraWorkoutEntry` records in localStorage have `source ===
  undefined`. The filter `source !== 'history'` treats them as
  double_day — they are removed on Undo.
- If you want old records to survive Undo, change the filter to
  `source === 'double_day'` in `TodayPage.tsx:~333`.

## What worked well

- The type change is genuinely backward-compatible — undefined is
  handled explicitly, TypeScript is happy, no migration.
- The three creation paths are all small and easy to verify.
- The Undo filter is a single line and the intent is documented in
  the code comment above it.
- 6 store-level tests lock the invariant.

## What feels risky or incomplete

- **Old-record treatment**: Treating undefined as double_day is
  conservative but could surprise a user who had manually-added extras
  before upgrading. This is pre-existing behavior (prior to this commit,
  Undo cleared ALL extras), so it is not a regression — but it's worth
  a conscious product decision.
- **No History badge**: The `source` field now exists but History still
  shows the generic "Extra" pill for all extras. Double-day extras could
  show "Via double-day" to help users understand their history. This
  is intentionally out of scope for this commit; it's a one-line JSX
  change when desired.

## What I should evaluate

1. Do you want old extras (source undefined) treated as double_day
   (current: removed on Undo) or history (left alone on Undo)?
2. Do you want a badge in History for `source === 'double_day'` extras?

## Recommended next steps

- Decide on the undefined treatment (see above) — if you want to
  change it, the fix is one character: `!== 'history'` → `=== 'double_day'`.
- Optionally add a "Via double-day" badge in HistoryPage's extra entry
  render block (`kind === 'extra'` branch, around line 492).

## Classification

**Keep** — the schema change is minimal, additive, and backward-
compatible. The Undo behavior is strictly better than before. The one
open question (undefined treatment) is a product preference, not a
correctness issue.

## Rollback

`git revert d865ff9`. Old records are unchanged; the only effect
is that Undo on Today reverts to clearing all extras for the date
(prior behavior).

---

# Feature Review — History Stats Summary

Date: 2026-04-17
Feature commit: `724ca92`

## What to try

1. Open HistoryPage with a plan that has several recent entries.
2. Verify the 4 tiles appear above the list.
3. Change the plan filter dropdown — stats should update to match the
   filtered subset.
4. Delete today's entry (via Undo on Today, or via the History modal).
   The Streak tile should decrement or go to 0; the 7-day / 30-day /
   Total tiles should decrement by 1 if today was a `complete`.

## Review checklist

- [ ] Tiles render with consistent widths on mobile.
- [ ] Stats hide when the filtered list is empty (no "0 / 0 / 0 / 0"
      row shown on a fresh empty history).
- [ ] Streak feels right. Edit a past entry from complete → skip and
      verify the streak breaks at that date.
- [ ] 7-day / 30-day windows count today. A workout logged today is
      included, not excluded.

## Known edge cases (all tested)

- Day before today's date in the entry list but no today entry →
  streak is 0 (today must qualify).
- Skip on an intermediate day → streak resets at that day.
- Gap day → streak resets at that day.
- Empty entry list → all zeros.

## Risk assessment

None identified. The helper is pure, fully tested, and has no
persisted state. Zero coupling to rotation or progression logic. Build
passes.

## Suggested tweaks reviewers might want

- **Streak definition**: if you'd rather count "complete only" (skip or
  day_off break), edit the `streakable` filter in
  `src/lib/historyStats.ts`.
- **Tile labels**: change `Streak / 7-day / 30-day / Total` in
  `HistoryPage.tsx`.
- **Hide when there's only one or two entries**: change the render
  guard from `sorted.length > 0` to e.g. `sorted.length >= 3`.

## Rollback

`git revert 724ca92`. No migration required.
