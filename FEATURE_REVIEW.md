# Feature Reviews

## Pass 59 — 2026-06-17 (branch `claude/dreamy-mccarthy-b5jqs3`)

### Classification: **Keep**

### What was actually built

A single exported function `findBestWeek(planId, entries, extras)` added at the end of `src/lib/historyStats.ts`. It:
1. Filters entries and extras to the given plan.
2. Short-circuits with `null` if there is no data.
3. Computes the full date range (earliest to latest calendar date across both sets).
4. Calls `computeWeeklyBreakdown` to get per-ISO-week stats.
5. Reduces to the single best week by `completed + extras`.

No new files, no component changes, no store changes, no new dependencies.

### What assumptions were encoded

- **Score = completed + extras**: Treats a voluntary extra workout as equally valuable to a plan completion for "best week" purposes. An alternative (extras weighted differently) could be parameterized later.
- **Tie-breaking = earliest week**: If two weeks have the same score, the earlier one wins. This is deterministic and encourages "when did I first peak?" semantics over "most recent peak."
- **Skips and day-offs excluded from score**: They represent missed or planned-rest sessions, not training volume. If a user wants "most days with any logged action," that is a different query.

### What worked well

- `computeWeeklyBreakdown` already handles all the date/ISO-week math, so `findBestWeek` is 15 lines of pure reduction logic.
- 11 test scenarios cover the full decision surface: null, isolation, single-week, multi-week selection, extras influence, tie-breaking, skip/day-off exclusion, extras-only, cross-month, cross-year.

### What is still missing / limitations

- No UI consumer yet — the function is exported but not wired to any component. The PR leaves this for the next pass or a targeted UI change.
- Does not support "best week by duration/load/distance" for run or swim plans — only count-based scoring. A future extension could accept a scoring callback.

---

## Pass 56 — 2026-06-13 (branch `claude/dreamy-mccarthy-qvt8m6`)

### Classification: **Keep**

### What was actually built

A thin horizontal progress bar (`h-1`, sky-500/50 fill) placed between the WeeklyActivityStrip and the unlogged-days nudge on TodayPage. It shows `computeLoggedRate`'s result as both a visual bar and an `"X% logged"` text label. The bar is hidden when the plan has no past days (`computeLoggedRate` returns null).

One `computeLoggedRate` import was added to TodayPage. No new functions, no store changes, no new files.

### What assumptions were encoded

- Showing the bar from day 1 (as soon as there is one past day) is acceptable. A 1-day-old plan at 100% is technically correct even if trivially so.
- 100% logged is worth showing (positive reinforcement).
- The bar doesn't need to be interactive or link anywhere.

### What worked well

The implementation was trivially small because `computeLoggedRate` already existed, was already tested (11 tests), and the HistoryPage version established the UI pattern. Total new lines in TodayPage: ~20.

### What feels risky or incomplete

- For a plan active only 1–3 days, the rate is volatile (one missed day → 0% or 50%); could feel like noise.
- No explicit visual hierarchy: the bar sits between the strip and the stall nudge; a user who missed days sees both the bar at a low % AND the nudge. These are complementary but may feel redundant.

### What to evaluate tomorrow

- Does the bar show for a plan active only 1 day? (Yes — `computeLoggedRate` returns 100 or 0 the moment there's 1 past day.)
- Does the bar disappear correctly for plans started today? (Yes — `computeLoggedRate` returns null.)
- Does 100% look good / motivating, or does it just add clutter?

### Recommended next steps

1. Consider adding a ≥7 days threshold before the bar appears, so it only shows meaningful data.
2. Consider linking the `"X% logged"` text to HistoryPage (filtered to the active plan) for users who want to see the breakdown.

### Keep / revise / prototype only / reject

**Keep** — low-risk addition that provides daily logging-consistency feedback using an already-tested function and an established UI pattern from HistoryPage.

---

## Pass 54 — 2026-06-11 (branch `claude/dreamy-mccarthy-q8dj7t`)

### Classification: **Keep**

### What was actually built

`computeLoggedRate(planId, entries, planStartDate, today): number | null` in `src/lib/historyStats.ts` — a pure function that counts unique `calendarDate` values in the half-open interval `[planStartDate, today)` for a given plan, returning an integer 0–100 or `null` for newly-started plans.

A `loggedRate` useMemo in `HistoryPage.tsx` that calls `computeLoggedRate` and returns `null` when viewing "all plans".

A UI block in the stats section: a 1px-high sky-500 progress bar at `width: ${loggedRate}%` plus a `"{N}% logged"` label in slate-500. Hidden entirely when `loggedRate` is `null`.

### Quality assessment

| Criterion | Assessment |
|-----------|------------|
| Correctness | Pure function; 11 tests verify all boundary cases |
| Performance | O(n) filter+map over history entries; memoised in UI |
| Accessibility | Progress bar is visual-only; no ARIA role. Acceptable for a supplementary stat |
| Consistency | Matches existing stats-section visual style (small label, muted colour) |
| Scope discipline | Zero new dependencies; three files touched |

### Concerns / known gaps

- **No ARIA progressbar role** — the `<div>` acting as a progress bar has no `role="progressbar"` or `aria-valuenow`. Low priority for a decorative stat, but noted for a future a11y pass.
- **"% logged" semantics** — the stat counts any logged action (complete, skip, day_off) as "logged". A user who marks every day as day_off gets 100%. This is intentional (the stat measures whether the rotation engine has data, not workout quality), but the label doesn't communicate this nuance.

### Verdict

The feature is correct, contained, and fills a real observability gap. The concerns above are minor. No rollback recommended.

---

## Pass 52 — 2026-06-07 (branch `claude/dreamy-mccarthy-j725m`)

### Classification: **Keep**

### What was actually built

A `personalRecordsToCsv` function in `src/lib/csv.ts` that takes a `PersonalRecord[]` and returns a valid RFC-4180 CSV string. An "Export CSV" button in the `PersonalRecordsSection` component header in `HistoryPage.tsx` that calls `downloadCsv('personal-records.csv', personalRecordsToCsv(records))`.

**CSV format:**
```
exercise,maxLoad_lb,maxLoadDate,maxReps,maxRepsDate,sessionCount
Squat,225,2026-05-15,8,2026-04-20,12
Bench Press,185,2026-06-01,5,2026-05-10,8
```

**Header restructure:** `PersonalRecordsSection` header changed from a single full-width `<button>` (expand/collapse only) to a `<div>` containing:
1. Left: `<button>` for expand/collapse (text + chevron)
2. Right: a `<div>` with optional Export CSV button + chevron button

### What assumptions were encoded

1. Export-only is sufficient for v1 (no round-trip import path)
2. The exported file has no plan-context column — acceptable for a single-plan user; edge case for multi-plan users
3. "Export CSV" label is clear without an icon
4. Hiding the button when `records.length === 0` avoids a confusing empty-file download

### What worked well

- Zero-cost integration: `downloadCsv` was already imported in HistoryPage
- Consistent with the existing export pattern in the history CSV (`CsvToolbar`)
- `personalRecordsToCsv` is a pure function — easy to test and easy to extend
- Null-field handling (empty cell for null load/reps) uses the same `encodeCsv` primitive already in use for swim/run actuals

### What feels risky or incomplete

- **Export-only**: no import path. If a user clears `exerciseHistoryStore` (or switches devices), the exported CSV cannot restore PRs. This is a known limitation of v1.
- **No plan column**: for users with multiple plans, the exported file has no way to indicate which plan's PRs are included. The `PersonalRecordsSection` already receives pre-filtered records for the selected plan, so the data is plan-scoped — it just isn't labeled as such in the CSV.
- **Header DOM restructure**: changing from one button to two changes tab-order and click-target behavior. The chevron button is now small (14px icon only); on mobile the tap target may feel smaller than before. Could be addressed by giving the chevron button more padding if user feedback indicates difficulty.

### Verdict

**Keep** — the feature is correct, minimal, and consistent with existing patterns. The two incomplete items (no import, no plan column) are known gaps that could be addressed in a future pass if needed. Neither is a regression; both are out-of-scope for a v1 export.

---

## Pass 50 — 2026-06-05 (branch `claude/dreamy-mccarthy-UIayl`)

### Classification: **Keep with revisions**

### What was actually built

A `ProgramVarsPanel` React component in `TodayPage.tsx` that renders a collapsible
panel showing the current values of YAML progression variables. It is:
- Gated on `Object.keys(planProgramVars).length > 0` (never shown for non-YAML plans)
- Gated on `isPending` (only shown before today's workout is logged)
- Collapsed by default, expandable on tap
- Rendered as a compact two-column grid: `variable_name → value`
- Non-integer values formatted to remove trailing zeros (`3.50` → `3.5`)

### What assumptions were encoded

1. YAML plan users understand their variable names as-is (no formatting applied)
2. Collapsed-by-default is the right UX default
3. Showing only current values (not deltas) is sufficient for an initial implementation
4. The panel is most useful before logging (pending state) rather than after

### What worked well

- Zero-cost integration: `planProgramVars` was already computed in TodayPage
- Clean component isolation: `ProgramVarsPanel` is self-contained with its own local state
- The condition gates are correct and efficient
- Value formatting (trailing zero removal) looks clean for common cases like `3.5` miles

### What feels risky or incomplete

- **No tests**: purely presentational, but if logic is added later (e.g., editing vars),
  tests would need to be added at that point
- **Collapsed by default**: power users with many variables might prefer it open; the
  default is an untested assumption
- **No delta indication**: users can't tell if a variable just progressed or has been
  the same for weeks
- **No variable editing**: the natural next step users might expect after seeing the
  panel is being able to edit values — that's not supported and there's no affordance
  indicating "read-only"

### What I should evaluate tomorrow

1. Open the app with a YAML plan active — does the panel appear where expected?
2. Tap to expand — does it render all variables cleanly at different screen widths?
3. Does the collapsed-by-default feel right, or do you keep needing to tap to open it?
4. Are there variables you want to see that aren't shown (e.g., notes, units)?

### Recommended next steps

1. **If you use the panel regularly**: add `localStorage` persistence for the
   expanded/collapsed state so it remembers your preference per plan
2. **If the names are confusing**: add underscore-to-space formatting (`easy_miles` → `Easy miles`)
3. **If you want deltas**: store `prevVars` snapshot before logging; compare after
4. **If you want editing**: add an edit mode with number inputs and validation

### Keep / revise / prototype only / reject recommendation

**Keep with revisions.** The core feature is sound and fills a real gap. The UI
assumption (collapsed by default) and missing delta display are worth revisiting
once you've used it for a few sessions.

---

## Pass 49 — 2026-06-04 (branch `claude/dreamy-mccarthy-WovqU`)

### Classification: **Keep**

### What was actually built

A `rotationProgress` constant computed from `computePlanProgress(plan, planEntries, today)` (the now-corrected version that excludes future entries). When `plan.duration.type === 'rotations'` and `plan.duration.value > 1` and the plan is not expired, the header subtext gains a "Rotation 2 of 4" span. The last rotation also renders "· last rotation!".

### What assumptions were encoded

- `computePlanProgress` returns `completed` = number of full rotations finished; `completed + 1` = current rotation number
- Plans with only 1 rotation defined don't need this indicator
- The display is suppressed when the plan is expired (banner takes precedence)

### What worked well

- No new utility functions, no new state — pure read of existing data
- The fix to `computePlanProgress` (this same pass) ensures the rotation number is accurate
- Clean parity with the weeks-plan "Week X of Y" pattern already in the codebase

### What feels risky or incomplete

- Header subtext line can grow long when multiple indicators are shown simultaneously (e.g., cycle progress + rotation number + "left to finish"). Tested mentally but not via automated visual regression.
- The "last rotation!" text could overlap with existing "last one!" (for the last workout in a cycle) on the same render if the user is on the last workout of the last rotation. Both appear on the same subtext line but refer to different things.

### What I should evaluate tomorrow

- Does the header subtext ever exceed one line on a narrow screen (320px viewport)?
- Is "Rotation 4 of 4 · last rotation! · last one!" overly busy for the final workout of the final rotation?

### Recommended next steps

- Manual visual check on a narrow viewport to verify line wrapping
- Consider whether "last one!" (within-cycle) should be suppressed when "last rotation!" (overall) is already shown

### Keep / revise / prototype only / reject recommendation

**Keep** — the feature is additive, uses correct data, has a clear rollback path, and closes a genuine information gap.

---

## Pass 47 — 2026-06-01 (branch `claude/dreamy-mccarthy-iQpbb`)

### Classification: **Keep**

### What was actually built

`computeConsecutiveSkips(planId, entries, extras, today)` in `src/lib/historyStats.ts`.

```typescript
export function computeConsecutiveSkips(
  planId: string,
  entries: HistoryEntry[],
  extras: ExtraWorkoutEntry[],
  today: string,
): number
```

- Builds `skipDates` (dates with `action === 'skip'` for the plan) and `breakDates` (dates with any non-skip action, or any extra for the plan).
- Starts at `shiftDay(today, -1)` and walks backwards one day at a time.
- Increments `count` while cursor is in `skipDates` and not in `breakDates`. Stops at first gap or break.
- Returns the consecutive skip count; 0 means "no current skip streak."

### What assumptions were encoded

- **Today excluded:** The user might still log today. Starting from yesterday is correct and conservative.
- **Gap = stop:** If a date has no entry at all, the streak resets. This prevents false "streaks" spanning unlogged periods.
- **Extras break the streak:** Completing any extra workout for the plan counts as "not just skipping." The user is still engaged.
- **Different-plan extras don't break the streak:** Activity on another plan is irrelevant to this plan's skip streak.
- **day_off breaks the streak:** A day off is not a skip — it's an intentional rest.

### What worked well

- The two-pass Set approach (collect all skip/break dates, then walk back) is O(n) and simple to reason about.
- Reuses `shiftDay` already present in the module — no new imports needed.
- 15 test cases cover every semantic edge case. Test coverage is higher here than for some older functions in the same file.

### What feels risky or incomplete

- The function is not wired to any UI. It is useful but invisible until a component calls it.
- The streak semantics (gaps break it) mean that a user who logs "day off" then "skip" repeatedly won't accumulate a streak. Whether "day off" should be transparent to the skip streak is a product question — the current choice (day off breaks the streak) is conservative and favors the user.

### Suggested next step

Wire `computeConsecutiveSkips` into TodayPage's stats bar or a banner above the action buttons: "You've skipped the last N workouts." Only show when `N >= 2`. This is a 20-line UI change, appropriate for a future overnight pass once the product direction is confirmed.

---

## Pass 45 — 2026-05-30 (branch `claude/dreamy-mccarthy-mxssu`)

### Classification: **Keep**

### What was actually built

`src/hooks/useToday.ts` — a React hook that returns today's date as a `YYYY-MM-DD` string and automatically advances it at midnight. Implementation:

- `useState` initialised from `format(new Date(), 'yyyy-MM-dd')`.
- `useEffect` computes milliseconds until the next midnight (`setHours(24, 0, 0, 0)`) and sets a `setTimeout` to call `setToday(format(new Date(), ...))` when it fires.
- The `[today]` dependency causes the effect to re-run after each midnight, re-scheduling for the next one. Cleanup returns `clearTimeout` so no timer leak occurs on unmount.

`src/pages/TodayPage.tsx` — replaced `const today = format(new Date(), 'yyyy-MM-dd')` with `const today = useToday()` and added the import. One line changed in the 1,130-line file.

### What assumptions were encoded

- `setHours(24, 0, 0, 0)` correctly resolves to the next midnight in the device's local time. This is standard JS behavior for `Date` objects.
- The `[today]` re-arm is sufficient; no additional interval needed.
- TodayPage is the highest-priority surface. CalendarPage and HistoryPage use their own inline `today` values; deferred.

### What worked well

- The implementation is tiny and self-contained. The pattern (timeout to next event + [state] dependency to re-arm) is idiomatic for React and requires no external library.
- Integrating into TodayPage was a one-line change — the hook's return type matches the existing string usage exactly.
- The cleanup function prevents timer leaks if TodayPage unmounts mid-day.

### What feels risky or incomplete

- No unit tests. Testing requires `vi.useFakeTimers()`, which is straightforward but was not added in this pass to keep the change minimal. If the hook logic is changed in future, a test should be written then.
- CalendarPage and HistoryPage still have the same staleness issue. A user who navigates to Calendar at 12:01 AM would see yesterday's date until they reload.

### What I should evaluate tomorrow

- Open TodayPage at 11:59 PM on a device and confirm the date updates at midnight without a page reload.
- Confirm that navigating away from TodayPage and back still shows the correct date (new mount recomputes the initial state).
- Check that the hook doesn't cause any visible re-render glitch at midnight (the `today` state change will trigger a re-render of TodayPage; all downstream computations should update atomically).

### Recommended next steps

1. Wire `useToday()` into CalendarPage and HistoryPage (one-line change each).
2. Add a Vitest test using `vi.useFakeTimers()` to verify the hook advances the date at midnight.
3. If a test environment that mocks timers is already set up elsewhere (e.g., `useExpiryDismiss.test.ts`), check if the same pattern applies.

### Keep / revise / prototype only / reject recommendation

**Keep** — The hook is minimal, correct, and solves a real UX problem for PWA users with no observable downside on the happy path.

---

## Pass 43 — 2026-05-29 (branch `claude/dreamy-mccarthy-4tAQK`)

### Classification: **Keep**

### What was actually built

A `migrateHistoryState(persisted, fromVersion)` function in `src/store/historyStore.ts`
that runs when Zustand loads the persisted `wpt_history` state and the stored version is
less than 1 (i.e., any user who hasn't run the migration yet). The migration sets
`source: 'history'` on all extras with `source === undefined`.

The function is exported for direct unit testing and called from the persist config via
`migrate: migrateHistoryState`.

### What assumptions were encoded

- Pre-existing extras (those with `source: undefined`) were created manually by the user
  via Calendar or History — not generated by the double-day flow. This holds because the
  double-day flow and the `source` field were introduced simultaneously; no double-day
  extras could have been created without a source value.
- The migration must be idempotent: running it twice produces the same result as running
  it once. `undefined` → `'history'` satisfies this.
- Data shapes that are partially corrupt (missing `extraEntries`, null, etc.) are handled
  by the `?? []` fallback.

### What worked well

- Extract-and-test approach: exporting `migrateHistoryState` as a named function made it
  trivially unit-testable without needing a real localStorage or Zustand integration.
- The 6 tests cover all meaningful branches including the "skip migration at v1+" path,
  which prevents false-positive migration on already-versioned stores.

### What feels risky or incomplete

- The migration cannot retroactively detect double-day extras that somehow ended up with
  `source: undefined` (theoretically impossible given the timeline, but not provably so
  from the data alone). Setting such extras to `'history'` means they survive Undo — this
  is the less-bad failure mode.
- Once deployed, a rollback of the code would leave users with `source: 'history'` on
  all their old extras permanently. This is the intended final state so it is not
  a problem.

### What I should evaluate tomorrow

- Verify that Undo no longer removes old manually-added extras. Can be tested by logging
  a workout, then clicking Undo, and checking that any extras added before this deploy
  are still present.
- If any extras unexpectedly disappear after this deploy, check the migration function's
  `fromVersion` check — ensure `fromVersion < 1` correctly captures all existing stores.

### Recommended next steps

- None required. The migration is self-contained. Future extras will always have an
  explicit `source` value (set in `addExtraEntry` → `source` is required in the payload).

### Keep / revise / prototype only / reject recommendation

**Keep** — the change is protective, backward compatible, well-tested, and closes a
documented data-safety gap without any user-visible behavior change on the happy path.

---

## Pass 42 — 2026-05-28 (branch `claude/dreamy-mccarthy-HtWcw`)

No medium-complexity feature was attempted this pass. See FEATURE_PROPOSAL.md for rationale.

---

## Pass 40 — Feature Review — Swim Actuals in History CSV

Date: 2026-05-26
Branch: `claude/dreamy-mccarthy-8Sa0s`
Classification: **Keep**

## What was actually built

Four new columns appended to `HISTORY_HEADERS` in `src/lib/csv.ts`:
`swimActualDistanceMeters`, `swimActualDurationMin`, `swimAveragePaceSecondsPer100m`,
`swimCompletedAsPlanned`. Both the rotation and extra row builders in `historyToCsv`
now read `outcome?.swimActual` and emit these fields. `buildOutcomeFromRow` reconstructs
`outcome.swimActual` from these columns when at least one is non-empty.

## What assumptions were encoded

- Column-based parsing in `parseCsvToRecords` ensures backward compatibility — old exports
  without swim columns yield `row.swimActualDistanceMeters === undefined`, which `toNum`
  returns `undefined` for, keeping `swimActual` unset on import.
- `completedAsPlanned` for run and `swimCompletedAsPlanned` for swim are kept separate to
  avoid ambiguity. There's currently no workout type that is both run and swim, but the
  separation makes each row unambiguous regardless of `workoutType`.
- An outcome with only `swimActual` (no `runActual`) imported from the new CSV will not
  spuriously set `runActual` — the run-actual block only fires when run columns are present.

## Confidence

High. The change is entirely within the CSV serialization layer, with no store or engine
changes. The pattern mirrors exactly the existing run-actual export/import. Three tests
cover the full round-trip for both rotation entries, extra entries, and the empty-column
(backward compat) case. All 748 tests pass.

## Open questions

- Should `averagePaceSecondsPer100m` be derived on import if distance and duration are
  both present but pace is absent? Currently not derived — the import is faithful to what
  was exported. Derivation could be added later without breaking anything.
- Should the CSV header order be documented in a comment? It's implicit in the
  `HISTORY_HEADERS` array, which is the source of truth.

---

# Feature Review — progressionRecommendation.note on TodayPage

Date: 2026-05-24
Branch: `claude/dreamy-mccarthy-oaS1e`
Classification: **Keep**

## What was actually built

A `↗ [note]` line in the pending-workout hint block on TodayPage. Rendered when
`!todayRunSlot && prevSessionOutcome?.progressionRecommendation?.note` is truthy.
Uses `text-sky-700` and `truncate` to match the hint block's existing style patterns.
The outer condition (`||`) was extended so the hint block shows even when
`lastSessionSummary` and `prevSessionOutcome.notes` are both null but a progression
note exists.

## What assumptions were encoded

- `progressionRecommendation.note` is always a user-readable string — no formatting
  is applied here.
- `!todayRunSlot` (first run-type slot in today's resolved plan day) is the right
  discriminator for suppressing the hint on run days. A pure weights day has
  `todayRunSlot = null`, which passes the guard.
- `prevSessionOutcome` is already null-checked via the existing visibility conditions
  (`isPending` → computed only when today is pending).

## What worked well

- Zero new computation — reuses `prevSessionOutcome` (already computed), `todayRunSlot`
  (already computed).
- The guard is tight: three independent conditions must all be true simultaneously
  (no run slot + pending + previous outcome has a note).
- Visually distinct from `lastSessionSummary` (slate-500) and `prevSessionOutcome.notes`
  (slate-600 italic). Sky-700 is used for action-oriented text elsewhere in the app.

## What feels risky or incomplete

- The sky-700 color may stand out more than intended if most users don't have
  progression recommendations generated yet (only YAML-imported plans with `slotProgress`
  rules produce them). Consider switching to `text-slate-400` if it feels too prominent.
- Per-exercise progression notes are not shown — only the slot-level note. If a user
  has an outcome where progression fired on exercise 2 but not exercise 1, only the
  slot-level note appears (which reflects overall session progress, not per-exercise).

## What I should evaluate tomorrow

- Manually trigger a `progressionRecommendation.note` by completing a YAML-imported
  weights session and verifying the note appears on the next pending occurrence of
  that plan day.
- Verify the note does NOT appear on a run day, even if the previous run outcome
  carries a `progressionRecommendation.note`.

## Recommended next steps

- Evaluate the color choice after seeing it in context. If sky-700 is too bold, dial
  back to `text-slate-400` for a subtler hint treatment.
- Consider adding a `TrendingUp` icon (already imported in TodayPage for other uses)
  instead of the `↗` text character for visual consistency with the icon set.

## Keep / revise / prototype only / reject

**Keep** — minimal implementation, zero new computation, correctly gated by
existing state. The feature surfaces data that was already computed and stored but
never visible at the moment users need it most.

---

# Feature Review — Gap Weeks in Weekly Activity Panel

Date: 2026-05-20
Branch: `claude/dreamy-mccarthy-zGJFa`
Classification: **Keep**

## What was actually built

`padWeekGaps(weeks)` — a pure utility in `historyStats.ts` that fills ISO-week holes
between the first and last active week with zero-count placeholder rows (`isEmpty: true`).
The HistoryPage `weeklyBreakdown` useMemo now calls `padWeekGaps` before reversing the
result, and `WeeklyActivitySection` renders gap rows with muted grey styling, "No activity"
text in the context column, and a "—" in the count column.

## What assumptions were encoded

- Only gaps between existing active weeks are filled (not before first or after last).
- `padWeekGaps` requires ≥ 2 active weeks to do anything; a single active week returns unchanged.
- The `isEmpty?: boolean` field is optional so existing callers of `WeeklyBreakdown` are unaffected.

## What worked well

- Pure function with no side effects — easy to test and reason about.
- Five tests cover all edge cases (empty, single, consecutive, single gap, multi-gap).
- The visual treatment (muted text + "—" count) is immediately legible without needing a legend.

## What feels risky or incomplete

- A user with 7 empty weeks and 1 active week gets only 1 row (correct, by design). But
  if the user expects to see all 8 rows including the 7 empty ones, they'd be confused.
  Consider clarifying the panel header: "Recent weeks with activity" vs. "Last 8 weeks".
- The gap rows are always shown (no cap). If a user had a 6-week break, 6 grey rows appear.
  This is honest but may feel heavy. A collapse-gaps button or "N weeks with no activity"
  summary row could be friendlier.

## What I should evaluate tomorrow

- Visually check the Weekly Activity section on a real device for a user who has
  a multi-week gap. Is the grey row density acceptable?
- Confirm that the section header "Recent Weeks" remains accurate when gap weeks are shown.

## Recommended next steps

- Consider changing "Recent Weeks" to "Last 8 Weeks" to set correct expectations.
- If gap density becomes a complaint, add an option to collapse consecutive empty rows
  into a single "N weeks: no activity" summary row.

## Keep / revise / prototype only / reject

**Keep** — the change is small, well-tested, and makes the panel more honest. The visual
treatment is clear. The gap-filling only adds rows between existing activity; it cannot
suppress or alter existing data.

---

# Feature Review — Weekly Activity Panel in HistoryPage

Date: 2026-05-18
Branch: `claude/dreamy-mccarthy-THUP4`
Classification: **Keep**

## What was actually built

A collapsible "Recent Weeks" section in HistoryPage that surfaces the last 8 weeks of
workout activity for the currently selected plan. Each row shows the week date range
(Mon–Sun), skips/day-offs/extras context, and the completed count highlighted in green.
Hidden when "All plans" is selected in the filter.

## What assumptions were encoded

- Newest-first order (matches the existing workout list convention).
- 8 weeks back from today (hardcoded to `addDays(new Date(), -55)`).
- Expanded by default (`useState(true)`).
- Per-plan only — no cross-plan aggregation.

## What worked well

- Re-using the existing `computeWeeklyBreakdown` function meant zero new logic to write
  or test. The UI change is a pure consumer of pre-validated data.
- The 3-column grid (date | context | count) scales well with varying amounts of context.
- The collapsible pattern matches `PersonalRecordsSection` — consistent UX.

## What feels risky or incomplete

- **No component test** — the `WeeklyActivitySection` component renders JSX that is not
  covered by any test. The underlying data is tested; the rendering path is not.
- **Default expanded** — on a plan with many active weeks, the section could be tall and
  push content below the fold. Monitor for feedback.
- **"All plans" gap** — users who never select a specific plan won't see the panel.

## What you should evaluate tomorrow

1. Does the panel placement (between Personal Records and the workout list) feel right?
2. Is "expanded by default" the right behavior, or does it add visual noise?
3. Are there users who have more than 8 weeks of history and would benefit from a longer
   or configurable range?

## Recommended next steps

- If the panel placement is confirmed, consider adding a brief component smoke test.
- If "All plans" weekly aggregation is desired, extend `computeWeeklyBreakdown` (or write
  a new function) that takes all entries/extras and groups by week without planId filtering.

## Keep / revise / prototype only / reject

**Keep** — the panel is useful immediately, is additive, and has no risk of data loss or
behavioral regression. The only product question is the default-expanded state.

---

# Feature Review — Weekly Workout Breakdown Utility

Date: 2026-05-17
Branch: `claude/dreamy-mccarthy-UaphK`
Classification: **Keep**

## What was actually built

`computeWeeklyBreakdown(planId, entries, extras, fromDate, toDate): WeeklyBreakdown[]` in `src/lib/historyStats.ts`, with a private `isoWeekStart(date)` helper. The function groups rotation history entries and extra workout entries into ISO weeks (Mon–Sun), counting completed/skipped/dayOffs/extras/totalLogged per week. Weeks with no activity are not returned.

15 tests added to `src/lib/__tests__/historyStats.test.ts`.

## What assumptions were encoded

- ISO Monday start for weeks. This is consistent with the ISO 8601 standard but differs from the CalendarPage's Sunday-start visual grid.
- Weeks with zero activity are omitted — not padded with empty `WeeklyBreakdown` objects.
- The function does not internally compute a "current week" indicator; callers compare `weekStart` to today themselves.

## What worked well

- Clean, small implementation (27 lines of logic + helper).
- Reuses the private `shiftDay` utility already in the file.
- 15 tests cover all edge cases: Sunday-assignment, range clamping, cross-plan isolation, mixed action types, extras, multi-week sorting.
- No coupling to stores, React, or UI layer.

## What feels risky or incomplete

- **Monday vs. Sunday** — the week-start choice is not surfaced to the caller. If HistoryPage renders a Sunday-aligned chart, dates will visually misalign unless `isoWeekStart` is adapted.
- **No UI yet** — the function is production-ready but not wired anywhere. It will not appear in the app until a follow-up PR adds a UI component.

## What I should evaluate tomorrow

- Does the weekly breakdown make sense for plans with sporadic logging? (Unlogged days are invisible to the function — they're simply absent entries.)
- Should "this week" be highlighted differently from past weeks in the future UI?

## Recommended next steps

1. Wire into HistoryPage as a collapsible "Weekly breakdown" section below the per-type chart.
2. Decide on Sunday vs. Monday week start based on CalendarPage grid alignment.
3. Consider adding a `computeWeeklyBreakdown` variant that fills empty weeks with zero-counts for charting purposes.

## Keep / revise / prototype only / reject

**Keep.** The function is clean, fully tested, and ready to use. The UI wiring is straightforward next-pass work. No changes needed to the implementation before shipping.

---

# Feature Review — Rotation Plan Remaining Counter

Date: 2026-05-15
Branch: `claude/dreamy-mccarthy-rtcbO`
Classification: **Keep with revisions (threshold tuning welcome)**

## What was actually built

- `computeRotationPlanRemaining(plan, entries): number | null` in `src/lib/historyStats.ts`
  — pure function, 8 lines
- 11 unit tests in `src/lib/__tests__/historyStats.test.ts`
- TodayPage header: "· N left to finish" conditional rendered when
  `rotationPlanRemaining !== null && rotationPlanRemaining > 0 && rotationPlanRemaining <=
  plan.days.length && !planExpired`

## What assumptions were encoded

- "Final rotation" threshold (`remaining ≤ plan.days.length`) is approximately right for
  typical plans. This means for a 3-day rotation the label shows when ≤ 3 workouts remain.
- Day_off entries do not count toward plan completion (consistent with `isPlanExpired`).
- Label is suppressed when the plan is expired (remaining === 0 implies expiry).

## What worked well

- Zero store changes, zero schema changes.
- The function reuses the same filtering rule as `isPlanExpired` and
  `computeRotationCycleProgress`, making behavior consistent.
- The visibility threshold cleanly separates motivation context (near the end) from noise.
- All 11 tests pass and cover the important edge cases.

## What feels risky or incomplete

- The visibility threshold is a product judgment call. Users with short 2-day rotations
  will see "1 left to finish" (fine), but users with 7-day rotations will see the label
  for the entire 7-workout final cycle — which might be longer than feels "near the end."
- No display for weeks plans. A "N days left" equivalent for weeks plans could be
  motivated by the same UX goal but is out of scope for this run.

## What I should evaluate tomorrow

1. Does the visibility threshold feel right in your actual plans?
2. Does it appear at the right moment in your rotation cycle, or should the threshold
   be adjusted?

## Recommended next steps

- If 1 rotation remaining feels too early for your long plans: change the condition to
  `rotationPlanRemaining <= Math.ceil(plan.days.length / 2)` (half a rotation) or `=== 1`
  (only the last workout).
- Consider a similar "N days left" label for weeks-based plans using
  `differenceInCalendarDays`.

## Keep / revise / prototype only / reject

**Keep with revisions** — the utility function and tests are clearly keep-quality. The
visibility threshold in TodayPage is the one tunable parameter and should be adjusted
to taste.

---

# Feature Review — All-Time Best Streak (`longestStreak`)

Date: 2026-05-14
Branch: `claude/dreamy-mccarthy-nJAOH`
Classification: **Keep**

## What was actually built

`computeHistoryStats` now returns `longestStreak: number` alongside `currentStreak`.
The value is computed by sorting the `streakable` Set's dates and finding the longest
consecutive run using `dateDiffDays` between adjacent elements.

TodayPage's streak tile shows `"Best: N"` below the current count only when
`longestStreak > currentStreak`.

## Review verdict: Keep

**Correctness**: The algorithm is straightforward and well-tested. The four new tests cover:
parity with current streak, a historical run longer than the current one, the empty-set
edge case, and a mixed entries/extras run. The zero-shape snapshot test was updated.

**No regressions**: All 644 tests pass. TypeScript is clean.

**UI impact**: The sub-label is hidden when the user is on their personal-best streak
(no redundancy). When below best, it provides useful motivational context. The visual
footprint is minimal (one extra muted line inside the existing tile).

**Interface contract**: `HistoryStats` is a read-only computed type with no persistence.
Adding `longestStreak` is non-breaking for callers that destructure only the fields they
need. The TypeScript compiler flags any call site that does a full `.toEqual()` shape
comparison (exactly one test was updated accordingly).

## What to watch

- `computeHistoryStats` is called on every render via `useActivePlan`. The sort is
  O(n log n) over the `streakable` Set; with typical history sizes this is fast. If history
  grows into tens of thousands of entries (unlikely for a personal tracker), consider
  memoizing via a selector.

---

# Feature Review — Swim Pace Derivation in Session Summary Hint

Date: 2026-05-13
Branch: `claude/dreamy-mccarthy-JEVCy`
Classification: **Keep**

## What was actually built

When `buildLastSessionSummary` formats a swim workout outcome, it now derives
the pace from distance + duration when `averagePaceSecondsPer100m` is null or
0. The derived value is formatted with `formatSwimPace` and appended as
`"· 2:30 /100m"` (same format as a stored pace).

## What assumptions were encoded

1. `stored pace = 0` is always a data entry error, not a meaningful value. The
   implementation falls through to derivation in this case, consistent with
   the run block.
2. Pace is only derivable when **both** `actualDistanceMeters > 0` and
   `actualDurationMin > 0` are available. A half-complete record (distance
   only, duration only) produces no pace — correct behaviour.
3. `formatSwimPace` handles rounding correctly (it calls `formatPace` under
   the hood, which has a tested rounding guard preventing "x:60" display).

## Correctness assessment

The derivation formula `(durationMin × 60) / (distanceMeters / 100)` is
mathematically correct and consistent with `deriveSwimPaceSecondsPer100m` in
`workout-outcomes/types.ts`.

The stored-beats-derived priority is enforced by `storedSwimPace ?? derivedSwimPace`,
which is only non-null when stored > 0. The test "prefers stored swim pace over
derived when both are available" verifies this.

## Risk assessment

**Low risk.** The change is additive:
- Outcomes without pace previously showed no pace → no regression possible for those.
- Outcomes with a valid stored pace are unaffected (stored always wins).
- Outcomes with stored pace = 0 now derive; previously they showed nothing. This
  is strictly an improvement.
- `formatSwimPace` is already tested with edge cases in `types.test.ts`.
- 7 tests in `sessionSummary.test.ts` guard all branches of the new logic.

## Open questions

None. The feature is complete and consistent with the run equivalent.

---

# Feature Review — Previous Session Notes in TodayPage Hint

Date: 2026-05-13
Branch: `claude/dreamy-mccarthy-G6yaB`
Classification: **Keep** (with optional visual tweak)

## What was actually built

A second hint line below the "Last: …" summary on TodayPage, visible when:
- The workout is pending (not yet logged today)
- Double-day mode is off
- `prevSessionOutcome?.notes` is a non-empty string

The notes appear in italic with `"..."` framing and are truncated at screen
width. Both the summary and notes share a wrapping `<div className="space-y-0.5">`.

## What assumptions were encoded

1. Notes from the previous session are useful context before the next session
   of the same plan day.
2. Truncation at hint level is acceptable; the full note is in the outcome modal.
3. The italic `"..."` visual treatment clearly signals "quoted prior note".
4. Showing notes even when `lastSessionSummary` is null (e.g., yoga session
   with no metrics but a written note) is correct behavior.

## What worked well

- Zero new state, zero new data fetching, zero new store subscriptions.
  `prevSessionOutcome` was already computed immediately above the hint.
- The wrapping `<div>` approach cleanly handles all four combinations:
  summary only, notes only, both, neither.
- The feature degrades gracefully: users who don't write notes see no change.

## What feels risky or incomplete

- **Not browser-tested**: This is a JSX change in a CLI-only environment.
  The layout in the actual PWA should be visually confirmed, especially on
  narrow screens where truncation matters most.
- **Style decision**: The italic `"..."` framing is an aesthetic call. You
  may prefer a different treatment (e.g., a faint left border, a "📝" prefix,
  or no special framing).
- **No length threshold**: A 300-character note will be shown and truncated.
  Consider suppressing notes longer than ~100 chars or adding a "..." indicator
  at truncation.

## What I should evaluate tomorrow

1. Open TodayPage with a workout that has prior session notes. Verify the
   italic note line renders below the "Last:" summary cleanly.
2. Check narrow-viewport behavior (iPhone SE 375px width).
3. Decide whether the `"..."` framing or a plain italic line is preferred.
4. If notes are usually short: keep as-is. If they tend to be long: add a
   character limit or max-width clamp.

## Recommended next steps

- Visual QA in the actual app.
- Optionally add a character-length threshold to suppress very long notes.
- If the style feels off, one-line tweak to the italic `<p>` className.

## Keep / revise / prototype only / reject

**Keep** — the feature is additive, uses existing data, and solves a real
friction point. The main open question is visual polish, not logic.

---

# Feature Review — Auto-Derive Pace in Run Session Summary
# Feature Review — Plan-Scoped Streak (`computePlanStreak`)

Date: 2026-05-12
Branch: `claude/dreamy-mccarthy-OjsGg`
Classification: **Keep — wire UI in next pass**

## What Was Actually Built

A single exported function `computePlanStreak(planId, entries, extras, today)` in
`src/lib/historyStats.ts`. It counts consecutive days ending at `today` (inclusive)
where the given plan has a qualifying entry: `complete` or `day_off` rotation entry,
or any extra workout for that planId. Returns `0` when today has no qualifying entry.

12 unit tests covering the full behavioural surface.

## Assumptions Encoded

- Same streak semantics as the existing global streak (skip alone = streak breaker).
- No plan-start-date guard: if entries before the plan's `startDate` somehow exist,
  they would count toward the streak. In practice this cannot happen through the UI.
- Extra workouts for a plan count regardless of their `source` field (`double_day` vs
  `history`). Both represent real workout activity.

## What Worked Well

- The implementation is essentially `computeHistoryStats.currentStreak` with a
  `planId` filter on the Set population loop. ~20 lines total.
- 12 tests pass with zero friction; the test patterns reuse helpers from adjacent
  describe blocks.
- Zero state, zero schema, zero UI risk. The function is inert until called.

## What Feels Risky or Incomplete

- **Not wired into UI yet** — the function is exported but never called. An unused
  export is harmless but clutters the public API until wired.
- **Semantic gap vs global streak** — if a user sees both stats side by side, the
  plan streak could be lower than the global streak (if they have extras for other
  plans). This needs clear labelling in whatever UI uses it.

## What I Should Evaluate Tomorrow

1. Does the TodayPage stats bar have room for a plan-streak label alongside the
   existing "streak" count, or should it replace it?
2. Should the label be "plan streak" or just "streak" (implicit since TodayPage
   already shows the active plan)?
3. Is the HistoryPage per-plan summary a better home for this stat?

## Recommended Next Steps

- Wire `computePlanStreak` into TodayPage stats bar for the active plan (`plan?.id`).
- Import it alongside `computeHistoryStats` in `TodayPage.tsx` — no new store
  subscriptions required since `planEntries` and `planExtras` are already in scope.
- Add a `data-testid` attribute on the streak element for future E2E testing.

## Keep / Revise / Prototype Only / Reject

**Keep** — the logic is correct, the tests are solid, and the function fits naturally
into the existing stats API. Wire it in next pass.

---

# Feature Review — Pace Display in Run Session Summary

Date: 2026-05-07
Branch: `claude/dreamy-mccarthy-Q6elc`
Classification: **Keep**

## What was actually built

Modified `buildLastSessionSummary` in `src/lib/sessionSummary.ts` to:
1. Round `actualDistanceMiles` to 1 decimal before display (display bug fix).
2. Append a formatted pace string ("· 9:02 /mi") when `RunWorkoutActual.averagePaceSecondsPerMile`
   is non-null, using the existing `formatPace` utility.

5 new tests in `sessionSummary.test.ts` cover: rounding, pace present, pace null,
pace-only display.

## Assumptions encoded

- Pace is only shown when `averagePaceSecondsPerMile` is explicitly stored (non-null).
  Deriving from distance + duration was explicitly excluded.
- The `·`-delimited format extension is consistent with the existing style ("3.1 mi · 28 min").
- `formatPace` from `workout-outcomes/types.ts` is the canonical pace formatter.

## What worked well

- One import, 3 lines of logic, 5 tests. The feature delivered its intended value
  with minimal surface area.
- Bundling the float-rounding bug fix was natural since both changes affect the
  same run display path.
- Existing `formatPace` utility handled all formatting edge cases (padding, rounding,
  9:60 prevention) — no new formatting code needed.

## What feels risky or incomplete

- `averagePaceSecondsPerMile = 0` displays "0:00 /mi". This is technically correct
  (0 is a valid stored value if the user accidentally leaves the field at default)
  but looks wrong in the UI. A `> 0` guard would prevent it.
- Swim pace (`averagePaceSecondsPer100m`) follows the exact same pattern but was
  not added this pass. The omission is intentional (one feature at a time) but
  creates asymmetry.
- Cannot verify the live UI rendering without running the dev server.

## What I should evaluate tomorrow

- Open TodayPage with a run plan that has a previously logged run outcome with pace.
  Verify "9:02 /mi" appears correctly after the distance + duration.
- Check the hint wraps cleanly on a narrow screen (320px) when all three components
  are present.
- Verify that `averagePaceSecondsPerMile` is populated correctly by `OutcomeModal`
  when pace is manually entered.

## Recommended next steps

1. Add a `> 0` guard on pace display (optional, low priority).
2. Extend the same pattern to swim: `averagePaceSecondsPer100m` → `formatSwimPace`.
3. Consider auto-deriving pace from distance + duration when pace is absent:
   `derivePaceSecondsPerMile(actualDistanceMiles, actualDurationMin)` — but mark
   it as "computed" (e.g., italic or different color) vs. explicitly recorded.

## Keep / revise / prototype only / reject

**Keep.** Low risk, clearly correct, well tested, useful to runners.
The only open question is the `> 0` guard, which is a minor defensive addition.

---

# Feature Review — 7-Day Activity Strip on TodayPage

Date: 2026-05-06
Branch: `claude/dreamy-mccarthy-9Dgx6`
Classification: **Keep**

## What was actually built

A `WeeklyActivityStrip` component local to `TodayPage.tsx` that renders a row
of 7 coloured dots (plus single-letter day labels) between the stats bar and
the unlogged-days nudge. The last 7 days ending today are shown left-to-right.
Dot colours: emerald (complete), amber (day_off), slate ring (skip), sky (extra),
subtle ring (empty). Today's dot has a sky ring offset.

## What assumptions were encoded

- `planEntries` for this plan includes all 7 days of interest (it does — it
  filters all history entries for the active plan, not just recent ones).
- `planExtras` similarly includes all extras regardless of age.
- A date string of the form `YYYY-MM-DD + 'T00:00'` parses correctly as a local
  midnight timestamp for day-letter computation — this is a common app-wide pattern
  (same as CalendarPage and other places).
- 7 days is the right lookahead to match the "This week" stat (also 7-day rolling).

## What worked well

- Zero new store subscriptions — the data was already in scope.
- The component is fully isolated: a single self-contained function that can be
  moved, tweaked, or deleted without touching any shared infrastructure.
- The `useMemo` keying prevents unnecessary re-computation on unrelated re-renders.
- TypeScript is clean — the `ActivityFill` union type makes the dot color logic
  explicit and exhaustive.

## What feels risky or incomplete

- **No click interaction** — tapping a dot does nothing. Users may expect to
  navigate to that day's Calendar detail. This is intentional scope limitation
  but could feel unresponsive.
- **No unit tests** — the component is view-only and uses no shared logic, but
  a snapshot or integration test would make future refactors safer. Adding
  React Testing Library is a one-time infrastructure cost not attempted here.
- **Day letters may repeat** — "T" appears for both Tuesday and Thursday,
  "S" for Saturday and Sunday. For 7 consecutive days this is usually readable
  in context, but could be ambiguous for users with irregular schedules.

## What I should evaluate tomorrow

1. Does the strip feel useful on actual device? Check with a plan that has a
   mix of complete/skip/day_off/extras to confirm the colour contrast is clear.
2. Is the vertical rhythm between stats bar and strip appropriate, or does it
   feel cramped?
3. Does the "extra-only" sky dot read as "bonus activity" or as "something else"?

## Recommended next steps

1. **Keep as-is** — the feature is low-risk and provides genuine value.
2. Optional: add tap interaction to open Calendar on the selected date.
3. Optional: replace single-letter labels with day-of-month numbers (`21`, `22`...)
   for dates that are not today — more information-dense.
4. Optional: consider showing a small "pending" indicator for today's dot
   specifically (currently today with no entry shows the same as any empty day,
   just with the sky ring).

## Keep / revise / prototype only / reject

**Keep** — the feature is contained, useful, and risk-free to ship. The open
UX questions are aesthetic tweaks, not blockers.

---

# Feature Review — Session Count Indicator on Today's Workout Card

Date: 2026-05-04
Branch: `claude/dreamy-mccarthy-sA0Ai`
Classification: **Keep**

## What was actually built

A `countPlanDayCompletions()` utility function and an optional `sessionCount` prop on `WorkoutDayCard` that renders a small "×N done" label next to the workout title. Passed from TodayPage only when the workout is pending and a prior completion exists.

## What assumptions were encoded

- `complete` action = "done"; `skip` and `day_off` don't count toward session history
- Count excludes today (shows prior sessions only, not counting the one about to happen)
- Label style: `text-slate-500 font-medium` — subdued, not attention-grabbing

## What worked well

- Zero impact on existing WorkoutDayCard usages (prop is optional)
- `countPlanDayCompletions` is a pure, well-tested utility
- The badge integrates naturally with the existing card header layout alongside the "Today" badge

## What feels risky or incomplete

- The label only appears on the pending today card. If users want it on upcoming cards, it requires passing `planEntries` + computing counts there — slightly more work
- "×N done" copy might be confusing ("done" vs "completions" vs "sessions") — worth a quick UX check
- No visual distinction between "first time ever" (no badge) and "done once before" (×1 done)

## What I should evaluate tomorrow

- Does the badge feel crowded on small screens when both "Today" and "×N done" are shown? Both are `text-xs` in the header flex row with `truncate`, so overflow is handled, but worth checking.
- Do you want to extend it to upcoming cards?

## Recommended next steps

1. Check on a narrow viewport (375px) that "Today" + "×N done" don't collide with the workout label
2. Consider whether "×N done" should also appear in double-day mode for the bonus card
3. If keeping: extend to upcoming cards (5-line change in TodayPage upcoming loop)

## Classification

**Keep** — functional, minimal, no breaking changes, easy to extend or revert.

---

# Feature Review — Week Progress Indicator on TodayPage

Date: 2026-04-29
Branch: `claude/dreamy-mccarthy-vrC4L`
Classification: **Keep (review subtitle length on small screens)**

---

## What was actually built

1. `computePlanProgress` imported into `TodayPage` (was already used in
   PlansPage and historyStats — no new helper needed).

2. `weekProgress` — computed inline when `plan.duration.type === 'weeks'`,
   null otherwise. Uses `computePlanProgress(plan, planEntries, today)`.

3. **Subtitle display** in `src/pages/TodayPage.tsx`:
   - Shows nothing for rotation plans (weekProgress is null).
   - Shows "· Week X of Y" while the plan is in progress (`completed < total`).
   - "last week!" micro-label when `completed + 1 === total`.
   - Suppressed once the plan expires; the expiry banner handles that state.

4. **4 unit tests** in `historyStats.test.ts` documenting the boundary
   conditions the UI relies on.

---

## What assumptions were encoded

- `currentWeek = completed + 1` where `completed` = full 7-day periods elapsed.
  "Week 1 of 12" shows from day 0 through day 6 — intentional and accurate.
- `completed < total` guards suppress the display once expired.
- `computePlanProgress` is not re-memoized in TodayPage (consistent with
  `cycleProgress` which is also a direct call).
- "last week!" uses emerald text matching the rotation "last one!" label.

---

## What worked well

- Zero new pure functions — the feature fell entirely out of existing tested
  infrastructure. The entire change is 1 import + 5 computed lines + 10 JSX
  lines.
- Test strategy focused on documenting the specific boundary conditions the UI
  relies on rather than re-testing `computePlanProgress` in bulk.
- Symmetric with the pass-16 rotation cycle display; the UI pattern is
  consistent across both plan types.

---

## What feels risky or incomplete

- **Subtitle length**: "Day 6 of 6 in rotation · Week 12 of 12 · last week!"
  is long. On a 320px-wide device this may wrap. Same concern was flagged for
  the pass-16 rotation display, but has not been evaluated on a real device.
- The two signals (rotation position + week number) are both in the same `<p>`.
  A future pass could separate them: one for plan position, one for plan
  progress.

---

## What I should evaluate tomorrow

1. Open TodayPage on a physical device with a weeks-duration plan mid-progress.
   Does "Day 4 of 6 in rotation · Week 3 of 12" fit on one line or wrap?
2. Does "Week 1 of 12" on day 1 feel informative, or is it surprising? The
   rotation variant hides "0/6 done" at start (bug fixed this pass), but weeks
   shows "Week 1" immediately since it reflects real calendar progress.

---

## Recommended next steps

- Evaluate on a narrow-screen device; if wrapping is an issue, extract into a
  separate `<p>` row or consider a progress pill component.
- If well-received, consider whether PlansPage should also show "Week 3 of 12"
  alongside its progress bar (currently shows a percentage and bar only).

---

## Keep / revise / prototype / reject

**Keep** — the display is additive, reverting has zero data impact, the logic
is correct, and the value for weeks-plan users is clear. Revisit subtitle
layout if wrapping is observed on device.

---

# Feature Review — Rotation Cycle Progress on TodayPage

Date: 2026-04-29
Branch: `claude/great-mccarthy-TJqjV`
Classification: **Keep (review UX placement)**

---

## What was actually built

1. `computeRotationCycleProgress(plan, entries)` — pure function in
   `historyStats.ts`. Filters plan entries by `planId` and
   `action ∈ {complete, skip}`, computes `totalDone % rotationLength` for
   `doneInCycle`, derives `remaining` and `justCompletedRotation`. Returns
   `null` for `weeks`-duration plans or plans with no days.

2. `src/pages/TodayPage.tsx` — imports the helper and displays cycle progress
   inline with the "Day X of N in rotation" subtitle:
   - Normal state: `· 3/6 done`
   - Last workout in cycle: `· 5/6 done · last one!` (emerald text)
   - Just completed a rotation: `· rotation complete!` (emerald text)
   - Returns nothing for `weeks` plans or when `cycleProgress` is `null`.

3. 8 unit tests in `historyStats.test.ts` covering the helper's branches.

---

## What assumptions were encoded

- `day_off` entries don't advance the cycle counter (mirrors `isPlanExpired`).
- `weeks` plans return `null` and see no change on TodayPage.
- "just completed" means `doneInCycle === 0 && totalDone > 0` — detected at
  the moment before the next workout is logged.

---

## What worked well

- Pure helper is easy to test and reason about independently.
- Inline placement in the subtitle keeps the UI change minimal.
- The "last one!" micro-label adds a lightweight motivational moment.
- 8 tests cover all branching paths including multi-cycle wrapping.

---

## What feels risky or incomplete

- The "rotation complete!" text persists until the user logs the next
  workout. There is no timer or dismiss — it may feel like a stale state
  depending on how long between rotations.
- The inline subtitle becomes quite long on small screens:
  "Day 6 of 6 in rotation · 5/6 done · last one!" — could wrap awkwardly.
- `weeks` plans have no equivalent motivational signal.

---

## What I should evaluate tomorrow

1. Open TodayPage on a real device with a rotations plan mid-cycle — does the
   inline text fit comfortably or does it wrap?
2. Complete a full rotation and observe the "rotation complete!" state. Does it
   feel rewarding or like a confusing no-op pending state?
3. Is "last one!" the right phrase, or is "· 1 left" more clear?

---

## Recommended next steps

- If the inline placement feels cramped, move `doneInCycle / rotationLength`
  to the stats bar as a fourth tile ("Cycle: 3/6").
- If the "rotation complete!" state feels off, add a guard:
  show it only on the same day as the completing workout, then suppress.
- For `weeks` plans, consider a "week X of Y" indicator using `computePlanProgress`.

---

## Keep / revise / prototype only / reject

**Keep with optional revision**: the logic is solid and the user value is clear.
The main question is display placement (inline vs. stat tile). Either approach
is a small change. Recommend keeping as-is and evaluating on a real device
before moving it.

---

# Feature Review — Previous-Session Inline Summary (TodayPage)

Date: 2026-04-30
Branch: `claude/dreamy-mccarthy-Ymdp2`
Classification: **Keep — evaluate wording on device**

---

## What was actually built

1. `findPreviousSessionForPlanDay(planId, planDayIndex, currentDate, entries, outcomes)`
   — pure function in `TodayPage.tsx`. Filters `planEntries` for `complete`
   entries matching the exact `planDayIndex`, sorts by descending date, then
   returns the first outcome found.

2. `buildLastSessionSummary(outcome)` — pure function in `TodayPage.tsx`.
   Formats the outcome into a compact string:
   - Weights: `"Last: 3×8 @ 135 lb Bench Press"` (first exercise with data)
   - Run: `"Last: 3.1 mi · 29 min"`
   - Swim: `"Last: 800 m · 20 min"`
   - Other/no data: returns `null`

3. **Render hint** in `src/pages/TodayPage.tsx`:
   - One `<p className="text-xs text-slate-500 -mt-2 ml-1">` line.
   - Visible only when `isPending` and `lastSessionSummary` is non-null.
   - Suppressed in double-day mode to avoid layout clutter.
   - Placed directly after the `WorkoutDayCard` section.

---

## What assumptions were encoded

- Matching by `planDayIndex` is the right "same workout" signal for rotation
  plans. Works well for clean rotation histories; less reliable after
  retroactive edits that change planDayIndex values.
- The first exercise with any actual data is representative. Users with
  multi-exercise plans may want to see more, but one line keeps it readable.
- `isPending` guard means the hint disappears once today is logged (correct —
  once you've done the workout, the hint is no longer needed).
- Run summary uses `actualDistanceMiles` over `targetDistance` to show real
  performance, not planned target.

---

## What worked well

- Zero new store state or props. Everything derived from already-rendered data.
- `findPreviousSessionForPlanDay` is a clean, testable pure function.
- The `-mt-2` spacing pulls the hint visually close to the card without
  competing with the action buttons below.
- TypeScript clean, no new type definitions needed.

---

## What feels risky or incomplete

- **planDayIndex stability**: the planDayIndex that was logged on a past date
  is not always the same as the "canonical" day for that position today
  (overrides, jumps, retroactive edits can shift indices). This is an existing
  concern for `previousSetsByExercise` too — not introduced here.
- **Exercise name truncation**: long exercise names (e.g., "Romanian Deadlift")
  will overflow on narrow screens without CSS truncation. The `<p>` has no
  `truncate` class currently.
- **Single exercise**: users with 4+ exercises logged per session may find
  "Last: 3×8 @ 135 lb Bench Press" incomplete. Future iteration could show
  "Last: 3 exercises" or a scrollable row.
- No test added for the two pure helpers — they are logic-free enough that
  unit tests would be testing string formatting rather than meaningful behavior.
  The `findPreviousSessionForPlanDay` scan logic mirrors the existing
  `findPreviousWeightsOutcome` pattern which is already tested indirectly.

---

## What I should evaluate tomorrow

1. Open TodayPage with a few weeks of history. Does the "Last: 3×8 @ 135 lb
   Bench Press" label feel useful or noisy in the context of the existing card?
2. Does the spacing (`-mt-2`) feel right or is the hint too close to the card?
3. Does "Last:" read naturally, or should it be "Last session:" or "Prev:"?
4. Test on a narrow screen (320px) — does the exercise name need truncation?

---

## Recommended next steps

- Add `truncate` class to the hint `<p>` element to prevent overflow on narrow
  screens (safe, 1-line change).
- If well-received, extend to show 2–3 exercises in a compact row rather than
  one.
- If too noisy, add a user preference in Settings to toggle the hint off.

---

## Keep / revise / prototype only / reject

**Keep** — the feature is purely additive, the data was already computed, and
the value for repeating strength plans is clear. The main open question is
whether the single-exercise display is satisfying or frustrating for complex
plans. Recommend keeping and iterating on the display format based on real use.

---

# Feature Review — Personal Best (PB) Detection in Session Hint

Date: 2026-05-02
Branch: `claude/dreamy-mccarthy-WJaAU`
Classification: **Keep**

---

## What was actually built

1. `buildLastSessionSummary` in `src/lib/sessionSummary.ts` extended with an
   optional `maxLoadByExercise?: Record<string, number>` parameter. When the
   first actual set's load equals `maxLoadByExercise[exerciseName]`, " · PB" is
   appended to the returned string. No behaviour change when the parameter is
   omitted (run/swim callers, tests without PB context).

2. In `TodayPage`:
   - `exerciseRecords = useExerciseHistoryStore(s => s.records)` — first use of
     this store in TodayPage. Single selector minimises re-renders.
   - `maxLoadByExercise = useMemo(...)` — iterates records to build
     `{ exerciseName: maxLoad }` map. Memoized on `exerciseRecords`.
   - `buildLastSessionSummary(prevSessionOutcome, maxLoadByExercise)` — updated
     call site.

3. **Tests** (in `sessionSummary.test.ts`):
   - PB marker shown when load equals all-time max.
   - No PB when load is below max.
   - No PB when the exercise is not in the map.

---

## What assumptions were encoded

- All-time max across all exercise records (including records from deleted
  plans). This is intentional — the load is valid data regardless of which plan
  it was logged under.
- Equality comparison (`=== maxLoadByExercise[exercise]`): PB fires only on an
  exact match to the all-time high. A user who logged 135 lb → 145 lb → 135 lb
  will see "· PB" on the 145 lb session, not the most recent 135 lb one.
- Only weights PB detection. Run and swim are unchanged.

---

## What worked well

- The feature fell entirely out of the existing `exerciseHistoryStore` (which
  has been populated since pass 6 but was only exposed in one place). No schema
  changes, no new store state.
- Extracting `buildLastSessionSummary` to `sessionSummary.ts` this pass made
  the PB parameter a natural extension of an already-refactored function.
- The `maxLoadByExercise` memo is O(n sets) — cheap even for heavy users with
  hundreds of sessions.

---

## What feels risky or incomplete

- **First `exerciseHistoryStore` subscription in TodayPage**: the store is
  large (one record per exercise per session). On an old device with 2+ years
  of data, the memo could be slow. Measured O(n) on records, not sets, so in
  practice at most a few thousand iterations — acceptable.
- **Equality, not range**: "· PB" only fires when the previous session *exactly
  matched* the all-time high. If the user logged 225 lb once, then logged 200 lb
  three times, "· PB" never shows on the 200 lb sessions (correct: they aren't
  PRs), but won't show on new 225 lb sessions if somehow two records exist with
  the same load. Edge case, tolerable.
- **No indicator for run/swim best**: users who primarily track running may feel
  the feature is incomplete. Low priority since run adaptation already gives
  pace/distance guidance.

---

## What I should evaluate

1. Does "Last: 3×8 @ 225 lb Squat · PB" render legibly in the hint line
   alongside the `truncate` class? On a narrow screen the PB marker might be
   clipped. Check on a 360px device.
2. Does the `exerciseHistoryStore` subscription cause any perceptible extra
   render on TodayPage? The store only changes when a workout is logged, so
   steady-state renders are unaffected.
3. Is the PB marker visually distinct enough in muted slate text, or does it
   need colour (e.g., `text-amber-400`)?

---

## Recommended next steps

- If the PB marker is too easy to miss, style "· PB" in `text-amber-400` for
  a gold highlight. One-line CSS change.
- Consider adding a `maxDistanceByType` equivalent for run outcomes in a future
  pass.
- A "personal records" section in HistoryPage or SettingsPage (all-time bests
  per exercise, sortable) is a natural next feature that would use the same
  `maxLoadByExercise` computation.

---

## Keep / revise / prototype only / reject

**Keep** — passive, zero-friction PB detection using fully available data.
The only open question is styling (plain text vs. colour highlight). The
feature is complete and correct; styling can be tuned without any logic change.

---

## Pass 33 Feature Review — Quick catch-up: batch-mark unlogged days as Day Off

**Date:** 2026-05-19
**Branch:** `claude/dreamy-mccarthy-I8ssV`

### Implementation correctness

The feature is implemented as proposed with no scope creep.

- `getUnloggedPastDates` returns correct newest-first date list; 6 unit tests
  cover all branches including planStart cutoff and cross-plan isolation.
- `markDaysAsOff` correctly delegates to `addEntry` which handles dedup; 4
  unit tests cover batch creation, replace-existing, empty-input, and
  cross-plan isolation.
- TodayPage nudge: condition `unloggedDates.length > 0` matches old
  `unloggedCount > 0` exactly. Auto-dismiss works correctly because
  `getUnloggedPastDates` re-derives from store state on every render.

### Risks assessed

**Destructive if misused** — acknowledged in the proposal. The Calendar path
remains available for corrections. The amber colour on the catch-up button
provides visual differentiation from the navigation action, reducing the chance
of accidental taps.

**N subscriber notifications** — `markDaysAsOff` calls `addEntry` in a loop,
producing N Zustand notifications. For the 7-day lookback window (max 7
iterations), this is below any perceptible threshold. Batching into a single
`set()` would complicate the dedup logic with no practical benefit.

### What was not built

- Undo button — not needed given Calendar editing path
- Confirmation dialog — not warranted for a low-stakes Day Off log
- Configurable lookback window — 7 days is sufficient for the catch-up use case

### Verdict

**Keep** — the feature is minimal, correct, and directly addresses the UX gap
identified during the stall nudge audit. Risk is low; rollback is trivial.

---

## Pass 35 Feature Review — Session count on upcoming workout cards

**Date:** 2026-05-21  
**Branch:** `claude/dreamy-mccarthy-w8aCb`  
**Proposal in:** FEATURE_PROPOSAL.md (pass 35 entry)

### Summary

Wires `countPlanDayCompletions` to the upcoming `WorkoutDayCard` instances on TodayPage by adding a single `useMemo`. The `sessionCount` prop and the helper function both pre-existed; this change connects them.

### Review

**Correctness:** The memo computes `countPlanDayCompletions` for each upcoming day, keyed by `calendarDate`. This is correct because each `ResolvedDay` in `upcoming` has a unique `calendarDate`, so the key is unambiguous. The helper itself is deterministic and fully tested.

**Performance:** The memo has appropriate deps `[plan, upcoming, planEntries]`. `countPlanDayCompletions` is O(n) over `planEntries`. For a typical user with ≤1000 history entries, this is negligible. The memo re-runs only when the plan, upcoming list, or entries change — not on every keystroke or timer tick.

**UI:** The "×N done" badge already existed and was shown on the today card. Extending it to upcoming cards is UX-consistent. The badge is muted/secondary styling, so it does not compete visually with the workout name.

**Tests:** No new tests needed. The added code is a composition of two already-tested pieces (`countPlanDayCompletions` and `WorkoutDayCard.sessionCount`). Adding integration tests for this would be disproportionate to the change size.

**Prior art gap:** The Pass 21 feature proposal noted "The upcoming cards are not yet wired up" as a carry-over item. This pass closes it.

### Risks

**Incorrect count if planDayIndex is undefined** — `countPlanDayCompletions` receives `planDayIndex` which can be undefined for `day_off` plan days. The helper handles this correctly: `undefined` planDayIndex entries are not counted (the filter `e.planDayIndex === planDayIndex` is always false for undefined). Upcoming day_off slots will show no badge, which is correct.

**No explicit risk from stale memo** — All three dependencies (`plan`, `upcoming`, `planEntries`) are derived from store subscriptions and will update reactively. No risk of showing stale counts.

### What was not built

- Badge on CalendarPage's `WorkoutDayCard` instances — a separate concern, out of scope.
- Animated entry for the badge — not warranted for informational display.

### Verdict

**Keep** — minimal code change (~10 lines), no new dependencies, closes a known feature gap, backed by existing tests on both sides of the wire.
