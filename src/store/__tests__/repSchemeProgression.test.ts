/**
 * Reps → sets progression: a session where every set hits its step advances one
 * step, a miss repeats it, and deload weeks don't move it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

import { useOutcomeStore, makeWorkoutInstanceId } from '../outcomeStore'
import { useProgramStore } from '../programStore'
import { ladderKey } from '../../modules/rep-ladder/ladder'
import type { WorkoutSlot } from '../../types'
import type { ExerciseSpec } from '../../types/program'
import type { LoggedSetActual } from '../../modules/workout-outcomes/types'

const nordic: ExerciseSpec = { exercise: 'Nordic', sets: 2, reps: '3-5', progressionType: 'rep_sets' }
const slotWith = (ex: ExerciseSpec): WorkoutSlot => ({ id: 's', type: 'weights', name: 'B', exercises: [ex] })
const key = ladderKey('p', 'Nordic')

function log(date: string, reps: number[], ex: ExerciseSpec = nordic) {
  const sets: LoggedSetActual[] = reps.map(r => ({ actualReps: r, completed: true }))
  useOutcomeStore.getState().logOutcomeWithProgression({
    workoutInstanceId: makeWorkoutInstanceId('p', date),
    completionState: 'completed',
    weightsActual: { exercises: [{ exercise: 'Nordic', sets }] },
  }, slotWith(ex))
}
const hits = () => useOutcomeStore.getState().ladderStates[key]?.hits.length ?? 0

beforeEach(() => {
  useOutcomeStore.setState({ outcomes: {}, progressionStates: {}, ladderStates: {} })
  useProgramStore.setState({ vars: {} })
})

describe('rep-scheme progression', () => {
  it('advances on a hit and repeats on a miss', () => {
    log('2026-10-20', [3, 3])
    expect(hits()).toBe(1)
    log('2026-10-22', [4, 3])
    expect(hits()).toBe(1)
    log('2026-10-24', [4, 4])
    expect(hits()).toBe(2)
  })

  it('does not move during a deload week', () => {
    log('2026-10-20', [3], { ...nordic, deloadSets: 1 })
    expect(hits()).toBe(0)
  })
})
