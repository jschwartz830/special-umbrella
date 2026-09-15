# Feature Proposal: Last-week recap banner

## Summary

Add a dismissable "Last week recap" card to the Today page that appears
on Mondays and shows the previous ISO week's workout counts for the active
plan.

## Motivation

Users who check the app on Monday have no at-a-glance view of how last
week went.  The Calendar page has this data but requires navigation.
A banner on Today surfaces it in one tap.

## Design

**When shown:** Only on Mondays, only when the active plan logged at least
one entry in the previous week.  Null on all other days → zero extra renders.

**What it shows:**
```
📊 Last week recap
   5 completed · 2 bonus · 1 skipped
```

**Dismissal:** keyed to `planId_weekStart` in localStorage via the
existing `useDismissableBanner` pattern.  The key includes the week-start
date so the banner resets automatically each new Monday — no explicit
reset logic needed.

## Implementation

1. `src/hooks/useLastWeekSummary.ts` — new hook.  Calls `computeWeeklyBreakdown`
   (already exported from `historyStats.ts`) over `[lastMonday, lastSunday]`.
   Returns `LastWeekSummary | null`.
2. `src/components/today/TodayBanners.tsx` — new `lastWeekSummary` prop,
   sky-toned card rendered before the expiry banner.
3. `src/pages/TodayPage.tsx` — import hook, call it above the early-return
   guard, thread result into `TodayBanners`.

## Risks

Low.  All infrastructure (`computeWeeklyBreakdown`, `useDismissableBanner`,
`isoWeekStart`) already exists and is well-tested.  No new state mutations.
The hook returns null on non-Mondays so the render cost on other days is
a single `useMemo` + `useState` pair.
