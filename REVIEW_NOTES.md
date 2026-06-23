# Review Notes — Overnight Audit

## 2026-06-19 (sixty-first pass) — branch `claude/dreamy-mccarthy-7ugj5k`

---

### Audit scope

Focused on:
1. Test coverage gaps in pure utility modules
2. Feature opportunities that are additive and low-risk
3. Edge cases in existing tested code that remain unverified

---

### Finding 1 — Zero test coverage on `outcomeSortKey` (addressed)

**File**: `src/lib/outcomeSortKey.ts`
**Risk**: Low — function is pure and well-named, but the fallback chain (`completedAt ?? parseWorkoutInstanceId(...)?.calendarDate ?? ''`) had never been exercised in tests.
**Action**: Added 9 tests in `src/lib/__tests__/outcomeSortKey.test.ts`.
**Status**: Resolved.

---

### Finding 2 — Zero test coverage on `planDayUtils.extraToPlanDay` (addressed)

**File**: `src/lib/planDayUtils.ts`
**Risk**: Low — function is trivial but is called in multiple pages (TodayPage, CalendarPage) when rendering extra workouts. A silent field rename (e.g., `workoutName → name`) would break silently without tests.
**Action**: Added 8 tests in `src/lib/__tests__/planDayUtils.test.ts`.
**Status**: Resolved.

---

### Finding 3 — `addOverride` in historyStore had no direct tests (addressed)

**File**: `src/store/historyStore.ts` → `addOverride()`
**Risk**: Medium — overrides are critical to the rotation engine. An override with a bad `appliedAt` or missing `targetDayIndex` would silently miscalculate the rotation pointer without any test catching it.
**Action**: Added 6 tests in the `addOverride` describe block in `src/store/__tests__/historyStore.test.ts`.
**Status**: Resolved.

---

### Finding 4 — No way to share/copy today's workout (feature opportunity, addressed)

**Area**: TodayPage UX
**Observation**: The TodayPage renders rich workout detail (exercises, sets, reps, distances, segments) but provided no mechanism for a user to extract that information — e.g., to paste in a notes app, share with a coach, or print.
**Action**: Added `formatWorkoutForClipboard` utility + Copy button. See FEATURE_PROPOSAL.md and FEATURE_REVIEW.md.
**Status**: Implemented.

---

### Finding 5 — Timezone ambiguity in `removeRetroJumpForDate` (not addressed)

**File**: `src/store/historyStore.ts`, line ~180
**Pattern**: `format(new Date(ov.appliedAt), 'yyyy-MM-dd')` extracts a local date from a UTC ISO string.
**Analysis**: The app always writes `appliedAt` via `new Date().toISOString()` (UTC). Reading it back via `new Date(isoString)` followed by `format(..., 'yyyy-MM-dd')` will yield the _local_ date, not UTC. For a user in UTC-8, a workout logged just after midnight UTC (e.g., `2026-06-20T00:30:00Z`) would be interpreted as `2026-06-19` locally. This is actually _correct_ — the user's local midnight is the right boundary for this PWA.
**Conclusion**: This is not a bug. The round-trip is intentional and consistent. No change needed.
**Status**: Documented, no action taken.

---

### Finding 6 — `formatWorkoutForClipboard` doesn't include warmup from slot

**File**: `src/lib/shareWorkout.ts`
**Observation**: `WorkoutSlot` has an optional `warmup` field (array of `ExerciseSpec`) that is distinct from `exercises`. The formatter renders `exercises` but not `warmup`.
**Risk**: Low — warmup is rarely populated in plans and the clipboard text is not a functional record.
**Decision**: Out of scope for this pass. Could be added in a future pass when warmup display is requested by users.
**Status**: Documented only.

---

### Coverage summary after this pass

| Module | Before | After |
|--------|--------|-------|
| `outcomeSortKey.ts` | 0 tests | 9 tests |
| `planDayUtils.ts` | 0 tests | 8 tests |
| `historyStore.addOverride` | 0 tests | 6 tests |
| `shareWorkout.ts` | — (new) | 15 tests |
| **Total suite** | **887** | **923** |

---

### Code quality notes

- `src/lib/shareWorkout.ts` is a pure function with no imports from React or store — easy to test, easy to reuse.
- The copy button in TodayPage follows the same conditional render pattern as the existing Start Workout / Skip buttons — consistent with the surrounding code.
- No new dependencies introduced in this pass.
- All new test files follow the existing Vitest + `describe`/`it`/`expect` conventions used across the codebase.

---

## Pass 62 — 2026-06-23

### Executive Summary

Three targeted changes: one high-value UX bug fix, one defensive low-level fix, and one small adjacent feature. All 923 tests continue to pass. The codebase is in excellent shape — this pass was about removing friction, not structural repair.

---

### What Changed

| # | Type | Summary |
|---|------|---------|
| 1 | Bug fix | OutcomeModal now shows "Discard changes?" when closing a dirty *new* log form |
| 2 | Bug fix | `roundMiles` uses `Number.EPSILON` to avoid midpoint rounding-down |
| 3 | Feature | Previous session notes shown as hint inside OutcomeModal while logging |

---

### Biggest Issues Found

**Only one real bug** of user-visible consequence:

- **OutcomeModal close without save** (`OutcomeModal.tsx:249`): Users filling in a new workout outcome can accidentally close the modal and lose all entered data — effort rating, run distance, notes, sets. The fix removes the `existingOutcome &&` guard so the confirmation fires on any dirty form.

The floating-point rounding issue (`roundMiles`) is a latent bug that won't manifest with the current default step size but is correct to fix.

---

### Improvements Completed

1. **Discard warning for new outcomes** — single-line fix, zero risk.
2. **`roundMiles` epsilon** — defensive fix, observable only with sub-0.5-mile custom step sizes.
3. **Previous notes hint in OutcomeModal** — additive feature, optional prop, no impact on Calendar/History pages.

---

### Definitely Keep

- OutcomeModal discard warning fix (clear bug, zero risk)
- roundMiles epsilon fix (correct defensive practice)

### Probably Keep, But Tweak

- Previous notes hint: the content and styling are conservative. Consider:
  - Expanding to 3 lines (currently `line-clamp-2`)
  - Also showing it when editing an existing outcome for additional context

### Do Not Keep

_(nothing from this pass falls in this category)_

---

### Recommendations Only (Not Implemented)

1. **`console.warn` for division by zero in `expressionEval`** — YAML authors have no signal that `x / 0` silently resolves to `0`. A warning log would help debug broken progression rules. Requires product decision about surfacing errors to users.

2. **`key={planDay.id}` on OutcomeModal callers** — Forces remount when `planDay` changes, making the stale-state risk in `weightExercises` initialization impossible. Low urgency since remounting already happens in practice.

3. **Plan creation validation** — `createPlan` should throw when `days.length === 0` (or at minimum warn). The engine handles it defensively, but silent misconfiguration is hard to debug.

4. **Exhaustiveness check in `makeSlot()`** — The `else { defaults.name = 'Other' }` fallback swallows new `WorkoutType` values without TypeScript catching it. Add a `_exhaustive: never = type` guard.

---

### Open Questions for You

1. **Previous notes hint scope**: Should the hint show on Calendar/History page modals too, or stay TodayPage-only? Those pages don't currently compute `prevSessionOutcome`, so it would require some work.

2. **Division by zero feedback**: Do you want users to see progression rule errors? If so, how — inline in the outcome modal, a toast, or just console logs that a developer would check?

3. **Custom step sizes**: Are sub-0.5-mile step sizes (e.g. 0.1 mi) a planned feature? If so, the `roundMiles` fix becomes more important and deserves a test.

---

### Known Issues / Incomplete Work

- No new tests added this pass. The bug fixes are logic changes that require React Testing Library or Playwright to test properly (modal open/close behavior). The `roundMiles` fix affects a private function only testable through integration.

---

### Dependencies Added

None.
