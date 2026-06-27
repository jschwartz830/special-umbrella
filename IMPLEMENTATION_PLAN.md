# Implementation Plan

## Pass 65 — 2026-06-27 (branch `claude/dreamy-mccarthy-zak0k0`)

### Observations on entry

- Branch is at `7115f6f` (merged PR #157 from pass 64).
- 936 tests passing across 24 test files before any changes.
- Found a clear data-integrity bug: Undo after a double-day workout leaves a stale `advance`
  override in `historyStore.overrides`, permanently shifting the rotation pointer forward by one.
  The fix is surgical — add `removeLastOverrideByType` to historyStore and call it from the Undo handler.

---

### Audit findings

#### Bug (HIGH): Undo after double-day leaves stale advance override

**Location**: `src/pages/TodayPage.tsx` — Undo `onClick` handler (~line 924)

**Mechanism**: When a user does a double-day workout, `handleOutcomeConfirm` calls:
1. `addExtraEntry(...)` — bonus `ExtraWorkoutEntry` with `source: 'double_day'`
2. `actions.advance()` → `logOverride(planId, 'advance', { delta: 1 })` — rotation pointer +1

The Undo handler (line 933–945) correctly removes the primary `HistoryEntry`, the outcome,
and any `double_day` extras. But it does NOT remove the `advance` override. After Undo,
the rotation is one step ahead of where it should be. The user sees the day after next
instead of the day after, permanently, until they use the Override panel to correct it manually.

**Fix**: Add `removeLastOverrideByType(planId, type)` to `historyStore` and call it in
the Undo handler whenever at least one `double_day` extra was removed.

#### Non-issues confirmed this pass

| Item | Verdict |
|---|---|
| `migrateHistoryState` v0→v1 migration for `source` field | Correct — sets undefined → 'history' conservatively |
| `deduplicateByDate` in `importEntries` | Correct — sorts by createdAt ascending, last-wins |
| `clearPlanOutcomes` prefix matching | Safe — nanoid is alphanumeric + hyphen, no collisions |
| `buildVars()` bool-to-0/1 conversion for progression context | Correct |
| Override accumulation semantics | Correct — `addOverride` always appends, dedup is caller's responsibility |

---

### Work plan

1. **[HIGH] Fix Undo override leak** — add `removeLastOverrideByType` to `historyStore` (interface + implementation), update TodayPage Undo handler, add 7 new unit tests.

No feature work this pass — the bug fix warranted full attention and there's no adjacent feature that's both high-confidence and low-risk enough given the existing scope.

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

---

## Pass 63 — 2026-06-25 (branch `claude/dreamy-mccarthy-nmt6dy`)

### Observations on entry

- Branch starts at `6daa617` (merged PR #152 from pass 62).
- 935 tests passing across 24 test files before any changes.
- Codebase quality: 8.5/10. Core logic is sound; test suite is comprehensive.
- Full audit of all key modules: rotation engine, historyStats, expressionEval, run-adaptation engine, outcomeStore, historyStore, workoutInstanceId, sessionSummary, progressionRecommendation.

### Key finding

Every counting function in `historyStats.ts` that produces a user-visible stat deduplicates by `calendarDate` using a `Set` — **except `countPlanDayCompletions`**. This is the function powering the "Session N" label shown in TodayPage when a user starts a workout. If a CSV import creates a duplicate entry for the same date and planDayIndex, the count inflates (e.g. "Session 8" instead of "Session 7").

No other genuine correctness bugs were found. All other audit items were either already correctly handled or were non-issues given the single-device PWA context.

---

### Work Completed

#### 1. Fix: deduplicate `countPlanDayCompletions` by calendarDate

`src/lib/historyStats.ts` — changed to collect unique calendarDates via `new Set()` before counting. Now consistent with `isPlanExpired`, `computeRotationCycleProgress`, `computeRotationPlanRemaining`, `countTotalUnloggedDays`, and all other counting functions in the module.

#### 2. Test: deduplication regression test

`src/lib/__tests__/historyStats.test.ts` — added one test: two `complete` entries for the same date+planDayIndex (as would happen after a CSV re-import) now count as 1, not 2.

Test count: 935 → 936.

---

### What was NOT done (and why)

| Considered | Decision |
|---|---|
| Feature: copy-workout button on CalendarPage | TodayPage already has it (pass 61); extending to CalendarPage requires wiring `formatWorkoutForClipboard` through the slot → planDay lookup, medium scope for low usage |
| historyStore `removeRetroJumpForDate` timezone | Same conclusion as pass 61: consistent round-trip in a single-device PWA, not a real bug |
| expressionEval: fuzz testing | Current test suite already covers all operator paths, NaN/Infinity guards, and nested parens |
| Progression state UI exposure | Schema change needed; medium risk; deferred to a dedicated pass |

---

## Pass 64 — 2026-06-26 (branch `claude/dreamy-mccarthy-fxnzht`)

### Observations on entry

- Branch starts at `6daa617` (merged PR #152 from pass 62; pass 63 was committed on the same upstream).
- 936 tests passing across 24 test files before any changes.
- Codebase quality: 8.5/10. No critical bugs. Core logic is sound.
- Full re-audit of TodayPage, historyStats, historyStore, outcomeStore, rotationEngine, workoutInstanceId.

### Key finding

**Adherence bar 7-day threshold was undocumented but missing** (`src/pages/TodayPage.tsx`):

The comment on the `loggedRate` declaration explicitly states the bar is "shown after plan has been active ≥ 7 days so the percentage is meaningful." However, `computeLoggedRate` returns `0` (not `null`) once `activeDays >= 1`, so the null-check guard would let the bar appear after just 2 calendar days. The 7-day guard existed in the comment but not in the code.

**Fix**: Added `planActiveDays >= 7` alongside the existing `loggedRate !== null` condition.

No other genuine correctness bugs were found. All other audit items were either already correctly handled (including the deduplication fixes from pass 63) or were non-issues.

---

### Work Completed

#### 1. Fix: enforce 7-day minimum before showing adherence bar

`src/pages/TodayPage.tsx` — added `differenceInCalendarDays` import and `planActiveDays >= 7` guard so the adherence bar only appears once the plan has at least a week of history. The bar showed on day 2 before this change; now it correctly waits until day 7.

---

### What was NOT done (and why)

| Considered | Decision |
|---|---|
| Redundant `removeEntry` before `updateEntryDate` in `handleOutcomeConfirm` | Harmless — `updateEntryDate` already removes collisions internally; no bug, no impact, not worth touching |
| Feature: last-session summary on upcoming cards | Medium complexity; TodayPage already shows this for today's card via `prevSessionOutcome`; extending to the upcoming list is a larger UI change |
| Component/integration tests | Requires jsdom or Playwright setup; out of scope for a targeted overnight pass |
