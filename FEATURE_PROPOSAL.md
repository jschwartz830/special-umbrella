# Feature Proposals

## Pass 72 — 2026-07-05 (branch `claude/dreamy-mccarthy-80hikp`)

---

### Proposal: Rotation Cycle Progress Chip

**Status**: Implemented in this pass.

---

#### Feature selected

**"X/Y cycle" progress indicator in the Today page habit summary row (rotation plans only)**

For users on rotation-duration plans (e.g., a 4-day upper/lower split running 12 rotations), the habit summary row now shows how far through the current rotation cycle they are: "2/4 cycle" means 2 of 4 days are logged in this rotation pass.

---

#### Why this feature

The infrastructure was already fully built and tested:
- `computeRotationCycleProgress` in `historyStats.ts` has been exported, documented, and tested since pass 62.
- It uses the same deduplication guards as `isPlanExpired` — consistent semantics.
- It returns `{ doneInCycle, rotationLength, remaining, justCompletedRotation }`.

Despite being production-ready, no UI component called it. The Today habit row is the natural home — it already shows streak and total workouts. For a rotation plan user, "where am I in this cycle" is the third most relevant piece of information (after streak and total count).

---

#### Why this is low-risk

- Zero new state — reads from existing `planEntries` already subscribed by `useActivePlan`.
- Zero new imports to new modules — `computeRotationCycleProgress` is in the already-imported `historyStats`.
- Conditional render — chip is absent for weeks-duration plans (returns null), so no weeks-plan UI regression.
- No data mutation — purely additive display.
- The number displayed cannot go out of sync because `computeRotationCycleProgress` is computed from the same `planEntries` array that drives all other stats on the page.

---

#### Alternative considered

Show the cycle chip as a progress bar instead of a text fraction. Rejected — the existing plan ring already encodes overall plan progress as an arc, and a second bar would create visual noise. The text fraction "2/4 cycle" is information-dense and matches the style of the streak/workouts chips.

---

## Pass 71 — 2026-07-03 (branch `claude/dreamy-mccarthy-4ywaek`)

---

### Proposal: PR Badges in History View

**Status**: Implemented in this pass.

---

#### Feature selected

**Exercise Personal Record badges on history workout items**

When browsing the History page, weight-training workouts that set a new all-time load or reps record (at the time they were logged) now show a small trophy badge inline with the set count: "Load PR", "Reps PR", or "Load & reps PR".

---

#### Why this feature

The PR infrastructure was already mostly built:
- `exerciseHistoryStore` stores maxLoad/maxReps per exercise per session
- `computePersonalRecords` in `historyStats.ts` computes all-time PRs for the PR export table
- `TodayPage` shows a PR celebration banner immediately after logging
- What was missing: retroactive visibility in the history view — you couldn't look at a past workout and know it was a PR when you did it

This is the natural third piece of the PR tracking story. It closes the loop between "I set a PR today" and "this is my historical record."

---

#### Expected user value

When users browse their history, they'll see which workouts were personal records at the time. This helps them:
- Identify peak performance periods
- Understand how their training has progressed
- Feel proud of specific past sessions without navigating to the PR table

---

#### Implementation scope

Narrowest viable slice:
1. `computeWorkoutPRFlags(workoutInstanceId, allRecords)` utility in `historyStats.ts` — pure function, fully testable
2. Optional `prFlags` prop on `OutcomeMetrics` — shows badge when either flag is true
3. HistoryPage passes `prFlags` to both rotation and extra workout `OutcomeMetrics` instances

---

#### Assumptions

- A session sets a PR only if it **strictly exceeded** (not tied) all prior sessions for the same exercise by calendarDate. This means a session that ties an existing PR does NOT get a badge — only the first time a new high was set.
- The badge reflects the state at log time: if a session was a PR when logged but has since been surpassed, it still shows the badge. This is the more informative behavior (it answers "was this a PR when I did it?").
- Only load and reps PRs are shown. Volume (sets × reps × load) is not included — it's more complex to interpret and already shown in the PR table if needed.

---

#### Open product / UX decisions

1. **Tied PRs**: Should a session that matched (but didn't exceed) the prior best get a badge? Current: No. Rationale: "first time this high was reached" is cleaner than "every time this high was matched."
2. **Badge prominence**: Currently a subtle text badge inline with set count. Could be made more prominent (separate row, animation) for big PRs.
3. **Per-exercise granularity**: The badge currently says "Load PR" if any exercise in the session set a load PR. It doesn't say which exercise. A future improvement could list the exercises ("Bench Press PR").

---

#### Architecture / schema impact

None. Pure addition:
- New function in existing `historyStats.ts`
- New optional prop on existing `OutcomeMetrics`
- New import in existing `HistoryPage`
- No new store state, no localStorage keys, no schema changes

---

#### Risks

- **Performance**: `computeWorkoutPRFlags` is called for each rendered workout item in HistoryPage. It does an O(n) scan of `allExerciseRecords` for each exercise in the session. For a personal tracker with ~1000 total records and ~10 exercises per session, this is ~10,000 operations per item. With 50 visible history items, that's ~500,000 array iterations on each render. This could be a concern for users with long history. Mitigation: the `allExerciseRecords` array is stable across renders (Zustand memoizes it), so it could be pre-indexed per exercise name if performance becomes an issue. Not doing it yet (YAGNI).
- **Correctness on date ties**: If two sessions have the same `calendarDate` for the same exercise (shouldn't happen in normal use, but could with CSV import), the "prior" filter (`calendarDate < session.calendarDate`) would treat them as simultaneous and neither would be marked as a PR. Edge case: acceptable for now.

---

#### Rollback strategy

Single commit revert of commit `d050db6`:
- Remove `computeWorkoutPRFlags` from `historyStats.ts`
- Revert `OutcomeMetrics.tsx` prop addition and badge JSX
- Revert `HistoryPage.tsx` import and prop passing
- No data migrations needed

---

#### What is intentionally NOT being built yet

- Per-exercise PR breakdown in the badge (e.g., "Bench Press: Load PR")
- Volume PRs
- PR badge on TodayPage's outcome confirmation (already covered by the celebration banner)
- PR badge in CalendarPage
- PR persistence / notifications
- "Most recent PR" indicator in the PR table

---

## Pass 61 — 2026-06-19 (branch `claude/dreamy-mccarthy-7ugj5k`)

---

### Proposal: Copy workout to clipboard

**Status**: Implemented in this pass.

---

#### Problem

The TodayPage renders rich workout detail — exercises, sets, reps, load, run distances, structured intervals — but provides no way for a user to extract that information. Common use cases:

- Paste into Apple Notes / Obsidian for a training log
- Send to a coach via iMessage before the session
- Screenshot alternative that works on any device
- Paste into a spreadsheet for manual tracking

---

#### Solution

A single-tap copy button renders to the right of "Start Workout" when a workout is pending. One tap → formatted plain text lands on the clipboard.

**Example output (weights day)**:
```
Push Day — Mon, Jun 19
Plan: Strength Block

Chest & Shoulders (weights)
  • Bench Press: 5x5 @ 185lb
  • Overhead Press: 4x8 @ 115lb
  • Push-up: 3xmax
```

**Example output (structured run)**:
```
Speed Work — Mon, Jun 19
Plan: Marathon Block

Intervals (run)
  • Warmup 1mi @ easy
  • Fast 800s x6 800m @ 5K
  • Cooldown 0.5mi @ easy
```

**Example output (rest day)**:
```
Rest — Mon, Jun 19
Plan: Marathon Block

Rest Day (rest)
```

---

#### Implementation

Two components:

1. **`src/lib/shareWorkout.ts`** — pure function, no side effects, no React imports, no new dependencies.
   - `formatWorkoutForClipboard(planDay: PlanDay, planName: string, dateLabel: string): string`
   - Handles: weight exercises (numeric or SetSpec[] sets), run targetDistance, structured run/swim segments, durationMin, notes, structureDescription, multiple slots per day.
   - No trailing whitespace on any output line.

2. **`src/pages/TodayPage.tsx`** — minimal change:
   - Import `Copy` from `lucide-react` (already installed).
   - `useState<boolean>` for the 2-second "copied" state.
   - `handleCopyWorkout()` using `navigator.clipboard.writeText()` with silent error swallow.
   - Wrap the Start Workout button in a flex row; add the Copy icon button to the right.

---

#### Alternatives considered

| Alternative | Rejected because |
|-------------|-----------------|
| Web Share API (`navigator.share`) | Falls back to clipboard on desktop; adds complexity; clipboard is sufficient for MVP |
| Export to PDF | Requires a PDF library (new dependency) — overkill for a simple share use case |
| QR code generation | New dependency; use case unclear (recipient would need the app to decode) |
| Add share icon inside the active workout tracker | User hasn't started the workout yet at copy time; proposal scoped to pre-start |

---

#### Risk

Very low. Purely additive. No schema changes. No new dependencies. Revert with one commit. The `navigator.clipboard` API is available in all modern mobile browsers (iOS Safari 13.4+, Chrome 66+). Permission denial is silently swallowed — worst case is no-op.

---

### Future proposals (not implemented)

#### A. Copy workout result after completing

After completing a workout, the user could copy a summary: "Completed Push Day — 5x5 Bench @ 185lb, 4x8 OHP @ 115lb. Jun 19."

**Complexity**: Medium. Requires reading from `outcomeStore` and merging with plan data.
**Priority**: Medium — useful for coaches and training logs.

#### B. Share plan as YAML

Export the current active plan's YAML to clipboard so it can be shared, backed up, or imported into another device.

**Complexity**: Low. Plans are already YAML (stored as raw text in `planStore`). A simple clipboard copy of `plan.yaml` would suffice.
**Priority**: Low — power-user feature.

#### C. Structured share via Web Share API

Use `navigator.share({ title, text, url })` to open the native iOS/Android share sheet, targeting social apps, notes, mail.

**Complexity**: Low. Wrap the existing `formatWorkoutForClipboard` output in a `navigator.share` call with a `navigator.clipboard` fallback.
**Priority**: Medium — better UX on mobile vs. raw clipboard.

---

## Pass 62 — 2026-06-21 (branch `claude/dreamy-mccarthy-zu4z6a`)

---

### Proposal: Personal record celebration banner on TodayPage

**Status**: Implemented in this pass.

---

#### Problem

The app tracks personal records via `exerciseHistoryStore` (per-exercise max load and max reps). This data surfaces in HistoryPage's PR table, and the pre-workout hint shows "· PB" next to the previous session summary. However, there is no feedback at the moment of achievement — the user logs their workout and sees nothing special even if they just broke a record they'd been chasing for months.

---

#### User value

Immediate, in-context positive reinforcement at the highest emotional peak of the interaction loop (just after logging a hard workout). This is the moment when the user is most receptive to celebrating progress and most likely to feel the app "gets it." Without this, the PR is only visible if the user navigates to HistoryPage — a step most users skip.

---

#### Implementation scope for this run

A stateless, dismissible amber banner in TodayPage that:
1. Detects PRs in `handleOutcomeConfirm` by comparing today's logged loads against the pre-workout all-time max
2. Shows up to 3 exercise names in the banner (truncates with "+ N more" if needed)
3. Dismisses on X click or Undo
4. Shows no banner if no weights were logged or no PR was achieved

---

#### Assumptions

- PR detection compares `actualLoad` (from `LoggedSetActual`) against `maxLoadByExercise` (computed from `exerciseHistoryStore.records`).
- Only completed sets (`s.completed === true`) with a numeric `actualLoad` count.
- Reps PRs are NOT detected — only load PRs. Reps PRs are less common to celebrate and harder to compare (different exercise, different day).
- The `maxLoadByExercise` snapshot is taken at the START of `handleOutcomeConfirm`, BEFORE `logOutcomeWithProgression` runs. This ensures we're comparing against the previous all-time max, not the current session's logged value.

---

#### Open product / UX decisions

1. **Persistence**: The banner is ephemeral React state — it disappears on page reload. Should PRs be stored so the banner can re-appear if the user closes and reopens the app on the same day?
2. **Edit flow**: If the user edits an existing workout and increases a load, the banner will appear again. Is this correct behaviour or noise?
3. **Banner position**: Currently shown between the "Completed today" section and the workout card. Should it be shown above everything else, as a modal, or as a toast at the bottom?
4. **Multi-PR threshold**: If 10 exercises hit PRs, should all be shown (potentially a very long banner)? Currently capped at 3 + "N more".

---

#### Architecture / schema impact

None. Fully stateless — no new store state, no localStorage keys, no schema changes. The `newPRs` state is `useState<string[] | null>` local to TodayPage.

---

#### Risks

- False positive on edit: a user re-logging an old session with higher corrected values will see the PR banner even if they didn't actually do a PR today.
- The `maxLoadByExercise` memo includes ALL historical exercise records. For a first-time user logging their first workout, `prevMax=0` so any load will be a PR. This seems correct (first session IS a PR) but may feel unexpected.

---

#### Rollback strategy

Single commit revert of `src/pages/TodayPage.tsx`:
- Remove `newPRs` state
- Remove detection block in `handleOutcomeConfirm`
- Remove banner JSX
- Remove `Trophy` from lucide import

No data migrations, no schema changes.

---

#### What is intentionally NOT being built yet

- Reps PRs
- PR persistence across reloads
- Toast-style notification (bottom of screen)
- Modal celebration (too disruptive for routine logging)
- PR history / streak ("3rd week in a row hitting a PR on Bench Press")

---

## Pass 73 Feature: Last session summary on upcoming workout cards

### Problem

Upcoming workout cards in TodayPage show the workout name and a session count chip, but no contextual history. A user looking at "Tomorrow: Squat / Bench / Deadlift" has no quick way to see what they did last time without navigating away. The prior-session context is already computed for today's card — the upcoming list uses identical logic.

### Proposed solution

Add a single muted "Last: …" line below each upcoming card using existing infrastructure:
- `findPreviousSessionForPlanDay(planId, planDayIndex, today, planEntries, allOutcomes)` — already imported, used for today's card
- `buildLastSessionSummary(outcome, maxLoadByExercise)` — already imported, formats a one-liner

Wrap in a `useMemo` keyed to `[plan, upcoming, today, planEntries, allOutcomes, maxLoadByExercise]`. Render the string as a `<p className="text-[10px] text-slate-500 mt-0.5 ml-1 truncate">Last: …</p>` below the existing `upcomingNote` (adaptation note).

### Constraints

- No new dependencies
- No new store state or localStorage keys
- No schema changes
- Purely additive JSX; card is unchanged when no prior session exists

### Status

**Implemented in pass 73.**
