import { describe, it, expect } from 'vitest'
import { missedTargetReps } from '../trackerHelpers'

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
