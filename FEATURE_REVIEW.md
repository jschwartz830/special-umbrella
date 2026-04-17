# Feature Review — History Stats Summary

Date: 2026-04-17
Feature commit: `724ca92`

## What to try

1. Open HistoryPage with a plan that has several recent entries.
2. Verify the 4 tiles appear above the list.
3. Change the plan filter dropdown — stats should update to match the
   filtered subset.
4. Delete today's entry (via Undo on Today, or via the History modal).
   The Streak tile should decrement or go to 0; the 7-day / 30-day /
   Total tiles should decrement by 1 if today was a `complete`.

## Review checklist

- [ ] Tiles render with consistent widths on mobile.
- [ ] Stats hide when the filtered list is empty (no "0 / 0 / 0 / 0"
      row shown on a fresh empty history).
- [ ] Streak feels right. Edit a past entry from complete → skip and
      verify the streak breaks at that date.
- [ ] 7-day / 30-day windows count today. A workout logged today is
      included, not excluded.

## Known edge cases (all tested)

- Day before today's date in the entry list but no today entry →
  streak is 0 (today must qualify).
- Skip on an intermediate day → streak resets at that day.
- Gap day → streak resets at that day.
- Empty entry list → all zeros.

## Risk assessment

None identified. The helper is pure, fully tested, and has no
persisted state. Zero coupling to rotation or progression logic. Build
passes.

## Suggested tweaks reviewers might want

- **Streak definition**: if you'd rather count "complete only" (skip or
  day_off break), edit the `streakable` filter in
  `src/lib/historyStats.ts`.
- **Tile labels**: change `Streak / 7-day / 30-day / Total` in
  `HistoryPage.tsx`.
- **Hide when there's only one or two entries**: change the render
  guard from `sorted.length > 0` to e.g. `sorted.length >= 3`.

## Rollback

`git revert 724ca92`. No migration required.
