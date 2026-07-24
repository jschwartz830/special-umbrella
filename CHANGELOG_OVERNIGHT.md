# Overnight Changelog

---

## Pass 81 — 2026-07-24 (branch `claude/nightly-codebase-audit-yfetx3`)

### [6036bcb] test(storeSync): add coverage for cloud-sync branching and debounce logic

**Summary**: `storeSync.ts` — the Supabase cloud-sync bridge for all 7 Zustand stores — had zero tests across 4+ audit passes (TEST-1, the longest-standing carried-forward gap, first flagged pass 78). Added 13 tests covering: `syncOnLogin`'s first-login push vs. cloud-hydrate branching, per-store `migrate` wiring (history extras `source` backfill, mobility `activeSession` backfill), the fetch-error short-circuit, tolerance of unknown/renamed store names in cloud rows, and `subscribeStores`' debounce / `beforeunload` flush / unsubscribe-cancels-pending-write behavior.

**Why it matters**: This is the only path that can silently lose or corrupt user data across devices (a debounce or migrate-ordering bug here has no visible symptom until a user logs in on a second device and finds stale or missing history). Test-only change; zero behavior risk.

**Files changed**: `src/lib/__tests__/storeSync.test.ts` (new)

**Risks**: None — no production code touched.

**Rollback**: `git revert 6036bcb`

---

### [0050a45] fix(TodayPage): streak milestone banner used a different streak than the one displayed

**Summary**: `earlyPlanStreak` (fed to `useStreakMilestoneDismiss`) was computed via `computePlanStreak(...)` without a mobility-dates argument, while `planStreak` (shown in the habit row and the plan-progress modal) included mobility dates via `mobilityDateSet`. A comment justified the split by claiming mobility completions "aren't yet available" at that point in the render — untrue, the `mobilityCompletions` selector is read earlier in the same component. Moved the `mobilityDateSet` computation above the early-return guard, threaded it into `earlyPlanStreak`, and made `planStreak` reuse that value instead of recomputing an now-identical result.

**Why it matters**: A run of consecutive mobility-only days could show e.g. "🔥 32 days" everywhere in the UI while the 7/14/21/30-day milestone-banner logic kept evaluating a lower, stale streak count — silently suppressing celebrations or firing them at the wrong threshold.

**Files changed**: `src/pages/TodayPage.tsx`

**Risks**: Low. Pure data-flow correction — no new state, no new hooks, same computation now shared instead of duplicated. `planStreak`'s value is unchanged for any user without mobility-only streak days (the overwhelming majority of existing streaks).

**Rollback**: `git revert 0050a45`

---

### [d4da65d] fix(TodayPage): "Continue mobility" card broke exactly when routines were edited mid-session

**Summary**: `mobilityInProgress` required the paused checkpoint's `exerciseIds` to exactly match the live routine's ids before showing a "Continue" card. That check predates `reconcileCheckpoint()` (an adjacent recent commit, `911d095`), which was built specifically so a mobility session survives routine edits (add/remove/reorder exercises via "Manage routine") made while paused. The stale equality check meant editing the routine mid-session silently reverted the UI to a plain "Start Mobility Routine" button, implying the paused progress was gone — it wasn't; `MobilityTracker` would have transparently reconciled and resumed it.

**Why it matters**: This bug is only reachable by using the exact feature ("preserve mobility session progress across routine edits") that shipped just before this pass, so it's very likely a live UX bug for anyone who has tried that flow.

**Files changed**: `src/pages/TodayPage.tsx`

**Risks**: Low. Removing the equality check widens when the "Continue" card is shown (from "routine unchanged" to "checkpoint exists for today with progress") — strictly more permissive, and the fallback path it now avoids (`reconcileCheckpoint`) was already exercised and tested via `MobilityTracker.test.ts`.

**Rollback**: `git revert d4da65d`

---

### [84fe146] fix(csv): disambiguate legacy extraId collisions within a single import

**Summary**: `stableExtraId()` (the pass-80-recommended, already-shipped BUG-CSV fix) derives a synthetic id from `(planId, date, workoutType, workoutName)` for legacy CSV exports lacking an `extraId` column. Two rows in the *same* import sharing that composite key (e.g. two same-day, default-named "Yoga" extras) hashed to the identical id. `historyStore.importExtraEntries` only dedupes incoming rows against already-stored entries, not against each other in the same batch, so both rows would be inserted under one colliding id — corrupting id-keyed outcome lookups and making by-id edit/delete affect both entries at once. Added an `occurrence` counter, scoped to a single `historyFromCsv()` call, folded into the hash input for the second and later row sharing a key. Occurrence 0 (the common, non-colliding case) keeps the original unsuffixed hash, so existing ids are unaffected.

**Why it matters**: Silent data corruption on a plausible (not exotic) legacy-CSV shape — anyone who used default names for multiple same-day extras before the 2026-04-26 schema change and now re-imports that export.

**Files changed**: `src/lib/csv.ts`, `src/lib/__tests__/csv.test.ts`

**Risks**: Low. Purely additive disambiguation — occurrence-0 ids (the vast majority) are byte-identical to before. Also strengthened a test that had regressed to only checking "id is a non-empty string" instead of the actual idempotency guarantee.

**Rollback**: `git revert 84fe146`

---

## Pass 80 — 2026-07-21 (branch `claude/dreamy-mccarthy-h2vbby`)

### [6000a9c] fix(CalendarPage): slot fallback type 'rest' → 'other'

**Summary**: The zero-slots guard in `handleOutcomeConfirm` (line 244) used the deprecated `'rest'` WorkoutType. `planStore` migrations normalise `'rest'` to `'other'`, so using `'rest'` here put the code on a branch that no live plan can reach while also looking up `WORKOUT_META['rest']` (the legacy Moon icon / "Other" label) instead of `WORKOUT_META['other']`.

**Why it matters**: Silent visual corruption and wrong downstream logic for any plan day that has zero slots. The same bug was already fixed in `HistoryPage.tsx` but CalendarPage was missed.

**Files changed**: `src/pages/CalendarPage.tsx`

**Risks**: None — single character change, no logic change.

**Rollback**: `git revert 6000a9c`

---

### [68c2f9f] fix(csv): import workoutInstanceId helpers from lib, not store

**Summary**: `csv.ts` imported `makeWorkoutInstanceId` and `makeExtraWorkoutInstanceId` from `../store/outcomeStore` instead of their canonical home `../lib/workoutInstanceId.ts`. These functions are defined in `workoutInstanceId.ts` and only re-exported by `outcomeStore`.

**Why it matters**: A lib module importing from a store violates dependency direction (`lib → store` instead of `store → lib`). While it doesn't currently cause a circular import, if `outcomeStore` ever imported from `csv.ts`, a cycle would form and bundling would fail.

**Files changed**: `src/lib/csv.ts`

**Risks**: None — the functions are identical; only the import path changes. Tests confirm identical behaviour.

**Rollback**: `git revert 68c2f9f`

---

### [5f96761] fix(stores): add version + migrate to settingsStore and programStore

**Summary**: `settingsStore` (`wpt_settings`) and `programStore` (`wpt_program_vars`) both used `persist()` without `version` or `migrate`. All other five stores already have `version: 1`. Without a version, any future schema change would silently leave existing localStorage data without migration.

**Why it matters**: Forward-compatibility safety net. No data migration needed today; establishes the baseline so future schema changes can run correctly.

**Files changed**: `src/store/settingsStore.ts`, `src/store/programStore.ts`

**Risks**: On first load, Zustand sees `version: undefined` vs `version: 1` and calls the identity migrate — returns the existing data unchanged. Safe and correct.

**Rollback**: `git revert 5f96761`

---

### [13dd36d] fix(expressionEval): tokenizer stops at first decimal point in a number

**Summary**: The number scanner consumed any `[\d.]` sequence and relied on `parseFloat` to discard extra decimals. Replaced with an explicit `seenDot` flag that stops consuming at the second decimal point. Adds one test documenting the expected tokenizer behaviour.

**Why it matters**: Principled tokenization — the scanner no longer relies on `parseFloat`'s implicit truncation. No observable behaviour change for valid YAML-authored expressions.

**Files changed**: `src/lib/expressionEval.ts`, `src/lib/__tests__/expressionEval.test.ts`

**Risks**: None for valid inputs. Malformed multi-dot numbers already produced the correct result via `parseFloat`'s truncation.

**Rollback**: `git revert 13dd36d`

---

### [6463ed0] test(historyStore): document BUG-2 — day_off→complete without planDayIndex

**Summary**: Test that captures the current (buggy) behaviour of `updateEntryAction` when no `planDayIndex` is supplied while changing from `day_off` to `complete`. The resulting entry has `planDayIndex: undefined`, silently dropped by stats functions.

**Why it matters**: Regression anchor for the future fix. Documents the expected fix path in the test comment.

**Files changed**: `src/store/__tests__/historyStore.test.ts`

**Risks**: None — test-only change.

**Rollback**: `git revert 6463ed0`

---

## Pass 79 — 2026-07-19 (branch `claude/dreamy-mccarthy-0r25in`)

### Commit 1 — `f94088a`

**fix(TodayPage): use today string for date header to prevent stale display past midnight**

- `src/pages/TodayPage.tsx:651`: Changed `new Date().toLocaleDateString(...)` → `new Date(today + 'T00:00').toLocaleDateString(...)`, where `today` comes from `useToday()`.
- Without this fix, a session kept open past midnight would display yesterday's date in the header until the page was re-mounted.

### Commit 2 — `327484d`

**fix(HistoryPage): use parseISO(today) for weekly breakdown window to prevent stale date past midnight**

- `src/pages/HistoryPage.tsx:252`: Changed `addDays(new Date(), -55)` → `addDays(parseISO(today), -55)`, where `today` comes from `useToday()`.
- Without this fix, the weekly workout breakdown chart would anchor its 55-day window to yesterday's date after midnight, showing one day too far back.

### Commit 3 — `3924a79`

**fix(PlansPage): replace stale format(new Date()) with useToday() for correct midnight reset**

- `src/pages/PlansPage.tsx`: Removed `format(new Date(), 'yyyy-MM-dd')` local variable; replaced with `useToday()` hook.
- Added `import { useToday } from '../hooks/useToday'`.
- Without this fix, `isPlanExpired` and `computePlanProgress` in `PlanCard` received a stale date after midnight, potentially showing a completed plan as still "Active" until re-mount.

### Commit 4 — `2662bd7`

**feat(CalendarPage): highlight current streak days with amber dot indicator**

- `src/lib/historyStats.ts`: Added `additionalDates?: Set<string>` parameter to `computeCurrentStreakDates`, threaded through to `getStreakDatesSet`. Fixes API inconsistency with `computePlanStreak`.
- `src/lib/__tests__/historyStats.test.ts`: Added 1 test for `additionalDates` parameter — verifies a mobility date bridging a gap extends the streak date set.
- `src/pages/CalendarPage.tsx`:
  - Imported `computeCurrentStreakDates` from `../lib/historyStats`.
  - Added `streakDatesSet` `useMemo` scoped to the active plan, with `Object.keys(mobilityCompletions)` as `additionalDates`.
  - Each calendar cell now computes `isOnStreak` and renders a small amber dot (`w-1 h-1 rounded-full bg-amber-400`) when true.
  - Added "Streak" entry to the calendar legend with a matching amber dot.

---

## Pass 78 — 2026-07-15 (branch `claude/dreamy-mccarthy-cr3jyk`)

### Commit 1 — `38d2f06`

**fix(workoutInstanceId): fix stale comment and add extractExtraId helper**

| | |
|---|---|
| **Files** | `src/lib/workoutInstanceId.ts` |
| **Risk** | Very low — additive; no existing callers changed |
| **Rollback** | `git revert 38d2f06` |

The comment said nanoid uses "base-36 (0-9, a-z)"; the actual implementation (since pass 77) uses 32-char hex. Updated the comment. Added `extractExtraId(instanceId)` which anchors on the YYYY-MM-DD date pattern rather than naively splitting on `'_extra_'`. Any caller using the naive split would produce a wrong extraId if a planId or extraId ever contained `'_extra_'` as a substring.

---

### Commit 2 — `4cbaed8`

**fix(usePlanActions): replace stale today with useToday()**

| | |
|---|---|
| **Files** | `src/hooks/usePlanActions.ts` |
| **Risk** | Low — drops one import, adds one hook call; `useToday()` is already used in TodayPage |
| **Rollback** | `git revert 4cbaed8` |

`format(new Date(), 'yyyy-MM-dd')` is evaluated once when the hook initialises. If the app stays open past midnight without a full re-render of the consumer, every subsequent `complete()`, `skip()`, `dayOff()`, `advance()`, and `goBack()` call would write history entries with yesterday's date. `useToday()` uses a `setTimeout` to reset to the new date at midnight.

---

### Commit 3 — `6d26ab2`

**fix(AuthGate): gate dev signout div to import.meta.env.DEV**

| | |
|---|---|
| **Files** | `src/components/auth/AuthGate.tsx` |
| **Risk** | Very low — Vite dead-code-eliminates the false branch; no production behaviour change |
| **Rollback** | `git revert 6d26ab2` |

The `<div id="__auth-signout">` dev convenience helper rendered in every production bundle. Wrapping it in `import.meta.env.DEV` removes it from production builds entirely.

---

### Commit 4 — `960b699`

**fix(CalendarPage,HistoryPage): safer extraId extraction and destination guard**

| | |
|---|---|
| **Files** | `src/pages/CalendarPage.tsx`, `src/pages/HistoryPage.tsx` |
| **Risk** | Low — guards are additive; removes a silent data-loss path |
| **Rollback** | `git revert 960b699` |

Two fixes:

1. **extraId extraction**: replaced `.split('_extra_')[1]` with `extractExtraId()` in both files. Safe under all current IDs (hex can't contain `_extra_`), but future-proof.

2. **Destination guard**: in the non-extra date-move path, `removeEntry(planId, completedDate)` was called unconditionally before moving the history entry to the new date. If an independently-logged entry existed at the destination, it was silently deleted. Added a check: only proceed with the move if `completedDate` has no existing entry. The outcome still moves; only the history-entry relocation is skipped on collision.

---

### Commit 5 — `770bf3f`

**fix(TodayPage): guard date-change in handleOutcomeConfirm against data loss**

| | |
|---|---|
| **Files** | `src/pages/TodayPage.tsx` |
| **Risk** | Low — guard is additive; prevents a silent data-loss path |
| **Rollback** | `git revert 770bf3f` |

Same issue as commit 4, but in TodayPage's `handleOutcomeConfirm`. After `logAction` creates an entry for `today`, if the user changes the date in the outcome modal, the handler called `removeEntry(planId, completedDate)` and then `updateEntryDate(...)` — silently destroying any entry already at the destination. Added a `destEntry` check so the move only fires when the destination date is free.

---

### Commit 6 — `21a9d81`

**fix(CardioWorkoutTracker): explicitly cancel auto-advance timeout on manual nav**

| | |
|---|---|
| **Files** | `src/components/workout/CardioWorkoutTracker.tsx` |
| **Risk** | Low — stores a ref and calls `clearTimeout` earlier; no semantic change when navigation is not manual |
| **Rollback** | `git revert 21a9d81` |

The 1500ms auto-advance `setTimeout` was only cancelled through React's effect cleanup (which fires on re-render when `segmentIdx` changes). While this technically works, adding `cancelAutoAdvance()` explicitly in `goNext`, `goPrev`, and the segment-dot click handler makes the cancellation immediate and unconditional, removing any risk of a stale timeout firing after the user manually changes segment.

---

### Commit 7 — `64ed8f0`

**fix(storeSync): flush pending debounced writes on beforeunload**

| | |
|---|---|
| **Files** | `src/lib/storeSync.ts` |
| **Risk** | Low — purely additive; adds a `beforeunload` event listener that's properly cleaned up |
| **Rollback** | `git revert 64ed8f0` |

The 1.5s debounce means any state change made within 1.5s of closing the browser tab was never pushed to Supabase. On a single-device workflow, localStorage retains the data. On multi-device or after a browser data clear, those changes were permanently lost from cloud sync. The fix tracks pending timeouts in a `Map`, cancels them on `beforeunload`, and immediately calls `pushStore` for any store with a pending write. The `beforeunload` listener is registered when `subscribeStores()` is called and removed when the returned cleanup runs.

---

### Commit 8 — `cefdacf`

**test(workoutInstanceId): add coverage for extractExtraId helper**

| | |
|---|---|
| **Files** | `src/lib/__tests__/workoutInstanceId.test.ts` |
| **Risk** | Zero — tests only |
| **Rollback** | `git revert cefdacf` |

7 new tests: standard id, planId-with-underscores, extraId-containing-`_extra_` (the fragile-split scenario), non-extra id, missing date, empty string, and round-trip with `makeExtraWorkoutInstanceId`.

---

## Pass 77 — 2026-07-14 (branch `claude/dreamy-mccarthy-aeym9p`)

## Branch: `claude/dreamy-mccarthy-aeym9p`

---

### Commit 1 — `19b85c1`

**fix: upgrade nanoid to crypto.getRandomValues for 128-bit entropy**

#### What changed

- **Modified** `src/lib/utils.ts`: Replaced `Math.random().toString(36).slice(2, 11)` with `crypto.getRandomValues(new Uint8Array(16))` encoded as a 32-character hex string.

#### Why

The previous implementation produced ~46 bits of entropy (9 base-36 characters from a 53-bit Math.random source). For a single-user personal tracker this was functionally safe, but it violated the spirit of ID generation best practices and left open a theoretical collision path during bulk import operations. `crypto.getRandomValues` gives 128 bits of entropy with no new dependencies — Web Crypto is universally available in all supported environments (modern browsers + Node 15+). All existing consumers treat the ID as an opaque string, so the format change (base-36 → hex, 9 chars → 32 chars) is backward-compatible: new IDs are longer but carry no semantic meaning.

#### Risk

Very low. All store keys, localStorage keys, and `workoutInstanceId` construction treat `nanoid()` output as an opaque string. The regex in `parseWorkoutInstanceId` matches a date-shaped substring (`YYYY-MM-DD`), not the ID format itself — a 32-char hex string contains no date-like substrings. Existing persisted IDs (9-char base-36) are unaffected; only newly created records use the new format.

#### Rollback

`git revert 19b85c1` — reverts `src/lib/utils.ts` to the Math.random implementation. No data migration needed; the format change is forward-only (new records get new-format IDs; old records keep their existing IDs).

---

### Commit 2 — `930d1c8`

**feat: streak milestone celebration banner on Today page**

#### What changed

- **New** `src/hooks/useStreakMilestoneDismiss.ts`: Hook that computes the active milestone from a raw streak count, reads `isDismissed` fresh from localStorage on each render, and forces a re-render on `dismiss()`. Exports `getActiveStreakMilestone()` helper and `STREAK_MILESTONES` constant `[7, 14, 21, 30, 60, 90, 180, 365]`.
- **New** `src/hooks/__tests__/useStreakMilestoneDismiss.test.ts`: 13 unit tests covering all milestones, boundary values, streaks in between thresholds, above-max (365+), and the `STREAK_MILESTONES` coverage check.
- **Modified** `src/pages/TodayPage.tsx`: Added `earlyPlanStreak` `useMemo` (computed without mobility dates, before the early-return guard) and `useStreakMilestoneDismiss` hook call. Added amber celebration banner rendered between the consecutive-skips nudge and the run adaptation note.

#### Why

The existing Today page already shows a streak count and a "plan complete" celebration banner. But hitting a streak milestone (e.g. 7 days, 30 days) produces no feedback — a motivational miss. The banner is dismissable per-milestone so users aren't re-shown a congratulation they've already seen, but reaching the next milestone triggers a fresh banner. The amber color and fire emoji distinguish it from the purple plan-completion banner and the amber consecutive-skips nudge (the skips nudge also uses amber, but the two banners are mutually exclusive in practice: a high skip count means the streak is near 0, so both can't appear simultaneously).

The `earlyPlanStreak` is computed without mobility dates (which would require `mobilityDateSet`, itself a `useMemo` defined after the hook section). The one-day difference is acceptable for a celebration banner.

#### Risk

Low. The banner is additive; removing it requires only reverting the three modified lines in TodayPage and deleting the two new files. No store changes, no schema changes, no migration needed. The hook reads from localStorage — it cannot corrupt Zustand state.

#### Rollback

`git revert 930d1c8` — reverts all three files atomically. Alternatively, comment out the `{!planExpired && streakMilestone !== null && !streakMilestoneDismissed && ...}` block in TodayPage to hide the banner without removing the hook infrastructure.

---

# Overnight Changelog — Pass 76 (2026-07-12)

## Branch: `claude/dreamy-mccarthy-2h1jip`

### Commit 1

**test: cover additionalDates parameter in getStreakDatesSet and computePlanStreak (12 tests)**

#### What changed

- **Modified** `src/lib/__tests__/historyStats.test.ts`: Added 12 new tests covering the `additionalDates?: Set<string>` parameter of `getStreakDatesSet` and `computePlanStreak`.

#### Why

The `additionalDates` parameter was introduced to allow mobility-session dates (from `mobilityCompletions`) to count toward the plan streak displayed on `TodayPage`. `TodayPage.tsx` line 338 actively uses:

```typescript
computePlanStreak(plan.id, planEntries, planExtras, today, mobilityDateSet)
```

Despite this production usage, neither `getStreakDatesSet` nor `computePlanStreak` had any test that passed a non-empty `additionalDates` argument. The 7 `additionalDates` tests added to `computePlanStreak` cover: today-only date, consecutive dates, bridging a rotation gap, not bridging without the date, unconditional application (not filtered by planId), empty-set parity, and future dates not extending the streak. The 5 `additionalDates` tests in `getStreakDatesSet` cover: single date, multiple dates, union with entries, unconditional (not planId-filtered), and empty-set parity.

#### Risk

None — pure test additions. No production code was modified. All 1068 tests pass.

---

# Overnight Changelog — Pass 75 (2026-07-09)

## Branch: `claude/dreamy-mccarthy-vpg2n1`

### Commit 1 — `090e73e`

**perf+fix: pre-compute PR flags map in HistoryPage; add max-date to history date pickers**

#### Part A — O(N log N) PR flags pre-computation

- **New export** `buildPRFlagsMap(allRecords)` added to `src/lib/historyStats.ts`: Processes all `ExerciseSessionRecord` entries in a single pass sorted by `calendarDate`. Groups records by date so same-date sessions all see the same prior max (identical semantics to `computeWorkoutPRFlags`). Returns `Map<workoutInstanceId, {hasLoadPR, hasRepsPR}>` in O(N log N) overall vs. O(N²) when calling `computeWorkoutPRFlags` per history item.
- **Modified** `src/pages/HistoryPage.tsx`: Imports `buildPRFlagsMap` instead of `computeWorkoutPRFlags`. Adds `const prFlagsMap = useMemo(() => buildPRFlagsMap(allExerciseRecords), [allExerciseRecords])`. Both `OutcomeMetrics` call sites in the rendered list now do `prFlagsMap.get(instanceId)` (O(1)) instead of scanning all records inline.
- **New tests** in `src/lib/__tests__/historyStats.test.ts`: 7 tests covering empty input, first-session PR, load PR on exceed, no PR on tie, same-calendarDate records see same prior max, produces identical results to `computeWorkoutPRFlags` across three sessions, zero/null load exclusion.

#### Part B — History date picker future-date guard

- **Modified** `src/pages/HistoryPage.tsx` lines 768 and 863: Added `max={today}` to both `<input type="date">` elements in the history edit modals (rotation entry date and extra entry date). Prevents accidentally moving a logged workout to a future date. `today` (`YYYY-MM-DD`) is already available from `useToday()` at the top of the component.
- **Why**: Without `max`, both the browser date-picker UI and manual text entry allowed future dates. The `saveAndClose` and `saveAndCloseExtra` handlers had no server-side validation against future dates either.
- **Risk**: None — `today` is a stable value (changes only at midnight via `useToday`), and `max` is a standard HTML attribute that degrades gracefully on unsupported browsers (no constraint applied).

---

### Commit 2 — `e701e20`

**fix: remove unused withDurationMin helper in estimateRunDuration test (TS6133)**

- **Modified** `src/lib/__tests__/estimateRunDuration.test.ts`: Removed `withDurationMin` helper function (lines 5–7) that was declared but never called. This was the sole `tsc --noEmit` error at pass start (TS6133: 'withDurationMin' is declared but its value is never read).
- **Why**: The helper was likely a leftover from an earlier test draft. The `withTargetDurationMin` and `withTargetDistanceMiles` helpers that are actually used remain unchanged.
- **Risk**: None — removing unused dead code.

---

## Summary

| Metric | Before | After |
|---|---|---|
| Tests | 1049 | 1056 (+7) |
| TypeScript errors | 1 | 0 |
| Test files | 30 | 30 |

---

# Overnight Changelog — Pass 74 (2026-07-08)

## Branch: `claude/dreamy-mccarthy-ugdev5`

### Commit 1 — `bd8907d`

**refactor: extract estimateRunDurationMin to lib + add 22 unit tests**

- **New file** `src/lib/estimateRunDuration.ts`: Pure utility function extracted from `TodayPage.tsx` module scope. Estimates planned run duration in minutes from slot metadata using the following resolution order: `slot.durationMin` → `runConfig.targetDurationMin` → sum of segment durations → sum of segment distances × pace-by-type → `runConfig.targetDistanceMiles × 11` → 20 (default). Pace constants: tempo = 8 min/mi, warmup/cooldown = 12 min/mi, all other types = 11 min/mi.
- **New file** `src/lib/__tests__/estimateRunDuration.test.ts`: 22 tests covering every resolution branch, segment duration unit parsing (`"30min"`, `"20m"`, decimal values), segment distance with pace-by-type, `programVars` substitution (numeric and string var values), unknown variable skipping, `targetDistanceMiles` fallback, and all edge cases (empty slot, null runConfig, empty segments).
- **Modified** `src/pages/TodayPage.tsx`: Removed the inline 35-line `estimateRunDurationMin` definition; added `import { estimateRunDurationMin } from '../lib/estimateRunDuration'`. The function already accepted `programVars` as a second parameter since it was extracted to module scope in pass 72 — no call-site changes needed. Also added `differenceInCalendarDays` to the date-fns import (used in commit 2).
- **Why**: The function was untestable in isolation while living in a component file. Extracting it enables the 22 new tests and makes the logic independently reviewable.
- **Risk**: None. Function body is identical; only file location changed.

---

### Commit 2 — `047f8a1`

**refactor: replace manual date arithmetic in prevSessionDaysAgo with differenceInCalendarDays**

- **Modified** `src/pages/TodayPage.tsx`: Replaced an 8-line IIFE that used raw `Date.UTC(y, m, d)` subtraction to compute `prevSessionDaysAgo` with a single expression using `differenceInCalendarDays(parseISO(today), parseISO(prevSessionDate))` from date-fns.
- **Why**: The manual arithmetic was correct but verbose, hard to scan, and inconsistent with the rest of the codebase which uses date-fns throughout. The new expression is semantically equivalent: it computes the calendar-day difference (not wall-clock millisecond difference) between `today` and `prevSessionDate`, then returns `null` if the result is ≤ 0 (e.g., same-day session).
- **Risk**: Low. `differenceInCalendarDays` is already used extensively in the project. The guard `d => d > 0 ? d : null` preserves the same null-return behavior for same-day or future dates.

---

### Commit 3 — `1a29a3a`

**perf: memoize rotationLoggedCount Set creation in TodayPage**

- **Modified** `src/pages/TodayPage.tsx`: Wrapped `rotationLoggedCount` (a `Set<string>` built from `planEntries.map(e => e.calendarDate)`) in `useMemo` with `[planEntries]` as the dependency.
- **Why**: The Set was being rebuilt on every render (including every modal state transition, every scroll, and every unrelated state update). The computation is O(n) and was re-running for non-data changes. Memoizing it means the Set is only rebuilt when `planEntries` actually changes.
- **Risk**: None. The memoized value is semantically identical; the only change is when it recomputes.

---

### Commit 4 — `c337fa3`

**feat: Show "Cycle done" visual cue when rotation cycle just completed**

- **Modified** `src/pages/TodayPage.tsx`: Added a "Cycle done" chip that appears in the cycle progress section when `justCompletedRotation === true` (returned by `computeRotationCycleProgress`). Previously, completing the last workout in a cycle would show "0/N cycle" which was confusing — it looked like no progress rather than 100% progress.
- **Why**: The existing `justCompletedRotation` boolean was computed but the UI had no display path for it. The new chip ("Cycle done ✓") replaces the "0/N" text when the cycle is complete.
- **Risk**: Low — purely additive JSX conditional. `justCompletedRotation` is only `true` when `doneInCycle === 0 && totalDone > 0`, which is already well-tested.

---

## Pass 79 — 2026-07-20 (branch `claude/dreamy-mccarthy-ccykny`)

### Commit 1 — CI test gate

**ci: run Vitest test suite before building and deploying**

- **Modified** `.github/workflows/deploy.yml`: Added `npm test` step between Install and Build.
- **Why it matters**: Tests were only run manually between passes. Without a CI gate, a broken commit could ship to GitHub Pages before the failure was noticed. The test suite is pure Node.js (no Supabase env vars, no browser APIs) so it runs cleanly in the GitHub Actions runner.
- **Files changed**: `.github/workflows/deploy.yml`
- **Risks / tradeoffs**: Build time increases by ~3–4 s. If a future commit legitimately breaks tests, the deploy will block until fixed — this is the intended behaviour.
- **Rollback**: Remove the `Test` step from deploy.yml.

---

### Commit 2 — BUG-8 fix: deterministic outcomeSortKey (+ tests)

**fix(outcomeSortKey): append instanceId as deterministic tiebreaker**

- **Modified** `src/lib/outcomeSortKey.ts`: Changed return value from `primary` to `primary + '\x00' + instanceId`. The null-byte delimiter is below all printable ASCII, so it cannot collide with date or timestamp characters.
- **Modified** `src/lib/__tests__/outcomeSortKey.test.ts`: Updated the 5 exact-value tests to include the new suffix; changed the "no date → empty string" test to check relative ordering (which is the meaningful contract) rather than the exact string; added 2 new tests verifying that tie-breaking is deterministic for same-completedAt and same-calendarDate cases.
- **Why it matters**: Previously, two outcomes logged at the exact same second (e.g., during an import) returned identical sort keys. The ordering in `previousSetsHelper.ts` and `TodayPage.tsx` then depended on `Object.values()` iteration order — a V8 implementation detail, not a stable guarantee.
- **Files changed**: `src/lib/outcomeSortKey.ts`, `src/lib/__tests__/outcomeSortKey.test.ts`
- **Risks / tradeoffs**: The return value changes for every outcome (adds the `\x00instanceId` suffix). All callers use the key for relative comparison only (`<`, `>`, `localeCompare`) — no caller checks for equality or an exact string value. Net behaviour change: ties now break by instanceId (arbitrary but deterministic) rather than by insertion order.
- **Rollback**: Revert `outcomeSortKey.ts` to the single-expression form.

---

### Commit 3 — BUG-4 fix: cloud hydration migrations

**fix(storeSync): apply schema migrations when hydrating from Supabase**

- **Modified** `src/store/planStore.ts`: Exported `migratePlanState` (previously internal `function`, now `export function`) so storeSync can call it without duplicating logic.
- **Modified** `src/lib/storeSync.ts`:
  - Added `MigrateFn` type and optional `migrate` field to each STORES entry.
  - Added migration for `wpt_history`: calls `migrateHistoryState(data, 0)` — always applies from version 0, idempotent (extras with `source` already set are unchanged; only legacy undefined-source extras are patched to `'history'`).
  - Added migration for `wpt_plans`: calls `migratePlanState(data)` — normalises `weightlifting→weights`, `long_run→run`, `recovery_run→run`, `rest→other`, derives `location`/`weightsFocusArea` from deprecated `tags`.
  - Added inline migration for `wpt_mobility`: adds `activeSession: null` when absent (field was added in v2).
  - Updated `syncOnLogin` to call `entry.migrate(row.data)` before `setState` for any store that declares a migration.
- **Why it matters**: Zustand's `persist` middleware only runs `migrate()` when reading from `localStorage`. A direct `setState()` call (as used in cloud hydration) bypasses it. Users who log in on a new device or browser with cloud data stored by an older app version would get un-migrated data: extras without `source` (causing Undo to silently delete them), old slot types (causing display issues), and missing `activeSession` (causing the mobility tracker to behave unexpectedly).
- **Files changed**: `src/store/planStore.ts`, `src/lib/storeSync.ts`
- **Risks / tradeoffs**: All three migrations are idempotent — applying them to already-current data is a no-op. The `migratePlanState` export is internal-use only (marked with `@internal` JSDoc). No schema change required.
- **Rollback**: Revert both files. The migration export can stay in planStore without harm.
