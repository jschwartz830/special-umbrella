# IMPLEMENTATION_PLAN.md
## Overnight Audit — 2026-09-24

---

## Architecture Summary

**Stack:** React 18 + TypeScript + Zustand + Vite + Vitest + GitHub Pages PWA

**Layer structure:**
- `src/engine/` — pure rotation & calendar projection functions (no side effects)
- `src/lib/` — pure stat helpers, CSV, sharing, misc utilities
- `src/store/` — Zustand stores with `persist` middleware (localStorage)
- `src/modules/` — workout-specific sub-domains (outcomes, run-adaptation, progression)
- `src/hooks/` — React hooks that compose stores + engine
- `src/components/` — UI components
- `src/pages/` — page-level views

**Key data flow:**
1. `planStore` holds the rotation definition (days × slots)
2. `historyStore` holds log entries, overrides, and extras (all persisted)
3. `rotationEngine.ts` takes plan + entries + overrides → resolves today's workout day
4. `historyStats.ts` aggregates entries + extras → stats for the History / Today pages
5. `outcomeStore` links workout outcomes (sets/reps/pace) to workout instance IDs
6. `exerciseHistoryStore` denormalizes outcome data into per-exercise records for PR detection

---

## Product Capability Summary

- **Plan rotation**: N-day repeating schedule that advances one slot per logged day (complete / skip / day_off)
- **Calendar view**: Monthly grid showing past status and future projections
- **Today view**: Current workout, upcoming list, streaks, banners, habit summary
- **History / Stats**: Workout type breakdown, weekly breakdown, streaks, PR detection, completion rates
- **Ad-hoc extras**: Log workouts outside the rotation (double-day, yoga, etc.)
- **Program import**: YAML-based programs with expression-evaluated progressions
- **Outcome tracking**: Per-set weights, run pace/distance, swim, mobility exercises
- **CSV import/export**: Portable backup/restore of history and outcomes
- **PWA**: Offline-capable, installable on mobile

---

## Key Strengths

1. **Pure function design** — all rotation and stat logic is side-effect-free and directly testable
2. **Comprehensive test suite** — 1371 tests, 35 test files, all passing (3s run time)
3. **Consistent deduplication** — one-advancement-per-date invariant enforced uniformly
4. **Future-date guards** — consistently applied at call sites (historyStats, HistoryPage)
5. **Typed stores with migrations** — Zustand persist with versioned migration functions
6. **Good separation of concerns** — engine, lib, store, and UI are cleanly layered

---

## Key Risks / Weak Points

### Low risk (no action needed)
- **Timezone assumption**: All dates are local YYYY-MM-DD; cross-timezone use would shift history. Documented in rotationEngine.ts.
- **planId as nanoid hex**: parseWorkoutInstanceId relies on the hex alphabet to distinguish planId from the date part. Comment documents this assumption.

### Medium risk (documented, no code changes)
- **`computeWorkoutTypeBreakdown` has no built-in `today` guard**: relies on caller to pass `dateRange.to = today`. The only call site (HistoryPage.tsx:219) already does this with a comment; safe in practice.
- **`findBestWeek` `today` param is optional**: callers that omit it get all-time results including future entries. The only call site passes `today`.
- **`computeWeeklyBreakdown` range is caller-controlled**: same pattern; HistoryPage passes `toDate: today`.

### No bugs found
After thorough review of engine, stats, stores, and test suite, no logic bugs were identified. Prior overnight passes have closed known issues in future-date guards and PR detection.

---

## Prioritized Improvement Plan

| # | Item | Risk | Status |
|---|------|------|--------|
| 1 | Add `computeDayOfWeekBreakdown` to historyStats | Low | **Implemented** |
| 2 | Add tests for `computeDayOfWeekBreakdown` | Low | **Implemented** |
| 3 | Write documentation files (this file + siblings) | None | **Implemented** |
| 4 | Add `today` parameter to `computeDayOfWeekBreakdown` | Low | **Implemented (part of #1)** |

### Recommendations only (not implemented)

- **HistoryPage: surface day-of-week breakdown in UI** — The new `computeDayOfWeekBreakdown` function is implemented but not yet wired into any page. The obvious placement is in `HistoryPage.tsx` alongside the weekly breakdown chart. This is intentionally left as a product decision for the developer.
- **Add `today` guard to `computeWeeklyBreakdown` signature** — Make `today` an optional parameter that clamps `toDate` when provided. The existing call sites already pass `toDate: today`, so this would only affect new call sites. Low priority.
- **Explicit `today` guard in `computeWorkoutTypeBreakdown`** — Same as above; consider adding an optional `today` param that sets the upper bound on `dateRange.to`. The single existing call site already handles this defensively.

---

## Rationale for Sequencing

1. `computeDayOfWeekBreakdown` first because it's a concrete, additive improvement with no side effects on existing behavior.
2. Tests before documentation to keep the commit history clean (tests + impl in one commit).
3. Documentation last because it doesn't block anything.
