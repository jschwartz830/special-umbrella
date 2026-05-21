import { describe, it, expect } from 'vitest'
import { parseWorkoutInstanceId } from '../workoutInstanceId'

describe('parseWorkoutInstanceId', () => {
  it('parses a standard instanceId (planId without underscores)', () => {
    const result = parseWorkoutInstanceId('abc123_2026-05-21')
    expect(result).toEqual({ planId: 'abc123', calendarDate: '2026-05-21' })
  })

  it('parses an instanceId where planId contains underscores', () => {
    // nanoid default alphabet includes '_', so planIds can contain it
    const result = parseWorkoutInstanceId('abc_def_gh_2026-05-21')
    expect(result).toEqual({ planId: 'abc_def_gh', calendarDate: '2026-05-21' })
  })

  it('parses an extra workout instanceId (planId_date_extra_extraId)', () => {
    const result = parseWorkoutInstanceId('plan123_2026-05-21_extra_xyz456')
    expect(result).toEqual({ planId: 'plan123', calendarDate: '2026-05-21' })
  })

  it('parses an extra instanceId where planId contains underscores', () => {
    const result = parseWorkoutInstanceId('pl_an_id_2026-01-15_extra_ex_id')
    expect(result).toEqual({ planId: 'pl_an_id', calendarDate: '2026-01-15' })
  })

  it('returns null for a string without a YYYY-MM-DD date', () => {
    expect(parseWorkoutInstanceId('nodateinhere')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(parseWorkoutInstanceId('')).toBeNull()
  })

  it('returns null when date is present but no leading underscore separator exists', () => {
    // "2026-05-21" at position 0 has sep = -1
    expect(parseWorkoutInstanceId('2026-05-21')).toBeNull()
  })

  it('returns the FIRST date when multiple date-like substrings exist', () => {
    // Unusual but shouldn't crash — returns earliest match
    const result = parseWorkoutInstanceId('planABC_2026-01-01_extra_2026-02-02')
    expect(result).toEqual({ planId: 'planABC', calendarDate: '2026-01-01' })
  })

  it('works with a real nanoid-style planId (21 chars, may include hyphen)', () => {
    const planId = 'V1StGXR8_Z5jdHi6B-myT'
    const instanceId = `${planId}_2026-03-10`
    const result = parseWorkoutInstanceId(instanceId)
    expect(result).toEqual({ planId, calendarDate: '2026-03-10' })
  })
})
