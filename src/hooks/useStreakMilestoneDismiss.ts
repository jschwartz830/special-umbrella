import { useState, useCallback } from 'react'

/** Ordered streak milestone thresholds in days. */
export const STREAK_MILESTONES = [7, 14, 21, 30, 60, 90, 180, 365] as const

/**
 * Returns the highest milestone the user has hit, or null if below 7.
 * e.g. streak=25 → 21, streak=6 → null, streak=365 → 365
 */
export function getActiveStreakMilestone(streak: number): number | null {
  let active: number | null = null
  for (const m of STREAK_MILESTONES) {
    if (streak >= m) active = m
  }
  return active
}

const KEY_PREFIX = 'wpt_streak_ms_v1_'

function storageKey(planId: string, milestone: number): string {
  return `${KEY_PREFIX}${planId}_${milestone}`
}

/**
 * Per-plan, per-milestone dismissal hook for streak celebration banners.
 *
 * Takes the raw `streak` count (not a pre-computed milestone) so the hook
 * can be called before the streak is filtered through `getActiveStreakMilestone`,
 * which simplifies placement in components with early returns.
 *
 * `isDismissed` is read from localStorage on each render (synchronous, O(1))
 * so it reflects the current milestone key without extra state management.
 * A `dismiss()` call writes to localStorage and triggers a re-render.
 *
 * Each (planId, milestone) pair is independently dismissable — a 7-day
 * dismissal does not suppress the later 14-day banner.
 */
export function useStreakMilestoneDismiss(planId: string | null, streak: number) {
  const milestone = getActiveStreakMilestone(streak)
  const key = planId && milestone !== null ? storageKey(planId, milestone) : null

  // Used only to force a re-render after dismiss() so isDismissed updates.
  const [, rerender] = useState(0)

  // Read fresh from localStorage on every render so key changes take effect
  // immediately without extra state synchronization.
  const isDismissed = key == null
    ? true
    : (() => { try { return localStorage.getItem(key) === '1' } catch { return false } })()

  const dismiss = useCallback(() => {
    if (key == null) return
    try { localStorage.setItem(key, '1') } catch {}
    rerender(v => v + 1)
  }, [key])

  return { isDismissed, dismiss, milestone }
}
