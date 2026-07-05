/**
 * Tests for isBilateralExercise — the helper that decides whether a routine
 * exercise should get a "switch sides" cue at its halfway point.
 */
import { describe, it, expect } from 'vitest'
import { isBilateralExercise, MOBILITY_LIBRARY } from '../mobilityLibrary'

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
