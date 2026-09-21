import { describe, it, expect } from 'vitest'
import { findPreviousSetsByExercise, findPreviousWeightsOutcome } from '../previousSetsHelper'
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

  it('includes extra workout outcomes from a prior date (extra instanceId format)', () => {
    // Extra workout IDs: planId_YYYY-MM-DD_extra_extraId
    const extraOutcome: WorkoutOutcome = {
      workoutInstanceId: 'plan-1_2026-05-20_extra_abc123',
      completionState: 'completed',
      perceivedEffort: null,
      notes: null,
      completedAt: null,
      weightsActual: {
        exercises: [
          { exercise: 'Row', sets: [{ actualReps: 8, actualLoad: 95, completed: true }], progressionMode: null },
        ],
      },
    } as unknown as WorkoutOutcome
    const outcomes = { 'plan-1_2026-05-20_extra_abc123': extraOutcome }
    const result = findPreviousSetsByExercise('plan-1', TODAY, outcomes)
    expect(result['Row']).toHaveLength(1)
    expect(result['Row'][0].actualLoad).toBe(95)
  })

  it('excludes extra workout outcomes on the current date (same-day extra)', () => {
    // An extra workout on today's date should be excluded, not just regular workouts.
    const sameDay: WorkoutOutcome = {
      workoutInstanceId: `plan-1_${TODAY}_extra_xyz789`,
      completionState: 'completed',
      perceivedEffort: null,
      notes: null,
      completedAt: null,
      weightsActual: {
        exercises: [
          { exercise: 'Curl', sets: [{ actualReps: 10, actualLoad: 35, completed: true }], progressionMode: null },
        ],
      },
    } as unknown as WorkoutOutcome
    const outcomes = { [`plan-1_${TODAY}_extra_xyz789`]: sameDay }
    const result = findPreviousSetsByExercise('plan-1', TODAY, outcomes)
    expect(result).toEqual({})
  })

  it('excludes future-dated rotation outcomes (same class of bug as findPreviousSessionForPlanDay)', () => {
    // A bad CSV import can create outcomes with calendarDate > today.
    // Without the >= guard, the future outcome sorts first (newest wins) and
    // its sets would be returned as the "previous sets" to pre-fill.
    const outcomes = {
      'plan-1_2026-12-31': outcome('plan-1', '2026-12-31', [
        { exercise: 'Squat', sets: [{ actualReps: 5, actualLoad: 225, completed: true }] },
      ]),
      'plan-1_2026-06-01': outcome('plan-1', '2026-06-01', [
        { exercise: 'Squat', sets: [{ actualReps: 5, actualLoad: 135, completed: true }] },
      ]),
    }
    const result = findPreviousSetsByExercise('plan-1', TODAY, outcomes)
    // Should return the past session (Jun 1), not the future one (Dec 31)
    expect(result['Squat'][0].actualLoad).toBe(135)
  })

  it('excludes future-dated extra workout outcomes', () => {
    const futureExtra: WorkoutOutcome = {
      workoutInstanceId: 'plan-1_2026-12-31_extra_futureId',
      completionState: 'completed',
      perceivedEffort: null,
      notes: null,
      completedAt: null,
      weightsActual: {
        exercises: [
          { exercise: 'Press', sets: [{ actualReps: 5, actualLoad: 185, completed: true }], progressionMode: null },
        ],
      },
    } as unknown as WorkoutOutcome
    const outcomes = { 'plan-1_2026-12-31_extra_futureId': futureExtra }
    const result = findPreviousSetsByExercise('plan-1', TODAY, outcomes)
    expect(result).toEqual({})
  })
})

// ── findPreviousWeightsOutcome ────────────────────────────────────────────────

describe('findPreviousWeightsOutcome', () => {
  const TODAY = '2026-06-07'

  it('returns null when no outcomes exist', () => {
    expect(findPreviousWeightsOutcome('plan-1', TODAY, {})).toBeNull()
  })

  it('returns null when the only outcome is on the current date', () => {
    const outcomes = {
      [`plan-1_${TODAY}`]: outcome('plan-1', TODAY, [
        { exercise: 'Squat', sets: [{ actualReps: 5, actualLoad: 135, completed: true }] },
      ]),
    }
    expect(findPreviousWeightsOutcome('plan-1', TODAY, outcomes)).toBeNull()
  })

  it('returns the most recent prior outcome', () => {
    const earlier = outcome('plan-1', '2026-05-01', [
      { exercise: 'Squat', sets: [{ actualReps: 5, actualLoad: 135, completed: true }] },
    ], '2026-05-01T12:00:00Z')
    const later = outcome('plan-1', '2026-06-01', [
      { exercise: 'Squat', sets: [{ actualReps: 5, actualLoad: 155, completed: true }] },
    ], '2026-06-01T12:00:00Z')
    const outcomes = {
      'plan-1_2026-05-01': earlier,
      'plan-1_2026-06-01': later,
    }
    const result = findPreviousWeightsOutcome('plan-1', TODAY, outcomes)
    expect(result).toBe(later)
  })

  it('excludes future-dated outcomes (same class of bug as findPreviousSetsByExercise)', () => {
    // A future-dated outcome from a bad CSV import should never be returned as "previous".
    // Without the >= guard, outcomeSortKey on a future date would rank it highest.
    const futureOutcome = outcome('plan-1', '2026-12-31', [
      { exercise: 'Squat', sets: [{ actualReps: 5, actualLoad: 300, completed: true }] },
    ], '2026-12-31T12:00:00Z')
    const pastOutcome = outcome('plan-1', '2026-06-01', [
      { exercise: 'Squat', sets: [{ actualReps: 5, actualLoad: 135, completed: true }] },
    ], '2026-06-01T12:00:00Z')
    const outcomes = {
      'plan-1_2026-12-31': futureOutcome,
      'plan-1_2026-06-01': pastOutcome,
    }
    const result = findPreviousWeightsOutcome('plan-1', TODAY, outcomes)
    expect(result).toBe(pastOutcome)
  })

  it('returns null when only future-dated outcomes exist', () => {
    const futureOutcome = outcome('plan-1', '2026-12-31', [
      { exercise: 'Squat', sets: [{ actualReps: 5, actualLoad: 300, completed: true }] },
    ])
    const outcomes = { 'plan-1_2026-12-31': futureOutcome }
    expect(findPreviousWeightsOutcome('plan-1', TODAY, outcomes)).toBeNull()
  })

  it('does not return outcomes from a different plan', () => {
    const outcomes = {
      'plan-2_2026-06-01': outcome('plan-2', '2026-06-01', [
        { exercise: 'Bench Press', sets: [{ actualReps: 5, actualLoad: 135, completed: true }] },
      ]),
    }
    expect(findPreviousWeightsOutcome('plan-1', TODAY, outcomes)).toBeNull()
  })

  it('returns null when the only prior outcome has no weights data', () => {
    const noWeights: WorkoutOutcome = {
      workoutInstanceId: 'plan-1_2026-06-01',
      completionState: 'completed',
      perceivedEffort: null,
      notes: null,
      completedAt: null,
      runActual: { actualDistanceMiles: 3, actualDurationMin: 30, completedAsPlanned: true, averagePaceSecondsPerMile: null },
    } as unknown as WorkoutOutcome
    const outcomes = { 'plan-1_2026-06-01': noWeights }
    expect(findPreviousWeightsOutcome('plan-1', TODAY, outcomes)).toBeNull()
  })
})
