# Feature Proposals

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
