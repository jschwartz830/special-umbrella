import { describe, it, expect } from 'vitest'
import { weeklyAssignments, weeklyChecklist, REST_DAY_INDEX } from '../programWeeks'
import { getTodayResolvedDay } from '../rotationEngine'
import type { HistoryEntry, OverrideEntry, Plan, PlanDay } from '../../types'

const day = (label: string, extra: Partial<PlanDay> = {}): PlanDay =>
  ({ id: label, label, slots: [{ id: label, type: 'weights', name: label }], ...extra })

// Mon 2026-11-02 start. A, run, B, run, D (optional), C+swim (Sat/Sun), long run
const plan: Plan = {
  id: 'p', name: 'W', status: 'active', createdAt: '', updatedAt: '', startDate: '2026-11-02', startDayIndex: 0,
  duration: { type: 'weeks', value: 12 },
  programMeta: { version: 1, vars: {}, weekly: true },
  days: [day('A'), day('Run1'), day('B'), day('Run2'), day('D', { optional: true }), day('C', { allowedDays: ['sat', 'sun'] }), day('Long')],
}
const WEEK = '2026-11-02'
const log = (date: string, idx: number, action: HistoryEntry['action'] = 'complete'): HistoryEntry =>
  ({ id: date, planId: 'p', calendarDate: date, planDayIndex: idx, action, createdAt: date })
const labels = (m: Map<string, number>) => [...m.values()].map(i => (i === REST_DAY_INDEX ? '-' : plan.days[i].label))

describe('weeklyAssignments', () => {
  it('lays out a normal week in order, gym session on Saturday', () => {
    expect(labels(weeklyAssignments(plan, [], [], [], WEEK, WEEK))).toEqual(['A', 'Run1', 'B', 'Run2', 'D', 'C', 'Long'])
  })

  it('a "do anyway" pick (jump override) puts a weekend-only session on a weekday', () => {
    const jump: OverrideEntry = { id: 'j', planId: 'p', type: 'jump', targetDayIndex: 5, appliedAt: '2026-11-03T18:00:00' }
    const m = weeklyAssignments(plan, [log('2026-11-02', 0)], [jump], [], WEEK, '2026-11-03')
    expect(labels(m)).toEqual(['A', 'C', 'Run1', 'B', 'Run2', 'D', 'Long'])
  })

  it('drops the optional session, not a required one, when the week runs short', () => {
    // Mon missed; today Tue: A, Run1, B, Run2 Tue–Fri, gym Sat, long run Sun — D dropped
    expect(labels(weeklyAssignments(plan, [], [], [], WEEK, '2026-11-03')).slice(1))
      .toEqual(['A', 'Run1', 'B', 'Run2', 'C', 'Long'])
  })

  it('bonus sessions logged as extras count as done', () => {
    const m = weeklyAssignments(plan, [log('2026-11-02', 0)], [], [
      { id: 'x', planId: 'p', calendarDate: '2026-11-02', workoutType: 'run', workoutName: 'Run1', planDayIndex: 1, createdAt: '' },
    ], WEEK, '2026-11-03')
    expect(labels(m)[1]).toBe('B')
  })
})

describe('weeklyChecklist + today', () => {
  it('reports status, allowed-today, and a rest day when nothing fits today', () => {
    const entries = [log('2026-11-02', 0), log('2026-11-03', 1), log('2026-11-04', 2, 'skip'), log('2026-11-05', 3)]
    const items = weeklyChecklist(plan, entries, [], '2026-11-06')!
    expect(items.map(i => i.status)).toEqual(['done', 'done', 'skipped', 'done', 'pending', 'pending', 'pending'])
    expect(items[5].allowedToday).toBe(false)
    expect(items[4].allowedToday).toBe(true)

    // Friday with only the weekend session left (D done, Long done) → rest, pick it anyway via override
    const fri = [log('2026-11-02', 0), log('2026-11-03', 1), log('2026-11-04', 2), log('2026-11-05', 3)]
    const extras = [{ id: 'd', planId: 'p', calendarDate: '2026-11-05', workoutType: 'weights' as const, workoutName: 'D', planDayIndex: 4, createdAt: '' },
      { id: 'l', planId: 'p', calendarDate: '2026-11-05', workoutType: 'run' as const, workoutName: 'Long', planDayIndex: 6, createdAt: '' }]
    expect(getTodayResolvedDay(plan, fri, [], '2026-11-06', extras).planDayIndex).toBe(REST_DAY_INDEX)
    const jump: OverrideEntry = { id: 'j', planId: 'p', type: 'jump', targetDayIndex: 5, appliedAt: '2026-11-06T12:00:00' }
    expect(getTodayResolvedDay(plan, fri, [jump], '2026-11-06', extras).planDay.label).toBe('C')
  })
})
