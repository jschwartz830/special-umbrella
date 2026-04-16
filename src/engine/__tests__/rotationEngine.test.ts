import { describe, it, expect } from 'vitest'
import {
  mod,
  computeCurrentDayIndex,
  getTodayResolvedDay,
  getUpcomingDays,
  isPlanExpired,
} from '../rotationEngine'
import type { Plan, HistoryEntry, OverrideEntry } from '../../types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePlan(dayCount: number, overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    name: 'Test Plan',
    status: 'active',
    days: Array.from({ length: dayCount }, (_, i) => ({
      id: `day-${i}`,
      label: `Day ${i + 1}`,
      slots: [{ id: `slot-${i}`, type: 'weightlifting', name: `Workout ${i + 1}` }],
    })),
    duration: { type: 'rotations', value: 4 },
    startDate: '2026-01-01',
    startDayIndex: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeEntry(
  calendarDate: string,
  action: 'complete' | 'skip' | 'day_off',
  planDayIndex?: number,
): HistoryEntry {
  return {
    id: `entry-${calendarDate}`,
    planId: 'plan-1',
    calendarDate,
    planDayIndex: action === 'day_off' ? undefined : (planDayIndex ?? 0),
    action,
    createdAt: `${calendarDate}T12:00:00Z`,
  }
}

function makeOverride(
  appliedAt: string,
  type: OverrideEntry['type'],
  opts: Partial<OverrideEntry> = {},
): OverrideEntry {
  return {
    id: `ov-${appliedAt}`,
    planId: 'plan-1',
    appliedAt,
    type,
    ...opts,
  }
}

// ── mod ───────────────────────────────────────────────────────────────────────

describe('mod', () => {
  it('returns expected values for positive inputs', () => {
    expect(mod(0, 4)).toBe(0)
    expect(mod(3, 4)).toBe(3)
    expect(mod(4, 4)).toBe(0)
    expect(mod(5, 4)).toBe(1)
  })

  it('handles negative inputs symmetrically (for go_back)', () => {
    expect(mod(-1, 4)).toBe(3)
    expect(mod(-2, 4)).toBe(2)
    expect(mod(-4, 4)).toBe(0)
    expect(mod(-5, 4)).toBe(3)
  })
})

// ── computeCurrentDayIndex ────────────────────────────────────────────────────

describe('computeCurrentDayIndex', () => {
  it('returns startDayIndex when no entries and target is start date', () => {
    const plan = makePlan(4)
    const idx = computeCurrentDayIndex(plan, [], [], '2026-01-01')
    expect(idx).toBe(0)
  })

  it('returns startDayIndex when no entries and target is one day after start', () => {
    // No entries before 2026-01-02, so pointer stays at 0
    const plan = makePlan(4)
    const idx = computeCurrentDayIndex(plan, [], [], '2026-01-02')
    expect(idx).toBe(0)
  })

  it('advances pointer by 1 for each completed day', () => {
    const plan = makePlan(4)
    const entries = [makeEntry('2026-01-01', 'complete', 0)]
    const idx = computeCurrentDayIndex(plan, entries, [], '2026-01-02')
    expect(idx).toBe(1)
  })

  it('advances pointer for skip entries', () => {
    const plan = makePlan(4)
    const entries = [makeEntry('2026-01-01', 'skip', 0)]
    const idx = computeCurrentDayIndex(plan, entries, [], '2026-01-02')
    expect(idx).toBe(1)
  })

  it('advances pointer for day_off entries', () => {
    const plan = makePlan(4)
    const entries = [makeEntry('2026-01-01', 'day_off')]
    const idx = computeCurrentDayIndex(plan, entries, [], '2026-01-02')
    expect(idx).toBe(1)
  })

  it('does not advance for unlogged past days', () => {
    const plan = makePlan(4)
    // Jan 1 has no entry, so pointer should be stuck at 0 even going to Jan 3
    const idx = computeCurrentDayIndex(plan, [], [], '2026-01-03')
    expect(idx).toBe(0)
  })

  it('wraps around at plan boundary (modulo)', () => {
    const plan = makePlan(3)
    // Complete days 0, 1, 2 — wrap back to 0
    const entries = [
      makeEntry('2026-01-01', 'complete', 0),
      makeEntry('2026-01-02', 'complete', 1),
      makeEntry('2026-01-03', 'complete', 2),
    ]
    const idx = computeCurrentDayIndex(plan, entries, [], '2026-01-04')
    expect(idx).toBe(0) // back to start of rotation
  })

  it('handles multiple entries with mixed actions', () => {
    const plan = makePlan(4)
    const entries = [
      makeEntry('2026-01-01', 'complete', 0),
      makeEntry('2026-01-02', 'skip', 1),
      makeEntry('2026-01-03', 'day_off'),
    ]
    const idx = computeCurrentDayIndex(plan, entries, [], '2026-01-04')
    expect(idx).toBe(3)
  })

  it('respects startDayIndex when plan starts mid-rotation', () => {
    const plan = makePlan(4, { startDayIndex: 2 })
    // No entries → pointer stays at 2
    const idx = computeCurrentDayIndex(plan, [], [], '2026-01-01')
    expect(idx).toBe(2)
  })

  it('applies advance override before reading entry', () => {
    const plan = makePlan(4)
    const overrides = [makeOverride('2026-01-01T10:00:00Z', 'advance')]
    // Advance fires on Jan 1: pointer goes from 0 → 1
    // No entry on Jan 1 → stays
    const idx = computeCurrentDayIndex(plan, [], overrides, '2026-01-02')
    expect(idx).toBe(1)
  })

  it('applies go_back override correctly', () => {
    const plan = makePlan(4, { startDayIndex: 2 })
    const overrides = [makeOverride('2026-01-01T10:00:00Z', 'go_back')]
    // Jan 1 is processed: go_back fires → pointer = mod(2-1, 4) = 1, no entry → stays 1
    const idx = computeCurrentDayIndex(plan, [], overrides, '2026-01-02')
    expect(idx).toBe(1)
  })

  it('applies jump override to set pointer to specific day', () => {
    const plan = makePlan(4)
    const overrides = [makeOverride('2026-01-01T10:00:00Z', 'jump', { targetDayIndex: 3 })]
    const idx = computeCurrentDayIndex(plan, [], overrides, '2026-01-02')
    expect(idx).toBe(3)
  })

  it('jump then entry advances from the jumped position', () => {
    const plan = makePlan(4)
    const overrides = [makeOverride('2026-01-01T10:00:00Z', 'jump', { targetDayIndex: 3 })]
    const entries = [makeEntry('2026-01-01', 'complete', 3)]
    // Jan 1: jump to 3, complete → +1 → wraps to 0
    const idx = computeCurrentDayIndex(plan, entries, overrides, '2026-01-02')
    expect(idx).toBe(0)
  })

  it('returns 0 for plan with 0 days (guard)', () => {
    const plan = makePlan(0)
    expect(computeCurrentDayIndex(plan, [], [], '2026-01-05')).toBe(0)
  })

  it('uses most recent entry when multiple entries exist for same date', () => {
    const plan = makePlan(4)
    const entries: HistoryEntry[] = [
      { ...makeEntry('2026-01-01', 'complete', 0), id: 'e1', createdAt: '2026-01-01T10:00:00Z' },
      { ...makeEntry('2026-01-01', 'day_off'), id: 'e2', createdAt: '2026-01-01T12:00:00Z' },
    ]
    // Most recent is day_off → pointer still advances by 1
    const idx = computeCurrentDayIndex(plan, entries, [], '2026-01-02')
    expect(idx).toBe(1)
  })
})

// ── getTodayResolvedDay ───────────────────────────────────────────────────────

describe('getTodayResolvedDay', () => {
  it('returns today_pending when no entry', () => {
    const plan = makePlan(4)
    const rd = getTodayResolvedDay(plan, [], [], '2026-01-01')
    expect(rd.status).toBe('today_pending')
    expect(rd.planDayIndex).toBe(0)
    expect(rd.calendarDate).toBe('2026-01-01')
  })

  it('returns today_complete after completing', () => {
    const plan = makePlan(4)
    const entries = [makeEntry('2026-01-05', 'complete', 0)]
    const rd = getTodayResolvedDay(plan, entries, [], '2026-01-05')
    expect(rd.status).toBe('today_complete')
  })

  it('returns today_skip after skipping', () => {
    const plan = makePlan(4)
    const entries = [makeEntry('2026-01-05', 'skip', 0)]
    const rd = getTodayResolvedDay(plan, entries, [], '2026-01-05')
    expect(rd.status).toBe('today_skip')
  })

  it('returns today_day_off after day off', () => {
    const plan = makePlan(4)
    const entries = [makeEntry('2026-01-05', 'day_off')]
    const rd = getTodayResolvedDay(plan, entries, [], '2026-01-05')
    expect(rd.status).toBe('today_day_off')
  })

  it('applies today overrides to determine planDay shown', () => {
    const plan = makePlan(4)
    const overrides = [makeOverride('2026-01-05T10:00:00Z', 'jump', { targetDayIndex: 2 })]
    const rd = getTodayResolvedDay(plan, [], overrides, '2026-01-05')
    expect(rd.planDayIndex).toBe(2)
    expect(rd.planDay.label).toBe('Day 3')
  })
})

// ── getUpcomingDays ───────────────────────────────────────────────────────────

describe('getUpcomingDays', () => {
  it('returns empty array for plan with 0 days', () => {
    const plan = makePlan(0)
    expect(getUpcomingDays(plan, [], [], '2026-01-01', 5)).toEqual([])
  })

  it('returns count upcoming days starting from tomorrow', () => {
    const plan = makePlan(4)
    const result = getUpcomingDays(plan, [], [], '2026-01-01', 3)
    expect(result).toHaveLength(3)
    expect(result[0].calendarDate).toBe('2026-01-02')
    expect(result[1].calendarDate).toBe('2026-01-03')
    expect(result[2].calendarDate).toBe('2026-01-04')
  })

  it('all upcoming days have status=future', () => {
    const plan = makePlan(4)
    const result = getUpcomingDays(plan, [], [], '2026-01-01', 5)
    expect(result.every(r => r.status === 'future')).toBe(true)
  })

  it('advances past today before projecting (today completed)', () => {
    const plan = makePlan(4) // days 0,1,2,3
    const entries = [makeEntry('2026-01-01', 'complete', 0)]
    // Today (Jan 1) was completed — pointer should be at 0 (today), +1 → 1 for tomorrow
    const result = getUpcomingDays(plan, entries, [], '2026-01-01', 3)
    expect(result[0].planDayIndex).toBe(1)
    expect(result[1].planDayIndex).toBe(2)
    expect(result[2].planDayIndex).toBe(3)
  })

  it('still advances past today when pending (no entry)', () => {
    const plan = makePlan(4)
    // No entry today → pointer at 0, +1 → 1 for tomorrow
    const result = getUpcomingDays(plan, [], [], '2026-01-01', 3)
    expect(result[0].planDayIndex).toBe(1)
  })

  it('applies today overrides before projecting', () => {
    const plan = makePlan(4)
    const overrides = [makeOverride('2026-01-01T10:00:00Z', 'jump', { targetDayIndex: 2 })]
    // Today jumps to day 2, then +1 → day 3 for tomorrow
    const result = getUpcomingDays(plan, [], overrides, '2026-01-01', 1)
    expect(result[0].planDayIndex).toBe(3)
  })

  it('wraps around rotation boundary', () => {
    // Start the plan on the last day so advancing past today wraps to 0
    const plan = makePlan(3, { startDayIndex: 2 }) // days 0,1,2; start at day 2
    // No entries — computeCurrentDayIndex returns startDayIndex=2, then +1 wraps to 0
    const result = getUpcomingDays(plan, [], [], '2026-01-01', 3)
    expect(result[0].planDayIndex).toBe(0) // wrapped from day 2
    expect(result[1].planDayIndex).toBe(1)
    expect(result[2].planDayIndex).toBe(2)
  })

  it('incorporates prior days completed before today in projection', () => {
    const plan = makePlan(4)
    const entries = [
      makeEntry('2026-01-01', 'complete', 0),
      makeEntry('2026-01-02', 'complete', 1),
    ]
    // Jan 3: pointer at 2 (after two completions). +1 → 3 for upcoming.
    const result = getUpcomingDays(plan, entries, [], '2026-01-03', 1)
    expect(result[0].planDayIndex).toBe(3)
  })
})

// ── isPlanExpired ─────────────────────────────────────────────────────────────

describe('isPlanExpired', () => {
  describe('weeks-based duration', () => {
    it('is not expired before end date', () => {
      const plan = makePlan(4, {
        duration: { type: 'weeks', value: 4 },
        startDate: '2026-01-01',
      })
      expect(isPlanExpired(plan, [], '2026-01-28')).toBe(false)
    })

    it('is expired on the end date (startDate + 4 weeks)', () => {
      const plan = makePlan(4, {
        duration: { type: 'weeks', value: 4 },
        startDate: '2026-01-01',
      })
      // 4 weeks from 2026-01-01 = 2026-01-29
      expect(isPlanExpired(plan, [], '2026-01-29')).toBe(true)
    })

    it('is expired after the end date', () => {
      const plan = makePlan(4, {
        duration: { type: 'weeks', value: 2 },
        startDate: '2026-01-01',
      })
      expect(isPlanExpired(plan, [], '2026-02-01')).toBe(true)
    })
  })

  describe('rotations-based duration', () => {
    it('is not expired with fewer completions than required', () => {
      const plan = makePlan(3, { duration: { type: 'rotations', value: 2 } })
      // Need 2 * 3 = 6 complete/skip entries
      const entries = [
        makeEntry('2026-01-01', 'complete', 0),
        makeEntry('2026-01-02', 'complete', 1),
        makeEntry('2026-01-03', 'complete', 2),
      ]
      // 3 entries → 1 full rotation → not expired (need 2)
      expect(isPlanExpired(plan, entries, '2026-01-04')).toBe(false)
    })

    it('is expired after completing required rotations', () => {
      const plan = makePlan(3, { duration: { type: 'rotations', value: 2 } })
      const entries = [
        makeEntry('2026-01-01', 'complete', 0),
        makeEntry('2026-01-02', 'complete', 1),
        makeEntry('2026-01-03', 'complete', 2),
        makeEntry('2026-01-04', 'complete', 0),
        makeEntry('2026-01-05', 'complete', 1),
        makeEntry('2026-01-06', 'complete', 2),
      ]
      // 6 entries / 3 days per rotation = 2 rotations → expired
      expect(isPlanExpired(plan, entries, '2026-01-07')).toBe(true)
    })

    it('counts skip entries toward rotation completion', () => {
      const plan = makePlan(2, { duration: { type: 'rotations', value: 1 } })
      const entries = [
        makeEntry('2026-01-01', 'skip', 0),
        makeEntry('2026-01-02', 'complete', 1),
      ]
      // 2 entries / 2 days = 1 rotation → expired
      expect(isPlanExpired(plan, entries, '2026-01-03')).toBe(true)
    })

    it('does NOT count day_off entries toward rotation completion', () => {
      const plan = makePlan(2, { duration: { type: 'rotations', value: 1 } })
      const entries = [
        makeEntry('2026-01-01', 'day_off'),
        makeEntry('2026-01-02', 'complete', 1),
      ]
      // 1 complete/skip out of 2 needed → not expired
      expect(isPlanExpired(plan, entries, '2026-01-03')).toBe(false)
    })
  })
})
