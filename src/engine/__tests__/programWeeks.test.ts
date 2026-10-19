import { describe, it, expect } from 'vitest'
import { programWeekForDate, planDayForDate, realignPointer } from '../programWeeks'
import { computeCurrentDayIndex, getTodayResolvedDay, isPlanExpired } from '../rotationEngine'
import type { HistoryEntry, Plan } from '../../types'

// Start Monday 2026-11-02; 3-day "week" template so the realign is visible.
const plan: Plan = {
  id: 'p', name: 'Weekly', status: 'active', createdAt: '', updatedAt: '',
  startDate: '2026-11-02', startDayIndex: 0,
  duration: { type: 'weeks', value: 4 },
  programMeta: {
    version: 1,
    vars: { squat: 155 },
    weekly: true,
    schedule: { run: [10, 12, 15, 9] },
    deload: { weeks: [4], setsMultiplier: 0.6 },
  },
  days: [
    { id: 'a', label: 'Lift', slots: [{ id: 'a1', type: 'weights', name: 'Lift', exercises: [
      { exercise: 'Squat', sets: 3, reps: '6-8', load: 'squat', progress: { if: 'all_reps', then: 'squat += 5' } },
      { exercise: 'Row', sets: [{ reps: 8 }, { reps: 8 }], reps: 8 },
    ] }] },
    { id: 'b', label: 'Run', slots: [{ id: 'b1', type: 'run', name: 'Run — {run} min', segments: [{ type: 'easy', duration: '{run}m' }] }] },
    { id: 'c', label: 'Swim', slots: [{ id: 'c1', type: 'swim', name: 'Swim' }] },
  ],
}
const log = (date: string, idx: number): HistoryEntry => ({ id: date, planId: 'p', calendarDate: date, planDayIndex: idx, action: 'complete', createdAt: date })

describe('programWeekForDate', () => {
  it('counts calendar weeks from the start date', () => {
    expect(programWeekForDate(plan, '2026-11-01')).toBeNull()
    expect(programWeekForDate(plan, '2026-11-08')?.week).toBe(1)
    expect(programWeekForDate(plan, '2026-11-09')?.week).toBe(2)
    expect(programWeekForDate(plan, '2026-11-23')).toMatchObject({ week: 4, deload: true })
  })

  it('paused weeks do not count and push the end date back', () => {
    const paused = { ...plan, pausedWeeks: ['2026-11-09'] }
    expect(programWeekForDate(paused, '2026-11-10')).toMatchObject({ paused: true })
    expect(programWeekForDate(paused, '2026-11-16')?.week).toBe(2)
    expect(isPlanExpired(plan, [], '2026-11-30')).toBe(true)
    expect(isPlanExpired(paused, [], '2026-11-30')).toBe(false)
  })

  it('is null for non-weekly plans', () => {
    expect(programWeekForDate({ ...plan, programMeta: { version: 1, vars: {} } }, '2026-11-09')).toBeNull()
  })
})

describe('planDayForDate', () => {
  it('fills this week\'s schedule values', () => {
    const day = planDayForDate(plan, 1, '2026-11-10') // week 2
    expect(day.slots[0].name).toBe('Run — 12 min')
    expect(day.slots[0].segments?.[0].duration).toBe('12m')
  })

  it('applies deload: fewer sets, no progression rules', () => {
    const day = planDayForDate(plan, 0, '2026-11-23') // week 4
    const [squat, row] = day.slots[0].exercises!
    expect(squat.sets).toBe(2)
    expect(squat.progress).toBeUndefined()
    expect(Array.isArray(row.sets) && row.sets.length).toBe(1)
    expect(day.slots[0].name).toBe('Lift (Deload)')
  })
})

describe('rotation realign', () => {
  it('a missed day carries forward within the week, then each week restarts at day 1', () => {
    // Week 1: Mon unlogged, Tue does Lift (carried), Wed does Run
    const entries = [log('2026-11-03', 0), log('2026-11-04', 1)]
    expect(computeCurrentDayIndex(plan, entries, [], '2026-11-05')).toBe(2) // Swim still pending
    // Next week starts fresh: Lift, not the leftover Swim
    expect(getTodayResolvedDay(plan, entries, [], '2026-11-09').planDay.label).toBe('Lift')
    expect(realignPointer(plan, '2026-11-09', 2)).toBe(0)
    expect(realignPointer(plan, '2026-11-10', 2)).toBe(2)
  })
})
