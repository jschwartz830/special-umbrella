import { describe, expect, it } from 'vitest'
import { getPlansWithHistory, hasPlanHistory } from '../historyScope'
import type { Plan, HistoryEntry, ExtraWorkoutEntry } from '../../types'

function plan(id: string): Plan {
  return {
    id,
    name: `Plan ${id}`,
    status: 'inactive',
    startDate: '2026-01-01',
    startDayIndex: 0,
    duration: { type: 'rotations', value: 1 },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    days: [],
  }
}

function entry(planId: string): HistoryEntry {
  return {
    id: `entry-${planId}`,
    planId,
    calendarDate: '2026-04-10',
    action: 'complete',
    planDayIndex: 0,
    createdAt: '2026-04-10T12:00:00Z',
  }
}

function extra(planId: string): ExtraWorkoutEntry {
  return {
    id: `extra-${planId}`,
    planId,
    calendarDate: '2026-04-10',
    workoutType: 'yoga',
    workoutName: 'Yoga',
    createdAt: '2026-04-10T13:00:00Z',
  }
}

describe('historyScope helpers', () => {
  it('includes plans that have only rotation entries', () => {
    const plans = { p1: plan('p1'), p2: plan('p2') }
    const results = getPlansWithHistory(plans, [entry('p2')], [])
    expect(results.map(p => p.id)).toEqual(['p2'])
  })

  it('includes plans that have only extra entries', () => {
    const plans = { p1: plan('p1'), p2: plan('p2') }
    const results = getPlansWithHistory(plans, [], [extra('p1')])
    expect(results.map(p => p.id)).toEqual(['p1'])
  })

  it('hasPlanHistory returns true for extras-only plans', () => {
    expect(hasPlanHistory('p1', [], [extra('p1')])).toBe(true)
  })

  it('hasPlanHistory returns false for null and unknown ids', () => {
    expect(hasPlanHistory(null, [entry('p1')], [extra('p1')])).toBe(false)
    expect(hasPlanHistory('p3', [entry('p1')], [extra('p2')])).toBe(false)
  })
})
