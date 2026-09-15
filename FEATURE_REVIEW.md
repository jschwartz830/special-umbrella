# Feature Review: Last-week recap banner

## Status: Implemented

Committed in branch `claude/admiring-noether-2d6ce2`, commit `8553a9c`.

## Implementation review

### Hook (`useLastWeekSummary`)

- All hooks called unconditionally — no Rules-of-Hooks violations.
- `isMonday` check via `Date.getUTCDay() === 1` — UTC-based, consistent
  with `isoWeekStart` in `historyStats.ts`.
- `lastWeekStart = isoWeekStart(today) - 7 days` — correct; this is always
  the Monday of the previous week.
- Returns `null` when `breakdown` is absent (no entries for the plan that
  week), so the banner never shows a "0 completed" ghost row.
- Dismissal key: `wpt_lastweek_v1_${planId}_${weekStart}`.  The `_v1_`
  prefix allows a future schema bump to invalidate old keys cleanly.

### TodayBanners

- New prop `lastWeekSummary: LastWeekSummary | null` — typed via exported
  interface, not inlined.
- Render guard: `lastWeekSummary && !lastWeekSummary.isDismissed` — two
  conditions, no extra state.
- Banner placed at the top of the stack (before expiry banner).  This
  ensures it's visible without scrolling but is also the first thing the
  user can dismiss if unwanted.

### TodayPage

- Hook called unconditionally before `if (!plan || !todayResolved)`.
- Uses `plan?.id ?? null` so it degrades safely to `null` (hook's no-op
  path) when no plan is active.

## Known limitations

- No unit tests for `useLastWeekSummary` — the hook is a thin composition
  of already-tested primitives and requires a mock for `useDismissableBanner`
  (localStorage side-effects). Acceptable tradeoff for an overnight session.
- Banner is Monday-only.  Some users log on Tuesday after a rest day;
  they would miss it.  This could be expanded to Mon–Wed in a follow-up
  without API changes.
