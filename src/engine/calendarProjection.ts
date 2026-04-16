import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  startOfWeek,
  endOfWeek,
} from 'date-fns'
import type { Plan, HistoryEntry, OverrideEntry, ResolvedDay } from '../types'
import { getResolvedDaysRange, getUpcomingDays, mod } from './rotationEngine'

export interface CalendarCell {
  date: string           // YYYY-MM-DD
  isCurrentMonth: boolean
  isToday: boolean
  resolvedDay?: ResolvedDay
}

export type CalendarWeek = CalendarCell[]

/**
 * Build a full month grid (6 weeks × 7 days) with resolved workout data.
 */
export function buildMonthGrid(
  year: number,
  month: number, // 0-indexed
  plan: Plan | null,
  entries: HistoryEntry[],
  overrides: OverrideEntry[],
  today: string,
): CalendarWeek[] {
  const monthStart = startOfMonth(new Date(year, month, 1))
  const monthEnd = endOfMonth(monthStart)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

  // Get resolved days for the entire grid range if we have an active plan.
  // Clamp fromDate to plan.startDate so dates before the plan began are left
  // without a resolvedDay (the calendar renders them as neutral/inactive cells).
  let resolvedMap = new Map<string, ResolvedDay>()
  if (plan) {
    const planEntries = entries.filter(e => e.planId === plan.id)
    const planOverrides = overrides.filter(o => o.planId === plan.id)
    const rawFromDate = format(gridStart, 'yyyy-MM-dd')
    const toDate = format(gridEnd, 'yyyy-MM-dd')

    // Only fetch days the plan has actually started for — skip pre-start dates
    const fromDate = rawFromDate < plan.startDate ? plan.startDate : rawFromDate

    if (fromDate <= toDate) {
      const resolvedDays = getResolvedDaysRange(
        plan,
        planEntries,
        planOverrides,
        today,
        fromDate,
        toDate,
      )
      for (const rd of resolvedDays) {
        resolvedMap.set(rd.calendarDate, rd)
      }
    }
  }

  const weeks: CalendarWeek[] = []
  let week: CalendarCell[] = []

  for (const day of allDays) {
    const dateStr = format(day, 'yyyy-MM-dd')
    const isCurrentMonth = day.getMonth() === month
    const isToday = dateStr === today

    week.push({
      date: dateStr,
      isCurrentMonth,
      isToday,
      resolvedDay: resolvedMap.get(dateStr),
    })

    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }

  if (week.length > 0) weeks.push(week)

  return weeks
}

// Re-export mod so calendarProjection users don't need to import engine internals
export { mod }

/**
 * Generate a future projection starting from tomorrow.
 *
 * Delegates to getUpcomingDays (the canonical engine function) after
 * filtering entries and overrides to the given plan. Previously this
 * function had its own projection loop that diverged from getUpcomingDays
 * by not applying today's overrides and not advancing for day_off entries.
 *
 * Currently unused by active pages (TodayPage uses getUpcomingDays directly
 * via useActivePlan hook), but kept as a convenience wrapper.
 */
export function getFutureProjection(
  plan: Plan,
  entries: HistoryEntry[],
  overrides: OverrideEntry[],
  today: string,
  days: number,
): ResolvedDay[] {
  const planEntries = entries.filter(e => e.planId === plan.id)
  const planOverrides = overrides.filter(o => o.planId === plan.id)
  return getUpcomingDays(plan, planEntries, planOverrides, today, days)
}
