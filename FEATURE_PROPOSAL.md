# Feature Proposals

## Pass 79 — 2026-07-16 (branch `claude/dreamy-mccarthy-1jxqcb`)

---

### Proposal: Complete Extra-Workout Notes Workflow

**Status**: Implemented in this pass.

#### Feature selected

Complete the notes workflow for ad-hoc (extra) workouts by adding:
1. A Notes textarea to the inline "Add workout" form (creation-time)
2. A Notes textarea to the "Edit Workout" modal (post-creation editing)

#### Why selected

`ExtraWorkoutEntry.notes` was already a first-class field: persisted in the store, displayed in the history list, and writeable via `historyStore.updateExtraEntry`. But there was no UI path to set notes at creation time (the "Add workout" inline form had no notes field), and no UI path to edit them after creation (the "Edit Workout" modal was missing the field — ARCH-5). This created an incomplete user experience: users could see notes from CSV imports but couldn't enter or edit them from the UI.

The fix was a self-contained change to `HistoryPage.tsx` only, using already-supported API surface with no store or schema changes.

#### Expected user value

Users who want to log a quick note with an ad-hoc workout ("30-min easy ride, legs felt good") can now do so at entry time or add/edit it later. Notes appear inline in the history list below the workout name.

#### Implementation scope for this pass

- Add `extraNotes` state variable initialized to `''`
- Initialize `editingExtraNotes` from `extra.notes ?? ''` in `openExtraEdit`
- Pass `notes` through `submitAddExtra` to `addExtraEntry`
- Pass `notes` through `saveAndCloseExtra` to `updateExtraEntry` (with `|| undefined` to avoid storing empty string)
- Add `<textarea>` to the inline add form (two instances: under rotation entries, under extra entries)
- Add `<textarea>` to the "Edit Workout" modal

#### Assumptions made

- Empty textarea on save → `undefined` (not stored), matching the convention used for other optional string fields in the codebase.
- `rows={2}` is sufficient for short notes in both the inline form and the modal.
- No character limit enforced (the store type has no max-length constraint).

#### Open product / UX decisions

- Should there be a character limit? The current implementation is unbounded.
- Should the notes textarea in the inline form be collapsed by default (shown only after an "Add notes" expand button) to keep the form compact on small screens?

#### Architecture or schema impact

None. The `notes` field already exists on `ExtraWorkoutEntry`. The `historyStore` already accepts it in `addExtraEntry` and `updateExtraEntry`.

#### Risks

- Very low. The change is additive UI only. No store changes, no schema changes, no new dependencies.

#### Rollback strategy

`git revert 742fe29 0fd4fd3` — reverts both the edit modal and the add form changes.

#### What is intentionally not being built yet

- Notes on rotation entries (already exists in the entry edit modal)
- Rich text / markdown notes
- Notes search in the History filter
- Notes visible in the CalendarPage day detail modal for extra entries

---

## Pass 77 — 2026-07-14 (branch `claude/dreamy-mccarthy-aeym9p`)

---

### Proposal: Streak Milestone Celebration Banner

**Status**: Implemented in this pass.

#### Feature selected

A dismissable celebration banner on TodayPage that appears when the user's plan streak reaches a milestone (7, 14, 21, 30, 60, 90, 180, or 365 days). Each milestone is independently dismissable per plan.

#### Why selected

The TodayPage already computes and displays the current streak (`🔥 N streak`) and celebrates plan completion (`Plan complete!`). But crossing a meaningful streak threshold — particularly early milestones like 7 or 30 days — produces no feedback. Adding a one-time celebration is low-risk, clearly adjacent to existing functionality, and a standard pattern in fitness/habit apps. It required no new stores, no schema changes, and no new dependencies.

The codebase is in excellent shape with no high-priority bugs remaining. A small motivational UX improvement was the most valuable thing to add this pass without touching risky areas.

#### Expected user value

Positive reinforcement at meaningful milestones. Dismissable so it doesn't become noise for long-running plans.

#### Implementation scope for this pass

- `useStreakMilestoneDismiss` hook: per-plan, per-milestone localStorage-backed dismissal state
- `getActiveStreakMilestone(streak)`: returns the highest milestone ≤ streak from `[7, 14, 21, 30, 60, 90, 180, 365]`
- Banner: appears on TodayPage above the stall-nudge banner; uses the `🎯` emoji and milestone number

#### Assumptions made

- One milestone celebrated at a time (the current milestone, not all past ones)
- Dismissal is permanent per milestone per plan (localStorage key `wpt_streak_ms_v1_${planId}_${milestone}`)
- Milestones are not user-configurable

#### Architecture or schema impact

None. No new stores, no new schema fields.

#### Risks

Very low. Entirely additive. Dismissal state is in localStorage (not persisted to Supabase), so it resets on device change — a minor UX issue, not a data integrity issue.

#### Rollback strategy

`git revert <commit>` for the feature commits.

#### What is intentionally not being built yet

- Per-workout-type streaks
- Streak recovery suggestions
- Push notifications for milestones
