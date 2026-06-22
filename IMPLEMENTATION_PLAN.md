# Implementation Plan

## Pass 62 — 2026-06-22 (branch `claude/dreamy-mccarthy-qo7940`)

### Observations on entry

- Branch is at `main` HEAD (no unreleased changes). 925 tests passing after changes.
- 923 tests passing across 24 test files before any changes in this pass.
- Audit found two deduplication bugs in `historyStats.ts` (see below).
- `computeCurrentStreakDates` was exported and tested but not wired into any UI component.
- `getFutureProjection` in `calendarProjection.ts` is documented as unused — dead code.

---

### Work Completed

#### 1. Bug fix: `computeRotationCycleProgress` — calendarDate deduplication

**File**: `src/lib/historyStats.ts`

Used `planEntries.length` (raw entry count) instead of counting unique calendar dates. This is inconsistent with `isPlanExpired` and `computePlanProgress`, which both wrap the filtered list in a `Set<string>` of dates. Duplicate entries for the same date — e.g. after a CSV re-import — would inflate `doneInCycle` and could falsely trigger `justCompletedRotation = true`, showing the user a "completed a rotation!" banner when they had not.

Fix: replace raw `.length` with `new Set(entries.map(e => e.calendarDate)).size`.

Added regression test: "does not double-count duplicate entries for the same date" under `computeRotationCycleProgress`.

#### 2. Bug fix: `computeRotationPlanRemaining` — calendarDate deduplication

**File**: `src/lib/historyStats.ts`

Same root cause as (1): used raw `.length` rather than unique dates. Duplicate entries for the same date would under-report remaining workouts, showing `done` as higher than the actual unique-date count. TodayPage surfaces this as "X workouts left."

Fix: wrap in `new Set(...).size`.

Added regression test: "does not double-count duplicate entries for the same date" under `computeRotationPlanRemaining`.

#### 3. Feature: streak-date highlighting in CalendarPage

**File**: `src/pages/CalendarPage.tsx`

`computeCurrentStreakDates` was exported from `historyStats.ts` and had comprehensive tests but was never consumed by any UI component. Added plan-scoped `streakDates` computation (memoized) to CalendarPage and wired it to a `ring-1 ring-emerald-500/40` border on calendar cells that belong to the current streak. The `today` cell (already sky-blue) is exempt. The ring is additive — it does not change background status colors.

---

### What was NOT done (and why)

| Considered | Decision |
|---|---|
| Fix `computeConsecutiveSkips` date-conflict behavior | Not fixed. Requires malformed data to trigger (normal usage prevents it). Conservative behavior (break wins) is safer for nudge logic. Documented only. |
| Remove `getFutureProjection` dead code | Instructions say don't remove functionality. Documented as cleanup recommendation. |
| E2E / component interaction tests | Out of scope for overnight pass; would require significant test infrastructure work. |

---

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
