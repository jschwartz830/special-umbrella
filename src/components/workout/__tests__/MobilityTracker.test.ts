/**
 * Tests for reconcileCheckpoint — re-maps an in-progress mobility session's
 * checkpoint onto a routine that was edited (exercises added/removed/
 * reordered) mid-session, instead of discarding progress outright.
 */
import { describe, it, expect } from 'vitest'
import { firstIncompleteSetIndex, reconcileCheckpoint } from '../MobilityTracker'
import type { MobilitySessionCheckpoint } from '../../../store/mobilityStore'
import type { MobilityRoutineExercise } from '../../../lib/mobilityLibrary'

function cp(overrides: Partial<MobilitySessionCheckpoint> = {}): MobilitySessionCheckpoint {
  return {
    date: '2026-07-23',
    exerciseIds: ['a', 'b', 'c'],
    currentIdx: 1,
    currentSetIdx: 0,
    completedIds: ['a'],
    completedSets: { a: [0] },
    totalElapsedSec: 90,
    exElapsedSec: 20,
    ...overrides,
  }
}

const ex = (id: string, setCount = 1): MobilityRoutineExercise => ({
  id,
  name: id,
  sets: Array.from({ length: setCount }, () => ({ durationSec: 30 })),
})

describe('reconcileCheckpoint', () => {
  it('keeps progress unchanged when the routine is untouched', () => {
    const result = reconcileCheckpoint(cp(), [ex('a'), ex('b'), ex('c')])
    expect(result).toEqual({
      currentIdx: 1,
      currentSetIdx: 0,
      completedIds: ['a'],
      completedSets: { a: [0] },
      totalElapsedSec: 90,
      exElapsedSec: 20,
    })
  })

  it('re-maps the current exercise index when a new exercise is inserted before it', () => {
    // "b" was current at idx 1; a new exercise "z" is added at the front
    const result = reconcileCheckpoint(cp(), [ex('z'), ex('a'), ex('b'), ex('c')])
    expect(result.currentIdx).toBe(2) // "b" is now at index 2
    expect(result.completedIds).toEqual(['a'])
    expect(result.exElapsedSec).toBe(20) // current exercise unchanged, timer preserved
  })

  it('drops completed ids for exercises that were removed', () => {
    const withTwoDone = cp({ completedIds: ['a', 'b'], completedSets: { a: [0], b: [0] }, currentIdx: 2 })
    const result = reconcileCheckpoint(withTwoDone, [ex('a'), ex('c')]) // "b" removed
    expect(result.completedIds).toEqual(['a'])
    expect(result.completedSets).toEqual({ a: [0] })
  })

  it('advances past a removed current exercise to the next incomplete one', () => {
    // "b" (idx 1) was current and gets removed entirely
    const result = reconcileCheckpoint(cp(), [ex('a'), ex('c')])
    expect(result.currentIdx).toBe(1) // "c" — the next not-yet-completed exercise
    expect(result.currentSetIdx).toBe(0)
    expect(result.exElapsedSec).toBe(0) // timer reset — it was for the removed exercise
    expect(result.totalElapsedSec).toBe(90) // total session time is preserved regardless
  })

  it('clamps to the last exercise when the current one is removed and everything else is done', () => {
    const allButCurrentDone = cp({ completedIds: ['a', 'c'], currentIdx: 1 })
    const result = reconcileCheckpoint(allButCurrentDone, [ex('a'), ex('c')]) // "b" removed
    expect(result.currentIdx).toBe(1) // last remaining index
    expect(result.exElapsedSec).toBe(0)
  })

  it('clamps the current set index when the live exercise has fewer sets than before', () => {
    const midSet = cp({ currentIdx: 1, currentSetIdx: 2 })
    const result = reconcileCheckpoint(midSet, [ex('a'), ex('b', 1), ex('c')]) // "b" now has only 1 set
    expect(result.currentIdx).toBe(1)
    expect(result.currentSetIdx).toBe(0)
  })

  it('drops completed set indices past the live exercise\'s set count', () => {
    const withSets = cp({ completedIds: [], completedSets: { b: [0, 1, 2] }, currentIdx: 1, currentSetIdx: 1 })
    const result = reconcileCheckpoint(withSets, [ex('a'), ex('b', 2), ex('c')])
    expect(result.completedSets.b).toEqual([0, 1])
  })

  it('handles an empty routine without throwing', () => {
    const result = reconcileCheckpoint(cp(), [])
    expect(result.currentIdx).toBe(0)
    expect(result.completedIds).toEqual([])
  })
})

describe('firstIncompleteSetIndex', () => {
  it('returns the first unfinished set when revisiting a partially completed exercise', () => {
    expect(firstIncompleteSetIndex(ex('a', 3), [0])).toBe(1)
    expect(firstIncompleteSetIndex(ex('a', 3), [0, 1])).toBe(2)
  })

  it('handles sets completed out of order', () => {
    expect(firstIncompleteSetIndex(ex('a', 3), [0, 2])).toBe(1)
  })

  it('falls back to the first set when no sets or all sets are complete', () => {
    expect(firstIncompleteSetIndex(ex('a', 3))).toBe(0)
    expect(firstIncompleteSetIndex(ex('a', 3), [0, 1, 2])).toBe(0)
  })
})
