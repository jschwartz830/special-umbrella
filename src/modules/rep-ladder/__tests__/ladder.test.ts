import { describe, it, expect } from 'vitest'
import { ladderReps, ladderStep, applyLadder, withLadderTargets, recordLadderResult, ladderKey } from '../ladder'
import type { WorkoutSlot } from '../../../types'

describe('ladderReps', () => {
  it('starts as a descending ladder from the max', () => {
    expect(ladderReps(5, 0)).toEqual([5, 4, 3, 2, 1])
  })

  it('adds one rep to the next set each step, cycling through the sets', () => {
    expect(ladderReps(5, 1)).toEqual([6, 4, 3, 2, 1])
    expect(ladderReps(5, 2)).toEqual([6, 5, 3, 2, 1])
    expect(ladderReps(5, 5)).toEqual([6, 5, 4, 3, 2])
    expect(ladderReps(5, 6)).toEqual([7, 5, 4, 3, 2])
  })

  it('caps the ladder at five sets and shortens it for small maxes', () => {
    expect(ladderReps(8, 0)).toEqual([8, 7, 6, 5, 4])
    expect(ladderReps(3, 0)).toEqual([3, 2, 1])
    expect(ladderReps(3, 4)).toEqual([5, 3, 2])
  })
})

describe('ladder state', () => {
  it('counts hits for the current max only, ignoring the session being re-logged', () => {
    const state = { max: 5, hits: ['a', 'b', 'c'] }
    expect(ladderStep(state, 5)).toBe(3)
    expect(ladderStep(state, 5, 'b')).toBe(2)
    expect(ladderStep(state, 6)).toBe(0)
    expect(ladderStep(undefined, 5)).toBe(0)
  })

  it('a hit advances, a miss on the same session un-counts it, and a new max resets', () => {
    let st = recordLadderResult(undefined, 5, 'a', true)
    st = recordLadderResult(st, 5, 'b', true)
    expect(st.hits).toEqual(['a', 'b'])
    st = recordLadderResult(st, 5, 'b', false)
    expect(st.hits).toEqual(['a'])
    st = recordLadderResult(st, 7, 'c', true)
    expect(st).toEqual({ max: 7, hits: ['c'] })
  })
})

describe('applyLadder / withLadderTargets', () => {
  it('replaces sets with the current rung and reports progress', () => {
    const ex = applyLadder({ exercise: 'Pull-ups', sets: 3, reps: '8', progressionType: 'rep_ladder', ladderMax: 5 }, 2)
    expect(ex.sets).toEqual([{ reps: 6 }, { reps: 5 }, { reps: 3 }, { reps: 2 }, { reps: 1 }])
    expect(ex.reps).toBeUndefined()
    expect(ex.ladderStatus).toBe('Ladder session 3/24 · max 5')
  })

  it('holds the final rung once the cycle is done and prompts a retest', () => {
    const ex = applyLadder({ exercise: 'Pull-ups', progressionType: 'rep_ladder', ladderMax: 5, ladderSessions: 3 }, 5)
    expect(ex.sets).toEqual(ladderReps(5, 2).map(reps => ({ reps })))
    expect(ex.ladderStatus).toMatch(/test your max/)
  })

  it('leaves slots without a configured ladder untouched', () => {
    const slot: WorkoutSlot = {
      id: 's', type: 'weights', name: 'A',
      exercises: [{ exercise: 'Pull-ups', progressionType: 'rep_ladder' }, { exercise: 'Squat', sets: 3, reps: 5 }],
    }
    expect(withLadderTargets(slot, 'p', {})).toBe(slot)
  })

  it('only rewrites ladder exercises, using the plan + exercise progress', () => {
    const slot: WorkoutSlot = {
      id: 's', type: 'weights', name: 'A',
      exercises: [
        { exercise: 'Pull-ups', progressionType: 'rep_ladder', ladderMax: 4 },
        { exercise: 'Squat', sets: 3, reps: 5 },
      ],
    }
    const out = withLadderTargets(slot, 'p', { [ladderKey('p', 'pull-ups')]: { max: 4, hits: ['x'] } })
    expect(out.exercises![0].sets).toEqual([{ reps: 5 }, { reps: 3 }, { reps: 2 }, { reps: 1 }])
    expect(out.exercises![1]).toBe(slot.exercises![1])
  })
})
