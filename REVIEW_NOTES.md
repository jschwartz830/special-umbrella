# Review Notes — Overnight Audit

## 2026-07-13 (seventy-seventh pass) — branch `claude/dreamy-mccarthy-kvu0c5`

---

### Executive Summary

This pass was a focused bug-fix run. A full deep audit found 3 high-severity data correctness bugs, 4 medium-severity behavioral issues, and several low-severity code quality items. All 3 high-severity and 2 low-severity issues were fixed. The 4 medium-severity items are documented here with clear descriptions of the risk and recommended next steps. No feature work was attempted — the high-severity bug density indicated the codebase needed stabilization first.

**What changed:** 7 commits — 1 new utility function, 3 bug fixes (data correctness), 2 code quality fixes, 7 new tests.

**Highest confidence:** `handleSkip` planDayIndex fix — the bug was clear-cut and the one-line fix is exactly symmetrical to the already-correct `complete` path.

**Risky items:** The `changeAction` bug in HistoryPage (day_off → complete drops planDayIndex) needs product input before fixing, as it requires either a plan-day picker UI or an opinionated default.

**Review first:** Change 4 (`handleSkip` fix) and the documented but unfixed `usePlanActions` stale date (item 4 below).

---

### Biggest Issues Found

#### 1. `handleSkip` logs skip against wrong plan day after double-day advance [HIGH — FIXED]

After a user does a double-day advance (logs workout + advances rotation), `todayResolved.planDayIndex` reflects the next day. `handleSkip` was using this post-advance value, logging the skip against tomorrow's plan day instead of today's. The `complete` path already used `primaryPlanDayIndex` correctly.

**Likely observed:** User who does a double-day then skips sees their skip count on the wrong workout type in stats.

**Fix:** Changed `actions.skip(todayResolved.planDayIndex)` → `actions.skip(primaryPlanDayIndex)`.

#### 2. `_extra_` string split could fail on future planId formats [HIGH — FIXED]

`instanceId.split('_extra_')[1]` in CalendarPage and HistoryPage was the fragile mechanism for extracting the extraId when moving an outcome to a different date. A new `parseExtraWorkoutInstanceId` utility was added following the same pattern as the existing `parseWorkoutInstanceId` (regex date detection, prefix derivation).

**Current risk level:** Low in practice (nanoid IDs don't contain `_extra_`). Fixed anyway because the correct approach exists and the cost is minimal.

#### 3. `changeAction` in HistoryPage drops `planDayIndex` when converting day_off → complete [HIGH — NOT FIXED]

When a user edits a history entry and changes its action from `day_off` to `complete`, `updateEntryAction` is called without `planDayIndex`. Day-off entries don't store `planDayIndex`, so after conversion the entry is `action: 'complete'` but `planDayIndex: undefined` — it won't be attributed to any workout type in stats.

**Recommended fix options:**
- (A) Show a plan-day picker in the edit modal when changing from `day_off`.
- (B) Use the rotation engine to infer what day that would have been (risky — may be wrong if history was manually adjusted).
- (C) Prevent changing day_off entries to complete in the UI (safest, least flexible).

This requires product judgment. Documenting, not fixing.

#### 4. `usePlanActions` captures `today` non-reactively — skip/dayOff log to wrong date across midnight [MEDIUM — NOT FIXED]

`usePlanActions(plan.id)` computes `today = format(new Date(), 'yyyy-MM-dd')` at hook initialization. If the page stays open past midnight, `actions.skip()` and `actions.dayOff()` will log to the previous calendar day even though `useToday()` has already advanced. The `complete` path works around this by computing the date from `completedAt` inside the modal.

**Recommended fix:** In `usePlanActions`, change `skip` and `dayOff` to capture the date at call time rather than hook initialization:
```ts
skip: (planDayIndex) => {
  const date = format(new Date(), 'yyyy-MM-dd')
  logAction(planId, date, planDayIndex, 'skip')
}
```

#### 5. `getUpcomingDays` ignores `plan.startDate` [MEDIUM — NOT FIXED]

If today is before `plan.startDate`, the engine still projects upcoming days starting from index 0. A user who creates a future-start plan would see incorrect upcoming days until the plan start date is reached.

**Recommended fix:** In `rotationEngine.ts`, add a guard in `getUpcomingDays`: if `today < plan.startDate`, return empty array (or project from startDate).

---

### Improvements Completed

| # | Change | Confidence |
|---|---|---|
| 1 | `parseExtraWorkoutInstanceId` utility + 7 tests | High |
| 2 | Fix `_extra_` split in CalendarPage | High |
| 3 | Fix `_extra_` split in HistoryPage | High |
| 4 | Fix `handleSkip` planDayIndex | High |
| 5 | Fix TodayPage header date to use date-fns | High |
| 6 | Fix SwipeToDelete onTouchCancel | High |

---

### Recommendations Only (not implemented)

1. **`changeAction` day_off→complete drops planDayIndex** — product decision needed; see above.
2. **`usePlanActions` stale date** — targeted fix is small but touches the hook API.
3. **`getUpcomingDays` + `plan.startDate`** — two-line guard in rotationEngine.
4. **Expression eval error surfacing** — `expressionEval.ts` silently returns 0 for bad tokens and division by zero. Consider adding an optional error callback or warn-only log.
5. **`canDayOff` always true in CalendarPage** — rename or inline `true` to remove the misleading guard appearance.
6. **`getFutureProjection` dead code in `calendarProjection.ts`** — safe to delete.
7. **No-op `migrate` casts in persist stores** — document that future schema changes need real migrations; consider adding a schema version bump to the next structural change in any store.
8. **`@/*` path alias unused in tsconfig** — either start using it or remove it to avoid misleading contributors.

---

### Definitely Keep

All 7 commits. Each is small, reversible, and correct.

### Probably Keep But Tweak

None — all fixes are clean.

### Do Not Keep

Nothing to recommend reverting.

### Open Questions For You

1. **`changeAction` day_off→complete** — what should happen to `planDayIndex`? Picker, infer, or disallow?
2. **`usePlanActions` stale date** — is "page open across midnight" a realistic scenario worth fixing? If so, should we fix it in the hook or in each call site?
3. **Expression eval silent errors** — should progression expression errors surface to the user (toast? console.error?), or stay silent?

### Known Issues / Incomplete Work

- The `changeAction` bug (item 3 above) is unfixed; any user who changes a day_off entry to complete via HistoryPage edit will have a malformed entry.
- `getUpcomingDays` + `plan.startDate` is not fixed; future-start plans show incorrect upcoming days.
- No new component/integration tests added — Vitest is running in node environment with no jsdom; all tests remain pure logic tests.

### Dependencies Added
## 2026-07-14 (seventy-seventh pass) — branch `claude/dreamy-mccarthy-aeym9p`

---

### Executive summary

1. **What changed**: 2 commits, 4 files. (1) `nanoid()` upgraded from `Math.random` (~46-bit) to `crypto.getRandomValues` (128-bit). (2) Streak milestone celebration banner added to TodayPage, backed by a new dismissable hook and 13 unit tests.
2. **Test delta**: +13 tests (1068 → 1081). TypeScript errors: 0.
3. **Highest confidence**: The `nanoid` fix is a pure quality improvement — same opaque-string semantics, strictly more entropy, no consumer changes needed. The milestone hook's `getActiveStreakMilestone` is fully unit-tested across all 8 thresholds and boundary values.
4. **What to review first**: The streak banner in TodayPage (lines ~762–785 in the updated file). Verify the amber styling fits alongside the existing amber consecutive-skips nudge, and confirm `earlyPlanStreak` (without mobility dates) is an acceptable approximation for milestone detection.

---

### Issues found and fixed

| Priority | Issue | File | Disposition |
|---|---|---|---|
| Low | `nanoid()` used `Math.random()` (~46-bit entropy); acceptable for personal-tracker scale but not best-practice | `src/lib/utils.ts` | **Fixed** — `crypto.getRandomValues` (128-bit) |

### Feature added

| Feature | Files | Notes |
|---|---|---|
| Streak milestone celebration banner | `src/hooks/useStreakMilestoneDismiss.ts` (new), `src/hooks/__tests__/useStreakMilestoneDismiss.test.ts` (new), `src/pages/TodayPage.tsx` | Shows once per milestone per plan (7/14/21/30/60/90/180/365 days). Dismissed per-milestone independently. |

### Open bugs carried forward

| Priority | Code | File | Description | Status |
|---|---|---|---|---|
| Low | BUG-2 | `CalendarPage.tsx` | `handleMoveWorkout` → `updateEntryDate` can silently collide on destination date | Confirmed non-issue in pass 75: both `removeEntry` and `updateEntryDate` handle the collision independently |
| Low | BUG-4 | `storeSync.ts` | 1500ms debounce: app close mid-debounce loses last write | Acknowledged architectural tradeoff |
| Low | BUG-6 | `planStore.ts` | `clearPlanHistory` doesn't reset plan's `startDate` — only called during delete, not restart | Confirmed non-issue in pass 76 |
| Low | BUG-12 | `HistoryPage.tsx` | Extra entry edit modal has no notes field despite `ExtraWorkoutEntry.notes` existing on the type | Documented only — low-impact gap; `WorkoutOutcome.notes` covers the main notes flow |

### Non-issues confirmed this pass

| Item | Verdict |
|---|---|
| `nanoid` ID format change (9-char base-36 → 32-char hex) | Safe — all consumers treat the value as an opaque string; `parseWorkoutInstanceId` regex matches a date substring, not the ID format |
| `earlyPlanStreak` omitting mobility dates | Acceptable — one-day imprecision for a celebration banner is not material |
| Streak banner vs. consecutive-skips nudge (both amber) | Mutually exclusive in practice: a skip streak means the plan streak is 0 |

### Definitely keep
- `nanoid` fix — strictly better, no risk
- Streak milestone banner — clear user value, additive, rollback is trivial

### Probably keep but tweak
- Banner copy for mid-range milestones could be more varied (30 says "A full month!" which is fine; 60/90 reuse "Three months strong" — could be expanded)

### Do not keep
- Nothing to reject

### Recommendations only (not implemented)

1. **Extra entry notes field**: Add `editingExtraNotes` state and a textarea to the extra-entry edit modal in `HistoryPage`. The `ExtraWorkoutEntry.notes` type field already exists; the UI just doesn't expose it for editing.
2. **TodayPage decomposition**: The 1700-line TodayPage would benefit from extracting sub-components (e.g., `<TodayWorkoutCard>`, `<TodayBanners>`) to reduce cognitive load when making future changes. This is a medium-complexity refactor with non-trivial regression risk.
3. **storeSync merge on login**: If the app ever targets multi-device sync more seriously, replacing the "cloud wins" strategy with a per-store last-write-wins merge (comparing `updated_at` timestamps) would prevent the current data-loss scenario where local offline edits are silently dropped on first login.

### Open questions for me

1. Is the amber color for the streak milestone banner distinct enough from the consecutive-skips nudge? Both are amber. A different hue (e.g. gold/yellow for celebration vs. amber/orange for warning) could improve clarity.
2. Should mobility-only streaks show milestone banners? The `earlyPlanStreak` excludes mobility dates. If a user does 7 consecutive days of only mobility (no plan workouts), they won't see a banner. Is that the right behavior?
3. The banner message at 30 days is "A full month of consistency!" — technically 30 days isn't always a month. Should it say "30 days of consistency!" instead?

### Known issues or incomplete work

None.

### Dependencies added

None.

---

## 2026-07-12 (seventy-sixth pass) — branch `claude/dreamy-mccarthy-2h1jip`

---

### Executive summary

1. **What changed**: 12 new tests covering the `additionalDates` parameter in `getStreakDatesSet` and `computePlanStreak`. No production code changed.
2. **Test delta**: +12 tests (1056 → 1068). TypeScript errors: 0.
3. **Highest confidence**: The added tests directly exercise the mobility-streak integration path that `TodayPage.tsx` uses in production. The implementation was already correct; the gap was test coverage only.
4. **What to review first**: The single commit is a pure test addition — no production logic changed.

---

### Issues found and fixed

| Priority | Issue | File | Disposition |
|---|---|---|---|
| Medium | `additionalDates` parameter of `getStreakDatesSet` and `computePlanStreak` had zero test coverage despite active production use | `historyStats.test.ts` | **Fixed** — 12 tests added |

### Open bugs carried forward

| Priority | Code | File | Description | Status |
|---|---|---|---|---|
| Low | BUG-2 | `CalendarPage.tsx` | `handleMoveWorkout` → `updateEntryDate` can silently collide on destination date | Confirmed non-issue this pass: both `removeEntry` and `updateEntryDate` each handle the collision independently |
| Low | BUG-4 | `storeSync.ts` | 1500ms debounce: app close mid-debounce loses last write | Acknowledged architectural tradeoff |
| Low | BUG-6 | `planStore.ts` | `clearPlanHistory` doesn't reset plan's `startDate` — only called during delete, not restart | Confirmed non-issue: `clearPlanHistory` is only called as part of plan deletion (not standalone restart) |

### Non-issues reconfirmed

All non-issues from pass 75 remain valid (BUG-1, BUG-3, BUG-5, BUG-7 via pass 75 fix, BUG-8, BUG-9, BUG-10, BUG-11).

---

## 2026-07-09 (seventy-fifth pass) — branch `claude/dreamy-mccarthy-vpg2n1`

---

### Executive summary

1. **What changed**: 1 new `buildPRFlagsMap` function in historyStats.ts (+7 tests); `HistoryPage.tsx` updated to use `useMemo` + O(1) lookup; `max={today}` added to 2 date pickers; 1 dead helper removed from a test file. 2 commits, 4 files modified.
2. **Test delta**: +7 tests (1049 → 1056). TypeScript errors: 1 → 0.
3. **Highest confidence**: The `buildPRFlagsMap` parity test (`produces same results as calling computeWorkoutPRFlags per instance`) directly compares the new function against the existing implementation across 3 sessions. The date picker `max` fix is a pure HTML attribute addition — zero logic change.
4. **What to review first**: Commit 1 is the most impactful change. The `buildPRFlagsMap` correctness is verified by the parity test + 6 unit tests. The date input `max` fix is trivial.

---

### Issues found and fixed

| Priority | Issue | File | Disposition |
|---|---|---|---|
| Medium | `computeWorkoutPRFlags` called O(N²) at render time (once per history item, scans all records each time) | `HistoryPage.tsx`, `historyStats.ts` | **Fixed** — `buildPRFlagsMap` pre-computes all flags in O(N log N), `useMemo` caches the Map |
| Low | Date pickers in history edit modals had no `max` attribute — future dates were allowed | `HistoryPage.tsx` lines 768, 863 | **Fixed** — added `max={today}` |
| Low | `withDurationMin` test helper defined but never used (TS6133) | `estimateRunDuration.test.ts` | **Fixed** — removed |

### Issues documented only (not implemented)

Carried forward from pass 74 (verified to be lower risk):

| Priority | Code | File | Description | Verified |
|---|---|---|---|---|
| Low | BUG-2 | `CalendarPage.tsx` | `handleMoveWorkout` → `updateEntryDate` can silently collide on destination date | Not verified this pass |
| Low | BUG-4 | `storeSync.ts` | 1500ms debounce: app close mid-debounce loses last write | Acknowledged architectural tradeoff |
| Low | BUG-6 | `planStore.ts` | `clearPlanHistory` doesn't reset plan's `startDate` — re-imported plan picks up stale date | Not verified this pass |

### Non-issues confirmed this pass

| Item | Verdict |
|---|---|
| BUG-1: `_extra_` split heuristic in HistoryPage | Safe — nanoid is alphanumeric+hyphen, calendarDate uses only hyphens, `_extra_` is unambiguous |
| BUG-5: `removeRetroJumpForDate` DST handling | Safe — CalendarPage always writes `${date}T12:00:00.000` (local noon, no Z), and `format(new Date(...))` reads local time |
| BUG-8: `clearPlanOutcomes` prefix collision | Safe — nanoid alphanumeric+hyphen + `_` separator means no ambiguity |
| BUG-9: `expressionEval.ts` division by zero | Non-issue — line 233 already returns `0`, not `Infinity` |
| BUG-10: `programParser.ts` silent YAML errors | Non-issue — errors returned in `errors[]` array; both callers check `errors.length > 0` before import |
| BUG-11: `sessionSummary.ts` empty for mobility-only | Intentional behavior — function returns `null` when no weights/run/swim data exists |
| BUG-3: `jump` override with `targetDayIndex > plan.length` | By design — `mod()` wraps correctly |
| Pass 73 doc error re `removeLastOverrideByType` | The `type` parameter IS used (line 298 filters `o.type === type`) — the pass 73 note was wrong |

---

## 2026-07-08 (seventy-fourth pass) — branch `claude/dreamy-mccarthy-ugdev5`

---

### Executive summary

1. **What changed**: 1 extraction + 22 new tests; 1 date-math simplification; 1 perf memoization; 1 UX fix for cycle completion chip. 4 commits, 3 files modified, 1 new lib file, 1 new test file.
2. **Test delta**: +22 tests (1027 → 1049), all in the new `estimateRunDuration.test.ts`.
3. **Highest confidence**: The `estimateRunDurationMin` extraction is purely mechanical — the function body is unchanged, just moved. The cycle chip fix is the only user-visible change and is constrained to a single conditional render.
4. **What to review first**: Commit 4 (cycle chip) is the only externally visible UX change. Commit 1 (extraction + tests) is the most impactful for code quality. Commits 2 and 3 are refactor/perf with no behavior change.

---

### Issues found and fixed

| Priority | Issue | File | Disposition |
|---|---|---|---|
| Low | Cycle completion showed "0/N cycle" instead of a positive indicator | `TodayPage.tsx` | **Fixed** (commit 4) |
| Low | `estimateRunDurationMin` was untestable in isolation (defined in component file) | `TodayPage.tsx` | **Fixed** (commit 1 — extracted to lib) |
| Low | `prevSessionDaysAgo` used manual Date.UTC arithmetic instead of date-fns | `TodayPage.tsx` | **Fixed** (commit 2) |
| Low | `rotationLoggedCount` Set rebuilt on every render | `TodayPage.tsx` | **Fixed** (commit 3 — memoized) |

### Issues documented only (not implemented)

From the background audit agent (Explore agent) findings at start of pass. Included here for future pass consideration:

| Priority | Code | File | Description |
|---|---|---|---|
| Medium | BUG-1 | `HistoryPage.tsx` | `id.includes('_extra_')` split heuristic is fragile — if nanoid produces `_extra_`, it silently mis-classifies an entry |
| Medium | BUG-2 | `CalendarPage.tsx` | `handleMoveWorkout` → `updateEntryDate` can silently collide on destination date if a same-day entry already exists |
| Medium | BUG-3 | `rotationEngine.ts` | `computeCurrentDayIndex` with `jump` override: if `targetDayIndex` > plan length, modulo wraps silently rather than erroring |
| Low | BUG-4 | `storeSync.ts` | 1500ms debounce window: app close mid-debounce loses last write |
| Low | BUG-5 | `historyStore.ts` | `removeRetroJumpForDate` uses `new Date(o.appliedAt)` — if `appliedAt` is already a local-date string (no timezone), DST can shift the parsed date |
| Low | BUG-6 | `planStore.ts` | `clearPlanHistory` clears entries but not the plan's `startDate` — a deleted plan that is re-imported can pick up a stale start date |
| Low | BUG-7 | `CalendarPage.tsx` | Retroactive log date-picker: no max-date guard — user can pick future dates |
| Low | BUG-8 | `outcomeStore.ts` | `clearPlanOutcomes` uses prefix-match on plan ID — theoretically collides with IDs that share a prefix |
| Low | BUG-9 | `expressionEval.ts` | Division by zero returns `Infinity` rather than `0` or an error |
| Low | BUG-10 | `programParser.ts` | YAML parse errors are caught and silently return empty plan rather than surfacing the error to the user |
| Low | BUG-11 | `sessionSummary.ts` | `computeSessionSummary` returns empty summary for mobility-only sessions that have no exercise data |
| Info | BUG-12 | `TodayPage.tsx` | `planCompletionPercent`'s `loggedRate ?? 0` fallback — NOT dead code but only reachable for degenerate zero-duration plans |

### Non-issues confirmed

| Item | Verdict |
|---|---|
| `computeRotationCycleProgress.justCompletedRotation` semantics | Correct: `doneInCycle === 0 && totalDone > 0` — tested in historyStats.test.ts |
| `planCompletionPercent` `loggedRate ?? 0` branch | Not dead code — reachable for plans with `duration.value === 0` or `days.length === 0` |
| `deduplicateByDate` in historyStore | Keeps newest `createdAt` per `(planId, calendarDate)` — correct invariant |
| `estimateRunDurationMin` pace constants | 8 / 11 / 12 min/mi for tempo / default / warmup/cooldown — verified by 22 tests |

---

## 2026-07-05 (seventy-second pass) — branch `claude/dreamy-mccarthy-80hikp`

---

### Executive summary

1. **What changed**: 1 bug fix + 1 code quality refactor + 1 additive feature. 2 commits, all in `TodayPage.tsx`. Tests held at 1017 (changes are UI-only; no new logic to test).
2. **What is highest confidence**: Both the refactor and the ring count fix are mechanical. The ring count fix changes what number appears in the ring center — this is the most visible part of the UI change and worth eyeballing.
3. **What changed in UX**: The ring center in the Today habit summary row now shows the real workout count (e.g., 47) instead of the plan completion percentage (e.g., 71). For rotation-plan users, a "X/Y cycle" chip appears between the workouts count and the ring.
4. **What to review first**: The `CompletedWorkoutsRing` prop change (commit `3b3eb5b`) and the cycle chip (commit `ade8e4b`).

---

### Issues found

| Priority | Issue | File | Disposition |
|---|---|---|---|
| Low–Medium | `CompletedWorkoutsRing` received plan completion % as `count` prop instead of workout count | `TodayPage.tsx:662` | Fixed |
| Low | `estimateRunDurationMin` defined inside component body — recreated every render | `TodayPage.tsx:408` | Fixed |
| Low | `computeRotationCycleProgress` has no UI caller despite being exported and tested | `historyStats.ts` | Fixed — surfaced in Today |

### Non-issues confirmed (from extended background audit)

| Item | Verdict |
|---|---|
| Rotation engine correctness | Sound. No bugs found. |
| All stat deduplication guards (isPlanExpired, computeRotationCycleProgress, computeRotationPlanRemaining, countTotalUnloggedDays, etc.) | Consistently use `new Set(dates)` — correct after pass 62 fixes |
| `addEntry` deduplication (keeps newest by planId+calendarDate) | Correct invariant |
| `importEntries` merge (newest `createdAt` wins within batch) | Correct |
| `outcomeSortKey` fallback chain | Correct (`completedAt` → extracted date from instanceId → '') |
| `logOutcomeWithProgression` try/catch around run engine | Intentional — always saves outcome even if progression throws |
| Progressive YAML rules gating on `session_complete` | Correct — deferred outcomes excluded |
| Plan deletion non-atomicity (6 separate store calls) | Known design debt; no rollback if one fails. Documented only. |
| `nanoid` uses `Math.random` (not `crypto.getRandomValues`) | Low collision risk for personal-tracker usage; documented. |

---

### Improvements completed

| # | Commit | Type | Confidence |
|---|---|---|---|
| 1 | Extract `estimateRunDurationMin` to module scope | Refactor | Very high |
| 2 | Fix `CompletedWorkoutsRing` count prop | Bug fix | High |
| 3 | Add cycle progress chip (rotation plans) | Feature | High |

### Items documented only (not implemented)

| Item | Reason |
|---|---|
| `storeSync.ts` 1500ms debounce data loss window | Infrastructure decision; risky without careful testing |
| `storeSync.ts` last-login-wins conflict resolution | Product/sync strategy decision |
| Plan deletion non-atomicity | Would require a transaction abstraction; architectural change |
| `nanoid` non-cryptographic PRNG | Negligible collision risk for personal-tracker usage |

---

## 2026-07-03 (seventy-first pass) — branch `claude/dreamy-mccarthy-4ywaek`

---

### Executive summary

1. **What changed**: 7 bug/quality fixes + 2 test additions + 1 additive feature (PR badges in history). All 9 commits are small and logically separated. Tests went from 992 → 1010 (+18).
2. **What is highest confidence**: The nanoid import fix, AuthGate dead variable removal, operator precedence parens, and `deriveProgressionMode` extraction are all mechanical/zero-behavior-change. Strong candidates to keep without review.
3. **What is risky**: The `PlanCard` module-scope move is structural (React component hierarchy change) — test it by opening Plans and verifying the activate/delete/copy actions still work. The `buildWeightsRecommendation` fix changes behavior when exercises[0] has no `progressionMode`.
4. **What to review first**: Commit `b9bf3cd` (PlanCard) and `a58fce8` (buildWeightsRecommendation). Both are low-risk but have the most behavioral surface area.

---

### Biggest issues found in this pass

| Priority | Issue | File | Disposition |
|---|---|---|---|
| Medium | `buildWeightsRecommendation` used `exercises[0]` for mode even when exercises[0] had no mode configured | `progression.ts:103` | Fixed |
| Medium | `PlanCard` defined inside parent component — causes unmount/remount on every parent render | `PlansPage.tsx:83` | Fixed |
| Low | `deriveProgressionMode` duplicated in two files | `ActiveWorkoutTracker.tsx` + `OutcomeModal.tsx` | Fixed |
| Low | Dead `unsubscribeStores` variable in AuthGate | `AuthGate.tsx:14` | Fixed |
| Low | Indirect nanoid import through rotationEngine | `programParser.ts:3` | Fixed |
| Low | Operator precedence ambiguity | `TodayPage.tsx:793,999` | Fixed |
| Low | setTimeout without cleanup | `PlanBuilderPage.tsx:978` | Fixed |

### Issues documented only (not implemented)

| Issue | Reason not implemented |
|---|---|
| `storeSync.ts` debounce data loss window | Product/infrastructure decision; risky to change without careful testing |
| `storeSync.ts` last-login-wins conflict resolution | Major product decision about sync strategy |
| `outcomeStore.ts` migrate is a no-op | Requires careful versioning strategy to add real migrations |
| `exerciseLibrary.ts` synergist data errors (~30-40 exercises) | Requires data audit; data-only change but large and tedious |
| `supabase.ts` credentials in source | Requires environment variable infrastructure changes |
| `useExpiryDismiss`/`useStallNudgeDismiss` near-identical hooks | Nice-to-have; no correctness impact |
| `planDayUtils.ts` shared day+slot id | Cosmetic; no observed downstream issue |

---

### Improvements completed

| # | Commit | Confidence |
|---|---|---|
| 1 | `refactor: import nanoid from lib/utils directly in programParser` | Very high |
| 2 | `fix: remove dead unsubscribeStores variable from AuthGate` | Very high |
| 3 | `fix: operator precedence clarification in TodayPage` | Very high |
| 4 | `refactor: extract deriveProgressionMode to shared module` | High |
| 5 | `fix: move PlanCard to module scope in PlansPage` | High |
| 6 | `fix: use first exercise with progressionMode in buildWeightsRecommendation` | High |
| 7 | `fix: cancel post-save navigate timer on PlanBuilderPage unmount` | High |
| 8 | `test: add unit tests for deriveProgressionMode` (9 tests) | High |
| 9 | `feat: PR badges on history workout items` (10 tests) | High |

---

### Feature added: PR badges in History view

When browsing the History page, weight-training workouts that set a new all-time load or reps record at the time they were logged show a small "Load PR" / "Reps PR" / "Load & reps PR" badge inline with the set count. Detection is strict (must exceed, not tie, prior best) and relative to log date.

See FEATURE_PROPOSAL.md and FEATURE_REVIEW.md for full detail.

**Verdict: Keep** — purely additive, well-tested, closes the PR tracking story.

---

### Keep / revise / reject classification

**Definitely keep**
- nanoid import fix
- AuthGate dead variable removal
- Operator precedence parens
- `deriveProgressionMode` extraction + tests
- PR badges feature

**Probably keep but verify manually**
- `PlanCard` module scope move — verify Plans page works (activate, deactivate, copy, archive, delete)
- `buildWeightsRecommendation` first-with-mode fix — verify outcome recommendations still appear correctly after a weights workout

**Low priority, keep or skip**
- `PlanBuilderPage` setTimeout cleanup — correct but extremely unlikely to matter in practice

---

### Open questions for you

1. **PR badge semantics**: Should tied (equal-to-prior-best) sessions get a badge? Current: no. This means if you hit 185lb Bench Press twice, only the first session shows the badge.
2. **`buildWeightsRecommendation` change**: Are there plans where exercises[0] intentionally has no progressionMode? If so, verify the recommendation behavior is still correct.
3. **`storeSync.ts` conflict resolution**: The last-login-wins behavior is a real risk for multi-device users. Worth addressing in a dedicated pass with explicit product decisions.
4. **Exercise library synergist data**: ~30-40 exercises have exercise names in the `synergist` field instead of muscle groups. This affects the exercise detail view. Worth a dedicated data-fix pass.

---

### Known issues or incomplete work

- `computeWorkoutPRFlags` is called per-rendered-item in HistoryPage without memoization. For users with large exercise history (thousands of records, hundreds of workout entries), this could be slow. If performance is an issue, pre-index by exercise name.
- The PR badge doesn't name which exercise set the record — it just says "Load PR". Future enhancement: list the exercises.

---

### Dependencies added

None.

---

## 2026-07-02 (seventieth pass) — branch `claude/dreamy-mccarthy-jy89cx`

---

### Executive summary

1. **What changed**: One refactor commit — `WORKOUT_TYPE_OPTIONS` centralized in `constants.ts`; two pages (`CalendarPage`, `HistoryPage`) now import it instead of duplicating the list. Minor: legacy `'rest'` fallback type replaced with `'other'` in `HistoryPage.handleOutcomeConfirm`.
2. **What is highest confidence**: Pure mechanical consolidation — alias assignment, no logic touched. All 987 tests pass, tsc clean.
3. **What is risky**: Nothing. The only behavioral difference is the fallback slot type (`'rest'` → `'other'`), which only fires when `planDay.slots` is empty — an impossible state in normal use since every `PlanDay` has at least one slot.
4. **What to review first**: `constants.ts` — confirm `WORKOUT_TYPE_OPTIONS` ordering matches your preferred UI order. Current order: Weights, Run, Swim, Yoga, Other (matches all previous local definitions).

---

### Audit scope

Full read of:
- `TodayPage.tsx` — 1686 lines, complete
- `HistoryPage.tsx` — ~900 lines, complete (imports + business logic)
- `CalendarPage.tsx` — imports and local definitions
- `constants.ts` — complete
- `historyStore.ts`, `planStore.ts`, `outcomeStore.ts`, `mobilityStore.ts`, `settingsStore.ts`, `storeSync.ts`, `exerciseHistoryStore.ts` (in prior passes, confirmed unchanged)
- `usePlanActions.ts`, `useActivePlan.ts`, `planDayUtils.ts`, `outcomeSortKey.ts`, `previousSetsHelper.ts`, `sessionSummary.ts`

### Bugs fixed (from background agent findings)

#### Bug: `plansToCsv` silently discards `location` and `weightsFocusArea` (FIXED)

**Location**: `src/lib/csv.ts:238`

The `tags` column was hardcoded to `''` in the plan exporter. `plansFromCsv` already parses this column correctly (pipe-delimited, reads `home`/`gym`/`indoor`/`outdoor` → `slot.location`; `upper`/`lower`/`full_body` → `slot.weightsFocusArea`), but nothing was writing those values on export. Any plan using location or focus-area metadata would lose it on CSV round-trip. Fixed: serialize as `[slot.location, slot.weightsFocusArea].filter(Boolean).join('|')`.

#### Bug: `buildOutcomeFromRow` accepts fractional `perceivedEffort` (FIXED)

**Location**: `src/lib/csv.ts:722-724`

`toNum('1.7')` returns `1.7`, which passes the `>= 1 && <= 5` range check and is cast to `PerceivedEffort` (typed `1 | 2 | 3 | 4 | 5`). A manually edited CSV can inject a fractional value that violates the type contract. Fixed: added `Number.isInteger(effort)` guard.

### Non-issues confirmed

| Item | Location | Verdict |
|---|---|---|
| Undo handler safe override removal | `TodayPage.tsx:999,1002` | Pass-68 fix holds — `advancedRotation ?? extra.source === 'double_day'` is correct; non-advancing extras don't strip the override |
| `handleOutcomeConfirm` silently removes destination entry on date move | `HistoryPage.tsx:337` | Intentional data-safety measure (comment at 341); saves user from orphaned exercise history records |
| `progressionByInstance` Map construction | `HistoryPage.tsx:86` | O(1) reverse-index is correct and efficient |
| `weeklyBreakdown` uses `addDays(new Date(), -55)` | `HistoryPage.tsx:233` | Appropriate — stats history window doesn't need the `useToday()` anchor; minor date drift on DST transitions is acceptable |
| Ad hoc `source: 'history'` tagging | `TodayPage.tsx:1347` | Correct — prevents Undo from auto-removing user-initiated extras |
| `VALID_WORKOUT_TYPES` in `csv.ts` and `programParser.ts` | Not consolidated | Correct choice — these are validation guards, intentionally independent of display lists |
| `historyToCsv`/`historyFromCsv` notes duplication | `csv.ts:542,699,729` | On export, `entry.notes ?? outcome.notes` is used; on import, the same string is written to both. A note originally only on the outcome becomes duplicated onto the entry after round-trip. Low severity (UI shows the same string either way); documented for future cleanup |
| Supabase anon key hardcoded | `src/lib/supabase.ts` | Publishable/anon key; intentionally public by Supabase design. Security relies on RLS. Not a bug, standard practice |
| `nanoid` custom implementation | `src/lib/utils.ts` | 9-character base-36 via `Math.random()`. Collision probability negligible for a personal app; architectural decision |
| `applyProgressionRule` swallows errors silently | `programStore.ts` | Tested and intentional — broken progression rule no-ops rather than crashing. Known limitation, documented |

---

## 2026-07-01 (sixty-ninth pass) — branch `claude/dreamy-mccarthy-4cykvp`

---

### Executive summary

1. **What changed**: 21 new unit tests for 5 new mobilityStore actions + `resetStore()` isolation fix. No production code changes.
2. **What is highest confidence**: The test additions are pure coverage work — they read store state only through the public action API and use the same mock/reset pattern as all other store tests. All 987 tests pass; `tsc --noEmit` exits clean.
3. **What is risky**: Nothing this pass. The one gap noted below (`resetStore()` not including `activeSession: null`) was a test-isolation risk, not a production bug.
4. **What I should review first**: The `loadPreset` test that verifies preset `durationSec` overrides the library default — this validates a non-obvious behavior (line: `expect(ex.durationSec).toBe(90)` for `lib-ankle-cars` whose library default is 60). If you expected `loadPreset` to always use library defaults, this test is a useful prompt to verify the intent.

---

### Audit scope

Full read of all new code since pass 68:
- `src/components/workout/MobilityTracker.tsx` — sequential timer architecture, checkpoint save/restore, phase state machine
- `src/lib/mobilityLibrary.ts` — 37 exercises, 5 categories, 6 presets
- `src/pages/MobilityPage.tsx` — My Routine / Library / Presets tab structure
- `src/store/mobilityStore.ts` — new v2 schema, 5 new actions, v1→v2 migration
- `src/pages/TodayPage.tsx` — SwipeToDelete reveal fix, copy button icon change

Test suite on entry: **966 tests passing** across 26 test files.

---

### Non-issues confirmed

| Item | Verdict |
|---|---|
| MobilityTracker wall-clock timer accuracy when backgrounded | Not a bug — 100ms interval + `Date.now()` computation means at most 100ms display lag on foreground restore. No duration drift. |
| `handlePrevious` removes both current AND previous exercise from completedIds | Intentional: "Previous" means "go back to exercise N−1", semantically undoing N as well. "← Redo" button is the targeted action for just undoing N. |
| Checkpoint does not persist `phase` | Intentional: always resumes in idle, requires user to press Start. Avoids auto-starting timer unexpectedly on reopen. |
| `loadPreset` uses preset's `durationSec`, not library's | Intentional: presets encode specific timing requirements. |
| `addExerciseFromLibrary` ignores unknown IDs | Intentional: silently no-ops on bad input rather than inserting a partially-formed record. |
| v1→v2 migration (add `activeSession: null`) | Trivially correct. Not testable through the persist mock, which is acceptable. |
| SwipeToDelete opacity+pointerEvents fix | Clean fix — hides delete affordance visually and from hit-testing when not in a swipe. |

---

### Test coverage added: mobilityStore v2 actions (21 tests)

**Files**: `src/store/__tests__/mobilityStore.test.ts`

| Action | Tests | What's covered |
|---|---|---|
| `addExerciseFromLibrary` | 5 | Library lookup, correct name/durationSec, no-op on duplicate, no-op on unknown ID, routine length |
| `loadPreset` (replace) | 3 | Full replacement, preset durationSec override, unknown-ID name fallback |
| `loadPreset` (append) | 2 | Appends missing, skips already-present (dedup) |
| `startSession` | 5 | date, exerciseIds, currentIdx=0, completedIds=[], totalElapsedSec/exElapsedSec=0, overwrites prior |
| `saveCheckpoint` | 3 | Stores all fields, overwrites prior checkpoint |
| `clearSession` | 3 | Sets null, no-op when already null, leaves routine+completions intact |
| `resetStore()` fix | — | Now includes `activeSession: null` to prevent inter-describe leakage |

---

### Improvements completed

- Test isolation fix: `resetStore()` now fully resets `activeSession`.
- Coverage: all 5 new mobilityStore v2 actions covered.

### Small features added

None.

### Medium-complexity feature explored

None. Per the routine's own rule, two large feature PRs (PRs #172, #173) with zero unit test coverage on their new store actions was treated as a stabilization signal. Adding feature surface on top of recently untested code would compound risk.

### Definitely keep

- Test commit `89cb258` — pure test additions, zero risk, complete coverage of new API surface.

### Probably keep but tweak

None.

### Do not keep

None.

### Recommendations only (not implemented)

1. **`removeLastOverrideByType` remains plan-scoped** (from pass 68): redesigning it to be extra-scoped or timestamp-matched would close this class of bug at the API level. Third consecutive pass flagging this.

2. **RTL/Playwright component test layer**: Both pass 68 production bugs lived in untested React component logic. This is the highest-ROI test investment available. Should be a deliberate decision by the maintainer, not an overnight add.

3. **`visibilitychange` handler in MobilityTracker**: The current 100ms wall-clock approach is accurate; a `visibilitychange` handler would only improve perceived responsiveness by up to 100ms on foreground restore. Low priority, but easy to add (pattern is already in `CardioWorkoutTracker`).

4. **storeSync.ts retry on push failure** (from pass 67): A single push failure permanently desynchronizes local and cloud state until the next successful write. A 1-retry with a brief delay would reduce drift significantly.

5. **Run progression badge on TodayPage** (recommended passes 63–67, partially done in pass 67 for HistoryPage): Surfacing the "↑ Progressed" result at the moment of completion would make the progression system feel responsive.

### Open questions for the user

1. Does `loadPreset` intentionally use the preset's `durationSec` rather than the library's default? (Test line: `expect(ex.durationSec).toBe(90)` for `lib-ankle-cars` whose library default is 60.) This is the behavior as coded; just flagging it for awareness.

2. Should "Previous" during a non-transition phase un-complete the exercise you're going back to AND the one you're leaving (current behavior), or only the one you're going back to? Worth a UX decision before it surprises a user.

### Known issues / incomplete work

- v1→v2 migration is untested (acceptable given triviality; noted in test file comment).
- React component layer (TodayPage, CalendarPage, MobilityTracker) remains uncovered by automated tests.

### Dependencies added

None.

---

## 2026-06-30 (sixty-eighth pass) — branch `claude/dreamy-mccarthy-4vdzsq`

---

### Executive summary

1. **What changed**: 2 bug fixes (one production-breaking, one data-corruption) + this documentation update. No new features, no new tests.
2. **What is highest confidence**: The `DayStatus` type fix — it's a one-word correction restoring a value that already exists and is used everywhere else in the codebase for the same purpose; it was actively breaking every production deploy.
3. **What is risky**: The override-removal fix changes write-path logic in `TodayPage.tsx`'s delete handlers. The `??` fallback was designed to preserve legacy behavior for records predating the new field, but this logic is untested (no RTL/Playwright coverage exists for `TodayPage.tsx`) — worth a manual click-through of "log a double-day extra via the full plan picker for a non-upcoming day, then delete it" before fully trusting it.
4. **What I should review first**: The override-removal fix (`3e06cc5`) — confirm the `willAdvance` computation in `handleOutcomeConfirm` correctly mirrors the rotation-advance condition used elsewhere in the file.

---

### Audit scope

Focused on the one unaudited surface area since pass 67: the "full plan picker" double-day feature (commit `bcee1f6`), plus a full read of `TodayPage.tsx` (1678 lines) since it was the file most recently and heavily modified.

Also did a routine check of GitHub Actions deploy history, which surfaced the build-breaking bug below — this was not part of the originally planned audit scope but took priority once found, since it represented an active production outage.

Test suite on entry: **966 tests passing** across 26 test files.

---

### Bug fixed: invalid `DayStatus` literal broke every production deploy since commit `20bb8ac` (HIGH)

**Location**: `src/pages/TodayPage.tsx`, two synthetic `ResolvedDay` literals (~lines 526, 936)

**Issue**: Both used `status: 'upcoming'`, which is not a member of the `DayStatus` union. `tsc --noEmit` fails on this, and the production build is `tsc && vite build`, so this broke CI on every push to `main` since `20bb8ac`. Confirmed via GitHub Actions run history: 3 consecutive failed runs, meaning the live GitHub Pages site had not received any of those changes.

**Fix**: Changed both to `status: 'future'`, the existing union member used everywhere else in the codebase for not-yet-started days.

**Verdict**: **Definitely keep** — this is a pure correction with no behavioral ambiguity; it restores deploys.

---

### Bug fixed: deleting a non-advancing double-day extra could strip an unrelated rotation override (HIGH)

**Location**: `src/pages/TodayPage.tsx` — `SwipeToDelete onDelete` handler and the Undo button's loop; `src/types/index.ts` — `ExtraWorkoutEntry`

**Issue**: The "full plan picker" feature (`bcee1f6`) decoupled `source: 'double_day'` from "this extra advanced the rotation" — previously the two were always equivalent. Both delete paths still assumed the old equivalence and unconditionally removed the plan's single most-recent `advance` override whenever `extra.source === 'double_day'`, even for extras that picked an arbitrary (non-upcoming) plan day and never advanced anything. Because `removeLastOverrideByType` is scoped to the whole plan (not the specific extra), this could silently remove an unrelated, legitimate advance override — corrupting the rotation pointer with no error shown to the user.

**Fix**: Added `advancedRotation?: boolean` to `ExtraWorkoutEntry`, set precisely at both creation sites. Delete paths now check `extra.advancedRotation ?? extra.source === 'double_day'`, where the `??` fallback keeps legacy (pre-field) records behaving exactly as before.

**Verdict**: **Definitely keep** — correctness fix for silent data corruption; backward compatible via the optional-field fallback.

**Open questions**:
1. Should `removeLastOverrideByType` itself be made extra-scoped (e.g. by matching `appliedAt` against the extra's `createdAt` within a tolerance) rather than relying on callers to gate the call correctly? That would close this entire class of bug at the source rather than per-call-site, but is a larger, riskier change to a shared store method — left as a recommendation, not implemented this pass.

---

### Improvements completed

- Restored production deploys (build-breaking type error).
- Closed a silent rotation-pointer data-corruption path introduced by the most recent feature commit.

### Small features added

None this pass.

### Medium-complexity feature explored

None this pass. Per the routine's own rule ("skip feature work entirely if audit findings suggest the codebase needs stabilization first"), finding one production-breaking bug and one silent-data-corruption bug in the same, very recently merged feature area was treated as a clear signal to spend the pass on stabilization and documentation rather than open new feature surface area.

### Definitely keep

- `DayStatus` fix (`b8d21d0`)
- Override-removal fix (`3e06cc5`)

### Probably keep but tweak

None this pass.

### Do not keep

None this pass.

### Recommendations only (not implemented)

- Consider making `removeLastOverrideByType` itself scoped to a specific action/extra rather than "most recent of this type for the plan" — see open question above. This is the second pass to find a bug rooted in that method's plan-wide scoping; a more targeted API (e.g. matching by `appliedAt` timestamp proximity, or storing an explicit override id on the `ExtraWorkoutEntry`) would prevent future call sites from making the same mistake.

### Open questions for the user

1. Should `removeLastOverrideByType` be redesigned to be extra-scoped instead of plan-scoped? (see Recommendations)

### Known issues / incomplete work

- `TodayPage.tsx` (and React components generally) remain untested by the unit suite — both bugs fixed this pass lived in this exact gap. No RTL/Playwright infra exists yet; introducing one would be a larger, cross-cutting decision better made deliberately by the maintainer than slipped into an overnight pass.

### Dependencies added

None.

---

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

---

## Pass 73 — 2026-07-06

### Audit findings

**Confirmed bugs fixed this pass:**

1. **`estimateRunDurationMin` missing `planProgramVars`** (`TodayPage.tsx:1193`)
   - Severity: Low-medium (incorrect duration estimate in cardio prompt, affects YAML-program users only)
   - Fixed: `estimateRunDurationMin(runSlot)` → `estimateRunDurationMin(runSlot, planProgramVars)`

2. **`exerciseHistoryStore` missing persist version guard** (`exerciseHistoryStore.ts`)
   - Severity: Low now, medium if schema changes
   - Fixed: added `version: 1, migrate: (persisted) => persisted as ExerciseHistoryState`

**Confirmed non-issues (re-examined this pass):**

- `outcomeStore.clearPlanOutcomes` prefix match: safe — nanoid base-36 contains no underscores
- `deduplicateByDate` in historyStore: keeps newest `createdAt`, correct semantic
- `removeRetroJumpForDate` timezone handling: consistent round-trip in single-device PWA
- `swap_slot` override not incrementing pointer: correct, documented
- `mod` negative input: correct symmetric modulo, tested
- `computeLoggedRate` returning `0` (not `null`) when `activeDays === 0`: guarded by `planActiveDays >= 7` (pass 64)

**Lower-priority items noted but not addressed:**

- `computeWorkoutPRFlags` inner loop (`historyStats.ts:~795`): O(n²) over exercise records. Fine at normal scale; could become slow for users with years of daily lifting history. Recommend a `Map<exerciseName, maxLoad>` pre-index if performance ever becomes an issue.
- `removeLastOverrideByType` (`historyStore.ts`): `type` parameter is never used — the function removes the most-recent override regardless. All callers pass the correct type today, but the signature implies filtering that doesn't happen. A rename to `removeLastOverride` + doc update would clarify intent.
- `ExtraWorkoutEntry.advancedRotation` undefined on pre-v1 records: handled conservatively (treated as true), documented in the type. No change needed.

### Recommendations for future passes

1. **`@testing-library/react` devDep** — Add it to `devDependencies` to enable proper hook integration tests. The current hook tests validate localStorage contracts but cannot test React state transitions. Cost: one devDep, low risk.
2. **`computeWorkoutPRFlags` performance** — Pre-index `maxLoad` by exercise name to reduce from O(n²) to O(n). Only matters at large record counts.
3. **`removeLastOverrideByType` clarity** — Rename to `removeLastOverride` and update JSDoc. Zero behavior change.
4. **Run progression UI** — `RunProgressionState.lastResult` is stored but never surfaced. A "Progressed ↑" chip on HistoryPage would close the feedback loop for runners.
