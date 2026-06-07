import { describe, it, expect } from 'vitest'
import { findPreviousSetsByExercise } from '../previousSetsHelper'
import type { WorkoutOutcome } from '../../modules/workout-outcomes/types'

function outcome(
  planId: string,
  date: string,
  exercises: { exercise: string; sets: { actualReps?: number; actualLoad?: number; completed: boolean }[] }[],
  completedAt?: string,
): WorkoutOutcome {
  return {
    workoutInstanceId: `${planId}_${date}`,
    completionState: 'completed',
    perceivedEffort: null,
    notes: null,
    completedAt: completedAt ?? null,
    weightsActual: { exercises: exercises.map(ex => ({ ...ex, progressionMode: null })) },
  } as unknown as WorkoutOutcome
}

describe('findPreviousSetsByExercise', () => {
  const TODAY = '2026-06-07'

  it('returns empty map when no outcomes exist', () => {
    const result = findPreviousSetsByExercise('plan-1', TODAY, {})
    expect(result).toEqual({})
  })

  it('returns empty map when all outcomes are on the current date', () => {
    const outcomes = {
      'plan-1_2026-06-07': outcome('plan-1', TODAY, [
        { exercise: 'Squat', sets: [{ actualReps: 5, actualLoad: 135, completed: true }] },
      ]),
    }
    const result = findPreviousSetsByExercise('plan-1', TODAY, outcomes)
    expect(result).toEqual({})
  })

  it('returns sets from a previous date', () => {
    const outcomes = {
      'plan-1_2026-06-01': outcome('plan-1', '2026-06-01', [
        { exercise: 'Squat', sets: [{ actualReps: 5, actualLoad: 135, completed: true }] },
      ]),
    }
    const result = findPreviousSetsByExercise('plan-1', TODAY, outcomes)
    expect(result['Squat']).toHaveLength(1)
    expect(result['Squat'][0].actualLoad).toBe(135)
  })

  it('picks the most-recent prior session when multiple exist for the same exercise', () => {
    const outcomes = {
      'plan-1_2026-05-01': outcome('plan-1', '2026-05-01', [
        { exercise: 'Bench Press', sets: [{ actualReps: 5, actualLoad: 135, completed: true }] },
      ], '2026-05-01T12:00:00Z'),
      'plan-1_2026-06-01': outcome('plan-1', '2026-06-01', [
        { exercise: 'Bench Press', sets: [{ actualReps: 5, actualLoad: 155, completed: true }] },
      ], '2026-06-01T12:00:00Z'),
    }
    const result = findPreviousSetsByExercise('plan-1', TODAY, outcomes)
    // The June session should win (more recent)
    expect(result['Bench Press'][0].actualLoad).toBe(155)
  })

  it('excludes a specific instanceId when excludeInstanceId is provided', () => {
    const outcomes = {
      'plan-1_2026-06-01': outcome('plan-1', '2026-06-01', [
        { exercise: 'Deadlift', sets: [{ actualReps: 3, actualLoad: 315, completed: true }] },
      ]),
      'plan-1_2026-05-01': outcome('plan-1', '2026-05-01', [
        { exercise: 'Deadlift', sets: [{ actualReps: 3, actualLoad: 295, completed: true }] },
      ]),
    }
    // Exclude the June outcome — should fall back to May
    const result = findPreviousSetsByExercise('plan-1', '2026-06-07', outcomes, 'plan-1_2026-06-01')
    expect(result['Deadlift'][0].actualLoad).toBe(295)
  })

  it('does not include outcomes from a different plan', () => {
    const outcomes = {
      'plan-2_2026-06-01': outcome('plan-2', '2026-06-01', [
        { exercise: 'Squat', sets: [{ actualReps: 5, actualLoad: 225, completed: true }] },
      ]),
    }
    const result = findPreviousSetsByExercise('plan-1', TODAY, outcomes)
    expect(result).toEqual({})
  })
})
