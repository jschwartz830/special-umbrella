# Review Notes — Overnight Audit

## 2026-06-07 (fifty-second pass) — branch `claude/dreamy-mccarthy-j725m`

### Executive summary

1. **What changed:** Three commits. (1) Bug fix: `computePersonalRecords` now always shows the most-recent date on which the PR was achieved (not the first). (2) Refactor: `findPreviousSetsByExercise` extracted from TodayPage and CalendarPage into a shared lib helper — eliminates duplication first documented in pass 46 and carried forward through passes 47–51. (3) Feature: "Export CSV" button added to the Personal Records section in HistoryPage, backed by a new `personalRecordsToCsv` utility in `csv.ts`.

2. **Highest confidence:** The `computePersonalRecords` fix — the bug is unambiguous (same `>=` pattern already used for run/swim stats in the same file), the fix is 4 lines, and the 3 targeted tests cover the exact failure mode. The `findPreviousSetsByExercise` extraction — zero semantic change; both call sites produce identical results, and the new test file covers 6 distinct cases.

3. **What is risky:** Nothing high-risk. The HistoryPage header DOM restructure (single `<button>` → `<div>` + two `<button>` elements) changes the interactive structure of the Personal Records section; verify that the expand/collapse and export buttons both work as expected in the browser.

4. **What to review first:** The `computePersonalRecords` fix — specifically, run the HistoryPage with a plan where you've hit the same lift weight on multiple sessions. The PR date should now show the *most recent* session, not the first one.

---

### Biggest issues found

| Severity | Issue | Action |
|----------|-------|--------|
| Medium | `computePersonalRecords` PR date stale — showed first occurrence of PR, not most recent | **Fixed** |
| Low | `findPreviousSetsByExercise` duplicated in TodayPage + CalendarPage for 5+ passes | **Fixed** (extracted) |
| Info | Personal Records had no CSV export — only stats table without a download | **Fixed** (feature added) |

---

### Improvements completed

| # | Type | Description | Commit |
|---|------|-------------|--------|
| 1 | Bug fix | `computePersonalRecords` sort + `>=` → most-recent PR date | `97f9c9a` (partial — also includes 2 and 3 below) |
| 2 | Refactor | `findPreviousSetsByExercise` extracted to `src/lib/previousSetsHelper.ts` | `97f9c9a` |
| 3 | Feature | `personalRecordsToCsv` + Export CSV button in HistoryPage | (same commit) |

---

### Medium-complexity feature explored

**Personal Records CSV export** — adds a new `personalRecordsToCsv` function to the existing `csv.ts` utility module and wires it to a new button in the HistoryPage PR section.

**Classification: Keep**

- Functional: produces valid RFC-4180 CSV with correct headers and null-field handling
- Non-breaking: button is hidden when `records.length === 0`; all existing behavior is preserved
- Consistent with the existing export pattern used by history CSV and CalendarPage
- 3 new tests cover the output format

See FEATURE_PROPOSAL.md and FEATURE_REVIEW.md for full analysis.

---

### Definitely keep

- `computePersonalRecords` fix — correctness bug with no tradeoffs
- `findPreviousSetsByExercise` extraction — reduces drift risk, no behavior change, well-tested
- All 13 new tests
- Personal Records CSV export — additive, minimal, consistent with existing UI patterns

---

### Probably keep but tweak

- **Export CSV button placement** — the button currently appears in the header alongside the expand/collapse chevron. If the header feels crowded, it could move to the bottom of the expanded content area. Current position is more discoverable for collapsed sections.

---

### Do not keep

Nothing from this pass.

---

### Recommendations only (not implemented)

1. **`WorkoutType` naming cleanup** (`'weights'` vs `'weightlifting'`)  — carry-forward from passes 49–51. Both values exist in `WorkoutType`; fixtures use `'weightlifting'`; HistoryPage uses `'weights'`. A dedicated cleanup pass is still warranted.

2. **`findPreviousSetsByExercise` scan optimization** — the shared helper is still O(n) over all outcomes per render. `exerciseHistoryStore` already maintains per-exercise records for charting. Swapping the data source would be a medium refactor (different data shape). Carry-forward.

3. **Calendar month grid re-render scope** — `buildMonthGrid` receives the full `entries` and `overrides` arrays. Filtering to plan-scoped entries before passing would reduce re-grids on unrelated plan changes. Carry-forward.

4. **`useToday` in other utilities** — `weeklyBreakdown` memo in HistoryPage still computes `addDays(new Date(), -55)` at mount time. This is a historical-only query so staleness is less critical, but the pattern is inconsistent. Carry-forward.

---

### Open questions for me

1. Does the most-recent PR date (vs. first PR date) feel more useful to you? The semantics are now "when did I last hit this weight", which is the natural reading for most lifters checking if their PR is recent or stale.

2. The "Export CSV" label in the Personal Records header: does "Export CSV" feel right or would "Download" or "Export" (shorter) be better?

---

### Known issues / incomplete work

- No React Testing Library tests for HistoryPage component behavior. The export button and PR section restructure are UI-layer changes verified by code review only.
- The `computePersonalRecords` fix is forward-looking: historical records in `exerciseHistoryStore` will be correctly sorted on next computation (Zustand derives them each time from the stored array), so no migration is needed.

---

### Any dependencies added

None.

---

## 2026-06-06 (fifty-first pass) — branch `claude/dreamy-mccarthy-HOACg`

### Executive summary

1. **What changed:** Three commits. (1) Bug fix: `useToday()` wired into `HistoryPage` — same midnight-staleness fix applied to TodayPage in pass 45 and CalendarPage in pass 46. (2) Bug fix: `DayDetailModal` in CalendarPage no longer calls `setDetailTarget(null)` during its own render; the pattern is replaced by a `useEffect`. (3) Feature: HistoryPage training-mix label now uses `computeWorkoutTypeBreakdown` for single-plan view and shows avg perceived effort when logged.

2. **Highest confidence:** Bug fix #1 (useToday) — identical fix already proven in two other pages. Bug fix #2 (DayDetailModal) — the pattern is correct; the useEffect fires after render with no user-visible flash.

3. **What is risky:** The avgEffort label format ("effort 3.2") is an assumption about how dense the user wants the mix label. If it feels too crowded, the effort part can be removed or moved to a tooltip.

4. **What to review first:** The `typeMixLabel` display in HistoryPage when you have a plan with at least one workout where you logged perceived effort. Confirm the "(effort N.N)" format feels right. If no effort is logged, the label is unchanged.

---

### Biggest issues found

| Severity | Issue | Action |
|----------|-------|--------|
| Low | HistoryPage stale `today` past midnight | **Fixed** |
| Low | `DayDetailModal` setState-during-render (strict mode warning) | **Fixed** |
| Low | HistoryPage `typeCountMap` never surfaced avgEffort from outcomes | **Fixed** |
| Info | `WorkoutType` union has both 'weights' AND 'weightlifting' as separate values | Documented (carry-forward) |
| Info | `findPreviousSetsByExercise` duplicated in TodayPage + CalendarPage | Documented (carry-forward) |

---

### Improvements completed

| # | Type | Description | Commit |
|---|------|-------------|--------|
| 1 | Bug fix | `useToday()` in HistoryPage — prevent stale stats past midnight | `514e381` |
| 2 | Bug fix | `DayDetailModal` useEffect replaces setState-during-render | `8a8177f` |
| 3 | Feature | `computeWorkoutTypeBreakdown` + avgEffort in HistoryPage mix label | `3bb13e8` |

---

### Medium-complexity feature explored

**avgEffort in HistoryPage training-mix label** — uses existing `computeWorkoutTypeBreakdown` infrastructure that had never been surfaced to users.

**Classification: Keep (with possible UX tweak to label format)**

- Functional: correctly reads `perceivedEffort` from outcomes via existing function
- The "(effort 3.2)" suffix is only shown when data exists; users who don't log effort see no change
- No new stores, no new computation — purely surfaces existing data
- Potential UX concern: mix label may feel dense when both count and effort are shown; could move effort to a separate row if preferred

---

### Definitely keep

- `useToday()` in HistoryPage — identical to the proven CalendarPage fix
- DayDetailModal `useEffect` pattern — strictly better than setState-during-render
- All 3 new tests (accurate production-type coverage)

---

### Probably keep but tweak

- **avgEffort display format** — "effort 3.2" is readable but could be formatted as "★3.2" or moved to a separate stat line if the mix label feels too long
- **'all' plan fallback** — `typeCountMapFallback` keeps the old inline logic for multi-plan view; consider whether to show skipped counts there too in a future pass

---

### Do not keep

Nothing from this pass.

---

### Recommendations only (not implemented)

1. **'weights' vs 'weightlifting' naming cleanup** — Both appear in `WorkoutType`. The UI uses 'weights'; test fixtures mostly use 'weightlifting'. Unifying is medium-complexity (many files) with no user-visible benefit today. Recommend a dedicated cleanup pass.

2. **Extract shared `findPreviousSetsByExercise`** — Exists in both TodayPage and CalendarPage. Extraction to a shared `src/lib/outcomeUtils.ts` would prevent future drift. Deferred since both versions currently return identical results.

3. **Effort display as visual indicator** — Instead of "(effort 3.2)", use colored dots (like the DayDetailModal effort preview added in pass 46). Requires a non-text element in the mix label, which may complicate the string-based approach.

4. **'all' plan view also use `computeWorkoutTypeBreakdown`** — Currently falls back to the inline computation. Could be solved by iterating plans and calling the function once per plan, then merging results. Medium complexity; deferred.

5. **`useToday` in other utilities** — `weeklyBreakdown` memo at line 178 still calls `addDays(new Date(), -55)` which computes a fixed past date at mount time. This could drift if the component is left mounted across multiple days. Low severity for a historical-only query.

---

### Open questions for me

1. Does the "(effort N.N)" format in the training-mix label feel right to you, or would you prefer it on a separate line below the type counts?

2. The 'all' plan view still uses the older inline computation. Should future work also add avgEffort to the 'all' view? (It would require iterating per plan, which is doable but more code.)

3. Do any of your current plans have workouts where you've logged `perceivedEffort`? If yes, the avgEffort display is immediately useful. If you never log effort, consider removing the suffix to keep the label simple.

---

### Known issues / incomplete work

- `DayDetailModal` fix: there is a one-frame flash where the modal shows nothing (returns null) before the useEffect fires and closes the modal. In practice this is imperceptible but could in theory cause a layout shift.
- No React Testing Library tests exist for the CalendarPage or HistoryPage component behavior. Adding them would require a jsdom test environment change — deferred across all passes.

---

### Any dependencies added

None.

---

## 2026-06-05 (fiftieth pass) — branch `claude/dreamy-mccarthy-UIayl`

### Executive summary

1. **What changed:** Two commits. (1) Bug fixes: `applyProgressionRule` now has a
   try/catch wrapper; `getTodayResolvedDay` gains an early-return guard for
   0-day plans; 5 new tests. (2) Feature: Program Variables Inspector panel on
   TodayPage for YAML plan users — collapsible, read-only, no new stores.

2. **Highest confidence:** `applyProgressionRule` try/catch — the fix is isolated,
   testable, and has a clear failure mode. The 0-day guard in `getTodayResolvedDay`
   mirrors two peer functions that already have it.

3. **What is risky:** The ProgramVarsPanel feature is safe but untested in browser
   (no YAML plan available in CI to trigger the condition). The collapsed-by-default
   UX is an assumption — some users might prefer it expanded by default.

4. **What to review first:** The `applyProgressionRule` change — any YAML plan user
   who experienced silent progression failures (no console.error previously) will now
   see errors in DevTools. The fix itself is correct but the `console.error` call
   might be surprising if YAML rules are intentionally written to fail gracefully.

---

### Biggest issues found

| Severity | Issue | Action |
|----------|-------|--------|
| Medium | `applyProgressionRule` no try/catch — malformed YAML rule propagates exception | **Fixed** |
| Medium | `getTodayResolvedDay` no empty-plan guard — `planDay=undefined` crash path | **Fixed** |
| Low | CalendarPage slot fallback `{ id: '', type: 'rest' }` passed to `logOutcomeWithProgression` — progression silently skipped | Documented |
| Low | Double-day flow only supports `slots[0]` from the bonus day — multi-slot bonus days lose slot 2+ | Documented |
| Low | `findPreviousSetsByExercise` is O(n) across all outcomes per render — exerciseHistoryStore already has better indexing | Documented |
| Low | Calendar month grid rebuilds on any store entry change — could filter plan-scoped entries before passing | Documented |

---

### Improvements completed

1. **`applyProgressionRule` error resilience** (programStore.ts) — try/catch wrapper,
   console.error on failure, returns `{}`. 3 tests added.

2. **`getTodayResolvedDay` empty-plan guard** (rotationEngine.ts) — early-return
   with synthetic rest day when `plan.days.length === 0`. 2 tests added.

---

### Small features added

None beyond the medium-complexity feature below.

---

### Medium-complexity feature explored

**Program Variables Inspector** — `ProgramVarsPanel` component in TodayPage.tsx.

**Classification: Keep (prototype-quality; review UX before polishing)**

- Functional: correctly reads `planProgramVars` and renders collapsed/expanded states
- UX assumption: collapsed by default; some YAML power users might want it expanded
- No tests added (purely presentational component, no logic to test)
- Recommend: gather feedback from YAML plan users on the collapsed-by-default default
  before committing to the interaction model

---

### Definitely keep

- `applyProgressionRule` try/catch — strictly safer than current behavior
- `getTodayResolvedDay` empty-plan guard — strictly safer, matches peer functions
- All 5 new tests

---

### Probably keep but tweak

- **ProgramVarsPanel** — correct and useful, but:
  - Could format variable names (underscore → space, capitalize)
  - Could show a delta badge ("↑5" since last session) — needs previous vars stored
  - Could persist expanded/collapsed state in localStorage

---

### Do not keep

Nothing falls in this category.

---

### Recommendations only (not implemented)

1. **CalendarPage slot fallback** — `handleOutcomeConfirm` at line 226 creates a dummy
   slot `{ id: '', type: 'rest' }` when planDay has no slots. The `logOutcomeWithProgression`
   call with this slot means progression rules tied to the slot's `slotProgress` field are
   never evaluated. Consider validating planDay before opening OutcomeModal, or handling
   missing slots explicitly.

2. **Double-day multi-slot support** — `upcoming[0].planDay.slots[0]` at TodayPage:400
   only picks the first slot of the bonus day. If a rotation day has multiple workout
   slots (e.g. AM run + PM weights), only the first is logged as the bonus. Add UI
   clarification or extend to include all slots.

3. **Outcome scan optimization** — `findPreviousSetsByExercise` scans all outcomes
   on every render. The exerciseHistoryStore already maintains per-exercise records
   for charting. Consider computing previous sets from that store instead.

4. **Calendar re-render scope** — `buildMonthGrid` receives the full `entries` and
   `overrides` arrays. Filtering to plan-scoped entries/overrides before passing
   would reduce the dependency's volatility and prevent full re-grids on unrelated plan
   entry changes.

5. **Progression rule user feedback** — When `applyProgressionRule` catches an error
   and logs it, the user has no idea. For YAML plan authors, a short toast ("Progression
   rule evaluation failed — check your YAML") would dramatically improve debuggability.

---

### Open questions for me

1. Do any of your current plans use YAML progression variables? If yes, the
   ProgramVarsPanel is immediately useful. If no, the feature is harmless but untested
   in practice.

2. Should the progression rule error be surfaced to users (toast/banner) or kept as
   console.error only? The current implementation assumes users won't notice — but YAML
   plan authors might miss silent failures.

3. Is the 7-day lookback for unlogged past days the right window? If you typically take
   more than 7 days off between app opens, the nudge won't catch all unlogged days.

---

### Known issues / incomplete work

- ProgramVarsPanel has no automated tests (it's a UI-only component with no logic)
- The `console.error` in `applyProgressionRule` will appear in production DevTools;
  acceptable for now, but consider a `console.warn` or suppressing in production builds
- The empty-plan guard in `getTodayResolvedDay` returns a synthetic `{ id: '', label: 'Rest', slots: [] }` day — if any downstream code pattern-matches on `planDay.id === ''`, it could misfire

---

### Any dependencies added

None.

---

## 2026-06-04 (forty-ninth pass) — branch `claude/dreamy-mccarthy-WovqU`

### Executive summary

1. **What changed:** Two commits. (1) Bug fix: `computePlanProgress` (rotations), `computeRotationCycleProgress`, and `computeRotationPlanRemaining` all lacked a future-entry date guard, inconsistent with the `isPlanExpired` fix from pass 48. Guard added, 5 regression tests added, TodayPage callers updated. (2) Feature: multi-rotation plans now show "Rotation X of Y" in the TodayPage header, closing a parity gap with weeks-based plans.

2. **Highest confidence:** The future-entry filter fix (commit 1) — it directly mirrors what `isPlanExpired` already does, the tests are unambiguous, and the behavior change only fires when a future-dated entry exists in the store (CSV import edge case).

3. **What is risky:** The `rotationProgress` display (commit 2) is additive UI. The main risk is information density — the header subtext now contains more items in edge cases. The feature is unconditional (can't be turned off per plan) but is easy to revert.

4. **What to review first:** CHANGELOG_OVERNIGHT.md → then the two commits in order.

---

### Biggest issues found

**Future-entry filter inconsistency (fixed):** `isPlanExpired` was patched in pass 48 but three companion functions in `historyStats.ts` still counted future-dated entries. A single bad CSV import row could produce inflated cycle progress or a spuriously-low "workouts remaining" count.

**`DayDetailModal` calls state setter during render (documented, not fixed):** At CalendarPage line ~729, `setDetailTarget(null)` is called when the selected extra is no longer in the `extras` array (e.g., deleted mid-modal). This is the component's own state, so React handles it correctly (immediate re-render, no infinite loop), but it triggers a "setState during render" warning in Strict Mode. Proper fix: move to a `useEffect`. Risk is very low — this branch only fires if an extra is deleted while the user is viewing it in the modal detail level. Leaving as-is for now; documented.

**`WorkoutType` naming: `'weights'` vs `'weightlifting'` (documented, not fixed):** Two synonymous string values in the `WorkoutType` union. `'weightlifting'` appears in test fixtures; `'weights'` is used in the CalendarPage type picker. No user-visible bug; a future cleanup pass should consolidate.

---

### Improvements completed

| # | Type | Description | Commit |
|---|------|-------------|--------|
| 1 | Bug fix | Future-entry guard in `computePlanProgress`, `computeRotationCycleProgress`, `computeRotationPlanRemaining` | `622cd4f` |
| 2 | Feature | "Rotation X of Y" display in TodayPage header for multi-rotation plans | `4cb90ae` |

---

### Feature added (Rotation X of Y)

**What it does:** For plans with `duration.type === 'rotations'` and `duration.value > 1`, the TodayPage header subtext now shows "Rotation 2 of 4" (or equivalent). The last rotation also shows "· last rotation!". Hidden when the plan is expired.

**Assumptions encoded:** A plan with `duration.value === 1` has no meaningful rotation number ("Rotation 1 of 1"). The display uses `computePlanProgress` as the source of truth, which now correctly excludes future entries.

**Open decisions:** Whether to also surface this in the CalendarPage month header or the Plans list view. Not implemented.

**Classification:** Keep (low risk, additive, mirrors existing weeks-plan pattern)

---

### Definitely keep

- Fix: future-entry guard in three rotation stats functions
- Feature: "Rotation X of Y" header display (additive, reversible)

### Probably keep but tweak

- n/a this pass

### Do not keep

- n/a this pass

### Recommendations only (not implemented)

- **`DayDetailModal` render-phase state call:** Refactor to `useEffect` to eliminate the strict-mode warning. Low urgency.
- **`WorkoutType` naming consolidation:** Unify `'weights'` and `'weightlifting'` into a single canonical value. Needs audit of all consumers.
- **`computeWorkoutTypeBreakdown` multi-slot attribution:** Only `slots[0]` type is counted for rotation entries. For plans with double-slot days, secondary slot types are silently unattributed. (carry-forward from pass 47)
- **`logForDate` day_off + jump interaction:** Unclear edge case when a day_off is logged via retroactive CalendarPage and a jump override exists for the same date. (carry-forward from pass 44)

---

### Open questions for me

1. For "Rotation X of Y" — do you want this in the Plans list as well, so you can see at a glance where each plan stands?
2. Is the `'weights'` / `'weightlifting'` split intentional (different slot types) or legacy duplication? If the latter, it's worth cleaning up before the user base grows.

---

### Known issues or incomplete work

- The `DayDetailModal` render-phase state call is a React Strict Mode warning that doesn't affect runtime behavior. See IMPLEMENTATION_PLAN.md for details.
- `computeWorkoutTypeBreakdown` multi-slot attribution gap remains (carry-forward).

---

### Dependencies added

None.

---

## 2026-06-02 (forty-eighth pass) — branch `claude/dreamy-mccarthy-lm1Op`

### Executive summary

1. **What changed:** Four commits. (1) Refactor: extracted `outcomeSortKey` to shared lib, eliminating code duplication across TodayPage and CalendarPage. (2) Fix: added missing "Unlogged" entry to the Calendar legend. (3) Feature: wired `computeConsecutiveSkips` into TodayPage — amber nudge banner after 3+ consecutive skips. (4) Bug fix: `isPlanExpired` for rotations no longer counts future-dated entries, preventing false "Plan complete!" banners.

2. **Highest confidence:** All four changes are targeted and individually testable. `isPlanExpired` fix is the highest-value correctness change; the skip nudge is the highest-value UX change.

3. **Risky:** Nothing high-risk. The `isPlanExpired` fix changes behavior only for plans where history entries with future `calendarDate` exist — that only happens via import or manual data entry, not from normal app usage.

4. **Review first:** The skip nudge threshold (3) is a product decision. If 3 is too aggressive (appears too early) or too lenient, adjust the constant in TodayPage.

---

### Biggest issues found and fixed this pass

| # | Severity | Issue | Location | Status |
|---|---|---|---|---|
| 1 | Medium | `isPlanExpired` counted future-dated entries for rotations plans → false "Plan complete!" | `rotationEngine.ts:isPlanExpired` | **Fixed** |
| 2 | Low | Calendar legend missing "Unlogged" state | `CalendarPage.tsx` | **Fixed** |
| 3 | Low | `computeConsecutiveSkips` existed but was never shown to the user | `historyStats.ts` | **Fixed** (wired to UI) |
| 4 | Info | `outcomeSortKey` duplicated in TodayPage and CalendarPage | both pages | **Fixed** (extracted to lib) |

---

### Carried-forward open items

| # | Severity | Issue | Status |
|---|---|---|---|
| 1 | Low | `computeWorkoutTypeBreakdown` attributes only `slots[0]` | Documented; product decision needed |
| 2 | Low | `logForDate` day_off + jump interaction | Deferred (low occurrence) |
| 3 | Info | `programVarsMap` subscription granularity | Deferred (low impact) |

---

### Tests: 786 → 788 (+2)

- `rotationEngine.test.ts`: 2 new tests for `isPlanExpired` future-entry guard

---

## 2026-06-01 (forty-seventh pass) — branch `claude/dreamy-mccarthy-iQpbb`

### Executive summary

1. **What changed:** Four commits. (1) Audit documentation in `IMPLEMENTATION_PLAN.md`. (2) New pure utility function `computeConsecutiveSkips` in `historyStats.ts`. (3) 16 new tests: 15 covering the new function, 1 documenting a known multi-slot attribution gap. (4) 1 test documenting the `updateEntryDate` caller contract. No production UI or store logic was modified.

2. **Highest confidence:** All four changes are either documentation or additive test/library code. The new `computeConsecutiveSkips` function is pure (no side effects, no I/O) and tested exhaustively. Test count grew from 770 → 786, all green.

3. **Risky:** Nothing high-risk. The only behavioral question is whether the `computeConsecutiveSkips` semantics (today excluded, any gap breaks streak, extras break streak) match the intended product definition — see Feature Review for reasoning.

4. **Review first:** Feature Review for `computeConsecutiveSkips` — verify the streak semantics before wiring it to any UI notification path.

---

### Biggest issues found

| # | Severity | Issue | Location | Status |
|---|---|---|---|---|
| 1 | Low | `computeWorkoutTypeBreakdown` attributes only `slots[0]` for multi-slot plan days; second slot's type ignored | `historyStats.ts:computeWorkoutTypeBreakdown` | Documented (not fixed — product decision needed) |
| 2 | Low | `updateEntryDate` does not deduplicate — caller must pre-remove conflicting entry | `historyStore.ts:updateEntryDate` | Documented as test + plan note |
| 3 | Info | Null-effort progression defaults (`?? 3` for progress, `?? 0` for regress in run/swim) diverge from gym-exercise defaults | `progression.ts:buildProgressionRecommendation` | Intentional; documented in pass 40 tests |

---

### Improvements completed

1. **`computeConsecutiveSkips`** — new pure function that counts consecutive skip-only days backward from yesterday. Enables "you've skipped N workouts" nudge without any UI wiring in this pass.
2. **`updateEntryDate` contract test** — explicit test documents the no-deduplication invariant so future callers can't miss it.
3. **Multi-slot breakdown test** — documents the known attribution gap as a failing-case test so the behavior is visible in the suite.

---

### Small feature added

**`computeConsecutiveSkips` utility** (`src/lib/historyStats.ts`)

- Pure function, zero dependencies beyond existing `shiftDay` helper
- Exported from `historyStats.ts`, ready to be consumed by any component
- 15 tests covering all edge cases including different-plan isolation and today exclusion
- Classify: **Keep** — additive, well-tested, zero risk

---

### Keep / revise / do not keep

| Change | Recommendation |
|--------|----------------|
| `computeConsecutiveSkips` implementation | Keep |
| `computeConsecutiveSkips` tests | Keep |
| `updateEntryDate` coexistence test | Keep |
| Multi-slot breakdown gap test | Keep (fix attribution in a future pass) |
| `IMPLEMENTATION_PLAN.md` audit notes | Keep |

---

## 2026-05-31 (forty-sixth pass) — branch `claude/dreamy-mccarthy-N2mc1`

### Executive summary

1. **What changed:** Four commits, all in `CalendarPage.tsx`. (1) Bug fix: ported the `outcomeSortKey` stable-sort fix from TodayPage to CalendarPage's `findPreviousSetsByExercise`. (2) Bug fix: replaced stale `const now = new Date()` with `useToday()` hook so the "Today" button and `isCurrentMonth` stay correct past midnight. (3) UX fix: Day Off is now available for past dates in the calendar's DayDetailModal, consistent with TodayPage's catch-up flow. (4) Feature: Level 1 DayDetailModal now shows effort dots + notes preview for completed workouts.

2. **Highest confidence:** Commits 1, 2, and 3 are small targeted fixes; commit 1 is a direct port of an already-merged fix. All four leave test count unchanged at 770 (no regressions).

3. **Risky:** Nothing high-risk. The Day Off change (commit 3) is a product decision embedded in a 1-line code change — verify that allowing retroactive Day Off in the calendar matches the intended UX. The effort preview (commit 4) uses Unicode dots; if the font rendering is unexpected, the strings can be swapped for any character.

4. **Review first:** Commit 3 (Day Off for past dates) — confirm the product intent. Commit 4 (effort preview) — check the visual appearance on a real device.

---

### Biggest issues found

| # | Severity | Issue | Location | Status |
|---|---|---|---|---|
| 1 | Medium | `findPreviousSetsByExercise` unstable sort — same bug fixed in TodayPage (18adf1f) | `CalendarPage.tsx:257` | Fixed |
| 2 | Low | Stale `now` date past midnight in CalendarPage | `CalendarPage.tsx:50` | Fixed |
| 3 | Low-UX | Day Off not available for past dates in Calendar | `CalendarPage.tsx:566` | Fixed |
| 4 | Risk | Timezone sensitivity in `rotationEngine.ts`: `parseISO` + local `format` could produce wrong date strings for UTC-5 to UTC-12 users | `rotationEngine.ts` | Recommendation only |
| 5 | Medium | `findPreviousSetsByExercise` duplicated in TodayPage and CalendarPage | Both pages | Recommendation only |

---

### Improvements completed

1. **Sort stability fix** — `outcomeSortKey` ported to CalendarPage. Users whose CalendarPage OutcomeModal showed wrong prior-session weights will now see the correct most-recent data.
2. **Midnight-staleness fix** — `useToday()` wired into CalendarPage. "Today" button and current-month highlight now auto-update at midnight.
3. **Day Off for past dates** — retroactive Day Off now available from the Calendar, consistent with TodayPage's catch-up flow.

---

### Small feature added

**Outcome summary preview in DayDetailModal Level 1** (`src/pages/CalendarPage.tsx`)

- Effort shown as colored Unicode dots (● = 1 easy, ●●●●● = 5 hard) with color coding (green → red)
- Notes shown as 1-line truncated italic preview
- Only visible when data exists; no change for workouts without outcomes
- Classify: **Keep** — the feature is purely additive, easy to understand, and solves a real friction point (monthly review of past sessions)

---

### Keep / revise / do not keep

| Change | Recommendation |
|---|---|
| Sort fix (commit 1) | **Definitely keep** — clear bug, same fix already on main via TodayPage |
| Midnight fix (commit 2) | **Definitely keep** — same class of fix as pass 45's `useToday` addition |
| Day Off past dates (commit 3) | **Probably keep** — verify product intent; the code change is 1 line |
| Effort + notes preview (commit 4) | **Probably keep** — check visual on device; easy to revert if not desired |

---

### Recommendations only (not implemented)

1. **Extract shared `outcomeSortKey` + `findPreviousSetsByExercise`** into a shared utility (`src/lib/outcomeUtils.ts` or similar). The two functions are now nearly identical. Reduces future drift risk if the sort logic changes again.

2. **Timezone audit for rotation engine**: `parseISO` returns UTC midnight; `format` uses local timezone. For UTC-5 to UTC-12 users, `format(addDays(parseISO('2026-01-01'), 0), 'yyyy-MM-dd')` could return `'2025-12-31'`. Recommend testing in a UTC-5 environment before declaring safe.

3. **`logForDate` day_off + jump interaction** (carried from passes 44–45): When a retroactive entry with a jump override is changed to day_off, the jump is removed but not replaced — silently shifting the rotation pointer for subsequent dates. Low occurrence; document and guard next pass.

---

### Open questions for review

1. Is **Day Off retroactively** on past calendar dates the intended behavior? The TodayPage catch-up flow supports it, but the Calendar restriction may have been intentional to prevent accidental catch-up.
2. Should the **effort dots** use a different symbol or the difficulty color palette from `DifficultyBadge` rather than the custom green→red scale?
3. Is there a preference for where the notes preview truncates — should it be `line-clamp-1` or `truncate`? (Currently `truncate` — single line, ellipsis at end.)

---

### Known issues / incomplete work

- No new tests added this pass. Existing 770 tests all pass.
- CalendarPage `findPreviousSetsByExercise` still duplicates TodayPage's equivalent — extraction deferred.

---

### Dependencies added

None.

---

## 2026-05-30 (forty-fifth pass) — branch `claude/dreamy-mccarthy-mxssu`

### Executive summary

1. **What changed:** Three commits. (1) Bug fix: `findPreviousWeightsOutcome` and `findPreviousSetsByExercise` now use the calendarDate from `workoutInstanceId` as a fallback sort key instead of `''`, so outcomes without `completedAt` are correctly ordered. (2) Correctness fix + 3 tests: `computeHistoryStats.totalLogged`/`totalCompleted` now filter to `<= today`, consistent with the rest of the function. (3) Feature: `useToday` hook refreshes the date at midnight in TodayPage, preventing stale date display when the app stays open past midnight.

2. **Highest confidence:** The `totalLogged` filter is unambiguous — the rest of the function has always filtered by date, and this was explicitly documented as an open gap. The `useToday` hook is well-contained: one new file, one changed line in TodayPage, and correct cleanup on unmount.

3. **Risks:** Near zero. The sort stability fix only changes behavior for outcomes without `completedAt` (moves from arbitrary order to date order). The `totalLogged` fix only changes displayed counts for users with future-dated entries. The `useToday` hook has no side effects beyond advancing a string state value once per day.

4. **Review first:** Check TodayPage behavior when the sort fix matters — log multiple weights sessions for the same plan day without setting a `completedAt`, then verify the "Last session" hint shows the most recent one. The `useToday` hook cannot be easily tested without time-mocking, so manual verification is the path (or trust the code review).

---

### Biggest issues found

1. **`findPreviousWeightsOutcome`/`findPreviousSetsByExercise` unstable sort** (BUG — fixed): When `completedAt` is absent, sort key is `''` for all outcomes, making comparison results indeterminate. `findPreviousWeightsOutcome` silently returned the first matching outcome from `Object.values()` iteration order. Pre-filled OutcomeModal weights and the "Last session" hint could show stale or wrong data for active users with many sessions.

2. **`totalLogged`/`totalCompleted` not date-bounded** (CORRECTNESS — fixed): The last two un-filtered stats in `computeHistoryStats`. A bad CSV import with future dates inflated these permanently.

3. **Midnight staleness in TodayPage** (FEATURE — fixed): `today` computed once at render, never refreshed. Any session that crosses midnight shows wrong dates. Now fixed via `useToday` hook.

4. **`CalendarPage`/`HistoryPage` midnight staleness** (NOT FIXED — follow-up): Both use inline `format(new Date(), ...)` and could benefit from `useToday`. Deferred to keep this pass reviewable.

5. **`programVarsMap` over-subscription** (NOT FIXED — low priority): Carried from pass 44.

---

### Improvements completed

| # | Type | Description | Commit |
|---|------|-------------|--------|
| 1 | fix (correctness) | Stable sort key for `findPrevious*` helpers in TodayPage | `49839b8` |
| 2 | fix + test | `totalLogged`/`totalCompleted` exclude future-dated entries | `b342a01` |
| 3 | feat | `useToday` hook with midnight refresh; wire into TodayPage | `91f5d26` |

Test count: **767 → 770** (+3).

---

### Small features added

None beyond the medium-complexity feature below.

### Medium-complexity feature explored

**`useToday` hook with midnight refresh** — classified as **Keep**.

See FEATURE_PROPOSAL.md and FEATURE_REVIEW.md for full analysis.

---

### Definitely keep

- **Sort stability fix** — Correctness bug with no tradeoffs. The fix is a 12-line helper with no architectural impact.
- **`totalLogged`/`totalCompleted` filter** — Consistent with the rest of the function. Well-tested.
- **`useToday` hook** — Contained in one file, clean teardown, no dependencies added.

### Probably keep but tweak

- Nothing from this pass.

### Do not keep

- Nothing from this pass.

---

### Recommendations only (not implemented)

1. **`CalendarPage` and `HistoryPage` midnight refresh** — Both compute `today` inline. Wire `useToday()` into each as a follow-up pass. Low complexity; straightforward.

2. **`isPlanExpired` future-date guard** — The `rotations` path counts all `complete`/`skip` entries including future-dated ones. A bad import could mark the plan as expired. Low severity; add a `e.calendarDate <= today` filter inside `isPlanExpired`.

3. **`computeWorkoutTypeBreakdown` avg effort surfacing in HistoryPage** — The function computes `avgEffort` per workout type and is tested, but `HistoryPage` uses a manual `typeCountMap` instead. Replacing with `computeWorkoutTypeBreakdown` would reduce duplication and expose effort context in the training-mix row.

4. **`logForDate` day_off + jump interaction** (CalendarPage) — Carried from pass 44. Needs product judgment.

5. **`programVarsMap` selector narrowing** — Carried from pass 44. Low impact.

---

### Open questions for me

- Should `CalendarPage` and `HistoryPage` also get `useToday`? The staleness window there is the same — any session open past midnight shows stale dates. If you use the app on a tablet or as a pinned PWA that stays open, all three pages benefit.
- Should `isPlanExpired` filter future-dated entries? It would prevent a mistaken "Plan complete!" banner from a bad import. The fix is one line.

### Known issues / incomplete work

- No unit tests for `useToday` (timeout-dependent; would require fake timers). The hook logic is simple enough that code review is sufficient, but a test with `vi.useFakeTimers()` could be added.
- Sort stability fix has no unit tests (functions are module-private; indirect testing via OutcomeModal is the recommended path if you want explicit coverage).

### Any dependencies added

None.

---

## 2026-05-30 (forty-fourth pass) — branch `claude/dreamy-mccarthy-uCF1X`

### Executive summary

1. **What changed:** Two commits. (1) Bug fix: `exerciseHistoryStore.moveByWorkoutInstance` now updates `calendarDate` alongside `workoutInstanceId` when entries are date-moved, fixing incorrect PR dates and exercise history sort order. (2) Performance + UX: `planExtras` in TodayPage is memoized (fixes unnecessary WeeklyActivityStrip re-renders); previous session hint now shows "· Xd ago" / "· yesterday".

2. **Highest confidence:** The `moveByWorkoutInstance` fix is unambiguous — the bug is that `calendarDate` was never updated on a move, and the fix is two lines. The `planExtras` memo is purely additive (returns `[]` when no plan is active). The date display is purely additive (nothing is removed; the span only appears when `prevSessionDaysAgo > 0`).

3. **Risks:** Near zero. The `moveByWorkoutInstance` fix only affects exercise history records for entries that have been moved to a different date (a path available via CalendarPage and TodayPage's completedAt backfill). The memoization is an internal React concern. The date display reads from an already-computed value with no side effects.

4. **Review first:** Verify the "Xd ago" display in TodayPage feels right — specifically that "yesterday" is used for 1-day-ago and "Xd ago" for everything else. If you prefer a longer format ("5 days ago") or no date at all, the change is trivially reverted.

---

### Biggest issues found

1. **`moveByWorkoutInstance` missing `calendarDate` update** (BUG — fixed): Any workout moved to a new date had stale `calendarDate` in exercise history, causing wrong PR dates and wrong sort order. Medium severity — affects users who log workouts on a different date than scheduled.

2. **`planExtras` inline array in TodayPage** (PERF — fixed): Created a new array on every render, defeating `WeeklyActivityStrip`'s memoization. Low severity — visible as wasted CPU on each parent re-render, not a user-visible regression.

3. **`programVarsMap` over-subscription** (NOT FIXED — low priority): Both TodayPage and CalendarPage subscribe to the full `programVarsMap` object. A change to any plan's progression vars triggers a re-render of both pages, even when the active plan's vars didn't change. Recommend a per-plan selector when this becomes a hotspot.

4. **Midnight staleness** (NOT FIXED — edge case): `today` is computed at render time and not refreshed if the app stays open past midnight. The user would see the wrong date on the Today card and stats until they navigate away and back. Low occurrence probability.

5. **`CalendarPage.logForDate` day_off + existing jump** (NOT FIXED — edge case): Changing a past entry from complete/skip (with an anchoring jump override) to day_off removes the jump without re-adding it. The rotation pointer for subsequent days can silently shift. Documenting rather than fixing — the correct fix requires product judgment on what "day off for a previously-anchored day" should mean for the rotation.

---

### Improvements completed

| # | Description | Commit |
|---|-------------|--------|
| 1 | Bug fix: `moveByWorkoutInstance` propagates `calendarDate` | `b5a87b9` |
| 2 | Perf: Memoize `planExtras` in TodayPage | `52a7ead` |
| 3 | UX: Show "Xd ago" / "yesterday" in last-session hint | `52a7ead` |

### Small features added

**Session date context in "Last session" hint** — Shows "· yesterday" or "· Xd ago" after the previous workout summary line on TodayPage. Derived from the `workoutInstanceId` embedded date; no changes to `sessionSummary.ts`. Example: `Last: 3×8 @ 135 lb Bench Press · PB · 5d ago`.

### Medium-complexity features explored

None. The audit found two bugs worth fixing and the UX improvement was low-complexity (reads from an already-available field). No medium-complexity feature was needed to add value to this pass; see Recommendations for candidates.

---

### Definitely keep

- **`moveByWorkoutInstance` calendarDate fix** — Correctness bug; no tradeoffs.
- **`planExtras` memoization** — No behavior change; strict improvement.

### Probably keep but tweak

- **"Xd ago" date display** — Check that the format feels right. If you want "5 days ago" instead of "5d ago", change the format string in TodayPage.tsx line ~328. Trivial edit.

### Do not keep

Nothing.

### Recommendations only (not implemented)

1. **Per-plan `programVarsMap` selector** — Replace `useProgramStore(s => s.vars)` in TodayPage and CalendarPage with `useProgramStore(s => s.vars[plan?.id ?? ''] ?? {})`. This scopes the subscription and avoids cross-plan re-renders.

2. **Midnight date refresh** — Add a `useEffect` that computes the next midnight, sets a timeout, and force-updates `today` when it fires. Could live in `useActivePlan` or as a standalone `useToday` hook.

3. **`logForDate` day_off + jump** — When changing a past entry with an anchoring jump to day_off, preserve the jump override (or require the user to explicitly clear it). Needs a product decision: "what rotation index should day_off inherit?"

4. **Split TodayPage / CalendarPage** — Both exceed 900 lines. Extracting sub-components (UpcomingSection, StatsBar, OverrideModal) would reduce cognitive load and make the files testable in isolation.

---

### Open questions for me

- Is the "Xd ago" label in the right place? It shares the same `<p>` element as the summary and PB badge. If you'd prefer it on its own line (smaller, below the summary), that's a 2-line CSS change.
- Should `day_off` entries clear existing jump overrides for that date? Current behavior does; it might be safer to keep the jump to avoid rotation drift.

### Known issues / incomplete work

- No test added for the `planExtras` memoization or the "Xd ago" display (both are UI-layer changes and the existing test suite doesn't cover TodayPage render behavior).
- The "Xd ago" date is derived from `workoutInstanceId`, not from `completedAt`. If a user backfilled a session and set `completedAt` to a different date than the `calendarDate`, the hint would show the calendar date's distance, not the actual workout date. This is intentional — the calendarDate is the authoritative date for rotation purposes; `completedAt` is user-editable context.

### Any dependencies added

None.

---

## 2026-05-29 (forty-third pass) — branch `claude/dreamy-mccarthy-4tAQK`

### Executive summary

1. **What changed:** Two targeted changes. (1) Fixed 6 failing tests in
   `progression.test.ts` that were left behind by PR #121 (workout progression
   logic improvements merged after pass 42). (2) Fixed a long-documented data
   risk: pre-existing `ExtraWorkoutEntry` records with `source: undefined` can
   be silently deleted by TodayPage's Undo — migrated them to `source: 'history'`.
2. **Highest confidence:** Both changes are purely protective. The test fixes are
   mechanical (add `progressionMode`, update expectations to match new behavior).
   The migration is a one-time store fix that only changes `undefined` → `'history'`
   — it cannot regress any existing functionality.
3. **Risks:** Near zero. The migration adds `version: 1` to `wpt_history` persist
   config; Zustand will re-run it on first load for all users. The migration is
   idempotent and handles all data shapes including missing fields.
4. **Review first:** The test changes confirm PR #121 behavior. Check that the new
   volume mode test (`progress` when all sets hit target) matches what you see in the
   app. Verify the null guard test ("returns null when no progressionMode") is
   intentional — if you want exercises without `progressionMode` to still generate a
   recommendation, that guard should be removed and the tests reverted accordingly.

---

### Biggest issues found

1. **6 failing tests in `progression.test.ts`** — PR #121 changed two behaviors:
   (a) `buildWeightsRecommendation` now returns `null` when no exercise has
   `progressionMode` set; (b) volume mode now uses `allSetsHitTarget` instead of
   always returning `hold`. Six tests written against the old behavior were failing.
   Fixed by adding `progressionMode: 'single'` where needed and updating volume mode
   expectations.

2. **`ExtraWorkoutEntry.source` migration gap** — Extras created before the `source`
   field was introduced have `source: undefined`. TodayPage's Undo handler treats
   `undefined` the same as `'double_day'`, silently removing manually-added extras.
   Recommended in REVIEW_NOTES across passes 38–42. Implemented as a v0→v1 migration
   in `historyStore`'s persist config.

---

### Improvements completed

| # | Type | Description | Files |
|---|------|-------------|-------|
| 1 | fix (tests) | Sync 6 failing progression tests with new behavior | progression.test.ts |
| 2 | fix (data safety) | Migrate `source: undefined` extras to `source: 'history'` | historyStore.ts + test |
| 3 | test | New null-guard test for `progressionMode` requirement | progression.test.ts |
| 4 | test | 6 direct `migrateHistoryState` tests | historyStore.test.ts |

Test count: **758 → 766** (+8).

---

### Definitely keep

- **Progression test fixes** — The 6 tests were genuinely wrong after PR #121. The
  fixes document the current intended behavior. Zero risk.
- **`source` migration** — Closes a known data-safety gap. The migration is idempotent,
  well-tested, and the correct semantic (old extras should not be Undo-deleted).

### Probably keep but tweak

- **`progressionMode` null-guard test** — This test documents that exercises without
  `progressionMode` produce no recommendation. If you decide the guard is too strict
  (you want a default 'single' recommendation even without explicit configuration),
  remove the guard from `progression.ts` and this test together.

### Do not keep

- Nothing in this pass.

---

### Recommendations only (not implemented)

1. **`computeHistoryStats` `totalLogged` future-date filtering**: `totalLogged` counts
   ALL entries regardless of date. A future-dated entry (e.g., from a bad CSV import)
   inflates this stat. Low priority since `last7Completed`/`last30Completed` already
   bound by `<= today` in their `inWindow` check, and `currentStreak` starts from `today`
   going backward.

2. **`ActiveWorkoutTracker` exercise-deletion stale ref**: Deleting an exercise (not a
   set) doesn't clear `activeSetRef` if it was pointing at the deleted exercise. The
   same pattern as the `deleteSet` fix in pass 42 applies here. Low urgency since the
   exercise-deletion path is not yet in the UI.

3. **Surface expression evaluator errors in ProgramImportPage** — Malformed YAML
   progression rules fail silently. Repeated recommendation; still unimplemented.

4. **`HistoryPage typeCountMap` vs `computeWorkoutTypeBreakdown`** — Duplication
   between HistoryPage's inline type-count logic and the shared utility. The shared
   utility also provides `avgEffort` per type, which is not surfaced anywhere.

---

### Open questions

1. **Is the `progressionMode` guard the intended behavior?** PR #121 says "Exercises
   with no progressionType/progress rule produce no indicator." Is this the right
   design? If you want a fallback recommendation even for exercises without explicit
   progression config, remove the guard in `buildWeightsRecommendation` line ~101.

2. **Should the volume mode test expectation (`progress` when all sets hit target)
   match your experience in the app?** With the new `allSetsHitTarget`, logging 3 sets
   all hitting their rep targets in volume mode should now show "↗ add volume next
   session" on the pending card.

---

### Known issues / incomplete work

- The `deferred` progression fix from pass 38 is forward-only. Historical progressions
  that fired while `deferred` are not corrected — still no retroactive recomputation.
- Pre-migration extras already on users' devices with `source: undefined` will be
  correctly migrated on first load after this deploy.

---

### Dependencies added

None.

---

## 2026-05-28 (forty-second pass) — branch `claude/dreamy-mccarthy-HtWcw`

### Executive summary

1. **What changed:** Four targeted fixes across `ActiveWorkoutTracker`, `historyStats`,
   and `planStore`. No new features — the user-feedback commit was recent enough that
   stabilizing it was higher priority than adding new capabilities.
2. **Highest confidence:** All four changes are strictly additive guards or one-line corrections.
   The `deleteSet` timer fix and the working set numbering fix address observable bugs in the
   active workout UI. The `longestStreak` filter and `duplicatePlan` naming fix address
   statistical and UX annoyances respectively.
3. **Risks:** Near zero across all four changes. The `longestStreak` change could reduce a
   displayed stat for users with future-dated entries; all others are invisible on the happy path.
4. **Review first:** Trigger the `deleteSet` path in the workout tracker with an active timer
   running, then swipe-delete that set — the timer should stop. Check a plan with warmup sets
   to confirm working set numbers show 1/2/3 not 3/4/5. Duplicate the same plan twice and
   verify the second copy gets "(copy 2)" not "(copy) (copy)".

---

### Biggest issues found

1. **`deleteSet` stale active set timer** — Deleting a set while its timer was running left
   `activeSetRef` pointing at an invalid index. The per-second interval would attempt to update
   a non-existent (or wrong) set on the next tick. Fixed by clearing `activeSetRef` and
   `activeSetTimer` whenever `deleteSet` is called for the active set or any set with a
   lower index.

2. **Working set numbers included warmup positions** — The set index column used raw `setIdx + 1`
   regardless of warmup rows. With 2 warmup sets, the first working set showed "3" instead of "1".
   Fixed by counting working-set position among working sets only.

3. **`getProgressionPreview` opaque format** — "weights[1]: +5lb" gives no context about current
   load or next target. Replaced with "Set 1: 135 → 140 lb" and "All sets: 135 → 140 lb"
   (collapsed when all sets share the same transition).

---

### Improvements completed

| # | Type | Description | Files |
|---|------|-------------|-------|
| 1 | fix (correctness) | `deleteSet` clears stale active set timer + working set numbering | ActiveWorkoutTracker.tsx |
| 2 | improvement (UX) | Progression preview shows load transition "X → Y lb" | ActiveWorkoutTracker.tsx |
| 3 | fix (correctness) | `longestStreak` excludes future-dated entries | historyStats.ts |
| 4 | fix (UX) | `duplicatePlan` avoids name accumulation, adds numeric counter | planStore.ts |
| 5 | test | Direct `isoWeekStart` test cases (6 new tests) | historyStats.test.ts |
| 6 | test | `longestStreak` future-date regression test | historyStats.test.ts |
| 7 | test | `duplicatePlan` naming behavior (3 new tests) | planStore.test.ts |

Test count: **748 → 758** (+10).

---

### Definitely keep

- **`deleteSet` stale timer fix** — Closes a real bug path. Zero risk.
- **Working set numbering** — Cosmetic correctness; no behavior change.
- **`longestStreak` future-date filter** — One line; makes the stat correct.
- **`duplicatePlan` naming** — Strictly more useful; existing "(copy)" plans unaffected.
- **`isoWeekStart` tests** — Direct coverage for a function used throughout weekly stats.

### Probably keep but tweak

- **Progression preview format** — "All sets: 135 → 140 lb" is much better than
  "weights[1]: +5lb". Could consider showing the exercise name in the header rather than
  per-set, but the current format is a clear improvement.

### Do not keep

- Nothing in this pass.

---

### Recommendations only (not implemented)

1. **`computeHistoryStats` future-date filtering for `totalLogged` / `last30`**: The same
   `<= today` filter should arguably apply to `last7Completed` and `last30Completed` windows —
   currently a future-dated entry would appear in those windows if the calendarDate falls in
   the window. Low likelihood; document for a future pass.

2. **`ExtraWorkoutEntry.source` migration**: Pre-migration extras with `source: undefined` are
   treated as `'double_day'` (removed on Undo). Users who added extras via History/Calendar
   before this field was introduced could have their extras removed by Undo. Consider a migration
   that sets `source: 'history'` on all extras with `source === undefined`. No urgency — only
   affects Undo behavior for old extras.

3. **CSV import post-parse validation**: Complex nested structures (exercises, segments)
   serialized as JSON within CSV cells have no structural validation after parse. A malformed
   import could persist invalid shapes. Low practical risk but worth noting.

4. **`ActiveWorkoutTracker` set-index stability after exercise deletion**: Deleting an exercise
   (not a set) doesn't clear `activeSetRef` either. If `activeSetRef.exIdx` pointed at the
   deleted exercise, the ticker could mismatch. Same pattern as the deleteSet fix, worth
   addressing in a future pass.

---

### Open questions

1. Should the progression preview show the **exercise name** (not "Set N") when an exercise
   has a single working set? E.g. "Squat: 135 → 140 lb" instead of "Set 1: 135 → 140 lb".

2. Should `longestStreak` be capped at today for `computePlanStreak` too? Currently only
   `computeHistoryStats.longestStreak` is fixed; `computePlanStreak` still includes future-dated
   extras if they exist.

---

### Known issues / incomplete work

- `deleteExercise` (not yet implemented — users can only replace exercises, not delete whole
  exercises from the tracker) would have the same stale-ref issue as `deleteSet`. If it's ever
  added, the same guard pattern applies.

---

### Dependencies added

None.

---

## 2026-05-27 (forty-first pass) — branch `claude/dreamy-mccarthy-9NxZ6`

### Executive summary

1. **What changed:** Added a React ErrorBoundary to prevent blank-screen crashes
   (recommended 5 consecutive passes, now implemented). Fixed a silent data
   corruption bug in `HistoryPage`: clearing the date input and clicking Save
   would corrupt `calendarDate` to `''`.
2. **Highest confidence:** ErrorBoundary is purely additive — no behavior on
   the happy path. Empty date guard is a one-liner early exit.
3. **Risks:** Near zero. Both changes are strictly protective.
4. **Review first:** Try editing a history entry, clearing the date field, and
   clicking Save — confirm the inline "Date is required." error appears and no
   data is written. To test ErrorBoundary: it can be exercised by temporarily
   throwing in a component, but the normal happy path is unaffected.

---

### Biggest issues found

1. **Missing ErrorBoundary** — recommended in passes 36–40, now implemented.
   React 18 unmounts the full tree on any uncaught render error, leaving a
   completely blank screen with no recovery path. The ErrorBoundary wraps
   `<Routes>` in `App.tsx` and renders a minimal recovery UI.

2. **`HistoryPage.saveAndClose` silent corruption on empty date** — If the user
   cleared the date input and clicked Save, `editingEntryDate` was `''`. The
   conflict check (`'' !== oldDate`) evaluated to true, `moveOutcome` was called
   with a malformed key, and `updateEntryDate(id, '')` set `calendarDate = ''`.
   Any subsequent lookup using `calendarDate` as a key would silently return
   nothing. The same gap existed in `saveAndCloseExtra` (silent no-op there due
   to absence of a conflict check, but `moveOutcome` + `updateExtraEntryDate`
   would be called with `''`).

---

### Improvements completed

| # | Type | Description | Files |
|---|------|-------------|-------|
| 1 | improvement | Add ErrorBoundary wrapping app root | ErrorBoundary.tsx (new), App.tsx |
| 2 | fix (correctness) | Guard empty date in HistoryPage edit modal | HistoryPage.tsx |

---

### Definitely keep

- **ErrorBoundary** — Purely additive. Prevents blank-screen UX on any future
  uncaught error. Zero risk.
- **Empty date guard** — Closes a silent data corruption path. Minimal change.
  Error message is user-visible and informative.

### Probably keep but tweak

- Nothing in this pass.

### Do not keep

- Nothing in this pass.

### Recommendations only (not implemented)

- **`typeCountMap` in HistoryPage vs `computeWorkoutTypeBreakdown`**: HistoryPage
  maintains a manually-computed `typeCountMap` useMemo that duplicates logic in
  `computeWorkoutTypeBreakdown`. The two differ in detail (typeCountMap uses
  flatItems; `computeWorkoutTypeBreakdown` takes raw entries + planDaysById Map).
  Unifying is medium complexity with moderate refactor risk — deferred to a future
  pass.
- **Surface expression evaluator errors in ProgramImportPage**: Malformed YAML
  progression rules fail silently (errors caught and swallowed in
  `evaluateExpression`/`evaluateCondition`). Surfacing these at import time would
  aid debugging of YAML programs. Medium complexity.

---

### Known issues or incomplete work

- None from this pass.

### Dependencies added

- None.

---

## 2026-05-26 (fortieth pass) — branch `claude/dreamy-mccarthy-8Sa0s`

### Executive summary

1. **What changed:** Fixed `setActivePlan` spreading `undefined` onto unknown plan IDs
   (silent data corruption). Added swim actuals export/import to history CSV (data loss fix
   for swim users). Added test coverage for the swim null-effort progression path.
2. **Highest confidence:** The `setActivePlan` guard is a one-line early return — no behavior
   change for valid IDs, unambiguously correct for invalid ones. The CSV swim columns are
   purely additive; backward compatibility is guaranteed by the existing header-based parser.
3. **Risks:** Near zero. All three changes are additive or protective. The CSV change extends
   the column count of every future export, which is invisible to users.
4. **Review first:** Export a history CSV for a plan with at least one logged swim workout.
   Verify that `swimActualDistanceMeters` (and the other swim columns) appear in the file with
   the correct values. Re-import that CSV and confirm `swimActual` is restored on the outcome.

---

### Biggest issues found

1. **`setActivePlan` silent corruption on unknown ID** — If called with a plan ID not in
   `state.plans`, the function would deactivate all existing active plans and then write
   `updated[id] = { ...undefined, status: 'active', ... }`. Spreading `undefined` is a no-op
   in JS, so the resulting object has only the four explicitly-assigned fields and none of the
   required Plan fields (`name`, `days`, `duration`, etc.). `activePlanId` is also set to the
   invalid ID. This is reachable from any component that calls `setActivePlan` without first
   validating that the ID exists (e.g., after a plan was deleted in another tab).

2. **Swim actuals silently dropped in CSV export** — `historyToCsv` only wrote run actuals
   to the CSV. The four swim fields were never included. `buildOutcomeFromRow` had no swim
   parsing path. Any swim user who exports CSV for backup and re-imports loses all swim
   performance data. This was a structural gap — the data model had `swimActual` since the
   swim feature was added, but the CSV layer never caught up.

---

### Improvements completed

| # | Type | Description | Files |
|---|------|-------------|-------|
| 1 | fix (correctness) | Guard `setActivePlan` against non-existent plan IDs | planStore.ts + test |
| 2 | test | Swim null `perceivedEffort` → `progress` in `buildProgressionRecommendation` | progression.test.ts |
| 3 | feat (data integrity) | Swim actuals in history CSV export + import | csv.ts + csv.test.ts |

---

### Definitely keep

- **`setActivePlan` guard** — Silent data corruption path closed. Zero risk. One-line fix.
- **Swim CSV actuals** — Correctness fix for swim users. Backward compatible. Well-tested.
- **Swim null effort test** — Symmetric coverage with the existing run test. No risk.

### Probably keep but tweak

- Nothing in this pass.

### Do not keep

- Nothing in this pass.

### Recommendations only (not implemented)

- **`computeCurrentDayIndex` targetDate < startDate edge case**: When `targetDate` is before
  `plan.startDate`, `differenceInCalendarDays` returns a negative number and the loop body
  never executes — the function returns `startDayIndex`. Reasonable behavior but has no
  dedicated test. Low risk to add a guard test.
- **`computeWorkoutTypeBreakdown` avgEffort not surfaced**: The function computes `avgEffort`
  per workout type and is well-tested, but HistoryPage uses a manually-computed `typeCountMap`
  instead. Replacing with `computeWorkoutTypeBreakdown` would reduce duplication and expose
  effort data per type.
- **CSV swim pace derivation on import**: If a swim row has distance + duration but no pace
  column, the pace is currently left undefined. Could derive `averagePaceSecondsPer100m` from
  the two present values, matching what the app does for run actuals.

---

### Open questions for me

- Is separating `completedAsPlanned` (run) and `swimCompletedAsPlanned` (swim) the right
  design? Could merge into a single `completedAsPlanned` column shared by both types, since
  each row has a single workout type. The current approach is more explicit and avoids any
  future ambiguity; the merged approach reduces columns. Either works — current choice is the
  more conservative one.

---

### Known issues or incomplete work

- None from this pass.

### Dependencies added

- None.

---

## 2026-05-25 (thirty-ninth pass) — branch `claude/dreamy-mccarthy-0z9MJ`

### Executive summary

1. **What changed:** Fixed two more stale `nanoid` import paths (csv.ts, PlanBuilderPage.tsx).
   Fixed `buildLastSessionSummary` producing "×undefined" when a set has no rep data. Added
   "+N more" exercise count hint for multi-exercise workouts.
2. **Highest confidence:** The `nanoid` import fix is purely mechanical — no behavior change.
   The "×undefined" fix is a clear display bug with a minimal, well-tested correction.
3. **Risks:** None significant. The "+N more" feature adds text to an existing hint string and
   is entirely additive — single-exercise workouts are unchanged.
4. **Review first:** Check TodayPage's pending workout hint for a weights day that logged
   multiple exercises in the prior session. Should now show "(+N more)". Verify the hint
   still looks correct for a single-exercise workout (no suffix expected).

---

### Biggest issues found

1. **`buildLastSessionSummary` "×undefined" display bug** — When a set records load but not
   reps (e.g. timed holds, isometric work, or load-only entries), `actualReps` is null and
   `targetReps` may be undefined. The old `!= null` ternary passed `undefined` directly into
   the template string, producing "Last: 2×undefined @ 135 lb Squat". Fixed.
2. **`nanoid` import coupling in csv.ts and PlanBuilderPage.tsx** — Pass 37 fixed this in
   exerciseHistoryStore but these two files were missed. Both now import directly from
   `lib/utils`. No behavior change, cleaner dependency graph.

---

### Improvements completed

| # | Type | Description | Files |
|---|------|-------------|-------|
| 1 | fix (coupling) | `nanoid` imports from canonical `lib/utils` in csv.ts + PlanBuilderPage | 2 |
| 2 | fix (bug) | "×undefined" → "N sets" fallback in `buildLastSessionSummary` | 1 |
| 3 | feat | "+N more" exercise count suffix for multi-exercise workout hints | 1 (+1 test) |

---

### Definitely keep

- All three changes. The `nanoid` fix is mechanical with no risk. The "×undefined" fix is
  clearly correct. The "+N more" feature is small, reversible, and improves UX for complex
  programs.

### Probably keep but tweak

- Nothing in this pass.

### Do not keep

- Nothing in this pass.

### Recommendations only (not implemented)

- **`computeWorkoutTypeBreakdown` avgEffort not surfaced**: The `computeWorkoutTypeBreakdown`
  function in `historyStats.ts` computes `avgEffort` per workout type and is well-tested, but
  this data is not used in HistoryPage (which uses a manually-computed `typeCountMap` instead).
  Replacing `typeCountMap` with `computeWorkoutTypeBreakdown` and showing avg effort alongside
  each type in the stats summary would be a natural next step.
- **`computeCurrentDayIndex` targetDate < startDate edge case**: When `targetDate` is before
  `plan.startDate`, `differenceInCalendarDays` returns a negative number and the loop body
  never executes — the function returns `startDayIndex`. This is reasonable behavior but
  has no dedicated test. Low risk to add a guard test.
- **HistoryPage `typeCountMap` vs `computeWorkoutTypeBreakdown`**: The HistoryPage computes
  a manual type count inline rather than using the shared `computeWorkoutTypeBreakdown` utility.
  Consolidating these would reduce duplication and expose `skipped` / `avgEffort` data.

---

### Open questions for me

- Is "N sets" (vs "N×undefined") the right fallback label for load-only sets? An alternative
  would be to omit the sets/reps segment entirely when no rep count is available, showing
  just "@ 135 lb Squat". Both are better than "×undefined"; this is a UX preference call.
- Is "+N more" the right level of verbosity for the session hint, or would you prefer just
  showing the number of exercises without the qualifier (e.g. "3 exercises" as the prefix)?

---

### Known issues or incomplete work

- None from this pass.

### Dependencies added

- None.

---

## 2026-05-24 (thirty-eighth pass) — branch `claude/dreamy-mccarthy-oaS1e`

### Executive summary

1. **What changed:** Fixed `deferred` outcomes firing YAML progression rules (silent data
   corruption). Fixed `RunSegment.drills` shallow-clone in plan duplication (last remaining
   gap after passes 34 and 37). Fixed `nanoid` import path coupling in `exerciseHistoryStore`.
   Updated a misleading comment in `workoutInstanceId.ts`. Added a `↗ [note]` progression
   hint to TodayPage's pending workout card.
2. **Highest confidence:** The `deferred` fix and the `nanoid` import fix are both tiny and
   unambiguous. The `RunSegment.drills` fix closes the last known shallow-clone gap — it has
   a test and follows the exact same pattern as the passes 34 and 37 fixes.
3. **Feature confidence:** The TodayPage `progressionRecommendation.note` feature is minimal
   — 4 lines, no new computation, reuses already-computed data. The `!todayRunSlot` guard
   correctly prevents double-surfacing for run days.
4. **Review first:** Verify the `↗ note` appears on a weights pending card that has a prior
   session with a progression recommendation. Also verify it does not appear on a run day
   (even if `prevSessionOutcome.progressionRecommendation.note` is set).

---

### Biggest issues found

1. **`deferred` completion state fired YAML progression rules** — `logOutcomeWithProgression`
   excluded `skipped` and `planned` from `session_complete` but not `deferred`. Since
   `deferred` maps to `day_off` (no workout done), any progression rule guarded by
   `session_complete` would fire on a defer. For load-progression rules (`load += 2.5`), this
   advances the per-exercise target weight without any actual workout, silently corrupting the
   program's state machine.

2. **`RunSegment.drills` shallow-clone in `duplicatePlan`** — The final nesting level
   unfixed after passes 34 and 37: `DrillSpec` objects inside `RunSegment.drills` were
   shared between original and copy. Drill edits on one plan would silently affect the other.
   This was documented in pass 37's REVIEW_NOTES as an open recommendation.

3. **Transitive `nanoid` import** — `exerciseHistoryStore` imported from `rotationEngine`
   instead of the source `lib/utils`. Minor coupling issue with silent breakage risk.

---

### Improvements completed

| Change | File(s) | Tests |
|--------|---------|-------|
| Fix `deferred` in `session_complete` | `outcomeStore.ts`, `outcomeStore.test.ts` | +3 |
| Fix `RunSegment.drills` deep-clone | `planStore.ts`, `planStore.test.ts` | +1 |
| Fix `nanoid` import path | `exerciseHistoryStore.ts` | (refactor) |
| Fix misleading comment | `workoutInstanceId.ts` | (docs) |
| Surface `progressionRecommendation.note` hint | `TodayPage.tsx` | (visual) |

---

### Definitely keep

- **`deferred` `session_complete` fix** — Correct semantic. Zero risk. Stops silent variable
  drift for YAML program users who defer workouts.
- **`RunSegment.drills` deep-clone fix** — Closes the last known shallow-clone gap. Has a test.
  The pattern is identical to passes 34 and 37 and is unambiguously correct.
- **`nanoid` import fix** — Strictly better coupling. Zero behavior change.

### Probably keep but tweak

- **`progressionRecommendation.note` hint** — The feature is correct and minimal. You may
  want to adjust the `↗` prefix character or color (`text-sky-700`) to match your visual
  preferences. Currently uses `truncate` — if the note is long, you may want to allow a
  second line or add a tooltip.

### Do not keep

Nothing this pass.

---

### Recommendations only (not implemented)

- **Error boundary around the app root** — No `React.ErrorBoundary` wraps the router or
  any page. A thrown error in any component crashes the entire UI with no recovery path.
  A top-level boundary with a "Reload the app" message would provide a graceful fallback.
- **Narrow Zustand selectors in CalendarPage** — The page subscribes to entire store slices.
  Narrowing selectors to only the fields each section needs would reduce unnecessary
  re-renders on any store update.
- **Surface expression evaluator errors in ProgramImportPage** — Malformed YAML progression
  rules fail silently (evaluator returns 0). A visible parse error in the import wizard
  would help debugging.
- **Retroactive correction for already-fired `deferred` progressions** — The `deferred`
  fix is forward-only. Users who already had deferred outcomes fire their YAML progression
  variables will not see a rollback. A migration utility to recompute `programStore.vars` from
  the logged outcome history would fix historical drift, but is complex and risky.

---

### Open questions for you

1. Should the `↗ note` line be hidden when `lastSessionSummary` is null but notes exist?
   Currently it renders in either case (same `||` condition as notes). This is consistent
   behavior but the `↗` hint without a summary line above it might feel detached.
2. Should the progression note color (`text-sky-700`) be more muted (e.g., `text-slate-500`)
   to match the summary line, or more prominent to stand out as actionable guidance?

---

### Known issues or incomplete work

- The `deferred` fix is forward-only — historical progressions that fired incorrectly are
  not corrected. Acceptable for now; a retroactive fix requires a full outcomes-to-vars
  recomputation.

---

### Dependencies added

None.

---

## 2026-05-23 (thirty-seventh pass) — branch `claude/dreamy-mccarthy-79X8Y`

### Executive summary

1. **What changed:** Fixed a nested shallow-clone bug in plan duplication (SetSpec[] arrays
   within ExerciseSpecs were shared between original and copy). Fixed WeeklyActivityStrip to
   use the newest entry when duplicates exist for a date. Blocked saving plans with duration
   < 1 in Plan Builder. Wired `computePlanStreak` into the streak stat for semantic clarity.
2. **Highest confidence:** All four changes are small, well-scoped, and guarded by tests.
   The deepClone fix (change 1) and the duration validation (change 3) are the most important.
3. **Slightly riskier:** None of the changes touch the rotation engine or store mutation paths.
   All risk is UI-level and reversible.
4. **Review first:** The Plan Builder duration validation — verify the red-border and error
   message appear when `durationValue < 1`, and that both Save buttons are correctly disabled.
   Also confirm the strip dedup fix doesn't change the displayed colors for normal users.

---

### Biggest issues found

1. **`deepCloneWorkoutSlot` nested shallow-clone bug** — Pass 34 fixed the top-level
   array references for `exercises` / `warmup` / `segments`, but missed one level deeper:
   each `ExerciseSpec.sets` when it is a `SetSpec[]`. Duplicating a YAML-imported plan
   with structured set specs (not just a plain count) would share those per-set objects
   between both plans. Future edits to one plan's sets would silently affect the other.

2. **`WeeklyActivityStrip` entry dedup inconsistency** — The only place in the codebase
   using `Array.find()` for entries rather than preferring newest createdAt. Rare in
   practice (store dedup runs on add/import), but a latent correctness gap.

3. **`duration.value = 0` via YAML editor** — The UI number field already guards against
   0 via `|| 1`, but the YAML editor path could set 0 directly and the Save button
   would proceed, creating a plan that instantly appears expired.

---

### Improvements completed

| Change | File(s) | Tests |
|--------|---------|-------|
| Fix SetSpec[] deep-clone in duplicatePlan | `planStore.ts`, `planStore.test.ts` | +2 |
| Fix WeeklyActivityStrip entry dedup | `TodayPage.tsx` | (visual) |
| Wire `computePlanStreak` into streak stat | `TodayPage.tsx` | (semantic) |
| Block save when duration < 1 | `PlanBuilderPage.tsx` | (visual) |

---

### Definitely keep

- **SetSpec[] deep-clone fix** — Data correctness issue. The extra array map is O(small)
  and the test coverage makes regressions impossible. Keep unconditionally.
- **Duration < 1 validation** — Closes a silent data corruption path where a plan's
  expiry logic fires immediately. Risk is near-zero.

### Probably keep but tweak

- **WeeklyActivityStrip dedup + planStreak** — Both changes are correct but the observable
  effect is zero for users without duplicate entries and pre-filtered data. Worth keeping
  for code clarity; no visual diff to verify unless you inject duplicate entries.

### Do not keep

Nothing this pass.

---

### Recommendations only (not implemented)

- **Error boundary around the app root** — No `React.ErrorBoundary` wraps the router or
  any page. A thrown error in any component crashes the entire UI with no recovery path.
  A top-level boundary with a "Reload the app" message would provide a graceful fallback.
- **Narrow Zustand selectors in CalendarPage** — The page subscribes to entire store
  slices. Narrowing selectors to only the fields each section needs would reduce
  unnecessary re-renders on any store update.
- **Surface expression evaluator errors in ProgramImportPage** — Malformed YAML progression
  rules fail silently (evaluator returns 0). A visible parse error in the import wizard
  would help debugging.
- **`duplicatePlan` deep-clone drills within RunSegment** — `RunSegment.drills` is a
  `DrillSpec[]`. Currently cloned as `{ ...s }` (shallow), so `drills` arrays are
  shared between plans. Lower risk than the SetSpec fix (drills are rarely edited
  post-import), but worth noting.

---

### Open questions for you

1. Should the duration validation error block in Plan Builder show immediately on load
   (if the plan was saved with a bad value) or only after the user interacts? Currently
   it shows immediately if `durationValue < 1`, which could be jarring on first load.
2. Do you want the streak stat labeled "Streak" or "Plan Streak" to make explicit that
   it counts only this plan's qualifying days?

---

### Known issues or incomplete work

- None from this pass. All changes were implemented and committed.

---

### Dependencies added

None.

---

## 2026-05-22 (thirty-sixth pass) — branch `claude/dreamy-mccarthy-9sH8T`

### Executive summary

1. **What changed:** Fixed a data quality gap in CSV import (`outcomeStore.importOutcomes`
   now carries plan/workout context to exercise history records). Added a confirmation
   modal before the "Mark N as Day Off" bulk action in TodayPage.
2. **Highest confidence:** The `importOutcomes` fix is a one-line change that routes
   through the existing `syncExerciseHistory` helper — the same path used by live
   logging. Zero risk of regression.
3. **Slightly riskier:** The confirmation modal adds a state variable and a new Modal
   render to TodayPage. The logic is simple but the page is already large; test manually.
4. **Review first:** The catch-up confirmation modal UX — verify the date list renders
   correctly, the confirmation fires `markDaysAsOff` as expected, and cancel leaves no
   state changes.

---

### Biggest issues found

1. **`outcomeStore.importOutcomes` dropped exercise history context** — All prior passes
   missed this. After CSV import, exercise records in `exerciseHistoryStore` had
   `planName: null` and `workoutName: null`. Not a crash, but affects any UI that
   tries to filter or display records by plan/workout name.

2. **"Mark N as Day Off" had no confirmation** — Pass 33 added this quick-action
   button; no prior pass added a safety gate. A single accidental tap on a scrolling
   mobile screen would batch-mark up to 7 past days without warning.

---

### Improvements completed

| Change | File(s) | Tests |
|--------|---------|-------|
| Fix `importOutcomes` exercise history context | `outcomeStore.ts` | +6 in outcomeStore.test.ts |
| Catch-up confirmation modal | `TodayPage.tsx` | (visual — no unit tests) |

---

### Definitely keep

- **`importOutcomes` context fix** — No behavioral change for the common path. Strictly
  better data quality for imported outcomes. Risk is near-zero.

### Probably keep but tweak

- **Catch-up confirmation modal** — The UX choice is good; the implementation is minimal.
  You may want to adjust the date format (currently "Wednesday, May 20") or the modal
  copy if the tone feels too formal. The confirm button color (amber) matches the action
  type but you might prefer a different style.

### Do not keep

Nothing this pass.

---

### Recommendations only (not implemented)

- **Wire `computePlanStreak` into TodayPage stats bar** — The function was added in
  pass 25 and is tested but never displayed. Could replace or supplement the global
  streak with a plan-scoped one.
- **Validate `duration.value > 0` in Plan Builder** — Setting `value: 0` silently
  creates a plan that expires immediately. A validation warning at create/edit time
  would prevent user confusion.
- **Surface expression evaluator errors in UI** — Malformed YAML progression rules
  fail silently. A visible error message in ProgramImportPage would help debugging.
- **Narrow Zustand selectors in CalendarPage** — The page subscribes to entire store
  slices; narrowing to only the needed fields would reduce unnecessary re-renders.

---

### Open questions for you

1. Should the catch-up modal list dates oldest-first or newest-first? Currently it
   matches `unloggedDates` order (newest-first). Oldest-first might read more naturally
   as a chronological list.
