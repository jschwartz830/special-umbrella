/**
 * Tests for reconcileCheckpoint — re-maps an in-progress mobility session's
 * checkpoint onto a routine that was edited (exercises added/removed/
 * reordered) mid-session, instead of discarding progress outright.
 */
import { describe, it, expect } from 'vitest'
import { reconcileCheckpoint } from '../MobilityTracker'
import type { MobilitySessionCheckpoint } from '../../../store/mobilityStore'

function cp(overrides: Partial<MobilitySessionCheckpoint> = {}): MobilitySessionCheckpoint {
  return {
    date: '2026-07-23',
    exerciseIds: ['a', 'b', 'c'],
    currentIdx: 1,
    completedIds: ['a'],
    totalElapsedSec: 90,
    exElapsedSec: 20,
    ...overrides,
  }
}

const ex = (id: string) => ({ id })

describe('reconcileCheckpoint', () => {
  it('keeps progress unchanged when the routine is untouched', () => {
    const result = reconcileCheckpoint(cp(), [ex('a'), ex('b'), ex('c')])
    expect(result).toEqual({
      currentIdx: 1,
      completedIds: ['a'],
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
    const withTwoDone = cp({ completedIds: ['a', 'b'], currentIdx: 2 })
    const result = reconcileCheckpoint(withTwoDone, [ex('a'), ex('c')]) // "b" removed
    expect(result.completedIds).toEqual(['a'])
  })

  it('advances past a removed current exercise to the next incomplete one', () => {
    // "b" (idx 1) was current and gets removed entirely
    const result = reconcileCheckpoint(cp(), [ex('a'), ex('c')])
    expect(result.currentIdx).toBe(1) // "c" — the next not-yet-completed exercise
    expect(result.exElapsedSec).toBe(0) // timer reset — it was for the removed exercise
    expect(result.totalElapsedSec).toBe(90) // total session time is preserved regardless
  })

  it('clamps to the last exercise when the current one is removed and everything else is done', () => {
    const allButCurrentDone = cp({ completedIds: ['a', 'c'], currentIdx: 1 })
    const result = reconcileCheckpoint(allButCurrentDone, [ex('a'), ex('c')]) // "b" removed
    expect(result.currentIdx).toBe(1) // last remaining index
    expect(result.exElapsedSec).toBe(0)
  })

  it('handles an empty routine without throwing', () => {
    const result = reconcileCheckpoint(cp(), [])
    expect(result.currentIdx).toBe(0)
    expect(result.completedIds).toEqual([])
  })
})
