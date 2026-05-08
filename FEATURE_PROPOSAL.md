# Feature Proposal — All-Time Longest Streak (`longestStreak`)

Date: 2026-05-08
Branch: `claude/dreamy-mccarthy-gvR18`
Status: **Implemented this run**

## Feature selected

Add a `longestStreak` field to `computeHistoryStats` and surface it in the UI:

- **HistoryPage**: "Best streak: N days" line below the 4-tile stats grid
- **TodayPage**: "best N" micro-label inside the streak tile, visible only when
  the current streak is below the all-time best

## Why it was selected

`currentStreak` answers "how consistent am I right now?"; `longestStreak`
answers "what's my personal best?" — the second question is natural once users
see the first. Both metrics use the same `streakable` Set already computed in
`computeHistoryStats`, making the extension essentially free.

Selected over other candidates because:
- Zero new store subscriptions or data flows
- Entirely within the existing `computeHistoryStats` + `HistoryStats` abstraction
- Directly complements the already-visible `currentStreak`
- Easy to test with pure-function unit tests

## Expected user value

- Personal motivational benchmark: "I hit 12 days once — can I beat it?"
- Context for the current streak: streak of 5 is more meaningful if the best
  was 6 vs. if the best was 30
- No action required to see it — appears automatically alongside existing stats

## Implementation scope for this run

- `src/lib/historyStats.ts`: new `longestStreak` field in `HistoryStats`; new
  private `computeLongestStreak(Set<string>)` helper; single call added to
  `computeHistoryStats`
- `src/lib/__tests__/historyStats.test.ts`: 6 new tests + 1 updated
- `src/pages/HistoryPage.tsx`: "Best streak: N days" conditional line
- `src/pages/TodayPage.tsx`: "best N" micro-label in streak tile

## Assumptions being made

1. `longestStreak` should use the same streakable criteria as `currentStreak`
   (complete + day_off + extras). An alternative would be "workout-only" (no
   day_off), but that would create inconsistency with `currentStreak`.
2. On TodayPage, the "best N" label is only shown when `longestStreak >
   currentStreak`. When the user is at their best, showing "best N" where N
   equals the current streak is redundant noise.
3. On HistoryPage, the line is always shown when `longestStreak > 0`, even if it
   equals `currentStreak`, because HistoryPage is a historical review context
   where the stat is always relevant.

## Open product / UX decisions

1. Should the TodayPage label also show when `longestStreak === currentStreak`
   as an affirmation ("you're at your best!")?
2. Should `longestStreak` appear in the TodayPage stats bar as a dedicated tile
   instead of as a sub-label, for better discoverability?
3. Should `longestStreak` be plan-scoped (only count entries for the active plan)
   rather than across all plans? Currently it uses all entries passed in.

## Architecture / schema impact

- `HistoryStats` interface gained one new required field. Any future code that
  constructs a full `HistoryStats` literal (not via `computeHistoryStats`) must
  include `longestStreak`.

## Risks

- Low. The `streakable` Set is reused, so `longestStreak` and `currentStreak`
  are guaranteed to use identical criteria. The only risk is the interface change,
  which was handled in the existing tests.

## Rollback strategy

Revert commit `52bfee8`. The three UI callsites and the implementation are
isolated to that single commit.

## What is intentionally not being built yet

- Longest-streak animation or celebration when a new record is set
- Plan-scoped longest streak (vs. all-time across plans)
- Streak history chart / sparkline
