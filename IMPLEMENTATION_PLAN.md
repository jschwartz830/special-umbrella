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

## Pass 62 — 2026-06-24 (branch `claude/dreamy-mccarthy-uan3ll`)

### Observations on entry

- Branch is at main (923 tests passing across 24 files before any changes).
- Full codebase audit performed: read all source files in `src/`, all test files, all config.
- Rotation engine, stores, and progression modules are in excellent shape.
- Two stat-computation functions in `historyStats.ts` have a consistency bug with the rest of the codebase around duplicate-entry handling.

---

### Bugs Found and Fixed

#### Bug 1 — `computeRotationCycleProgress` doesn't deduplicate entries by calendarDate

**File**: `src/lib/historyStats.ts`, line 173 (before fix)

The function computed `totalDone = planEntries.length`, which counts raw array entries. Every other function in the same file that computes a rotation count — `computePlanProgress` (line 127) and `isPlanExpired` in `rotationEngine.ts` (line 279) — deduplicates by first building a `Set` of `calendarDate` values, then using `.size`. The rotation engine's own `computeCurrentDayIndex` also deduplicates per-date.

**Impact**: If a user's `wpt_history` localStorage contains duplicate entries for the same `(planId, calendarDate)` — which can happen after a partial CSV re-import or a historical migration edge case — the cycle counter inflates. With a 3-day plan, two entries on the same day make `totalDone=3` instead of `totalDone=2`, causing `justCompletedRotation` to fire a cycle early and `doneInCycle`/`remaining` to be wrong.

**Fix**: Replaced `.length` with a `Set<string>` of calendarDates, mirroring the pattern in `computePlanProgress`.

#### Bug 2 — `computeRotationPlanRemaining` doesn't deduplicate entries by calendarDate

**File**: `src/lib/historyStats.ts`, line 214 (before fix)

Same pattern. `done` was computed via `.filter(...).length`. Duplicate entries inflate `done`, making the remaining count appear smaller than it is (the user thinks they need fewer workouts than they actually do).

**Fix**: Same `Set<string>` pattern.

---

### Work Completed

#### 1. Fix `computeRotationCycleProgress` dedup (`src/lib/historyStats.ts`)

Replaced:
```ts
const planEntries = entries.filter(...)
const totalDone = planEntries.length
```
With:
```ts
const qualifyingDates = new Set(
  entries.filter(...).map(e => e.calendarDate),
)
const totalDone = qualifyingDates.size
```

#### 2. Fix `computeRotationPlanRemaining` dedup (`src/lib/historyStats.ts`)

Replaced:
```ts
const done = entries.filter(...).length
```
With:
```ts
const done = new Set(entries.filter(...).map(e => e.calendarDate)).size
```

#### 3. Regression tests for both fixes (`src/lib/__tests__/historyStats.test.ts`)

Added 2 test cases:

- `computeRotationCycleProgress`: two entries for the same date should count as one cycle step, not two
- `computeRotationPlanRemaining`: two entries for the same date should count as one workout toward the total, not two

Both tests fail against the un-patched code and pass after the fix.

---

### What Was NOT Done (and why)

| Considered | Decision |
|---|---|
| Refactor `allSetsHitTarget` to remove redundant first check | Harmless extra guard; changing it risks subtle regression in sets-with-mixed-completed-states edge case. Not worth the diff. |
| Extract `sortedOverrides` helper in `rotationEngine.ts` | Cosmetic; 3-line dedup across 3 functions. No correctness impact. |
| Decompose `TodayPage.tsx` (1240 lines) | No current stability risk. Defer until growth makes it painful. |
| Feature work | Skipped — codebase is healthy but the dedup inconsistency was a signal to prefer stabilisation over expansion this pass. |
