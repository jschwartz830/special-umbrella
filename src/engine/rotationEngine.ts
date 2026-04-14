import { format, addDays, parseISO, differenceInCalendarDays } from 'date-fns'
import type { Plan, HistoryEntry, OverrideEntry, ResolvedDay, DayStatus } from '../types'

/** Symmetric modulo — handles negative values from go_back */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

/**
 * Pure function: derive the current rotation pointer (planDayIndex) for `today`.
 *
 * Algorithm:
 *  1. Walk calendar dates from plan.startDate to yesterday.
 *  2. For each date, apply any overrides (advance/go_back/jump), then
 *     check if there's a history entry.
 *     - day_off  → pointer does NOT advance
 *     - complete / skip → pointer advances by 1
 *     - no entry (unresolved past) → pointer does NOT advance
 *  3. The result is the planDayIndex for today.
 */
export function computeCurrentDayIndex(
  plan: Plan,
  entries: HistoryEntry[],
  overrides: OverrideEntry[],
  today: string,
): number {
  if (plan.days.length === 0) return 0

  // Index entries and overrides by date for O(1) lookup
  const entryByDate = new Map<string, HistoryEntry>()
  for (const e of entries) {
    // If duplicate entries for same date, keep the latest (by createdAt)
    const existing = entryByDate.get(e.calendarDate)
    if (!existing || e.createdAt > existing.createdAt) {
      entryByDate.set(e.calendarDate, e)
    }
  }

  // Sort overrides ascending by appliedAt
  const sortedOverrides = [...overrides].sort((a, b) =>
    a.appliedAt.localeCompare(b.appliedAt),
  )

  const startDate = plan.startDate
  const dayCount = differenceInCalendarDays(parseISO(today), parseISO(startDate))

  let pointer = plan.startDayIndex

  for (let i = 0; i < dayCount; i++) {
    const date = format(addDays(parseISO(startDate), i), 'yyyy-MM-dd')

    // Apply overrides that were applied on this calendar date
    for (const ov of sortedOverrides) {
      const ovDate = ov.appliedAt.slice(0, 10) // extract YYYY-MM-DD
      if (ovDate !== date) continue
      if (ov.type === 'advance') {
        pointer = mod(pointer + 1, plan.days.length)
      } else if (ov.type === 'go_back') {
        pointer = mod(pointer - 1, plan.days.length)
      } else if (ov.type === 'jump' && ov.targetDayIndex !== undefined) {
        pointer = mod(ov.targetDayIndex, plan.days.length)
      }
      // swap_slot does not affect the pointer
    }

    // Check history entry for this date
    const entry = entryByDate.get(date)
    if (entry) {
      if (entry.action === 'complete' || entry.action === 'skip') {
        pointer = mod(pointer + 1, plan.days.length)
      }
      // day_off: pointer stays
    }
    // no entry: pointer stays (pending/unresolved)
  }

  return pointer
}

/**
 * Resolve today's workout day given the current plan state.
 */
export function getTodayResolvedDay(
  plan: Plan,
  entries: HistoryEntry[],
  overrides: OverrideEntry[],
  today: string,
): ResolvedDay {
  const idx = computeCurrentDayIndex(plan, entries, overrides, today)
  const planDay = plan.days[idx]
  const entry = entries.find(e => e.calendarDate === today)

  let status: DayStatus = 'today_pending'
  if (entry) {
    if (entry.action === 'complete') status = 'today_complete'
    else if (entry.action === 'skip') status = 'today_skip'
    else if (entry.action === 'day_off') status = 'today_day_off'
  }

  return { calendarDate: today, planDayIndex: idx, planDay, status, historyEntry: entry }
}

/**
 * Get upcoming workout days (starting from tomorrow).
 * Returns `count` days projected forward (no overrides applied to future).
 */
export function getUpcomingDays(
  plan: Plan,
  entries: HistoryEntry[],
  overrides: OverrideEntry[],
  today: string,
  count: number,
): ResolvedDay[] {
  if (plan.days.length === 0) return []

  let pointer = computeCurrentDayIndex(plan, entries, overrides, today)

  // If today is resolved (complete or skip), advance pointer for tomorrow
  const todayEntry = entries.find(e => e.calendarDate === today)
  if (todayEntry && (todayEntry.action === 'complete' || todayEntry.action === 'skip')) {
    pointer = mod(pointer + 1, plan.days.length)
  }

  const result: ResolvedDay[] = []
  const todayParsed = parseISO(today)

  for (let i = 1; i <= count; i++) {
    const date = format(addDays(todayParsed, i), 'yyyy-MM-dd')
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

/**
 * Compute resolved days for a range of past dates (for history/calendar).
 */
export function getResolvedDaysRange(
  plan: Plan,
  entries: HistoryEntry[],
  overrides: OverrideEntry[],
  today: string,
  fromDate: string,
  toDate: string,
): ResolvedDay[] {
  if (plan.days.length === 0) return []

  // Build pointer replay from startDate up to fromDate to get initial pointer
  const startPointer = computeCurrentDayIndex(
    plan,
    entries,
    overrides,
    fromDate,
  )

  const entryByDate = new Map<string, HistoryEntry>()
  for (const e of entries) {
    const existing = entryByDate.get(e.calendarDate)
    if (!existing || e.createdAt > existing.createdAt) {
      entryByDate.set(e.calendarDate, e)
    }
  }

  const sortedOverrides = [...overrides].sort((a, b) =>
    a.appliedAt.localeCompare(b.appliedAt),
  )

  const result: ResolvedDay[] = []
  const days = differenceInCalendarDays(parseISO(toDate), parseISO(fromDate)) + 1
  let pointer = startPointer

  for (let i = 0; i < days; i++) {
    const date = format(addDays(parseISO(fromDate), i), 'yyyy-MM-dd')
    const entry = entryByDate.get(date)
    const planDay = plan.days[pointer]

    let status: DayStatus
    const isPast = date < today
    const isToday = date === today

    if (isToday) {
      if (!entry) status = 'today_pending'
      else if (entry.action === 'complete') status = 'today_complete'
      else if (entry.action === 'skip') status = 'today_skip'
      else status = 'today_day_off'
    } else if (isPast) {
      if (!entry) status = 'past_skip' // unresolved past → show as skipped visually
      else if (entry.action === 'complete') status = 'past_complete'
      else if (entry.action === 'skip') status = 'past_skip'
      else status = 'past_day_off'
    } else {
      status = 'future'
    }

    result.push({
      calendarDate: date,
      planDayIndex: pointer,
      planDay,
      status,
      historyEntry: entry,
    })

    // Advance pointer for next day
    // Apply overrides for this date
    for (const ov of sortedOverrides) {
      const ovDate = ov.appliedAt.slice(0, 10)
      if (ovDate !== date) continue
      if (ov.type === 'advance') pointer = mod(pointer + 1, plan.days.length)
      else if (ov.type === 'go_back') pointer = mod(pointer - 1, plan.days.length)
      else if (ov.type === 'jump' && ov.targetDayIndex !== undefined)
        pointer = mod(ov.targetDayIndex, plan.days.length)
    }

    if (entry && (entry.action === 'complete' || entry.action === 'skip')) {
      pointer = mod(pointer + 1, plan.days.length)
    }
  }

  return result
}

/**
 * Check if a plan has exceeded its defined duration.
 */
export function isPlanExpired(
  plan: Plan,
  entries: HistoryEntry[],
  today: string,
): boolean {
  const { type, value } = plan.duration
  if (type === 'weeks') {
    const endDate = format(
      addDays(parseISO(plan.startDate), value * 7),
      'yyyy-MM-dd',
    )
    return today >= endDate
  }
  // rotations: count how many full rotations have been completed
  const completeSkip = entries.filter(
    e => e.planId === plan.id && (e.action === 'complete' || e.action === 'skip'),
  )
  const rotationsCompleted = Math.floor(completeSkip.length / plan.days.length)
  return rotationsCompleted >= value
}

/** Generate a short unique id */
export function nanoid(): string {
  return Math.random().toString(36).slice(2, 11)
}
