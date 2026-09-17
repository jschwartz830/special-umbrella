# Review Notes — Overnight Audit Run
_Date: 2026-09-17_

---

## Executive Summary

1. **What changed:** 7 commits — 2 bug fixes (visible UI bug, missing route), 2 performance improvements, 1 code quality cleanup, 1 correctness fix (expressionEval), 1 combined commit with defensive guards + tests + CSV improvement. 6 new tests added (1377 total, all pass).

2. **Highest confidence:** CalendarPage day-header alignment fix. Clear visual bug; the grid cells were correct, the headers were not. Zero logic risk.

3. **Riskiest change implemented:** expressionEval `lbs` regex change — behavior change for expressions containing `lbs` suffix. In practice, the tokenizer already extracted the number correctly for simple cases, so the only real behavior change is fixing compound expressions like `0.75 * squatlbs`. Low risk in practice.

4. **Review first:** The CalendarPage alignment fix (commit a80004e) — it's the only change that affects visible UI behavior and is the most user-facing.

---

## Biggest Issues Found

### Fixed this run
- **CalendarPage header misaligned with weekStartsOn** — Headers showed wrong day names for Monday-first users. Visible bug on every calendar view.
- **No 404 catch-all route** — Unknown URLs silently rendered empty pages.
- **expressionEval `lbs` regex** — Compound load expressions with `lbs` suffix silently looked up wrong variables.
- **Pace functions divide-by-zero** — Zero distance produced Infinity; could corrupt stored outcome data via future callers.

### Documented, not fixed
- **CalendarPage selectedIdx stale** (CalendarPage.tsx:604) — `useState` initializer only runs once; if `DayDetailModal` reopens for the same date with a different `rd.planDayIndex` (e.g., after an override changes the displayed day), `selectedIdx` stays stale and the user logs the wrong rotation day. Medium risk, requires understanding the full modal lifecycle before touching.

- **TodayPage rotation advance before outcome confirmed** (TodayPage.tsx:619–621) — `actions.advance()` fires on "complete" tap before the outcome modal is confirmed. Dismissing the outcome modal leaves the rotation advanced with no automatic rollback. The Undo button exists as recovery. This is a product decision (advance immediately so the user sees the right next workout), not a clear-cut bug.

- **storeSync beforeunload data loss** (storeSync.ts:165) — `pushStore` is async; the browser doesn't wait for inflight promises during page teardown. Changes made in the last 1.5s before tab close may be lost silently. The correct fix uses a `keepalive` fetch, which requires bypassing the Supabase JS client for that one call. Medium-high architectural change.

- **removeRetroJumpForDate UTC date slice** (historyStore.ts:191) — Uses `.slice(0,10)` on `appliedAt` assuming a local-time timestamp format, but `addOverride` stores UTC ISO by default. Near midnight in UTC-negative zones, a real-time `jump` override could fail to match its intended removal. Very hard to trigger in practice; well-documented in the codebase.

---

## Improvements Completed

| # | Change | Type |
|---|---|---|
| 1 | CalendarPage DAYS header aligned with weekStartsOn | Bug fix |
| 2 | App.tsx: 404 catch-all redirect to /today | Bug fix |
| 3 | calendarProjection: removed dead code + mod re-export | Cleanup |
| 4 | historyStore: removeLastOverrideByType O(n log n) → O(n) | Performance |
| 5 | outcomeStore: clearPlanOutcomes prefix check | Performance |
| 6 | expressionEval: /lbs?$/i in resolveLoad | Bug fix |
| 7 | types.ts: zero-distance guard in pace functions | Defensive fix |
| 8 | csv.ts: warning for malformed planStartDate | UX improvement |
| 9 | 6 new regression tests | Test coverage |

---

## No Medium-Complexity Feature This Run

The audit surfaced enough high-priority fixes that feature work was deferred. The codebase is stable and well-tested, but the CalendarPage state machine (selectedIdx, modal lifecycle, retroactive jump cleanup) has several subtle issues that deserve attention before adding new surface area.

**Recommended feature for next run:** A persistent "session notes" display on TodayPage. The `WorkoutOutcome.notes` field already exists and is editable, but the last session's notes are not surfaced in the "Last session" hint on TodayPage. This would be a narrow addition to `buildLastSessionSummary` and `TodayPage`.

---

## Definitely Keep

- All 7 commits — each is small, well-scoped, and passes the full test suite.

## Probably Keep but Tweak

- Nothing this run.

## Do Not Keep

- Nothing this run.

## Recommendations Only (Not Implemented)

1. **CalendarPage selectedIdx stale** — Fix the `DayDetailModal`'s `selectedIdx` initialization. Rather than `useState(planDayIndex)`, use a `key` prop on the modal component tied to the calendar date (or a combination of `date + planDayIndex`) so React re-mounts it with fresh state when it opens for a different context. This is a one-line change but requires confirming the modal's animation behavior when re-mounted.

2. **applyOverridesForDate pre-compute** — Before the main date loop in `getResolvedDaysRange`/`computeCurrentDayIndex`, build a `Map<string, OverrideEntry[]>` from local date → overrides. The `format(new Date(ov.appliedAt), 'yyyy-MM-dd')` conversion currently runs inside the inner loop; pre-computing it eliminates ~N × overrides Date constructions per render.

3. **storeSync keepalive** — Replace the `beforeunload` async push with a `fetch(..., { keepalive: true })` call to the Supabase REST endpoint directly. The Supabase JS client does not expose a `keepalive` option, so this requires constructing the upsert URL and headers manually. Medium complexity.

4. **CalendarPage canDayOff cleanup** — `const canDayOff = true` is an always-true variable that masks the effective condition `!hasEntry`. Remove it and simplify the condition. Low risk but low priority.

5. **progression.ts unreachable fallback** — Line 101: `const mode = primaryEx.progressionMode ?? 'single'` — `primaryEx` was selected because `progressionMode != null`, making the `?? 'single'` unreachable. Simplify to `const mode = primaryEx.progressionMode`.

6. **TodayPage rotation advance timing** — Consider whether `actions.advance()` should fire after the user confirms the outcome modal rather than immediately on "complete" tap. The current approach is intentional (shows the correct next workout while the modal is open) but creates a gap where dismissing the modal leaves the rotation advanced. A product decision is needed before changing this.

7. **CSV run slot config loss on round-trip** — A run slot with no `runSubtype` loses its `runConfig` entirely on CSV reimport (the entire run config block is gated on `if (row.runSubtype)`). Consider falling back to a default subtype or preserving individual fields independently.

---

## Open Questions

1. Should marking a day as `day_off` count toward plan progress/expiry? Currently it advances the rotation pointer but not the progress counter — the rotation wheel turns but the odometer does not. Is this intentional? (rotationEngine.ts:78,313)

2. Should `completionStateToAction('planned')` silently return `'complete'`? A stale or incorrectly written outcome in the 'planned' state would advance the rotation pointer as if the workout was completed. Would an explicit error or warning be better?

3. For the `storeSync beforeunload` reliability issue: is Supabase sync considered authoritative enough that data loss on tab-close is a real concern, or is localStorage always the source of truth?

4. The `perceivedEffort` null value defaults to 3 (middle) for the progress branch but to 0 (lowest) for the regress branch in `progression.ts`. A user who forgets to log effort gets a free progression but never a regression. Is this the intended default behavior?

---

## Known Issues / Incomplete Work

- The CalendarPage selectedIdx stale bug was found but not fixed — it requires confirming modal animation behavior before a `key`-prop fix.
- No UI-layer tests exist for any page component. The test suite is strong at the engine/library/store level but has no coverage of the page components' state machines.

## Dependencies Added

None.
