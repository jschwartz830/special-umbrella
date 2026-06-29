# Review Notes — Overnight Audit

## 2026-06-29 (sixty-seventh pass) — branch `claude/dreamy-mccarthy-hhiaa3`

---

### Executive summary

This pass audited the Supabase auth + cloud sync feature (PR #165) and the two human-authored UI commits that landed since pass 66. Found two bugs in the new sync code and implemented the run-progression-result display feature that had been recommended since pass 63.

**What changed**: 3 commits — 2 bug fixes + 1 feature + 1 test file (5 new tests).

**Highest confidence**: The AuthGate subscription leak fix (clear correctness bug, surgical change) and the storeSync error logging (observability improvement, zero risk). The settingsStore tests are trivial and safe.

**Risky parts**: The run progression badge is additive and purely read-only, but it adds visual output to HistoryPage for a store value (`progressionStates`) that most users may have empty (the run adaptation engine only fires for `progressionEligible` slots, which requires an explicitly configured `runConfig.progressionGroupId`). Users without that config won't see anything different.

**Review first**: The AuthGate fix — it changes cleanup ordering for the auth flow. Confirm the `cancelled` flag correctly handles the user-logs-out-during-syncOnLogin scenario.

---

### Audit scope

Full read of new code added since pass 66:
- `src/components/auth/AuthGate.tsx` — auth initialization + store subscription lifecycle
- `src/store/authStore.ts` — Supabase session management
- `src/lib/storeSync.ts` — cloud sync push/pull logic
- `src/lib/supabase.ts` — Supabase client init
- `src/App.tsx` — AuthGate wrapping all routes
- `src/store/settingsStore.ts` — new settings store
- `src/components/workout/OutcomeMetrics.tsx` — outcome display component (for progression badge)
- `src/pages/HistoryPage.tsx` — history item rendering (for progression badge wiring)

Test suite on entry: **961 tests passing** across 25 test files.

---

### Bug fixed: AuthGate subscription leak when syncOnLogin races against effect cleanup (MEDIUM)

**Location**: `src/components/auth/AuthGate.tsx` — second `useEffect`

**Issue**: The effect called `syncOnLogin()` (async network request) then in `.then()` called `subscribeStores()` and assigned the result to `unsubscribeStores`. The effect's cleanup function called `unsubscribeStores?.()`. If cleanup ran **before** the `.then()` callback (component unmount, or user → null from logout), `unsubscribeStores` was still `undefined` at cleanup time. After cleanup, `.then()` fired and created Zustand store subscriptions that would never be freed — leaking listeners and causing duplicate Supabase pushes on re-login.

**Fix**: Added `let cancelled = false` before the async call. The `.then()` callback guards with `if (!cancelled)` before calling `subscribeStores()`. The cleanup sets `cancelled = true` before calling `unsubscribeStores?.()`.

**Verdict**: **Definitely keep** — correct behavior for any async-cleanup pattern in React.

---

### Bug fixed: storeSync.ts swallowed Supabase errors silently (LOW)

**Location**: `src/lib/storeSync.ts` — `pushStore` and `syncOnLogin`

**Issue**: Both the `upsert` in `pushStore` and the `select` in `syncOnLogin` returned `{ data, error }` from the Supabase SDK. Neither destructured or logged `error`. A network failure, RLS rejection, or schema mismatch would silently produce a no-op — no user feedback, no console output, no retry.

**Fix**: Destructure `error` from both calls; `console.error` when non-null. For the `select` in `syncOnLogin`, also return early so stale cloud data isn't applied to a partial response.

**Verdict**: **Definitely keep** — observability improvement with zero runtime cost.

---

### Feature added: run progression result badges in HistoryPage (MEDIUM)

**Location**: `src/components/workout/OutcomeMetrics.tsx` + `src/pages/HistoryPage.tsx`

**Context**: When a user completes a progression-eligible run, the run adaptation engine decides to progress/hold/regress the target distance. This decision has been stored in `outcomeStore.progressionStates` since the module was introduced (passes ~55–58), keyed by `progressionGroupId` with `lastCompletedWorkoutInstanceId` linking it to a specific workout. No UI ever showed the result.

**What was built**: `OutcomeMetrics` accepts `progressionState?: RunProgressionState | null`. When `lastResult === 'progress'`, it shows a green "↑ Progressed — next target: N mi" line. When `lastResult === 'regress'`, an amber "↓ Adjusted down — next target: N mi" line. Hold and none are silent. `HistoryPage` builds a reverse-lookup `Map<instanceId, RunProgressionState>` from all stored progression states.

**Verdict**: **Definitely keep** — surfaces the run adaptation system for the first time. Users who have progression-eligible runs will see the consequence of each run result in their history.

**Open questions**:
1. Should the "next target" shown be labeled more explicitly (e.g. "next run: 5.5 mi" vs "next target: 5.5 mi")?
2. Should the badge also appear in TodayPage's resolved card (after completing today's run)?

---

### Test coverage added: settingsStore (5 tests)

`settingsStore` was the only Zustand store without any unit test coverage. Added 5 tests covering default value and all `setStartDelay` behaviors. All 7 Zustand stores now have at least basic test coverage.

---

### Non-issues confirmed

| Item | Verdict |
|---|---|
| Supabase anon key hardcoded in `supabase.ts` | Correct for Supabase frontend usage. `sb_publishable_` prefix confirms this is the public key. Security is enforced by Row Level Security policies on the database side. |
| AuthGate blocks entire app behind Google login | Intentional product design in PR #165. `getSession()` reads from localStorage (fast, offline-safe), so `loading` resolves quickly even without network. |
| `syncOnLogin` "cloud wins" override on login | Known limitation. For a personal single-user tracker this is acceptable. Multi-device merge requires per-record vector clocks — well out of scope. |
| `subscribeStores` pushes every state change | 1500ms debounce correctly coalesces rapid changes (e.g., during active set logging). Acceptable. |
| TypeScript: `tsc --noEmit` | Exits clean after all changes. |

---

### Recommendations for future passes

1. **storeSync.ts retry on push failure** — Currently errors are logged but not retried. A failed push during poor connectivity permanently desynchronizes local and cloud state until the next successful change. A simple 1-retry with delay would reduce drift frequency.

2. **storeSync.ts integration test** — Testing storeSync requires mocking the Supabase client. `vi.mock('@supabase/supabase-js')` is straightforward; the sync module itself has no complex dependencies. A test for `syncOnLogin` (cloud wins, first-ever login push) and `pushStore` (error path) would complete coverage.

3. **Run progression badge on TodayPage** — The same `progressionState` could be shown in today's resolved workout card after completing a run (with wording like "You progressed! Next run: 5.5 mi"). This surfaces the achievement at the moment of completion rather than only in History.

4. **Component/integration test layer** — Unit coverage is excellent. A thin RTL smoke test over TodayPage's core flow (start workout → complete → outcome modal → log) remains the biggest gap in quality assurance.

---

## 2026-06-28 (sixty-sixth pass) — branch `claude/dreamy-mccarthy-7v05ht`

---

### Audit scope

Full re-read of:
- `src/components/workout/CardioWorkoutTracker.tsx` — timer state, interval logic, segment navigation, completion callback
- `src/components/workout/ActiveWorkoutTracker.tsx` — wall-clock pattern reference
- `src/store/mobilityStore.ts` — new Zustand store, all 6 actions
- `src/pages/CalendarPage.tsx` — DayDetailModal level structure, copy button gap
- `src/lib/shareWorkout.ts` — `formatWorkoutForClipboard` API
- `src/store/__tests__/` — existing test coverage inventory

Test suite on entry: **943 tests passing** across 24 test files.

---

### Bug fixed: CardioWorkoutTracker timer drifts when app is backgrounded (HIGH)

**Location**: `src/components/workout/CardioWorkoutTracker.tsx`

**Issue**: The cardio session timer used `setInterval(() => { setTotalElapsed(s => s + 1); setSegmentElapsed(s => s + 1) }, 1000)` — simple 1-second accumulation. iOS browsers throttle or fully pause `setInterval` when the page is backgrounded (screen lock, tab switch). A user who locks their phone mid-run would see the displayed time freeze and the recorded duration would be shorter than actual elapsed time. `ActiveWorkoutTracker` already used the correct wall-clock pattern; `CardioWorkoutTracker` was authored without it.

**Fix**: Applied the same wall-clock pattern:
- Added `totalElapsedRef` and `segmentElapsedRef` — ref mirrors of state, readable in interval callbacks without stale closures
- Added `wallTotalRef` and `wallSegRef` (`{ elapsed, time }` bases) — captured on each timer start/resume
- Changed interval to compute `baseElapsed + Math.floor((Date.now() - baseTime) / 1000)` rather than incrementing
- Added `visibilitychange` effect to reconcile immediately on foreground restore
- Updated `goNext`/`goPrev` to reset `wallSegRef` on segment advance; `goNext`/`finish` now read `totalElapsedRef.current` to avoid stale state

---

### Gap addressed: mobilityStore had no unit tests (MEDIUM)

**Location**: `src/store/mobilityStore.ts` — new store added by human commits between pass 65 and pass 66

**Issue**: Every other Zustand store in the project has test coverage. `mobilityStore` had none. The store is the data layer for the daily mobility routine feature — reorder and removal bugs could silently corrupt the user's saved routine between sessions.

**Action**: Added `src/store/__tests__/mobilityStore.test.ts` with 18 tests covering all 6 actions and default state. Pattern matches all other store test files (persist mocked as pass-through, `resetStore()` helper restores default state between tests).

---

### Feature added: copy-workout button on CalendarPage (LOW RISK)

**Location**: `src/pages/CalendarPage.tsx` → `DayDetailModal` Level 2 rotation view

**Issue**: `TodayPage` has had a "Copy workout" button since pass 61 (`formatWorkoutForClipboard`). `CalendarPage` did not — users couldn't copy historical or scheduled workouts from the calendar view.

**Action**: Added Copy button in the Level 2 rotation detail panel, matching TodayPage's behavior: appears only when `!isDayOff`, turns emerald for 2 seconds on success, silently catches clipboard permission errors. No new dependencies; reuses existing `formatWorkoutForClipboard`.

---

### Non-issues confirmed

| Item | Verdict |
|---|---|
| `mobilityStore` version: 1, no migrate function | Correct — v1 is the initial version, no prior state to migrate |
| `removeLastOverrideByType` sort stability | Safe — sorts by `appliedAt` string (ISO 8601), ties are broken deterministically by JS sort |
| `CardioWorkoutTracker` props interface | Clean — `onComplete(totalElapsed, segmentElapseds)` signature unchanged by fix |
| `formatWorkoutForClipboard` null safety | Safe — guards `slot.exercises?.length` before mapping |

---

## 2026-06-27 (sixty-fifth pass) — branch `claude/dreamy-mccarthy-zak0k0`

---

### Audit scope

Full re-read of:
- `src/pages/TodayPage.tsx` — full Undo flow, double-day flow, action handlers
- `src/store/historyStore.ts` — all actions, migration logic
- `src/store/outcomeStore.ts` — outcome persistence, exercise sync
- `src/types/index.ts` — HistoryEntry, ExtraWorkoutEntry, OverrideEntry shapes
- Corresponding test files

Test suite on entry: **936 tests passing** across 24 test files.

---

### Bug fixed: Undo after double-day left stale advance override (HIGH)

**Location**: `src/pages/TodayPage.tsx` Undo handler (~line 924) + `src/store/historyStore.ts`

**Issue**: The double-day flow in `handleOutcomeConfirm` adds both a `double_day`
`ExtraWorkoutEntry` and an `advance` override (rotation pointer +1). The Undo button
removed the extra and outcome but silently left the `advance` override in place. After
Undo, the rotation was permanently one day ahead.

**Fix**: Added `removeLastOverrideByType(planId, type)` to historyStore and called it
from the Undo handler when a double_day extra was removed. 7 tests added.

---

### Non-issues confirmed

| Item | Verdict |
|---|---|
| `migrateHistoryState` v0→v1 source migration | Correct — conservatively sets undefined → 'history' |
| `clearPlanOutcomes` nanoid prefix matching | Safe — nanoid output is alphanumeric + hyphen only |
| `buildVars()` boolean-to-0/1 in expressionEval | Correct — confirmed by existing tests |
| `removeRetroJumpForDate` scope | Correct — date-local, type-scoped, only affects jumps |

---

## 2026-06-26 (sixty-fourth pass) — branch `claude/dreamy-mccarthy-fxnzht`

---

### Audit scope

Full re-read of key modules:
- `src/pages/TodayPage.tsx`
- `src/engine/rotationEngine.ts`
- `src/lib/historyStats.ts`
- `src/store/historyStore.ts`
- `src/store/outcomeStore.ts`
- `src/types/index.ts`
- All corresponding test files

Test suite on entry: **936 tests passing** across 24 test files.

---

### Findings

#### Bug: adherence bar shown after 2 days instead of 7 (FIXED)

**Location**: `src/pages/TodayPage.tsx:650`

**Issue**: The comment at line 319 explicitly documents that the adherence bar is "shown after plan has been active ≥ 7 days so the percentage is meaningful." However, `computeLoggedRate` returns `0` (not `null`) once `activeDays >= 1`, so the guard `loggedRate !== null` was satisfied as soon as one past day existed (i.e., from day 2 of the plan). The bar showed a 0% reading with only one or two data points — not meaningful.

**Fix**: Added `differenceInCalendarDays(parseISO(today), parseISO(plan.startDate)) >= 7` to the display condition.

---

### Non-issues confirmed

| Item | Verdict |
|---|---|
| Redundant `removeEntry` before `updateEntryDate` in `handleOutcomeConfirm` | Harmless — `updateEntryDate` removes collisions internally; double removal is a no-op. |
| Dual streak computation (`stats.currentStreak` + `planStreak`) | Equivalent values (entries pre-filtered); extra computation is negligible; not worth removing. |
| `countPlanDayCompletions` deduplication | Fixed in pass 63 — verified still correct. |
| `clearPlanOutcomes` startsWith safety | Verified safe as in pass 63. |
| All historyStats deduplication functions | Consistent Set usage across all counting paths. |

---

### Recommendations for future passes

1. **Progression state UI** — `RunProgressionState.lastResult` stored but never surfaced in HistoryPage. A small indicator chip would make the progression system visible.

2. **CalendarPage copy-workout button** — TodayPage has clipboard copy (pass 61). Extending to CalendarPage lets users share historical/future workouts.

3. **Component/integration test layer** — Unit coverage is excellent. Thin RTL or Playwright smoke tests over key flows (log, skip, day off, undo) would round out quality.

---

## 2026-06-25 (sixty-third pass) — branch `claude/dreamy-mccarthy-nmt6dy`

---

### Audit scope

Full read of all key modules:
- `src/engine/rotationEngine.ts`
- `src/lib/historyStats.ts`
- `src/lib/expressionEval.ts`
- `src/lib/workoutInstanceId.ts`
- `src/lib/sessionSummary.ts`
- `src/store/outcomeStore.ts`
- `src/store/historyStore.ts`
- `src/modules/run-adaptation/engine.ts`
- `src/modules/workout-outcomes/progression.ts`
- All corresponding test files

Test suite on entry: **935 tests passing** across 24 test files.

---

### Findings

#### Bug: `countPlanDayCompletions` does not deduplicate (FIXED)

**Location**: `src/lib/historyStats.ts:704`

**Issue**: Unlike every other counting function in the module, this one counted raw entry records rather than unique calendarDates. A CSV re-import that creates a second entry for an already-logged date would inflate the count, causing the "Session N" label in TodayPage to display an incorrect number.

**Pattern comparison** — all of these use a `Set` of calendarDates:
- `isPlanExpired` — uses `uniqueDates` Set
- `computeRotationCycleProgress` — fixed in pass 62 to use Set
- `computeRotationPlanRemaining` — fixed in pass 62 to use Set
- `countTotalUnloggedDays` — added in pass 62, uses Set from the start

`countPlanDayCompletions` was the last outlier.

**Fix applied**: Wrap the filter result in a `.map(e => e.calendarDate)` and collect into a `Set`, return `dates.size`.

---

### Non-issues confirmed

| Item | Verdict |
|---|---|
| `clearPlanOutcomes` uses `k.startsWith(planId + '_')` — could match unrelated plans? | Safe. nanoid base-36 has no underscores; `planId_` can never be a prefix of a different `planId_`. |
| `removeRetroJumpForDate` uses `format(new Date(isoString))` — timezone risk? | Acceptable. appliedAt is written as `new Date().toISOString()` on the same device; the local-timezone round-trip is consistent in a single-device PWA. |
| expressionEval: NaN/Infinity propagation | Correctly guarded in `evaluateUpdates`. Division by zero and NaN inputs both handled. |
| run-adaptation engine: logical completeness | All 6 outcome paths correctly branch (hold/progress/regress). Tests cover all branches including the 80-95% default-hold corridor. |
| `parseWorkoutInstanceId` — fragile with underscore-containing planIds? | Correctly handled via regex date-match + `indexOf('_' + date)`, not naive split on `_`. |
| sessionSummary pace derivation: stored 0 treated as bad data? | Correctly handled — stored pace of 0 triggers derivation from distance+duration, same as absent. |

---

### Recommendations for future passes

1. **Progression state UI** — `RunProgressionState.lastResult` and `lastCompletedWorkoutInstanceId` are stored but never surfaced in the history view. A small "Progressed ↑" or "Held →" chip in HistoryPage would make the progression system visible to users.

2. **CalendarPage copy-workout button** — TodayPage has clipboard copy (pass 61). Extending it to the CalendarPage day-detail view would let users share any historical or future workout, not just today's.

3. **Component/integration test layer** — The unit test suite is excellent. The natural next quality frontier is a thin RTL or Playwright smoke-test over the key flows (log workout, skip, day off, undo).
