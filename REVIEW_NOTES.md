# Review Notes — 2026-09-15 overnight session

## What was done

Three independent changes were made on branch `claude/admiring-noether-2d6ce2`.
All 1374 tests pass (`node_modules/.bin/vitest run`).

---

## Bug fixes

### Bug #1 — `computePersonalRecords` 0-load guard (Low severity)

`computePersonalRecords` lacked the `> 0` guard that `buildPRFlagsMap`
already applies.  A bodyweight session (`maxLoad = 0`) could produce a
"0 lb" entry in the PR table with a `maxLoadDate` set.

Fix: extract `recordLoad = r.maxLoad !== null && r.maxLoad > 0 ? r.maxLoad : null`
(same pattern for `recordReps`) before the upsert logic.  Three new unit tests
added; all 1374 pass.

### Bug #2 — Undo multi-advance override (Medium severity)

In `TodayPage.tsx` the Undo handler used `removedDoubleDay: boolean`, so
calling two double-day advances then pressing Undo would only remove one
`advance` override, advancing the rotation one extra step.

Fix: changed to `advancedRotationCount: number`; `removeLastOverrideByType`
is called once per count.  No new automated tests (the Undo flow is
component-level and hard to unit-test), but the fix is a mechanical
single-variable type change with no branch logic.

---

## Feature

### Feature #3 — Last-week recap banner

A read-only Monday banner showing last week's completed / bonus / skipped /
rest totals for the active plan.

Reviewer checklist:
- [ ] `useLastWeekSummary` is called unconditionally (above the
  `if (!plan || !todayResolved)` early return) — Rules of Hooks satisfied.
- [ ] Returns `null` on non-Mondays — no accidental renders midweek.
- [ ] Dismissal key includes `weekStart` — banner resets each week without
  any manual reset logic.
- [ ] No new state mutations — purely derived from existing store data.
- [ ] `TodayBanners` prop is typed via `LastWeekSummary | null`; the banner
  renders only when non-null and `!isDismissed`.

---

## Items deferred (not implemented)

- **Refactor TodayPage session state** (Issue #3 / Code smell) — medium
  risk, out of scope for an overnight pass.
- **Align `computeCurrentStreakDates` parameter order** (Issue #4) —
  no current bug; deferred.
- **`isNaN` guard in `estimateRunDurationMin`** (Issue #5) — the existing
  `parseFloat → NaN → skip` fallback is correct; documentation-only
  improvement deferred.
- **Mobility session summary path** (Test gap #8) — not addressed;
  would need deeper exploration of `buildLastSessionSummary` swim/mobility
  branches.
