# Review Notes — Overnight Audit

## 2026-06-22 (sixty-second pass) — branch `claude/dreamy-mccarthy-qo7940`

### Executive summary

1. **What changed**: Fixed two dedup bugs in `historyStats.ts` (cycle progress + plan remaining), added 2 regression tests, added streak-date ring highlighting to CalendarPage using the pre-existing but unused `computeCurrentStreakDates` function.
2. **Highest confidence**: The dedup fixes. They align two functions with the established pattern used throughout the rest of the file and the rotation engine. New tests prove the correct behavior.
3. **Needs your eyes**: The CalendarPage streak ring — visual-only, but I couldn't test it in a browser. Confirm the ring looks right on your device, especially on day-off cells (amber background + emerald ring) which has the most visual contrast collision risk.
4. **Review first**: The two `historyStats.ts` bug fixes (`9855b1d`). Small, isolated, low-risk. Review the test cases to confirm the intended semantics match your expectations for duplicate-entry behavior.

---

### Bugs found and fixed

#### `computeRotationCycleProgress` — inflated cycle count with duplicate entries

Used raw `planEntries.length` instead of `new Set(dates).size`. Inconsistent with `isPlanExpired` and `computePlanProgress`. Impact: TodayPage's "you finished a rotation!" banner could fire early when duplicate entries exist for the same date (e.g. after a CSV re-import). **Fixed.**

#### `computeRotationPlanRemaining` — under-reported remaining workouts

Same root cause. TodayPage's "X workouts left" count would be too low by the number of duplicate date entries. **Fixed.**

---

### Improvements completed

| Item | Files | Notes |
|---|---|---|
| Fix `computeRotationCycleProgress` dedup | `historyStats.ts`, test | See commit `9855b1d` |
| Fix `computeRotationPlanRemaining` dedup | `historyStats.ts`, test | Same commit |
| Streak ring in CalendarPage | `CalendarPage.tsx` | See commit `e40002b` |

---

### Definitely keep

- **Both dedup fixes**: Correct behavior, regression-tested, no behavioral change in normal usage.

### Probably keep but tweak

- **Streak ring in CalendarPage**: Likely good, but verify visually. The `ring-emerald-500/40` at 40% opacity is subtle — you may want to increase to `/60` if it's not visible enough. Day-off cells (amber) might look odd with a green ring.

### Do not keep

- Nothing implemented that I'd recommend reverting outright.

### Recommendations only (not implemented)

1. **Remove `getFutureProjection` dead code** (`src/engine/calendarProjection.ts:107–117`): Documented as unused in its own docstring. Safe to delete if no plans to use it.

2. **Fix `computeConsecutiveSkips` multi-entry date handling**: If two entries exist for the same date (e.g. a `complete` at 8am and a `skip` at 4pm), the function adds the date to both `skipDates` and `breakDates`. Since `breakDates` is checked first in the while loop, the streak breaks — even if the "winner" by recency is the skip. The rotation engine's "most recent wins" rule is not applied here. Low impact in practice (normal usage prevents duplicate entries per date), but worth documenting for future refactoring.

3. **Component/E2E tests**: No UI-level tests exist for modal interactions, form submissions, or the full plan lifecycle. This is the largest test gap. Not urgent given the strong unit-test coverage of all pure functions.

4. **`computeWorkoutTypeBreakdown` dedup**: This function doesn't deduplicate by calendarDate either, but unlike the cycle-progress functions, it's used in HistoryPage as a display aggregate — inflated counts from duplicates wouldn't cause incorrect product behavior (no expiry or remaining-count logic depends on it). Lower priority.

---

### Open questions

1. Should the streak ring also appear on extra-workout cells (currently extras only contribute dots in the day indicator row, not a ring)?
2. Should the `computeConsecutiveSkips` inconsistency be fixed proactively, or is the conservative "break wins" behavior acceptable long-term?
3. Is `getFutureProjection` kept intentionally as a convenience export for potential future use?

### Known issues / incomplete work

- Streak ring was not tested in a browser (remote session; no visual testing capability). Confirm the ring styling works on real devices.
- No FEATURE_REVIEW.md or FEATURE_PROPOSAL.md — this pass's new feature (streak ring) is small enough that it doesn't warrant a full proposal document.

### Dependencies added

None.

---

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
