# Review Notes — Overnight Audit (2026-09-01)

## Executive Summary

**What changed:** 4 commits — fixed a critical data-loss bug in cloud sync on tab close (keepalive fetch), fixed authStore sign-out leaving users stuck logged-in, added a missing 404 catch-all route, and memoized O(N) stats in TodayPage.

**Highest confidence changes:** All four. Each is narrow, has test coverage, and is independently revertable. The keepalive fix is the most complex but has the most meaningful impact.

**Risky item:** The keepalive fix touches the cloud sync path. It's well-tested (new tests added, all 1353 pass), but any cloud sync code deserves extra scrutiny before merge.

**Review first:** `src/lib/storeSync.ts` — the keepalive fetch implementation. Verify the `Prefer: resolution=merge-duplicates` header, the body shape matching what the Supabase client sends, and that the cached token stays fresh enough for real sessions.

---

## Biggest Issues Found (before this run)

1. **[FIXED] storeSync beforeunload data loss** — async pushStore() was cancelled by browser on tab close; logged workouts within the last 1.5s were not synced to cloud.
2. **[FIXED] authStore signOut stuck state** — on network failure, user appeared logged-in with no escape.
3. **CalendarPage cross-month extras produce `planDayIndex: undefined`** — see Recommendations Only section.
4. **Cloud sync "cloud always wins" on login** — offline work silently discarded. Needs product decision.
5. **TodayPage backdating collision silent no-op** — user gets no feedback when a date move is blocked.

---

## Improvements Completed

| # | Change | Files | Commit |
|---|--------|-------|--------|
| 1 | authStore.signOut always clears session | authStore.ts | 1bbb004 |
| 2 | 404 catch-all route | App.tsx | 2064525 |
| 3 | useMemo for O(N) stats in TodayPage | TodayPage.tsx | d738ea4 |
| 4 | Keepalive fetch in storeSync beforeunload | supabase.ts, storeSync.ts, storeSync.test.ts | 1f01af7 |

---

## Small Features Added

None. The codebase had active stability issues that took priority over feature work.

---

## Medium-Complexity Feature Explored

None. Given the number of high-impact bugs found, stability was prioritized over new features per the task's `Feature-selection rules` ("Skip feature work entirely if audit findings suggest the codebase needs stabilization first").

---

## Definitely Keep

- **authStore signOut fix** — zero risk, prevents a real UX trap.
- **404 catch-all route** — zero risk, standard pattern.
- **TodayPage useMemo** — zero risk performance improvement.
- **Keepalive fetch fix** — moderate complexity, but the existing bug is a real data-loss risk. Test coverage is solid.

---

## Probably Keep but Tweak

- **Keepalive fetch body size limit** — for users with large history stores, a 64 KB body limit could cause the keepalive to fail silently. Consider adding a size check before attempting the keepalive, and logging a warning in DEV if the limit is approached. Not blocking for merge.

---

## Do Not Keep

Nothing implemented this run should be reverted (in my assessment).

---

## Recommendations Only (not implemented)

### 1. CalendarPage cross-month extras `planDayIndex: undefined`
**File:** `src/pages/CalendarPage.tsx`, `openExtraOutcome` function.  
**Issue:** `weeks.flat().find(cell => cell.date === extra.calendarDate)` searches only the current month's grid. Extras logged in a prior month get `resolvedDay = undefined` and `planDayIndex: undefined` in the outcome, potentially recording incorrect history entries.  
**Fix direction:** Compute `resolvedDay` via `getResolvedDaysRange` for the extra's specific date instead of searching the current month's grid. This requires making the calendar projection engine available to the modal handler.

### 2. TodayPage backdating collision — add user feedback
**File:** `src/pages/TodayPage.tsx`, `handleOutcomeConfirm`.  
**Issue:** When the user changes the completion date to a date that already has an entry, the entry move is silently skipped (the outcome is saved to the original date). The user receives no error or indication that their selected date wasn't used.  
**Fix direction:** Add a `backdateWarning` state (similar to `upcomingLogError`). Set it when `destEntry` exists and the move is blocked. Display it in the outcome confirmation area or as a brief banner.

### 3. Cloud sync "cloud always wins" on login
**File:** `src/lib/storeSync.ts`, `syncOnLogin`.  
**Issue:** If a user makes changes offline and then logs in, all local changes are overwritten by cloud data with no merge or warning.  
**Fix direction:** Compare timestamps (`updated_at`) per store before overwriting. If local data is newer, prefer local and push it up. This is a product decision — needs clarity on whether "last-write wins" per-store is acceptable, or whether per-entry merging is needed.

### 4. `removeRetroJumpForDate` implicit date-slice convention
**File:** `src/store/historyStore.ts`.  
**Issue:** Retroactive jump overrides are written with `appliedAt = "${calendarDate}T12:00:00.000"` (no Z suffix) so that `slice(0, 10)` returns the correct local date. This convention is undocumented and breaks in UTC- timezones if a future code path creates a Z-suffixed timestamp.  
**Fix direction:** Add a JSDoc comment documenting the convention. Consider extracting a `makeRetroJumpAppliedAt(calendarDate: string): string` helper that enforces the format.

### 5. `planStore.migratePlanState` ignores `fromVersion`
**File:** `src/store/planStore.ts`, the Zustand `persist` config.  
**Issue:** `migrate: (persisted) => migratePlanState(persisted)` drops the `fromVersion` argument. Works today because the migration is idempotent, but will break if a future v3 migration needs to be version-gated (only run when upgrading from v2).  
**Fix direction:** Change to `migrate: (persisted, fromVersion) => migratePlanState(persisted, fromVersion)` and add version checking inside `migratePlanState`.

### 6. YAML import — add schema validation
**File:** `src/pages/ProgramImportPage.tsx`.  
**Issue:** Parsed YAML is used as a `Plan` without structural validation. A malformed file produces cryptic runtime errors rather than a user-facing validation message.  
**Fix direction:** Add a lightweight validation pass after `js-yaml` parses the document — check for required top-level fields (`days`, etc.) and reject with a descriptive error before writing to the store.

### 7. ESLint configuration
**Issue:** No ESLint config exists. Missing hook dependencies (`react-hooks/exhaustive-deps`), unused variables, and accessibility issues go unchecked.  
**Fix direction:** Add `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react`, and `@typescript-eslint/eslint-plugin`. Add a `lint` script to `package.json`. Expect a first-run cleanup pass to address reported issues.

### 8. Overlapping duration fields on `WorkoutSlot`
**Issue:** `targetTime`, `targetDuration`, `durationMin`, and `timeMin` all represent duration in minutes for different workout types. `durationMin` is marked as canonical. The others are legacy.  
**Fix direction:** Audit all read sites. Ensure `durationMin` is written for all new slots. Mark `targetTime` and `targetDuration` as `@deprecated` in the type definition. Schedule removal for a future migration.

### 9. `expressionEval` unknown variable warning in production
**File:** `src/lib/expressionEval.ts`.  
**Issue:** In production builds, a YAML progression rule referencing an undefined variable silently returns 0 with no user-visible indication.  
**Fix direction:** Surface unknown variable names in the store as a `programStore` field or as a toast notification during plan execution. Allow the user to identify misconfigured YAML rules without looking at the console.

---

## Open Questions

1. What merge strategy should `syncOnLogin` use when local data is newer than cloud data? Last-write-wins per store? Per-entry timestamping? The current "cloud always wins" was presumably intentional but has silent data-loss implications.
2. Should the CalendarPage modal be able to compute `planDayIndex` for dates outside the current month grid? This would require exposing `getResolvedDaysRange` to the modal handler.
3. Is there a plan to introduce ESLint? The `react-hooks/exhaustive-deps` rule would surface at least one missing dependency already (the `unloggedDates` `useMemo` in a prior audit pass).

---

## Known Issues / Incomplete Work

- The `keepalive` fetch body is not size-checked before dispatch. For very large history stores, the browser may silently reject the request if it exceeds 64 KB.
- The cross-month extras `planDayIndex` bug is documented but not fixed. It could produce subtly wrong history entries when a user views an extra from a prior month in CalendarPage.

---

## Dependencies Added

None.
