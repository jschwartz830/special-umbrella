import { describe, it, expect } from 'vitest'
import { deriveProgressionMode } from '../progressionMode'

describe('deriveProgressionMode', () => {
  it('returns undefined when no progressionType and no progress rule', () => {
    expect(deriveProgressionMode(undefined, false)).toBeUndefined()
  })

  it('returns undefined when progressionType is empty string and no progress rule', () => {
    expect(deriveProgressionMode('', false)).toBeUndefined()
  })

  it('returns single when hasProgressRule is true and no progressionType', () => {
    expect(deriveProgressionMode(undefined, true)).toBe('single')
  })

  it('maps double → double', () => {
    expect(deriveProgressionMode('double', false)).toBe('double')
  })

  it('maps dynamic_double → double', () => {
    expect(deriveProgressionMode('dynamic_double', false)).toBe('double')
  })

  it('maps triple → volume', () => {
    expect(deriveProgressionMode('triple', false)).toBe('volume')
  })

  it('maps step_loading → maintenance', () => {
    expect(deriveProgressionMode('step_loading', false)).toBe('maintenance')
  })

  it('returns single for any unknown progressionType', () => {
    expect(deriveProgressionMode('some_future_type', false)).toBe('single')
  })

  it('returns single when progressionType is set and hasProgressRule is also true', () => {
    // progressionType takes precedence; hasProgressRule just prevents the undefined early-return
    expect(deriveProgressionMode('double', true)).toBe('double')
  })

  it('returns single when progressionType is empty string and hasProgressRule is true', () => {
    // Empty string is falsy so `!progressionType` is true, but `!hasProgressRule` is false,
    // so the undefined early-return does not fire. The explicit checks (double, triple,
    // step_loading) all fail for '', so the function falls through to return 'single'.
    expect(deriveProgressionMode('', true)).toBe('single')
  })
})
