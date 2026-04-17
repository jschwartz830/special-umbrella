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
