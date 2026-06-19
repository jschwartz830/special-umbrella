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
