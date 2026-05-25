# Test Results

## 2026-05-25 (thirty-ninth pass) — branch `claude/dreamy-mccarthy-0z9MJ`

**Result: 743 passing, 0 failing** (+5 new tests; 0 previously-failing tests)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 738 |
| Tests on exit | 743 |
| New tests | +5 |
| Failures | 0 |

### New tests added

**`src/lib/__tests__/sessionSummary.test.ts`** (+5 tests in `buildLastSessionSummary` describe block):

| Test | Covers |
|------|--------|
| shows "N sets" (not "×undefined") when both actualReps and targetReps absent | Bug fix: null reps fallback |
| falls back to targetReps when actualReps is null | Reps resolution chain |
| appends "+N more" when multiple exercises have actual data | Multi-exercise feature |
| does not append "+N more" for a single-exercise workout | Single-exercise unchanged |
| counts only exercises with actual data when computing moreCount | Exclusion of empty exercises |

### Important areas still untested

- `computeCurrentDayIndex` with `targetDate` before `plan.startDate` (negative dayCount path)
- `HistoryPage` component-level integration (no component tests in the suite)
- `PlanBuilderPage` component-level integration
- `computeWorkoutTypeBreakdown` is tested but its HistoryPage integration path uses a separate
  manual `typeCountMap` — the two implementations are not cross-checked in tests

---

## 2026-05-24 (thirty-eighth pass) — branch `claude/dreamy-mccarthy-oaS1e`

**Result: 738 passing, 0 failing** (+4 new tests; 0 previously-failing tests)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 734 |
| Tests added | 4 |
| Tests on exit | 738 |
| Failures | 0 |

All tests pass. No existing tests were modified.

### Tests added

**`src/store/__tests__/outcomeStore.test.ts` (+3 tests)**
- `does NOT fire YAML progression rules for deferred outcomes (session_complete=false)` —
  sets `myvar: 0`, creates a `deferred` outcome with `slotProgress: { if: 'session_complete', then: 'myvar += 1' }`,
  calls `logOutcomeWithProgression`, asserts `myvar` remains 0.
- `fires YAML progression rules for completed outcomes (session_complete=true)` —
  same setup with `completionState: 'completed'`, asserts `myvar` becomes 1.
- `does NOT fire YAML progression rules for skipped outcomes (session_complete=false)` —
  same setup with `completionState: 'skipped'`, asserts `myvar` remains 0.

**`src/store/__tests__/planStore.test.ts` (+1 test)**
- `deep-clones DrillSpec[] within RunSegment.drills so drill edits do not cross plans` —
  creates a plan with a run slot containing a segment with `drills: [{ name: 'High Knees', … }, { name: 'A-Skips', … }]`,
  duplicates it, asserts the drill array and each drill object have independent references
  while values are equal.

### Important areas still untested

- **Component rendering** — No tests for TodayPage. The `progressionRecommendation.note`
  hint is verified manually only.
- **`progressionRecommendation` generation** — `buildProgressionRecommendation` in
  `modules/workout-outcomes/progression.ts` has its own coverage; the TodayPage display
  path is not unit-tested.
- **YAML editor → zero-duration save path** — Validated manually; a unit test for
  `PlanBuilderPage.handleSave` with `durationValue = 0` would anchor this permanently.

---

## 2026-05-23 (thirty-seventh pass) — branch `claude/dreamy-mccarthy-79X8Y`

**Result: 734 passing, 0 failing** (+2 new tests; 0 previously-failing tests)

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Tests on entry | 732 |
| Tests added | 2 |
| Tests on exit | 734 |
| Failures | 0 |

All tests pass. No existing tests were modified.

### Tests added

**`src/store/__tests__/planStore.test.ts`**
- `deep-clones SetSpec[] within exercises so per-set edits do not cross plans` — verifies
  that `duplicatePlan` produces independent `SetSpec` object references for structured
  exercise sets after the `deepCloneExerciseSpec` fix.
- `deep-clones SetSpec[] within warmup exercises` — same for the `warmup` field.

### Important areas still untested

- **Component rendering** — No tests for TodayPage, PlanBuilderPage, or any component.
  The activity strip dedup fix, `computePlanStreak` wiring, and duration validation
  are verified visually only.
- **`RunSegment.drills` nesting** — DrillSpec arrays inside RunSegments are shallow-cloned.
  Lower risk than the SetSpec fix (drills are rarely edited post-import), but untested.
- **YAML editor → zero-duration save path** — The guard at `handleSave` is correct but
  tested only manually. A unit test for the Plan Builder's `handleSave` with `durationValue = 0`
  would anchor the validation permanently.

---

## 2026-05-22 (thirty-sixth pass) — branch `claude/dreamy-mccarthy-9sH8T`

**Result: 732 passing, 0 failing** (+6 new tests; 0 previously-failing tests)

### Tests added

**`src/store/__tests__/outcomeStore.test.ts` (+6 tests)**
- `importOutcomes syncs plan name when plan exists in store`
- `importOutcomes syncs workout name from history entry when available`
- `importOutcomes sets planName null when plan does not exist`
- `importOutcomes is a no-op for non-weights outcomes`
- `importOutcomes handles empty array without error`
- `importOutcomes syncs multiple outcomes with independent context`
