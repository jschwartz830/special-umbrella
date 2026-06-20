import { describe, it, expect } from 'vitest'
import { extraToPlanDay } from '../planDayUtils'
import type { ExtraWorkoutEntry } from '../../types'

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
