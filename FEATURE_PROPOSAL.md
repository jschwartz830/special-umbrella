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
