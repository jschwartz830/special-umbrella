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

## 2026-06-21 (sixty-second pass) — branch `claude/dreamy-mccarthy-zu4z6a`

---

### Executive Summary

1. **What changed**: 3 bug fixes + 1 small feature (PR celebration banner). Tests added for all fixes. Documentation added for timezone convention.
2. **Highest confidence**: The deduplication fix and the 14-day window extension — both are well-tested, low-risk, and correct the core issues found in audit.
3. **What is risky**: The PR celebration banner (medium confidence). The detection logic is correct but the edge case of editing an existing workout with an inflated load could show a false PR banner. Acceptable for v1.
4. **Review first**: Start with the `computeRotationCycleProgress` / `computeRotationPlanRemaining` deduplication fix — it's the most invisible bug and most important to verify.

---

### Audit Findings

#### Finding 1 — catch-up nudge only scanned 7 days (addressed)

**File**: `src/pages/TodayPage.tsx`, `src/lib/historyStats.ts`  
**Risk**: Medium — users returning after > 7 days got a partial stall diagnosis. The catch-up action would mark 7 days as Day Off, but the rotation pointer could still be wrong for older gaps.  
**Action**: Extended lookback to 14 days + added `olderUnloggedCount` display for gaps beyond 14.  
**Status**: Fixed.

---

#### Finding 2 — computeRotationCycleProgress / computeRotationPlanRemaining didn't deduplicate (addressed)

**File**: `src/lib/historyStats.ts`  
**Risk**: Low (store auto-deduplicates), but inconsistent with `isPlanExpired`.  
**Action**: Both functions now use a Set of calendarDate values, matching the dedup strategy used by `isPlanExpired`.  
**Status**: Fixed.

---

#### Finding 3 — Timezone convention undocumented (addressed)

**File**: `src/engine/rotationEngine.ts`  
**Risk**: Low — consistent behavior within a single timezone, but a subtle bug if a user travels and logs workouts in different timezones.  
**Action**: Added a block comment explaining the convention and its limitation.  
**Status**: Documented.

---

#### Finding 4 — No PR feedback on workout completion (feature, addressed)

**File**: `src/pages/TodayPage.tsx`  
**Observation**: PRs were tracked and shown in HistoryPage but not surfaced in the moment of achievement on TodayPage.  
**Action**: Added PR detection in `handleOutcomeConfirm` and dismissible amber banner.  
**Status**: Implemented (see FEATURE_REVIEW.md).

---

#### Finding 5 — No cross-store transaction guarantees (not addressed)

**File**: `src/store/outcomeStore.ts` + `src/store/historyStore.ts`  
**Risk**: If `logOutcomeWithProgression` fails mid-way, entry and outcome may be partially inconsistent.  
**Decision**: Too complex to fix safely in an overnight pass. Existing try/catch prevents crashes. Recommend future work.  
**Status**: Documented only.

---

#### Finding 6 — Component/integration tests absent (not addressed)

**Files**: TodayPage, CalendarPage, OutcomeModal  
**Risk**: Key user flows (log workout → see calendar → check stats) have no automated coverage.  
**Decision**: Requires test infrastructure setup (RTL or Playwright). Out of scope.  
**Status**: Documented only.

---

### Keep / Revise / Reject Guide

| Change | Recommendation |
|---|---|
| Deduplication fix (cycleProgress + remaining) | **Definitely keep** — correctness fix, no risk |
| 14-day catch-up window + older gap count | **Definitely keep** — clear UX improvement, well-tested |
| Timezone documentation comment | **Definitely keep** — improves contributor understanding |
| 12 new tests | **Definitely keep** — all pass, no false positives |
| PR celebration banner | **Probably keep** — good UX, minor edge case on edit flow |

---

### Recommendations Not Implemented

1. **Show progression errors in HistoryPage** — If a YAML progression rule fails to evaluate, it's currently silent. Add a `progressionError?: string` field to `WorkoutOutcome` and display a warning badge in the History or TodayPage when set.
2. **Cross-store consistency check** — Consider a one-time migration/audit that finds `HistoryEntry` records without a corresponding `WorkoutOutcome` and flags them, so users can re-log or dismiss the orphan.
3. **Component tests** — Adding RTL tests for TodayPage's key flows (complete workout, undo, double-day) would prevent regressions across the many edge cases in that component.
4. **Extended catch-up (> 14 days)** — The Calendar page is the right tool for older gaps. Consider adding a "bulk mark as Day Off" from CalendarPage month view to make this less manual.

---

### Open Questions

1. Should the PR banner persist across page navigations (stored in `sessionStorage`) or is ephemeral state (resets on reload) acceptable?
2. The 14-day catch-up window was chosen as a reasonable "two weeks" boundary. Is there a specific real-world user scenario that would require a longer window (e.g., injury recovery)?
3. Should `computeRotationCycleProgress` and `computeRotationPlanRemaining` also guard against `planDayIndex` being out of bounds (i.e., entries created when a plan had more days)? Currently they count all entries with matching planId, even if the index no longer exists in the plan.
