# Implementation Plan

## Pass 61 — 2026-06-19 (branch `claude/dreamy-mccarthy-7ugj5k`)

### Observations on entry

- Branch is at `6f7e35c` (merged PR #149 from pass 60).
- 887 tests passing across 21 test files before any changes.
- Three pure utility modules had zero test coverage: `outcomeSortKey.ts`, `planDayUtils.ts`, and the `addOverride` path in `historyStore`.
- No share/export mechanism existed for "show a friend what workout I have today" — clipboard export was the natural next step.
- No architectural debt or urgent regressions found in the audit.

---

### Work Completed

#### 1. New utility: `src/lib/shareWorkout.ts`

Added `formatWorkoutForClipboard(planDay, planName, dateLabel): string` — a pure function that serialises a `PlanDay` to human-readable plain text for clipboard copy.

Output format:

```
Push Day — Mon, Jun 19
Plan: Strength Block

Chest & Shoulders (weights)
  • Bench Press: 5x5 @ 185lb
  • Overhead Press: 4x8 @ 115lb
  • Push-up: 3xmax
```

Handles:
- Weight exercises (numeric or `SetSpec[]` sets, optional load)
- Structured run segments (warmup/interval/cooldown with reps, distance, pace)
- Unstructured run/swim/yoga (targetDistance, durationMin, notes)
- `structureDescription` free-text block
- Multiple slots per day (AM/PM workouts)
- No trailing whitespace on any line

No new dependencies introduced. Zero side effects.

#### 2. Copy button in `TodayPage`

When `isPending && activeWorkoutState === 'hidden'` (the "Start Workout" button is visible), a copy icon button is rendered to the right of it in a flex row.

- Calls `formatWorkoutForClipboard` with today's date label (`format(parseISO(today), 'EEE, MMM d')`) and the plan name.
- Uses `navigator.clipboard.writeText()` — gracefully silences access-denied errors.
- Button turns emerald for 2 s after a successful copy, then resets.
- Uses the `Copy` icon from `lucide-react` (already a dependency).

#### 3. New tests: `src/lib/__tests__/shareWorkout.test.ts`

15 test cases covering the full surface of `formatWorkoutForClipboard`:

| # | Scenario |
|---|----------|
| 1 | Day label + date label on first line |
| 2 | Plan name on second line |
| 3 | Rest-day slot (name and type) |
| 4 | Weight exercises with load |
| 5 | Weight exercises without load |
| 6 | Run slot with targetDistance |
| 7 | Structured run segments (reps, distance, pace) |
| 8 | `SetSpec[]` array (length as set count) |
| 9 | `structureDescription` passthrough |
| 10 | `durationMin` output |
| 11 | `notes` passthrough |
| 12 | No trailing whitespace on any line |
| 13 | Multiple slots rendered in order |

#### 4. New tests: `src/lib/__tests__/planDayUtils.test.ts`

8 tests for `extraToPlanDay()` — previously zero coverage:

- id propagation
- label from workoutName
- exactly one slot
- slot.id = extra.id
- slot.type = extra.workoutType
- slot.name = extra.workoutName
- all 8 WorkoutType values map correctly
- valid PlanDay shape (all fields present)

#### 5. New tests: `src/lib/__tests__/outcomeSortKey.test.ts`

9 tests for `outcomeSortKey()` — previously zero coverage:

- returns `completedAt` when present
- falls back to calendarDate from instanceId when `completedAt` is null
- falls back when `completedAt` is undefined
- returns `''` for instanceId with no recognisable date
- datetime sorts after date-only for same calendar date
- two outcomes with timestamps sort chronologically
- two outcomes with date-only sort chronologically
- extra-workout instanceId (`plan_date_extra_id`) pattern
- planId with underscores does not confuse date extraction

#### 6. Expanded tests: `src/store/__tests__/historyStore.test.ts`

Added `addOverride` describe block (6 tests) — this action had no direct test coverage:

- appends override with generated id and given type
- uses provided `appliedAt` for calendar back-dating
- defaults `appliedAt` to now when not provided
- stores `targetDayIndex` for jump overrides
- accumulates multiple overrides without replacing earlier ones
- each generated id is unique across multiple adds

---

### What was NOT done (and why)

| Considered | Decision |
|---|---|
| Timezone fix in `removeRetroJumpForDate` | Low confidence — `format(new Date(isoString))` and `new Date().toISOString()` are a consistent round-trip within a single-device PWA. Not a real bug. |
| Multi-slot day copy (each slot's share text) | Scoped to single-call formatter; multi-slot is handled naturally in the loop. |
| Service-worker offline caching audit | Out of scope for overnight pass; no regressions observed. |
| New dependency (e.g. `share-api-polyfill`) | Rejected — Web Share API is good on mobile, clipboard fallback is sufficient and already in-browser. |

---

## Pass 62 — 2026-06-21 (branch `claude/dreamy-mccarthy-zu4z6a`)

### Observations on entry

- Branch starts at `d1b9a24` (merged PR #150 from pass 61).
- 923 tests passing across 24 test files before any changes.
- Codebase quality: 8/10. No critical bugs. Core rotation logic is sound.
- Key issues identified: 7-day stall detection cap, deduplication inconsistency in two stat functions, undocumented timezone convention, and no in-context PR feedback.

---

### Work Completed

#### 1. Fix: align deduplication across rotation stat functions

`computeRotationCycleProgress` and `computeRotationPlanRemaining` counted raw `entries.length` — unlike `isPlanExpired` which used a Set of unique calendarDate values. Fixed both to use `new Set(…dates)`, making all three consistent.

Risk of the original: a malformed CSV import could produce two entries on the same date. `isPlanExpired` would not count the date twice, but the cycle/remaining counters would — producing a stale display.

#### 2. Fix: extend catch-up window from 7 to 14 days

The stall-detection nudge on TodayPage now looks back 14 days instead of 7. Also added a secondary indicator showing how many unlogged days exist beyond the 14-day window ("+ N older gaps — use Calendar to review").

New utility: `countTotalUnloggedDays(planId, entries, planStartDate, today)` — full-history scan with no lookback cap.

#### 3. Docs: timezone convention

Added a block comment to `rotationEngine.ts` explaining that all calendarDate values are local-timezone YYYY-MM-DD strings, and documenting the known limitation for users who travel across time zones.

#### 4. Feature: personal record celebration banner

After logging a workout with weight sets, the app detects if any exercise exceeded its previous all-time max load and shows a dismissible amber banner: "New personal record! Bench Press, Squat". Clears on dismiss or Undo.

See FEATURE_PROPOSAL.md and FEATURE_REVIEW.md for the full breakdown.

#### 5. Tests: 12 new test cases

Added to `src/lib/__tests__/historyStats.test.ts`:
- 9 tests for `countTotalUnloggedDays`
- 1 test for `computeRotationCycleProgress` deduplication
- 1 test for `computeRotationPlanRemaining` deduplication
- 1 test for 14-day `getUnloggedPastDates` window

---

### What was NOT done (and why)

| Considered | Decision |
|---|---|
| Cross-store transaction safety | Too risky for an overnight pass; existing try/catch adequate |
| Progression error display in HistoryPage | Medium-risk schema change; documented as recommendation |
| Component/integration tests (RTL/Playwright) | Requires infrastructure setup; out of scope |
| Performance: memoize allOutcomes lookup | Low priority; app is single-user and data sets are small |
| Bulk mark-as-Day-Off from CalendarPage | Would extend the catch-up to handle old gaps too; larger feature |
