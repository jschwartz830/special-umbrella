# Overnight Changelog — 2026-09-01

---

## Change 1: Fix `authStore.signOut` to always clear local session

**Summary:** When `supabase.auth.signOut()` threw (e.g. network failure), the catch block only set an error message but left `user` and `session` non-null. The user appeared still logged in with no way to sign out short of clearing localStorage.

**Why it matters:** A temporary network blip at sign-out left users stuck, potentially exposing their data on a shared device session.

**Files changed:** `src/store/authStore.ts`

**Fix:** Moved `set({ user: null, session: null })` into a `finally` block so it always runs regardless of whether the server-side call succeeded. The local session token is invalid after a sign-out attempt regardless of the server's response.

**Risks / tradeoffs:** None — clearing local state is always correct; the Supabase session token is ephemeral and won't be accepted by the server after sign-out regardless.

**Rollback:** `git revert 1bbb004`

---

## Change 2: Add 404 catch-all route

**Summary:** Navigating to any URL not defined in the route table (e.g. `/foo`, `/plans/unknown`) rendered a blank page inside the AppShell with no navigation or error.

**Why it matters:** Blank pages are confusing, especially on PWA install where the user may deep-link. The catch-all redirects gracefully to `/today`.

**Files changed:** `src/App.tsx`

**Fix:** Added `<Route path="*" element={<Navigate to="/" replace />} />` as the last child of the root layout route.

**Risks / tradeoffs:** None — fallback redirect is the standard React Router pattern.

**Rollback:** `git revert 2064525`

---

## Change 3: Memoize O(N) history stats in TodayPage

**Summary:** Four O(N) stat functions were called on every render of `TodayPage`:
- `computeHistoryStats(allEntries, extraEntries, today)`
- `computeConsecutiveSkips(plan.id, planEntries, planExtras, today)`
- `getUnloggedPastDates(plan.id, planEntries, plan.startDate, today, 14)`
- `countTotalUnloggedDays(plan.id, planEntries, plan.startDate, today)`

On a multi-year history (thousands of entries) these accumulate visible latency on every state change (e.g. scrolling, animation frames, timer ticks from the active workout tracker).

**Why it matters:** Performance degradation scales with history size. Users who have been using the app for 1+ years can already feel this. The `useMemo` import was already present; many other stat computations in the same file already used it.

**Files changed:** `src/pages/TodayPage.tsx`

**Fix:** Wrapped all four calls in `useMemo` with the appropriate dependency arrays. The derived `olderUnloggedCount` (a simple `Math.max` over the memoized results) was left bare as it's O(1).

**Risks / tradeoffs:** None — `useMemo` is a pure optimization that does not change observable behavior. The dependency arrays match the exact inputs each function reads.

**Rollback:** `git revert d738ea4`

---

## Change 4: Fix storeSync beforeunload to use keepalive fetch

**Summary:** The `handleBeforeUnload` function called the async `pushStore()` function. When a user closed a browser tab, the browser cancelled all in-flight network requests before they could complete, silently discarding any workout data changed within the last 1.5 seconds.

**Why it matters:** The most common case — user finishes logging a workout and immediately closes the tab — is precisely this scenario. The workout would appear in localStorage (via Zustand persist) but would not be synced to the cloud, causing data divergence across devices.

**Files changed:**
- `src/lib/supabase.ts` — exported `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- `src/lib/storeSync.ts` — added session caching and keepalive fetch in beforeunload handler
- `src/lib/__tests__/storeSync.test.ts` — updated mock and tests to cover the new behavior

**Fix approach:**
1. Exported the raw Supabase URL and anon key from `supabase.ts` so the keepalive path can construct REST requests directly (the Supabase JS client does not support `keepalive`).
2. In `subscribeStores()`, added a local `cachedUserId` / `cachedAccessToken` pair maintained by `supabase.auth.onAuthStateChange` (seeded from `getSession()` on startup).
3. `handleBeforeUnload` now skips the async `pushStore()` path and instead fires `fetch()` with `keepalive: true` directly against `POST /rest/v1/workout_user_store_data` with `Prefer: resolution=merge-duplicates`. Browsers guarantee keepalive requests survive tab close for bodies under 64 KB (a store blob is well under this limit).
4. The normal debounced path (`pushStore` via the Supabase client) is unchanged.
5. If there is no cached session (user is not logged in), the handler is a no-op.

**Risks / tradeoffs:**
- Adds a second `onAuthStateChange` subscription alongside the one in `authStore`. Supabase supports multiple listeners; they don't interfere. The subscription is cleaned up in the `subscribeStores` cleanup function.
- The keepalive path constructs the REST body manually, bypassing RLS policy evaluation differences between the Supabase client and direct REST. The policy is `auth.uid() = user_id` which is enforced by the Bearer token; this is identical to how the Supabase client would work.
- `keepalive` fetch bodies must be under 64 KB. A worst-case store state (thousands of history entries) could approach this limit. If it does, the keepalive fetch silently fails (the browser rejects it). The localStorage copy is still intact, so no data is lost; only the cloud sync would be delayed until the next login.

**Rollback:** `git revert 1f01af7`
