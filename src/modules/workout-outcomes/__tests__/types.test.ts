import { describe, it, expect } from 'vitest'
import {
  completionStateToAction,
  derivePaceSecondsPerMile,
  deriveSwimPaceSecondsPer100m,
  formatPace,
  formatSwimPace,
} from '../types'

// ── completionStateToAction ───────────────────────────────────────────────────

describe('completionStateToAction', () => {
  it('maps completed → complete', () => {
    expect(completionStateToAction('completed')).toBe('complete')
  })

  it('maps partially_completed → complete', () => {
    expect(completionStateToAction('partially_completed')).toBe('complete')
  })

  it('maps swapped → complete', () => {
    expect(completionStateToAction('swapped')).toBe('complete')
  })

  it('maps skipped → skip', () => {
    expect(completionStateToAction('skipped')).toBe('skip')
  })

  it('maps deferred → day_off', () => {
    expect(completionStateToAction('deferred')).toBe('day_off')
  })

  it('maps planned → complete (fallback for never-persisted state)', () => {
    expect(completionStateToAction('planned')).toBe('complete')
  })
})

// ── derivePaceSecondsPerMile ──────────────────────────────────────────────────

describe('derivePaceSecondsPerMile', () => {
  it('computes pace for a standard run (5 miles in 40 min = 8:00 /mi)', () => {
    const pace = derivePaceSecondsPerMile(5, 40)
    expect(pace).toBeCloseTo(480) // 8 min/mi = 480 s/mi
  })

  it('computes pace for a 5k in 30 min (3.1 mi = ~9:41 /mi)', () => {
    const pace = derivePaceSecondsPerMile(3.1, 30)
    expect(pace).toBeCloseTo(581, 0) // ≈9:41 /mi = 581 s/mi
  })

  it('formula is (durationMin * 60) / distanceMiles', () => {
    const pace = derivePaceSecondsPerMile(1, 10)
    expect(pace).toBe(600) // 10 min/mi = 600 s/mi
  })
})

// ── deriveSwimPaceSecondsPer100m ──────────────────────────────────────────────

describe('deriveSwimPaceSecondsPer100m', () => {
  it('computes pace for 1000m in 20 min (2:00 /100m)', () => {
    const pace = deriveSwimPaceSecondsPer100m(1000, 20)
    expect(pace).toBe(120) // 2 min / 100m = 120 s/100m
  })

  it('computes pace for 500m in 10 min (2:00 /100m)', () => {
    const pace = deriveSwimPaceSecondsPer100m(500, 10)
    expect(pace).toBe(120)
  })

  it('formula is (durationMin * 60) / (distanceMeters / 100)', () => {
    const pace = deriveSwimPaceSecondsPer100m(100, 2)
    expect(pace).toBe(120) // 2 min per 100m = 120 s/100m
  })
})

// ── formatPace ────────────────────────────────────────────────────────────────

describe('formatPace', () => {
  it('formats a clean 8:00 /mi pace', () => {
    expect(formatPace(480)).toBe('8:00 /mi')
  })

  it('formats a pace with non-zero seconds (9:02 /mi)', () => {
    expect(formatPace(542)).toBe('9:02 /mi')
  })

  it('pads single-digit seconds with a leading zero', () => {
    expect(formatPace(601)).toBe('10:01 /mi')
  })

  it('rounds fractional seconds before formatting', () => {
    // 9:00.4 /mi should round to 9:00
    expect(formatPace(540.4)).toBe('9:00 /mi')
    // 9:00.6 /mi should round to 9:01
    expect(formatPace(540.6)).toBe('9:01 /mi')
  })

  it('handles a pace that totals exactly 60 seconds after rounding (prevents 9:60 display)', () => {
    // 9:59.7 rounds to 9:60 without the totalSecs rounding guard.
    // The implementation rounds totalSecs first, so 599.7 → 600 → 10:00.
    expect(formatPace(599.7)).toBe('10:00 /mi')
  })

  it('formats sub-10-minute paces without leading zeros on minutes', () => {
    expect(formatPace(480)).toBe('8:00 /mi')  // 8 minutes, no leading zero
  })

  it('formats a very fast pace (4:00 /mi)', () => {
    expect(formatPace(240)).toBe('4:00 /mi')
  })
})

// ── formatSwimPace ────────────────────────────────────────────────────────────

describe('formatSwimPace', () => {
  it('formats a 2:00 /100m pace', () => {
    expect(formatSwimPace(120)).toBe('2:00 /100m')
  })

  it('formats a pace with non-zero seconds (1:45 /100m)', () => {
    expect(formatSwimPace(105)).toBe('1:45 /100m')
  })

  it('pads single-digit seconds with a leading zero', () => {
    expect(formatSwimPace(121)).toBe('2:01 /100m')
  })

  it('rounds fractional seconds before formatting', () => {
    expect(formatSwimPace(120.4)).toBe('2:00 /100m')
    expect(formatSwimPace(120.6)).toBe('2:01 /100m')
  })

  it('prevents 1:60 display via totalSecs rounding guard', () => {
    expect(formatSwimPace(119.7)).toBe('2:00 /100m')
  })
})
