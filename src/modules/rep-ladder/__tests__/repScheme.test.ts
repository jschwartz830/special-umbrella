import { describe, it, expect } from 'vitest'
import { parseRepScheme, defaultRepScheme, repSchemeSteps, applyRepScheme, formatStep } from '../repScheme'
import { withLadderTargets, ladderKey } from '../ladder'
import { repSchemeSignature } from '../repScheme'
import type { WorkoutSlot } from '../../../types'

describe('parseRepScheme', () => {
  it('reads NxR, slash and repeated-digit steps', () => {
    expect(parseRepScheme('3x4, 4×6, 10/10/8, 444, 6666')).toEqual([
      [4, 4, 4], [6, 6, 6, 6], [10, 10, 8], [4, 4, 4], [6, 6, 6, 6],
    ])
  })

  it('rejects unreadable steps', () => {
    expect(parseRepScheme('3x4, banana')).toBeNull()
    expect(parseRepScheme('')).toBeNull()
    expect(parseRepScheme('0x5')).toBeNull()
  })
})

describe('defaultRepScheme', () => {
  it('walks the rep range at the set count, then with one more set', () => {
    expect(defaultRepScheme({ sets: 2, reps: '3-5' }).map(formatStep))
      .toEqual(['2×3', '2×4', '2×5', '3×3', '3×4', '3×5'])
  })

  it('progresses sets only for a fixed rep target', () => {
    expect(defaultRepScheme({ sets: 2, reps: 8 }).map(formatStep)).toEqual(['2×8', '3×8'])
  })

  it('falls back to the default when a custom scheme is unreadable', () => {
    expect(repSchemeSteps({ exercise: 'X', sets: 2, reps: '3-4', progressionType: 'rep_sets', repScheme: 'nope' }).map(formatStep))
      .toEqual(['2×3', '2×4', '3×3', '3×4'])
  })
})

describe('applyRepScheme', () => {
  const ex = { exercise: 'Nordic', sets: 2, reps: '3-5', progressionType: 'rep_sets' as const }

  it('sets today\'s step and shows what\'s next', () => {
    const out = applyRepScheme(ex, 2)
    expect(out.sets).toEqual([{ reps: 5 }, { reps: 5 }])
    expect(out.reps).toBeUndefined()
    expect(out.ladderStatus).toBe('Step 3/6 · next 3×3')
  })

  it('restarts after the last step with a make-it-harder prompt', () => {
    const out = applyRepScheme(ex, 6)
    expect(out.sets).toEqual([{ reps: 3 }, { reps: 3 }])
    expect(out.ladderStatus).toMatch(/make it harder/)
  })

  it('caps sets in a deload week', () => {
    const out = applyRepScheme(ex, 4, 1)
    expect(out.sets).toEqual([{ reps: 4 }])
    expect(out.ladderStatus).toMatch(/deload/)
  })
})

describe('withLadderTargets for rep schemes', () => {
  it('uses stored hits for the current scheme only', () => {
    const ex = { exercise: 'Nordic', sets: 2, reps: '3-5', progressionType: 'rep_sets' as const }
    const slot: WorkoutSlot = { id: 's', type: 'weights', name: 'B', exercises: [ex] }
    const sig = repSchemeSignature(repSchemeSteps(ex))
    const states = { [ladderKey('p', 'Nordic')]: { max: sig, hits: ['a', 'b'] } }
    expect(withLadderTargets(slot, 'p', states).exercises![0].sets).toEqual([{ reps: 5 }, { reps: 5 }])
    // Editing the scheme starts over.
    const edited = { ...slot, exercises: [{ ...ex, repScheme: '2x4, 2x6' }] }
    expect(withLadderTargets(edited, 'p', states).exercises![0].sets).toEqual([{ reps: 4 }, { reps: 4 }])
  })
})
