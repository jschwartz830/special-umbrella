/**
 * Tests for isBilateralExercise — the helper that decides whether a routine
 * exercise should get a "switch sides" cue at its halfway point.
 */
import { describe, it, expect } from 'vitest'
import {
  isBilateralExercise,
  MOBILITY_LIBRARY,
  normalizeMobilityRoutine,
  summarizeMobilitySets,
  totalTimedSec,
} from '../mobilityLibrary'

describe('isBilateralExercise', () => {
  it('returns true for a library exercise flagged bilateral (by id)', () => {
    expect(isBilateralExercise({ id: 'lib-hip-9090', name: 'Hip 90/90' })).toBe(true)
  })

  it('returns false for a library exercise that is not bilateral (by id)', () => {
    expect(isBilateralExercise({ id: 'lib-cat-cow', name: 'Cat-Cow' })).toBe(false)
  })

  it('falls back to a name match when the id is not a library id', () => {
    // Default routine uses non-library ids but library-matching names.
    expect(isBilateralExercise({ id: 'hip-90-90', name: 'Hip 90/90' })).toBe(true)
    expect(isBilateralExercise({ id: 'worlds-greatest', name: "World's Greatest Stretch" })).toBe(true)
    expect(isBilateralExercise({ id: 'pigeon-pose', name: 'Pigeon Pose' })).toBe(true)
  })

  it('name match is case-insensitive and trims surrounding whitespace', () => {
    expect(isBilateralExercise({ id: 'x', name: '  hip 90/90  ' })).toBe(true)
  })

  it('returns false for a non-bilateral exercise matched by name', () => {
    expect(isBilateralExercise({ id: 'cat-cow', name: 'Cat-Cow' })).toBe(false)
  })

  it('returns false for a fully unknown exercise', () => {
    expect(isBilateralExercise({ id: 'custom-123', name: 'Dead Hang' })).toBe(false)
  })

  it('the library exposes at least one bilateral exercise', () => {
    expect(MOBILITY_LIBRARY.some(e => e.bilateral === true)).toBe(true)
  })
})

// Regression coverage: production data (e.g. localStorage written before the
// sets-based routine model shipped, or a mid-deploy cache skew) can hand these
// helpers a `sets` field that's undefined rather than an array. They must
// degrade gracefully instead of throwing "undefined is not an object
// (evaluating '...reduce')" and crashing the whole page.
describe('totalTimedSec — malformed input', () => {
  it('returns 0 for undefined sets', () => {
    expect(totalTimedSec(undefined)).toBe(0)
  })

  it('returns 0 for null sets', () => {
    expect(totalTimedSec(null)).toBe(0)
  })

  it('sums durationSec across valid sets as before', () => {
    expect(totalTimedSec([{ durationSec: 30 }, { durationSec: 15 }])).toBe(45)
  })
})

describe('summarizeMobilitySets — malformed input', () => {
  it('returns an empty string for undefined sets', () => {
    expect(summarizeMobilitySets(undefined)).toBe('')
  })

  it('returns an empty string for null sets', () => {
    expect(summarizeMobilitySets(null)).toBe('')
  })
})

describe('normalizeMobilityRoutine', () => {
  it('returns an empty array for a non-array routine', () => {
    expect(normalizeMobilityRoutine(undefined)).toEqual([])
    expect(normalizeMobilityRoutine(null)).toEqual([])
  })

  it('leaves an already-valid routine item unchanged', () => {
    const routine = [{ id: 'a', name: 'A', sets: [{ durationSec: 30 }] }]
    expect(normalizeMobilityRoutine(routine)).toEqual(routine)
  })

  it('backfills a single timed set for a legacy item with durationSec but no sets', () => {
    const legacy = [{ id: 'a', name: 'A', durationSec: 45 }] as unknown as Parameters<typeof normalizeMobilityRoutine>[0]
    const result = normalizeMobilityRoutine(legacy)
    expect(result[0].sets).toEqual([{ durationSec: 45 }])
  })

  it('falls back to a 30s set for an item with neither sets nor durationSec', () => {
    const broken = [{ id: 'a', name: 'A' }] as unknown as Parameters<typeof normalizeMobilityRoutine>[0]
    const result = normalizeMobilityRoutine(broken)
    expect(result[0].sets).toEqual([{ durationSec: 30 }])
  })
})
