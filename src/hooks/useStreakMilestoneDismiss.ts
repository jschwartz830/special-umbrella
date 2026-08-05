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

const KEY_PREFIX = 'wpt_streak_ms_v2_'

function storageKey(milestone: number): string {
  return `${KEY_PREFIX}${milestone}`
}

/**
 * Per-milestone dismissal hook for streak celebration banners.
 *
 * The streak itself is global (survives switching the active plan — see
 * `computePlanStreak(null, ...)`), so dismissal is keyed only by milestone,
 * not by plan.
 *
 * Takes the raw `streak` count (not a pre-computed milestone) so the hook
 * can be called before the streak is filtered through `getActiveStreakMilestone`,
 * which simplifies placement in components with early returns.
 *
 * `isDismissed` is read from localStorage on each render (synchronous, O(1))
 * so it reflects the current milestone key without extra state management.
 * A `dismiss()` call writes to localStorage and triggers a re-render.
 *
 * Each milestone is independently dismissable — a 7-day dismissal does not
 * suppress the later 14-day banner.
 */
export function useStreakMilestoneDismiss(streak: number) {
  const milestone = getActiveStreakMilestone(streak)
  const key = milestone !== null ? storageKey(milestone) : null

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
