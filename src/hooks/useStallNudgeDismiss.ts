import { useDismissableBanner } from './useDismissableBanner'

const KEY_PREFIX = 'wpt_stall_nudge_dismissed_v1_'

/**
 * Per-plan dismissal state for the stalled-rotation nudge.
 * Persists to localStorage; isolated by planId so switching plans resets it.
 */
export function useStallNudgeDismiss(planId: string | null) {
  return useDismissableBanner(KEY_PREFIX, planId)
}
