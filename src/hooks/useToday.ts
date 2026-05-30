import { useState, useEffect } from 'react'
import { format } from 'date-fns'

/**
 * Returns the current calendar date as a YYYY-MM-DD string and automatically
 * refreshes at midnight so the Today page never shows a stale date after the
 * app has been open across a day boundary.
 *
 * Implementation: computes the milliseconds until the next midnight, sets a
 * one-shot timeout to advance the date, then re-schedules for the following
 * midnight once the date changes (via the `[today]` dependency).
 */
export function useToday(): string {
  const [today, setToday] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    const ms = midnight.getTime() - now.getTime()
    const timer = setTimeout(() => {
      setToday(format(new Date(), 'yyyy-MM-dd'))
    }, ms)
    return () => clearTimeout(timer)
  }, [today])

  return today
}
