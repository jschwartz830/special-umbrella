# Feature Reviews

## Pass 61 — 2026-06-19 (branch `claude/dreamy-mccarthy-7ugj5k`)

---

### Review: Copy workout to clipboard

**Status**: Implemented and tested.
**Verdict**: Ship as-is. Low risk, clear value, well-contained.

---

#### Code review

**`src/lib/shareWorkout.ts`**

```typescript
export function formatWorkoutForClipboard(
  planDay: PlanDay,
  planName: string,
  dateLabel: string,
): string
```

- Pure function: no imports from React, Zustand, or date-fns. Can be called from any context.
- Handles all `WorkoutSlot` content variants:
  - `exercises` (weights): numeric sets, `SetSpec[]` sets, optional load
  - `segments` (run): warmup/interval/cooldown with reps, distance, pace
  - Fallback details: `targetDistance`, `durationMin`, `notes`
  - `structureDescription` appended after slot body
- Slot type label: `slot.type.replace(/_/g, ' ')` — converts `long_run` → `long run`, `recovery_run` → `recovery run`.
- No trailing whitespace: validated by a dedicated test.
- Output is deterministic for identical inputs.

One known gap: `slot.warmup` (an optional `ExerciseSpec[]`) is not rendered. This is an intentional scope decision — warmup is rarely used and the clipboard text is not a functional record.

**`src/pages/TodayPage.tsx` changes**

```tsx
const [workoutCopied, setWorkoutCopied] = useState(false)

function handleCopyWorkout() {
  const dateLabel = format(parseISO(today), 'EEE, MMM d')
  const text = formatWorkoutForClipboard(primaryPlanDay, plan!.name, dateLabel)
  navigator.clipboard.writeText(text).then(() => {
    setWorkoutCopied(true)
    setTimeout(() => setWorkoutCopied(false), 2000)
  }).catch(() => {
    // Clipboard access denied — silently no-op
  })
}
```

- `plan!.name` — the non-null assertion is safe here because `plan` is already guarded upstream; this code only runs when `isPending` is true, which requires a valid `plan`.
- `primaryPlanDay` — the existing variable that holds the resolved plan day for today. Already used by the surrounding render.
- `format(parseISO(today), 'EEE, MMM d')` — consistent with other date labels in the file.
- `setTimeout` for reset: 2000 ms is correct for a brief "copied" indicator. No memory leak risk — the component is long-lived (TodayPage stays mounted).

**Button layout**:

```tsx
{isPending && activeWorkoutState === 'hidden' && (
  <div className="flex items-center gap-2">
    <button ... className="flex-1 ...">
      <Play size={18} />
      Start Workout
    </button>
    <button
      onClick={handleCopyWorkout}
      aria-label="Copy workout to clipboard"
      title="Copy workout"
      className={`flex items-center justify-center px-3.5 py-3.5 rounded-xl border ...`}
    >
      <Copy size={18} />
    </button>
  </div>
)}
```

- `flex-1` on Start Workout preserves its width dominance; Copy button is icon-only.
- `aria-label` and `title` both set for accessibility and hover tooltip.
- Emerald highlight state on success is visually distinct from the default slate style.
- `active:scale-[0.96]` on the copy button — consistent with press feedback used elsewhere in the app.

---

#### Test review

All 15 tests in `shareWorkout.test.ts` are unit tests on the pure function. They:

- Use factory functions (`makeRestDay`, `makeWeightsDay`, `makeRunDay`, `makeStructuredRunDay`) to construct `PlanDay` inputs.
- Assert on `result.startsWith(...)`, `result.split('\n')[1]`, `result.toContain(...)`, and line-level `trimEnd()` equality.
- Cover all branching paths in `formatWorkoutForClipboard` and `formatExerciseSpec`.

The TodayPage copy button is not tested at the component level (no new Vitest component tests added). Integration testing at the component level is out of scope for this overnight pass — the pure function is the critical unit.

---

#### What would make this better (future work)

1. **Add `slot.warmup` rendering** — prepend warmup exercises before main exercises with a "Warmup:" label.
2. **Web Share API fallback** — on iOS/Android, `navigator.share()` would open the native share sheet. The formatter output is already the right input. A one-line `navigator.share` wrapper with clipboard fallback would improve mobile UX.
3. **Component test** — a Vitest component test that mocks `navigator.clipboard` and verifies the button's emerald state after click.
4. **Copy after completion** — a similar button in the post-workout summary view that includes actual reps/weights logged.

---

#### Reversibility

Revert is a single commit touching 2 files:
- Remove `src/lib/shareWorkout.ts`
- Revert `src/pages/TodayPage.tsx` (remove Copy button, `workoutCopied` state, `handleCopyWorkout`, `Copy` import)

No data migrations, no store schema changes, no localStorage keys affected.

---

## Pass 62 Feature Review — Previous Session Notes Hint

### What Was Built

An optional `prevNotes` prop on `OutcomeModal` that renders a read-only italic hint above the notes textarea when logging a new (not editing) workout. The hint shows: _Last time: "[previous notes text]"_ clamped to 2 lines.

Wired to TodayPage's primary OutcomeModal call via `prevSessionOutcome?.notes`. CalendarPage and HistoryPage modals are unchanged.

### Assumptions Encoded

1. Previous notes are always plain text — rendered directly as JSX text content.
2. `line-clamp-2` is sufficient; no "show more" needed.
3. The hint should be hidden during edits to avoid confusion between what they wrote "last time" vs. what they're currently editing.
4. TodayPage-only scope is sufficient for the first iteration.

### What Worked Well

- Implementation was minimal (5 lines of JSX + 1 prop type + 1 caller change).
- The existing `prevSessionOutcome` computation in TodayPage required no changes.
- No new stores, hooks, or dependencies added.
- All 923 tests continue to pass.

### What Feels Risky or Incomplete

- **Calendar/History page gap**: Users logging retroactively via CalendarPage won't see the hint. For someone catching up on a missed workout from 3 days ago, this context would be equally valuable.
- **Long notes truncation**: `line-clamp-2` hides content without telling the user there's more. A faint "..." indicator (which CSS does provide) is the only signal.
- **No test coverage**: The hint's presence/absence can't be verified without React Testing Library.

### What to Evaluate Tomorrow

1. Open the app and log a workout after a previous session that had notes — does the hint appear correctly?
2. Try editing an existing outcome — confirm the hint is NOT shown (as intended).
3. Check on CalendarPage — confirm no hint appears there (expected: no change).

### Recommended Next Steps

1. Extend to CalendarPage: pass `prevSessionOutcome` into CalendarPage's OutcomeModal call.
2. Add a collapsed/expandable "show more" for notes longer than 2 lines.
3. Consider showing previous effort rating alongside notes for richer context.

### Classification

**Keep** — Clean, minimal, zero risk. Clearly improves the new-log flow.
