import { describe, it, expect } from 'vitest'
import { missedTargetReps, findNextSet, timedTargetSecs, type SetTrackState } from '../trackerHelpers'

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

  it('alternates warmups between members, then working sets', () => {
    const w = (n: number) => Array.from({ length: n }, (_, i) => i)
    // Simulate a whole superset: A has 2 warmups + 2 work sets, B has 2 + 2.
    const a = ex([set(false, true), set(false, true), set(false), set(false)], 'g')
    const b = ex([set(false, true), set(false, true), set(false), set(false)], 'g')
    const order: string[] = []
    for (const _ of w(8)) {
      const next = findNextSet([a, b])!
      const target = [a, b][next.exIdx].sets[next.setIdx]
      order.push(`${next.exIdx === 0 ? 'A' : 'B'}${target.isWarmup ? 'w' : ''}`)
      target.completed = true
    }
    expect(order).toEqual(['Aw', 'Bw', 'Aw', 'Bw', 'A', 'B', 'A', 'B'])
    expect(findNextSet([a, b])).toBeNull()
  })

  it('finishes remaining warmups before any working set, even if one member has more', () => {
    const a = ex([set(true, true), set(false, true), set(false, true), set(false)], 'g')
    const b = ex([set(true, true), set(false)], 'g')
    expect(findNextSet([a, b])).toEqual({ exIdx: 0, setIdx: 1 })
    const a2 = ex([set(true, true), set(true, true), set(false, true), set(false)], 'g')
    expect(findNextSet([a2, b])).toEqual({ exIdx: 0, setIdx: 2 })
  })

  it('a member without warmups waits for its partner\'s warmups', () => {
    const a = ex([set(false)], 'g')
    const b = ex([set(false, true), set(false)], 'g')
    expect(findNextSet([a, b])).toEqual({ exIdx: 1, setIdx: 0 })
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

describe('timedTargetSecs', () => {
  it('prefers the edited actual seconds, then the target', () => {
    expect(timedTargetSecs({ isTimed: true, actualReps: 50, targetReps: 45 })).toBe(50)
    expect(timedTargetSecs({ isTimed: true, actualReps: null, targetReps: 45 })).toBe(45)
  })

  it('is null for rep sets and missing or zero durations', () => {
    expect(timedTargetSecs({ isTimed: false, actualReps: 10, targetReps: 10 })).toBeNull()
    expect(timedTargetSecs({ isTimed: true, actualReps: null, targetReps: '30-45' })).toBeNull()
    expect(timedTargetSecs({ isTimed: true, actualReps: 0, targetReps: 45 })).toBeNull()
  })
})
