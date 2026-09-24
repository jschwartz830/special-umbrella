# FEATURE_REVIEW.md
## Feature: Day-of-Week Workout Breakdown

---

### What was actually built
- `computeDayOfWeekBreakdown(planId, entries, extras, today?)` in `src/lib/historyStats.ts`
- `DayOfWeekStat` interface (exported): `{ isoDay: number; dayName: string; count: number }`
- Private `isoDay(date: string): number` helper using `Date.UTC` (consistent with other date helpers in the file)
- 14 tests in `src/lib/__tests__/historyStats.test.ts`

---

### What assumptions were encoded
1. Active workout = `complete` rotation entry OR any extra (not skip / day_off)
2. ISO weekday ordering (Monday first) matches the weekly breakdown's convention
3. Deduplication by `(planId, calendarDate)` prevents CSV import inflation
4. `today` is an optional guard — callers opt into future-date filtering

---

### What worked well
- The `isoDay` helper is a clean, reusable 3-liner that fits naturally alongside `isoWeekStart`
- The deduplication pattern is copy-consistent with `computeHistoryStats`, `computeAverageWorkoutsPerWeek`, and others — no novel logic
- Tests cover all specified edge cases and the full suite still runs in ~3s

---

### What feels risky or incomplete
- **No UI**: The function is invisible to users until wired into a page. Without a concrete UI target, there's a small risk it gets redesigned when actually integrated.
- **No `skippedCount` or `dayOffCount`**: If a stacked bar chart is the eventual goal, the interface will need to be extended. This would be a non-breaking change (add fields).
- **`today` is optional**: If a future caller forgets to pass `today`, future-dated bad imports will inflate counts. The parameter could be made required to prevent this — but that would be a breaking change relative to the `computeWeeklyBreakdown` pattern (which also takes explicit ranges).

---

### What I should evaluate
1. **Where should this appear in the UI?** HistoryPage is the obvious first home, alongside the weekly breakdown.
2. **Is a 7-bar horizontal chart the right format?** Or should it live in a "training patterns" section?
3. **Should extras be shown separately from rotation completions?** Currently blended into `count`.

---

### Recommended next steps
1. Wire `computeDayOfWeekBreakdown` into `HistoryPage.tsx` under the weekly breakdown chart, gated by the plan filter (same pattern as `typeBreakdown`).
2. Render as a small horizontal bar chart (7 bars, Mon–Sun) with `count` labels.
3. Pass `today` at the call site to match the existing future-date guard pattern.

---

### Classification

**Keep** — the function is correct, tested, and ready to wire into the UI. The implementation is a prototype-quality slice (lib only, no UI), but the lib layer is production-quality.
