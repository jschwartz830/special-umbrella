# Overnight Changelog

---

## Pass 79 — 2026-07-16 (branch `claude/dreamy-mccarthy-1jxqcb`)

### Commit 1 — `c91bdaf`

**fix(outcomeSortKey): use stable prefix key instead of empty string for malformed outcomes**

| | |
|---|---|
| **Files** | `src/lib/outcomeSortKey.ts`, `src/lib/__tests__/outcomeSortKey.test.ts` |
| **Risk** | Very low — only affects outcomes with neither `completedAt` nor a parseable date in `workoutInstanceId` (corrupted data) |
| **Rollback** | `git revert c91bdaf` |

Previously `outcomeSortKey()` returned `''` when an outcome had no `completedAt` and no parseable calendarDate in its `workoutInstanceId`. Two such outcomes compared as equal, producing a non-deterministic sort order (BUG-8). Changed the fallback to `` `0000-00-00_${outcome.workoutInstanceId}` `` which sorts consistently before any valid date string and is unique per instance. Updated the one existing test that expected `''` to match the new key format.

---

### Commit 2 — `22c363e`

**fix(WorkoutSlotDetails): prevent double-subtype rendering for YAML-imported run slots**

| | |
|---|---|
| **Files** | `src/components/workout/WorkoutSlotDetails.tsx` |
| **Risk** | Very low — visual-only; no data or logic change |
| **Rollback** | `git revert 22c363e` |

YAML-imported run slots can set both `slot.subtype` and `slot.runConfig.subtype` to the same value. The component rendered each at a different location (line 129 for `runConfig.subtype`, line 175 for `slot.subtype`), so the subtype string appeared twice for these slots. Added a guard at line 175: skip `slot.subtype` when it equals `slot.runConfig?.subtype`. Legacy run slots that have `slot.subtype` but no `runConfig` are unaffected.

---

### Commit 3 — `e105088`

**fix(ActiveWorkoutTracker): add draftVersion to active-workout draft schema**

| | |
|---|---|
| **Files** | `src/components/workout/ActiveWorkoutTracker.tsx` |
| **Risk** | Low — the draftVersion check discards unversioned drafts (any draft written before this commit). Users who have an in-progress session open at the time of a page reload will lose their unsaved draft state. Acceptable: the alternative was a stale draft silently corrupting the resumed session. |
| **Rollback** | `git revert e105088` |

Active-workout drafts had no schema version (ARCH-4). A stale draft from an older app version would partially hydrate, potentially producing a corrupted in-progress session on resume. Added `DRAFT_VERSION = 1` constant. The draft writer stamps `draftVersion: DRAFT_VERSION`; the draft reader rejects and discards any draft whose `draftVersion` doesn't match. To evolve the schema in future: increment `DRAFT_VERSION` and add a migration if needed.

---

### Commit 4 — `742fe29`

**feat(HistoryPage): add notes field to extra-entry edit modal (ARCH-5)**

| | |
|---|---|
| **Files** | `src/pages/HistoryPage.tsx` |
| **Risk** | Very low — additive UI field; `historyStore.updateExtraEntry` already accepts `notes` in the patch |
| **Rollback** | `git revert 742fe29` |

`ExtraWorkoutEntry.notes` was already stored and shown in the history list, but the "Edit Workout" modal for extra entries had no way to set or update it. Added a Notes textarea (2 rows, optional) below the Name field. The save handler passes `notes: editingExtraNotes || undefined` so empty notes clear the stored value. Save is a no-op when nothing has changed, consistent with the type/name save guard.

---

### Commit 5 — `eba2cce`

**fix(CardioWorkoutTracker): make auto-advance toggle session-local**

| | |
|---|---|
| **Files** | `src/components/workout/CardioWorkoutTracker.tsx` |
| **Risk** | Low — behavioural change: the toggle now affects only the current session instead of persisting globally. The global default is still readable and settable via SettingsPage. |
| **Rollback** | `git revert eba2cce` |

The auto-advance button was calling `settingsStore.setAutoAdvanceSegments()` directly, permanently changing the global default whenever a user toggled it during a run (AUTOADV-GLOBAL). The component now reads the initial default from `settingsStore.autoAdvanceSegments` once at mount and holds it in local `useState`. Toggling during a run affects only the current session; the SettingsPage remains the canonical way to change the persistent default. The button tooltip now says "this session only" to communicate the scope.

---

### Commit 6 — `dcb38a4`

**fix(settingsStore): add persist version so future field removals don't leak**

| | |
|---|---|
| **Files** | `src/store/settingsStore.ts` |
| **Risk** | Very low — no data migration; existing localStorage keys remain valid |
| **Rollback** | `git revert dcb38a4` |

`settingsStore` was the only persisted Zustand store without a `version` field. Without one, Zustand's `persist` middleware never calls `migrate()`, so a future field rename or removal would leave the stale key in localStorage indefinitely. Added `version: 1` to establish the baseline.

---

### Commit 7 — `0fd4fd3`

**feat(HistoryPage): add notes field to inline "Add workout" form**

| | |
|---|---|
| **Files** | `src/pages/HistoryPage.tsx` |
| **Risk** | Very low — additive UI field; wires through the same `notes` parameter already accepted by `addExtraEntry` |
| **Rollback** | `git revert 0fd4fd3` (or revert the whole HistoryPage run with `git revert 742fe29 0fd4fd3`) |

Completes the extra-workout notes workflow. Users could already add notes to extra workouts after the fact (via the edit modal, commit 4), but had no way to add a note at creation time. The inline "Add workout" form now includes an optional Notes textarea. Notes are saved on Add and cleared on Cancel. The two instances of the form (one under rotation-entry dates, one under extra-entry dates) are both updated identically.

---

## Pass 78 — 2026-07-15 (branch `claude/dreamy-mccarthy-cr3jyk`)

### Commit 1 — `38d2f06`

**fix(workoutInstanceId): fix stale comment and add extractExtraId helper**

| | |
|---|---|
| **Files** | `src/lib/workoutInstanceId.ts` |
| **Risk** | Very low — additive; no existing callers changed |
| **Rollback** | `git revert 38d2f06` |

The comment said nanoid uses "base-36 (0-9, a-z)"; the actual implementation (since pass 77) uses 32-char hex. Updated the comment. Added `extractExtraId(instanceId)` which anchors on the YYYY-MM-DD date pattern rather than naively splitting on `'_extra_'`. Any caller using the naive split would produce a wrong extraId if a planId or extraId ever contained `'_extra_'` as a substring.

---

### Commit 2 — `4cbaed8`

**fix(usePlanActions): replace stale today with useToday()**

| | |
|---|---|
| **Files** | `src/hooks/usePlanActions.ts` |
| **Risk** | Low — drops one import, adds one hook call; `useToday()` is already used in TodayPage |
| **Rollback** | `git revert 4cbaed8` |

`today` was computed once at hook initialisation via `format(new Date(), 'yyyy-MM-dd')`. If the app stayed open past midnight, all `logAction`, `advance`, and `goBack` calls would write entries with yesterday's calendarDate (BUG-1). Fixed by using `useToday()`, which subscribes to the midnight-advance timer.

---

### Commit 3 — `5e82b5e`

**fix(CalendarPage, HistoryPage): use extractExtraId helper**

| | |
|---|---|
| **Files** | `src/pages/CalendarPage.tsx`, `src/pages/HistoryPage.tsx` |
| **Risk** | Very low — same logic, different implementation |
| **Rollback** | `git revert 5e82b5e` |

Replaced fragile `.split('_extra_')[1]` calls with `extractExtraId()` (BUG-2 / MINOR-1). The naive split would produce a wrong extraId if `_extra_` appeared in a planId or extraId. The regex-anchored helper is correct regardless of the instanceId contents.

---

### Commit 4 — `8ab3d89`

**fix(TodayPage): guard against silently overwriting destination entry on date move**

| | |
|---|---|
| **Files** | `src/pages/TodayPage.tsx` |
| **Risk** | Low — behaviour change: the history-entry move is skipped when the destination is already occupied. The outcome is still saved at the requested date. |
| **Rollback** | `git revert 8ab3d89` |

`handleOutcomeConfirm` called `removeEntry(planId, completedDate)` unconditionally before moving the entry. Any independently-logged entry at the destination (skip, day-off, prior workout) was silently destroyed (BUG-3). Now checks for an existing entry at the destination and skips the move if found.

---

### Commit 5 — `9d1f78a`

**fix(CalendarPage, HistoryPage): same destination guard on date moves**

| | |
|---|---|
| **Files** | `src/pages/CalendarPage.tsx`, `src/pages/HistoryPage.tsx` |
| **Risk** | Same as commit 4 |
| **Rollback** | `git revert 9d1f78a` |

Applied the same destination guard to CalendarPage's `logForDate` and HistoryPage's `handleOutcomeConfirm`.

---

### Commit 6 — `21a9d81`

**fix(CardioWorkoutTracker): explicitly cancel auto-advance timeout on manual nav**

| | |
|---|---|
| **Files** | `src/components/workout/CardioWorkoutTracker.tsx` |
| **Risk** | Very low — cleaner cancellation; previous code was correct in practice |
| **Rollback** | `git revert 21a9d81` |

The auto-advance `setTimeout` was stored in a ref but only cancelled via React's effect cleanup. If the user navigated manually within the cleanup debounce window, the stale timeout could still fire (BUG-6). Now `cancelAutoAdvance()` is called explicitly in `goNext`, `goPrev`, and the dot-click handler.

---

### Commit 7 — `64ed8f0`

**fix(storeSync): flush pending debounced writes on beforeunload**

| | |
|---|---|
| **Files** | `src/lib/storeSync.ts` |
| **Risk** | Low — adds new `beforeunload` handler; `beforeunload` has 100ms budget for sync operations |
| **Rollback** | `git revert 64ed8f0` |

Changes made within 1.5s of closing the tab were never written to Supabase because the debounced write timer hadn't fired (BUG-5). The fix tracks all pending timeouts in a `Map` and flushes them synchronously in a `beforeunload` handler.

---

### Commit 8 — `cefdacf`

**test(workoutInstanceId): add coverage for extractExtraId helper**

| | |
|---|---|
| **Files** | `src/lib/__tests__/workoutInstanceId.test.ts` |
| **Risk** | None |
| **Rollback** | `git revert cefdacf` |

Seven tests for the new `extractExtraId()` helper covering: standard format, extra ID with hyphens, planId with underscores, extra ID containing `_extra_` substring, no date segment, and null/undefined inputs.

---
