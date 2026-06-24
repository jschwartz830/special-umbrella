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

## 2026-06-24 (sixty-second pass) — branch `claude/dreamy-mccarthy-uan3ll`

### Executive Summary

1. **What changed**: Fixed two stat-computation functions (`computeRotationCycleProgress`, `computeRotationPlanRemaining`) that were inconsistently counting raw entry array length instead of unique calendar dates — the pattern used everywhere else in the codebase. Added 2 regression tests.
2. **Highest confidence**: The dedup fix is a clear, provable correctness issue with zero side effects. The fix pattern is already proven correct by peer functions.
3. **What is risky**: Nothing in this pass is risky. The changes are narrow, pure-function fixes with regression tests.
4. **What to review first**: The two diffs in `src/lib/historyStats.ts` (lines 168-184 and 210-216). Both are straightforward Set-size vs array-length substitutions.

---

### Finding 1 — `computeRotationCycleProgress` raw length vs deduplicated size (fixed)

**File**: `src/lib/historyStats.ts`, `computeRotationCycleProgress`
**Severity**: Medium — user-visible stat corruption when duplicate entries exist
**Root cause**: `planEntries.length` instead of `new Set(dates).size`
**Peer functions**: `computePlanProgress`, `isPlanExpired`, `computeCurrentDayIndex` all deduplicate correctly
**Action**: Fixed + regression test added.
**Verdict**: Definitely keep.

---

### Finding 2 — `computeRotationPlanRemaining` raw length vs deduplicated size (fixed)

**File**: `src/lib/historyStats.ts`, `computeRotationPlanRemaining`
**Severity**: Medium — "remaining workouts" count under-reported when duplicate entries exist
**Root cause**: `.filter(...).length` instead of `new Set(dates).size`
**Action**: Fixed + regression test added.
**Verdict**: Definitely keep.

---

### Finding 3 — `allSetsHitTarget` redundant guard (documented, not fixed)

**File**: `src/modules/workout-outcomes/progression.ts`, line 79
**Issue**: `if (!allSets.every(s => s.completed === true)) return false` runs before checking `completedSets.every(...)`. Since `completedSets = allSets.filter(s => s.completed)`, the first check is implied by the second. It's a redundant early-return, not wrong.
**Risk**: Touching this could silently change edge-case behavior for sets with `completed: undefined` vs `completed: false`.
**Verdict**: Recommendations only — don't touch.

---

### Finding 4 — `sortedOverrides` recomputed in three rotation engine functions (documented, not fixed)

**File**: `src/engine/rotationEngine.ts`
**Issue**: `[...overrides].filter(o => o.planId === plan.id).sort(...)` is copy-pasted in `getTodayResolvedDay`, `getUpcomingDays`, and `getResolvedDaysRange`. Could be extracted to a `sortedPlanOverrides(overrides, plan.id)` helper.
**Risk**: Cosmetic change; correctness is unaffected. The three call sites share no state.
**Verdict**: Recommendations only — revisit if the pattern expands to a fourth function.

---

### Finding 5 — `TodayPage.tsx` size (documented, not fixed)

**File**: `src/pages/TodayPage.tsx` (1240 lines, 15+ useState hooks)
**Issue**: Large but functional. The existing structure is consistent and all sections follow the same pattern. Not a bug — just a maintenance note.
**Verdict**: Recommendations only — defer until the file adds another 200+ lines or a bug surfaces in state interaction.

---

### Recommendations Only (not implemented)

- **`computeLoggedRate` extended return**: Currently returns `number | null` (percentage). A future variant could return `{ rate, loggedDays, activeDays }` to enable "12 of 14 days" UI copy.
- **`computeCurrentStreakDates` in WeeklyActivityStrip**: This function returns the set of dates in the current streak but isn't imported in TodayPage. Passing it to WeeklyActivityStrip could add a subtle "in streak" ring around dots — visually differentiating "did it" from "doing it consistently".
- **Warmup section in `formatWorkoutForClipboard`**: `WorkoutSlot.warmup` is not included in clipboard output. Low frequency but could be added in a future pass.

---

### Open Questions

- Are duplicate entries in `wpt_history` actually occurring for any real users? The `addEntry` dedup guard should prevent it in normal use. The fix matters mainly for CSV re-import edge cases and defensive correctness.
- Should `computeRotationCycleProgress` accept a `today` parameter consistently with `computeRotationPlanRemaining`? Currently `today` is optional in both but used differently. Low priority since callers always pass `today`.

---

### Known Issues / Incomplete Work

None. All changes in this pass are complete and all tests pass.

---

### Dependencies Added

None.
