import { describe, it, expect } from 'vitest'
import { getActiveStreakMilestone, STREAK_MILESTONES } from '../useStreakMilestoneDismiss'

// ── getActiveStreakMilestone ───────────────────────────────────────────────────

describe('getActiveStreakMilestone', () => {
  it('returns null for streaks below 7', () => {
    expect(getActiveStreakMilestone(0)).toBe(null)
    expect(getActiveStreakMilestone(1)).toBe(null)
    expect(getActiveStreakMilestone(6)).toBe(null)
  })

  it('returns the first milestone at exactly 7', () => {
    expect(getActiveStreakMilestone(7)).toBe(7)
  })

  it('returns 7 for streaks between 7 and 13 (inclusive)', () => {
    expect(getActiveStreakMilestone(8)).toBe(7)
    expect(getActiveStreakMilestone(13)).toBe(7)
  })

  it('returns 14 at exactly 14', () => {
    expect(getActiveStreakMilestone(14)).toBe(14)
  })

  it('returns 21 at exactly 21', () => {
    expect(getActiveStreakMilestone(21)).toBe(21)
  })

  it('returns 30 at exactly 30', () => {
    expect(getActiveStreakMilestone(30)).toBe(30)
  })

  it('returns 60 at exactly 60', () => {
    expect(getActiveStreakMilestone(60)).toBe(60)
  })

  it('returns 90 at exactly 90', () => {
    expect(getActiveStreakMilestone(90)).toBe(90)
  })

  it('returns 180 at exactly 180', () => {
    expect(getActiveStreakMilestone(180)).toBe(180)
  })

  it('returns 365 at exactly 365', () => {
    expect(getActiveStreakMilestone(365)).toBe(365)
  })

  it('returns 365 for streaks above 365', () => {
    expect(getActiveStreakMilestone(366)).toBe(365)
    expect(getActiveStreakMilestone(999)).toBe(365)
  })

  it('returns the highest milestone that has been reached, not the next one', () => {
    // streak=25: passed 7 and 21, not yet 30
    expect(getActiveStreakMilestone(25)).toBe(21)
    // streak=91: passed 90, not yet 180
    expect(getActiveStreakMilestone(91)).toBe(90)
    // streak=179: passed 90, not yet 180
    expect(getActiveStreakMilestone(179)).toBe(90)
  })

  it('covers all milestones in STREAK_MILESTONES', () => {
    for (const m of STREAK_MILESTONES) {
      expect(getActiveStreakMilestone(m)).toBe(m)
    }
  })
})
