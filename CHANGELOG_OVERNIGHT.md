# Overnight Changelog
_Date: 2026-09-17_

All changes are on branch `claude/admiring-noether-u3cvir`.

---

## 1. fix(calendar): align day-header row with weekStartsOn setting

**Commit:** a80004e

**Summary:** The DAYS header array was hardcoded `['Sun', 'Mon', ...]` regardless of the user's week-start preference. `buildMonthGrid` correctly shifts grid cells when `weekStartsOn=1` (Monday), but the header row did not follow, so Monday-first users saw "Sun" above the Monday column.

**Fix:** Renamed the module-level constant to `ALL_DAYS`. Inside the component, derive `orderedDays` from `weekStartsOn` by rotating the array one position for Monday starts.

**Files changed:** `src/pages/CalendarPage.tsx`

**Risk:** Low. Pure data transformation. The `buildMonthGrid` tests already assert that grid cells are correctly positioned; the header was the only misaligned piece.

**Rollback:** Revert the commit.

---

## 2. fix(routing): redirect unknown paths to /today

**Commit:** c891cf5

**Summary:** Navigating to an unknown URL (stale bookmark, typo, bad deep link) rendered a blank `AppShell` with no content and no indication of the problem.

**Fix:** Added `<Route path="*" element={<Navigate to="/today" replace />} />` as the last route inside the `AppShell` route.

**Files changed:** `src/App.tsx`

**Risk:** Very low. React Router catch-all, no logic involved.

**Rollback:** Revert the commit.

---

## 3. refactor(calendarProjection): remove dead code and leaky mod re-export

**Commit:** 4bbad21

**Summary:**
1. The partial-week flush guard `if (week.length > 0) weeks.push(week)` after the loop can never trigger — `allDays.length` is always a multiple of 7 because `gridStart`/`gridEnd` come from `startOfWeek`/`endOfWeek`.
2. `mod` was re-exported from `calendarProjection` despite being an internal rotation engine utility. No file in the codebase imported it via this path.

**Files changed:** `src/engine/calendarProjection.ts`

**Risk:** Very low. Dead code removal verified by calendarProjection test suite (43 tests, all pass).

**Rollback:** Revert the commit.

---

## 4. perf(historyStore): replace sort with reduce in removeLastOverrideByType

**Commit:** e155327

**Summary:** `removeLastOverrideByType` sorted the filtered overrides array (O(n log n)) to find the one with the largest `appliedAt`. A single `reduce` pass (O(n)) finds the same maximum more directly and expressively.

**Files changed:** `src/store/historyStore.ts`

**Risk:** Low. Semantically equivalent — both find the latest override by `appliedAt`. Verified by store test suite (356 tests, all pass).

**Rollback:** Revert the commit.

---

## 5. perf(outcomeStore): use prefix check in clearPlanOutcomes

**Commit:** d04a317

**Summary:** `clearPlanOutcomes` previously called `parseWorkoutInstanceId` on every outcome key, which parses the full ID with regex and string operations. A `startsWith(planId + '_')` check is correct per the workoutInstanceId format contract and avoids the parse cost.

**Files changed:** `src/store/outcomeStore.ts`

**Risk:** Low. Equivalent behavior given the `planId + '_'` format guarantee. Verified by store test suite (356 tests, all pass).

**Rollback:** Revert the commit.

---

## 6. fix(expressionEval): strip 'lbs' suffix in resolveLoad (not just 'lb')

**Commit:** c9e7e43

**Summary:** The regex `/lb$/i` only stripped a bare `lb` suffix. The plural `lbs` would pass through, causing the tokenizer to split `135lbs` into number `135` and identifier `lbs`. In simple cases this silently produced the right answer (135), but a compound expression like `0.75 * squatlbs` would look up the wrong variable `squatlbs` instead of `squat`. Changed to `/lbs?$/i`.

**Files changed:** `src/lib/expressionEval.ts`

**Risk:** Low. The only behavioral change is correct stripping of `lbs` suffixes that were previously silently handled by the tokenizer's accidental numeric extraction.

**Rollback:** Revert the commit.

---

## 7. fix: guard pace functions against zero distance + add tests; warn on bad CSV date

**Commit:** 44159cc

**Summary:**
1. `derivePaceSecondsPerMile` and `deriveSwimPaceSecondsPer100m` in `types.ts` — added `if (distanceMiles/distanceMeters <= 0) return 0` guard. Previously these returned `Infinity` for zero/negative distance, which could corrupt stored outcome data if a future caller skips the existing UI-level guards.
2. `expressionEval.test.ts` — added two tests confirming `resolveLoad` strips `lbs` and `LBS` plural forms.
3. `types.test.ts` — added four tests (two per function) confirming zero and negative distance return 0.
4. `csv.ts plansFromCsv` — when `planStartDate` is non-empty but not a valid YYYY-MM-DD date, emit a warning instead of silently defaulting to today.

**Files changed:** `src/modules/workout-outcomes/types.ts`, `src/modules/workout-outcomes/__tests__/types.test.ts`, `src/lib/__tests__/expressionEval.test.ts`, `src/lib/csv.ts`

**Risk:** Very low for guards (callers already guard at the UI layer). CSV warning is additive.

**Rollback:** Revert the commit.
