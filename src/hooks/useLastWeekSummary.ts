import { useMemo } from 'react'
import { useDismissableBanner } from './useDismissableBanner'
import { computeWeeklyBreakdown, isoWeekStart } from '../lib/historyStats'
import type { HistoryEntry, ExtraWorkoutEntry } from '../store/historyStore'

function shiftDay(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

export interface LastWeekSummary {
  weekStart: string
  weekEnd: string
  completed: number
  skipped: number
  dayOffs: number
  extras: number
  totalLogged: number
  isDismissed: boolean
  dismiss: () => void
}

/**
 * Returns last week's breakdown on Mondays when there is activity to show.
 * Returns null on non-Mondays, or when last week had no logged activity.
 * Dismissable — keyed to planId + week start so it auto-resets each new week.
 */
export function useLastWeekSummary(
  planId: string | null,
  entries: HistoryEntry[],
  extras: ExtraWorkoutEntry[],
  today: string,
): LastWeekSummary | null {
  const isMonday = useMemo(() => {
    const [y, m, d] = today.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1
  }, [today])

  const lastWeekStart = useMemo(() => {
    if (!isMonday || !planId) return null
    return shiftDay(isoWeekStart(today), -7)
  }, [isMonday, planId, today])

  const lastWeekEnd = useMemo(
    () => (lastWeekStart ? shiftDay(lastWeekStart, 6) : null),
    [lastWeekStart],
  )

  // Key includes week start so the banner resets automatically each new Monday.
  const dismissKey = planId && lastWeekStart ? `${planId}_${lastWeekStart}` : null
  const { isDismissed, dismiss } = useDismissableBanner('wpt_lastweek_v1_', dismissKey)

  const breakdown = useMemo(() => {
    if (!planId || !lastWeekStart || !lastWeekEnd) return null
    const weeks = computeWeeklyBreakdown(planId, entries, extras, lastWeekStart, lastWeekEnd)
    return weeks.find(w => w.weekStart === lastWeekStart) ?? null
  }, [planId, entries, extras, lastWeekStart, lastWeekEnd])

  if (!isMonday || !planId || !lastWeekStart || !lastWeekEnd || !breakdown) return null

  return {
    weekStart: lastWeekStart,
    weekEnd: lastWeekEnd,
    completed: breakdown.completed,
    skipped: breakdown.skipped,
    dayOffs: breakdown.dayOffs,
    extras: breakdown.extras,
    totalLogged: breakdown.totalLogged,
    isDismissed,
    dismiss,
  }
}
