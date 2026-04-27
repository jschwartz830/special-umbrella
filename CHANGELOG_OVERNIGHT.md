# Overnight Changelog

## 2026-04-27 (thirteenth pass) — branch `claude/great-mccarthy-PqhIm`

Baseline on entry: **286 passing, 0 failing**.
Exit state: **291 passing, 0 failing** (+5 tests).

### Commits

| SHA | Commit message |
|-----|---------------|
| 292125c | fix(formatPace): prevent seconds overflow producing "9:60 /mi" |
| 3658166 | fix(isPlanExpired): add explicit zero-day guard |
| 1e1a509 | fix(TodayPage): use replaceAll for workout type display |
| 98e186a | fix(csv): preserve ExtraWorkoutEntry.source across export/import |
| 48d8819 | feat(TodayPage): add compact stats bar (streak, this-week, total) |

### Bug fixes

**1. `formatPace` — second-overflow (9:60 /mi)**
`Math.round(secondsPerMile % 60)` produces 60 when the fractional remainder
rounds up. Fixed: round total seconds first, then integer-divide for mins/secs.
File: `src/modules/workout-outcomes/types.ts`. Tests: +3.

**2. `isPlanExpired` — zero-day plan guard**
0-day plan caused implicit NaN/Infinity arithmetic. Added explicit
`if (plan.days.length === 0) return false` guard.
File: `src/engine/rotationEngine.ts`. Tests: +1.

**3. TodayPage — `replace` → `replaceAll` for type display**
`String.replace(string, string)` only replaces the first occurrence.
Used `replaceAll` for consistent multi-underscore type formatting.
File: `src/pages/TodayPage.tsx`. Tests: none (UI-only).

**4. CSV — `ExtraWorkoutEntry.source` preservation**
`source` field was silently dropped on export. Added `extraSource` column,
backward-compatible with old exports (empty/absent → `undefined`).
File: `src/lib/csv.ts`. Tests: +1 round-trip test.

### Feature

**5. Compact stats bar on TodayPage**
Three-tile row (streak / this-week / total) wired to `computeHistoryStats`.
Scoped to active plan. No new logic — purely wiring + UI.
File: `src/pages/TodayPage.tsx`.

---

## 2026-04-26 (twelfth pass) — branch `claude/great-mccarthy-bM0YZ`

Baseline on entry: **267 passing, 0 failing**.
End state: **286 tests pass** (+19).

Scope: one bug fix (CSV idempotency), three edge-case tests, one medium-
complexity feature (breakdown utility + 14 tests). No new dependencies.
No UI changes.

---

### 1. fix(csv): preserve extraId on re-import to prevent duplicate extras

**Summary**: `historyFromCsv` always generated a fresh `nanoid()` for every
`ExtraWorkoutEntry`. Re-importing the same CSV created duplicate extras because
`importExtraEntries` deduplicates by ID but the IDs were always new.

**Fix**: Added an optional `extraId` column to the history CSV header. On export,
extra rows now include their original `id`. On import, the value is reused when
present so re-importing the same file is idempotent. Older CSVs without the
column fall back to fresh IDs (backward compatible).

**Why it matters**: Users who export history as a backup and re-import it were
silently accumulating duplicate extra workout entries (double-day bonuses, manual
extras). Rotation entries were unaffected (they deduplicate by `planId+calendarDate`).

**Files changed**:
- `src/lib/csv.ts` — added `extraId` to `HISTORY_HEADERS`, updated `historyToCsv`
  and `historyFromCsv`
- `src/lib/__tests__/csv.test.ts` — updated and added tests for idempotent
  re-import and backward-compatibility with old exports

**Risks**: None. The new column is optional on import. Old CSV files parse
exactly as before. The column is blank for rotation rows.

**Rollback**: `git revert 93c61ac`. No data migration required.

---

### 2. test: edge-case coverage for rotation engine and historyStats

**Summary**: Four edge cases that were handled correctly by the implementation
but had no tests documenting the expected behavior.

**Tests added**:
- `computeCurrentDayIndex` with `targetDate` before `plan.startDate` → returns
  `startDayIndex` (negative dayCount → loop skips).
- `getUpcomingDays` with a single-day plan → always projects day 0 (mod 1 = 0).
- `isPlanExpired` with a 0-day plan + rotations duration → `Math.floor(0/0) = NaN`,
  `NaN >= value` is false → never expired.
- `computePlanProgress` with `duration.value = 0` → returns zeros via `total <= 0`
  guard.

**Files changed**:
- `src/engine/__tests__/rotationEngine.test.ts` (+3 tests)
- `src/lib/__tests__/historyStats.test.ts` (+1 test)

**Risks**: None.

---

### 3. feat(stats): computeWorkoutTypeBreakdown utility (medium-complexity feature)

**Summary**: New pure function that aggregates per-workout-type completion counts,
skip counts, and average effort from history entries, extras, and outcomes.

**API**:
```typescript
computeWorkoutTypeBreakdown(
  entries: HistoryEntry[],
  extras: ExtraWorkoutEntry[],
  outcomes: Record<string, WorkoutOutcome>,
  planDaysById: Map<number, { slots: Array<{ type: WorkoutType }> }> | null,
  dateRange?: { from: string; to: string },
): WorkoutTypeBreakdown
// WorkoutTypeBreakdown = Partial<Record<WorkoutType, WorkoutTypeStat>>
// WorkoutTypeStat = { completed, skipped, avgEffort: number | null }
```

**Why it matters**: Users training across multiple workout types (lifting + running
+ yoga) have no view of which types they actually logged most or where their effort
is highest. The data exists in the history; this function surfaces it.

**Files changed**:
- `src/lib/historyStats.ts` — added `WorkoutTypeStat`, `WorkoutTypeBreakdown`,
  `computeWorkoutTypeBreakdown`
- `src/lib/__tests__/historyStats.test.ts` — 14 tests covering all branches
- `FEATURE_PROPOSAL.md` — added twelfth-pass entry

**No UI integration in this pass.** The function is production-ready; the
developer can wire it into HistoryPage stats or a future analytics view.

**Risks**: Low. Pure function, no store changes, no persistence. Multi-slot days
are attributed to the first slot type (documented assumption).

**Rollback**: Delete function and types from `historyStats.ts`, remove tests.

---

## 2026-04-25 (eleventh pass) — branch `claude/great-mccarthy-0XEfh`

Baseline on entry: **222 passing, 0 failing**.
End state: **267 tests pass**.

Scope: one bug fix, two test-coverage gaps closed, and one medium-complexity
feature (pure function + tests). No new dependencies. No UI changes.

### Commits (oldest → newest)

1. **Docs: IMPLEMENTATION_PLAN.md and FEATURE_PROPOSAL.md** (part of final doc commit)
   Audit findings, fix rationale, feature proposal for `computePlanProgress`.
   - `IMPLEMENTATION_PLAN.md`, `FEATURE_PROPOSAL.md`
   - **Risk**: none (doc only).

2. **Fix: `importEntries` deduplicates within the incoming batch** (`29444c5`)
   `importEntries` removed existing store entries for colliding keys but did not
   deduplicate the incoming batch itself. Two rows with the same `(planId,
   calendarDate)` both survived, breaking the one-entry-per-(plan,date) invariant.
   Added `deduplicateByDate()` helper (last-wins per key) applied to the batch
   before any store mutation. Four new tests added (happy path, replace-existing,
   intra-batch dedup, no-op on empty) — the entire `importEntries` surface was
   previously untested.
   - `src/store/historyStore.ts`, `src/store/__tests__/historyStore.test.ts`
   - **Risk**: very low. The fix is strictly more correct; existing tests unchanged.
   - **Rollback**: revert this commit. The only behavior change is that a malformed
     CSV with duplicate dates no longer creates duplicate store entries.

3. **Tests: `recommendation/explanation.ts` coverage (0 → 22 tests)** (`3395e74`)
   All three exported functions were previously untested. `summariseRunOutcome` has
   non-trivial formatting logic (pace string as "M:SS /mi", dot-separator joining,
   null-field omission) that could silently regress on a refactor. New test file
   covers all meaningful paths for all three functions.
   - `src/modules/recommendation/__tests__/explanation.test.ts` (new file)
   - **Risk**: none (additive tests only).

4. **Tests: `evaluateRunProgression` edge-case coverage** (`7d2cbc3`)
   Three previously uncovered branches: (1) effort=5 + partially_completed confirms
   the high-effort regress fires before the partial check; (2) completed + 80–95% of
   target → default_hold (the "almost-but-not-quite" case); (3) completedAsPlanned=false
   + no distance → hold. Appended to the existing engine test describe block.
   - `src/modules/run-adaptation/__tests__/engine.test.ts`
   - **Risk**: none (additive tests only).

5. **Feature: `computePlanProgress` helper** (`0c4d145`)
   Pure function in `src/lib/historyStats.ts` that returns `{ completed, total,
   percentComplete }` for any plan. Supports both duration types:
   - `rotations`: counts complete/skip entries, floors to full rotations.
   - `weeks`: counts calendar weeks elapsed since startDate, floor division.
   Both cap at the plan's total and return 0 for edge cases (empty plan,
   pre-start date). 15 tests cover all paths. No UI changes this run.
   - `src/lib/historyStats.ts`, `src/lib/__tests__/historyStats.test.ts`
   - **Risk**: very low. Additive pure function; no store or UI coupling.
   - **Rollback**: revert this commit. No data is written.

---

## 2026-04-24 (tenth pass) — branch `claude/great-mccarthy-hYhLK`

Baseline on entry: **210 passing, 0 failing**.
End state: **222 tests pass**.

Scope: two correctness fixes, one visual improvement, one medium-complexity
feature, and 12 new tests. No new dependencies.

### Commits (oldest → newest)

1. **Plan/docs update for tenth pass** (`8b9030b`)
   IMPLEMENTATION_PLAN.md: documents findings, fix plan, rationale.
   - `IMPLEMENTATION_PLAN.md`
   - **Risk**: none (doc only).

2. **Fix: HistoryPage edit-modal close-trap on date conflict** (`b079a9e`)
   `saveAndClose` was passed to both `onClose` (X button / backdrop) and the
   explicit Save button. On a date conflict, `saveAndClose` early-returned
   without closing, trapping the user. Split into `discardAndClose` (always
   closes, passed to `onClose`) and `saveAndClose` (validates + commits,
   stays on the Save button). No behavior change on the save-succeeds path.
   Deferred since the fifth pass; implemented this pass.
   - `src/pages/HistoryPage.tsx`
   - **Risk**: very low. The save path is unchanged; only the X / backdrop
     path changes (now discards rather than attempting to save).
   - **Rollback**: revert this commit to restore original behavior (both
     paths call `saveAndClose`).

3. **Fix: guard durationActualMin against negative values in OutcomeModal** (`4994634`)
   `handleConfirm` used `parseFloat(durationMin) || null`, which passed through
   negative inputs. All adjacent numeric fields already guard with
   `isFinite(n) && n > 0`. This commit mirrors that pattern.
   - `src/components/workout/OutcomeModal.tsx`
   - **Risk**: none. Negative durations are nonsensical; previously they
     corrupted stored outcomes silently.
   - **Rollback**: revert this commit to restore the original guard.

4. **UX: show 'Bonus' pill for double-day extras in History** (`76a9231`)
   The `ExtraWorkoutEntry.source` field was added in the sixth pass to enable
   this distinction. History was still showing a generic 'Extra' pill for both
   manually-added extras and double-day bonus workouts. Extras with
   `source === 'double_day'` now display a violet 'Bonus' pill.
   - `src/pages/HistoryPage.tsx`
   - **Risk**: none (purely additive visual change, no data impact).
   - **Rollback**: revert this commit.

5. **Feature: dismissible plan expiry banner** (`9c91919`)
   The 'Plan complete!' banner showed on every TodayPage visit once a plan
   expired, with no way to dismiss it. Added `useExpiryDismiss` hook (per-plan
   localStorage key, `wpt_expiry_dismissed_v1_<planId>`). TodayPage hides the
   banner when dismissed and shows a small × button to trigger dismiss.
   See FEATURE_PROPOSAL.md and FEATURE_REVIEW.md for full design rationale.
   - `src/hooks/useExpiryDismiss.ts` (new file)
   - `src/pages/TodayPage.tsx`
   - `FEATURE_PROPOSAL.md`
   - **Risk**: very low. No store changes. localStorage exception is caught
     gracefully. Rollback: revert this commit; no data loss.

6. **Tests: useExpiryDismiss storage contract + durationActualMin guard** (`dfe3803`)
   12 new tests in `src/hooks/__tests__/useExpiryDismiss.test.ts`:
   - 6 tests for the localStorage key contract (isolation by planId, absence
     = false, '1' = true, other values = false). Uses `vi.stubGlobal` to
     provide an in-memory mock for the node test environment.
   - 6 tests for the `durationActualMin` guard logic (positive int/decimal,
     zero, negative, empty string, non-numeric).
   - 210 → 222 tests passing.
   - `src/hooks/__tests__/useExpiryDismiss.test.ts` (new file)
   - **Risk**: none (tests only).

---

## 2026-04-23 (ninth pass) — branch `work`

Baseline on entry: **206 passing, 0 failing**.
End state: **210 tests pass**.

Scope: one low-risk correctness fix in History plan filtering (extras-only plans now counted as having history), plus additive test/documentation updates. No new dependencies.

### Commits (oldest → newest)

1. **Plan/docs update for ninth pass**
   Added a dated audit section with findings, sequencing, and deferred items.
   - `IMPLEMENTATION_PLAN.md`
   - **Risk**: none (doc only).

2. **Fix: include extras in plan-history detection for HistoryPage filter/default**
   Introduced `getPlansWithHistory` + `hasPlanHistory` helpers so History page
   treats either rotation entries or extra workouts as valid history activity.
   This fixes the extras-only edge case where a plan could be hidden from the
   filter options and skipped as the initial active-plan filter selection.
   - `src/lib/historyScope.ts`
   - `src/pages/HistoryPage.tsx`
   - `src/lib/__tests__/historyScope.test.ts`
   - **Risk**: low. Only broadens history detection criteria to match real logged data.
   - **Rollback**: revert this commit to return to entries-only behavior.

### Dropped / not attempted

- Medium-complexity feature intentionally skipped; stabilization took precedence.
- Prior open recommendations (edit modal close trap, progression-state cleanup) remain deferred.

## 2026-04-21 (eighth pass) — branch `claude/epic-cannon-Ltjw1`

Baseline on entry: **194 passing, 0 failing**.
End state: **206 tests pass**.

Scope: two correctness fixes around `extraEntries` visibility — one
in the History stats summary (display inconsistency) and one in the
CSV round-trip (silent data loss on backup/restore). No new features,
no new dependencies. One schema addition to the history CSV
(additive, backward-compatible).

### Commits (oldest → newest)

1. **`519dbb4` — Plan: 2026-04-21 eighth-pass audit**
   IMPLEMENTATION_PLAN.md section. No code changes.
   - `IMPLEMENTATION_PLAN.md`
   - **Risk**: none (doc only).

2. **`3f78bae` — Fix: include extraEntries in History stats tiles**
   `computeHistoryStats(entries, today)` became
   `computeHistoryStats(entries, extras, today)`. Extras count as
   completed workouts for totals, 7/30-day windows, and the current
   streak. Extras participate in the streakable-days set, so an
   extras-only day extends the streak and an extra backfills a day
   that's been logged as `skip`. HistoryPage's one callsite passes
   `filteredExtras` through and the stat tiles now render when there
   are extras even if no rotation entries exist.
   - `src/lib/historyStats.ts`
   - `src/lib/__tests__/historyStats.test.ts`
   - `src/pages/HistoryPage.tsx`
   - **Risk**: low. Behaviour change is intentional — aligns stat
     tiles with the flat list already rendered in the page header.
     Reviewers: expect "Streak" / "Total" numbers to be non-zero
     for users who have extras. If you prefer the old semantics,
     revert — every caller goes through HistoryPage.
   - **Rollback**: `git revert 3f78bae`.

3. **`87e78ec` — Fix: CSV history export/import now round-trips extraEntries**
   The history CSV used to drop every `ExtraWorkoutEntry` silently —
   exports omitted them, imports couldn't produce them. Added three
   columns to the history CSV header: `entryKind` (`rotation`|`extra`),
   `workoutType`, `workoutName`. Rotation rows leave workoutType/
   workoutName blank; extra rows leave planDayIndex/action/slotNames
   blank. Legacy CSVs without `entryKind` default to rotation, so
   previously-exported files continue to import cleanly.
   `historyFromCsv` now returns an `extras: ExtraWorkoutEntry[]` array
   alongside `entries`; a new `historyStore.importExtraEntries` appends
   them (deduplicated by id). Outcomes attached to extras are rekeyed
   to the freshly generated extra id so they survive the round-trip
   under the correct `makeExtraWorkoutInstanceId` key.
   - `src/lib/csv.ts`
   - `src/lib/__tests__/csv.test.ts`
   - `src/store/historyStore.ts`
   - `src/store/__tests__/historyStore.test.ts`
   - `src/pages/HistoryPage.tsx`
   - **Risk**: medium-low. The CSV header grew and column order
     changed (entryKind is first). Old exports still parse correctly
     (tested). New exports are not round-trip-compatible with an
     older version of the app that expects the old header order —
     but this app ships from a single branch, so that's only a
     concern if someone installs an old PWA version and imports a
     new export. The import summary string also changed format
     slightly to include extras when present.
   - **Rollback**: `git revert 87e78ec`. Reverts both the export and
     import paths; old extras in storage stay put.

### Dropped / not attempted

- HistoryPage saveAndClose trap on date conflict — still open from
  the seventh pass. Fix wants a dedicated Cancel button.
- `progressionStates` orphaning on plan delete — still needs a
  schema change.
- `swap_slot` override UI, plan-expiry dismiss — unchanged.
- Upcoming-complete-when-today-logged routed through
  ExtraWorkoutEntry — still an open product question.
- Medium-complexity feature — declined. The two findings here are
  both real correctness/data-loss issues; fixing them is enough for
  the night.

---

## 2026-04-19 (seventh pass) — branch `claude/gracious-heisenberg-2fsGC`

Baseline on entry: **192 passing, 0 failing**.
End state: **194 tests pass**.

Scope: one real data-loss guard (TodayPage upcoming-log overwrite);
one pure refactor (CalendarPage action-sync); one DRY refactor
(OutcomeMetrics extraction); one invariant test. No new features, no
schema changes, no new dependencies.

### Commits (oldest → newest)

1. **`638dfca` — Plan: 2026-04-19 seventh-pass audit**
   IMPLEMENTATION_PLAN.md section. No code changes.
   - `IMPLEMENTATION_PLAN.md`
   - **Risk**: none (doc only).

2. **`ab5fcd2` — Fix: guard TodayPage upcoming-log against overwriting today's entry**
   When today is already logged (today_complete, today_skip, or
   today_day_off) and the user opened an upcoming-day modal and picked
   "Complete", `handleUpcomingLog` built `logDate = today` and called
   `logAction(plan.id, today, rd.planDayIndex, 'complete')`. Because
   `addEntry` dedupes on `(planId, calendarDate)` and replaces, the
   primary entry was silently overwritten with the upcoming slot's
   `planDayIndex`. Guarded the overwrite: surfaced an inline error
   ("Today is already logged. Undo it first, or toggle double-day on a
   pending day to record two workouts.") and refused the log. No
   behaviour change for the intended path (upcoming-complete when
   today is still pending).
   - `src/pages/TodayPage.tsx`
   - **Risk**: low. Additive guard; only changes behaviour in the
     previously-broken path where data was being lost silently. The
     text of the error is a UX choice — revisit if you'd rather
     permit the action via ExtraWorkoutEntry.
   - **Rollback**: `git revert ab5fcd2`.

3. **`7a980ca` — Refactor: CalendarPage action-sync uses updateEntryAction**
   `handleOutcomeConfirm` was calling `addEntry({ ...entry, action })`
   to sync the history entry's action to the OutcomeModal's
   completion state. This worked because `addEntry`'s payload spread
   preserved id/createdAt, but it was semantically misleading and
   fragile — any future change to `addEntry`'s dedupe would silently
   break it. Switched to `updateEntryAction` (same helper HistoryPage
   already uses for the same purpose).
   - `src/pages/CalendarPage.tsx`
   - **Risk**: none. Zero behaviour change.
   - **Rollback**: `git revert 7a980ca`.

4. **`ee75b11` — Refactor: extract OutcomeMetrics to a shared component**
   The effort-dots + run-actuals + duration block was duplicated
   three times — once as a local helper in CalendarPage, and twice
   inlined in HistoryPage (rotation entries and extras). Extracted to
   `src/components/workout/OutcomeMetrics.tsx`. Normalised one
   stylistic drift (CalendarPage's "w-10" label column dropped in
   favour of HistoryPage's inline "Effort:" form).
   - `src/components/workout/OutcomeMetrics.tsx` (new)
   - `src/pages/CalendarPage.tsx`
   - `src/pages/HistoryPage.tsx`
   - **Risk**: very low. Visual: Calendar day-detail modal's Effort
     row is now slightly narrower (no dedicated label column). No
     logic change.
   - **Rollback**: `git revert ee75b11`.

5. **`835a030` — Tests: lock invariant behind TodayPage upcoming-log guard**
   Added two tests under a new "TodayPage upcoming-log guard
   invariant" describe block, pinning down the replace-on-collision
   behaviour of `logAction` → `addEntry` the guard exists to prevent.
   A future refactor of `addEntry` can't silently re-introduce the
   data-loss path without tripping these tests.
   - `src/store/__tests__/historyStore.test.ts`
   - **Risk**: none (tests only).
   - **Rollback**: `git revert 835a030`.

### Rollback of entire pass

```sh
git revert 835a030 ee75b11 7a980ca ab5fcd2 638dfca
```

Each commit is independently revertable and commutes with the others
except that the test (commit 5) explicitly references the guard's
invariant and would pass just as well after reverting the guard
itself (the tests describe `addEntry`'s behaviour, not the guard
logic).

---

## 2026-04-18 (sixth pass) — branch `claude/overnight-audit-improvements-RzBkA`

Baseline on entry: **176 passing, 0 failing**.
End state: **192 tests pass**.

Scope: one re-opened data-correctness bug (CalendarPage OutcomeModal
writing extra-entry outcomes to the wrong key — the exact peer of the
HistoryPage fix from the fifth pass that Calendar had missed); one
consistency fix; 13 new tests for previously uncovered store actions;
and a medium-complexity feature (ExtraWorkoutEntry.source) that resolves
the open product question from the fifth-pass review.

### Commits (oldest → newest)

1. **`729879c` — Plan: 2026-04-18 sixth-pass audit**
   IMPLEMENTATION_PLAN.md section. No code changes.
   - `IMPLEMENTATION_PLAN.md`
   - **Risk**: none (doc only).

2. **`f681c9f` — CalendarPage: pass workoutInstanceId to OutcomeModal for extra entries**
   When `openExtraOutcome` set `outcomeTarget.instanceId` to the extra's
   key (`makeExtraWorkoutInstanceId(...)`), the OutcomeModal was rendered
   without `workoutInstanceId={outcomeTarget.instanceId}`. The modal
   therefore fell back to `makeWorkoutInstanceId(planId, calendarDate)`
   and wrote the extra's outcome to the primary rotation slot's key —
   silently overwriting it. One-line fix; exact mirror of commit
   `7969378` (fifth pass, HistoryPage).
   - `src/pages/CalendarPage.tsx`
   - **Risk**: low. Purely additive prop; existing callers for the primary
     rotation outcome pass the same value as before.
   - **Rollback**: `git revert f681c9f`.

3. **`ab8d7f0` — TodayPage: normalize date string to format(new Date(), 'yyyy-MM-dd')**
   TodayPage was the only file using `new Intl.DateTimeFormat('en-CA').format()`
   to produce a YYYY-MM-DD local date string. Every other file uses
   date-fns `format()`. Both produce identical output, but the
   inconsistency made the codebase harder to scan.
   - `src/pages/TodayPage.tsx`
   - **Risk**: none. No behavior change.
   - **Rollback**: `git revert ab8d7f0`.

4. **`762f9bc` — Tests: cover updateEntryDate, updateExtraEntryDate, clearExtraEntriesForDate**
   Three store actions added during the fourth pass for calendar
   date-editing had no test coverage. Added 13 tests: 3 for
   `updateEntryDate`, 4 for `updateExtraEntryDate`, 4 for
   `clearExtraEntriesForDate`.
   - `src/store/__tests__/historyStore.test.ts`
   - **Risk**: none (tests only).
   - **Rollback**: `git revert 762f9bc`.

5. **`4a16d9b` — Plan: ExtraWorkoutEntry.source field — feature proposal**
   FEATURE_PROPOSAL.md. No code changes.
   - `FEATURE_PROPOSAL.md`
   - **Risk**: none (doc only).

6. **`d865ff9` — Feature: ExtraWorkoutEntry.source field + scoped Undo on TodayPage**
   Added optional `source?: 'history' | 'double_day'` to
   `ExtraWorkoutEntry` (backward-compatible). Updated three creation
   paths: TodayPage double-day passes `'double_day'`; HistoryPage and
   CalendarPage "Add workout for this day" pass `'history'`. Undo on
   TodayPage now removes only extras where `source !== 'history'`
   (double_day + legacy undefined = removed; history = left alone).
   - `src/types/index.ts`, `src/pages/TodayPage.tsx`,
     `src/pages/HistoryPage.tsx`, `src/pages/CalendarPage.tsx`
   - **Risk**: low. Schema change is additive. Old extras without `source`
     are treated like double_day (conservative — prevents orphaned extras).
     Manually-added extras on today's date now survive an Undo on Today.
   - **Rollback**: `git revert d865ff9`. Old extras still have no source
     field; the only side-effect is Undo reverts to clearing all extras
     for the date.

7. **`948cfaf` — Tests: ExtraWorkoutEntry.source field and Undo scoping invariants**
   6 new tests: source field persisted correctly for both values and for
   the legacy undefined case; Undo filter (source !== 'history') removes
   only the right records in mixed, all-double_day, and all-history
   scenarios.
   - `src/store/__tests__/historyStore.test.ts`
   - **Risk**: none (tests only).
   - **Rollback**: `git revert 948cfaf`.

---

## 2026-04-18 (fifth pass) — branch `claude/add-bonus-workout-outcomes-c1H1R`

Baseline on entry: **171 passing, 0 failing** (after `npm install`).
End state: **176 tests pass**.

Scope: one user-reported bug (double-day bonus workout logging replaced
the primary instead of adding a second), one latent History-page bug
uncovered while investigating, plus small supporting changes and tests.
No engine changes, no schema changes, no new features beyond the
already-present double-day UI getting full persistence.

### Commits (oldest → newest)

1. **`d13c033` — Plan: 2026-04-18 fifth-pass audit**
   Dated `IMPLEMENTATION_PLAN.md` section summarising the double-day
   bug, the OutcomeModal instance-id latent bug, and the prioritized
   plan. No code changes.
   - `IMPLEMENTATION_PLAN.md`
   - **Risk**: none (doc only).
   - **Rollback**: `git revert d13c033`.

2. **`9b89b44` — OutcomeModal: optional workoutInstanceId override**
   Added an optional prop so callers logging a non-primary record for
   a date (ExtraWorkoutEntry, double-day bonus) can pass their own
   instance id. Backward-compatible — falls through to the existing
   `makeWorkoutInstanceId(planId, calendarDate)` default when not
   provided.
   - `src/components/workout/OutcomeModal.tsx`
   - **Risk**: low. Additive prop, no behaviour change for existing
     callers.
   - **Rollback**: `git revert 9b89b44` (but note this will re-introduce
     the HistoryPage extra-outcome collision fixed next).

3. **`7969378` — HistoryPage: save extra-entry outcomes under the extra key**
   Pre-existing bug: `openOutcomeForExtra` tracked the correct
   `makeExtraWorkoutInstanceId` in `outcomeTarget.instanceId`, but
   `OutcomeModal` always rebuilt the id from `(planId, calendarDate)`
   on confirm, so saving an outcome for an ad-hoc extra entry actually
   wrote to the primary rotation entry's outcome slot for that date.
   One-line fix now that the modal accepts the override.
   - `src/pages/HistoryPage.tsx`
   - **Risk**: low. Fixes a silent data-correctness bug; no new code
     paths.
   - **Rollback**: `git revert 7969378`.

4. **`f2fe0af` — TodayPage: log the double-day bonus workout (USER-REPORTED)**
   `handleOutcomeConfirm` used to log just the primary
   (`logAction(planId, today, ...)`) and call `actions.advance()` to
   skip the rotation past the bonus. The bonus itself was never
   persisted. Now, when `doubleDay` is on:
   1. Primary is logged as before (HistoryEntry keyed by
      `(planId, today)`).
   2. Bonus is persisted as an `ExtraWorkoutEntry` on today — the
      existing bucket for ad-hoc workouts — so both records coexist
      without colliding on the primary key.
   3. After the primary OutcomeModal confirms, a second OutcomeModal
      opens for the bonus, pre-populated from the bonus plan day.
      Closing without confirming keeps the extra entry (the workout
      happened) but leaves the outcome blank, matching the ad-hoc
      extras already created from History.
   4. Rotation still advances an extra step so tomorrow projects past
      the bonus.
   - `src/pages/TodayPage.tsx`
   - **Risk**: medium. Introduces a new persistence path from the
     Today page. Contained to the double-day branch; single-workout
     path is unchanged.
   - **Rollback**: `git revert f2fe0af`. The HistoryPage / OutcomeModal
     fixes are independently valuable and should remain.

5. **`283ceb4` — Tests: extras coexist with primary entry/outcome on same date**
   Locks down the invariants the double-day fix depends on:
   - Primary HistoryEntry and ExtraWorkoutEntry survive together on
     the same `(planId, calendarDate)`; multiple extras accumulate
     with distinct ids.
   - `removeEntry` doesn't touch extras.
   - Primary and extra outcomes coexist under distinct keys;
     `clearPlanOutcomes` wipes both.
   - Also resets `extraEntries` in the history-store test
     `beforeEach` — the bucket was added to the store after the reset
     was written, so state was leaking across tests. My first run of
     the new tests exposed the leak, which this commit fixes.
   - `src/store/__tests__/historyStore.test.ts`,
     `src/store/__tests__/outcomeStore.test.ts`
   - **Risk**: none (tests only).
   - **Rollback**: `git revert 283ceb4`.

6. **`28f7905` — TodayPage: Undo also clears today's extras for this plan**
   After the double-day fix, the existing Undo button on Today only
   cleaned up the primary HistoryEntry and outcome, leaving the bonus
   ExtraWorkoutEntry (and its outcome) stranded. Undo now also removes
   all of today's extras (and their outcomes) for this plan. Extras
   for other plans on today are left untouched.
   - `src/pages/TodayPage.tsx`
   - **Risk**: low. Extras for this plan on today could previously
     only have been created by the double-day flow; the rare user who
     manually added a today-extra from the History page and then hit
     Undo on Today would now lose that manual extra too. Documented
     in REVIEW_NOTES for your consideration.
   - **Rollback**: `git revert 28f7905`.

### Not done this run

- The optional medium-complexity feature slot was intentionally skipped.
  The user-reported correctness bug + its latent cousin took the
  whole session; stabilization first is the right call.

---

## 2026-04-18 run — branch `claude/system-improvements-m4b4f`

Baseline: 169 passing, 1 failing (stale CSV test assertion).
End state: **171 tests pass**.

Scope-tight correctness run. Three targeted fixes + one new test. No
engine changes, no schema changes, no new features.

### Commits (oldest → newest)

1. **`dbf4c51` — Add IMPLEMENTATION_PLAN.md section for 2026-04-18 audit**
   Dated architecture re-summary + prioritized plan. No code changes.

2. **`40edf34` — Update stale csv test: planId is preserved, day/slot IDs regenerate**
   Commit `d16e8c2` intentionally started preserving planId on CSV
   import (so previously-exported history CSVs stay cross-referenceable
   across re-imports). The existing test still asserted that planId
   was regenerated, so the suite had been failing since that change
   landed. Flipped the assertion + renamed the test to state the
   current contract; added inline comment explaining why.
   - `src/lib/__tests__/csv.test.ts`
   - **Risk**: none. Test-only change that documents existing behavior.
   - **Rollback**: `git revert 40edf34`.

3. **`90ef6b3` — Clear plan's extra workouts when clearing plan history**
   `clearPlanHistory(planId)` filtered `entries` and `overrides` but
   not `extraEntries`. Deleting a plan left any ad-hoc logged workouts
   (yoga / swim / run / etc. logged outside the rotation) orphaned in
   localStorage. PlansPage's delete flow already calls
   `clearPlanHistory` → `clearPlanOutcomes` → `deletePlan`, so adding
   the filter to `clearPlanHistory` is enough — outcome keys for extras
   are prefixed by `${planId}_` and are already cleared by
   `clearPlanOutcomes`.
   - `src/store/historyStore.ts`
   - **Risk**: low. One-line addition; mirrors the existing pattern
     for `entries` and `overrides`.
   - **Rollback**: `git revert 90ef6b3`.

4. **`aa09ad7` — Correct misleading JSDoc on completionStateToAction**
   The doc on `completionStateToAction` claimed `deferred → day_off
   (does NOT advance rotation)`. `rotationEngine.computeCurrentDayIndex`
   actually advances the pointer for all three action types
   (`complete`, `skip`, `day_off`). Re-worded to state the truth and
   point at the engine function for anyone debugging progression
   semantics. Doc only.
   - `src/modules/workout-outcomes/types.ts`
   - **Risk**: none.
   - **Rollback**: `git revert aa09ad7`.

5. **`59ec028` — Add test for extraEntries cleanup in plan-delete cascade**
   Extends `planDeleteCleanup.test.ts` with a third integration-style
   test: seeds plan A with 2 extras and plan B with 1 extra, creates
   outcomes for each extra via `makeExtraWorkoutInstanceId`, simulates
   the PlansPage delete cascade for plan A, and asserts plan B's extra
   + outcome survive while plan A's are gone. Also adds
   `extraEntries: []` to the `beforeEach` store reset.
   - `src/store/__tests__/planDeleteCleanup.test.ts`
   - **Risk**: none. Test-only.
   - **Rollback**: `git revert 59ec028`.

### Tests

- Before: 169 pass / 1 fail.
- After: **171 pass** (+1 fix, +1 new test).

### User-visible behavior changes

1. Deleting a plan now also removes ad-hoc extra workouts (yoga / swim
   / any off-rotation workout) logged against it. Previously those
   stayed in localStorage forever.

Nothing else affects UI, CSV export/import, rotation advancement, or
the PWA manifest.

### Not implemented (recommendations only)

- `swap_slot` override UI — product decision still needed.
- Double-day bonus outcome capture — needs UX path for a second modal.
- Progression reset button — scope decision (single group vs all).
- Plan-expiry banner dismiss — wants a persisted-dismissal design.

Medium-complexity feature work was intentionally skipped this run to
keep scope narrow around correctness. Baseline was close to clean
(169/170); a pure-correctness run lands the suite green without
layering in anything that needs separate review.

---

## 2026-04-17 run — branch `claude/funny-galileo-6zMOl`

Baseline: 156 tests pass (inherited from 2026-04-16 run).
End state: **170 tests pass**, `npx vite build` succeeds.

All changes are additive or deletions of verified-dead code. The
rotation engine, calendar projection, run-adaptation engine, and CSV
import/export paths were **not** modified.

### Commits (oldest → newest)

1. **`a8227ae` — Add IMPLEMENTATION_PLAN.md for 2026-04-17 audit**
   Dated architecture summary + prioritized plan appended to the file.

2. **`3e83c25` — Clear plan outcomes when deleting a plan**
   `PlansPage` delete handler now calls `clearPlanOutcomes` alongside
   `clearPlanHistory`. Fixes orphaned `WorkoutOutcome` records — the
   function existed and was tested but had never been wired into the UI.
   - `src/pages/PlansPage.tsx`
   - **Risk**: none. Adds cleanup; no engine / no projection changes.
   - **Rollback**: `git revert 3e83c25`.

3. **`2bff88e` — Clear outcome record when history entry is undone or deleted**
   Adds `removeOutcome(instanceId)` to `outcomeStore`. Wired into:
   - `TodayPage` Undo
   - `HistoryPage` entry delete
   - `CalendarPage` Clear button in the day-detail modal
   Keeps the history and outcome stores in lockstep so re-opening the
   OutcomeModal after an Undo no longer pre-populates a stale outcome.
   - `src/store/outcomeStore.ts`, `src/pages/TodayPage.tsx`,
     `src/pages/HistoryPage.tsx`, `src/pages/CalendarPage.tsx`
   - **Risk**: low. The new action is a single Zustand set.
   - **Rollback**: `git revert 2bff88e`.

4. **`32de834` — Remove unused uiStore**
   `useUIStore` had zero importers anywhere in `src/`. Deleted.
   - `src/store/uiStore.ts` (deleted)
   - **Risk**: none. Verified by grep.
   - **Rollback**: `git revert 32de834`.

5. **`78a9152` — Default history plan filter to active plan when available**
   When `activePlanId` is set AND that plan has at least one logged
   entry, `HistoryPage` opens with its filter pre-selected to the active
   plan instead of "All plans". Falls back to "all" otherwise.
   - `src/pages/HistoryPage.tsx`
   - **Risk**: low; UX-only default change. User can still switch filters.
   - **Rollback**: `git revert 78a9152`.

6. **`ddc93d6` — Add tests for removeOutcome and plan-delete cleanup**
   - `removeOutcome` unit tests (single removal, no-op on missing id,
     progressionStates isolation) appended to `outcomeStore.test.ts`.
   - New `planDeleteCleanup.test.ts` — integration-style test that seeds
     two plans, deletes one, and asserts cleanup cascades across the
     three stores and leaves the sibling plan untouched.
   - +137 lines of test code.
   - **Rollback**: `git revert ddc93d6`.

7. **`724ca92` — Add history stats summary to HistoryPage**
   Selected medium-complexity feature, narrow slice:
   - New pure helper `src/lib/historyStats.ts` (`computeHistoryStats`).
   - 9 unit tests covering totals, inclusive windows (7-day, 30-day),
     streak definition (complete or day_off; skip or gap breaks it).
   - 4 stat tiles (Streak / 7-day / 30-day / Total) rendered above the
     entry list in `HistoryPage`. Respects the plan filter — stats
     recompute when the user changes the dropdown.
   - **Risk**: low. Pure derivation, zero engine changes, no new deps.
   - **Rollback**: `git revert 724ca92`.

### Tests

- Before: 156 pass.
- After: 170 pass (+14).
- New files:
  - `src/lib/__tests__/historyStats.test.ts` (9 tests)
  - `src/store/__tests__/planDeleteCleanup.test.ts` (2 tests)
- Additions to existing:
  - `src/store/__tests__/outcomeStore.test.ts` (+3 `removeOutcome` tests)

### User-visible behavior changes

1. Plan delete now truly removes everything — previously outcomes
   leaked into localStorage indefinitely.
2. Undo on Today (and Delete / Clear on History & Calendar) also clears
   the saved outcome — previously re-opening an entry after undoing it
   would re-populate stale outcome fields.
3. HistoryPage opens pre-filtered to the active plan when possible.
4. A 4-tile stats summary now sits above the entry list.

Nothing here affects CSV export/import or the PWA manifest.

---

## 2026-04-16 run

Generated: 2026-04-16

Changes are listed in commit order (oldest first).

---

## 1. Fix Skip button: log history entry instead of advance override

**Commit**: `1f3ed3c`

**Summary**: `handleSkip()` in `TodayPage` was calling `actions.advance()` (which writes an override entry) instead of `actions.skip(planDayIndex)` (which writes a history entry with action='skip').

**Why it mattered**: Clicking Skip did not record any history entry. The day appeared as `past_unlogged` on the calendar. The rotation advanced via override rather than via a logged entry, meaning the behavior was subtly different from what all other parts of the system expected. If overrides were cleared or the rotation was re-computed differently, the skipped day's effect on the rotation would disappear.

**Files changed**: `src/pages/TodayPage.tsx`

**Risk**: Low. The fix aligns Skip with how every other logged action works. Skip now creates a HistoryEntry with action='skip', visible in history and on the calendar.

**Rollback**: `git revert 1f3ed3c`

---

## 2. Fix updateEntryAction: restore planDayIndex when changing away from day_off

**Commit**: `3fa7753`

**Summary**: When the history editor changed an entry from `day_off` to `complete` or `skip`, the `planDayIndex` field stayed `undefined` (because it was `undefined` when the entry was first logged as day_off). The updated function accepts an optional `planDayIndex` parameter and uses it when switching away from day_off.

**Why it mattered**: After a day_off → complete toggle, the history entry would show `planDayIndex = undefined`, causing the plan day display to fall back to "Unknown day". The rotation engine itself ignores `planDayIndex`, so rotation logic was unaffected, but the display was incorrect.

**Files changed**: `src/store/historyStore.ts`

**Risk**: Very low. The function signature extended with an optional parameter — all existing callers are backward compatible.

**Rollback**: `git revert 3fa7753`

---

## 3. Fix getFutureProjection: delegate to getUpcomingDays for consistency

**Commit**: `88bbb71`

**Summary**: `getFutureProjection` in `calendarProjection.ts` had its own projection loop that diverged from `getUpcomingDays` by not applying today's overrides and not advancing for `day_off` entries. Replaced with a simple delegation to `getUpcomingDays`.

**Why it mattered**: `getFutureProjection` is currently unused by active pages, but if called, it would have produced incorrect projections. The inconsistency was also confusing.

**Files changed**: `src/engine/calendarProjection.ts`

**Risk**: Very low. Function is dead code — no callers in active pages. The cleanup reduces confusion for future readers.

**Rollback**: `git revert 88bbb71`

---

## 4. Remove dead isActive=true variable from OutcomeModal

**Commit**: `746509f`

**Summary**: `const isActive = true` in `OutcomeModal.tsx` was always true and existed as a remnant of earlier states where certain form sections would be hidden for non-active completion states. All remaining completion states (completed/partial) show all fields, so the guard was dead code. Removed the variable and its conditional wrappers.

**Why it mattered**: The code pattern `{isActive && (<div>...)}` was confusing to readers — it looks like a meaningful condition but always evaluates to true. Cleaned up 6 unnecessary conditional wrappers.

**Files changed**: `src/components/workout/OutcomeModal.tsx`

**Risk**: None. Purely cosmetic — identical runtime behavior.

**Rollback**: `git revert 746509f`

---

## 5. Add rotation engine test suite (37 tests)

**Commit**: `302fcba`

**Summary**: Added comprehensive tests for `rotationEngine.ts` covering: `mod()`, `computeCurrentDayIndex()` (with various entry types, overrides, startDayIndex, wrap-around, deduplication of duplicate entries), `getTodayResolvedDay()` (all status transitions, override application), `getUpcomingDays()` (projection, wrap-around, override effects, prior day integration), and `isPlanExpired()` (both weeks and rotations modes, day_off exclusion from rotation count).

**Why it mattered**: The rotation engine is the most business-critical piece of logic in the app and had zero test coverage. The tests now document expected behavior, catch regressions, and revealed two test-writing mistakes that clarified how the engine actually works.

**Files changed**: `src/engine/__tests__/rotationEngine.test.ts` (new file)

**Risk**: None. Tests only — no production code changed.

**Rollback**: `git revert 302fcba`

---

## 6. Add unsaved-changes guard to PlanBuilderPage

**Commit**: `9914b84`

**Summary**: Added an `isDirty` flag that is set when any plan metadata or day/slot is edited. The back button now calls `safeNavigate()` instead of `navigate()` directly. If there are unsaved changes, a confirmation modal appears asking "Keep editing" or "Discard". The dirty flag is cleared on successful save.

**Why it mattered**: Users could lose all edits by tapping the back button or navigating away without any warning. This is a common source of frustration in form-heavy UIs.

**Files changed**: `src/pages/PlanBuilderPage.tsx`

**Risk**: Low. The guard only adds a confirmation step — users can still discard. The `isDirty` state is local and doesn't persist.

**Rollback**: `git revert 9914b84`

---

## 7. Add plan expiry/completion indicators

**Commit**: `5805553`

**Summary**: Added `isPlanExpired()` calls to both `TodayPage` and `PlansPage`. On TodayPage, a purple banner appears when the plan has completed all its scheduled rotations/weeks. On PlansPage, the "Active" badge changes to "Complete" (purple) for expired active plans.

**Why it mattered**: `isPlanExpired()` existed in the engine but was never called from the UI. Users had no indication that they'd finished their program.

**Files changed**: `src/pages/TodayPage.tsx`, `src/pages/PlansPage.tsx`

**Risk**: Low. `isPlanExpired()` is a pure function, already tested. The visual indicator is additive.

**Rollback**: `git revert 5805553`

---

## 8. Add plan filter to History page + fix empty state check

**Commit**: `467e225`

**Summary**: When multiple plans have history entries, a dropdown filter appears in the History page header to filter entries by plan. The entry count updates to reflect the filter. An empty message shows when the selected plan has no entries. Also fixed the initial empty-state check to use `entries.length` instead of `sorted.length`, so the empty state doesn't show when only the filter produces zero results.

**Why it mattered**: Users with multiple plans could not easily find entries for a specific plan. All entries were mixed together.

**Files changed**: `src/pages/HistoryPage.tsx`

**Risk**: Very low. The filter is additive. Single-plan users see no change. The empty state fix is strictly correct.

**Rollback**: `git revert 467e225`

---

## 9. Fix notes drift between HistoryEntry and WorkoutOutcome stores

**Commit**: `435d983`

**Summary**: When notes were edited via the History modal, only `HistoryEntry.notes` was updated. `WorkoutOutcome.notes` (in outcomeStore) stayed stale, meaning the `OutcomeModal` on TodayPage would show old notes if "Edit outcome" was tapped. Added `updateOutcomeNotes()` to outcomeStore and calls it in `HistoryPage.saveAndClose()`.

**Why it mattered**: Notes could diverge between two stores, causing confusing UX: history list shows one note, outcome modal shows another.

**Files changed**: `src/store/outcomeStore.ts`, `src/pages/HistoryPage.tsx`

**Risk**: Very low. The new `updateOutcomeNotes` is a simple patch operation on existing state. No-ops when no outcome record exists.

**Rollback**: `git revert 435d983`

---

## 10. Remove duplicated makeWorkoutInstanceId in OutcomeModal

**Commit**: `0863e99`

**Summary**: `OutcomeModal` had a local `buildWorkoutInstanceId()` function that was an exact re-implementation of the exported `makeWorkoutInstanceId()` from `outcomeStore`. Removed the local function and imported the shared one.

**Why it mattered**: The format `${planId}_${calendarDate}` was defined in two places. Any future format change would require updating both.

**Files changed**: `src/components/workout/OutcomeModal.tsx`

**Risk**: None. Behavioral identity — same output, one less definition.

**Rollback**: `git revert 0863e99`

---

## 11. Add historyStore test suite (28 tests)

**Commit**: `cfd4c36`

**Summary**: Added comprehensive tests for `historyStore` covering: `addEntry` deduplication, `logAction` planDayIndex semantics for day_off vs complete/skip, `updateEntryAction` planDayIndex restoration (the bug fixed in commit `3fa7753`), `removeRetroJumpForDate` override filtering by type and planId, `removeEntry`, and `clearPlanHistory`. The persist middleware is mocked as a pass-through so tests run in the Node environment without localStorage.

**Why it mattered**: The historyStore contains business-critical state mutations. The `updateEntryAction` fix (commit `3fa7753`) had no test coverage — this suite now verifies both the happy path and the bug-fixed day_off → complete transition.

**Files changed**: `src/store/__tests__/historyStore.test.ts` (new file)

**Risk**: None. Tests only.

**Rollback**: `git revert cfd4c36`

---

## 12. Add outcomeStore test suite (17 tests)

**Commit**: `efe89fb`

**Summary**: Added tests for `outcomeStore` covering: `makeWorkoutInstanceId` format, `setOutcome`/`getOutcome` deduplication, `updateOutcomeNotes` (including the no-op when outcome is absent and the empty-string → null coercion), `logOutcomeWithProgression` for non-run slots, progression-ineligible run slots, and the full progression advancement path, plus `clearPlanOutcomes` prefix filtering.

**Why it mattered**: `updateOutcomeNotes` was newly added to fix notes drift (commit `435d983`). Testing it validates the new path and documents that it is a no-op when no outcome record exists.

**Files changed**: `src/store/__tests__/outcomeStore.test.ts` (new file)

**Risk**: None. Tests only.

**Rollback**: `git revert efe89fb`

---

## 13. Add getResolvedDaysRange and buildMonthGrid tests (30 tests)

**Commit**: `e0d5eba`

**Summary**: Added tests for `getResolvedDaysRange` (the calendar grid's core function) covering: status assignment for past/today/future, pointer advancement rules (past unlogged = no advance, logged entry = advance, today/future always advance), override application order, rotation boundary wrap, historyEntry attachment, and the documented edge case where dates before `plan.startDate` are passed directly to the engine. Also covers `buildMonthGrid` grid structure (complete weeks × 7 cells, `isCurrentMonth` accuracy, single `isToday` marker, `resolvedDay` attachment).

**Why it mattered**: `getResolvedDaysRange` is the most complex function in the codebase with subtle pointer-advancement rules. Two test assertions had to be corrected during writing, which helped clarify how advance overrides interact with past unlogged days.

**Files changed**: `src/engine/__tests__/calendarProjection.test.ts` (new file)

**Risk**: None. Tests only.

**Rollback**: `git revert e0d5eba`

---

## 14. Fix WorkoutDayCard dynamic Tailwind border class

**Commit**: `2053931`

**Summary**: `WorkoutDayCard` constructed the border color class name at runtime using `border-${meta.bgColor.replace('bg-', '')}`. Tailwind's CSS purger scans source files for complete class name strings — dynamically constructed names (e.g. `border-orange-500`) can be omitted from the production CSS bundle, making the pending-state left border invisible. Fixed by adding a static `borderColor` field to `WorkoutMeta` in `constants.ts` and using `meta.borderColor` directly.

**Why it mattered**: Silent production CSS failure. The pending-state card border (the only visible difference between "today's workout" and a generic future day) could disappear in production builds.

**Files changed**: `src/lib/constants.ts`, `src/components/workout/WorkoutDayCard.tsx`

**Risk**: None. Same visual behavior, now guaranteed to be included in the CSS bundle.

**Rollback**: `git revert 2053931`

---

## 15. Document resolveWorkoutDisplayTarget isFromProgression=false edge case

**Commit**: `6893e35`

**Summary**: Added a test to `engine.test.ts` documenting that when a progression state's `currentTargetDistanceMiles` equals the template's `targetDistanceMiles`, `isFromProgression` is `false` and no adaptation note is shown. This is intentional design (target unchanged → no indicator) but was undocumented.

**Why it mattered**: The edge case was noted in TEST_RESULTS.md as "worth documenting in tests". Now documented with an explanation of when it occurs (progression initialised at baseline or reset to baseline).

**Files changed**: `src/modules/run-adaptation/__tests__/engine.test.ts`

**Risk**: None. Tests only.

**Rollback**: `git revert 6893e35`

---

## 16. Fix buildMonthGrid: don't show pre-plan dates as past_unlogged

**Commit**: `f1971d2`

**Summary**: When viewing a calendar month in which a plan started mid-month (e.g., plan starts Jan 15 but the grid spans from Dec 28), dates before `plan.startDate` were passed to `getResolvedDaysRange`, which returned them as `past_unlogged` with the `startDayIndex` workout shown. Those dates pre-date the plan and should not display workout data. Fixed by clamping `fromDate` to `plan.startDate` before calling `getResolvedDaysRange`. Pre-start cells now have `resolvedDay = undefined` and render as neutral/inactive (the `CalendarPage` already handles this gracefully). Also added a guard for the case where the entire viewed month is before the plan started.

**Why it mattered**: Users viewing the month their plan started would see incorrect workout labels and `past_unlogged` indicators on days before they'd ever used the app.

**Files changed**: `src/engine/calendarProjection.ts`

**Risk**: Low. The CalendarPage already handles `resolvedDay = undefined` (non-interactive neutral cell). The fix is additive — it only restricts the range passed to `getResolvedDaysRange`, not the range of cells rendered.

**Rollback**: `git revert f1971d2`
