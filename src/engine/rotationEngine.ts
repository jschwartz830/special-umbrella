import { format, addDays, parseISO, differenceInCalendarDays } from 'date-fns'
import type { Plan, HistoryEntry, OverrideEntry, ResolvedDay, DayStatus } from '../types'

/** Symmetric modulo — handles negative values from go_back */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

/**
 * Apply all overrides whose appliedAt date == `date`, in chronological order.
 * Returns the updated pointer.
 */
function applyOverridesForDate(
  pointer: number,
  sortedOverrides: OverrideEntry[],
  date: string,
  planLength: number,
): number {
  for (const ov of sortedOverrides) {
    // Extract LOCAL date — appliedAt is UTC ISO, but we compare against local date strings
    const ovLocalDate = format(new Date(ov.appliedAt), 'yyyy-MM-dd')
    if (ovLocalDate !== date) continue
    if (ov.type === 'advance') pointer = mod(pointer + 1, planLength)
    else if (ov.type === 'go_back') pointer = mod(pointer - 1, planLength)
    else if (ov.type === 'jump' && ov.targetDayIndex !== undefined)
      pointer = mod(ov.targetDayIndex, planLength)
    // swap_slot does not affect the pointer
  }
  return pointer
}

/**
 * Pure function: derive the rotation pointer at the START of `targetDate`.
 * Processes all dates strictly before `targetDate` (startDate → targetDate-1).
 * Does NOT apply overrides for `targetDate` itself — callers handle that.
 */
export function computeCurrentDayIndex(
  plan: Plan,
  entries: HistoryEntry[],
  overrides: OverrideEntry[],
  targetDate: string,
): number {
  if (plan.days.length === 0) return 0

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

  const dayCount = differenceInCalendarDays(parseISO(targetDate), parseISO(plan.startDate))
  let pointer = plan.startDayIndex

  for (let i = 0; i < dayCount; i++) {
    const date = format(addDays(parseISO(plan.startDate), i), 'yyyy-MM-dd')

    // Overrides first — they change what workout was shown on this day
    pointer = applyOverridesForDate(pointer, sortedOverrides, date, plan.days.length)

    // Then advance based on history entry
    const entry = entryByDate.get(date)
    if (entry && (entry.action === 'complete' || entry.action === 'skip')) {
      pointer = mod(pointer + 1, plan.days.length)
    }
    // day_off or no entry: pointer stays
  }

  return pointer
}

/**
 * Resolve today's workout day.
 * Applies today's overrides on top of the base pointer (they take immediate effect).
 */
export function getTodayResolvedDay(
  plan: Plan,
  entries: HistoryEntry[],
  overrides: OverrideEntry[],
  today: string,
): ResolvedDay {
  const sortedOverrides = [...overrides].sort((a, b) =>
    a.appliedAt.localeCompare(b.appliedAt),
  )

  // Base pointer (everything before today) + today's overrides
  let idx = computeCurrentDayIndex(plan, entries, overrides, today)
  idx = applyOverridesForDate(idx, sortedOverrides, today, plan.days.length)

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
 * Get upcoming workout days (tomorrow + next `count` days).
 * Applies today's overrides before projecting forward.
 */
export function getUpcomingDays(
  plan: Plan,
  entries: HistoryEntry[],
  overrides: OverrideEntry[],
  today: string,
  count: number,
): ResolvedDay[] {
  if (plan.days.length === 0) return []

  const sortedOverrides = [...overrides].sort((a, b) =>
    a.appliedAt.localeCompare(b.appliedAt),
  )

  // Start from today's pointer (with today's overrides applied)
  let pointer = computeCurrentDayIndex(plan, entries, overrides, today)
  pointer = applyOverridesForDate(pointer, sortedOverrides, today, plan.days.length)

  // Advance pointer for tomorrow's projection — always, unless today has an
  // explicit day_off entry (which holds the rotation in place).
  const todayEntry = entries.find(e => e.calendarDate === today)
  if (todayEntry?.action !== 'day_off') {
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
 * Compute resolved days for a date range (calendar view).
 *
 * Key rules:
 *  - Overrides applied on a date affect what's SHOWN on that date (applied before reading planDay)
 *  - Past dates: pointer advances only on complete/skip entries; no entry = pending (stuck)
 *  - Today + future: pointer always advances unless a day_off entry is logged
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

  // Pointer at the start of fromDate (processes everything before fromDate)
  let pointer = computeCurrentDayIndex(plan, entries, overrides, fromDate)

  const result: ResolvedDay[] = []
  const days = differenceInCalendarDays(parseISO(toDate), parseISO(fromDate)) + 1

  for (let i = 0; i < days; i++) {
    const date = format(addDays(parseISO(fromDate), i), 'yyyy-MM-dd')
    const entry = entryByDate.get(date)

    // ── Fix: apply overrides BEFORE reading planDay ──────────────────────
    pointer = applyOverridesForDate(pointer, sortedOverrides, date, plan.days.length)

    const planDay = plan.days[pointer]

    // Determine status
    let status: DayStatus
    if (date === today) {
      if (!entry) status = 'today_pending'
      else if (entry.action === 'complete') status = 'today_complete'
      else if (entry.action === 'skip') status = 'today_skip'
      else status = 'today_day_off'
    } else if (date < today) {
      if (!entry) status = 'past_unlogged'
      else if (entry.action === 'complete') status = 'past_complete'
      else if (entry.action === 'skip') status = 'past_skip'
      else status = 'past_day_off'
    } else {
      status = 'future'
    }

    result.push({ calendarDate: date, planDayIndex: pointer, planDay, status, historyEntry: entry })

    // ── Fix: advance pointer for future projection ───────────────────────
    const entryAdvances = !!entry && (entry.action === 'complete' || entry.action === 'skip')
    // Past with no entry: rotation is stuck (missed day). Today/future: always advance
    // unless a day_off is explicitly logged.
    const projectForward = date >= today && entry?.action !== 'day_off' && !entryAdvances

    if (entryAdvances || projectForward) {
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
    const endDate = format(addDays(parseISO(plan.startDate), value * 7), 'yyyy-MM-dd')
    return today >= endDate
  }
  const completeSkip = entries.filter(
    e => e.planId === plan.id && (e.action === 'complete' || e.action === 'skip'),
  )
  return Math.floor(completeSkip.length / plan.days.length) >= value
}

/** Generate a short unique id */
export function nanoid(): string {
  return Math.random().toString(36).slice(2, 11)
}
