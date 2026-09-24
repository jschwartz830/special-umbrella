# FEATURE_PROPOSAL.md
## Feature: Day-of-Week Workout Breakdown

---

### Feature selected
`computeDayOfWeekBreakdown` — a pure function that returns active workout counts grouped by ISO weekday (Monday through Sunday), with optional plan scoping and today-based future-date filtering.

---

### Why it was selected
- **Adjacent to existing logic**: `computeWeeklyBreakdown` already groups by ISO week using the same helper infrastructure; grouping by day-of-week is a natural complement.
- **Reduces friction**: Users can see "I tend to skip Wednesdays" or "I'm most consistent on Mondays" without manually tallying. This is a common pattern in fitness apps.
- **No architectural changes**: Pure function, no new store, no new component. It fits directly alongside `computeWeeklyBreakdown` in `historyStats.ts`.
- **Audit found no urgent bugs**: The codebase is stable and well-tested, making a small feature addition the highest-value next action.

---

### Expected user value
Surfaces training patterns at a glance. A "days of the week" breakdown chart in the History page would help users answer:
- "Which day do I work out most often?"
- "Am I actually hitting the gym on weekdays like I plan to?"
- "Where are my consistency gaps?"

---

### Implementation scope for this run
- Added `computeDayOfWeekBreakdown` and `DayOfWeekStat` to `src/lib/historyStats.ts`
- Added 14 tests in `src/lib/__tests__/historyStats.test.ts`
- **Not implemented**: UI wiring — no changes to pages or components

---

### Assumptions being made
1. "Active workout" = completed rotation entry OR any extra. Same definition as `findBestWeek` and streak logic.
2. ISO weekday numbering (1=Mon, 7=Sun) is preferred over US (0=Sun) for consistency with `isoWeekStart`.
3. Deduplication by `(planId, calendarDate)` is necessary to prevent CSV import noise from inflating counts.

---

### Open product / UX decisions
1. **Where to display this in the UI?** Likely in `HistoryPage.tsx` alongside the weekly breakdown chart. Could also appear in a "stats" widget on the Today page. Not decided.
2. **Bar chart or grid?** A horizontal bar chart (one bar per day) is the most natural representation. A 7-column heatmap grid is another option.
3. **All-plans or per-plan?** The function supports both. The History page already has a plan filter, so `planId: null` (all-plans) when "All plans" is selected and specific planId otherwise would be consistent.
4. **Should skips be shown as a separate count?** Currently excluded from `count`. Could add a `skippedCount` field for a stacked bar visualization.

---

### Architecture or schema impact
- No schema changes. No new stores. No new routes.
- `DayOfWeekStat` is a new interface in `historyStats.ts` — no changes to existing interfaces.
- The private `isoDay` helper is module-scoped (not exported) — no API surface increase beyond the public function.

---

### Risks
- **Low risk**: Pure function, no side effects, no store changes, no UI changes in this slice.
- **Potential confusion**: If UI is added later without a `today` guard, future-dated bad imports could inflate counts. The `today` parameter exists to prevent this — callers must pass it explicitly.

---

### Rollback strategy
Delete the `computeDayOfWeekBreakdown` function, `DayOfWeekStat` interface, and `isoDay` helper from `historyStats.ts`. Remove the import and `describe` block from the test file. No other files reference the new code.

---

### What is intentionally not being built yet
- **UI component** — no chart, no display logic, no page changes
- **`skippedCount` or `dayOffCount` fields** — adding dimensions would require a product decision about visualization design
- **Day-of-week recommendation engine** — e.g., "You've been skipping Thursdays; consider moving your long run" — out of scope for this slice
