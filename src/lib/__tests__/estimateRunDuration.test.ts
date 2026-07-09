import { describe, it, expect } from 'vitest'
import { estimateRunDurationMin } from '../estimateRunDuration'

// Helpers to build minimal slot shapes
function withTargetDurationMin(targetDurationMin: number) {
  return { runConfig: { targetDurationMin, targetDistanceMiles: null } }
}

function withTargetDistanceMiles(miles: number) {
  return { runConfig: { targetDurationMin: null, targetDistanceMiles: miles } }
}

function withSegmentDuration(duration: string) {
  return { segments: [{ duration }] }
}

function withSegmentDistance(distance: string, type?: string) {
  return { segments: [{ distance, type }] }
}

describe('estimateRunDurationMin', () => {
  // ── Resolution order ────────────────────────────────────────────────────────

  it('returns slot.durationMin when set (highest priority)', () => {
    const slot = { durationMin: 45, runConfig: { targetDurationMin: 30 }, segments: [] }
    expect(estimateRunDurationMin(slot)).toBe(45)
  })

  it('returns runConfig.targetDurationMin when durationMin is absent', () => {
    expect(estimateRunDurationMin(withTargetDurationMin(35))).toBe(35)
  })

  it('returns 20 (default) when slot has no duration info at all', () => {
    expect(estimateRunDurationMin({})).toBe(20)
  })

  // ── Segment duration parsing ─────────────────────────────────────────────────

  it('parses a segment with integer minutes (e.g. "30min")', () => {
    expect(estimateRunDurationMin(withSegmentDuration('30min'))).toBe(30)
  })

  it('parses a segment with abbreviated "m" unit (e.g. "20m")', () => {
    expect(estimateRunDurationMin(withSegmentDuration('20m'))).toBe(20)
  })

  it('parses a segment with decimal minutes (e.g. "22.5min")', () => {
    expect(estimateRunDurationMin(withSegmentDuration('22.5min'))).toBe(23) // ceil(22.5)
  })

  it('sums multiple segment durations', () => {
    const slot = { segments: [{ duration: '10min' }, { duration: '20min' }, { duration: '5min' }] }
    expect(estimateRunDurationMin(slot)).toBe(35)
  })

  it('ignores segment duration with unknown unit (no match)', () => {
    // "30km" does not match /^(\d+(?:\.\d+)?)\s*m(?:in)?$/ — no duration extracted
    expect(estimateRunDurationMin(withSegmentDuration('30km'))).toBe(20)
  })

  // ── Segment distance → estimated duration ───────────────────────────────────

  it('estimates duration from segment distance using default 11 min/mi pace', () => {
    // 3 miles × 11 min/mi = 33 → ceil(33) = 33
    expect(estimateRunDurationMin(withSegmentDistance('3'))).toBe(33)
  })

  it('uses 8 min/mi for tempo segments', () => {
    // 2 miles × 8 min/mi = 16 → ceil(16) = 16
    expect(estimateRunDurationMin(withSegmentDistance('2', 'tempo'))).toBe(16)
  })

  it('uses 12 min/mi for warmup segments', () => {
    // 1.5 miles × 12 min/mi = 18 → ceil(18) = 18
    expect(estimateRunDurationMin(withSegmentDistance('1.5', 'warmup'))).toBe(18)
  })

  it('uses 12 min/mi for cooldown segments', () => {
    // 1 mile × 12 min/mi = 12 → ceil(12) = 12
    expect(estimateRunDurationMin(withSegmentDistance('1', 'cooldown'))).toBe(12)
  })

  it('skips a distance segment whose value is not parseable', () => {
    // "UNKNOWN_VAR" stays as-is after substitution → parseFloat → NaN → skipped
    const slot = {
      segments: [{ distance: 'UNKNOWN_VAR' }],
      runConfig: { targetDurationMin: null, targetDistanceMiles: null },
    }
    expect(estimateRunDurationMin(slot)).toBe(20)
  })

  it('sums multiple mixed segments (duration + distance)', () => {
    // duration segment: 10min + distance segment: 2mi × 11 min/mi = 22 → total 32 → ceil(32) = 32
    const slot = {
      segments: [{ duration: '10min' }, { distance: '2', type: 'easy' }],
    }
    expect(estimateRunDurationMin(slot)).toBe(32)
  })

  // ── programVars substitution ──────────────────────────────────────────────────

  it('substitutes programVar references in segment distance', () => {
    // BASE_MILES = 3 → 3 × 11 = 33
    const slot = { segments: [{ distance: 'BASE_MILES' }] }
    expect(estimateRunDurationMin(slot, { BASE_MILES: 3 })).toBe(33)
  })

  it('substitutes programVar reference when var value is a string', () => {
    // "3" → parseFloat("3") = 3 → 3 × 11 = 33
    const slot = { segments: [{ distance: 'DIST' }] }
    expect(estimateRunDurationMin(slot, { DIST: '3' })).toBe(33)
  })

  it('leaves unknown variables unsubstituted (segment is skipped)', () => {
    const slot = { segments: [{ distance: 'NO_SUCH_VAR' }] }
    expect(estimateRunDurationMin(slot, {})).toBe(20)
  })

  // ── targetDistanceMiles fallback ─────────────────────────────────────────────

  it('derives duration from targetDistanceMiles at 11 min/mi when segments produce nothing', () => {
    // 5 miles × 11 min/mi = 55 → ceil(55) = 55
    expect(estimateRunDurationMin(withTargetDistanceMiles(5))).toBe(55)
  })

  it('ceils a fractional targetDistanceMiles result', () => {
    // 1.5 miles × 11 = 16.5 → ceil = 17
    expect(estimateRunDurationMin(withTargetDistanceMiles(1.5))).toBe(17)
  })

  // ── Edge cases ───────────────────────────────────────────────────────────────

  it('returns 20 when segments array is empty', () => {
    expect(estimateRunDurationMin({ segments: [] })).toBe(20)
  })

  it('returns 20 when runConfig is null', () => {
    expect(estimateRunDurationMin({ runConfig: null })).toBe(20)
  })

  it('handles default programVars (empty) when omitted', () => {
    // Variable reference stays unresolved → distance segment skipped → default 20
    expect(estimateRunDurationMin({ segments: [{ distance: 'MILES' }] })).toBe(20)
  })
})
