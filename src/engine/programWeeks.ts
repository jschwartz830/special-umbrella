// ── Calendar-anchored program weeks ──────────────────────────────────────────
// A "weekly" program's plan days are ONE week of sessions. The program week for a
// date comes from the calendar (whole weeks since the start date, minus paused
// weeks), so missed or moved workouts never shift week-specific targets or deloads.
// Each new week restarts the rotation at its first day; within a week, a missed
// session still carries forward to the next day.

import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { Plan, PlanDay, WorkoutSlot } from '../types'
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
