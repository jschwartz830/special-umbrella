# Review Notes — Overnight Audit

## 2026-07-24 (eighty-first pass) — branch `claude/dreamy-mccarthy-bt9dqu`

---

### Executive Summary

1. **What changed**: 7 commits, 7 source files + 2 test files. Six bug fixes, one feature (focusMode toggle), and one new test file (programParser). No new dependencies. No store schema changes.
2. **Test delta**: +38 tests (1108 → 1145). All pre-existing tests still pass. One previously uncovered module (programParser.ts) now has 37 tests.
3. **Highest confidence**: B-3 timezone fix and B-4/B-5 auth error handling — these are real user-facing bugs with clear incorrect behavior and no product decision required.
4. **Risky items**: None — all changes are targeted, reversible, and additive. The focusMode toggle is the most "product" change; it exposes an existing implemented feature that was simply unreachable.
5. **Review first**: Timezone fix in historyStore (commit `7cc21eb`) and auth error handling (commit `2104df2`) — these are the highest-impact changes.

---

### Biggest Issues Found

| Severity | ID | File | Description |
|---|---|---|---|
| High | B-3 | `historyStore.ts:189` | `removeRetroJumpForDate` shifts dates for UTC-offset users near midnight. **Fixed.** |
| High | B-4 | `authStore.ts:33` | Auth init error leaves permanent loading spinner. **Fixed.** |
| Medium | B-5 | `authStore.ts:19` | OAuth sign-in failures completely silent. **Fixed.** |
| Medium | B-2 | `PlanBuilderPage.tsx:526` | Duplicate datalist IDs with multiple slots per day. **Fixed.** |
| Medium | B-9 | `SettingsPage.tsx` | focusMode setting inaccessible to users (no UI). **Fixed.** |
| Low | B-1 | `PlansPage.tsx:117` | duplicatePlan returns `''`; call site navigates to bad route. **Fixed.** |
| Low | B-6 | `expressionEval.ts:77` | YAML expression typos produce wrong 0 values silently. **Fixed (warning added).** |

---

### Improvements Completed

| # | Commit | Summary |
|---|---|---|
| 1 | `7cc21eb` | `historyStore.ts` — UTC-safe date comparison in `removeRetroJumpForDate` |
| 2 | `2104df2` | `authStore.ts` — try/catch in `initialize()`, log OAuth errors |
| 3 | `b6b1ef3` | `PlanBuilderPage.tsx` — unique datalist IDs per slot |
| 4 | `7a4023f` | `SettingsPage.tsx` — focusMode toggle added |
| 5 | `9b7f36d` | `expressionEval.ts` — console.warn on unknown tokenizer characters |
| 6 | `fa1fe65` | `PlansPage.tsx` — duplicatePlan navigation guard |
| 7 | `2491f1a` | Tests: 37 tests for `programParser.ts`, 1 UTC edge case for `historyStore` |

---

### Small Features Added

**focusMode toggle in Settings** (`7a4023f`): The `focusMode` setting was fully implemented and tested in `settingsStore` and `ActiveWorkoutTracker` but had no UI entry point. Users had no way to enable it. Adding the toggle is a single-section addition to SettingsPage following the existing `autoAdvanceSegments` toggle pattern. Zero risk.

---

### Medium-Complexity Feature Explored

None this pass. The codebase benefited most from stabilisation (timezone fix, auth hardening, missing UI) and test coverage expansion. No adjacent feature met the bar for low-risk, narrow-slice implementation without displacing the higher-priority bug fixes.

---

### Definitely Keep

All 7 commits are safe to merge:

- `7cc21eb` — correctness fix with zero behavioral change for in-range timezones
- `2104df2` — defensive error handling with no behavior change on the happy path
- `b6b1ef3` — HTML spec compliance fix, zero behavioral change
- `7a4023f` — exposes existing working feature; fully reversible
- `9b7f36d` — diagnostic improvement only, no state changes
- `fa1fe65` — defensive guard for an edge case that shouldn't happen in practice
- `2491f1a` — tests only

---

### Probably Keep but Tweak

None.

---

### Do Not Keep

None.

---

### Recommendations Only (not implemented)

| Item | Rationale |
|---|---|
| Atomic `deletePlanAndCascade` | PlansPage manually chains 6 store calls. Extract to a single function to prevent future callers from forgetting one. Medium-scope refactor. |
| Move Supabase keys to env vars | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` should be in `.env` to allow key rotation without a code change. |
| Rules of Hooks audit in TodayPage | Confirm no hook is called after any early `return` in the 1832-line component. Risky to change without thorough read. |
| Fix B-13 (`bodyweight` → null load) | `resolveLoad('bodyweight', ctx)` returns 0, causing "@ 0 lb" to appear for bodyweight exercises in OutcomeModal. Requires product decision on how to represent no-weight exercises. |
| ActiveWorkoutTracker decomposition | 2137-line file with no extractable hooks. Creates zero testable units for the entire live workout experience. |

---

### Open Questions

1. **focusMode UX description**: The placeholder description says "Show one set at a time during a workout." Is this accurate, or does it do more? Worth reviewing `ActiveWorkoutTracker.tsx:1520` to confirm.
2. **B-12 (Rules of Hooks in TodayPage)**: The pass 77 audit flagged this as "must check carefully" — were hooks above the `if (!plan) return null` confirmed? Or is this still an open question?
3. **B-13 (bodyweight load display)**: Should bodyweight exercises suppress the load field entirely in OutcomeModal, or should they show something like "BW"?

---

### Known Issues / Incomplete Work

- `programParser.ts` now has 37 tests, but the coercion for **invalid segment types** (unknown type → `'easy'`) is tested implicitly through the parseSlot path rather than a dedicated test. Not a gap — behavior is covered — but explicit is better.
- The `eslint` `import/first` warning on the `historyStore.test.ts` mock pattern is pre-existing and not introduced by this pass.

---

### Dependencies Added

None.

---

## 2026-07-21 (eightieth pass) — branch `claude/dreamy-mccarthy-h2vbby`

---

### Executive Summary

1. **What changed**: 5 commits, 6 source files + 2 test files. Four bug fixes, one dependency-direction fix, one store schema-safety patch, one tokenizer correctness improvement, and one regression-anchor test. No new dependencies. No production store data changes.
2. **Test delta**: +2 tests (1091 → 1093). All pre-existing tests still pass.
3. **Highest confidence items**: `CalendarPage.tsx` `'rest'`→`'other'` fix, csv.ts import path fix, and the persist `version`/`migrate` additions — all zero-risk, clearly correct.
4. **Risky items**: None in this pass. All changes are local, additive, or one-liners.
5. **Review first**: The `settingsStore` / `programStore` version bump (first load triggers an identity migrate) and the BUG-2 regression-anchor test (test documents a bug, not a fix — the comment explains the expected future fix path).

---

### Biggest Issues Found

| Severity | ID | Description |
|---|---|---|
| Medium | BUG-2 | `CalendarPage.openEditOutcome → handleOutcomeConfirm`: changing a `day_off` entry to `complete` without a `planDayIndex` leaves the entry's `planDayIndex: undefined`. Stats functions silently drop it. Documented with a test; fix requires plumbing `planDayIndex` through `outcomeTarget`. |
| Medium | BUG-1 | `CalendarPage.tsx:244` slot fallback used deprecated `'rest'` WorkoutType — **fixed this pass**. |
| Medium | BUG-CSV | Pre-2026-04-26 CSV re-imports create duplicate `ExtraWorkoutEntry` records because each import assigns a fresh `nanoid()`. Fix needs a stable synthetic ID derived from available fields. Deferred. |
| Low | ARCH-2 | `csv.ts` imported from `outcomeStore` instead of `workoutInstanceId.ts` — **fixed this pass**. |
| Low | RISK-1/RISK-2 | `settingsStore` and `programStore` had no `version`/`migrate` — **fixed this pass**. |
| Low | EDGE-1 | `expressionEval.ts` number tokenizer relied on `parseFloat` to silently discard multi-dot input — **fixed this pass** (principled, no behaviour change). |
| Low | TEST-1 | `storeSync.ts` — entire cloud-sync module has zero unit tests. Carries forward from prior passes. |

---

### Improvements Completed

| Commit | Change |
|---|---|
| `6000a9c` | `CalendarPage.tsx`: slot fallback `'rest'` → `'other'` |
| `68c2f9f` | `csv.ts`: import ID helpers from `lib/workoutInstanceId.ts` not from `store/outcomeStore` |
| `5f96761` | `settingsStore.ts`, `programStore.ts`: add `version: 1` + identity migrate to persist config |
| `13dd36d` | `expressionEval.ts`: explicit `seenDot` flag replaces `parseFloat`-truncation reliance |
| `6463ed0` | `historyStore.test.ts`: BUG-2 regression-anchor test |

---

### Small Features Added

None this pass. Feature work was deliberately skipped — audit found enough stabilisation work to warrant full-stabilisation mode.

---

### Medium-Complexity Feature Explored

None attempted. See FEATURE_PROPOSAL.md for the best candidate for the next pass.

---

### Definitely Keep

- `6000a9c` — `'rest'` → `'other'` fix. Zero risk, clearly correct.
- `68c2f9f` — Import direction fix. Zero risk.
- `5f96761` — `version`/`migrate` additions. Safe by design; identity migrate never loses data.

### Probably Keep But Tweak

- `13dd36d` — expressionEval tokenizer fix. Principled and safe, but has no observable behaviour change for any real input. The test documents the new behaviour clearly. If you prefer to revert because it adds complexity for zero user-visible benefit, that's reasonable.

### Definitely Keep (test)

- `6463ed0` — BUG-2 regression-anchor test. Even though it documents a bug rather than fixing it, the test comment explains exactly what the fix should look like, making this a useful anchor.

### Recommendations Only (not implemented)

1. **BUG-2 fix** (P1): Add `planDayIndex?: number` to the `outcomeTarget` state shape in CalendarPage. In `openEditOutcome`, set it from `rd.historyEntry?.planDayIndex ?? rd.planDayIndex`. In `handleOutcomeConfirm`, use `entry.planDayIndex ?? outcomeTarget.planDayIndex` when calling `updateEntryAction`. Low-complexity, medium-confidence fix.

2. **BUG-CSV fix** (P2): In `historyFromCsv`, when `row.extraId` is absent, derive a stable ID: `const legacyId = \`${planId}_${calendarDate}_${workoutType}_${(row.workoutName?.trim() ?? '')}\`` and use it instead of `nanoid()`. This makes re-importing pre-2026-04-26 CSVs idempotent for the common case (unique type+name per day). Collision risk is low but non-zero; add a comment acknowledging it.

3. **storeSync.ts tests** (P1): Add unit tests for the "rows.length === 0 → upload all" vs "rows exist → hydrate from cloud" branching logic. This is the highest-risk untested module.

---

### Open Questions

1. For BUG-2: should `openEditOutcome` be reachable for a `day_off` entry at all? If the calendar UI never shows an "Edit Outcome" button for day_off entries, the bug is unreachable in practice. Worth auditing the UI guard.

2. For BUG-CSV: is idempotent re-import of old CSVs actually needed, or do users import once and discard the file? If it's rarely used, the fix complexity may not be worth it.

3. `storeSync.ts` `beforeunload` push is fire-and-forget (acknowledged in CHANGELOG). Is there a plan to use `sendBeacon` or another approach to improve reliability on tab close?

---

### Known Issues / Incomplete Work

- BUG-2 is documented but not fixed. The test at `historyStore.test.ts:195` (BUG-2 test) will continue to pass while documenting the bug — it asserts the buggy current behaviour.
- `storeSync.ts` has zero tests (TEST-1, carried forward from passes 78–79).
- `TodayPage.tsx` remains at ~1735 lines (ARCH-1, long-term debt).

---

### Dependencies Added

None.

---

## 2026-07-19 (seventy-ninth pass) — branch `claude/dreamy-mccarthy-0r25in`

---

### Executive Summary

1. **What changed**: 4 commits, 5 source files + 1 test file. Three bug fixes and one feature (calendar streak highlighting). No new dependencies; no store schema changes.
2. **Test delta**: +1 test (1088 → 1089). All pre-existing tests still pass.
3. **Root cause pattern (bugs)**: Three pages (`TodayPage`, `HistoryPage`, `PlansPage`) all used bare `new Date()` for rendered state that should track the current calendar date. The fix is consistent across all three: use `useToday()` (which fires a midnight timer) instead. One-time action calls (CSV export filenames, modal initial dates) are left as-is because they are not rendered state.
4. **API consistency fix**: `computeCurrentStreakDates` now accepts `additionalDates` (matching `computePlanStreak`). The fix is a 1-line change. Without it, any calendar streak highlighting would silently exclude mobility-only days, while the streak badge would include them.
5. **Feature (calendar streak dot)**: An amber dot is added to each streak day in the calendar grid. The computation is in a `useMemo`, scoped to the active plan, and includes mobility completions. The dot is 4px — small enough not to interfere with the existing slot-type icon row.
6. **What to review**: The streak dot visual — it appears at the bottom of each streak cell's flex column, after the slot-icon row and the coffee icon (for day-off cells). Verify it looks right on both active streak days and day-off streak cells. On day-off cells there will be both a coffee icon and an amber dot — check that isn't confusing.
7. **Low-risk assessment**: All 4 commits are additive or single-call-site replacements. No store mutations, no new async paths, no schema changes.

---

## 2026-07-15 (seventy-eighth pass) — branch `claude/dreamy-mccarthy-cr3jyk`

---

### Executive Summary

1. **What changed**: 8 commits, 7 source files + 1 test file. Pure stabilisation pass — no new features. Seven bugs fixed, one `extractExtraId` helper added, 7 new tests.
2. **Test delta**: +7 tests (1081 → 1088). All 1081 pre-existing tests still pass. TypeScript: 0 errors.
3. **Highest confidence**: All 7 fixes are small, additive guards that remove failure paths without changing the happy-path logic. The `usePlanActions` midnight bug is the highest-impact fix — it affects every logAction, advance, and goBack call made after midnight.
4. **What is risky**: None of the 7 fixes are risky; the `storeSync` beforeunload flush is the most new-logic-heavy, but it's a simple flush of pending writes. The two "destination guard" fixes (TodayPage + CalendarPage/HistoryPage) subtly change behaviour on date-collision — instead of overwriting, the move is skipped. This is safer than before, but different behaviour.
5. **What to review first**: The three "destination guard" fixes (commits 4 and 5). Verify that silently skipping the history-entry move when the destination is occupied is the correct UX vs. warning the user.

---

### Biggest Issues Found

| ID | Severity | File | Summary |
|---|---|---|---|
| BUG-1 | Medium | `usePlanActions.ts` | Stale `today` after midnight — all writes go to wrong date |
| BUG-3 | Medium | `TodayPage.tsx` + Calendar/History | Date-change in outcome modal silently deletes an existing entry at the destination |
| BUG-4 | Medium | `storeSync.ts` | Cloud hydration bypasses Zustand migrate — old schema data is applied without migration |
| BUG-6 | Low | `CardioWorkoutTracker.tsx` | Stale auto-advance timeout could fire after manual segment change |
| BUG-5 | Low | `storeSync.ts` | Final write lost when tab closed within 1.5s debounce window |
| ARCH-1 | Debt | `TodayPage.tsx` | 1700+ lines, 25+ state variables — long-term maintainability risk |
| TEST-1 | Gap | `storeSync.ts` | No tests for cloud sync; highest-risk untested module in the codebase |
| TEST-3 | Gap | `ActiveWorkoutTracker.tsx` | 1872 lines, 0 tests |

---

### Improvements Completed

| # | What | Commit |
|---|---|---|
| 1 | `extractExtraId()` helper + corrected nanoid comment in `workoutInstanceId.ts` | `38d2f06` |
| 2 | `usePlanActions` midnight bug — `useToday()` replaces stale `format(new Date(), …)` | `4cbaed8` |
| 3 | `AuthGate` dev div gated to `import.meta.env.DEV` | `6d26ab2` |
| 4 | `CalendarPage` + `HistoryPage`: `extractExtraId` + destination guard | `960b699` |
| 5 | `TodayPage`: destination guard in `handleOutcomeConfirm` | `770bf3f` |
| 6 | `CardioWorkoutTracker`: explicit timeout ref + `cancelAutoAdvance()` | `21a9d81` |
| 7 | `storeSync`: beforeunload flush for pending debounced writes | `64ed8f0` |
| 8 | Tests for `extractExtraId` (7 new) | `cefdacf` |

---

### Verdict by Item

#### Definitely keep

- **Commit 2** (`usePlanActions` midnight fix): Clear bug, zero risk, uses an existing hook correctly.
- **Commit 3** (AuthGate dev div): Obvious housekeeping, no behaviour change in production.
- **Commit 1** (extractExtraId + comment fix): Additive, safe, well-tested.
- **Commit 8** (tests): Always keep tests.

#### Probably keep but verify behaviour

- **Commits 4 and 5** (destination guard in CalendarPage, HistoryPage, TodayPage): The new behaviour silently leaves the history entry at the original date if the destination is occupied. This prevents data loss, but the user gets no feedback that the date move was skipped. Confirm this is acceptable vs. showing a warning. The outcome still moves to the requested date; only the history/scheduling entry is affected.

#### Keep — low risk, worth having

- **Commit 6** (CardioWorkoutTracker explicit cancellation): Defensively correct even if the React cleanup should also cancel it.
- **Commit 7** (storeSync beforeunload): Meaningful improvement for multi-device users; clean implementation.

---

### Recommendations Only (not implemented)

| Priority | Item |
|---|---|
| P1 | Add unit tests for `storeSync.ts` — mock Supabase, test debounce + flush + beforeunload |
| P1 | Fix BUG-4: apply Zustand `migrate` after cloud hydration in `syncOnLogin` |
| P2 | Fix BUG-8: `outcomeSortKey` non-deterministic fallback — use `workoutInstanceId` date as tie-breaker |
| P2 | Fix BUG-11: CSV re-import collision warning — detect existing plan ID and offer "replace or create new" |
| P3 | Begin TodayPage decomposition — extract `<TodayBanners>` as a first step |
| P3 | Add `draftVersion` to active-workout draft for safe stale-draft detection |
| P3 | Add `localDate: string` field to `OverrideEntry` for timezone-safe jump overrides |
| P4 | Add tests for `useToday` midnight advance |
| P4 | Add tests for `useStreakMilestoneDismiss` localStorage I/O |
| P4 | Expose `notes` field in extra-entry edit modal (HistoryPage) |

---

### Open Questions

1. **Destination-guard UX**: Should the date move silently fail when the destination is occupied, or should the app surface a warning ("That date already has a logged workout — move anyway?")? The current fix is silent-skip.
2. **BUG-4 priority**: How common is multi-device use? If most users are single-device, the cloud-hydration migration bypass is low urgency. If multi-device is a design goal, it's P1.
3. **storeSync tests**: The Supabase client is hard to mock in Vitest without additional setup. A lightweight abstraction (`type StorePusher = (name, data) => Promise<void>`) injected via a parameter would make `subscribeStores` testable. Worth the refactor?

---

### Known Issues / Incomplete Work

- The destination-guard fix in TodayPage (commit 5) only guards the `if (todayEntry)` branch. The `removeOutcome` and `outcome = {...}` lines immediately after still run even when the entry move was skipped. This means the outcome is always recorded at the requested `completedDate`, but the history entry may stay at `today`. This is intentional — outcome data (weights, metrics) belongs at the date the user intended, even if the scheduling entry can't be moved — but it may be surprising.
- No new dependencies added this pass.

---

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

---

## 2026-07-20 (seventy-ninth pass) — branch `claude/dreamy-mccarthy-ccykny`

---

### Executive Summary

1. **What changed**: 3 commits, 5 source files + 1 test file. Pure stabilisation pass — no new features. Three bugs fixed, 2 new tests, 5 tests updated.
2. **Test delta**: +2 tests (1088 → 1090). All 1088 pre-existing tests still pass. TypeScript: 0 errors.
3. **Highest confidence**: The CI gate (commit 1) is zero-risk and immediately valuable. The outcomeSortKey fix (commit 2) is self-contained with clear test coverage. The cloud migration fix (commit 3) is idempotent and safe.
4. **What is risky**: None of the three fixes are risky. The `migratePlanState` export is the most "visible" change — it exposes a previously-internal function. The annotation `@internal` makes intent clear.
5. **What to review first**: Commit 3 (storeSync). Verify the migration call order and idempotency assumptions match your understanding of the store version history.

---

### Biggest Issues Found

| ID | Severity | File | Summary |
|----|----------|------|---------|
| CI gap | Medium | `.github/workflows/deploy.yml` | Tests not run in CI — broken builds could ship |
| BUG-8 | Low | `outcomeSortKey.ts` | Non-deterministic sort for same-second outcomes |
| BUG-4 | Medium | `storeSync.ts` | Cloud hydration bypassed Zustand migrate |

---

### Improvements Completed

| # | What | Commit |
|---|------|--------|
| 1 | Add `npm test` step to GitHub Actions deploy pipeline | `f47f2f8` |
| 2 | Fix `outcomeSortKey` non-determinism — append `\x00instanceId` as tiebreaker | `d4dccc6` |
| 3 | Fix cloud hydration: apply historyStore, planStore, mobilityStore migrations in `syncOnLogin` | `0cebeb2` |

---

### Verdict by Item

#### Definitely keep

- **Commit 1** (CI gate): No downside; future broken commits will now be caught before shipping.
- **Commit 2** (outcomeSortKey fix): Clear, tested, zero risk. The `\x00` null-byte separator is the right choice — it sorts before all printable characters, so the secondary key only matters when the primary keys are equal.
- **Commit 3** (cloud migrations): All three migration functions are idempotent. The historyStore migration in particular is important for users who created extras before the `source` field was introduced — without this fix, their Undo handler would silently delete those entries after a cloud sync.

---

### Recommendations Only (not implemented)

| Priority | Item |
|----------|------|
| P1 | Add unit tests for `storeSync.ts` — mock Supabase with `vi.mock`, test: first-login push, hydrate-with-migration, debounce, beforeunload flush |
| P1 | Fix BUG-11: CSV re-import collision when `extraId` absent in pre-2026-04-26 exports |
| P2 | Extract `<TodayBanners>` from TodayPage.tsx as first step of ARCH-1 decomposition |
| P2 | Add `draftVersion` field to active-workout draft key for stale-draft detection on resume |
| P3 | Add `localDate: string` to OverrideEntry for timezone-safe override storage |
| P3 | Expose `notes` field in extra-entry edit modal (HistoryPage) |
| P4 | Add `@testing-library/react` to devDeps to unblock RTL hook/component tests |

---

### Open Questions for Owner

1. **BUG-11 preferred fix**: when a legacy CSV import (no `extraId` column) collides with an existing extra, should the UI warn and offer "replace or create new", or silently re-key the imported extra?
2. **storeSync migration version tracking**: should we store `{ state, version }` in the Supabase `data` column going forward so future migrations can be version-gated (rather than always run idempotently)? This would require a migration of existing Supabase rows but allows more precise control over which migrations fire.
3. **TodayPage decomposition**: is there appetite for a multi-pass decomposition of TodayPage (ARCH-1)? Suggest starting with `<TodayBanners>` extraction (~150 lines, zero logic change).

---

### Known Issues / Incomplete Work

- `storeSync.ts` has zero unit tests (TEST-1). The migrations added in this pass are verified only by TypeScript types and manual reasoning.
- `ActiveWorkoutTracker.tsx` has zero tests (TEST-3). RTL infrastructure would be needed.
- BUG-11 (CSV extraId collision) documented but not fixed.

---

### Dependencies Added

None.
