# Implementation Plan — Overnight Audit (2026-09-01)

## Architecture Summary

**Stack:** React 18.3 + TypeScript 5.5, Vite 5.3, Zustand 4.5 (all stores persist to localStorage via `persist` middleware), Supabase for Google OAuth and cloud sync, date-fns 3.6, React Router v6, Tailwind CSS 3.4, Vitest 4.1.4.

**Data flow:** Zustand stores → pure engine functions (rotationEngine, historyStats) → React components. Stores are never imported by the engine; the engine takes plain data arguments. Cloud sync via `storeSync.ts`: subscribes to store changes, debounces writes to Supabase, and hydrates stores on login.

**Key files:**
- `src/engine/rotationEngine.ts` — core scheduling logic (pure functions, well-tested)
- `src/lib/historyStats.ts` — statistics library (~1163 lines, O(N) functions, no memoization)
- `src/lib/storeSync.ts` — cloud sync bridge
- `src/store/historyStore.ts` — workout entries + overrides (Zustand, persisted)
- `src/store/outcomeStore.ts` — rich outcome data per workout instance (Zustand, persisted)
- `src/pages/TodayPage.tsx` — main workout logging UI (~1170 lines)
- `src/pages/CalendarPage.tsx` — month calendar with retroactive logging (~1000 lines)

---

## What Is Strong

- **Rotation engine:** Clean pure-function design, well-isolated, 50+ tests covering edge cases. No store dependencies.
- **Test coverage:** 1353 tests across 35 files. Engine tests are comprehensive. Store integration tests cover migration cascades.
- **TypeScript:** Full strict build with no type errors.
- **Store schema migrations:** Every store has a versioned migrate function. Cloud hydration applies the same migrations. Idempotent design.
- **Plan expiry logic:** Handles both `weeks` and `rotations` modes correctly, including zero-day plan guard.
- **`useToday` hook:** Correctly handles midnight rollover via both setTimeout and visibilitychange.
- **`expressionEval.ts`:** Full recursive-descent parser with no `eval()` or `Function()` — safe for user-provided YAML expressions.
- **`historyStats.ts` `buildPRFlagsMap`:** O(N log N) PR detection avoids the O(N²) naive approach.

---

## Key Risks / Weak Points

### Critical (data loss)
1. **[FIXED] storeSync.ts `handleBeforeUnload` cancelled by browser** — async fetch without `keepalive:true` is cancelled when a tab closes within the 1.5s debounce window. Fix implemented using direct `fetch()` with `keepalive:true` against Supabase REST API.
2. **Cloud sync "cloud always wins" on login** — if a user works offline then logs in, all local changes are silently discarded. No merge, no conflict detection, no warning. Not implemented (needs product decision on merge strategy).

### High (logic correctness)
3. **[FIXED] `authStore.signOut` stuck logged-in** — on network failure, `signOut()` threw and left `user`/`session` non-null. Fix: clear state in `finally` block regardless of server response.
4. **`CalendarPage.openExtraOutcome` cross-month extras** — when an extra workout was logged in a prior calendar month, the `planDayIndex` resolved to `undefined`, potentially recording an incorrect history entry. Documented; not implemented (requires medium-complexity modal refactor).
5. **TodayPage backdating collision silent no-op** — when a user changes the completion date to a date that already has a history entry, the move is silently skipped with no user feedback. Documented as recommendation.

### Medium (fragile / latent bugs)
6. **`removeRetroJumpForDate` date-slice convention** — uses `o.appliedAt.slice(0, 10)` to match overrides to a date. Retroactive jumps are written with no `Z` suffix to ensure the slice stays on the correct local date. Undocumented; breaks silently if any future code path writes a UTC `Z` timestamp. Documented.
7. **`planStore.migratePlanState` ignores `fromVersion`** — the Zustand `migrate` config drops the `fromVersion` argument. Idempotent today, but would break version-gated future migrations.
8. **`exerciseHistoryStore.moveByWorkoutInstance` doesn't update `planId`** — harmless today (only called within-plan), but the function lacks a guard or documentation of this constraint.
9. **`resumeCompletion` when all exercises complete** — resumes on last exercise instead of showing a "you're done" state. Test documents this as the expected behavior; left as-is per existing tests.
10. **TodayPage stats computed per-render** — [FIXED] `computeHistoryStats`, `computeConsecutiveSkips`, `getUnloggedPastDates`, `countTotalUnloggedDays` were computed on every render. Wrapped in `useMemo`.

### Low (code quality)
11. **[FIXED] Missing 404 catch-all route** — unknown URLs showed a blank page. Added `<Route path="*" element={<Navigate to="/" replace />} />`.
12. **Four overlapping duration fields on `WorkoutSlot`** — `targetTime`, `targetDuration`, `durationMin`, `timeMin` all represent duration in minutes. `durationMin` is the canonical one; others are legacy and should be deprecated.
13. **`computeLoggedRate` / `computeWorkoutCompletionRate` naming** — names are counterintuitive relative to their actual computation.
14. **`canDayOff = true` dead code** — intentional (comment explains it), but adds noise.
15. **No ESLint configuration** — TypeScript errors are caught, but unused variables, missing hook deps, and accessibility issues are not.
16. **No YAML schema validation at import** — a malformed YAML import produces runtime errors rather than user-facing validation messages.
17. **`expressionEval` silently returns 0 for unknown variables in production** — progression rules referencing undefined variables give no user-visible error.

---

## Prioritized Improvements

| Priority | Item | Risk | Status |
|----------|------|------|--------|
| Critical | storeSync keepalive on tab close | Low (well-tested) | **Implemented** |
| Critical | authStore signOut always clears state | Very low | **Implemented** |
| High | 404 catch-all route | Very low | **Implemented** |
| High | TodayPage stats useMemo | Very low | **Implemented** |
| Medium | CalendarPage cross-month extras planDayIndex | Medium | Documented |
| Medium | Backdating collision user feedback | Low-medium | Documented |
| Medium | removeRetroJumpForDate date-slice comment | Low | Documented |
| Medium | YAML import schema validation | Medium | Documented |
| Low | Overlapping duration fields cleanup | High (many call sites) | Documented |
| Low | ESLint configuration | Low | Documented |
| Low | expressionEval unknown variable warning in prod | Low | Documented |

---

## Rationale for Sequencing

1. **Critical data-loss bugs first** — storeSync keepalive and authStore signOut affect real user data with clear, narrow fixes.
2. **Trivial correctness fixes next** — 404 route and useMemo are zero-risk improvements.
3. **Medium items documented, not implemented** — the cross-month extras bug requires changes to `DayDetailModal`'s navigation structure; the backdating collision requires a user-visible error path. Both need product review before implementation.
4. **Low items documented only** — naming cleanup and ESLint setup are valuable but have high change surface. Better done in a dedicated cleanup pass with full regression testing.
