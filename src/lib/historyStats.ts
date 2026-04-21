import type { HistoryEntry, ExtraWorkoutEntry } from '../types'

export interface HistoryStats {
  totalLogged: number
  totalCompleted: number
  last7Completed: number
  last30Completed: number
  currentStreak: number
}

/**
 * Compute read-only stats over a set of history entries and ad-hoc extras.
 *
 * - `totalLogged` counts rotation entries (any action) plus every extra.
 * - `totalCompleted` counts `complete` rotation entries plus every extra
 *   (extras represent workouts the user actually did).
 * - `last7Completed` / `last30Completed` count `complete` rotation entries
 *   and extras within the N-day window ending on `today` (inclusive).
 * - `currentStreak` counts consecutive calendar days ending at `today`
 *   (inclusive) that have a `complete` or `day_off` rotation entry, or
 *   any extra. `skip` (without a qualifying counterpart on the same day)
 *   or an empty day breaks the streak.
 *
 * All date math uses string comparison on YYYY-MM-DD inputs.
 */
export function computeHistoryStats(
  entries: HistoryEntry[],
  extras: ExtraWorkoutEntry[],
  today: string,
): HistoryStats {
  const totalLogged = entries.length + extras.length
  const totalCompleted =
    entries.filter(e => e.action === 'complete').length + extras.length

  const d7 = shiftDay(today, -6)   // window of 7 days inclusive of today
  const d30 = shiftDay(today, -29) // window of 30 days inclusive of today

  const inWindow = (date: string, from: string) =>
    date >= from && date <= today

  const last7Completed =
    entries.filter(e => e.action === 'complete' && inWindow(e.calendarDate, d7)).length +
    extras.filter(e => inWindow(e.calendarDate, d7)).length
  const last30Completed =
    entries.filter(e => e.action === 'complete' && inWindow(e.calendarDate, d30)).length +
    extras.filter(e => inWindow(e.calendarDate, d30)).length

  const streakable = new Set<string>()
  for (const e of entries) {
    if (e.action === 'complete' || e.action === 'day_off') streakable.add(e.calendarDate)
  }
  for (const e of extras) streakable.add(e.calendarDate)

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
