/**
 * Per-exercise progression: in a partial session, finished exercises still progress,
 * skipped ones hold, and weight only goes up at the top of the rep range.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

import { useOutcomeStore, makeWorkoutInstanceId } from '../outcomeStore'
import { useProgramStore } from '../programStore'
import type { WorkoutSlot } from '../../types'
import type { LoggedSetActual } from '../../modules/workout-outcomes/types'

const done = (reps: number): LoggedSetActual => ({ actualReps: reps, completed: true })

const slot: WorkoutSlot = {
  id: 's', type: 'weights', name: 'Strength A',
  exercises: [
    { exercise: 'Squat', sets: 2, reps: '6-8', load: 'squat', progress: { if: 'all_reps', then: 'squat += 5', else: 'squat = squat - 10' } },
    { exercise: 'Bench', sets: 2, reps: '8-10', load: 'bench', progress: { if: 'all_reps', then: 'bench += 5', else: 'bench = bench - 10' } },
    { exercise: 'Row', sets: 2, reps: '8-12', load: 'row', progress: { if: 'all_reps', then: 'row += 5', else: 'row = row - 10' } },
  ],
}

beforeEach(() => {
  useOutcomeStore.setState({ outcomes: {}, progressionStates: {} })
  useProgramStore.setState({ vars: { p: { squat: 155, bench: 85, row: 30 } } })
})

describe('per-exercise progression', () => {
  it('progresses hits, regresses misses, and holds skipped exercises in a partial session', () => {
    useOutcomeStore.getState().logOutcomeWithProgression({
      workoutInstanceId: makeWorkoutInstanceId('p', '2026-10-20'),
      completionState: 'partially_completed',
      weightsActual: {
        exercises: [
          { exercise: 'Squat', sets: [done(8), done(8)] },
          { exercise: 'Bench', sets: [done(10), done(9)] },
          { exercise: 'Row', sets: [{ actualReps: 12, completed: false }, { actualReps: 12, completed: false }] },
        ],
      },
    }, slot)
    expect(useProgramStore.getState().getVars('p')).toEqual({ squat: 160, bench: 75, row: 30 })
  })

  it('does not add weight below the top of the range even when the workout is completed', () => {
    useOutcomeStore.getState().logOutcomeWithProgression({
      workoutInstanceId: makeWorkoutInstanceId('p', '2026-10-21'),
      completionState: 'completed',
      weightsActual: { exercises: [{ exercise: 'Squat', sets: [done(7), done(7)] }] },
    }, { ...slot, exercises: [{ ...slot.exercises![0], progress: { if: 'all_reps', then: 'squat += 5' } }] })
    expect(useProgramStore.getState().getVars('p').squat).toBe(155)
  })
})
