import type { HistoryEntry, ExtraWorkoutEntry, Plan } from '../types'

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

// ── Plan progress ─────────────────────────────────────────────────────────────

export interface PlanProgress {
  /** Number of completed units (rotations or full weeks elapsed). */
  completed: number
  /** Total units defined by the plan's duration. */
  total: number
  /** 0–100, capped at 100. */
  percentComplete: number
}

/**
 * Compute how far through its defined duration a plan has progressed.
 *
 * - `weeks` plans: completed = full 7-day weeks elapsed since startDate
 *   (floor), capped at the plan's week count.
 * - `rotations` plans: completed = full rotations finished, where one
 *   rotation = plan.days.length complete/skip entries. `day_off` entries
 *   do not count toward rotation completion (mirrors `isPlanExpired`).
 *
 * Returns zeros for an empty-day plan or a plan that hasn't started yet.
 */
export function computePlanProgress(
  plan: Plan,
  entries: HistoryEntry[],
  today: string,
): PlanProgress {
  const total = plan.duration.value

  if (plan.days.length === 0 || total <= 0) {
    return { completed: 0, total, percentComplete: 0 }
  }

  let completed: number

  if (plan.duration.type === 'weeks') {
    const daysElapsed = dateDiffDays(plan.startDate, today)
    const weeksElapsed = Math.max(0, Math.floor(daysElapsed / 7))
    completed = Math.min(weeksElapsed, total)
  } else {
    const planEntries = entries.filter(
      e => e.planId === plan.id && (e.action === 'complete' || e.action === 'skip'),
    )
    const rotationsFinished = Math.floor(planEntries.length / plan.days.length)
    completed = Math.min(rotationsFinished, total)
  }

  const percentComplete = Math.min(Math.round((completed / total) * 100), 100)
  return { completed, total, percentComplete }
}

/** Difference in calendar days between two YYYY-MM-DD strings (b − a). */
function dateDiffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const dtA = Date.UTC(ay, am - 1, ad)
  const dtB = Date.UTC(by, bm - 1, bd)
  return Math.floor((dtB - dtA) / 86_400_000)
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
