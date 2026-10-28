/**
 * Rep-ladder progression: completed sessions advance the ladder one step,
 * misses repeat it, and re-logging or undoing a session doesn't double count.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

import { useOutcomeStore, makeWorkoutInstanceId } from '../outcomeStore'
import { useProgramStore } from '../programStore'
import { ladderKey, ladderReps } from '../../modules/rep-ladder/ladder'
import type { WorkoutSlot } from '../../types'
import type { LoggedSetActual } from '../../modules/workout-outcomes/types'

const slot: WorkoutSlot = {
  id: 's', type: 'weights', name: 'Strength A',
  exercises: [{ exercise: 'Pull-ups', progressionType: 'rep_ladder', ladderMax: 5 }],
}
const key = ladderKey('p', 'Pull-ups')

function log(date: string, reps: number[], completed = true) {
  const sets: LoggedSetActual[] = reps.map(r => ({ actualReps: r, completed }))
  useOutcomeStore.getState().logOutcomeWithProgression({
    workoutInstanceId: makeWorkoutInstanceId('p', date),
    completionState: 'completed',
    weightsActual: { exercises: [{ exercise: 'Pull-ups', sets }] },
  }, slot)
}
const hits = () => useOutcomeStore.getState().ladderStates[key]?.hits.length ?? 0

beforeEach(() => {
  useOutcomeStore.setState({ outcomes: {}, progressionStates: {}, ladderStates: {} })
  // A plan with no program vars still progresses its ladders.
  useProgramStore.setState({ vars: {} })
})

describe('rep-ladder progression', () => {
  it('advances on a fully completed rung and repeats on a miss', () => {
    log('2026-10-20', ladderReps(5, 0))
    expect(hits()).toBe(1)
    log('2026-10-22', [6, 4, 3, 2, 0])
    expect(hits()).toBe(1)
    log('2026-10-24', ladderReps(5, 1))
    expect(hits()).toBe(2)
  })

  it('ignores unfinished sessions', () => {
    log('2026-10-20', ladderReps(5, 0), false)
    expect(hits()).toBe(0)
  })

  it('re-logging the same session does not double count, and undoing it rolls back', () => {
    log('2026-10-20', ladderReps(5, 0))
    log('2026-10-20', ladderReps(5, 0))
    expect(hits()).toBe(1)
    useOutcomeStore.getState().removeOutcome(makeWorkoutInstanceId('p', '2026-10-20'))
    expect(hits()).toBe(0)
  })

  it('clears a plan\'s ladders when the plan is deleted', () => {
    log('2026-10-20', ladderReps(5, 0))
    useOutcomeStore.getState().clearPlanLadders('p')
    expect(useOutcomeStore.getState().ladderStates).toEqual({})
  })
})
