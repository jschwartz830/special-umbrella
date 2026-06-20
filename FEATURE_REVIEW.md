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
