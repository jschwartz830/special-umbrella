# Overnight Changelog

## 2026-05-18 (thirty-second pass) — branch `claude/dreamy-mccarthy-THUP4`

Baseline on entry: **686 passing, 0 failing**. Exit state: **698 passing, 0 failing** (+12 tests).

---

### Change 1 — refactor: move `nanoid` to `src/lib/utils.ts`

**Why it matters:** `nanoid` is a general-purpose ID generator with no conceptual
relationship to the rotation engine. All five stores and several lib files were importing
from `rotationEngine.ts` just to get an ID — coupling them to the engine layer unnecessarily.
`src/lib/utils.ts` is the proper home. `rotationEngine.ts` re-exports from there for
backward compatibility so all existing importers (programParser, csv, PlanBuilderPage,
exerciseHistoryStore) continue to compile unchanged.

**Files changed:** `src/lib/utils.ts` (new), `src/engine/rotationEngine.ts`,
`src/store/historyStore.ts`, `src/store/planStore.ts`

**Risks / tradeoffs:** None. No behavioral change. Existing importers via the re-export
path continue to work unchanged.

**Rollback:** `git revert d6b79c5`

---

### Change 2 — test: expand `historyScope` coverage from 4 → 16 tests

**Why it matters:** `hasPlanHistory` and `getPlansWithHistory` are called on every
HistoryPage render to decide which plans appear in the plan selector and whether the
weekly breakdown shows. Prior coverage was 4 tests covering only two happy-path scenarios.
Edge cases — empty plans dict, orphaned entries (plan deleted, history remains), plans with
no activity, entries from other plans — were untested.

**Files changed:** `src/lib/__tests__/historyScope.test.ts`

**Risks / tradeoffs:** None. Test-only addition.

**Rollback:** `git revert ff0bc1a`

---

### Change 3 — feat: Weekly Activity panel in HistoryPage

**Why it matters:** `computeWeeklyBreakdown` was added in pass 31 with 15 tests but had
no UI consumer. Users had no way to see their week-by-week consistency at a glance. The
new collapsible "Recent Weeks" section in HistoryPage surfaces the last 8 weeks newest-first
when a single plan is selected, showing completed count alongside skips, day-offs, and extras.

**Files changed:** `src/pages/HistoryPage.tsx`

**Risks / tradeoffs:** UI-only addition. The panel is hidden when "All plans" is selected
(breakdown is per-plan) and when no weeks have activity. Defaults to expanded. If the
collapsed-by-default behavior is preferred, change `useState(true)` to `useState(false)`
in `WeeklyActivitySection`.

**Rollback:** `git revert e47af7c`

---

## 2026-05-17 (thirty-first pass) — branch `claude/dreamy-mccarthy-UaphK`

Baseline on entry: **664 passing, 0 failing**. Exit state: **686 passing, 0 failing** (+22 tests).

---

### Change 1 — fix: `getTodayResolvedDay` entry deduplication

**Why it matters:** `computeCurrentDayIndex` and `getResolvedDaysRange` both deduplicate history entries for the same calendar date by choosing the one with the latest `createdAt`. `getTodayResolvedDay` used `entries.find()` which picks the first array match — whichever order entries happen to be stored in. After a CSV import that produces duplicates for today, then a second log action, the displayed status could reflect the older entry rather than the newest. Now aligned with the deduplication contract of the other two engine functions.

**Files changed:** `src/engine/rotationEngine.ts`, `src/engine/__tests__/rotationEngine.test.ts`

**Risks / tradeoffs:** None. Logic-only change in the engine layer. Tests verify the new behavior explicitly.

**Rollback:** `git revert 5063bcb`

---

### Change 2 — test: `buildMonthGrid` integration tests with entry and override data

**Why it matters:** The existing `buildMonthGrid` tests verified grid structure (cell counts, isCurrentMonth, isToday, plan.startDate clamping) but none confirmed that entry statuses (past_complete, past_skip, past_day_off, today_pending) or override application are correctly propagated through the grid. These new tests exercise the full integration path: `buildMonthGrid` → `getResolvedDaysRange` → resolvedDay with entry and override data. Also verifies that entries from a different plan do not bleed into the active plan's grid.

**Files changed:** `src/engine/__tests__/calendarProjection.test.ts` (8 new tests)

**Risks / tradeoffs:** None. Test-only addition.

**Rollback:** `git revert f663712`

---

### Change 3 — feat: `computeWeeklyBreakdown` in `historyStats.ts`

**Why it matters:** The existing stats layer has per-plan totals, per-day counts, rolling 7-day and 30-day windows, and streak tracking — but no per-week breakdown. `computeWeeklyBreakdown` fills this gap: it groups history entries and extra workouts into ISO weeks (Monday–Sunday), counting completed/skipped/dayOffs/extras/totalLogged per week. Weeks with no activity are not returned (no empty placeholders). Results are sorted ascending by weekStart. This enables future weekly-report views in HistoryPage or TodayPage with no architectural changes — the data was already in historyStore.

**Files changed:** `src/lib/historyStats.ts` (new function + `isoWeekStart` helper), `src/lib/__tests__/historyStats.test.ts` (15 new tests)

**Risks / tradeoffs:** Purely additive. No existing behavior changed. The `isoWeekStart` helper is private to the file. The function is plan-scoped and date-range-scoped so callers have full control over what slice they request. ISO week (Monday start) is a deliberate choice — differs from the CalendarPage's Sunday-start grid. If the UI needs Sunday-based weeks, the `isoWeekStart` helper can be adapted in one place.

**Rollback:** `git revert 2f9d724`

---

## 2026-05-16 (thirtieth pass) — branch `claude/dreamy-mccarthy-9y4SP`

Baseline on entry: **656 passing, 0 failing**. Exit state: **664 passing, 0 failing** (+8 tests).

---

### 1. Bug fix: HistoryPage missing removeOutcome before moveOutcome on date change

**File**: `src/pages/HistoryPage.tsx`  
**Commit**: `fix(history): remove destination outcome before moveOutcome on date change`

**Problem**: In `handleOutcomeConfirm`, when a user changes a workout date via the
History page (non-extra path), the code called `moveOutcome(oldId, nextId)` without
first calling `removeOutcome(nextId)`. `moveOutcome` in `outcomeStore` overwrites the
destination key and calls `syncExerciseHistory` for the moved record — but it does NOT
clean up the `exerciseHistoryStore` records that belonged to any pre-existing outcome
at `nextId`. Those exercise history records become orphaned: they can no longer be
associated with any displayed outcome.

TodayPage and CalendarPage both correctly call `removeOutcome(nextId)` before
`moveOutcome` in their analogous date-change paths. HistoryPage was the only outlier.

**Fix**: Added `removeOutcome(nextId)` immediately before the `moveOutcome` call in
the rotation-entry branch of `handleOutcomeConfirm`. Extras are safe (each extra has
a unique `nanoid()` ID so the destination key is always fresh); only rotation entries
needed the guard.

**Risk**: Minimal. If no outcome exists at `nextId`, `removeOutcome` is a no-op. If
one does exist, the old behavior silently corrupted exercise history — the new behavior
correctly cleans it up first.

**Rollback**: `git revert 05e6ba5`

---

### 2. Tests: expressionEval edge cases for splitStatements, resolveLoad, resolveQuantityString

**File**: `src/lib/__tests__/expressionEval.test.ts` (+8 tests)  
**Commit**: `test(expressionEval): add edge-case tests for splitStatements, resolveLoad, resolveQuantityString`

Added targeted edge-case tests for three previously uncovered parser/resolver paths:

**`splitStatements` nested-comma handling** — the tokenizer must not split on commas
that appear inside function call arguments (e.g. `min(easy_miles + 0.5, 8)` is one
expression). Two tests: a simple nested case and a deeply nested case combining
`round5(min(...))` with a second outer statement.

**`resolveLoad` boundary conditions** — empty string → `null`; unclosed parenthesis
`'round5(135'` → `null` (parse error, not a crash); case-insensitive unit suffix
`'225LB'` → `225`.

**`resolveQuantityString` value/unit extraction** — `'30 s'` → `{ value: 30, unit: 's' }`;
`'1.5 h'` → `{ value: 1.5, unit: 'h' }`; bare variable name `'squat'` with a context
where `squat=225` → `{ value: 225, unit: '' }`.

**Risk**: Additive only — no behavioral changes. All 664 tests pass.

**Rollback**: `git revert 8d9936b`

---

## 2026-05-15 (twenty-ninth pass) — branch `claude/dreamy-mccarthy-rtcbO`

Baseline on entry: **644 passing, 0 failing**. Exit state: **656 passing, 0 failing** (+12 tests).

---

### 1. Bug fix: TodayPage header shows wrong day number after double-day advance

**File**: `src/pages/TodayPage.tsx` (1 line)  
**Commit**: `fix: use primaryPlanDayIndex in TodayPage header day counter`

**Problem**: The "Day N of M in rotation" header used `todayResolved.planDayIndex + 1`.
After a double-day, `actions.advance()` adds an override for today, which shifts
`todayResolved.planDayIndex` forward by one. The workout card below the header already
used `primaryPlanDayIndex` (which reads `historyEntry.planDayIndex`) and showed the
correct completed workout. The header showed one position higher — e.g. "Day 4 of 5"
while the card showed "Day 3: Upper Body".

**Fix**: Changed the single reference to `primaryPlanDayIndex + 1`. The variable already
existed and was defined as `historyEntry?.planDayIndex ?? todayResolved.planDayIndex`,
so pending days and day-offs fall back to the rotation pointer identically to before.

**Risk**: None. `primaryPlanDayIndex` was already used for the card, logs, and outcome
modal — this change makes the header consistent with everything else.

---

### 2. Regression test: planDayIndex diverges from historyEntry.planDayIndex

**File**: `src/engine/__tests__/rotationEngine.test.ts` (+1 test)  
**Commit**: `test: document planDayIndex vs historyEntry.planDayIndex divergence`

Added a test in the `getTodayResolvedDay` suite that documents the invariant:

> After completing today's workout (entry logged as day 0), adding an advance override
> shifts `planDayIndex` to 1 while `historyEntry.planDayIndex` stays at 0.

This anchors the header fix above — any future refactor that removes `primaryPlanDayIndex`
will be caught by this test explaining why the distinction matters.

---

### 3. Feature: rotation plan remaining counter

**Files**: `src/lib/historyStats.ts`, `src/lib/__tests__/historyStats.test.ts`,
`src/pages/TodayPage.tsx`  
**Commit**: `feat: show total workouts remaining in final rotation of a plan`

**Added `computeRotationPlanRemaining(plan, entries): number | null`**

Computes `max(0, duration.value × days.length − logged count)` where "logged" means
`complete` or `skip` entries (same rule as `isPlanExpired` and
`computeRotationCycleProgress`). Returns `null` for weeks plans, empty plans, and
`value ≤ 0` guards.

**TodayPage header**: When `rotationPlanRemaining ≤ plan.days.length` and `> 0` (the final
rotation phase), the header subtitle now shows "· N left to finish" alongside the existing
cycle progress. The condition keeps it invisible during earlier phases to avoid premature
noise ("42 workouts left" is demoralizing; "3 left to finish" is motivating).

**11 new tests** cover: null guards, fresh plan (totalNeeded returned), decrement by
complete, decrement by skip, day_off exclusion, at-completion (returns 0), over-completion
(clamped by Math.max), cross-plan isolation, and the single-remaining case.

**Risk**: Additive. Removing the JSX span reverts to prior behavior. The function has no
side effects and is already fully tested.

---

## 2026-05-14 (twenty-eighth pass) — branch `claude/dreamy-mccarthy-nJAOH`

Baseline on entry: **639 passing, 0 failing**. Exit state: **644 passing, 0 failing** (+5 tests).

---

### 1. Bug fix: CSV date validation — out-of-range month/day accepted silently

**File**: `src/lib/csv.ts`

The `historyFromCsv` date guard used only a format regex (`/^\d{4}-\d{2}-\d{2}$/`). A
value like `2026-13-01` (month 13) or `2026-04-32` (day 32) passed the regex and produced
an entry with an invalid `calendarDate` string that would silently corrupt date comparisons
throughout the app. Added `isNaN(new Date(calendarDate).getTime())` as a third condition:

```typescript
if (
  !calendarDate ||
  !/^\d{4}-\d{2}-\d{2}$/.test(calendarDate) ||
  isNaN(new Date(calendarDate).getTime())
) { … }
```

New test in `src/lib/__tests__/csv.test.ts` covers month 13, month 0, and day 32.

---

### 2. UX fix: · PB marker rendered in amber on TodayPage

**File**: `src/pages/TodayPage.tsx`

The personal-best marker embedded in `lastSessionSummary` was rendered entirely in muted
slate (`text-slate-500`), matching the surrounding text. It was easy to miss.

The JSX render now splits on the ` · PB` suffix and wraps it in
`<span className="text-amber-400 font-medium">`, making it visually distinct without
changing `buildLastSessionSummary`'s string API or any existing tests.

---

### 3. Feature: `longestStreak` added to `HistoryStats`

**Files**: `src/lib/historyStats.ts`, `src/lib/__tests__/historyStats.test.ts`,
`src/pages/TodayPage.tsx`

`computeHistoryStats` now also returns `longestStreak: number` — the length of the longest
consecutive day-streak ever logged (across all qualifying dates in the `streakable` Set).
Algorithm: sort the Set's dates lexicographically (safe for YYYY-MM-DD), walk the array,
reset `runLen` to 1 on any gap > 1 day, track maximum.

TodayPage's streak tile shows a muted `"Best: N"` sub-label whenever `longestStreak >
currentStreak`, giving users a personal-best reference without cluttering the tile when
they're on their best streak already.

Four new tests added covering: parity with current streak, older run longer than current,
empty streakable set, and mixed entries + extras.

---

## 2026-05-13 (twenty-seventh pass) — branch `claude/dreamy-mccarthy-JEVCy`

Baseline on entry: **4 failing, 631 passing** (pre-existing failures in
`sessionSummary.test.ts`). Exit state: **639 passing, 0 failing** (+8 tests, +4 fixed).

---

### 1. Bug fix: `buildLastSessionSummary` — double pace push

**Summary**: Pace was appended twice in every run session summary (e.g.,
"Last: 3.1 mi · 28 min · 9:02 /mi · 9:02 /mi"). The old `parts.push(formatPace(...))`
line at the head of the run block was left in place when the new
storedPace/derivedPace block was added in pass 25. The stale push is removed;
the unified block is the sole pace emitter.

**Why it matters**: Three tests were failing on entry due to this bug. Run hints
were displaying double pace to all users with stored pace data.

**Files changed**: `src/lib/sessionSummary.ts`

**Risks**: None — removing a duplicate push.

**Rollback**: `git revert a124b14`.

---

### 2. Bug fix: `buildLastSessionSummary` — stale zero-pace guard and conflicting test

**Summary**: The `derivedPace` condition used `storedPace == null`, which is true
when the stored value is `0` (bad data). Implementation plan intent (pass 25) was
that `stored=0` should fall back to derived pace, matching the "ignore bad default"
philosophy. The correct condition is `run.averagePaceSecondsPerMile == null` (only
derive when pace was never provided). One test ("omits run pace when 0") expected
the old no-derivation behavior and is updated to match the documented intent.

**Why it matters**: Ensures consistent behavior: `0` → derive (same as absent);
`null` → derive; valid positive → use stored. Eliminates the conflict between two
tests with opposite expectations.

**Files changed**: `src/lib/sessionSummary.ts`, `src/lib/__tests__/sessionSummary.test.ts`

**Risks**: Users who had stored `averagePaceSecondsPerMile=0` will now see derived
pace in their session hints instead of no pace. This is correct behavior — they had
no valid stored pace.

**Rollback**: `git revert a124b14`.

---

### 3. Fix: `summariseRunOutcome` — use `formatPace`, add zero guard

**Summary**: `summariseRunOutcome` in `explanation.ts` formatted pace with raw
`Math.floor / Math.round` arithmetic instead of the canonical `formatPace()` utility.
The raw approach can produce "9:60 /mi" for values near 599.5 s/mi where
`Math.round(x % 60) = 60`. Also, no `> 0` guard meant `averagePaceSecondsPerMile=0`
would display "0:00 /mi". Fixed both by importing `formatPace` and adding
`&& ra.averagePaceSecondsPerMile > 0`.

**Why it matters**: Consistency with `buildLastSessionSummary` (which uses `formatPace`
and guards > 0). Latent "9:60 /mi" display bug removed.

**Files changed**: `src/modules/recommendation/explanation.ts`,
`src/modules/recommendation/__tests__/explanation.test.ts`

**Risks**: None — defensive fix. Two new tests anchor the corrected behavior.

**Rollback**: `git revert 193ffe6`.

---

### 4. Fix: rename "This week" stat label to "7-day" on TodayPage

**Summary**: The middle stat tile on TodayPage showed "This week" for `last7Completed`,
which counts the last 7 rolling calendar days — not the current Mon–Sun calendar week.
On Wednesday, "this week" reads as Mon–Wed (3 days) but the code reports Thu-last-week
through today (7 days). HistoryPage already correctly uses "7-day" for the same stat.
Changed TodayPage to match.

**Why it matters**: UX clarity — users familiar with "this week = Mon–Sun" would
misinterpret the count, especially mid-week when the label is most misleading.

**Files changed**: `src/pages/TodayPage.tsx`

**Risks**: Users who knew "This week" as the label will see it changed. Semantic
improvement, not a behavioral change.

**Rollback**: `git revert a1ad26d`.

---

### 5. Feature: swim pace derivation in `buildLastSessionSummary`

**Summary**: Extends run pace derivation (pass 25) to swim. When
`averagePaceSecondsPer100m` is absent (null/undefined) or 0 (bad data), and
both `actualDistanceMeters` and `actualDurationMin` are present and non-zero,
pace is derived as `(durationMin × 60) / (distanceMeters / 100)` seconds per 100m
and formatted via `formatSwimPace()`.

Before: `"Last: 800 m · 20 min"` (no pace even when distance+duration available)
After:  `"Last: 800 m · 20 min · 2:30 /100m"`

Stored pace > 0 still takes priority. Zero stored pace falls back to derived
(same semantics as run).

**Why it matters**: Swimmers see pace context in their session hint the same way
runners do. The feature was deferred in pass 24 ("not extended to swim") — this
pass completes the symmetry.

**Files changed**: `src/lib/sessionSummary.ts`, `src/lib/__tests__/sessionSummary.test.ts`

**Risks**: Users with existing swim data (no stored pace, but distance+duration
logged) will now see derived pace in the TodayPage hint. This is additive and
informative — the same reception as the run feature.

**Rollback**: `git revert 547f181`.

---

## 2026-05-13 (twenty-sixth pass) — branch `claude/dreamy-mccarthy-G6yaB`

Baseline on entry: **616 passing, 0 failing**.
Exit state: **617 passing, 0 failing** (+1 test).

---

### 1. Bug fix: `isPlanExpired` — missing guard for `weeks` duration with `value = 0`

**Summary**: A plan configured with `{ type: 'weeks', value: 0 }` would
compute `endDate = startDate`, making `today >= endDate` immediately true.
The "Plan complete!" banner would appear the moment such a plan was activated,
before the user had done a single workout.

**Why it matters**: The `value <= 0` guard already existed in the `rotations`
branch of the same function. The `weeks` branch was missing it, creating a
silent asymmetry. While users are unlikely to configure a 0-week plan
intentionally, the plan builder does not prevent it, and a malformed YAML
import could produce one.

**Files changed**: `src/engine/rotationEngine.ts`

**Change**: Moved `if (value <= 0) return false` above both type branches so
the guard applies uniformly to weeks and rotations plans.

**Risks / tradeoffs**: Zero — the guard is only reached for `value = 0` or
negative, which represents invalid configuration. Valid plans (value ≥ 1) are
unaffected.

**Rollback**: `git revert` the commit. No data migration needed.

---

### 2. Test: cover the weeks+zero guard

**Summary**: Added two assertions to the `isPlanExpired` test suite —
`isPlanExpired` with a weeks plan + `value = 0` on its start date and far
in the future both return `false`. Mirrors the existing rotations zero-value test.

**Files changed**: `src/engine/__tests__/rotationEngine.test.ts`

**Risks**: None.

---

### 3. Feature: previous session notes in TodayPage pending-state hint

**Summary**: When the user is pending (today's workout not yet logged) and
a prior session for the same plan day exists with non-empty notes, those notes
are now shown as a second italic hint line below the existing "Last: …" summary.

Example before: `Last: 3×8 @ 135 lb Bench Press`
Example after:
```
Last: 3×8 @ 135 lb Bench Press
"felt strong, ready to add 5 lb"
```

**Why it matters**: Athletes regularly write session notes ("left shoulder
tight", "felt great, up the weight next time") that are immediately useful
context for the next session of the same movement. Without this, those notes
are buried inside the outcome modal and effectively invisible at the moment
they're most needed.

**Files changed**: `src/pages/TodayPage.tsx`

**Change**: The `lastSessionSummary` single `<p>` was replaced with a
wrapping `<div>` that conditionally renders both the summary line and a
second italic `<p>` for `prevSessionOutcome?.notes`. Both lines truncate at
screen width via `truncate`. The same visibility condition (pending + no
double-day) applies to both lines.

**Risks / tradeoffs**:
- Notes can be long; truncation prevents layout breakage but long notes are
  cropped without ellipsis on touch overflow. Acceptable — the full note is
  still accessible via the "Edit outcome" modal.
- No new state, no new hooks, no new data fetching. `prevSessionOutcome` was
  already computed one line above.
- The italic `"..."` framing is a style decision — easy to revise.

**Rollback**: `git revert` the commit. One self-contained change to TodayPage.

---

## 2026-05-10 (twenty-fifth pass) — branch `claude/dreamy-mccarthy-ApbpW`
## 2026-05-12 (twenty-fifth pass) — branch `claude/dreamy-mccarthy-OjsGg`
## 2026-05-11 (twenty-fifth pass) — branch `claude/dreamy-mccarthy-3SEA4`

Baseline on entry: **609 passing, 0 failing**.
Exit state: **613 passing, 0 failing** (+4 tests).

---

### 1. Bug fix: run pace `> 0` guard in `buildLastSessionSummary`

**Summary:** Added `&& averagePaceSecondsPerMile > 0` guard alongside the existing
`!= null` check. Prevents "0:00 /mi" from appearing in the session hint if the field
is accidentally stored as 0 (e.g., from a future integration that sets a default).

**Why it matters:** `formatPace(0)` produces "0:00 /mi" — a nonsensical value that
would appear as the pace part of the hint. This closes the "probably keep but tweak"
item from the pass 24 REVIEW_NOTES.

**Files changed:** `src/lib/sessionSummary.ts`

**Risks / tradeoffs:** None. Adding `> 0` is strictly more defensive; does not affect
any realistic stored value (valid paces are always positive).

**Rollback:** `git revert 6568f42` — this commit also includes the swim pace feature
below; revert both together.

---

### 2. Feature: swim pace in session hint

**Summary:** `buildLastSessionSummary` now includes `averagePaceSecondsPer100m` in the
swim hint when the field is present and > 0, producing e.g.:
"Last: 800 m · 20 min · 2:00 /100m"

**Why it matters:** `averagePaceSecondsPer100m` is captured in `OutcomeModal` and
stored in `SwimWorkoutActual`, but was silently discarded in the display layer —
identical to the run pace situation fixed in pass 24. Swimmers care about pace per
100m just as runners care about pace per mile.

**Files changed:** `src/lib/sessionSummary.ts`, `src/lib/__tests__/sessionSummary.test.ts`

**Risks / tradeoffs:** Additive only. Existing swim tests (distance+duration, no pace)
are unchanged. 3 new tests verify the stored-pace, null-pace, and zero-pace paths.

**Rollback:** `git revert 6568f42`
## 2026-05-10 (twenty-fifth pass) — branch `claude/dreamy-mccarthy-ApbpW`

Baseline on entry: tests could not be run (devDeps not installed on audit machine).
Source-level audit confirmed all prior fixes stable.

---

### 1. Bug fix: `buildWeightsRecommendation` — double-progression partial completion

**Summary:** In `mode === 'double'`, the progression recommendation incorrectly
returned `'progress'` when only some sets were completed, as long as the completed
ones hit their rep targets.

**Why it matters:** A user who bails halfway through a workout (completing 2 of 4
sets) would be told to add load next session, which is the wrong progression cue.
The single-progression mode had an identical bug fixed in pass 24; this closes the
parallel gap in double mode.

**Files changed:**
- `src/modules/workout-outcomes/progression.ts` — add `allSetsCompleted` guard
  before evaluating `allHit`; `allHit = allSetsCompleted && completedSets.every(...)`
- `src/modules/workout-outcomes/__tests__/progression.test.ts` — 2 new regression
  tests (partial completion → hold; `completed: undefined` sets → hold)

**Risks / tradeoffs:** Behaviour change: partial-completion double-progression
workouts now correctly recommend 'hold' instead of 'progress'. This is a bug fix
not a policy change; users who complete all sets are unaffected.

**Rollback:** `git revert` the single commit that contains both file changes.

---

### 2. Feature: `computePlanStreak` — plan-scoped consecutive-day streak

**Summary:** Added a new pure function `computePlanStreak(planId, entries, extras, today)`
to `src/lib/historyStats.ts`. It counts consecutive days ending at `today` where the
given plan has a `complete` or `day_off` entry, or any extra workout. Mirrors the
algorithm in `computeHistoryStats.currentStreak` but scoped to one plan.

**Why it matters:** The global streak aggregates across all plans and extras. A user
on their second active plan sees a streak that includes history from their previous
plan. A plan-scoped streak is more actionable ("5 days on this program") and is the
natural next stat to surface on the TodayPage stats bar or the HistoryPage plan
summary. This pass adds the function and tests only; UI wiring is left for the next
pass to keep this change reviewable.

**Files changed:**
- `src/lib/historyStats.ts` — new export `computePlanStreak`
- `src/lib/__tests__/historyStats.test.ts` — 12 new tests; import updated

**Risks / tradeoffs:** Additive only. Zero UI changes. Zero store changes. The function
is exported but not yet called from any component; unused exports are a style lint risk
(no ESLint `no-unused-exports` rule currently configured). Easy to revert.

**Rollback:** `git revert` the feature commit. No data migration needed.

---

## 2026-05-07 (twenty-fourth pass) — branch `claude/dreamy-mccarthy-Q6elc`

Baseline on entry: **551 passing, 0 failing**.
Exit state: **609 passing, 0 failing** (+58 tests).

---

### 1. Bug fix: `buildWeightsRecommendation` — `allCompleted` was trivially true

**Summary:** For single-mode weight progression, the function always returned 'progress'
whenever any set was completed, even when the user only finished part of their sets.
The 'hold' path and its "repeat current load" coaching note were dead code.

**Root cause:** `allCompleted` was evaluated against `completedSets` — a local variable
already filtered to `s.completed === true` — making `.every(s => s.completed)` trivially
true. The fix computes `allCompleted` from `allSets` (all logged sets, filtered or not),
so any set with `completed: false` or `completed: undefined` correctly produces 'hold'.

**Why it matters:** Users who only complete 2 out of 3 planned sets were told to
"add 2.5-5 lb next session" rather than "repeat current load". The coaching note
was actively misleading for partial-completion sessions.

**Files changed:** `src/modules/workout-outcomes/progression.ts`

**Risks / tradeoffs:** Regression risk is low. Only affects the display recommendation,
not the logged history or rotation state. Single-mode plans that previously always saw
'progress' will now see 'hold' when sets are partially completed. This is correct behavior.

**Rollback:** `git revert b38de7b` — reverts the two-line change in `progression.ts`.

---

### 2. Tests: `buildProgressionRecommendation` — 30 new tests

**Summary:** Core business logic with zero prior coverage. Added a comprehensive test
suite covering all slot types (weights single/double/volume, run, swim), all action
outcomes (progress/hold/regress), null paths, and partial-completion scenarios.
The "hold when not all sets completed" test is a regression anchor for the bug above.

**Why it matters:** `buildProgressionRecommendation` determines the coaching hint shown
to users after every logged workout. Undetected regressions here would silently produce
wrong advice.

**Files changed:** `src/modules/workout-outcomes/__tests__/progression.test.ts` (new)

**Risks / tradeoffs:** None. Pure-function tests with no side effects.

**Rollback:** Delete the test file.

---

### 3. Tests: `workout-outcomes/types.ts` utilities — 24 new tests

**Summary:** Added tests for `completionStateToAction`, `derivePaceSecondsPerMile`,
`deriveSwimPaceSecondsPer100m`, `formatPace`, and `formatSwimPace`. Includes coverage
of edge cases like single-digit seconds padding, fractional-second rounding, and the
"9:60 /mi" prevention guard.

**Why it matters:** These utilities feed pace display and history labeling throughout
the app. `formatPace` is now used in the session summary (change 4) — having tests
before adding the consumer reduces regression risk.

**Files changed:** `src/modules/workout-outcomes/__tests__/types.test.ts` (new)

**Risks / tradeoffs:** None. Pure-function tests.

**Rollback:** Delete the test file.

---

### 4. Bug fix + Feature: run distance rounding + pace in session summary

**Bug fix:** `buildLastSessionSummary` rendered `actualDistanceMiles` via direct
template interpolation, so a value like `3.14159` would display as "3.14159 mi".
Rounded to 1 decimal via `Math.round(miles * 10) / 10` — avoids `toFixed` trailing
zeros (`5.0` → "5 mi", not "5.0 mi").

**Feature:** When `RunWorkoutActual.averagePaceSecondsPerMile` is non-null, the pace
is appended to the run summary using the existing `formatPace` utility. The hint
becomes "Last: 3.1 mi · 28 min · 9:02 /mi" instead of "Last: 3.1 mi · 28 min".
Pace is only shown when explicitly stored — deriving it from distance + duration is
deferred as a product decision.

**Why it matters:** Pace is the primary performance metric for runners. The field was
already captured and persisted; this change surfaces it in the one place runners look
before starting today's run.

**Files changed:**
- `src/lib/sessionSummary.ts` (import + 4 lines)
- `src/lib/__tests__/sessionSummary.test.ts` (5 new tests)
- `FEATURE_PROPOSAL.md` (new pass 24 entry prepended)

**Risks / tradeoffs:** If `averagePaceSecondsPerMile` is 0 (accidental input),
displays "0:00 /mi". Harmless but odd; a `> 0` guard is a possible follow-up.

**Rollback:** `git revert d386a99` — reverts `sessionSummary.ts` and test changes.

---

## 2026-05-06 (twenty-third pass) — branch `claude/dreamy-mccarthy-9Dgx6`

Baseline on entry: **548 passing, 0 failing**.
Exit state: **551 passing, 0 failing** (+3 tests).

---

### 1. Tests: edge case coverage for `buildLastSessionSummary`

**File:** `src/lib/__tests__/sessionSummary.test.ts`

Added 4 tests anchoring the behaviour of `buildLastSessionSummary` when
`weightsActual` contains no usable data. These paths are handled correctly by
the existing implementation (the `Array.find` on exercises returns `undefined`
and the function falls through to the run/swim branches or returns `null`), but
were previously unguarded regression surfaces.

| Test | Scenario covered |
|------|-----------------|
| empty exercises array | `weightsActual: { exercises: [] }` → `null` |
| all-null sets | exercises present but all `actualReps`/`actualLoad` null → `null` |
| fallthrough to run | weights with no actual data, run data present → run summary |
| explicit null return | confirmation that null is returned, not a crash |

**Why it matters:** `ActiveWorkoutTracker` can produce an outcome with
`weightsActual.exercises` populated but with all sets having `null` actual
values (if the user starts but cancels without logging anything). Without these
tests, a future refactor of the `find` call could silently break the fallthrough.

**Risk / tradeoff:** Tests only — zero risk to production behaviour.

**Rollback:** Delete the 4 new `it(...)` blocks.

---

### 2. Feature: 7-day activity strip on TodayPage

**File:** `src/pages/TodayPage.tsx`

Added a `WeeklyActivityStrip` component that renders below the stats bar on
TodayPage. It shows the last 7 calendar days (oldest left, today right) as
coloured dots with single-letter day labels.

**Dot colours:**
| Status | Colour |
|--------|--------|
| `complete` (rotation entry) | Emerald filled |
| `day_off` | Amber filled (70% opacity) |
| `skip` | Slate outline ring |
| `extra` (ad-hoc workout, no rotation entry) | Sky filled (60% opacity) |
| `empty` (no entry) | Slate outline ring (50% opacity) |

Today's dot has an additional sky ring to distinguish it from past days.

**Why it matters:** The stats bar already shows aggregate counts (streak,
7-day total, overall total), but gives no information about *which* days
were active. The strip makes patterns visible at a glance — "I consistently
miss Fridays" — without requiring navigation to the Calendar page. It closes
the gap between the daily view and the calendar without duplicating that page.

**Implementation notes:**
- No new store subscriptions: uses `planEntries` and `planExtras` which are
  already computed in TodayPage scope.
- No new utility functions: date arithmetic via `date-fns` `addDays`/`parseISO`
  (library already imported).
- `WeeklyActivityStrip` is a local function component in `TodayPage.tsx`
  rather than a separate file, since it has no other consumers.
- The component uses an internal `useMemo` keyed on `[planEntries, planExtras, today]`
  so it only recomputes when the underlying data changes.

**Risk / tradeoff:** Additive only — no existing UI changed. The strip
appears even on expired plans (the data is still meaningful for review).
If the strip is visually unwanted, deleting the `<WeeklyActivityStrip …/>`
render line and the component function restores the previous state completely.

**Rollback:** Remove the 51-line `WeeklyActivityStrip` function and its
single render call at `src/pages/TodayPage.tsx:528`.

---

## 2026-05-05 (twenty-second pass) — branch `claude/dreamy-mccarthy-phNna`

Baseline on entry: **537 passing, 0 failing**.
Exit state: **548 passing, 0 failing** (+11 tests).

---

### 1. Bug fix: PB detection uses heaviest set, not first set

**File:** `src/lib/sessionSummary.ts`

`buildLastSessionSummary` previously used `ex.sets.find(...)` to select the
first set with any data for both the summary line and PB comparison. If a
session had a warmup set (e.g. 135 lb) followed by heavier working sets
(e.g. 185 lb), the displayed weight would show the warmup and the PB detector
would compare the warmup load — missing a true personal best entirely.

Fixed to select the set with the maximum `actualLoad` (falling back to the
first active set when no loads are recorded). The set count still reflects all
active sets.

**Tests added** (`src/lib/__tests__/sessionSummary.test.ts`):
- "uses heaviest set for display when sets have mixed loads"
- "detects PB using heaviest set, not first set"

---

### 2. Bug fix: suppress unlogged-days nudge when plan is expired

**File:** `src/pages/TodayPage.tsx`

The "N days without entries — rotation may be stalled" nudge had no guard
against `planExpired === true`. A user who completed a plan could see both the
"Plan complete!" banner and the stall nudge simultaneously — contradictory UX.
Added `!planExpired &&` to the nudge's conditional.

---

### 3. Dead code removal: unreachable upcoming modal branch

**File:** `src/pages/TodayPage.tsx`

`getUpcomingDays` returns `ResolvedDay` objects with no `historyEntry` field
populated. The upcoming workout modal contained a 33-line "Already logged —
show status + edit/clear" branch guarded by `loggingUpcoming.rd.historyEntry`,
which is always `undefined`. The entire branch was unreachable. Removed the
dead code and the now-unused `handleUpcomingClear` helper function, leaving
only the action-buttons branch.

---

### 4. Refactor: extract `computePersonalRecords` to `historyStats.ts`

**Files:** `src/lib/historyStats.ts`, `src/pages/HistoryPage.tsx`

`computePersonalRecords` and its `PersonalRecord` interface were defined inside
`HistoryPage.tsx` as exported symbols — making them impossible to test without
rendering the full page. Moved both to `src/lib/historyStats.ts` alongside the
other pure stats helpers. `HistoryPage.tsx` now imports them from there.

**Tests added** (`src/lib/__tests__/historyStats.test.ts`): 7 new tests covering
no-data, single exercise, max-load tracking, max-reps tracking, plan scoping,
all-time mode, and null-load handling.

---

### 5. Feature: fix `progressionStates` orphaning on plan delete

**Files:** `src/store/outcomeStore.ts`, `src/pages/PlansPage.tsx`

`progressionStates` in `outcomeStore` are keyed by `progressionGroupId` (a
free-text ID on run slots). When a plan was deleted, its associated progression
states were never removed — they accumulated silently in localStorage across
plan lifecycles.

Added `removeProgressionStates(groupIds: string[])` to `OutcomeState` and its
implementation. Wired into `PlansPage`'s delete confirm handler: before calling
`deletePlan`, the handler now collects all `runConfig.progressionGroupId` values
from the plan's slots and passes them to `removeProgressionStates`.

**Tests added** (`src/store/__tests__/planDeleteCleanup.test.ts`):
- "removes progressionStates for the deleted plan, leaving other plans intact"
- "removeProgressionStates is a no-op when groupIds is empty"

---

## 2026-05-04 (twenty-first pass) — branch `claude/dreamy-mccarthy-sA0Ai`

Baseline on entry: **469 passing, 0 failing**.
Exit state: **493 passing, 0 failing** (+24 tests).

---

### 1. Tests: `getResolvedDaysRange` coverage (17 new tests)

**Summary:** Added 17 tests for `getResolvedDaysRange` in `rotationEngine.test.ts`. This function is used by CalendarPage to resolve all workout days in a month but had zero test coverage.

**Why it matters:** This is the most complex function in the engine — it handles past/today/future status assignment, pointer advancement for complete/skip/day_off/unlogged days, override application, and rotation wrapping. A bug here would silently produce wrong calendar displays.

**Files changed:** `src/engine/__tests__/rotationEngine.test.ts`

**Risks / tradeoffs:** Purely additive. One test expectation was corrected during authoring (future-day pointer is 0-based from `fromDate`, not pre-advanced like `getUpcomingDays`).

**Rollback:** Delete the new `getResolvedDaysRange` describe block.

---

### 2. Fix: `isPlanExpired` silent always-true for `duration.value === 0`

**Summary:** Added `value <= 0` guard to the rotations-based case of `isPlanExpired`, preventing a zero-rotation plan from immediately triggering the "Plan complete!" banner.

**Why it matters:** `Math.floor(n / days) >= 0` is always true (any non-negative integer is ≥ 0), so a plan created with `duration.value = 0` would flash the expiry banner on first load with zero history. `computePlanProgress` already had this guard (`total <= 0` → return zeros); `isPlanExpired` did not.

**Files changed:** `src/engine/rotationEngine.ts`, `src/engine/__tests__/rotationEngine.test.ts`

**Risks / tradeoffs:** `value = 0` is an invalid config; returning `false` (never expired) is the most conservative safe option. Alternatively one could validate in the plan builder UI; that's a separate UX improvement.

**Rollback:** Remove the `|| value <= 0` from the guard condition.

---

### 3. Fix: Exercise history orphaning on backdate overwrite

**Summary:** When a user backdates a workout to a date that already has a "complete" entry with weights data, the old outcome's `exerciseHistoryStore` records were not cleaned up if the new outcome contained no weights data. Added an explicit `removeOutcome(targetId)` call before `moveOutcome` in both `TodayPage.handleOutcomeConfirm` and `CalendarPage.handleOutcomeConfirm`.

**Why it matters:** `setOutcome` (via `syncExerciseHistory`) only upserts exercise records for the *new* outcome. If the new outcome has no `weightsActual`, old exercise session records at the target key are never removed, growing the exerciseHistoryStore indefinitely and producing stale PRs.

**Files changed:** `src/pages/TodayPage.tsx`, `src/pages/CalendarPage.tsx`

**Risks / tradeoffs:** `removeOutcome` is idempotent (no-op if key doesn't exist), so the extra call is safe. The only scenario where behavior changes is when overwriting an existing complete entry via backdating — the old outcome is now explicitly cleared before the new one is written.

**Rollback:** Remove the two `removeOutcome(targetId)` calls (one in each page).

---

### 4. Feature: Prior session count on today's pending workout card

**Summary:** When today's workout is pending, the `WorkoutDayCard` now shows a small "×N done" label next to the workout title indicating how many times this specific plan day (by rotation index) has been completed previously.

**Why it matters:** Users often want to know "have I done this workout before, and how many times?" before starting. The session count provides quick motivation context without requiring them to open the history view. It's scoped to the exact rotation day so repeating plans show the right count.

**Files changed:**
- `src/lib/historyStats.ts` — added `countPlanDayCompletions()` utility
- `src/lib/__tests__/historyStats.test.ts` — 5 tests for the new function
- `src/components/workout/WorkoutDayCard.tsx` — added optional `sessionCount` prop
- `src/pages/TodayPage.tsx` — computes and passes count to today's card only

**Risks / tradeoffs:** The badge only appears on the pending today card (not upcoming or resolved cards). It's zero when no prior completions exist so no visual noise for new plans. The prop is optional so all other WorkoutDayCard usages are unaffected.

**Rollback:** Remove `sessionCount` prop from WorkoutDayCard and its render logic; remove the `todaySessionCount` computation from TodayPage; remove `countPlanDayCompletions` from historyStats (and its tests).

---

## 2026-04-29 (seventeenth pass) — branch `claude/dreamy-mccarthy-vrC4L`

Baseline on entry: **311 passing, 0 failing**.
Exit state: **315 passing, 0 failing** (+4 tests).

---

### 1. Fix: suppress cycle progress "0/N done" at plan start

**Summary**: On a `rotations`-duration plan with no logged workouts, the
TodayPage subtitle showed "Day 1 of 6 in rotation · 0/6 done". Changed the
display condition from `!cycleProgress.justCompletedRotation` to
`cycleProgress.doneInCycle > 0` so the counter only appears once at least one
`complete` or `skip` has been logged. The "rotation complete!" label is
unaffected.

**Why it matters**: "0/6 done" on day 1 is confusing noise — it implies partial
progress when none exists.

**Files changed**:
- `src/pages/TodayPage.tsx` — condition on cycle progress display (1 line)

**Risks / tradeoffs**: None.

**Rollback**: Revert commit `09e45bf`.

---

### 2. Fix: pass `previousSetsByExercise` to double-day bonus OutcomeModal

**Summary**: The bonus workout OutcomeModal (shown after confirming a double-day
primary workout) was not receiving the `previousSetsByExercise` prop. This meant
historical weight data was unavailable for pre-filling in the bonus modal, even
though it was already computed and used everywhere else. One-line addition.

**Why it matters**: Inconsistent — all other OutcomeModal call sites receive
this prop; the bonus modal was silently missing it.

**Files changed**:
- `src/pages/TodayPage.tsx` — `bonusOutcome` OutcomeModal props (1 line)

**Risks / tradeoffs**: None.

**Rollback**: Revert commit `15f42e4`.

---

### 3. Fix: CalendarPage "Resume workout" uses logged planDayIndex

**Summary**: The "Resume workout" link in DayDetailModal passed `resolved.planDay`
(the rotation projection) to `startHistoricalResume`. If earlier entries were
deleted/edited retroactively, the projection shifts and the wrong exercises load.
Now uses `resolved.historyEntry?.planDayIndex ?? resolved.planDayIndex` to look
up the correct PlanDay, with a safe fallback. Mirrors TodayPage's
`primaryPlanDayIndex` pattern.

**Why it matters**: Without this fix, retroactive history edits cause "Resume
workout" to open the tracker with the wrong exercises.

**Files changed**:
- `src/pages/CalendarPage.tsx` — "Resume workout" onClick in DayDetailModal (5 lines)

**Risks / tradeoffs**: Minimal. Fallback to `resolved.planDay` if the plan was
edited after logging. No behavior change in the normal case.

**Rollback**: Revert commit `5169a90`.

---

### 4. Feature: week progress indicator on TodayPage for weeks-duration plans

**Summary**: Added "· Week X of Y" inline in the TodayPage subtitle for
`weeks`-duration plans, mirroring the "3/6 done" rotation cycle progress from
pass 16. Uses existing `computePlanProgress`. Shows current week (completed+1),
"last week!" on the final week, suppressed when expired. No effect on rotation
plans.

**Why it matters**: Rotation users saw "3/6 done"; weeks users saw nothing.
This creates parity for 8- or 12-week programs.

**Files changed**:
- `src/pages/TodayPage.tsx` — import + `weekProgress` computation + subtitle
  JSX (~14 lines)
- `src/lib/__tests__/historyStats.test.ts` — 4 new week-indicator boundary tests

**Risks / tradeoffs**: Subtitle grows longer on weeks plans (same concern as
pass 16). No store/schema change; purely display-side.

**Rollback**: Revert commit `7a0a61f`.

---

## 2026-04-29 (sixteenth pass) — branch `claude/great-mccarthy-TJqjV`

Baseline on entry: **302 passing, 0 failing**.
Exit state: **311 passing, 0 failing** (+9 tests).

---

### 1. Fix: `deduplicateByDate` uses `createdAt` ordering on import

**Summary**: `importEntries` in `historyStore` deduplicated entries using
insertion-order last-wins. The rotation engine uses newest-`createdAt`-wins
when it encounters duplicates. If an import batch had entries in
reverse-chronological order, the older entry would win — inconsistent with
the engine. Fixed by sorting the batch by `createdAt` (ascending) before
building the deduplication Map so the newest entry always wins.

**Why it matters**: Import data can arrive in any order (CSV exports sort by
date, not necessarily by `createdAt`). The rotation engine would correctly
prefer the newer entry when computing the pointer, but the stored entry after
import might have been the older one — a silent data discrepancy.

**Files changed**:
- `src/store/historyStore.ts` — `deduplicateByDate` function (3-line change)
- `src/store/__tests__/historyStore.test.ts` — new test for reverse-order import

**Risks / tradeoffs**: None. `createdAt`-newest-wins is the documented engine
behavior; the change makes import consistent with it.

**Rollback**: Revert the relevant commit.

---

### 2. Fix: Memoize `flatItems` in HistoryPage

**Summary**: The unified sorted flat list of rotation + extra entries in
`HistoryPage` was computed inline on every render. Wrapped it (and its
`filteredEntries` / `filteredExtras` dependencies) in `useMemo` so the sort
only runs when the underlying data or filter changes.

**Why it matters**: Any Zustand store subscription in `HistoryPage` triggers a
re-render, which previously re-sorted potentially hundreds of items. Also
`typeCountMap` was already memoized on `flatItems`, so without memoizing
`flatItems` itself the downstream memo was only partially effective.

**Files changed**:
- `src/pages/HistoryPage.tsx` — `filteredEntries`, `filteredExtras`, `flatItems`
  wrapped in `useMemo`

**Risks / tradeoffs**: None. Pure performance improvement, no behavior change.

**Rollback**: Revert the relevant commit.

---

### 3. Fix: Confirm before deleting extras in HistoryPage list view

**Summary**: The trash icon on extra workout cards in the HistoryPage flat
list deleted immediately on single tap — no confirmation. Added a two-step
inline confirm: first tap shows "Delete" + "✕" buttons; second tap (Delete)
executes the deletion. The "✕" cancels back to the normal state.

**Why it matters**: A single misclick permanently removes logged workout data.
The rotation-entry delete already required a modal confirm; this brings extras
to the same safety level for the faster inline action.

**Files changed**:
- `src/pages/HistoryPage.tsx` — `confirmDeleteExtraId` state + conditional render

**Risks / tradeoffs**: Slightly more taps to delete; consistent with existing
confirmation patterns elsewhere.

**Rollback**: Revert the relevant commit.

---

### 4. Feature: Rotation cycle progress on TodayPage

**Summary**: Added `computeRotationCycleProgress` to `historyStats.ts`. For
`rotations`-duration plans it returns `{ doneInCycle, rotationLength, remaining,
justCompletedRotation }`. TodayPage uses this to display "3/6 done" inline
with the existing "Day X of N in rotation" subtitle, plus micro-labels at the
last day ("last one!") and immediately after a full rotation completes
("rotation complete!"). Returns `null` for `weeks`-duration plans.

**Why it matters**: Users had no visible indicator of how far through their
current rotation they were — the "Day X of N" shows the rotation pointer, not
the count of logged workouts in the current cycle. This gives a concrete "how
close am I to finishing this loop?" signal.

**Files changed**:
- `src/lib/historyStats.ts` — new `computeRotationCycleProgress` helper + export
- `src/pages/TodayPage.tsx` — import + `cycleProgress` variable + header display
- `src/lib/__tests__/historyStats.test.ts` — 9 new tests (import updated)

**Risks / tradeoffs**: `day_off` entries don't count (mirrors `isPlanExpired`).
The "rotation complete!" state (doneInCycle === 0 after at least one full cycle)
shows briefly until the next workout is logged. Weeks plans see no change.

**Rollback**: Revert the relevant commit.

---

## 2026-04-28 (fifteenth pass) — branch `claude/great-mccarthy-6NVvu`

Baseline on entry: **293 passing, 0 failing**.
Exit state: **302 passing, 0 failing** (+9 tests).

---

### 1. Fix: `replace` → `replaceAll` for action string display (3 files)

**Summary**: Three places displayed history action strings (e.g. `day_off`) using
`.replace('_', ' ')`, which only replaces the first underscore. Changed to
`.replaceAll` to be consistent with the fix applied to workout-type strings in
pass 13.

**Why it matters**: Currently harmless (action values have at most one underscore),
but inconsistent with the rest of the codebase and would silently break if any
future action type contained multiple underscores.

**Files changed**:
- `src/pages/HistoryPage.tsx` — stateLabel fallback
- `src/pages/CalendarPage.tsx` — DayDetailModal rotation-entry action badge
- `src/pages/TodayPage.tsx` — upcoming-log modal status badge

**Risks / tradeoffs**: None. No behavior change for any current action value.

**Rollback**: Revert commit `b35782a`.

---

### 2. Feature: Training-mix summary row on HistoryPage

**Summary**: Below the four stat tiles (Streak / 7-day / 30-day / Total), a compact
text line now shows the count of completed workouts per type for the current
filter, e.g. "12 weights · 5 runs · 2 yoga". Sorted by count descending, capped
at 4 types, hidden when no data.

**Why it matters**: `computeWorkoutTypeBreakdown` has existed since pass 12 but
was never surfaced in the UI. Users had no way to see their training distribution
at a glance. The mix line gives instant visibility into whether the plan is
balanced.

**Files changed**:
- `src/pages/HistoryPage.tsx` — adds `useMemo` import, `TYPE_MIX_LABEL` map,
  `typeCountMap` / `typeMixLabel` memos, and the JSX row.

**Risks / tradeoffs**: Inline computation rather than `computeWorkoutTypeBreakdown`
(avoids the multi-plan `planDaysById` keying problem for "all plans" mode).
No new tests needed (pure derivation from `flatItems` which is already tested
transitively).

**Rollback**: Revert commit `91075c9`.

---

### 3. Feature (medium): Past unlogged days nudge on TodayPage

**Summary**: A new pure helper `countPastUnloggedDays` counts days in the past
7 days with no history entry for the active plan. When count > 0, TodayPage
shows a muted clickable banner — "N day(s) in the past week without entries —
rotation may be stalled. [Calendar →]" — that navigates to CalendarPage on tap.

**Why it matters**: The rotation engine intentionally stalls when past days are
unlogged, but this is invisible to the user. A user returning after several days
off sees a "wrong" workout with no explanation. The nudge surfaces the root cause
and provides a direct path to resolution.

**Files changed**:
- `src/lib/historyStats.ts` — new exported `countPastUnloggedDays` function
- `src/lib/__tests__/historyStats.test.ts` — 9 new tests for the helper
- `src/pages/TodayPage.tsx` — import + `unloggedCount` computation + nudge JSX

**Risks / tradeoffs**:
- False positives: users who intentionally skipped a week see the nudge. Mitigated
  by muted styling and "may be stalled" (not "is stalled") phrasing.
- Not dismissible this pass — follow-up if user feedback shows it's annoying.
- Nudge appears even after plan expiry (minor, cosmetically odd).

**Rollback**: Revert commits `9c53fba` and `7c64fc7`.

---

## 2026-04-27 (fourteenth pass) — branch `claude/great-mccarthy-GNrKl`

Baseline on entry: **291 passing, 0 failing**.
Exit state: **293 passing, 0 failing** (+2 tests).

### Commits

| SHA | Commit message |
|-----|---------------|
| fd0debc | fix(historyStore): accept undefined planDayIndex in logAction for day_off |
| e72e96a | fix(CalendarPage): re-anchor rotation after retroactive jump removal |
| f48a501 | feat(PlansPage): show plan progress on each plan card |

> Note: the "Today" CalendarPage button was committed together with the
> bug fix in e72e96a (both changes touch CalendarPage.tsx). The commit
> message emphasises the bug fix; the button is a small additive change.

---

### 1. fix(historyStore): logAction planDayIndex type

**Summary**: `logAction` required `planDayIndex: number` even for `day_off`
actions, where the value is immediately discarded (set to `undefined` in
`addEntry`). `usePlanActions.dayOff()` passed `-1` as a dummy value.
Changed type to `number | undefined`; updated `dayOff()` to pass
`undefined` directly.

**Why it matters**: Eliminates a misleading type that could confuse future
readers and tools. No behavior change on the happy path; `day_off` entries
already stored `planDayIndex: undefined` regardless of what was passed.

**Files changed**:
- `src/store/historyStore.ts` — interface: `number` → `number | undefined`
- `src/hooks/usePlanActions.ts` — `dayOff()`: `-1` → `undefined`
- `src/store/__tests__/historyStore.test.ts` — +1 test for new calling convention

**Risk**: None. `logAction` implementation ignores the value for `day_off`
regardless. Existing tests continue to pass since the old numeric API is
still accepted by the `number | undefined` type.

**Rollback**: `git revert fd0debc`

---

### 2. fix(CalendarPage): retroactive jump re-anchor

**Summary**: `logForDate` in CalendarPage called `removeRetroJumpForDate`
then only added a replacement jump if `selectedPlanDayIdx !== rd.planDayIndex`.
The bug: `rd.planDayIndex` was computed WITH the jump applied. When the user
confirmed the same planDayIndex that was already showing (via the old jump),
the condition was `false` — no replacement was added. The jump was gone and
the rotation silently shifted for all subsequent dates.

**Example**: Day 5 shows Day 2 (via jump). User logs Day 2 again (confirms
same day). Old jump removed, no new jump added. Now Day 5 naturally shows
a different rotation position. Day 6 onward is off by N positions.

**Fix**: Before calling `removeRetroJumpForDate`, check whether a jump
override exists for that date (`hadJump`). If it did, always add a new
jump to `selectedPlanDayIdx` (for non-`day_off` actions) so the rotation
stays anchored regardless of whether the user changed the index or not.

**Why it matters**: Without the fix, a user who opens a retroactively-logged
calendar day and saves it without changes can corrupt their rotation for
all future dates — with no visible feedback.

**Files changed**:
- `src/pages/CalendarPage.tsx` — `logForDate`: added `hadJump` check + new condition
- `src/engine/__tests__/rotationEngine.test.ts` — +1 regression test documenting
  the "removing jump without re-anchor shifts subsequent rotation" invariant

**Risk**: Minimal. The new code path only adds an override when one is being
replaced. If `hadJump` is `false` and `selectedPlanDayIdx === rd.planDayIndex`,
no override is added (same as before). The only new override is a jump to the
user-selected day when an old jump existed — which is strictly more correct.

**Rollback**: `git revert e72e96a` (also reverts Today button)

---

### 3. feat(CalendarPage): Today button in month nav

**Summary**: A "Today" badge appears next to the month title when the user
has navigated away from the current month. Clicking it resets to the current
year/month. Hidden when already on the current month.

**Why it matters**: Reduces friction when reviewing past months — one tap
back to the current date instead of repeatedly clicking the forward arrow.

**Files changed**: `src/pages/CalendarPage.tsx` (same commit as bug fix)

**Risk**: Zero. Purely additive; `goToToday` sets two existing state vars.

**Rollback**: Reverts with bug fix commit e72e96a.

---

### 4. feat(PlansPage): plan progress on plan cards

**Summary**: Wires `computePlanProgress` (added in eleventh pass, never
surfaced in the UI) into `PlanCard`. Each card now shows completed/total
units and a percentage when any progress has been logged. Display is
suppressed for plans with no progress to keep cards clean.

**Example display**: "4 days · 4 rotations · 2/4 done (50%)"

**Why it matters**: Users could not see how far through a plan they were
without navigating away. The helper was production-ready (15 tests) and
was explicitly recommended for UI wiring in the eleventh pass.

**Files changed**:
- `src/pages/PlansPage.tsx` — imports `computePlanProgress`, adds display to `PlanCard`

**Risk**: Zero. `computePlanProgress` is a pure function, fully tested. No
store changes. Display only appears when `progress.completed > 0` so it
does not affect the look of plans with no history.

**Rollback**: `git revert f48a501`

---

## 2026-04-27 (thirteenth pass) — branch `claude/great-mccarthy-PqhIm`

Baseline on entry: **286 passing, 0 failing**.
Exit state: **291 passing, 0 failing** (+5 tests).

### Commits

| SHA | Commit message |
|-----|---------------|
| 292125c | fix(formatPace): prevent seconds overflow producing "9:60 /mi" |
| 3658166 | fix(isPlanExpired): add explicit zero-day guard |
| 1e1a509 | fix(TodayPage): use replaceAll for workout type display |
| 98e186a | fix(csv): preserve ExtraWorkoutEntry.source across export/import |
| 48d8819 | feat(TodayPage): add compact stats bar (streak, this-week, total) |

### Bug fixes

**1. `formatPace` — second-overflow (9:60 /mi)**
`Math.round(secondsPerMile % 60)` produces 60 when the fractional remainder
rounds up. Fixed: round total seconds first, then integer-divide for mins/secs.
File: `src/modules/workout-outcomes/types.ts`. Tests: +3.

**2. `isPlanExpired` — zero-day plan guard**
0-day plan caused implicit NaN/Infinity arithmetic. Added explicit
`if (plan.days.length === 0) return false` guard.
File: `src/engine/rotationEngine.ts`. Tests: +1.

**3. TodayPage — `replace` → `replaceAll` for type display**
`String.replace(string, string)` only replaces the first occurrence.
Used `replaceAll` for consistent multi-underscore type formatting.
File: `src/pages/TodayPage.tsx`. Tests: none (UI-only).

**4. CSV — `ExtraWorkoutEntry.source` preservation**
`source` field was silently dropped on export. Added `extraSource` column,
backward-compatible with old exports (empty/absent → `undefined`).
File: `src/lib/csv.ts`. Tests: +1 round-trip test.

### Feature

**5. Compact stats bar on TodayPage**
Three-tile row (streak / this-week / total) wired to `computeHistoryStats`.
Scoped to active plan. No new logic — purely wiring + UI.
File: `src/pages/TodayPage.tsx`.

---

## 2026-04-26 (twelfth pass) — branch `claude/great-mccarthy-bM0YZ`

Baseline on entry: **267 passing, 0 failing**.
End state: **286 tests pass** (+19).

Scope: one bug fix (CSV idempotency), three edge-case tests, one medium-
complexity feature (breakdown utility + 14 tests). No new dependencies.
No UI changes.

---

### 1. fix(csv): preserve extraId on re-import to prevent duplicate extras

**Summary**: `historyFromCsv` always generated a fresh `nanoid()` for every
`ExtraWorkoutEntry`. Re-importing the same CSV created duplicate extras because
`importExtraEntries` deduplicates by ID but the IDs were always new.

**Fix**: Added an optional `extraId` column to the history CSV header. On export,
extra rows now include their original `id`. On import, the value is reused when
present so re-importing the same file is idempotent. Older CSVs without the
column fall back to fresh IDs (backward compatible).

**Why it matters**: Users who export history as a backup and re-import it were
silently accumulating duplicate extra workout entries (double-day bonuses, manual
extras). Rotation entries were unaffected (they deduplicate by `planId+calendarDate`).

**Files changed**:
- `src/lib/csv.ts` — added `extraId` to `HISTORY_HEADERS`, updated `historyToCsv`
  and `historyFromCsv`
- `src/lib/__tests__/csv.test.ts` — updated and added tests for idempotent
  re-import and backward-compatibility with old exports

**Risks**: None. The new column is optional on import. Old CSV files parse
exactly as before. The column is blank for rotation rows.

**Rollback**: `git revert 93c61ac`. No data migration required.

---

### 2. test: edge-case coverage for rotation engine and historyStats

**Summary**: Four edge cases that were handled correctly by the implementation
but had no tests documenting the expected behavior.

**Tests added**:
- `computeCurrentDayIndex` with `targetDate` before `plan.startDate` → returns
  `startDayIndex` (negative dayCount → loop skips).
- `getUpcomingDays` with a single-day plan → always projects day 0 (mod 1 = 0).
- `isPlanExpired` with a 0-day plan + rotations duration → `Math.floor(0/0) = NaN`,
  `NaN >= value` is false → never expired.
- `computePlanProgress` with `duration.value = 0` → returns zeros via `total <= 0`
  guard.

**Files changed**:
- `src/engine/__tests__/rotationEngine.test.ts` (+3 tests)
- `src/lib/__tests__/historyStats.test.ts` (+1 test)

**Risks**: None.

---

### 3. feat(stats): computeWorkoutTypeBreakdown utility (medium-complexity feature)

**Summary**: New pure function that aggregates per-workout-type completion counts,
skip counts, and average effort from history entries, extras, and outcomes.

**API**:
```typescript
computeWorkoutTypeBreakdown(
  entries: HistoryEntry[],
  extras: ExtraWorkoutEntry[],
  outcomes: Record<string, WorkoutOutcome>,
  planDaysById: Map<number, { slots: Array<{ type: WorkoutType }> }> | null,
  dateRange?: { from: string; to: string },
): WorkoutTypeBreakdown
// WorkoutTypeBreakdown = Partial<Record<WorkoutType, WorkoutTypeStat>>
// WorkoutTypeStat = { completed, skipped, avgEffort: number | null }
```

**Why it matters**: Users training across multiple workout types (lifting + running
+ yoga) have no view of which types they actually logged most or where their effort
is highest. The data exists in the history; this function surfaces it.

**Files changed**:
- `src/lib/historyStats.ts` — added `WorkoutTypeStat`, `WorkoutTypeBreakdown`,
  `computeWorkoutTypeBreakdown`
- `src/lib/__tests__/historyStats.test.ts` — 14 tests covering all branches
- `FEATURE_PROPOSAL.md` — added twelfth-pass entry

**No UI integration in this pass.** The function is production-ready; the
developer can wire it into HistoryPage stats or a future analytics view.

**Risks**: Low. Pure function, no store changes, no persistence. Multi-slot days
are attributed to the first slot type (documented assumption).

**Rollback**: Delete function and types from `historyStats.ts`, remove tests.

---

## 2026-04-25 (eleventh pass) — branch `claude/great-mccarthy-0XEfh`

Baseline on entry: **222 passing, 0 failing**.
End state: **267 tests pass**.

Scope: one bug fix, two test-coverage gaps closed, and one medium-complexity
feature (pure function + tests). No new dependencies. No UI changes.

### Commits (oldest → newest)

1. **Docs: IMPLEMENTATION_PLAN.md and FEATURE_PROPOSAL.md** (part of final doc commit)
   Audit findings, fix rationale, feature proposal for `computePlanProgress`.
   - `IMPLEMENTATION_PLAN.md`, `FEATURE_PROPOSAL.md`
   - **Risk**: none (doc only).

2. **Fix: `importEntries` deduplicates within the incoming batch** (`29444c5`)
   `importEntries` removed existing store entries for colliding keys but did not
   deduplicate the incoming batch itself. Two rows with the same `(planId,
   calendarDate)` both survived, breaking the one-entry-per-(plan,date) invariant.
   Added `deduplicateByDate()` helper (last-wins per key) applied to the batch
   before any store mutation. Four new tests added (happy path, replace-existing,
   intra-batch dedup, no-op on empty) — the entire `importEntries` surface was
   previously untested.
   - `src/store/historyStore.ts`, `src/store/__tests__/historyStore.test.ts`
   - **Risk**: very low. The fix is strictly more correct; existing tests unchanged.
   - **Rollback**: revert this commit. The only behavior change is that a malformed
     CSV with duplicate dates no longer creates duplicate store entries.

3. **Tests: `recommendation/explanation.ts` coverage (0 → 22 tests)** (`3395e74`)
   All three exported functions were previously untested. `summariseRunOutcome` has
   non-trivial formatting logic (pace string as "M:SS /mi", dot-separator joining,
   null-field omission) that could silently regress on a refactor. New test file
   covers all meaningful paths for all three functions.
   - `src/modules/recommendation/__tests__/explanation.test.ts` (new file)
   - **Risk**: none (additive tests only).

4. **Tests: `evaluateRunProgression` edge-case coverage** (`7d2cbc3`)
   Three previously uncovered branches: (1) effort=5 + partially_completed confirms
   the high-effort regress fires before the partial check; (2) completed + 80–95% of
   target → default_hold (the "almost-but-not-quite" case); (3) completedAsPlanned=false
   + no distance → hold. Appended to the existing engine test describe block.
   - `src/modules/run-adaptation/__tests__/engine.test.ts`
   - **Risk**: none (additive tests only).

5. **Feature: `computePlanProgress` helper** (`0c4d145`)
   Pure function in `src/lib/historyStats.ts` that returns `{ completed, total,
   percentComplete }` for any plan. Supports both duration types:
   - `rotations`: counts complete/skip entries, floors to full rotations.
   - `weeks`: counts calendar weeks elapsed since startDate, floor division.
   Both cap at the plan's total and return 0 for edge cases (empty plan,
   pre-start date). 15 tests cover all paths. No UI changes this run.
   - `src/lib/historyStats.ts`, `src/lib/__tests__/historyStats.test.ts`
   - **Risk**: very low. Additive pure function; no store or UI coupling.
   - **Rollback**: revert this commit. No data is written.

---

## 2026-04-24 (tenth pass) — branch `claude/great-mccarthy-hYhLK`

Baseline on entry: **210 passing, 0 failing**.
End state: **222 tests pass**.

Scope: two correctness fixes, one visual improvement, one medium-complexity
feature, and 12 new tests. No new dependencies.

### Commits (oldest → newest)

1. **Plan/docs update for tenth pass** (`8b9030b`)
   IMPLEMENTATION_PLAN.md: documents findings, fix plan, rationale.
   - `IMPLEMENTATION_PLAN.md`
   - **Risk**: none (doc only).

2. **Fix: HistoryPage edit-modal close-trap on date conflict** (`b079a9e`)
   `saveAndClose` was passed to both `onClose` (X button / backdrop) and the
   explicit Save button. On a date conflict, `saveAndClose` early-returned
   without closing, trapping the user. Split into `discardAndClose` (always
   closes, passed to `onClose`) and `saveAndClose` (validates + commits,
   stays on the Save button). No behavior change on the save-succeeds path.
   Deferred since the fifth pass; implemented this pass.
   - `src/pages/HistoryPage.tsx`
   - **Risk**: very low. The save path is unchanged; only the X / backdrop
     path changes (now discards rather than attempting to save).
   - **Rollback**: revert this commit to restore original behavior (both
     paths call `saveAndClose`).

3. **Fix: guard durationActualMin against negative values in OutcomeModal** (`4994634`)
   `handleConfirm` used `parseFloat(durationMin) || null`, which passed through
   negative inputs. All adjacent numeric fields already guard with
   `isFinite(n) && n > 0`. This commit mirrors that pattern.
   - `src/components/workout/OutcomeModal.tsx`
   - **Risk**: none. Negative durations are nonsensical; previously they
     corrupted stored outcomes silently.
   - **Rollback**: revert this commit to restore the original guard.

4. **UX: show 'Bonus' pill for double-day extras in History** (`76a9231`)
   The `ExtraWorkoutEntry.source` field was added in the sixth pass to enable
   this distinction. History was still showing a generic 'Extra' pill for both
   manually-added extras and double-day bonus workouts. Extras with
   `source === 'double_day'` now display a violet 'Bonus' pill.
   - `src/pages/HistoryPage.tsx`
   - **Risk**: none (purely additive visual change, no data impact).
   - **Rollback**: revert this commit.

5. **Feature: dismissible plan expiry banner** (`9c91919`)
   The 'Plan complete!' banner showed on every TodayPage visit once a plan
   expired, with no way to dismiss it. Added `useExpiryDismiss` hook (per-plan
   localStorage key, `wpt_expiry_dismissed_v1_<planId>`). TodayPage hides the
   banner when dismissed and shows a small × button to trigger dismiss.
   See FEATURE_PROPOSAL.md and FEATURE_REVIEW.md for full design rationale.
   - `src/hooks/useExpiryDismiss.ts` (new file)
   - `src/pages/TodayPage.tsx`
   - `FEATURE_PROPOSAL.md`
   - **Risk**: very low. No store changes. localStorage exception is caught
     gracefully. Rollback: revert this commit; no data loss.

6. **Tests: useExpiryDismiss storage contract + durationActualMin guard** (`dfe3803`)
   12 new tests in `src/hooks/__tests__/useExpiryDismiss.test.ts`:
   - 6 tests for the localStorage key contract (isolation by planId, absence
     = false, '1' = true, other values = false). Uses `vi.stubGlobal` to
     provide an in-memory mock for the node test environment.
   - 6 tests for the `durationActualMin` guard logic (positive int/decimal,
     zero, negative, empty string, non-numeric).
   - 210 → 222 tests passing.
   - `src/hooks/__tests__/useExpiryDismiss.test.ts` (new file)
   - **Risk**: none (tests only).

---

## 2026-04-23 (ninth pass) — branch `work`

Baseline on entry: **206 passing, 0 failing**.
End state: **210 tests pass**.

Scope: one low-risk correctness fix in History plan filtering (extras-only plans now counted as having history), plus additive test/documentation updates. No new dependencies.

### Commits (oldest → newest)

1. **Plan/docs update for ninth pass**
   Added a dated audit section with findings, sequencing, and deferred items.
   - `IMPLEMENTATION_PLAN.md`
   - **Risk**: none (doc only).

2. **Fix: include extras in plan-history detection for HistoryPage filter/default**
   Introduced `getPlansWithHistory` + `hasPlanHistory` helpers so History page
   treats either rotation entries or extra workouts as valid history activity.
   This fixes the extras-only edge case where a plan could be hidden from the
   filter options and skipped as the initial active-plan filter selection.
   - `src/lib/historyScope.ts`
   - `src/pages/HistoryPage.tsx`
   - `src/lib/__tests__/historyScope.test.ts`
   - **Risk**: low. Only broadens history detection criteria to match real logged data.
   - **Rollback**: revert this commit to return to entries-only behavior.

### Dropped / not attempted

- Medium-complexity feature intentionally skipped; stabilization took precedence.
- Prior open recommendations (edit modal close trap, progression-state cleanup) remain deferred.

## 2026-04-21 (eighth pass) — branch `claude/epic-cannon-Ltjw1`

Baseline on entry: **194 passing, 0 failing**.
End state: **206 tests pass**.

Scope: two correctness fixes around `extraEntries` visibility — one
in the History stats summary (display inconsistency) and one in the
CSV round-trip (silent data loss on backup/restore). No new features,
no new dependencies. One schema addition to the history CSV
(additive, backward-compatible).

### Commits (oldest → newest)

1. **`519dbb4` — Plan: 2026-04-21 eighth-pass audit**
   IMPLEMENTATION_PLAN.md section. No code changes.
   - `IMPLEMENTATION_PLAN.md`
   - **Risk**: none (doc only).

2. **`3f78bae` — Fix: include extraEntries in History stats tiles**
   `computeHistoryStats(entries, today)` became
   `computeHistoryStats(entries, extras, today)`. Extras count as
   completed workouts for totals, 7/30-day windows, and the current
   streak. Extras participate in the streakable-days set, so an
   extras-only day extends the streak and an extra backfills a day
   that's been logged as `skip`. HistoryPage's one callsite passes
   `filteredExtras` through and the stat tiles now render when there
   are extras even if no rotation entries exist.
   - `src/lib/historyStats.ts`
   - `src/lib/__tests__/historyStats.test.ts`
   - `src/pages/HistoryPage.tsx`
   - **Risk**: low. Behaviour change is intentional — aligns stat
     tiles with the flat list already rendered in the page header.
     Reviewers: expect "Streak" / "Total" numbers to be non-zero
     for users who have extras. If you prefer the old semantics,
     revert — every caller goes through HistoryPage.
   - **Rollback**: `git revert 3f78bae`.

3. **`87e78ec` — Fix: CSV history export/import now round-trips extraEntries**
   The history CSV used to drop every `ExtraWorkoutEntry` silently —
   exports omitted them, imports couldn't produce them. Added three
   columns to the history CSV header: `entryKind` (`rotation`|`extra`),
   `workoutType`, `workoutName`. Rotation rows leave workoutType/
   workoutName blank; extra rows leave planDayIndex/action/slotNames
   blank. Legacy CSVs without `entryKind` default to rotation, so
   previously-exported files continue to import cleanly.
   `historyFromCsv` now returns an `extras: ExtraWorkoutEntry[]` array
   alongside `entries`; a new `historyStore.importExtraEntries` appends
   them (deduplicated by id). Outcomes attached to extras are rekeyed
   to the freshly generated extra id so they survive the round-trip
   under the correct `makeExtraWorkoutInstanceId` key.
   - `src/lib/csv.ts`
   - `src/lib/__tests__/csv.test.ts`
   - `src/store/historyStore.ts`
   - `src/store/__tests__/historyStore.test.ts`
   - `src/pages/HistoryPage.tsx`
   - **Risk**: medium-low. The CSV header grew and column order
     changed (entryKind is first). Old exports still parse correctly
     (tested). New exports are not round-trip-compatible with an
     older version of the app that expects the old header order —
     but this app ships from a single branch, so that's only a
     concern if someone installs an old PWA version and imports a
     new export. The import summary string also changed format
     slightly to include extras when present.
   - **Rollback**: `git revert 87e78ec`. Reverts both the export and
     import paths; old extras in storage stay put.

### Dropped / not attempted

- HistoryPage saveAndClose trap on date conflict — still open from
  the seventh pass. Fix wants a dedicated Cancel button.
- `progressionStates` orphaning on plan delete — still needs a
  schema change.
- `swap_slot` override UI, plan-expiry dismiss — unchanged.
- Upcoming-complete-when-today-logged routed through
  ExtraWorkoutEntry — still an open product question.
- Medium-complexity feature — declined. The two findings here are
  both real correctness/data-loss issues; fixing them is enough for
  the night.

---

## 2026-04-19 (seventh pass) — branch `claude/gracious-heisenberg-2fsGC`

Baseline on entry: **192 passing, 0 failing**.
End state: **194 tests pass**.

Scope: one real data-loss guard (TodayPage upcoming-log overwrite);
one pure refactor (CalendarPage action-sync); one DRY refactor
(OutcomeMetrics extraction); one invariant test. No new features, no
schema changes, no new dependencies.

### Commits (oldest → newest)

1. **`638dfca` — Plan: 2026-04-19 seventh-pass audit**
   IMPLEMENTATION_PLAN.md section. No code changes.
   - `IMPLEMENTATION_PLAN.md`
   - **Risk**: none (doc only).

2. **`ab5fcd2` — Fix: guard TodayPage upcoming-log against overwriting today's entry**
   When today is already logged (today_complete, today_skip, or
   today_day_off) and the user opened an upcoming-day modal and picked
   "Complete", `handleUpcomingLog` built `logDate = today` and called
   `logAction(plan.id, today, rd.planDayIndex, 'complete')`. Because
   `addEntry` dedupes on `(planId, calendarDate)` and replaces, the
   primary entry was silently overwritten with the upcoming slot's
   `planDayIndex`. Guarded the overwrite: surfaced an inline error
   ("Today is already logged. Undo it first, or toggle double-day on a
   pending day to record two workouts.") and refused the log. No
   behaviour change for the intended path (upcoming-complete when
   today is still pending).
   - `src/pages/TodayPage.tsx`
   - **Risk**: low. Additive guard; only changes behaviour in the
     previously-broken path where data was being lost silently. The
     text of the error is a UX choice — revisit if you'd rather
     permit the action via ExtraWorkoutEntry.
   - **Rollback**: `git revert ab5fcd2`.

3. **`7a980ca` — Refactor: CalendarPage action-sync uses updateEntryAction**
   `handleOutcomeConfirm` was calling `addEntry({ ...entry, action })`
   to sync the history entry's action to the OutcomeModal's
   completion state. This worked because `addEntry`'s payload spread
   preserved id/createdAt, but it was semantically misleading and
   fragile — any future change to `addEntry`'s dedupe would silently
   break it. Switched to `updateEntryAction` (same helper HistoryPage
   already uses for the same purpose).
   - `src/pages/CalendarPage.tsx`
   - **Risk**: none. Zero behaviour change.
   - **Rollback**: `git revert 7a980ca`.

4. **`ee75b11` — Refactor: extract OutcomeMetrics to a shared component**
   The effort-dots + run-actuals + duration block was duplicated
   three times — once as a local helper in CalendarPage, and twice
   inlined in HistoryPage (rotation entries and extras). Extracted to
   `src/components/workout/OutcomeMetrics.tsx`. Normalised one
   stylistic drift (CalendarPage's "w-10" label column dropped in
   favour of HistoryPage's inline "Effort:" form).
   - `src/components/workout/OutcomeMetrics.tsx` (new)
   - `src/pages/CalendarPage.tsx`
   - `src/pages/HistoryPage.tsx`
   - **Risk**: very low. Visual: Calendar day-detail modal's Effort
     row is now slightly narrower (no dedicated label column). No
     logic change.
   - **Rollback**: `git revert ee75b11`.

5. **`835a030` — Tests: lock invariant behind TodayPage upcoming-log guard**
   Added two tests under a new "TodayPage upcoming-log guard
   invariant" describe block, pinning down the replace-on-collision
   behaviour of `logAction` → `addEntry` the guard exists to prevent.
   A future refactor of `addEntry` can't silently re-introduce the
   data-loss path without tripping these tests.
   - `src/store/__tests__/historyStore.test.ts`
   - **Risk**: none (tests only).
   - **Rollback**: `git revert 835a030`.

### Rollback of entire pass

```sh
git revert 835a030 ee75b11 7a980ca ab5fcd2 638dfca
```

Each commit is independently revertable and commutes with the others
except that the test (commit 5) explicitly references the guard's
invariant and would pass just as well after reverting the guard
itself (the tests describe `addEntry`'s behaviour, not the guard
logic).

---

## 2026-04-18 (sixth pass) — branch `claude/overnight-audit-improvements-RzBkA`

Baseline on entry: **176 passing, 0 failing**.
End state: **192 tests pass**.

Scope: one re-opened data-correctness bug (CalendarPage OutcomeModal
writing extra-entry outcomes to the wrong key — the exact peer of the
HistoryPage fix from the fifth pass that Calendar had missed); one
consistency fix; 13 new tests for previously uncovered store actions;
and a medium-complexity feature (ExtraWorkoutEntry.source) that resolves
the open product question from the fifth-pass review.

### Commits (oldest → newest)

1. **`729879c` — Plan: 2026-04-18 sixth-pass audit**
   IMPLEMENTATION_PLAN.md section. No code changes.
   - `IMPLEMENTATION_PLAN.md`
   - **Risk**: none (doc only).

2. **`f681c9f` — CalendarPage: pass workoutInstanceId to OutcomeModal for extra entries**
   When `openExtraOutcome` set `outcomeTarget.instanceId` to the extra's
   key (`makeExtraWorkoutInstanceId(...)`), the OutcomeModal was rendered
   without `workoutInstanceId={outcomeTarget.instanceId}`. The modal
   therefore fell back to `makeWorkoutInstanceId(planId, calendarDate)`
   and wrote the extra's outcome to the primary rotation slot's key —
   silently overwriting it. One-line fix; exact mirror of commit
   `7969378` (fifth pass, HistoryPage).
   - `src/pages/CalendarPage.tsx`
   - **Risk**: low. Purely additive prop; existing callers for the primary
     rotation outcome pass the same value as before.
   - **Rollback**: `git revert f681c9f`.

3. **`ab8d7f0` — TodayPage: normalize date string to format(new Date(), 'yyyy-MM-dd')**
   TodayPage was the only file using `new Intl.DateTimeFormat('en-CA').format()`
   to produce a YYYY-MM-DD local date string. Every other file uses
   date-fns `format()`. Both produce identical output, but the
   inconsistency made the codebase harder to scan.
   - `src/pages/TodayPage.tsx`
   - **Risk**: none. No behavior change.
   - **Rollback**: `git revert ab8d7f0`.

4. **`762f9bc` — Tests: cover updateEntryDate, updateExtraEntryDate, clearExtraEntriesForDate**
   Three store actions added during the fourth pass for calendar
   date-editing had no test coverage. Added 13 tests: 3 for
   `updateEntryDate`, 4 for `updateExtraEntryDate`, 4 for
   `clearExtraEntriesForDate`.
   - `src/store/__tests__/historyStore.test.ts`
   - **Risk**: none (tests only).
   - **Rollback**: `git revert 762f9bc`.

5. **`4a16d9b` — Plan: ExtraWorkoutEntry.source field — feature proposal**
   FEATURE_PROPOSAL.md. No code changes.
   - `FEATURE_PROPOSAL.md`
   - **Risk**: none (doc only).

6. **`d865ff9` — Feature: ExtraWorkoutEntry.source field + scoped Undo on TodayPage**
   Added optional `source?: 'history' | 'double_day'` to
   `ExtraWorkoutEntry` (backward-compatible). Updated three creation
   paths: TodayPage double-day passes `'double_day'`; HistoryPage and
   CalendarPage "Add workout for this day" pass `'history'`. Undo on
   TodayPage now removes only extras where `source !== 'history'`
   (double_day + legacy undefined = removed; history = left alone).
   - `src/types/index.ts`, `src/pages/TodayPage.tsx`,
     `src/pages/HistoryPage.tsx`, `src/pages/CalendarPage.tsx`
   - **Risk**: low. Schema change is additive. Old extras without `source`
     are treated like double_day (conservative — prevents orphaned extras).
     Manually-added extras on today's date now survive an Undo on Today.
   - **Rollback**: `git revert d865ff9`. Old extras still have no source
     field; the only side-effect is Undo reverts to clearing all extras
     for the date.

7. **`948cfaf` — Tests: ExtraWorkoutEntry.source field and Undo scoping invariants**
   6 new tests: source field persisted correctly for both values and for
   the legacy undefined case; Undo filter (source !== 'history') removes
   only the right records in mixed, all-double_day, and all-history
   scenarios.
   - `src/store/__tests__/historyStore.test.ts`
   - **Risk**: none (tests only).
   - **Rollback**: `git revert 948cfaf`.

---

## 2026-04-18 (fifth pass) — branch `claude/add-bonus-workout-outcomes-c1H1R`

Baseline on entry: **171 passing, 0 failing** (after `npm install`).
End state: **176 tests pass**.

Scope: one user-reported bug (double-day bonus workout logging replaced
the primary instead of adding a second), one latent History-page bug
uncovered while investigating, plus small supporting changes and tests.
No engine changes, no schema changes, no new features beyond the
already-present double-day UI getting full persistence.

### Commits (oldest → newest)

1. **`d13c033` — Plan: 2026-04-18 fifth-pass audit**
   Dated `IMPLEMENTATION_PLAN.md` section summarising the double-day
   bug, the OutcomeModal instance-id latent bug, and the prioritized
   plan. No code changes.
   - `IMPLEMENTATION_PLAN.md`
   - **Risk**: none (doc only).
   - **Rollback**: `git revert d13c033`.

2. **`9b89b44` — OutcomeModal: optional workoutInstanceId override**
   Added an optional prop so callers logging a non-primary record for
   a date (ExtraWorkoutEntry, double-day bonus) can pass their own
   instance id. Backward-compatible — falls through to the existing
   `makeWorkoutInstanceId(planId, calendarDate)` default when not
   provided.
   - `src/components/workout/OutcomeModal.tsx`
   - **Risk**: low. Additive prop, no behaviour change for existing
     callers.
   - **Rollback**: `git revert 9b89b44` (but note this will re-introduce
     the HistoryPage extra-outcome collision fixed next).

3. **`7969378` — HistoryPage: save extra-entry outcomes under the extra key**
   Pre-existing bug: `openOutcomeForExtra` tracked the correct
   `makeExtraWorkoutInstanceId` in `outcomeTarget.instanceId`, but
   `OutcomeModal` always rebuilt the id from `(planId, calendarDate)`
   on confirm, so saving an outcome for an ad-hoc extra entry actually
   wrote to the primary rotation entry's outcome slot for that date.
   One-line fix now that the modal accepts the override.
   - `src/pages/HistoryPage.tsx`
   - **Risk**: low. Fixes a silent data-correctness bug; no new code
     paths.
   - **Rollback**: `git revert 7969378`.

4. **`f2fe0af` — TodayPage: log the double-day bonus workout (USER-REPORTED)**
   `handleOutcomeConfirm` used to log just the primary
   (`logAction(planId, today, ...)`) and call `actions.advance()` to
   skip the rotation past the bonus. The bonus itself was never
   persisted. Now, when `doubleDay` is on:
   1. Primary is logged as before (HistoryEntry keyed by
      `(planId, today)`).
   2. Bonus is persisted as an `ExtraWorkoutEntry` on today — the
      existing bucket for ad-hoc workouts — so both records coexist
      without colliding on the primary key.
   3. After the primary OutcomeModal confirms, a second OutcomeModal
      opens for the bonus, pre-populated from the bonus plan day.
      Closing without confirming keeps the extra entry (the workout
      happened) but leaves the outcome blank, matching the ad-hoc
      extras already created from History.
   4. Rotation still advances an extra step so tomorrow projects past
      the bonus.
   - `src/pages/TodayPage.tsx`
   - **Risk**: medium. Introduces a new persistence path from the
     Today page. Contained to the double-day branch; single-workout
     path is unchanged.
   - **Rollback**: `git revert f2fe0af`. The HistoryPage / OutcomeModal
     fixes are independently valuable and should remain.

5. **`283ceb4` — Tests: extras coexist with primary entry/outcome on same date**
   Locks down the invariants the double-day fix depends on:
   - Primary HistoryEntry and ExtraWorkoutEntry survive together on
     the same `(planId, calendarDate)`; multiple extras accumulate
     with distinct ids.
   - `removeEntry` doesn't touch extras.
   - Primary and extra outcomes coexist under distinct keys;
     `clearPlanOutcomes` wipes both.
   - Also resets `extraEntries` in the history-store test
     `beforeEach` — the bucket was added to the store after the reset
     was written, so state was leaking across tests. My first run of
     the new tests exposed the leak, which this commit fixes.
   - `src/store/__tests__/historyStore.test.ts`,
     `src/store/__tests__/outcomeStore.test.ts`
   - **Risk**: none (tests only).
   - **Rollback**: `git revert 283ceb4`.

6. **`28f7905` — TodayPage: Undo also clears today's extras for this plan**
   After the double-day fix, the existing Undo button on Today only
   cleaned up the primary HistoryEntry and outcome, leaving the bonus
   ExtraWorkoutEntry (and its outcome) stranded. Undo now also removes
   all of today's extras (and their outcomes) for this plan. Extras
   for other plans on today are left untouched.
   - `src/pages/TodayPage.tsx`
   - **Risk**: low. Extras for this plan on today could previously
     only have been created by the double-day flow; the rare user who
     manually added a today-extra from the History page and then hit
     Undo on Today would now lose that manual extra too. Documented
     in REVIEW_NOTES for your consideration.
   - **Rollback**: `git revert 28f7905`.

### Not done this run

- The optional medium-complexity feature slot was intentionally skipped.
  The user-reported correctness bug + its latent cousin took the
  whole session; stabilization first is the right call.

---

## 2026-04-18 run — branch `claude/system-improvements-m4b4f`

Baseline: 169 passing, 1 failing (stale CSV test assertion).
End state: **171 tests pass**.

Scope-tight correctness run. Three targeted fixes + one new test. No
engine changes, no schema changes, no new features.

### Commits (oldest → newest)

1. **`dbf4c51` — Add IMPLEMENTATION_PLAN.md section for 2026-04-18 audit**
   Dated architecture re-summary + prioritized plan. No code changes.

2. **`40edf34` — Update stale csv test: planId is preserved, day/slot IDs regenerate**
   Commit `d16e8c2` intentionally started preserving planId on CSV
   import (so previously-exported history CSVs stay cross-referenceable
   across re-imports). The existing test still asserted that planId
   was regenerated, so the suite had been failing since that change
   landed. Flipped the assertion + renamed the test to state the
   current contract; added inline comment explaining why.
   - `src/lib/__tests__/csv.test.ts`
   - **Risk**: none. Test-only change that documents existing behavior.
   - **Rollback**: `git revert 40edf34`.

3. **`90ef6b3` — Clear plan's extra workouts when clearing plan history**
   `clearPlanHistory(planId)` filtered `entries` and `overrides` but
   not `extraEntries`. Deleting a plan left any ad-hoc logged workouts
   (yoga / swim / run / etc. logged outside the rotation) orphaned in
   localStorage. PlansPage's delete flow already calls
   `clearPlanHistory` → `clearPlanOutcomes` → `deletePlan`, so adding
   the filter to `clearPlanHistory` is enough — outcome keys for extras
   are prefixed by `${planId}_` and are already cleared by
   `clearPlanOutcomes`.
   - `src/store/historyStore.ts`
   - **Risk**: low. One-line addition; mirrors the existing pattern
     for `entries` and `overrides`.
   - **Rollback**: `git revert 90ef6b3`.

4. **`aa09ad7` — Correct misleading JSDoc on completionStateToAction**
   The doc on `completionStateToAction` claimed `deferred → day_off
   (does NOT advance rotation)`. `rotationEngine.computeCurrentDayIndex`
   actually advances the pointer for all three action types
   (`complete`, `skip`, `day_off`). Re-worded to state the truth and
   point at the engine function for anyone debugging progression
   semantics. Doc only.
   - `src/modules/workout-outcomes/types.ts`
   - **Risk**: none.
   - **Rollback**: `git revert aa09ad7`.

5. **`59ec028` — Add test for extraEntries cleanup in plan-delete cascade**
   Extends `planDeleteCleanup.test.ts` with a third integration-style
   test: seeds plan A with 2 extras and plan B with 1 extra, creates
   outcomes for each extra via `makeExtraWorkoutInstanceId`, simulates
   the PlansPage delete cascade for plan A, and asserts plan B's extra
   + outcome survive while plan A's are gone. Also adds
   `extraEntries: []` to the `beforeEach` store reset.
   - `src/store/__tests__/planDeleteCleanup.test.ts`
   - **Risk**: none. Test-only.
   - **Rollback**: `git revert 59ec028`.

### Tests

- Before: 169 pass / 1 fail.
- After: **171 pass** (+1 fix, +1 new test).

### User-visible behavior changes

1. Deleting a plan now also removes ad-hoc extra workouts (yoga / swim
   / any off-rotation workout) logged against it. Previously those
   stayed in localStorage forever.

Nothing else affects UI, CSV export/import, rotation advancement, or
the PWA manifest.

### Not implemented (recommendations only)

- `swap_slot` override UI — product decision still needed.
- Double-day bonus outcome capture — needs UX path for a second modal.
- Progression reset button — scope decision (single group vs all).
- Plan-expiry banner dismiss — wants a persisted-dismissal design.

Medium-complexity feature work was intentionally skipped this run to
keep scope narrow around correctness. Baseline was close to clean
(169/170); a pure-correctness run lands the suite green without
layering in anything that needs separate review.

---

## 2026-04-17 run — branch `claude/funny-galileo-6zMOl`

Baseline: 156 tests pass (inherited from 2026-04-16 run).
End state: **170 tests pass**, `npx vite build` succeeds.

All changes are additive or deletions of verified-dead code. The
rotation engine, calendar projection, run-adaptation engine, and CSV
import/export paths were **not** modified.

### Commits (oldest → newest)

1. **`a8227ae` — Add IMPLEMENTATION_PLAN.md for 2026-04-17 audit**
   Dated architecture summary + prioritized plan appended to the file.

2. **`3e83c25` — Clear plan outcomes when deleting a plan**
   `PlansPage` delete handler now calls `clearPlanOutcomes` alongside
   `clearPlanHistory`. Fixes orphaned `WorkoutOutcome` records — the
   function existed and was tested but had never been wired into the UI.
   - `src/pages/PlansPage.tsx`
   - **Risk**: none. Adds cleanup; no engine / no projection changes.
   - **Rollback**: `git revert 3e83c25`.

3. **`2bff88e` — Clear outcome record when history entry is undone or deleted**
   Adds `removeOutcome(instanceId)` to `outcomeStore`. Wired into:
   - `TodayPage` Undo
   - `HistoryPage` entry delete
   - `CalendarPage` Clear button in the day-detail modal
   Keeps the history and outcome stores in lockstep so re-opening the
   OutcomeModal after an Undo no longer pre-populates a stale outcome.
   - `src/store/outcomeStore.ts`, `src/pages/TodayPage.tsx`,
     `src/pages/HistoryPage.tsx`, `src/pages/CalendarPage.tsx`
   - **Risk**: low. The new action is a single Zustand set.
   - **Rollback**: `git revert 2bff88e`.

4. **`32de834` — Remove unused uiStore**
   `useUIStore` had zero importers anywhere in `src/`. Deleted.
   - `src/store/uiStore.ts` (deleted)
   - **Risk**: none. Verified by grep.
   - **Rollback**: `git revert 32de834`.

5. **`78a9152` — Default history plan filter to active plan when available**
   When `activePlanId` is set AND that plan has at least one logged
   entry, `HistoryPage` opens with its filter pre-selected to the active
   plan instead of "All plans". Falls back to "all" otherwise.
   - `src/pages/HistoryPage.tsx`
   - **Risk**: low; UX-only default change. User can still switch filters.
   - **Rollback**: `git revert 78a9152`.

6. **`ddc93d6` — Add tests for removeOutcome and plan-delete cleanup**
   - `removeOutcome` unit tests (single removal, no-op on missing id,
     progressionStates isolation) appended to `outcomeStore.test.ts`.
   - New `planDeleteCleanup.test.ts` — integration-style test that seeds
     two plans, deletes one, and asserts cleanup cascades across the
     three stores and leaves the sibling plan untouched.
   - +137 lines of test code.
   - **Rollback**: `git revert ddc93d6`.

7. **`724ca92` — Add history stats summary to HistoryPage**
   Selected medium-complexity feature, narrow slice:
   - New pure helper `src/lib/historyStats.ts` (`computeHistoryStats`).
   - 9 unit tests covering totals, inclusive windows (7-day, 30-day),
     streak definition (complete or day_off; skip or gap breaks it).
   - 4 stat tiles (Streak / 7-day / 30-day / Total) rendered above the
     entry list in `HistoryPage`. Respects the plan filter — stats
     recompute when the user changes the dropdown.
   - **Risk**: low. Pure derivation, zero engine changes, no new deps.
   - **Rollback**: `git revert 724ca92`.

### Tests

- Before: 156 pass.
- After: 170 pass (+14).
- New files:
  - `src/lib/__tests__/historyStats.test.ts` (9 tests)
  - `src/store/__tests__/planDeleteCleanup.test.ts` (2 tests)
- Additions to existing:
  - `src/store/__tests__/outcomeStore.test.ts` (+3 `removeOutcome` tests)

### User-visible behavior changes

1. Plan delete now truly removes everything — previously outcomes
   leaked into localStorage indefinitely.
2. Undo on Today (and Delete / Clear on History & Calendar) also clears
   the saved outcome — previously re-opening an entry after undoing it
   would re-populate stale outcome fields.
3. HistoryPage opens pre-filtered to the active plan when possible.
4. A 4-tile stats summary now sits above the entry list.

Nothing here affects CSV export/import or the PWA manifest.

---

## 2026-04-16 run

Generated: 2026-04-16

Changes are listed in commit order (oldest first).

---

## 1. Fix Skip button: log history entry instead of advance override

**Commit**: `1f3ed3c`

**Summary**: `handleSkip()` in `TodayPage` was calling `actions.advance()` (which writes an override entry) instead of `actions.skip(planDayIndex)` (which writes a history entry with action='skip').

**Why it mattered**: Clicking Skip did not record any history entry. The day appeared as `past_unlogged` on the calendar. The rotation advanced via override rather than via a logged entry, meaning the behavior was subtly different from what all other parts of the system expected. If overrides were cleared or the rotation was re-computed differently, the skipped day's effect on the rotation would disappear.

**Files changed**: `src/pages/TodayPage.tsx`

**Risk**: Low. The fix aligns Skip with how every other logged action works. Skip now creates a HistoryEntry with action='skip', visible in history and on the calendar.

**Rollback**: `git revert 1f3ed3c`

---

## 2. Fix updateEntryAction: restore planDayIndex when changing away from day_off

**Commit**: `3fa7753`

**Summary**: When the history editor changed an entry from `day_off` to `complete` or `skip`, the `planDayIndex` field stayed `undefined` (because it was `undefined` when the entry was first logged as day_off). The updated function accepts an optional `planDayIndex` parameter and uses it when switching away from day_off.

**Why it mattered**: After a day_off → complete toggle, the history entry would show `planDayIndex = undefined`, causing the plan day display to fall back to "Unknown day". The rotation engine itself ignores `planDayIndex`, so rotation logic was unaffected, but the display was incorrect.

**Files changed**: `src/store/historyStore.ts`

**Risk**: Very low. The function signature extended with an optional parameter — all existing callers are backward compatible.

**Rollback**: `git revert 3fa7753`

---

## 3. Fix getFutureProjection: delegate to getUpcomingDays for consistency

**Commit**: `88bbb71`

**Summary**: `getFutureProjection` in `calendarProjection.ts` had its own projection loop that diverged from `getUpcomingDays` by not applying today's overrides and not advancing for `day_off` entries. Replaced with a simple delegation to `getUpcomingDays`.

**Why it mattered**: `getFutureProjection` is currently unused by active pages, but if called, it would have produced incorrect projections. The inconsistency was also confusing.

**Files changed**: `src/engine/calendarProjection.ts`

**Risk**: Very low. Function is dead code — no callers in active pages. The cleanup reduces confusion for future readers.

**Rollback**: `git revert 88bbb71`

---

## 4. Remove dead isActive=true variable from OutcomeModal

**Commit**: `746509f`

**Summary**: `const isActive = true` in `OutcomeModal.tsx` was always true and existed as a remnant of earlier states where certain form sections would be hidden for non-active completion states. All remaining completion states (completed/partial) show all fields, so the guard was dead code. Removed the variable and its conditional wrappers.

**Why it mattered**: The code pattern `{isActive && (<div>...)}` was confusing to readers — it looks like a meaningful condition but always evaluates to true. Cleaned up 6 unnecessary conditional wrappers.

**Files changed**: `src/components/workout/OutcomeModal.tsx`

**Risk**: None. Purely cosmetic — identical runtime behavior.

**Rollback**: `git revert 746509f`

---

## 5. Add rotation engine test suite (37 tests)

**Commit**: `302fcba`

**Summary**: Added comprehensive tests for `rotationEngine.ts` covering: `mod()`, `computeCurrentDayIndex()` (with various entry types, overrides, startDayIndex, wrap-around, deduplication of duplicate entries), `getTodayResolvedDay()` (all status transitions, override application), `getUpcomingDays()` (projection, wrap-around, override effects, prior day integration), and `isPlanExpired()` (both weeks and rotations modes, day_off exclusion from rotation count).

**Why it mattered**: The rotation engine is the most business-critical piece of logic in the app and had zero test coverage. The tests now document expected behavior, catch regressions, and revealed two test-writing mistakes that clarified how the engine actually works.

**Files changed**: `src/engine/__tests__/rotationEngine.test.ts` (new file)

**Risk**: None. Tests only — no production code changed.

**Rollback**: `git revert 302fcba`

---

## 6. Add unsaved-changes guard to PlanBuilderPage

**Commit**: `9914b84`

**Summary**: Added an `isDirty` flag that is set when any plan metadata or day/slot is edited. The back button now calls `safeNavigate()` instead of `navigate()` directly. If there are unsaved changes, a confirmation modal appears asking "Keep editing" or "Discard". The dirty flag is cleared on successful save.

**Why it mattered**: Users could lose all edits by tapping the back button or navigating away without any warning. This is a common source of frustration in form-heavy UIs.

**Files changed**: `src/pages/PlanBuilderPage.tsx`

**Risk**: Low. The guard only adds a confirmation step — users can still discard. The `isDirty` state is local and doesn't persist.

**Rollback**: `git revert 9914b84`

---

## 7. Add plan expiry/completion indicators

**Commit**: `5805553`

**Summary**: Added `isPlanExpired()` calls to both `TodayPage` and `PlansPage`. On TodayPage, a purple banner appears when the plan has completed all its scheduled rotations/weeks. On PlansPage, the "Active" badge changes to "Complete" (purple) for expired active plans.

**Why it mattered**: `isPlanExpired()` existed in the engine but was never called from the UI. Users had no indication that they'd finished their program.

**Files changed**: `src/pages/TodayPage.tsx`, `src/pages/PlansPage.tsx`

**Risk**: Low. `isPlanExpired()` is a pure function, already tested. The visual indicator is additive.

**Rollback**: `git revert 5805553`

---

## 8. Add plan filter to History page + fix empty state check

**Commit**: `467e225`

**Summary**: When multiple plans have history entries, a dropdown filter appears in the History page header to filter entries by plan. The entry count updates to reflect the filter. An empty message shows when the selected plan has no entries. Also fixed the initial empty-state check to use `entries.length` instead of `sorted.length`, so the empty state doesn't show when only the filter produces zero results.

**Why it mattered**: Users with multiple plans could not easily find entries for a specific plan. All entries were mixed together.

**Files changed**: `src/pages/HistoryPage.tsx`

**Risk**: Very low. The filter is additive. Single-plan users see no change. The empty state fix is strictly correct.

**Rollback**: `git revert 467e225`

---

## 9. Fix notes drift between HistoryEntry and WorkoutOutcome stores

**Commit**: `435d983`

**Summary**: When notes were edited via the History modal, only `HistoryEntry.notes` was updated. `WorkoutOutcome.notes` (in outcomeStore) stayed stale, meaning the `OutcomeModal` on TodayPage would show old notes if "Edit outcome" was tapped. Added `updateOutcomeNotes()` to outcomeStore and calls it in `HistoryPage.saveAndClose()`.

**Why it mattered**: Notes could diverge between two stores, causing confusing UX: history list shows one note, outcome modal shows another.

**Files changed**: `src/store/outcomeStore.ts`, `src/pages/HistoryPage.tsx`

**Risk**: Very low. The new `updateOutcomeNotes` is a simple patch operation on existing state. No-ops when no outcome record exists.

**Rollback**: `git revert 435d983`

---

## 10. Remove duplicated makeWorkoutInstanceId in OutcomeModal

**Commit**: `0863e99`

**Summary**: `OutcomeModal` had a local `buildWorkoutInstanceId()` function that was an exact re-implementation of the exported `makeWorkoutInstanceId()` from `outcomeStore`. Removed the local function and imported the shared one.

**Why it mattered**: The format `${planId}_${calendarDate}` was defined in two places. Any future format change would require updating both.

**Files changed**: `src/components/workout/OutcomeModal.tsx`

**Risk**: None. Behavioral identity — same output, one less definition.

**Rollback**: `git revert 0863e99`

---

## 11. Add historyStore test suite (28 tests)

**Commit**: `cfd4c36`

**Summary**: Added comprehensive tests for `historyStore` covering: `addEntry` deduplication, `logAction` planDayIndex semantics for day_off vs complete/skip, `updateEntryAction` planDayIndex restoration (the bug fixed in commit `3fa7753`), `removeRetroJumpForDate` override filtering by type and planId, `removeEntry`, and `clearPlanHistory`. The persist middleware is mocked as a pass-through so tests run in the Node environment without localStorage.

**Why it mattered**: The historyStore contains business-critical state mutations. The `updateEntryAction` fix (commit `3fa7753`) had no test coverage — this suite now verifies both the happy path and the bug-fixed day_off → complete transition.

**Files changed**: `src/store/__tests__/historyStore.test.ts` (new file)

**Risk**: None. Tests only.

**Rollback**: `git revert cfd4c36`

---

## 12. Add outcomeStore test suite (17 tests)

**Commit**: `efe89fb`

**Summary**: Added tests for `outcomeStore` covering: `makeWorkoutInstanceId` format, `setOutcome`/`getOutcome` deduplication, `updateOutcomeNotes` (including the no-op when outcome is absent and the empty-string → null coercion), `logOutcomeWithProgression` for non-run slots, progression-ineligible run slots, and the full progression advancement path, plus `clearPlanOutcomes` prefix filtering.

**Why it mattered**: `updateOutcomeNotes` was newly added to fix notes drift (commit `435d983`). Testing it validates the new path and documents that it is a no-op when no outcome record exists.

**Files changed**: `src/store/__tests__/outcomeStore.test.ts` (new file)

**Risk**: None. Tests only.

**Rollback**: `git revert efe89fb`

---

## 13. Add getResolvedDaysRange and buildMonthGrid tests (30 tests)

**Commit**: `e0d5eba`

**Summary**: Added tests for `getResolvedDaysRange` (the calendar grid's core function) covering: status assignment for past/today/future, pointer advancement rules (past unlogged = no advance, logged entry = advance, today/future always advance), override application order, rotation boundary wrap, historyEntry attachment, and the documented edge case where dates before `plan.startDate` are passed directly to the engine. Also covers `buildMonthGrid` grid structure (complete weeks × 7 cells, `isCurrentMonth` accuracy, single `isToday` marker, `resolvedDay` attachment).

**Why it mattered**: `getResolvedDaysRange` is the most complex function in the codebase with subtle pointer-advancement rules. Two test assertions had to be corrected during writing, which helped clarify how advance overrides interact with past unlogged days.

**Files changed**: `src/engine/__tests__/calendarProjection.test.ts` (new file)

**Risk**: None. Tests only.

**Rollback**: `git revert e0d5eba`

---

## 14. Fix WorkoutDayCard dynamic Tailwind border class

**Commit**: `2053931`

**Summary**: `WorkoutDayCard` constructed the border color class name at runtime using `border-${meta.bgColor.replace('bg-', '')}`. Tailwind's CSS purger scans source files for complete class name strings — dynamically constructed names (e.g. `border-orange-500`) can be omitted from the production CSS bundle, making the pending-state left border invisible. Fixed by adding a static `borderColor` field to `WorkoutMeta` in `constants.ts` and using `meta.borderColor` directly.

**Why it mattered**: Silent production CSS failure. The pending-state card border (the only visible difference between "today's workout" and a generic future day) could disappear in production builds.

**Files changed**: `src/lib/constants.ts`, `src/components/workout/WorkoutDayCard.tsx`

**Risk**: None. Same visual behavior, now guaranteed to be included in the CSS bundle.

**Rollback**: `git revert 2053931`

---

## 15. Document resolveWorkoutDisplayTarget isFromProgression=false edge case

**Commit**: `6893e35`

**Summary**: Added a test to `engine.test.ts` documenting that when a progression state's `currentTargetDistanceMiles` equals the template's `targetDistanceMiles`, `isFromProgression` is `false` and no adaptation note is shown. This is intentional design (target unchanged → no indicator) but was undocumented.

**Why it mattered**: The edge case was noted in TEST_RESULTS.md as "worth documenting in tests". Now documented with an explanation of when it occurs (progression initialised at baseline or reset to baseline).

**Files changed**: `src/modules/run-adaptation/__tests__/engine.test.ts`

**Risk**: None. Tests only.

**Rollback**: `git revert 6893e35`

---

## 16. Fix buildMonthGrid: don't show pre-plan dates as past_unlogged

**Commit**: `f1971d2`

**Summary**: When viewing a calendar month in which a plan started mid-month (e.g., plan starts Jan 15 but the grid spans from Dec 28), dates before `plan.startDate` were passed to `getResolvedDaysRange`, which returned them as `past_unlogged` with the `startDayIndex` workout shown. Those dates pre-date the plan and should not display workout data. Fixed by clamping `fromDate` to `plan.startDate` before calling `getResolvedDaysRange`. Pre-start cells now have `resolvedDay = undefined` and render as neutral/inactive (the `CalendarPage` already handles this gracefully). Also added a guard for the case where the entire viewed month is before the plan started.

**Why it mattered**: Users viewing the month their plan started would see incorrect workout labels and `past_unlogged` indicators on days before they'd ever used the app.

**Files changed**: `src/engine/calendarProjection.ts`

**Risk**: Low. The CalendarPage already handles `resolvedDay = undefined` (non-interactive neutral cell). The fix is additive — it only restricts the range passed to `getResolvedDaysRange`, not the range of cells rendered.

**Rollback**: `git revert f1971d2`


---

## 2026-04-30 (eighteenth pass) — branch `claude/dreamy-mccarthy-Ymdp2`

Baseline on entry: **315 passing, 0 failing**.
Exit state: **315 passing, 0 failing** (no new tests — suite already comprehensive).

---

### 1. Fix: HistoryPage stale `entries` closure in `handleOutcomeConfirm`

**Summary**: When editing a workout outcome in HistoryPage and simultaneously
changing the `completedAt` date AND the completion state (e.g., `skip` →
`partially_completed`), the `updateAction` call at the end of the handler
silently failed. The handler captured `entries` from the React render closure.
After `updateEntryDate(...)` moved the entry to the new date, the closure-stale
`entries` array still had the entry at the *old* date, so
`entries.find(e => e.calendarDate === completedDate)` returned `undefined` and
`updateAction` was never called.

**Impact**: History entry action label (shown in the list as "Completed" /
"Skip" / "Partial") would not update when both date and completion state were
changed in one save. The outcome itself saved correctly; only the backing
HistoryEntry action was stale.

**Fix**: Replace the closure-read `entries.find(...)` with
`useHistoryStore.getState().entries.find(...)` to read fresh store state,
consistent with the TodayPage pattern used in `handleOutcomeConfirm` there.

**Files changed**: `src/pages/HistoryPage.tsx`

**Risk**: None. `useHistoryStore.getState()` returns the current Zustand
snapshot synchronously; the semantics are identical when the entry has not moved,
and correct when it has.

**Rollback**: Revert the one-line change in `handleOutcomeConfirm`.

---

### 2. Refactor: extract `extraToPlanDay` to shared utility

**Summary**: An identical 6-line helper (`extraToPlanDay`) was duplicated in
TodayPage, CalendarPage, and HistoryPage. Extracted to
`src/lib/planDayUtils.ts` and imported in all three files. Also removed an
unused `PlanDay` import in TodayPage (which had been used only by the now-
removed local function).

**Why it matters**: Any future change to how ExtraWorkoutEntry is adapted to
PlanDay (e.g., adding `difficulty`, `notes`, or `durationMin`) would have
required updating three identical copies. The shared module makes the change
a single-file edit.

**Files changed**:
- `src/lib/planDayUtils.ts` (new)
- `src/pages/TodayPage.tsx` (removed local def, added import)
- `src/pages/CalendarPage.tsx` (removed local def, added import)
- `src/pages/HistoryPage.tsx` (removed local def, added import)

**Risk**: None. Pure refactor — same logic, same output, same tests passing.

**Rollback**: Delete `planDayUtils.ts` and restore the local function in each
page. No data or store changes.

---

### 3. Feature: previous-session inline summary on TodayPage

**Summary**: Added a compact `"Last: 3×8 @ 135 lb Bench Press"` hint line
below today's `WorkoutDayCard` when the workout is pending. Scoped to the same
`planDayIndex` as today's workout so repeating rotation plans show the relevant
session rather than any recent weights session.

**Why it matters**: The most common friction point for strength-plan users is
"what weight did I use last time?", which previously required opening the
outcome modal or navigating to History. The answer was already computed in the
same render cycle — surfacing it required no new data fetching.

**What was added**:
- `findPreviousSessionForPlanDay` — pure function, scans `planEntries` for the
  most recent `complete` entry matching `planDayIndex`, returns its outcome.
- `buildLastSessionSummary` — pure function, formats the outcome as a compact
  string (weights / run / swim).
- One `<p>` hint line rendered below `WorkoutDayCard` when `isPending` and not
  in double-day mode.

**Files changed**: `src/pages/TodayPage.tsx`

**Risk**: Low. Purely additive. The hint line is visible only when pending and
a prior session exists. No store mutations. TypeScript clean.

**Rollback**: Remove the `<p>` block and the two helper functions from
TodayPage.tsx. No data to clean up.

---

## 2026-05-01 (nineteenth pass) — branch `claude/dreamy-mccarthy-15kIJ`

Baseline on entry: **315 passing, 0 failing**.
Exit state: **440 passing, 0 failing** (+125 tests).

---

### 1. Fix: PlansPage delete handler did not clear program vars

**Summary**: When a YAML-imported plan was deleted, `clearPlanVars` was never
called. History and outcomes were cleaned up, but `programStore.vars[planId]`
was left as an orphaned entry. On a large app lifecycle this leaks memory and
could produce stale var state if a plan ID was ever reused.

**Root cause**: The three-call delete sequence in `PlansPage.tsx` was written
before `programStore` and its `clearPlanVars` action existed. The store action
was added in a later pass without updating the delete handler.

**Fix**: Added `useProgramStore` import and `clearVars` selector to `PlansPage`,
inserted `clearVars(confirmDelete)` between `clearOutcomes` and `deletePlan` in
the delete-confirm button `onClick`.

**Files changed**:
- `src/pages/PlansPage.tsx` — delete handler (2 lines added)
- `src/store/__tests__/planDeleteCleanup.test.ts` — 2 new integration tests,
  `useProgramStore` import and reset added to `beforeEach`

**Risks / tradeoffs**: None. Purely additive to an existing cleanup sequence.

**Rollback**: Revert the `clearVars` line from the delete handler.

---

### 2. Fix: `evaluateUpdates` split on `,` naively, breaking multi-arg function calls

**Summary**: The update expression evaluator in `expressionEval.ts` split the
comma-separated statement string using `updateStr.split(',')`. This broke any
update containing a multi-argument function call, for example:

```
easy_miles = min(easy_miles + 0.5, 8)
```

would be split into `easy_miles = min(easy_miles + 0.5` (invalid → evaluates to
0) and `8)` (no `var = rhs` match → silently discarded). The effective result was
that `easy_miles` was zeroed whenever a `min()`/`max()` cap appeared in an update
expression.

**Fix**: Added a paren-aware `splitStatements()` helper that tracks bracket depth
and only splits on commas at depth 0. The naive `split(',')` call in
`evaluateUpdates` was replaced with `splitStatements(updateStr)`.

**Files changed**:
- `src/lib/expressionEval.ts` — new `splitStatements` function + updated
  `evaluateUpdates` call site + expanded JSDoc

**Risks / tradeoffs**: None. The new function is a strict improvement with no
behavioral change for statements that don't contain function calls.

**Rollback**: Revert commit that introduced `splitStatements`; restore
`updateStr.split(',').map(s => s.trim()).filter(Boolean)`.

---

### 3. Tests: `expressionEval.ts` — 100 new unit tests

**Summary**: `src/lib/__tests__/expressionEval.test.ts` was missing entirely.
Added 100 tests covering all five public exports:

- `evaluateExpression`: arithmetic, operator precedence, comparison operators,
  `and`/`or`/`not` with short-circuit, all 8 built-in functions (`min`, `max`,
  `round`, `floor`, `ceil`, `abs`, `round5`, `round2_5`), variables from
  context, unknown variables default to 0.
- `evaluateCondition`: bare `all_reps`/`session_complete` keywords, compound
  expressions, missing/empty condition defaults to true.
- `evaluateUpdates`: all five assignment operators (`=`, `+=`, `-=`, `*=`, `/=`),
  complex rhs expressions, multi-statement updates, paren-safe comma handling.
- `resolveLoad`: `lb`/`kg` suffix stripping, expression evaluation, null for
  missing input.
- `resolveQuantityString`: unit suffixes (`mi`, `km`, `m`, `s`, `min`, `h`),
  bare numeric strings, variable-only expressions.

These tests directly caught the `splitStatements` bug before production — the
`min`-capped update tests failed, revealing the regression.

**Files changed**:
- `src/lib/__tests__/expressionEval.test.ts` (new, 100 tests)

---

### 4. Tests: `programStore` — 23 new unit tests

**Summary**: `src/store/__tests__/programStore.test.ts` was missing. Added 23
tests covering all public store actions:

- `initVars`: sets initial values, idempotent on re-activation (does not
  overwrite), merges new keys while preserving existing, isolated per plan.
- `getVars`: empty object for unknown plan, returns known plan vars.
- `setVars`: merge patch, creates vars for new plan, does not affect other plans.
- `clearPlanVars`: removes all vars, does not affect other plans, no-op for
  nonexistent plan.
- `applyProgressionRule`: condition evaluation (`all_reps`, `effort <= 3`,
  true/false branches, no-else no-op, undefined condition = always fire),
  complex rhs (`round5(squat * 0.85)`), min-capped update, multi-variable
  update, persistence across multiple applications, plan isolation.

**Files changed**:
- `src/store/__tests__/programStore.test.ts` (new, 23 tests)

---

## 2026-05-02 (twentieth pass) — branch `claude/dreamy-mccarthy-WJaAU`

Baseline on entry: **440 passing, 0 failing**.
Exit state: **484 passing, 0 failing** (+44 tests).

---

### 1. Fix: cycle/week progress text shown when plan is expired

**Summary**: The TodayPage subtitle displayed "3/6 done" and "rotation
complete!" alongside the purple "Plan complete!" banner. These signals are
redundant and contradictory — the expiry banner is the canonical state for
a completed plan.

**Root cause**: The cycle-progress spans had no guard for `planExpired`. The
weeks-plan span was already guarded by `completed < total`, but the two
rotation cycle spans were missing the corresponding check.

**Fix**: Added `!planExpired &&` to both rotation cycle spans:
- `cycleProgress && cycleProgress.doneInCycle > 0 && !planExpired`
- `cycleProgress?.justCompletedRotation && !planExpired`

**Files changed**:
- `src/pages/TodayPage.tsx` — 2 JSX condition changes

**Risks / tradeoffs**: None. Purely subtractive UI change — a corner state
the user will rarely see becomes cleaner.

**Rollback**: Revert commit `fb653bd`.

---

### 2. Refactor: extract session summary helpers to `src/lib/sessionSummary.ts`

**Summary**: `findPreviousSessionForPlanDay` and `buildLastSessionSummary`
were inlined as module-level functions inside `TodayPage.tsx`. Being inside
a page file made them impossible to unit test without rendering the full
component. Extracted to `src/lib/sessionSummary.ts` and imported back from
TodayPage — zero behaviour change.

**Files changed**:
- `src/lib/sessionSummary.ts` (new — 2 exported pure functions)
- `src/pages/TodayPage.tsx` — replaced inline definitions with import; updated
  `buildLastSessionSummary` call to pass optional `maxLoadByExercise` map

**Risks / tradeoffs**: None. Pure refactor; function signatures unchanged.

**Rollback**: Revert commit `0ecf042`.

---

### 3. Feature: personal best (PB) detection in session hint

**Summary**: Extended `buildLastSessionSummary` with an optional
`maxLoadByExercise?: Record<string, number>` parameter. When the first set's
load exactly equals the all-time max for that exercise, " · PB" is appended
to the summary string.

In TodayPage, subscribed to `useExerciseHistoryStore(s => s.records)` (first
use of this store in TodayPage) and computed `maxLoadByExercise` via a
`useMemo`. The existing `buildLastSessionSummary` call was updated to pass
the map.

**Why**: The session hint added in pass 18 showed "Last: 3×8 @ 225 lb Squat"
but gave no indication of whether that load was the user's best. The
`exerciseHistoryStore` had the data since pass 6 but had never been read in
TodayPage.

**Files changed**:
- `src/lib/sessionSummary.ts` — optional `maxLoadByExercise` param + PB logic
- `src/pages/TodayPage.tsx` — `exerciseRecords` subscription, `maxLoadByExercise`
  useMemo, updated call

**Risks / tradeoffs**: First `exerciseHistoryStore` subscription in TodayPage.
Single selector (`s.records`) so re-renders only on new workout log. The
`useMemo` is O(n sets) — cheap for any realistic data volume.

**Rollback**: Remove the three lines in TodayPage and the optional param in
`sessionSummary.ts`.

---

### 4. Tests: `sessionSummary.ts` — 21 new unit tests

**Summary**: Covered both exported helpers in a new test file:

`findPreviousSessionForPlanDay` (8 tests):
- Empty entries → null
- Entry without outcome → null
- Most-recent complete entry wins
- Today's date excluded
- Wrong planDayIndex ignored
- Skip/day_off entries ignored
- Wrong planId ignored
- Falls back to earlier entry when latest has no outcome

`buildLastSessionSummary` (13 tests):
- No data → null
- Weights format: N×reps @ load exerciseName
- No-load variant (bodyweight)
- PB marker shown when load equals all-time max
- No PB marker when load is below max
- No PB when exercise absent from map
- Run formats: distance + duration, distance only, duration only, empty → null
- Swim format
- Weights take precedence over run when both present

**Files changed**:
- `src/lib/__tests__/sessionSummary.test.ts` (new, 21 tests)

---

### 5. Tests: `planStore` — 22 new unit tests

**Summary**: Long-standing gap (noted since pass 17). Created
`src/store/__tests__/planStore.test.ts` covering all six public store actions:

- `createPlan` (3): id assigned, timestamps set, multiple plans independent
- `setActivePlan` (5): status set to active, prior deactivated, startDate
  override, startDayIndex override, default today
- `deactivatePlan` (2): clears activePlanId, no-op when none active
- `archivePlan` (3): status set, activePlanId cleared when archived was active,
  sibling untouched
- `deletePlan` (3): removed, activePlanId cleared, sibling untouched
- `duplicatePlan` (6): new id, "(copy)" suffix, always inactive, new day/slot
  ids, original intact, missing id → ""

**Files changed**:
- `src/store/__tests__/planStore.test.ts` (new, 22 tests)

---

### 6. Tests: `planDeleteCleanup` — exerciseHistoryStore coverage

**Summary**: The PlansPage delete handler calls `clearByPlanId` on
`exerciseHistoryStore` as the fourth step in its cleanup sequence, but the
integration test never verified this. Added:

- `useExerciseHistoryStore` import and `beforeEach` reset
- New test: "clears exercise history records for the deleted plan only"
  Seeds two plans' exercise records, runs the full 5-step cascade, verifies
  plan A records removed and plan B record intact.

**Files changed**:
- `src/store/__tests__/planDeleteCleanup.test.ts` — +1 test, updated beforeEach
