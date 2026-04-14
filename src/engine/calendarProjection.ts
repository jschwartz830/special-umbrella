import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  parseISO,
} from 'date-fns'
import type { Plan, HistoryEntry, OverrideEntry, ResolvedDay } from '../types'
import { getResolvedDaysRange, computeCurrentDayIndex, mod } from './rotationEngine'

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

  // Get resolved days for the entire grid range if we have an active plan
  let resolvedMap = new Map<string, ResolvedDay>()
  if (plan) {
    const planEntries = entries.filter(e => e.planId === plan.id)
    const planOverrides = overrides.filter(o => o.planId === plan.id)
    const fromDate = format(gridStart, 'yyyy-MM-dd')
    const toDate = format(gridEnd, 'yyyy-MM-dd')

    // For future days (after today), generate projection
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

    // Fill future days beyond what getResolvedDaysRange covers
    // (it handles past+today+future via status logic, so this is already done)
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

export function getFutureProjection(
  plan: Plan,
  entries: HistoryEntry[],
  overrides: OverrideEntry[],
  today: string,
  days: number,
): ResolvedDay[] {
  const planEntries = entries.filter(e => e.planId === plan.id)
  const planOverrides = overrides.filter(o => o.planId === plan.id)

  let pointer = computeCurrentDayIndex(plan, planEntries, planOverrides, today)
  const todayEntry = planEntries.find(e => e.calendarDate === today)
  if (todayEntry && (todayEntry.action === 'complete' || todayEntry.action === 'skip')) {
    pointer = mod(pointer + 1, plan.days.length)
  }

  const result: ResolvedDay[] = []
  for (let i = 1; i <= days; i++) {
    const date = format(addDays(parseISO(today), i), 'yyyy-MM-dd')
    result.push({
      calendarDate: date,
      planDayIndex: pointer,
      planDay: plan.days[pointer],
      status: 'future',
    })
    pointer = mod(pointer + 1, plan.days.length)
  }
  return result
}
