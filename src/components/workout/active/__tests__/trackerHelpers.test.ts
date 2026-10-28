import { describe, it, expect } from 'vitest'
import { missedTargetReps, findNextSet, type SetTrackState } from '../trackerHelpers'

describe('missedTargetReps', () => {
  it('flags a numeric target that was not reached', () => {
    expect(missedTargetReps({ actualReps: 4, targetReps: 5 })).toBe(true)
    expect(missedTargetReps({ actualReps: 5, targetReps: 5 })).toBe(false)
    expect(missedTargetReps({ actualReps: 6, targetReps: 5 })).toBe(false)
  })

  it('uses the bottom of a rep range', () => {
    expect(missedTargetReps({ actualReps: 7, targetReps: '8-12' })).toBe(true)
    expect(missedTargetReps({ actualReps: 8, targetReps: '8-12' })).toBe(false)
  })

  it('parses a numeric string target', () => {
    expect(missedTargetReps({ actualReps: 9, targetReps: '10' })).toBe(true)
  })

  it('ignores warmups, timed sets, unlogged reps, and non-numeric targets', () => {
    expect(missedTargetReps({ actualReps: 1, targetReps: 5, isWarmup: true })).toBe(false)
    expect(missedTargetReps({ actualReps: 20, targetReps: 30, isTimed: true })).toBe(false)
    expect(missedTargetReps({ actualReps: null, targetReps: 5 })).toBe(false)
    expect(missedTargetReps({ actualReps: 3, targetReps: 'AMRAP' })).toBe(false)
    expect(missedTargetReps({ actualReps: 3, targetReps: null })).toBe(false)
  })
})

describe('findNextSet', () => {
  const set = (completed: boolean, isWarmup = false) => ({ completed, isWarmup } as SetTrackState)
  const ex = (sets: SetTrackState[], supersetGroupId?: string) => ({ sets, supersetGroupId })

  it('walks exercises in order without supersets', () => {
    expect(findNextSet([ex([set(true), set(false)]), ex([set(false)])])).toEqual({ exIdx: 0, setIdx: 1 })
  })

  it('alternates between superset members', () => {
    const a = ex([set(true), set(false), set(false)], 'g')
    const b = ex([set(false), set(false), set(false)], 'g')
    expect(findNextSet([a, b])).toEqual({ exIdx: 1, setIdx: 0 })
    const b1 = ex([set(true), set(false), set(false)], 'g')
    expect(findNextSet([a, b1])).toEqual({ exIdx: 0, setIdx: 1 })
  })

  it('runs a member\'s warmups before handing off, and partner warmups before its first work set', () => {
    const a = ex([set(true, true), set(false, true), set(false)], 'g')
    const b = ex([set(false, true), set(false)], 'g')
    expect(findNextSet([a, b])).toEqual({ exIdx: 0, setIdx: 1 })
    const aDone1 = ex([set(true, true), set(true, true), set(true), set(false)], 'g')
    expect(findNextSet([aDone1, b])).toEqual({ exIdx: 1, setIdx: 0 })
  })

  it('finishes the remaining member when the partner is done', () => {
    const a = ex([set(true), set(false), set(false)], 'g')
    const b = ex([set(true)], 'g')
    expect(findNextSet([a, b])).toEqual({ exIdx: 0, setIdx: 1 })
  })

  it('rotates within the group even when one member is manually focused', () => {
    const a = ex([set(true), set(false)], 'g')
    const b = ex([set(false), set(false)], 'g')
    expect(findNextSet([ex([set(false)]), a, b], 1)).toEqual({ exIdx: 2, setIdx: 0 })
  })

  it('keeps a manual focus outside any superset', () => {
    expect(findNextSet([ex([set(false)]), ex([set(true), set(false)])], 1)).toEqual({ exIdx: 1, setIdx: 1 })
  })
})
