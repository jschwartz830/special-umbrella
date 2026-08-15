import { useState, useEffect } from 'react'
import { format } from 'date-fns'

/**
 * Returns the current calendar date as a YYYY-MM-DD string and automatically
 * refreshes at midnight so the Today page never shows a stale date after the
 * app has been open across a day boundary.
 *
 * Two mechanisms keep the date current:
 * 1. A one-shot `setTimeout` fires at the next local midnight and advances the
 *    date. The `[today]` dependency re-schedules it for the following midnight
 *    each time the date changes.
 * 2. A `visibilitychange` listener re-checks the date whenever the page becomes
 *    visible again. This handles the device-sleep edge case: if the device sleeps
 *    across midnight the setTimeout fires late (or was paused by the OS), so the
 *    app would show "yesterday" until something triggered a re-render. Checking
 *    on tab/app focus fixes that immediately.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    function tick() {
      setToday(format(new Date(), 'yyyy-MM-dd'))
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') tick()
    }

    const now = new Date()
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    const ms = midnight.getTime() - now.getTime()
    const timer = setTimeout(tick, ms)

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [today])

  return today
}
