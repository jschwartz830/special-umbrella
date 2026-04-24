# Feature Review — Dismissible Plan Expiry Banner

Date: 2026-04-24
Branch: `claude/great-mccarthy-hYhLK`
Classification: **Keep**

## What was actually built

- `src/hooks/useExpiryDismiss.ts` — a 35-line hook that reads/writes a
  per-plan localStorage key (`wpt_expiry_dismissed_v1_<planId>`). Exports
  `{ isDismissed, dismiss }`. Catches localStorage exceptions so missing
  or blocked storage degrades gracefully (banner stays visible).
- TodayPage updated: reads `{ isDismissed: expiryBannerDismissed, dismiss:
  dismissExpiryBanner }` from the hook. The banner is hidden when
  `isDismissed` is true. A small `×` button (aria-labeled "Dismiss")
  triggers `dismissExpiryBanner`. No store changes.
- 6 storage-contract tests in `src/hooks/__tests__/useExpiryDismiss.test.ts`.

## Assumptions Encoded

1. Per-plan dismissal is the right granularity — new plans start fresh
   automatically because they have a different planId.
2. Dismissed once means dismissed permanently (no TTL, no re-surface).
3. localStorage failure → banner remains visible (fail-open, not fail-closed).

## What Worked Well

- Extremely narrow scope: one new file, five changed lines in TodayPage.
- Zero coupling to any store or engine logic.
- Per-plan isolation falls out naturally from the key design — no explicit
  "reset on plan change" logic needed.

## What Feels Risky or Incomplete

- No way to un-dismiss from the UI. The only escape hatch is clearing
  localStorage (`wpt_expiry_dismissed_v1_<planId>`). This is acceptable
  for now but might frustrate a power user who accidentally dismisses.
- The banner disappears immediately on click with no animation or
  confirmation. Fine given the stakes (can always see via Plans page), but
  the snap-to-hidden may feel abrupt on slow devices.

## What I Should Evaluate Tomorrow

1. Does the dismiss feel intentional, or does the × feel too easy to
   accidentally tap on mobile?
2. Should the Plans page show a "Completed" badge for expired plans
   (already done) AND note when the expiry banner was dismissed?
3. Is there a future need to re-surface the banner after a plan is
   re-activated or cycled? If so, the current hook would need a `reset()`
   path (one extra localStorage.removeItem call).

## Recommended Next Steps

- Ship as-is; the friction reduction is real and the implementation is
  minimal.
- If users report accidental dismissal, add a "Show again" option to the
  Plans page or a brief undo toast.
- Consider the `dismiss()` + optional TTL variant only if the "permanent
  dismiss" assumption proves wrong.

## Classification

**Keep.** The narrowest viable slice works — one hook, one banner change,
six tests. No architectural decisions encoded. Fully reversible with one
commit revert.

---

# Feature Review — ExtraWorkoutEntry.source Field

Date: 2026-04-18
Feature commit: `d865ff9`
Classification: **Keep with one open tweak decision**

## What was actually built

An optional `source?: 'history' | 'double_day'` field on
`ExtraWorkoutEntry`. Three call sites updated:
- TodayPage double-day bonus → `'double_day'`
- HistoryPage "Add workout for this day" → `'history'`
- CalendarPage "Add workout for this day" → `'history'`

Undo on TodayPage now filters: removes extras where
`source !== 'history'` (i.e., double_day and old records without a
source). Extras tagged `'history'` survive Undo.

## What assumptions were encoded

- Old `ExtraWorkoutEntry` records in localStorage have `source ===
  undefined`. The filter `source !== 'history'` treats them as
  double_day — they are removed on Undo.
- If you want old records to survive Undo, change the filter to
  `source === 'double_day'` in `TodayPage.tsx:~333`.

## What worked well

- The type change is genuinely backward-compatible — undefined is
  handled explicitly, TypeScript is happy, no migration.
- The three creation paths are all small and easy to verify.
- The Undo filter is a single line and the intent is documented in
  the code comment above it.
- 6 store-level tests lock the invariant.

## What feels risky or incomplete

- **Old-record treatment**: Treating undefined as double_day is
  conservative but could surprise a user who had manually-added extras
  before upgrading. This is pre-existing behavior (prior to this commit,
  Undo cleared ALL extras), so it is not a regression — but it's worth
  a conscious product decision.
- **No History badge**: The `source` field now exists but History still
  shows the generic "Extra" pill for all extras. Double-day extras could
  show "Via double-day" to help users understand their history. This
  is intentionally out of scope for this commit; it's a one-line JSX
  change when desired.

## What I should evaluate

1. Do you want old extras (source undefined) treated as double_day
   (current: removed on Undo) or history (left alone on Undo)?
2. Do you want a badge in History for `source === 'double_day'` extras?

## Recommended next steps

- Decide on the undefined treatment (see above) — if you want to
  change it, the fix is one character: `!== 'history'` → `=== 'double_day'`.
- Optionally add a "Via double-day" badge in HistoryPage's extra entry
  render block (`kind === 'extra'` branch, around line 492).

## Classification

**Keep** — the schema change is minimal, additive, and backward-
compatible. The Undo behavior is strictly better than before. The one
open question (undefined treatment) is a product preference, not a
correctness issue.

## Rollback

`git revert d865ff9`. Old records are unchanged; the only effect
is that Undo on Today reverts to clearing all extras for the date
(prior behavior).

---

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
