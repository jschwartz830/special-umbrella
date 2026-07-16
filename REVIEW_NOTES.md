# Review Notes — Overnight Audit

## 2026-07-16 (seventy-ninth pass) — branch `claude/dreamy-mccarthy-1jxqcb`

---

### Executive Summary

1. **What changed**: 7 commits, 6 source files + 1 test file updated. 5 bug fixes and 1 medium-complexity feature (notes on extra workouts).
2. **Test delta**: 0 new tests (BUG-8 test updated, not added). All 1088 pre-existing tests still pass.
3. **Highest confidence**: The `outcomeSortKey` stable fallback (BUG-8), the double-subtype dedup, and the `settingsStore` version are all 1-line changes with zero risk. The `draftVersion` fix (ARCH-4) is the most impactful single-file change.
4. **What is risky**: The `draftVersion` change (commit 3) discards any currently-open draft that pre-dates this deployment. Users who had an active in-progress session, backgrounded the app, and return after the deploy will lose their draft state. This is intentional and safer than the corrupted-hydration alternative, but worth knowing. The auto-advance session-local change (commit 5) is a behaviour change: the toggle no longer persists globally — which is correct, but test if you use auto-advance habitually.
5. **What to review first**: Commit 5 (AUTOADV-GLOBAL) and commit 7 (notes on add form). The auto-advance fix changes long-standing behaviour. The notes feature adds a textarea to the inline add form — verify the form layout looks right on mobile.

---

### Biggest Issues Found (this pass)

| ID | Severity | File | Summary |
|---|---|---|---|
| AUTOADV-GLOBAL | UX | `CardioWorkoutTracker.tsx` | Auto-advance toggle permanently changed global setting — now fixed (session-local) |
| ARCH-4 | Safety | `ActiveWorkoutTracker.tsx` | Draft had no version — stale drafts would partially hydrate — now fixed |
| BUG-8 | Low | `outcomeSortKey.ts` | Empty-string fallback was non-deterministic — now fixed (stable prefix) |
| DOUBLE-SUBTYPE | Visual | `WorkoutSlotDetails.tsx` | Run subtype rendered twice on YAML-imported slots — now fixed |
| DESTINATION-SILENT | UX | Three pages | History entry move silently skipped when destination is occupied — still open |
| BUG-4 | Medium | `storeSync.ts` | Cloud hydration bypasses Zustand migrate — still open |

---

### Improvements Completed

| # | Commit | Change | Assessment |
|---|--------|--------|------------|
| 1 | `c91bdaf` | BUG-8: stable outcomeSortKey fallback | Definitely keep |
| 2 | `22c363e` | Double-subtype dedup in WorkoutSlotDetails | Definitely keep |
| 3 | `e105088` | ARCH-4: draftVersion guard in ActiveWorkoutTracker | Definitely keep |
| 4 | `742fe29` | ARCH-5: notes field in extra-entry edit modal | Definitely keep |
| 5 | `eba2cce` | AUTOADV-GLOBAL: session-local auto-advance toggle | Definitely keep |
| 6 | `dcb38a4` | settingsStore version: 1 | Definitely keep |
| 7 | `0fd4fd3` | feat: notes field in "Add workout" inline form | Definitely keep |

---

### Feature Added: Extra-Workout Notes Workflow

**What was built:** Two-part notes workflow for ad-hoc (extra) workouts:
- Inline "Add workout" form now has an optional Notes textarea (2 rows). Notes are saved on "Add" and cleared on "Cancel".
- "Edit Workout" modal now has a Notes textarea pre-populated from the stored entry. Saving is a no-op when unchanged.
- Both changes wire through the pre-existing `ExtraWorkoutEntry.notes` field and `historyStore.updateExtraEntry`/`addExtraEntry` — no schema changes needed.

**Why selected:** The notes display was already in the history list (`extra.notes && ...`), the store already supported notes writes, and the edit modal (ARCH-5) was the only gap. Extending the add form at the same time made the workflow complete. Pure additive change, zero risk, clear user value.

**Assumptions encoded:**
- Empty notes string on save → `undefined` (stored as absent, not as empty string). This means you can't "set notes to explicitly empty" — clearing the textarea removes the field. Consistent with the rotation-entry notes field behaviour.
- The Notes textarea uses `rows={2}`, compact enough for the inline form.

**What to evaluate:**
- Mobile layout: the textarea in the inline add form adds ~40px to the form height. Verify this is acceptable on small screens.
- Whether the textarea is too tall for the edit modal (currently `rows={2}` matching the add form).

---

### Keep / Revise / Reject Verdicts

| Item | Verdict |
|---|---|
| BUG-8 stable fallback | **Keep** |
| Double-subtype dedup | **Keep** |
| draftVersion guard | **Keep** |
| Extra-entry notes (edit modal) | **Keep** |
| Auto-advance session-local | **Keep** — but test your personal workflow with auto-advance |
| settingsStore version: 1 | **Keep** |
| Extra-workflow notes (add form) | **Keep** — verify mobile layout |

---

### Recommendations Only (not implemented this pass)

| Item | Priority | Notes |
|---|---|---|
| DESTINATION-SILENT: show feedback when date-move is skipped | P2 | Three pages (TodayPage, CalendarPage, HistoryPage). A toast or inline warning would complete the pass 78 destination-guard fix UX. |
| BUG-4: storeSync cloud-hydration bypasses migrate | P1 | High-risk if schema changes are made. Requires a migration pipeline design before any store schema bumps. |
| BUG-11: CSV import plan-ID collision warning | P2 | Show a confirmation dialog ("A plan with this ID already exists — overwrite?") on import collision. |
| TodayPage decomposition | P3 | 1736 lines, 25+ state variables. Extract `<TodayBanners>` as first step. |
| `localDate` field on OverrideEntry | P4 | Fixes ARCH-3 (timezone-boundary override misattribution). iOS spec already defines this. |
| storeSync tests | P1 | Highest-risk untested module. Needs mock for Supabase client. |

---

### Open Questions

1. **Auto-advance default**: The global `settingsStore.autoAdvanceSegments` default is now only applied at session start. If a user's intent was "remember my last auto-advance choice", they now lose that. Is "apply the global default at session start" the right UX, or should the session restore the previous session's setting?

2. **Extra-workout notes**: Should Notes be visible in the "Add workout" summary card in HistoryPage immediately after adding (without opening the edit modal)? Currently the note is shown on the card via `extra.notes && ...`, so it does appear after save.

3. **draftVersion**: The version was bumped from no-version to 1 in a single step. Any user with an active draft at deploy time will see it discarded. Is there a better migration path (e.g., inspect old-format drafts and attempt partial restoration)?

---

### Known Issues / Incomplete Work

- `AuthGate.tsx` has a pre-existing `import.meta.env.DEV` TypeScript error (introduced in pass 78, Vite-specific global). This is a `tsconfig` gap — `import.meta.env` is defined in Vite's client type shim but not picked up by standalone `tsc`. No functional impact.
- TEST-1 through TEST-6 (see IMPLEMENTATION_PLAN.md) are still open test-coverage gaps.

---

### Dependencies Added

None.

---

## 2026-07-15 (seventy-eighth pass) — branch `claude/dreamy-mccarthy-cr3jyk`

---

### Executive Summary

1. **What changed**: 8 commits, 7 source files + 1 test file. Pure stabilisation pass — no new features. Seven bugs fixed, one `extractExtraId` helper added, 7 new tests.
2. **Test delta**: +7 tests (1081 → 1088). All 1081 pre-existing tests still pass. TypeScript: 0 errors.
3. **Highest confidence**: All 7 fixes are small, additive guards that remove failure paths without changing the happy-path logic. The `usePlanActions` midnight bug is the highest-impact fix — it affects every logAction, advance, and goBack call made after midnight.
4. **What is risky**: None of the 7 fixes are risky; the `storeSync` beforeunload flush is the most new-logic-heavy, but it's a simple flush of pending writes. The two "destination guard" fixes (TodayPage + CalendarPage/HistoryPage) subtly change behaviour on date-collision — instead of overwriting, the move is skipped. This is safer than before, but different behaviour.
5. **What to review first**: The three "destination guard" fixes (commits 4 and 5). Verify that silently skipping the history-entry move when the destination is occupied is the correct UX vs. warning the user.

---

### Biggest Issues Found

| ID | Severity | File | Summary |
|---|---|---|---|
| BUG-1 | Medium | `usePlanActions.ts` | Stale `today` after midnight — all writes go to wrong date |
| BUG-3 | Medium | `TodayPage.tsx` + Calendar/History | Date-change in outcome modal silently deletes an existing entry at the destination |
| BUG-4 | Medium | `storeSync.ts` | Cloud hydration bypasses Zustand migrate — old schema data is applied without migration |
| BUG-6 | Low | `CardioWorkoutTracker.tsx` | Stale auto-advance timeout could fire after manual segment change |
| BUG-5 | Low | `storeSync.ts` | Final write lost when tab closed within 1.5s debounce window |
| ARCH-1 | Debt | `TodayPage.tsx` | 1700+ lines, 25+ state variables — long-term maintainability risk |
| TEST-1 | Gap | `storeSync.ts` | No tests for cloud sync; highest-risk untested module in the codebase |
| TEST-3 | Gap | `ActiveWorkoutTracker.tsx` | 1872 lines, 0 tests |

---

### Improvements Completed

| # | Commit | Change | Assessment |
|---|--------|--------|------------|
| 1 | `38d2f06` | extractExtraId helper + comment fix | Definitely keep |
| 2 | `4cbaed8` | usePlanActions midnight bug | Definitely keep |
| 3 | `5e82b5e` | extractExtraId in CalendarPage + HistoryPage | Definitely keep |
| 4 | `8ab3d89` | TodayPage destination guard | Probably keep — verify silent-skip UX |
| 5 | `9d1f78a` | Calendar/History destination guard | Probably keep — verify silent-skip UX |
| 6 | `21a9d81` | CardioWorkoutTracker autoadvance cancel | Definitely keep |
| 7 | `64ed8f0` | storeSync beforeunload flush | Definitely keep |
| 8 | `cefdacf` | extractExtraId tests | Definitely keep |

---

### Recommendations Only (not implemented pass 78)

| Item | Priority |
|---|---|
| Fix BUG-4: storeSync cloud hydration bypasses migrate | P1 |
| Add storeSync tests | P1 |
| Fix BUG-8: outcomeSortKey empty-string fallback | P2 |
| Fix BUG-11: CSV plan import ID collision | P2 |
| Add ARCH-5: notes field in extra-entry edit modal | P3 |
| Fix AUTOADV-GLOBAL: auto-advance should be session-local | P3 |
| Begin TodayPage decomposition | P3 |
| Add draftVersion to active-workout draft | P3 |
| Add settingsStore version | P4 |

---

### Open Questions (pass 78)

1. Is the silent-skip on destination-guard (commits 4 and 5) the right UX? The user gets no feedback that their history entry wasn't moved.
2. Should `settingsStore` have a `version` number to support future migrations?
3. Should `ActiveWorkoutTracker` draft include a `draftVersion` field?

---

### Known Issues / Incomplete Work (pass 78)

- TEST-1 through TEST-6 are still open test-coverage gaps.
- BUG-4 (cloud hydration bypassing migrate) remains open.
- AUTOADV-GLOBAL remains open.
- ARCH-5 (notes in extra-entry modal) remains open.
