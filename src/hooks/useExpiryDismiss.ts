import { useDismissableBanner } from './useDismissableBanner'

const KEY_PREFIX = 'wpt_expiry_dismissed_v1_'

/**
 * Per-plan dismissal state for the plan-expiry banner.
 * Persists to localStorage; isolated by planId so switching plans resets it.
 */
export function useExpiryDismiss(planId: string | null) {
  return useDismissableBanner(KEY_PREFIX, planId)
}
