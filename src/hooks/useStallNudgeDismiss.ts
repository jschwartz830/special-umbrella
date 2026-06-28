import { useState, useCallback } from 'react'

const KEY_PREFIX = 'wpt_stall_nudge_dismissed_v1_'

function readDismissed(planId: string): boolean {
  try {
    return localStorage.getItem(KEY_PREFIX + planId) === '1'
  } catch {
    return false
  }
}

function writeDismissed(planId: string): void {
  try {
    localStorage.setItem(KEY_PREFIX + planId, '1')
  } catch {
    // localStorage unavailable — degrade gracefully
  }
}

/**
 * Per-plan dismissal state for the stalled-rotation nudge.
 * Persists to localStorage; isolated by planId so switching plans resets it.
 */
export function useStallNudgeDismiss(planId: string | null) {
  const [isDismissed, setIsDismissed] = useState(() =>
    planId ? readDismissed(planId) : false,
  )

  const dismiss = useCallback(() => {
    if (!planId) return
    writeDismissed(planId)
    setIsDismissed(true)
  }, [planId])

  return { isDismissed, dismiss }
}
