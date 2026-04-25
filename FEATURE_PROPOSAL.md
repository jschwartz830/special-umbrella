# Feature Proposal — Plan Progress Computation

Date: 2026-04-25
Branch: `claude/great-mccarthy-0XEfh`
Status: **Proposed — implementing this run**

---

## Feature selected

Add a `computePlanProgress` pure function to `src/lib/historyStats.ts` that
returns how far through a plan's defined duration a user has progressed —
as a percentage, a completion count, and a total count — for both
`rotations`-type and `weeks`-type plans.

---

## Why it was selected

The app knows when a plan expires (`isPlanExpired`) but has no concept of
*how close* a user is to completion. Users have no signal that they are,
say, 70% through a 12-week plan or 3 of 4 rotations done. This gap makes
it hard to feel momentum or plan transitions.

Selection criteria met:
- Adjacent to `historyStats.ts` and `rotationEngine.isPlanExpired` (same domain).
- Pure function — no store, no UI, no side effects.
- Easy to unit-test fully with the existing test fixture style.
- Narrowest viable slice: just the calculation, not the display.
  PlansPage can render it independently in a future commit.
- No new dependencies.

---

## Expected user value

PlansPage and TodayPage can show "3 of 4 rotations done" or "Week 5 of 8"
without any additional data. This is a prerequisite for a future progress
bar or completion countdown. Even without UI, the function is useful as an
auditable pure helper.

---

## Implementation scope for this run

1. Add `computePlanProgress(plan, entries, today)` to `src/lib/historyStats.ts`.
   Returns `{ completed: number; total: number; percentComplete: number }`.
2. Add a full test suite in `src/lib/__tests__/historyStats.test.ts`.
3. **Not** wiring up any UI — keeps the PR reviewable without browser testing.

---

## Assumptions

- Weeks-based: `completed` = calendar weeks elapsed since startDate (capped at total).
  A "week" is 7 calendar days. Partial weeks count as `floor(days / 7)`.
- Rotations-based: `completed` = `floor(completeSkipCount / plan.days.length)`.
  `day_off` entries do not count (mirrors `isPlanExpired` semantics).
- `percentComplete` is 0–100, capped at 100.

---

## Open product / UX decisions

- Should partial-week progress be reflected (e.g., 6.5 weeks done)?
  *Decision: no — floor for simplicity, matches how weeks-expiry works.*
- Should the percentage be shown in PlansPage or TodayPage?
  *Decision: not decided this run; leaving for daytime review.*

---

## Architecture / schema impact

None. Pure function added to an existing lib file. No store changes.

---

## Risks

Very low. Additive pure function, fully tested. The only risk is a wrong
formula that could mislead users — mitigated by tests covering all edge cases.

---

## Rollback strategy

Delete or revert the function and its tests. No data is written, no store
is modified.

---

## What is intentionally not built yet

- UI rendering in PlansPage or TodayPage.
- "Days until completion" countdown.
- Progress bar component.
- Notification or banner when > 90% complete.

---

# Feature Proposal — Dismissible Plan Expiry Banner

Date: 2026-04-24
Branch: `claude/great-mccarthy-hYhLK`
Status: **Proposed — implementing this run**

---

## Feature selected

Add a per-plan dismiss button to the "Plan complete!" expiry banner on
TodayPage, with dismissal state persisted to localStorage so it survives
page reloads and is isolated by plan.

---

## Why it was selected

The plan-expiry banner has been listed as an open recommendation in every
overnight audit pass from the first through the ninth. The banner is useful
exactly once — the first time the user sees it — but continues showing on
every visit with no way to dismiss it. This is a genuine friction point:

- Zero architectural changes required (no store, no engine).
- Isolated localStorage key per planId — no migration, no schema impact.
- Easy to review (one new hook + one TodayPage change).
- Trivially revertable (revert two files; no data loss).

---

## Expected user value

Users who have finished a plan no longer see the "Plan complete!" banner
on every subsequent visit. The informational notification becomes one-time,
which matches the user's expectation after they've acknowledged it.

---

## Implementation scope for this run

1. Add `src/hooks/useExpiryDismiss.ts` — a thin hook that reads/writes a
   per-plan localStorage key (`wpt_expiry_dismissed_v1_${planId}`).
   Exports `{ isDismissed, dismiss }`.
2. TodayPage calls the hook and conditionally renders the banner.
3. The banner gets a small `×` dismiss button.
4. No store changes. No migration.

---

## Assumptions being made

- Per-plan persistence is the right granularity (not per-session, not global).
- After dismiss, the banner never needs to re-appear for the same plan.
- localStorage is available (assumed throughout the app already).
- A simple key-presence check is sufficient (no TTL, no "show N times" logic).

---

## Open product / UX decisions

1. Should dismissal reset if the user creates a new plan? No (new plan =
   new planId = new key = fresh state automatically).
2. Should there be a way to un-dismiss (e.g., from Plans page)? Not
   implemented; clearing localStorage is the escape hatch.
3. Should the banner re-appear after some time? Not implemented; dismissed
   means dismissed until the key is cleared.

---

## Architecture / schema impact

- No Zustand store changes.
- One new file: `src/hooks/useExpiryDismiss.ts` (~15 lines).
- One changed file: `src/pages/TodayPage.tsx` (~5 lines).
- New localStorage key `wpt_expiry_dismissed_v1_${planId}` is namespaced and
  isolated from all existing store keys (`wpt_plans`, `wpt_history`, etc.).

---

## Risks

- Very low. If localStorage is unavailable (sandboxed environments, private
  browsing quota reached), the hook catches the exception and the banner
  remains visible — correct fail-safe.
- Changing the key prefix (e.g., if naming conventions change) would silently
  un-dismiss all existing dismissals. Low risk, easily documented.

---

## Rollback strategy

`git revert <feature-commit>` removes the hook and the TodayPage wiring.
The banner reverts to always-visible behavior. No stored user data is affected.

---

## What is intentionally not being built yet

- "Remind me in 7 days" / dismiss with TTL.
- "Mark as started" vs "mark as complete" distinction for the banner.
- Un-dismiss affordance from Settings or Plans page.
- Any animation/fade-out on dismiss.

---

# Feature Proposal — ExtraWorkoutEntry.source Field

Date: 2026-04-18
Branch: `claude/overnight-audit-improvements-RzBkA`
Status: **Proposed — implementing this run**

---

## Feature selected

Add an optional `source?: 'history' | 'double_day'` field to
`ExtraWorkoutEntry`, wire it through the three creation paths, and use
it to scope the Undo button on TodayPage so it only removes extras that
originated from the double-day flow — not extras manually added by the
user from the History or Calendar pages.

---

## Why it was selected

The fifth-pass REVIEW_NOTES left an explicit open question:

> "Should Undo on Today distinguish 'double-day bonus' extras from
> manually-logged extras? That's a schema change; I didn't take it."

Currently, Undo on TodayPage clears ALL extra entries for this plan on
today (commit `28f7905`). That was intentional but imprecise: a user who
adds a yoga session from the History page on today's date and then hits
Undo on Today for a separate workout loses their manually-added yoga.
The UX expectation is that Undo undoes the primary workout logging, not
a separately-initiated entry.

The source field is the minimal change to resolve this without
over-engineering: no new UI, no store restructure, just a tag on the
record that lets callers filter correctly.

---

## Expected user value

- Undo on Today no longer deletes manually-added extra workouts for the
  same date.
- History and Calendar page "Add workout" entries survive an Undo.
- No behavior change for users who don't add manual extras on today's
  date (the common case).

---

## Implementation scope for this run

1. Add `source?: 'history' | 'double_day'` to `ExtraWorkoutEntry` in
   `src/types/index.ts`.
2. Update `addExtraEntry` in historyStore to accept `source` in its
   payload type.
3. Update the double-day creation path in TodayPage to pass
   `source: 'double_day'`.
4. Update the "Add workout for this day" paths in HistoryPage and
   CalendarPage to pass `source: 'history'`.
5. Update the Undo click handler in TodayPage: instead of
   `clearExtraEntriesForDate(plan.id, today)`, iterate extras and remove
   only those where `source === 'double_day'` (or `source` is
   `undefined`, which is all old data — treat conservatively as
   double_day to avoid leaving orphaned extras on upgrade).
6. Add store-level tests: source is persisted, Undo scoping works, old
   entries without source are handled.

---

## Assumptions being made

- Old `ExtraWorkoutEntry` records in localStorage have no `source`
  field. Treating them as `double_day` (remove on Undo) is conservative
  but avoids stranding them. The user can always re-add them from
  History/Calendar if needed.
- `source: 'history'` covers both HistoryPage and CalendarPage
  user-initiated extras; there's no need to distinguish between those
  two call sites for Undo purposes.

---

## Open product / UX decisions

- Should `source` be surfaced to the user in the History page? (e.g.,
  show "Via double-day" badge instead of just "Extra".) Not implementing
  this pass — it's a display decision and can be added later.
- Should the "double_day" label be renamed to distinguish future call
  sites? Current enum is minimal; extend if more sources appear.

---

## Architecture / schema impact

- `ExtraWorkoutEntry` gains an optional field — fully backward-
  compatible. Old records without the field will have `source ===
  undefined` at runtime.
- No migration needed. Old records remain valid; the only effect is
  that on upgrade, old extras without a source will be treated like
  double-day extras if Undo is pressed on the same date.
- `addExtraEntry` payload type widens — callers that don't pass `source`
  are unaffected (TypeScript optional field).

---

## Risks

- Low. No rotation engine changes. No new persisted store shape beyond
  one optional field on an existing type.
- The conservative treatment of old records (treat undefined as
  double_day) could surprise a user who had manually added extras
  before upgrading and then hits Undo. This is pre-existing behavior
  (Undo already removed all extras), so it is no regression.

---

## Rollback strategy

`git revert <feature-commit>` removes the source field from the type,
the creation-path wiring, and the Undo scoping. The `clearExtraEntriesForDate`
call is restored. Old localStorage data is unaffected since old records
never had the field anyway.

---

## What is intentionally not being built yet

- Visual badge in History/Calendar to display the source ("Via
  double-day").
- Filtering extras by source in the stats or history.
- A formal migration that backfills `source` on old records.

---

# Feature Proposal — History Stats Summary

Date: 2026-04-17
Branch: `claude/funny-galileo-6zMOl`
Status: **Implemented** (`724ca92`)

## What it is

A four-tile read-only summary row at the top of the History page:

| Tile     | Value                                                        |
|----------|--------------------------------------------------------------|
| Streak   | Consecutive days ending today with `complete` or `day_off`. Skip or a gap day breaks it. |
| 7-day    | Count of `complete` entries within the last 7 days (inclusive of today). |
| 30-day   | Count of `complete` entries within the last 30 days (inclusive of today). |
| Total    | Lifetime count of `complete` entries.                        |

All values derive from the existing `HistoryEntry[]` list after the
plan filter has been applied. No new persisted state.

## Why this slice

From IMPLEMENTATION_PLAN.md, it was the only option that met all of:

- Adjacent to existing state (read-only projection of history)
- Zero engine or rotation coupling
- Completable and testable in a single commit
- Visibly useful (users currently have no "at-a-glance" progress signal)
- No new dependencies

## Design decisions

### Streak definition

Consecutive calendar days ending at today containing either a
`complete` or `day_off` entry. Justification: this tracker respects
day_off as a deliberate rest, so a streak that punishes rest days
would be hostile. Skip or gap breaks the streak.

Alternate we rejected: "consecutive days with complete only". Simpler
but punishes rest.

### Window edges

Inclusive. A "7-day" tile with today + 6 prior days → counts 7 entries
max. That matches users' intuitive "this week" framing.

### Timezone handling

Window math uses UTC-based date shifting on YYYY-MM-DD strings. Since
HistoryEntry.calendarDate is always a user-local date string that we
never reinterpret as a timestamp, this avoids DST edge cases entirely.

### Scope — what we deliberately didn't do

- **No chart/graph**. 4 numbers cover the most common "how am I doing"
  questions. A chart adds surface area, a library, and a design
  decision about granularity.
- **No streak "best ever"**. Requires iterating all entries. Easy to
  add later if users ask.
- **No per-workout-type breakdown**. Would require coupling to slot
  data. Out of scope.
- **No active-plan filter override**. The stats automatically respect
  whichever plan filter is selected above.

## Placement

Tiles sit inside the header `<div>` below the CSV toolbar. Hidden when
the filtered entry list is empty (keeps the "no entries for this plan"
message visually primary).

## Testing

- 9 unit tests in `src/lib/__tests__/historyStats.test.ts` covering
  empty list, totals, window edges, streak definition, and the
  skip-breaks-streak / gap-breaks-streak rules.
- Production build verified (308 kB JS, 24 kB CSS).

## Rollback

`git revert 724ca92` removes the tiles and the helper; nothing else
depends on `src/lib/historyStats.ts`.

## Possible follow-ups (not implemented)

- Per-plan stats when filter = "all" (requires grouping).
- Best-ever streak counter.
- Trend arrow (7-day delta vs. prior 7-day).
- Tap a tile → scroll the entry list to that window.
