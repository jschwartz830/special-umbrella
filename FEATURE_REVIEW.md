# Feature Reviews

## Pass 79 — 2026-07-16 (branch `claude/dreamy-mccarthy-1jxqcb`)

### Feature: Extra-Workout Notes Workflow

#### What was actually built

Two UI additions to `HistoryPage.tsx`:

1. **"Add workout" inline form** — Added `extraNotes` state and a `<textarea rows={2}>` below the Name input. `submitAddExtra` passes `notes: extraNotes.trim() || undefined` to `addExtraEntry`. Cancel and reset also clear `extraNotes`. Applied to both form instances (under rotation-entry dates and under extra-entry dates).

2. **"Edit Workout" modal** — Added `editingExtraNotes` state, initialized from `extra.notes ?? ''` in `openExtraEdit`. `saveAndCloseExtra` passes `notes: editingExtraNotes || undefined` to `updateExtraEntry`. Save is a no-op when type, name, AND notes are all unchanged.

#### What assumptions were encoded

- Empty string on save → `undefined` (removes the field). Cannot explicitly store empty string — consistent with other nullable string fields.
- `rows={2}` used in both contexts. Compact but acceptable for short notes.
- Notes are not validated or length-limited.

#### What worked well

- Zero store or schema changes needed — `notes` was already first-class everywhere.
- Entirely additive and isolated to one file.
- Consistent behaviour between the add form and edit modal.

#### What feels risky or incomplete

- Inline form adds ~40px height per open instance. On small phones with virtual keyboard open, Add/Cancel buttons may be off-screen. **Test on 375px viewport.**
- `rows={2}` may feel cramped for longer notes.
- Notes typed in add form are lost on cancel/navigate (consistent with Name/Type fields — not a regression).

#### What to evaluate

1. Mobile layout with virtual keyboard open.
2. Notes pre-populated in edit modal from stored value.
3. Clearing a note and saving removes it from display.
4. Cancel resets textarea to empty.

#### Recommended next steps

- Consider a character limit (200–500 chars).
- Show notes in CalendarPage day detail for extra entries.
- Check if CalendarPage has its own add-extra path that also needs notes.

#### Keep / Revise / Prototype only / Reject

**Keep** — Self-contained, zero risk, completes a half-built workflow. Only open question is mobile layout.

---

## Pass 77 — 2026-07-14 (branch `claude/dreamy-mccarthy-aeym9p`)

### Feature: Streak Milestone Celebration Banner

---

#### What was actually built

A dismissable amber banner in `TodayPage.tsx` that celebrates streak milestones (7, 14, 21, 30, 60, 90, 180, 365 days). Three new artifacts:

1. **`src/hooks/useStreakMilestoneDismiss.ts`** — pure hook: computes the active milestone from a raw streak count, reads dismissal state fresh from localStorage on each render, and forces a re-render on `dismiss()`. Exports `getActiveStreakMilestone()` helper and `STREAK_MILESTONES` constant.

2. **`src/hooks/__tests__/useStreakMilestoneDismiss.test.ts`** — 13 unit tests covering null below threshold, each milestone exactly, mid-range values, above-max, STREAK_MILESTONES parity.

3. **`src/pages/TodayPage.tsx`** — `earlyPlanStreak` useMemo (computed without mobility dates, before the early-return guard), hook call, and banner JSX rendered between the consecutive-skips nudge and the run adaptation note.

---

#### What was NOT built

- **No server-side persistence of dismissal**: The dismissed state lives in localStorage only. If a user clears localStorage, the banner reappears. This is acceptable — it's a motivational banner, not critical state, and consistent with the plan-complete banner's behavior.
- **No per-day "just hit" detection**: The banner appears as long as streak ≥ milestone AND not dismissed. It does not track the exact day the milestone was crossed. If a user hits 30 days, dismisses the banner, then their streak drops and recovers to 30 days later, no new banner appears (the dismissal persists). This is a deliberate choice — re-showing a congratulation for a re-hit milestone would feel confusing.
- **No animation**: The banner appears and disappears without CSS animation. Consistent with the rest of the codebase's minimal-animation approach.

---

#### What assumptions were encoded

- **`earlyPlanStreak` vs `planStreak`**: The banner uses `earlyPlanStreak` (computed without mobility dates) due to the Rules of Hooks constraint. `planStreak` (line ~344) is defined after the early-return guard; hooks must be called before. The one-day difference is acceptable for a celebration banner.
- **Amber color chosen to distinguish from purple plan-completion banner**: The two can't appear simultaneously in practice (high skip count → streak ≈ 0), but the color difference is correct anyway.
- **Milestone = highest threshold crossed**: A streak of 25 shows the "21-day" banner, not "14-day". The user has cleared all milestones up to 21.
- **`planExpired` guard**: The banner is suppressed if the plan is expired. A completed plan showing streak celebrations would be confusing.

---

#### What worked well

- **No new dependencies**: `crypto.getRandomValues` is universally available; the hook uses only `useState`/`useCallback`.
- **Zero store coupling**: The hook reads from localStorage; it cannot corrupt Zustand state.
- **Independent dismissal per milestone**: Dismissing the 21-day banner doesn't prevent the 30-day banner from showing later. Each uses a unique localStorage key: `wpt_streak_ms_v1_${planId}_${milestone}`.
- **Rules of Hooks solution**: The `earlyPlanStreak` pattern (compute without full deps, before early-return) is clean and reusable if similar hooks are needed in the future.

---

#### Potential follow-up

- **Re-hit milestone detection**: If a user's streak drops and then recovers to a threshold they already dismissed, should the banner re-appear? Currently it does not. A versioned key (e.g., `_v2_${...}_${hitCount}`) could track re-hits — low priority.
- **Milestone animation**: A brief fade-in or confetti burst on first render. Low priority, consistent with codebase style.
- **Share streak**: A "Share" button next to dismiss for social sharing (Instagram story format). Out of scope for an overnight pass but a natural next feature.

---

## Pass 72 — 2026-07-05 (branch `claude/dreamy-mccarthy-80hikp`)

### Feature: Rotation Cycle Progress Chip

---

#### What was actually built

A conditional chip in `TodayPage.tsx`'s compact habit summary row:

```tsx
{cycleProgress && (
  <div className="flex items-center gap-1.5">
    <span className="text-sm font-bold text-white">{cycleProgress.doneInCycle}/{cycleProgress.rotationLength}</span>
    <span className="text-xs text-slate-400">cycle</span>
  </div>
)}
```

Where `cycleProgress = plan.duration.type === 'rotations' ? computeRotationCycleProgress(plan, planEntries, today) : null`.

---

#### What was NOT built

- The chip does not show the `justCompletedRotation` state — a "rotation complete 🎉" moment was considered but felt like noise that would appear briefly every N workouts and distract from the main view.
- The `remaining` field is not shown — "2/4 cycle" is equivalent to "2 remaining" for a 4-day rotation; adding both would be redundant.

---

#### What assumptions were encoded

- A cycle slot counts when it has a `complete` or `skip` history entry (same semantics as `isPlanExpired`). Day-off entries do NOT count toward cycle progress.
- For a fresh plan with 0 entries, `doneInCycle === 0` — the chip shows "0/N cycle". This is correct and not hidden, so users understand the starting state.
- Deduplication: if the same calendar date has two entries (e.g., after a CSV re-import), it counts as 1, not 2. This was fixed in pass 62 and is covered by a dedicated regression test.

---

#### What worked well

- Zero scope creep. The feature is exactly one conditional chip — 7 lines of JSX, 4 lines of computation.
- Reuses a battle-tested, already-exported function. The implementation risk was purely JSX placement, not logic.
- TypeScript clean on first compile. No new types or interfaces needed.

---

#### Potential follow-up

- If `justCompletedRotation` is true (doneInCycle === 0 and totalDone > 0), consider a brief "Cycle complete!" state instead of "0/N cycle". This could be shown for one calendar day after the reset, then revert to "0/N cycle". A low-priority cosmetic enhancement.
- A tooltip on the chip explaining what "cycle" means for new users who haven't internalized the rotation model.

---

## Pass 71 — 2026-07-03 (branch `claude/dreamy-mccarthy-4ywaek`)

### Feature: PR Badges in History View

---

#### What was actually built

1. **`computeWorkoutPRFlags`** in `src/lib/historyStats.ts` — pure utility that computes whether any exercise in a given workout session set a new all-time load or reps PR at the time it was logged. Uses strict ">" comparison against prior sessions by calendarDate.

2. **`prFlags` prop on `OutcomeMetrics`** — optional `{ hasLoadPR, hasRepsPR }` prop. When either is true, renders a small trophy-icon badge inline with the completed-set count row. Three label states: "Load PR", "Reps PR", "Load & reps PR".

3. **HistoryPage wiring** — `computeWorkoutPRFlags` called for every rotation and extra workout entry that has an outcome, using the `allExerciseRecords` from the existing `useExerciseHistoryStore` hook.

4. **10 new tests** covering edge cases: empty records, first-session PR, strict-exceed-only (tied doesn't count), regression, any-exercise-is-enough, zero/null exclusion, both-flags.

---

#### What assumptions were encoded

- A session sets a PR only when it STRICTLY exceeds all prior sessions for the exercise (not ties). This means equal-to-prior-best gets no badge.
- PR is relative to log date: the "prior" comparison uses `calendarDate < session.calendarDate`, so if today's session is the all-time best, it gets a badge even if surpassed tomorrow.
- Only `maxLoad` and `maxReps` are checked, not `totalVolume`.
- The `Trophy` icon is yellow at 90% opacity — subtle enough not to dominate but visible enough to notice.

---

#### What worked well

- The computation is completely separated from display — `computeWorkoutPRFlags` has no React dependencies and is independently testable.
- The `OutcomeMetrics` prop is additive and optional — all existing callsites work without changes.
- 10 tests cover the key cases and make the semantics explicit.
- The "at log time" semantics are correct and valuable — a PR from 3 months ago stays marked even after it's been surpassed.

---

#### What feels risky or incomplete

- **Performance**: Called once per rendered history item, not memoized. For users with large exercise history, this could slow history rendering. Low risk today but worth watching.
- **No per-exercise detail**: The badge says "Load PR" but doesn't say which exercise. With a superset of 5 exercises, the user has to guess which one set the PR.
- **Date-tie edge case**: Two sessions with identical `calendarDate` for the same exercise — neither gets a badge (the filter is strict `<`). Unlikely in normal use but possible after CSV import.

---

#### What I should evaluate

1. Does the badge appear on real data? (requires testing with actual workout history)
2. Is the badge too subtle? Try with a user who has many PRs — does the history view feel cluttered?
3. Does HistoryPage render perceptibly slower with many entries? Profile if needed.

---

#### Recommended next steps

1. If per-exercise detail is wanted: `computeWorkoutPRFlags` could return `{ loadPRExercises: string[]; repsPRExercises: string[] }` and show "Bench Press: Load PR" in the badge.
2. If performance becomes an issue: pre-compute a `Map<exerciseName, ExerciseSessionRecord[]>` once and pass it to `computeWorkoutPRFlags` instead of filtering the flat array on each call.
3. CalendarPage could show the same badge on completed workout cards.

---

#### Verdict: **Keep**

Clean implementation, additive, well-tested, no schema changes, closes the "what were my best sessions?" question directly in the flow where users look at history. The "at log time" semantics are correct and valuable.

---

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

## Pass 62 — 2026-06-21 (branch `claude/dreamy-mccarthy-zu4z6a`)

---

### Review: Personal record celebration banner

**Status**: Implemented.
**Verdict**: Probably keep, but review the edit-flow edge case before shipping.
**Classification**: Keep with revisions (see open questions below).

---

#### What was built

A dismissible amber banner in TodayPage that fires when `handleOutcomeConfirm` detects that any exercise exceeded its previous all-time max load. The banner shows the exercise names (up to 3) and a dismiss button.

```tsx
{newPRs && newPRs.length > 0 && (
  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
    <Trophy size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-amber-300">New personal record{newPRs.length > 1 ? 's' : ''}!</p>
      <p className="text-xs text-amber-400/70 mt-0.5 truncate">
        {newPRs.slice(0, 3).join(', ')}{newPRs.length > 3 ? ` +${newPRs.length - 3} more` : ''}
      </p>
    </div>
    <button onClick={() => setNewPRs(null)} aria-label="Dismiss">
      <X size={13} />
    </button>
  </div>
)}
```

Detection logic:

```typescript
const preWorkoutMaxLoad = { ...maxLoadByExercise }

// ... log the workout ...

if (outcome.weightsActual?.exercises?.length) {
  const prs = outcome.weightsActual.exercises.flatMap(ex => {
    const prevMax = preWorkoutMaxLoad[ex.exercise] ?? 0
    const todayMax = (ex.sets ?? [])
      .filter(s => s.actualLoad != null && s.completed)
      .reduce((m, s) => Math.max(m, s.actualLoad!), 0)
    return todayMax > 0 && todayMax > prevMax ? [ex.exercise] : []
  })
  if (prs.length > 0) setNewPRs(prs)
}
```

---

#### What assumptions were encoded

1. PR = load PR only (not reps).
2. `prevMax = 0` for exercises with no prior history — so first-ever log always counts as a PR. This is intentional and correct.
3. Snapshot `maxLoadByExercise` before calling `logOutcomeWithProgression`, so we compare against the pre-session all-time max (not today's value).
4. Banner is ephemeral — cleared on dismiss, Undo, or page reload.

---

#### What worked well

- The detection logic is clean and handles the concurrent-update race correctly (snapshot before the store update).
- The amber color and Trophy icon are visually distinct from other notifications without being alarming.
- Dismissing is a single tap.
- Undo also clears the banner (appropriate — if you undo the workout, the PR didn't happen).

---

#### What feels risky or incomplete

1. **Edit-flow false positive**: if the user opens the "Edit outcome" modal and increases a load beyond the pre-edit max, the banner re-fires. The user may find this misleading if they're correcting an old workout, not setting a new PR today.
2. **First-session PR surge**: a new user logging their first session will see every exercise flagged as a PR. While technically true, it may feel overwhelming or meaningless when everything is a PR.
3. **No persistence**: the banner disappears on reload. If the user navigates away and comes back, the PR moment is gone. For casual users this is fine; motivated users may want to see it again.
4. **No unit tests**: the detection logic is UI-layer code and not separately testable without component tests.

---

#### What I should evaluate tomorrow

- Open the app, log a workout with at least one exercise where you beat your previous max. Does the banner appear with the correct exercise name?
- Log a workout with no weights (e.g., a run). Verify no banner appears.
- Log a workout, see the banner, tap Undo. Verify the banner disappears.
- Edit an existing workout and increase a load. Do you find the re-appearing banner natural or confusing?

---

#### Recommended next steps

1. **Suppress on edit flow**: if `existingOutcome` is non-null when `OutcomeModal` opens, the user is editing (not logging new). Pass a flag to `handleOutcomeConfirm` so PR detection is skipped in edit mode.
2. **Reps PR**: detect `max actualReps` separately — show "Bench Press: new max load · Squat: new max reps" in the banner text.
3. **Persist for the day**: store `newPRs` in `sessionStorage` so it survives tab refreshes within the same session.

---

#### Keep / revise / prototype / reject

**Keep with revisions** — the core feature is correct and valuable. The edit-flow false positive and first-session surge are worth addressing before considering it "done."

---

## Pass 73 Feature Review: Last session summary on upcoming workout cards

### Implementation summary

**Files changed:** `src/pages/TodayPage.tsx` only.

**New code:**
1. `upcomingSessionSummaries` `useMemo` (~10 lines) — calls `findPreviousSessionForPlanDay` + `buildLastSessionSummary` for each upcoming rotation slot.
2. `<p>` element under each upcoming card — renders `Last: {summary}` when a prior session exists; hidden when null.

### What I like

- Zero new dependencies, zero new abstractions. Re-uses the exact pattern already in the file for today's card.
- Gracefully absent: the line only appears if there's prior history. First-time users see nothing different.
- `truncate` class prevents long summaries from wrapping on narrow viewports.
- Muted text (`text-slate-500`) keeps it visually subordinate to the card content.

### What feels risky or incomplete

1. **Performance at scale**: `findPreviousSessionForPlanDay` iterates `allOutcomes` for each upcoming slot. With 5 upcoming slots and years of history, this is ~5 × O(n) scans per render cycle (mitigated by the `useMemo`). Acceptable for the PWA scale, but worth noting.
2. **`maxLoadByExercise` memo lag**: the summary for weights workouts uses the global max-load map (computed once over all history). If the same session contains both the prior max and a current edit in flight, the "Last:" line is slightly stale. Not a real issue in practice — the memo re-fires on outcome changes.
3. **No unit test coverage**: the summary string comes from `buildLastSessionSummary` (already tested in `sessionSummary.test.ts`). The rendering integration is untested (requires component tests).

### Recommended next steps

1. **Manual smoke test**: log a weights session, navigate away and back. Confirm the next upcoming occurrence of the same plan day shows the one-liner.
2. **Run/swim test**: log a run and verify the format shows pace/distance (not exercise names).
3. **Edge case**: plan with a single rotation slot — the same slot appears tomorrow, in 2 days, etc. Confirm the same last-session summary appears on all of them (correct, since `planDayIndex` matches).

### Keep / revise / prototype / reject

**Keep** — low risk, good utility, zero new dependencies.
