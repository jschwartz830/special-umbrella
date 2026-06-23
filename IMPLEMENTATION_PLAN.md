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

## Pass 62 — 2026-06-23 (branch `claude/dreamy-mccarthy-10u0dq`)

### Observations on Entry

- Branch starts at `3061d86` (merged PR #150 from pass 61).
- 923 tests passing across 24 test files before any changes (+36 tests from pass 61).
- Codebase is architecturally sound — pure engine layer, good type safety, thorough test coverage.
- Audit found one high-confidence UX bug in `OutcomeModal.tsx` and one low-risk floating-point issue in `run-adaptation/engine.ts`.
- All major stats/streaks/UI features are already implemented; no critical gaps found.

### Key Audit Findings

**Confirmed Bugs:**
1. `OutcomeModal.tsx:249` — `handleClose` guard `if (existingOutcome && isDirtyRef.current)` prevents the discard warning from showing when creating a *new* outcome. Users lose data if they accidentally close.
2. `run-adaptation/engine.ts:148` — `roundMiles` omits `Number.EPSILON`, meaning values like 1.005 → 1.00 instead of 1.01 (benign with default 0.5-mile steps but could manifest with custom step sizes).

**Documented Risks (not fixed this pass):**
- `weightExercises` state in OutcomeModal is not re-synced if `planDay` prop changes while mounted (low risk; modal is always remounted between days in practice).
- Division by zero in `expressionEval.ts` silently returns 0 (intentional, tested behavior, but hard to debug for users).
- `deduplicateByDate` key separator `__` could collide if planIds contained `__` (nanoids don't, so safe).

### Work Completed

1. **fix: OutcomeModal discard warning for new outcomes** (`src/components/workout/OutcomeModal.tsx`)
   - Removed `existingOutcome &&` from `handleClose` condition
   - Now fires for both new logs and edits when form is dirty

2. **fix: roundMiles floating-point epsilon** (`src/modules/run-adaptation/engine.ts`)
   - Added `Number.EPSILON` before multiply to prevent rounding-down at exact .5 boundaries
   - e.g. `1.005 * 100 = 100.4999...` without epsilon → rounds to 1.00; with epsilon → 1.01

3. **feat: previous session notes hint in OutcomeModal** (`src/components/workout/OutcomeModal.tsx`, `src/pages/TodayPage.tsx`)
   - Added optional `prevNotes` prop to OutcomeModal
   - Shows "Last time: ..." in italic above the notes textarea when logging a new outcome
   - Wired via `prevSessionOutcome?.notes` in TodayPage's primary modal call

### What Was NOT Done (and why)

| Considered | Decision |
|---|---|
| Add `console.warn` for division by zero in expressionEval | Behavior is intentional and explicitly tested. Would need UX design for surfacing errors to users — out of scope. |
| Add `key={planDay.id}` to OutcomeModal callers | The stale-state risk is theoretical only; remounting is guaranteed by existing conditional rendering. Deferred. |
| Plan creation validation (days ≥ 1) | No bug manifested; silent empty-plan behavior was intentional per engine design. Deferred as a recommendation. |
| Exhaustiveness check in makeSlot() | WorkoutType enum is stable; no new types planned. Low value right now. |
| Tests for roundMiles fix | `roundMiles` is private; the epsilon fix only matters for non-default step sizes; tests would be artificial. |
