import { describe, it, expect } from 'vitest'
import { extraToPlanDay, getOffPlanLogs } from '../planDayUtils'
import type { ExtraWorkoutEntry, HistoryEntry, Plan } from '../../types'

function makeExtra(
  overrides: Partial<ExtraWorkoutEntry> = {},
): ExtraWorkoutEntry {
  return {
    id: 'extra-1',
    planId: 'plan-1',
    calendarDate: '2026-06-19',
    workoutType: 'yoga',
    workoutName: 'Morning Yoga',
    createdAt: '2026-06-19T08:00:00Z',
    ...overrides,
  }
}

describe('extraToPlanDay', () => {
  it('returns a PlanDay whose id matches the extra id', () => {
    const extra = makeExtra({ id: 'abc-123' })
    expect(extraToPlanDay(extra).id).toBe('abc-123')
  })

  it('uses workoutName as the PlanDay label', () => {
    const extra = makeExtra({ workoutName: 'Evening Swim' })
    expect(extraToPlanDay(extra).label).toBe('Evening Swim')
  })

  it('returns exactly one slot', () => {
    const extra = makeExtra()
    expect(extraToPlanDay(extra).slots).toHaveLength(1)
  })

  it('slot id matches the extra id', () => {
    const extra = makeExtra({ id: 'slot-id-test' })
    expect(extraToPlanDay(extra).slots[0].id).toBe('slot-id-test')
  })

  it('slot type matches the extra workoutType', () => {
    const extra = makeExtra({ workoutType: 'run' })
    expect(extraToPlanDay(extra).slots[0].type).toBe('run')
  })

  it('slot name matches the extra workoutName', () => {
    const extra = makeExtra({ workoutName: 'Recovery Run' })
    expect(extraToPlanDay(extra).slots[0].name).toBe('Recovery Run')
  })

  it('maps each WorkoutType correctly through the slot', () => {
    const types: ExtraWorkoutEntry['workoutType'][] = [
      'weights', 'run', 'long_run', 'recovery_run', 'swim', 'yoga', 'rest', 'other',
    ]
    for (const workoutType of types) {
      const extra = makeExtra({ workoutType })
      expect(extraToPlanDay(extra).slots[0].type).toBe(workoutType)
    }
  })

  it('produces a valid PlanDay shape (id, label, slots all present)', () => {
    const extra = makeExtra()
    const day = extraToPlanDay(extra)
    expect(typeof day.id).toBe('string')
    expect(typeof day.label).toBe('string')
    expect(Array.isArray(day.slots)).toBe(true)
  })
})

describe('getOffPlanLogs', () => {
  const plan = {
    id: 'p1', name: 'Old Plan', status: 'inactive', duration: { type: 'weeks', value: 4 }, startDate: '2026-01-01',
    startDayIndex: 0, createdAt: '', updatedAt: '',
    days: [{ id: 'd1', label: 'Lift Day', slots: [{ id: 's1', type: 'weights', name: 'Lift' }] }],
  } as Plan
  const base = { createdAt: '', calendarDate: '2026-02-01', action: 'complete' as const }

  it('returns completed logs from other plans, live or snapshotted, but not the active plan', () => {
    const entries: HistoryEntry[] = [
      { ...base, id: 'a', planId: 'p1', planDayIndex: 0 },
      { ...base, id: 'b', planId: 'gone', planDayIndex: 0, workout: { planName: 'Deleted', slots: [{ type: 'run', name: 'Run' }] } },
      { ...base, id: 'c', planId: 'active', planDayIndex: 0 },
      { ...base, id: 'd', planId: 'p1', planDayIndex: 0, action: 'skip' },
    ]
    const logs = getOffPlanLogs(entries, { p1: plan }, 'active', '2026-02-01')
    expect(logs.map(l => [l.entry.id, l.planName, l.planDay.slots[0].name])).toEqual([
      ['a', 'Old Plan', 'Lift'],
      ['b', 'Deleted', 'Run'],
    ])
  })
})
