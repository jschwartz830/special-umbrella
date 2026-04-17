import type { HistoryEntry } from '../types'

export interface HistoryStats {
  totalLogged: number
  totalCompleted: number
  last7Completed: number
  last30Completed: number
  currentStreak: number
}

/**
 * Compute read-only stats over a set of history entries.
 *
 * - `totalLogged` counts entries of any action.
 * - `totalCompleted` counts `complete` entries only.
 * - `last7Completed` / `last30Completed` count `complete` entries within
 *   the N-day window ending on `today` (inclusive).
 * - `currentStreak` counts consecutive calendar days ending at `today`
 *   (inclusive) that have a `complete` or `day_off` entry; `skip` or no
 *   entry breaks the streak. If `today` itself has no qualifying entry,
 *   the streak is 0.
 *
 * All date math uses string comparison on YYYY-MM-DD inputs.
 */
export function computeHistoryStats(entries: HistoryEntry[], today: string): HistoryStats {
  const totalLogged = entries.length
  const totalCompleted = entries.filter(e => e.action === 'complete').length

  const d7 = shiftDay(today, -6)   // window of 7 days inclusive of today
  const d30 = shiftDay(today, -29) // window of 30 days inclusive of today

  const last7Completed = entries.filter(
    e => e.action === 'complete' && e.calendarDate >= d7 && e.calendarDate <= today,
  ).length
  const last30Completed = entries.filter(
    e => e.action === 'complete' && e.calendarDate >= d30 && e.calendarDate <= today,
  ).length

  const streakable = new Set(
    entries
      .filter(e => e.action === 'complete' || e.action === 'day_off')
      .map(e => e.calendarDate),
  )
  let currentStreak = 0
  let cursor = today
  while (streakable.has(cursor)) {
    currentStreak++
    cursor = shiftDay(cursor, -1)
  }

  return { totalLogged, totalCompleted, last7Completed, last30Completed, currentStreak }
}

/** Shift a YYYY-MM-DD string by `delta` days (positive or negative). */
function shiftDay(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + delta)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
