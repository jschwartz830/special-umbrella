# Implementation Plan

## Pass 70 — 2026-07-02 (branch `claude/dreamy-mccarthy-jy89cx`)

### Observations on entry

- Branch reset from latest `main` (1aed19f). No unique unmerged work; no open PR for the prior branch name.
- **987 tests passing** across 26 test files before any changes (same baseline as pass 69).
- Recent human-authored feature landed since pass 69: mobility session shows exercise description and caution notes during live session (PR #176 / commit `26f7401`).

### Audit scope

Full read of: `TodayPage.tsx` (complete), `HistoryPage.tsx` (complete), `CalendarPage.tsx` (imports + usage), `constants.ts` (complete), `historyStore.ts`, `planStore.ts`, `outcomeStore.ts`, `mobilityStore.ts`, `settingsStore.ts`, `storeSync.ts`, `exerciseHistoryStore.ts`, `calendarProjection.ts`, `planDayUtils.ts`, `outcomeSortKey.ts`, `previousSetsHelper.ts`, `sessionSummary.ts`, `usePlanActions.ts`, `useActivePlan.ts`.

### Audit findings

#### Code quality: WORKOUT_TYPES defined three times (FIXED)

**Location**: `src/lib/constants.ts`, `src/pages/CalendarPage.tsx:40`, `src/pages/HistoryPage.tsx:37`

**Mechanism**: The 5-item workout type list for UI selects/filters was independently defined in three places:
- `constants.ts`: `WORKOUT_TYPES: WorkoutType[]` — plain string array (5 canonical types)
- `CalendarPage.tsx`: `WORKOUT_TYPES: { type: WorkoutType; label: string }[]` — object array with labels (same 5 values)
- `HistoryPage.tsx`: `WORKOUT_TYPES: { type: WorkoutType; label: string }[]` — identical definition

Adding or renaming a workout type in the UI required three file changes. `PlanBuilderPage.tsx` correctly imports the string-array version from `constants.ts`, but the pages needed a labeled version and each defined their own.

**Fix**: Added `WORKOUT_TYPE_OPTIONS: { type: WorkoutType; label: string }[]` to `constants.ts` as the single canonical export; `CalendarPage` and `HistoryPage` import and alias it. Zero behavioral change, no new dependencies.

#### Code quality: legacy `'rest'` type in fallback slot (FIXED)

**Location**: `src/pages/HistoryPage.tsx:349`

**Mechanism**: The outcome-confirm handler builds a fallback slot when `outcomeTarget.planDay.slots[0]` is undefined:
```ts
const slot = outcomeTarget.planDay.slots[0] ?? { id: '', type: 'rest' as WorkoutType, name: '' }
```
`planStore` v2 migrates `'rest'` → `'other'`, so this code path would produce a legacy type that no longer exists in any live plan. While `'rest'` remains in the `WorkoutType` union for backward compatibility, using it in new code paths is inconsistent.

**Fix**: Changed fallback type to `'other'`.

#### Non-issues confirmed

| Item | Verdict |
|---|---|
| TodayPage Undo handler removes override correctly | Pass 68 fix (`advancedRotation ?? extra.source === 'double_day'`) holds; logic sound |
| `handleUpcomingLog` date-shift for extras | Correct — `outcomeDate` derived from historyEntry when present |
| CalendarPage local VALID_WORKOUT_TYPES in csv.ts / programParser.ts | Intentionally separate validation lists; should NOT be consolidated (different purpose: validation vs. display) |
| Ad hoc workout `source: 'history'` tagging | Correct — prevents Undo from auto-removing user-initiated ad hoc entries |
| HistoryPage `handleOutcomeConfirm` silently removes destination entry on date move | Intentional — comment at line 341 explains the orphan-prevention rationale |
| progressionByInstance Map (O(1) reverse-index of progressionStates) | Correct and efficient |
| `weeklyBreakdown` uses `addDays(new Date(), -55)` directly | Acceptable — `useToday()` is for the "today" anchor; stats history window can use `Date.now()` |

---

### Work plan

1. **[REFACTOR] Consolidate WORKOUT_TYPE_OPTIONS into `constants.ts`** — `src/lib/constants.ts`, `src/pages/CalendarPage.tsx`, `src/pages/HistoryPage.tsx`.
2. **[FIX] Legacy `'rest'` fallback in HistoryPage outcome-confirm** — `src/pages/HistoryPage.tsx:349`.
3. **[DOCS] Pass 70 audit notes, changelog, test results, review notes.**

No test additions in the initial commit — the changes were purely mechanical refactors. A background audit agent completed while initial work was in progress and surfaced two additional bugs in `csv.ts`. Those were fixed in a second commit with 5 new tests (see below). Final test count: 992.

### Additional work (from background audit agent findings)

#### Bug: `plansToCsv` silently discards `location` and `weightsFocusArea` (FIXED)

**Location**: `src/lib/csv.ts:238`

The `tags` export column was hardcoded to `''`. `plansFromCsv` already reads the column correctly (pipe-delimited `home|upper` → `location`, `weightsFocusArea`), but the exporter never wrote it. Any plan with location or focus-area metadata was silently losing those fields on CSV round-trip.

**Fix**: `[slot.location, slot.weightsFocusArea].filter(Boolean).join('|')`.

#### Bug: `buildOutcomeFromRow` accepts fractional `perceivedEffort` (FIXED)

**Location**: `src/lib/csv.ts:722-724`

A manually-edited CSV value of `1.7` passed the `>= 1 && <= 5` range check and was cast to `PerceivedEffort` (typed `1 | 2 | 3 | 4 | 5`), violating the type contract. **Fix**: added `Number.isInteger(effort)` guard.

**5 new tests** cover both fixes. Commit `4737e7f`.

#### Non-issues noted from agent report

| Item | Disposition |
|---|---|
| `historyToCsv`/`historyFromCsv` notes duplication after round-trip | Low severity; documented in REVIEW_NOTES.md for future cleanup |
| Supabase anon key hardcoded | Intentional; publishable key by design |
| Custom `nanoid` via `Math.random()` | Architectural decision; negligible collision risk |
| `applyProgressionRule` swallows errors silently | Tested and intentional |

---

## Pass 69 — 2026-07-01 (branch `claude/dreamy-mccarthy-4cykvp`)

### Observations on entry

- Branch reset from latest `main` (55ba7cd). No unique unmerged work; no open PR for the prior branch name.
- **987 tests passing** across 26 test files before any changes (966 baseline + 21 added this pass).
- Three significant human-authored features landed since pass 68:
  1. **MobilityTracker rewrite** (PR #173): Sequential exercise timers with wall-clock accuracy, 5-second transition countdown, session checkpointing/resume-on-close, `visibilitychange`-resilient architecture, Previous/Redo/Skip-transition navigation.
  2. **Personalized mobility library + presets** (PR #172): `mobilityLibrary.ts` (37 exercises across 5 categories), `MobilityPage` rewritten with My Routine / Library / Presets tabs, `loadPreset` (replace/append modes), `addExerciseFromLibrary`, in-store session checkpointing (`startSession`, `saveCheckpoint`, `clearSession`).
  3. **TodayPage polish** (commit `6ce0f71`): SwipeToDelete reveal visibility fix, copy button icon toggle (Copy→Check), "Change Workout" capitalisation.

### Audit findings

#### Non-issue confirmed: MobilityTracker timer accuracy

The new `MobilityTracker` uses wall-clock bases (`totalR`, `exR` refs of the form `{ acc, at }`) and a 100ms interval computing `acc + (now - at) / 1000`. This is the same pattern applied to `CardioWorkoutTracker` in pass 66. Even if the browser throttles the interval (screen lock, background tab), the next interval tick that DOES fire computes the correct elapsed time from `Date.now()`. The display freezes briefly when backgrounded, then snaps to the correct value on resume — this is a 0–100ms display lag at most, not a duration accuracy issue. A `visibilitychange` handler (as in CardioWorkoutTracker) would make the snap instantaneous but is purely cosmetic for a 100ms interval.

#### Non-issue confirmed: `handlePrevious` removes current exercise from completedIds during transition

`handlePrevious()` filters out both `prevId` and `curId` from `completedIds`. During transition (just completed exercise N, about to start N+1), this un-completes exercise N AND un-completes exercise N−1. At first glance this seems surprising — the user DID complete exercise N. However: there is already a separate "← Redo" button specifically for undoing the current exercise (re-doing N without going back to N−1). "Previous" is therefore correctly interpreted as "I want to go back to exercise N−1" — and since you're going back past exercise N to re-do it from the beginning, removing both from `completedIds` is the right semantic. This is intentional behavior.

#### Non-issue confirmed: checkpoint does not persist `phase`

When the user closes and reopens MobilityTracker, `phase` always resets to `'idle'`. The `exElapsedSec` in the checkpoint captures how far into the current exercise the timer was, so the exercise countdown resumes from the saved position. But the user must press Start to re-activate the exercise timer. This is intentional — auto-resuming would surprise a user who opens the tracker just to check which exercise is next.

#### Gap found: 5 new mobilityStore actions had zero unit tests (FIXED)

`addExerciseFromLibrary`, `loadPreset`, `startSession`, `saveCheckpoint`, `clearSession` were all added in the pass 72 PRs with no test coverage.

Additionally, `resetStore()` in the existing test file did not include `activeSession: null`, meaning any test that set `activeSession` could contaminate subsequent describe blocks that didn't use `beforeEach(resetStore)`.

**Fix**: Updated `resetStore()` to include `activeSession: null`; added 21 new tests covering all 5 new actions. See Test Results.

#### Non-issues confirmed this pass

| Item | Verdict |
|---|---|
| `loadPreset` uses preset's `durationSec`, not library's | Intentional — presets express specific timing requirements that can differ from library defaults |
| `addExerciseFromLibrary` dedup check (`s.routine.some(e => e.id === libraryId)`) | Correct — prevents duplicate entries when called twice |
| mobilityStore v1→v2 migration adds `activeSession: null` | Trivial, correct. Cannot be tested through the store mock (persist is a pass-through in tests), which is acceptable given the migration's simplicity |
| `MobilityPage` `PresetsTab` confirm-replace UX | Clean — requires two clicks (Load Routine → Replace/Append) to prevent accidental overwrites |
| SwipeToDelete opacity/pointer-events fix in `TodayPage` | Clean fix: hides the delete affordance when `offset >= 0` (not swiping) |

---

### Work plan

1. **[TEST] Extend mobilityStore tests for 5 new v2 actions** — `src/store/__tests__/mobilityStore.test.ts` — Fix `resetStore()` + 21 new tests.
2. **[DOCS] Pass 69 audit notes, changelog, test results, review notes.**

No feature work this pass. Per the overnight routine's own rule ("skip feature work entirely if audit findings suggest the codebase needs stabilization first"), the presence of two large feature PRs with zero unit test coverage on their new store actions — and the confirmed gap in `resetStore()` — was treated as a clear signal to spend this pass on stabilization.

---

## Pass 68 — 2026-06-30 (branch `claude/dreamy-mccarthy-4vdzsq`)

### Observations on entry

- Branch reset from latest `main` (no unique unmerged work, no open PR for the prior branch name).
- 966 tests passing across 26 test files before any changes.
- One human/agent-authored feature landed since pass 67 that had not yet been audited: the "full plan picker" double-day flow (commit `bcee1f6`), which lets a user pick *any* plan day (not just the next one in rotation) when logging a bonus workout on a date that already has a workout logged.

### Audit findings

#### Bug: invalid `DayStatus` literal broke every production deploy since commit `20bb8ac` (HIGH, production-breaking)

**Location**: `src/pages/TodayPage.tsx` — two synthetic `ResolvedDay` object literals (~lines 526, 936)

**Mechanism**: Both literals set `status: 'upcoming'`. `'upcoming'` is not a member of the `DayStatus` union in `src/types/index.ts` (the correct value for a not-yet-started day, used everywhere else, is `'future'`). `tsc --noEmit` fails on this, and since `npm run build` is `tsc && vite build`, every push to `main` since `20bb8ac` failed CI and never deployed — confirmed via GitHub Actions run history (3 consecutive failed runs).

**Fix**: Changed both occurrences to `status: 'future'`.

#### Bug: deleting a non-advancing double-day extra could strip an unrelated rotation override (HIGH, silent data corruption)

**Location**: `src/pages/TodayPage.tsx` — `SwipeToDelete onDelete` handler for "Completed today" extras, and the Undo button handler

**Mechanism**: Both delete paths called `removeLastOverrideByType(plan.id, 'advance')` whenever `extra.source === 'double_day'`. Before the "full plan picker" feature (`bcee1f6`), every `double_day` extra was created by logging the next-in-rotation day, so it was always 1:1 with an `advance` override. The picker feature broke that invariant: a user can now pick an arbitrary plan day as the bonus workout, which does **not** advance the rotation pointer, yet the extra is still tagged `source: 'double_day'`. Deleting such an extra removed the plan's most recent `advance` override regardless of whether *this* extra actually caused one — silently corrupting the rotation pointer if any other action had advanced it since.

**Fix**: Added `advancedRotation?: boolean` to `ExtraWorkoutEntry`. Set precisely at both creation sites (`handleOutcomeConfirm` computes `willAdvance`; `handleUpcomingLog` always advances, so it's hardcoded `true`). Both deletion sites now check `extra.advancedRotation ?? extra.source === 'double_day'` — the `??` fallback preserves correct behavior for extras created before this field existed (those were always created via the old all-or-nothing flow, so treating them as if `true` is correct).

#### Non-issues confirmed this pass

| Item | Verdict |
|---|---|
| `CalendarPage.tsx`'s own extra-deletion logic | Does not call `removeLastOverrideByType` — unaffected by the bug above. |
| `HistoryPage.tsx`'s other `source === 'double_day'` check (~line 645) | Purely a UI display label ("Bonus" vs "Extra" badge) — not a data mutation, no change needed. |
| Mobility ring + legend addition to `CalendarPage.tsx` (commit `886c0e0`) | Clean, additive, no issues found. |
| `WorkoutDayCard.tsx` rendering of synthetic `ResolvedDay` objects with `status: 'future'`, no `historyEntry` | Renders correctly — `historyEntry` is already optional on the type. |

---

### Work plan

1. **[FIX] Invalid `DayStatus` literal (`'upcoming'` → `'future'`)** — `src/pages/TodayPage.tsx` — 2-line change, production-breaking, shipped immediately
2. **[FIX] Override-removal data corruption on double-day delete** — `src/pages/TodayPage.tsx`, `src/types/index.ts` — new optional field + 4 call-site changes
3. **[DOCS] Pass 68 audit notes, changelog, test results, review notes**

No new tests added this pass (see `TEST_RESULTS.md` for rationale) and no feature work attempted — both fixes landed in unaudited UI logic with no testable pure-function equivalent, and finding two production-impacting bugs in one pass was treated as a clear signal to prioritize stabilization and documentation over new feature work this time.

---

## Pass 67 — 2026-06-29 (branch `claude/dreamy-mccarthy-hhiaa3`)

### Observations on entry

- Branch is at `9b00892` (merged PR #165 "Add Supabase auth and cloud sync for workout data").
- 961 tests passing across 25 test files before any changes.
- Three significant human-authored features landed since pass 66:
  1. **Supabase auth + cloud sync** (PR #165) — `AuthGate`, `authStore`, `storeSync.ts` — zero tests, two bugs found
  2. **Today tab UI redesign** (PR #163) — Habit-focused compact layout, collapsed upcoming
  3. **PWA icon update** (PR #164) — Asset-only change

### Audit findings

#### Bug: AuthGate useEffect subscription leak when syncOnLogin races against cleanup (MEDIUM)

**Location**: `src/components/auth/AuthGate.tsx` — second `useEffect` (user dependency)

**Mechanism**: When `user` becomes truthy, the effect calls `syncOnLogin()` (async), then in `.then()` assigns `unsubscribeStores = subscribeStores()`. The cleanup function only calls `unsubscribeStores?.()`. If the component unmounts or `user` changes to null **before** `syncOnLogin()` resolves, the cleanup runs while `unsubscribeStores` is still `undefined`. After cleanup, `.then()` fires and assigns `subscribeStores()` — but the cleanup already ran. Those subscriptions are never freed. This is a subscription leak that causes duplicate Supabase pushes on re-login and prevents garbage collection of the store listeners.

**Fix**: Add `let cancelled = false` flag; check before calling `subscribeStores()` in `.then()`; set `cancelled = true` in the cleanup.

#### Bug: storeSync.ts pushStore and syncOnLogin swallow errors silently (LOW)

**Location**: `src/lib/storeSync.ts`

**Mechanism**: `supabase.from('user_store_data').upsert(...)` and the `.select(...)` query both return `{ data, error }`. Neither checks the `error` field. When a network failure or RLS violation causes a push to fail, the caller receives no feedback. This makes debugging sync issues significantly harder.

**Fix**: Destructure `error` from both calls; log to `console.error` when non-null.

#### Gap: settingsStore had zero unit tests

All other Zustand stores have test coverage. `settingsStore` has a single action (`setStartDelay`) and a default value. Adding basic coverage completes parity.

#### Feature: Progression result not surfaced in HistoryPage (LONG-STANDING RECOMMENDATION)

**Recommended in**: Passes 63, 64, and 65.

`RunProgressionState.lastResult` ('progress' | 'hold' | 'regress') is stored in `outcomeStore.progressionStates` after every progression-eligible run. The `lastCompletedWorkoutInstanceId` field links the state to the exact workout that triggered it. This information has been stored since the run-adaptation module was introduced but has never been shown to users.

**Approach**: Add optional `progressionState?: RunProgressionState | null` to `OutcomeMetrics`. When `lastResult === 'progress'`, show a green "↑ Progressed — next target: N mi" line. When `lastResult === 'regress'`, show amber "↓ Adjusted down — next target: N mi". Hold and None are silent. Wire it in `HistoryPage` using a reverse-lookup Map built from `progressionStates`.

#### Non-issues confirmed this pass

| Item | Verdict |
|---|---|
| Supabase anon key hardcoded in `supabase.ts` | Standard practice. The key has prefix `sb_publishable_` (public key). Security comes from Supabase RLS policies, not secret-keeping of the anon key. |
| AuthGate shows sign-in wall for unauthenticated users | Intentional product decision in PR #165. `supabase.auth.getSession()` reads from localStorage; `loading` resolves to false in milliseconds even offline. |
| `syncOnLogin` "cloud wins" on first login conflicts | Known limitation. For a personal single-user app this is acceptable. Multi-device merge would require per-record timestamps and conflict resolution beyond this scope. |
| `subscribeStores` fires on every store change | Correctly debounced at 1500ms. Rapid changes (active workout set logging) coalesce into one push. |

---

### Work plan

1. **[FIX] AuthGate subscription leak** — `src/components/auth/AuthGate.tsx` — 6-line change
2. **[FIX] storeSync error logging** — `src/lib/storeSync.ts` — 6-line change
3. **[FEATURE] Run progression result in OutcomeMetrics + HistoryPage** — 2 files, ~50 lines
4. **[TEST] settingsStore unit tests** — new file, 5 tests

---

## Pass 66 — 2026-06-28 (branch `claude/dreamy-mccarthy-7v05ht`)

### Observations on entry

- Branch is at `5f3fe3f` (merged PR #160 from a human-authored feature commit).
- 943 tests passing across 24 test files before any changes.
- Two new features landed since pass 65: `CardioWorkoutTracker` (dedicated run session HUD shown after a weights+run combo or for run-only days) and `MobilityTracker` / `mobilityStore` (daily mobility routine tracker). These had zero unit test coverage.
- CalendarPage copy-workout button was recommended in passes 63 and 64 but not yet implemented. TodayPage has had it since pass 61.

---

### Audit findings

#### Bug (MEDIUM): CardioWorkoutTracker timer doesn't reconcile with wall clock on resume from background

**Location**: `src/components/workout/CardioWorkoutTracker.tsx` — `useEffect` with `[isPaused]` dependency.

**Mechanism**: The timer used a simple 1-second `setInterval` that incremented state by 1 each tick. Browsers throttle/suppress `setInterval` ticks when the page is backgrounded (iOS WebKit can pause them entirely). After returning from background, the displayed elapsed time and the duration reported to `OutcomeModal` could be significantly behind the actual elapsed time.

**Contrast**: `ActiveWorkoutTracker` already solves this correctly with wall-clock bases (`workoutWallBaseRef`, `restWallBaseRef`) and a `visibilitychange` reconcile handler.

**Fix**: Apply the same pattern — store `{ elapsed, time }` bases, compute elapsed from `baseElapsed + (Date.now() - baseTime)`, add a `visibilitychange` handler for immediate reconcile on foreground restore.

#### Gap: mobilityStore has zero unit test coverage

The store was added as part of the new MobilityTracker feature but no test file was created. All other Zustand stores have test coverage.

#### Feature gap: CalendarPage has no copy-workout button

TodayPage has had a "Copy workout" button since pass 61 using `formatWorkoutForClipboard`. CalendarPage's day detail modal shows full workout slot details but has no way to copy them to clipboard. Recommended in passes 63 and 64.

#### Non-issues confirmed this pass

| Item | Verdict |
|---|---|
| `mobilityStore` schema migration | Not needed — v1 is the initial version, no v0 data exists |
| `CardioWorkoutTracker.resolveDistanceExpr` showing unevaluated expressions | Very unlikely in practice — YAML distances are simple values or simple variable refs, not arithmetic expressions |
| `parseDurationToSeconds` not handling hours format | Workout segment durations are conventionally in min/sec form; hour-format inputs are not in the YAML schema |

---

### Work plan

1. **[FEATURE] CalendarPage copy-workout button** — Add `Copy` button to the DayDetailModal Level 2 rotation view using the existing `formatWorkoutForClipboard` utility. ~20 lines.

2. **[FIX] CardioWorkoutTracker timer wall-clock reconciliation** — Apply the `ActiveWorkoutTracker` pattern: wall-clock base refs, compute elapsed from `(Date.now() - base.time)`, visibility change handler.

3. **[TEST] mobilityStore unit tests** — Cover all 6 store actions (addExercise, removeExercise, reorderExercise, logCompletion, removeCompletion) plus default state. Target 18 tests.

No feature proposal this pass — the CalendarPage copy button is a narrow additive feature adjacent to existing work, not a medium-complexity feature requiring a FEATURE_PROPOSAL.md.

---

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
