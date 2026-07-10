# Overnight Changelog — Pass 76 (2026-07-10)

## Branch: `claude/dreamy-mccarthy-ykrmd3`

### Commit 1 — `fix: use 'other' instead of 'rest' as fallback slot type in CalendarPage`

**File:** `src/pages/CalendarPage.tsx` line 224

- **Bug:** `handleOutcomeConfirm` used `'rest'` as the fallback slot type when `planDay.slots[0]` was undefined. `'rest'` is a legacy `WorkoutType` value that was migrated to `'other'` in `planStore` v2 (`migrateSlot`). Passing `'rest'` to `logOutcomeWithProgression` meant program-level progression rules for `other` type slots could silently fail to evaluate.
- **Fix:** Changed `{ id: '', type: 'rest' as WorkoutType, name: '' }` → `{ id: '', type: 'other' as WorkoutType, name: '' }`.
- **Same bug** was fixed in `HistoryPage.tsx` in Pass 70. CalendarPage was missed.
- **Risk:** Minimal — the fallback is only reached when `planDay.slots` is empty (rare; only possible for days created before slot-required validation was added).

---

### Commit 2 — `feat: add single-retry on storeSync push failure`

**File:** `src/lib/storeSync.ts`

- **Problem:** `pushStore` logged errors but never retried. A single transient network failure permanently diverged local and Supabase state until the next successful write (next store change or next login).
- **Fix:** Added `isRetry = false` parameter. On error, if `!isRetry`, schedules a single `setTimeout(..., 5000)` that re-reads fresh state from the store and retries once. The retry sets `isRetry = true` to prevent cascading retries.
- **Why fresh state on retry:** The initial `data` argument captures the state at the moment of the failed write. If the user continued working during the 5-second delay, re-reading `store.getState()` at retry time sends the more current data.
- **Risk:** Low. The retry only fires once per failure event. If the retry also fails, it logs the error and stops — no infinite loops. This is purely additive.

---

### Commit 3 — `feat: show run progression result badge on TodayPage after logging`

**Files:** `src/pages/TodayPage.tsx`

- **Problem:** `outcomeStore.progressionStates` stored run adaptation decisions (progress/hold/regress/reset) after every run log, but TodayPage never surfaced the result to the user after completion. The pre-workout adaptation note existed but the post-workout result was only visible in HistoryPage.
- **Changes:**
  1. Added reactive `progressionStates = useOutcomeStore(s => s.progressionStates)` subscription (line ~191) so the component re-renders when progression state changes.
  2. Changed `todayProgressionState` computation from non-reactive `getProgressionState(id)` call to direct `progressionStates[groupId] ?? null` lookup.
  3. Added `dismissedProgressionInstanceId` state (resets when a new run is logged — keyed to instanceId, not a simple boolean).
  4. Added `showProgressionBadge` / `progressionBadgeConfig` derived variables with color config per `lastResult` ('progress' → sky, 'hold' → slate, 'regress' → amber, 'reset' → slate).
  5. Added dismissible badge JSX between the PR celebration banner and the today's workout card.
- **Badge shows when:** `todayProgressionState.lastCompletedWorkoutInstanceId === instanceId` (today's run just logged) and `lastResult != null` and not dismissed.
- **Dismiss semantics:** Records the dismissed `instanceId` so the badge auto-reappears next time a new run is logged (new instanceId = new date).
- **Risk:** Low. The feature is purely additive UI — no store mutations, no new data structures. Falls back to hidden when `todayProgressionState` is null (non-progression runs).

---

## Summary

| Metric | Before | After |
|---|---|---|
| Tests | 1056 | 1056 (unchanged) |
| TypeScript errors | 0 | 0 |
| Test files | 30 | 30 |
