// ── Calendar-anchored program weeks ──────────────────────────────────────────
// A "weekly" program's plan days are ONE week of sessions. The program week for a
// date comes from the calendar (whole weeks since the start date, minus paused
// weeks), so missed or moved workouts never shift week-specific targets or deloads.
// Each new week restarts the rotation at its first day; within a week, a missed
// session still carries forward to the next day.

import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { ExtraWorkoutEntry, HistoryEntry, OverrideEntry, Plan, PlanDay, Weekday, WorkoutSlot } from '../types'
import type { ExerciseSpec, ProgramMeta } from '../types/program'

export interface ProgramWeekInfo {
  /** 1-based program week (paused weeks don't count). */
  week: number
  totalWeeks: number
  /** First calendar date of this week. */
  weekStart: string
  paused: boolean
  deload: boolean
}

export function isWeeklyProgram(plan: Plan): boolean {
  return plan.programMeta?.weekly === true && plan.days.length > 0
}

/** 0-based calendar week index since the plan start, or null before the start. */
function calendarWeekIndex(plan: Plan, date: string): number | null {
  const days = differenceInCalendarDays(parseISO(date), parseISO(plan.startDate))
  return days < 0 ? null : Math.floor(days / 7)
}

function weekStartFor(plan: Plan, index: number): string {
  return format(addDays(parseISO(plan.startDate), index * 7), 'yyyy-MM-dd')
}

export function programWeekForDate(plan: Plan, date: string): ProgramWeekInfo | null {
  if (!isWeeklyProgram(plan)) return null
  const index = calendarWeekIndex(plan, date)
  if (index == null) return null
  const weekStart = weekStartFor(plan, index)
  const paused = plan.pausedWeeks ?? []
  const pausedBefore = paused.filter(d => d < weekStart).length
  const week = index + 1 - pausedBefore
  return {
    week,
    totalWeeks: plan.duration.value,
    weekStart,
    paused: paused.includes(weekStart),
    deload: plan.programMeta?.deload?.weeks.includes(week) ?? false,
  }
}

/** Weekly programs restart at day 1 on each week boundary (applied before that date's overrides). */
export function realignPointer(plan: Plan, date: string, pointer: number): number {
  if (!isWeeklyProgram(plan)) return pointer
  const days = differenceInCalendarDays(parseISO(date), parseISO(plan.startDate))
  return days > 0 && days % 7 === 0 ? 0 : pointer
}

/** Extra calendar weeks a weekly program runs because of pauses. */
export function pausedWeekCount(plan: Plan): number {
  return isWeeklyProgram(plan) ? (plan.pausedWeeks ?? []).length : 0
}

// ── Materialising a week's version of a plan day ─────────────────────────────

function scheduleValue(meta: ProgramMeta, key: string, week: number): string | null {
  if (key === 'week') return String(week)
  const list = meta.schedule?.[key]
  if (!list || list.length === 0) return null
  return String(list[Math.min(week, list.length) - 1])
}

/** Replace `{key}` placeholders in every string of a value with this week's schedule entry. */
function fillPlaceholders<T>(value: T, meta: ProgramMeta, week: number): T {
  if (typeof value === 'string') {
    return value.replace(/\{(\w+)\}/g, (m, key: string) => scheduleValue(meta, key, week) ?? m) as T
  }
  if (Array.isArray(value)) return value.map(v => fillPlaceholders(v, meta, week)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, fillPlaceholders(v, meta, week)]),
    ) as T
  }
  return value
}

function deloadExercise(ex: ExerciseSpec, multiplier: number): ExerciseSpec {
  const cut = (n: number) => Math.max(1, Math.round(n * multiplier))
  const { progress: _noProgression, ...rest } = ex
  if (Array.isArray(ex.sets)) return { ...rest, sets: ex.sets.slice(0, cut(ex.sets.length)) }
  return { ...rest, sets: cut(typeof ex.sets === 'number' ? ex.sets : 3) }
}

function deloadSlot(slot: WorkoutSlot, multiplier: number): WorkoutSlot {
  if (!slot.exercises) return slot
  return {
    ...slot,
    name: `${slot.name} (Deload)`,
    isDeload: true,
    weightsIntent: 'deload',
    notes: ['Deload week: same weights, fewer sets, stop well short of failure.', slot.notes].filter(Boolean).join(' '),
    exercises: slot.exercises.map(ex => deloadExercise(ex, multiplier)),
  }
}

/** This program week's version of a template day: schedule values filled in, deload applied. */
export function materializeDay(day: PlanDay, meta: ProgramMeta | undefined, info: ProgramWeekInfo | null): PlanDay {
  if (!meta || !info) return day
  const filled = fillPlaceholders(day, meta, info.week)
  if (!info.deload) return filled
  const multiplier = meta.deload?.setsMultiplier ?? 0.6
  return { ...filled, slots: filled.slots.map(s => deloadSlot(s, multiplier)) }
}

/** The plan day at `index`, as it applies on `date` (materialised for weekly programs). */
export function planDayForDate(plan: Plan, index: number, date: string): PlanDay {
  const day = plan.days[index]
  if (!day || !isWeeklyProgram(plan)) return day
  return materializeDay(day, plan.programMeta, programWeekForDate(plan, date))
}

// ── Weekly session assignment (the weekly checklist) ──────────────────────────
// A weekly program's sessions aren't a strict sequence: each date gets the first
// session not yet done this week that is allowed on that weekday (day-limited
// sessions first on their days; optional ones dropped when the week runs short). Logged sessions
// (rotation entries, or bonus extras from the plan) mark a session done; a `jump`
// override on a date pins that date to a chosen session — that's how "do this one
// today" (including outside its allowed days) works. A `defer` override ("do later")
// keeps its session off the next day's suggestion, so it comes back the day after.

const WEEKDAY_BY_INDEX: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** No session is suggested for the date (week done, or only other-day sessions left). */
export const REST_DAY_INDEX = -1

export function weekdayOf(date: string): Weekday {
  return WEEKDAY_BY_INDEX[parseISO(date).getDay()]
}

export function isAllowedOn(day: PlanDay, date: string): boolean {
  return !day.allowedDays?.length || day.allowedDays.includes(weekdayOf(date))
}

function newestByDate<T extends { calendarDate: string; createdAt: string }>(items: T[]): Map<string, T> {
  const map = new Map<string, T>()
  for (const it of items) {
    const prev = map.get(it.calendarDate)
    if (!prev || it.createdAt > prev.createdAt) map.set(it.calendarDate, it)
  }
  return map
}

/** Session index per date for the 7 days starting at `weekStart` (REST_DAY_INDEX = nothing suggested). */
export function weeklyAssignments(
  plan: Plan,
  entries: HistoryEntry[],
  overrides: OverrideEntry[],
  extras: ExtraWorkoutEntry[],
  weekStart: string,
  today: string,
): Map<string, number> {
  const entryByDate = newestByDate(entries.filter(e => e.planId === plan.id))
  const pinned = new Map<string, number>()
  for (const o of [...overrides].filter(o => o.planId === plan.id && o.type === 'jump' && o.targetDayIndex != null)
    .sort((a, b) => a.appliedAt.localeCompare(b.appliedAt))) {
    pinned.set(format(new Date(o.appliedAt), 'yyyy-MM-dd'), o.targetDayIndex!)
  }
  const deferredOn = new Map<string, number>() // date → session put off the day before
  for (const o of overrides) {
    if (o.planId !== plan.id || o.type !== 'defer' || o.targetDayIndex == null) continue
    deferredOn.set(format(addDays(new Date(o.appliedAt), 1), 'yyyy-MM-dd'), o.targetDayIndex)
  }
  const done = new Set<number>()
  const result = new Map<string, number>()
  // Plan order, except day-limited sessions go first on their days (they have the fewest
  // chances), and optional sessions are skipped once the remaining days are only enough
  // for the required ones — so a missed Monday drops the optional, not the long run.
  const pick = (date: string, daysLeft: number, avoid = deferredOn.get(date) ?? null): number => {
    const requiredLeft = plan.days.filter((d, idx) => !d.optional && !done.has(idx)).length
    const skipOptional = requiredLeft >= daysLeft
    let best = REST_DAY_INDEX
    let bestKey = ''
    plan.days.forEach((d, idx) => {
      if (done.has(idx) || idx === avoid || !isAllowedOn(d, date) || (skipOptional && d.optional)) return
      const key = `${d.allowedDays?.length ? 0 : 1}${String(idx).padStart(3, '0')}`
      if (best === REST_DAY_INDEX || key < bestKey) { best = idx; bestKey = key }
    })
    // The put-off session is still better than nothing
    return best === REST_DAY_INDEX && avoid != null ? pick(date, daysLeft, null) : best
  }

  for (let i = 0; i < 7; i++) {
    const date = format(addDays(parseISO(weekStart), i), 'yyyy-MM-dd')
    const entry = entryByDate.get(date)
    const forced = pinned.get(date)
    let idx: number
    if (entry && entry.action !== 'day_off' && entry.planDayIndex != null) {
      idx = entry.planDayIndex
      done.add(idx)
    } else {
      idx = forced != null && forced < plan.days.length ? forced : pick(date, 7 - i)
      // Today/future dates are projected as done; unlogged past dates and days off aren't
      if (!entry && date >= today && idx !== REST_DAY_INDEX) done.add(idx)
    }
    // Bonus sessions done from the plan that day
    for (const x of extras) {
      if (x.planId === plan.id && x.calendarDate === date && x.planDayIndex != null) done.add(x.planDayIndex)
    }
    result.set(date, idx)
  }
  return result
}

export interface ChecklistItem {
  index: number
  day: PlanDay
  status: 'done' | 'skipped' | 'pending'
  allowedToday: boolean
}

/** This week's sessions and where each stands, as of `today`. */
export function weeklyChecklist(
  plan: Plan,
  entries: HistoryEntry[],
  extras: ExtraWorkoutEntry[],
  today: string,
): ChecklistItem[] | null {
  const info = programWeekForDate(plan, today)
  if (!info) return null
  const inWeek = (d: string) => d >= info.weekStart && d <= today
  const status = new Map<number, ChecklistItem['status']>()
  for (const e of entries) {
    if (e.planId !== plan.id || !inWeek(e.calendarDate) || e.planDayIndex == null) continue
    if (e.action === 'complete') status.set(e.planDayIndex, 'done')
    else if (e.action === 'skip' && status.get(e.planDayIndex) !== 'done') status.set(e.planDayIndex, 'skipped')
  }
  for (const x of extras) {
    if (x.planId === plan.id && inWeek(x.calendarDate) && x.planDayIndex != null) status.set(x.planDayIndex, 'done')
  }
  return plan.days.map((d, index) => ({
    index,
    day: planDayForDate(plan, index, today),
    status: status.get(index) ?? 'pending',
    allowedToday: isAllowedOn(d, today),
  }))
}
