import { useState, useCallback } from 'react'

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeDismissed(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // localStorage unavailable — degrade gracefully
  }
}

/**
 * Generic per-plan dismissal hook backed by localStorage.
 * keyPrefix must be globally unique per banner type (e.g. 'wpt_expiry_dismissed_v1_').
 */
export function useDismissableBanner(keyPrefix: string, planId: string | null) {
  const storageKey = planId ? keyPrefix + planId : null

  const [isDismissed, setIsDismissed] = useState(() =>
    storageKey ? readDismissed(storageKey) : false,
  )

  const dismiss = useCallback(() => {
    if (!storageKey) return
    writeDismissed(storageKey)
    setIsDismissed(true)
  }, [storageKey])

  return { isDismissed, dismiss }
}
