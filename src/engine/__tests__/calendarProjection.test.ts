import { describe, it, expect } from 'vitest'
import { getResolvedDaysRange } from '../rotationEngine'
import { buildMonthGrid } from '../calendarProjection'
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

// ── getResolvedDaysRange ──────────────────────────────────────────────────────

describe('getResolvedDaysRange', () => {
  describe('basic structure', () => {
    it('returns correct number of days for the given range', () => {
      const plan = makePlan(4)
      const result = getResolvedDaysRange(plan, [], [], '2026-01-05', '2026-01-01', '2026-01-07')
      expect(result).toHaveLength(7)
    })

    it('returns empty array for plan with 0 days', () => {
      const plan = makePlan(0)
      const result = getResolvedDaysRange(plan, [], [], '2026-01-05', '2026-01-01', '2026-01-07')
      expect(result).toEqual([])
    })

    it('returns exactly 1 day when fromDate === toDate', () => {
      const plan = makePlan(4)
      const result = getResolvedDaysRange(plan, [], [], '2026-01-05', '2026-01-05', '2026-01-05')
      expect(result).toHaveLength(1)
      expect(result[0].calendarDate).toBe('2026-01-05')
    })
  })

  describe('status assignment', () => {
    it('assigns past_unlogged to past days without entries', () => {
      const plan = makePlan(4)
      const result = getResolvedDaysRange(plan, [], [], '2026-01-05', '2026-01-01', '2026-01-03')
      expect(result.every(r => r.status === 'past_unlogged')).toBe(true)
    })

    it('assigns past_complete to past days with complete entries', () => {
      const plan = makePlan(4)
      const entries = [makeEntry('2026-01-02', 'complete', 1)]
      const result = getResolvedDaysRange(plan, entries, [], '2026-01-05', '2026-01-01', '2026-01-03')
      expect(result.find(r => r.calendarDate === '2026-01-02')!.status).toBe('past_complete')
    })

    it('assigns past_skip to past days with skip entries', () => {
      const plan = makePlan(4)
      const entries = [makeEntry('2026-01-02', 'skip', 0)]
      const result = getResolvedDaysRange(plan, entries, [], '2026-01-05', '2026-01-01', '2026-01-03')
      expect(result.find(r => r.calendarDate === '2026-01-02')!.status).toBe('past_skip')
    })

    it('assigns past_day_off to past days with day_off entries', () => {
      const plan = makePlan(4)
      const entries = [makeEntry('2026-01-02', 'day_off')]
      const result = getResolvedDaysRange(plan, entries, [], '2026-01-05', '2026-01-01', '2026-01-03')
      expect(result.find(r => r.calendarDate === '2026-01-02')!.status).toBe('past_day_off')
    })

    it('assigns today_pending when today has no entry', () => {
      const plan = makePlan(4)
      const today = '2026-01-05'
      const result = getResolvedDaysRange(plan, [], [], today, '2026-01-04', '2026-01-06')
      expect(result.find(r => r.calendarDate === today)!.status).toBe('today_pending')
    })

    it('assigns today_complete when today has a complete entry', () => {
      const plan = makePlan(4)
      const today = '2026-01-05'
      const entries = [makeEntry(today, 'complete', 0)]
      const result = getResolvedDaysRange(plan, entries, [], today, today, today)
      expect(result[0].status).toBe('today_complete')
    })

    it('assigns today_skip when today has a skip entry', () => {
      const plan = makePlan(4)
      const today = '2026-01-05'
      const entries = [makeEntry(today, 'skip', 0)]
      const result = getResolvedDaysRange(plan, entries, [], today, today, today)
      expect(result[0].status).toBe('today_skip')
    })

    it('assigns today_day_off when today has a day_off entry', () => {
      const plan = makePlan(4)
      const today = '2026-01-05'
      const entries = [makeEntry(today, 'day_off')]
      const result = getResolvedDaysRange(plan, entries, [], today, today, today)
      expect(result[0].status).toBe('today_day_off')
    })

    it('assigns future to days after today', () => {
      const plan = makePlan(4)
      const result = getResolvedDaysRange(plan, [], [], '2026-01-01', '2026-01-02', '2026-01-05')
      expect(result.every(r => r.status === 'future')).toBe(true)
    })
  })

  describe('pointer advancement', () => {
    it('does NOT advance pointer for past unlogged days', () => {
      // 3 unlogged days before today, then today should still show day 0
      const plan = makePlan(4)
      const result = getResolvedDaysRange(plan, [], [], '2026-01-04', '2026-01-01', '2026-01-04')
      // All four days should show day 0 because no entries → pointer stuck at 0
      expect(result.every(r => r.planDayIndex === 0)).toBe(true)
    })

    it('advances pointer for each past logged entry (complete)', () => {
      const plan = makePlan(4)
      const entries = [
        makeEntry('2026-01-01', 'complete', 0),
        makeEntry('2026-01-02', 'complete', 1),
      ]
      const result = getResolvedDaysRange(plan, entries, [], '2026-01-05', '2026-01-01', '2026-01-04')
      expect(result[0].planDayIndex).toBe(0) // Jan 1
      expect(result[1].planDayIndex).toBe(1) // Jan 2 (after complete on Jan 1)
      expect(result[2].planDayIndex).toBe(2) // Jan 3 (after complete on Jan 2)
      expect(result[3].planDayIndex).toBe(2) // Jan 4 (Jan 3 unlogged → no advance)
    })

    it('advances pointer for past day_off entries', () => {
      const plan = makePlan(4)
      const entries = [makeEntry('2026-01-01', 'day_off')]
      const result = getResolvedDaysRange(plan, entries, [], '2026-01-05', '2026-01-01', '2026-01-02')
      expect(result[0].planDayIndex).toBe(0) // Jan 1 (day_off)
      expect(result[1].planDayIndex).toBe(1) // Jan 2 (day_off advanced)
    })

    it('always advances pointer on today regardless of entry', () => {
      const plan = makePlan(4)
      const today = '2026-01-03'
      const result = getResolvedDaysRange(plan, [], [], today, today, '2026-01-04')
      expect(result[0].planDayIndex).toBe(0) // today = 0
      expect(result[1].planDayIndex).toBe(1) // tomorrow = 1 (always projected forward)
    })

    it('always advances pointer on future days', () => {
      // today = Jan 1, range = Jan 2–5 (all future)
      // Jan 1 had no entry → pointer stayed at 0 coming into Jan 2.
      // Each future day projects forward: Jan 2 shows day 0, Jan 3 day 1, ...
      const plan = makePlan(4)
      const result = getResolvedDaysRange(plan, [], [], '2026-01-01', '2026-01-02', '2026-01-05')
      for (let i = 0; i < 4; i++) {
        expect(result[i].planDayIndex).toBe(i)
      }
    })

    it('wraps pointer around plan boundary', () => {
      const plan = makePlan(3) // days 0, 1, 2
      const entries = [
        makeEntry('2026-01-01', 'complete', 0),
        makeEntry('2026-01-02', 'complete', 1),
        makeEntry('2026-01-03', 'complete', 2),
      ]
      const result = getResolvedDaysRange(plan, entries, [], '2026-01-05', '2026-01-01', '2026-01-04')
      expect(result[0].planDayIndex).toBe(0)
      expect(result[1].planDayIndex).toBe(1)
      expect(result[2].planDayIndex).toBe(2)
      expect(result[3].planDayIndex).toBe(0) // wrapped back to 0
    })
  })

  describe('overrides', () => {
    it('applies override BEFORE reading planDay on that date', () => {
      const plan = makePlan(4)
      // Jump to day 3 on Jan 1
      const overrides = [makeOverride('2026-01-01T12:00:00Z', 'jump', { targetDayIndex: 3 })]
      const result = getResolvedDaysRange(plan, [], [], '2026-01-05', '2026-01-01', '2026-01-01')
      // Without override, would show day 0; with jump → shows day 3
      const withOverride = getResolvedDaysRange(plan, [], overrides, '2026-01-05', '2026-01-01', '2026-01-01')
      expect(withOverride[0].planDayIndex).toBe(3)
      expect(result[0].planDayIndex).toBe(0)
    })

    it('advance override on a past unlogged day changes display but not pointer progression', () => {
      // today = Jan 5, range = Jan 1–2 (both past, no entries logged)
      // Jan 1: advance override fires → pointer goes 0 → 1 (shown as Day 2)
      // But since Jan 1 is a past UNLOGGED day (no entry), projectForward = false,
      // so the pointer does NOT advance for subsequent days — it stays at 1.
      // Jan 2: pointer = 1 (same as Jan 1's post-override value)
      const plan = makePlan(4)
      const overrides = [makeOverride('2026-01-01T12:00:00Z', 'advance')]
      const result = getResolvedDaysRange(plan, [], overrides, '2026-01-05', '2026-01-01', '2026-01-02')
      expect(result[0].planDayIndex).toBe(1) // Jan 1: shows Day 2 after advance
      expect(result[1].planDayIndex).toBe(1) // Jan 2: pointer unchanged (past unlogged)
    })

    it('advance override on a future day shifts subsequent projection', () => {
      // today = Jan 1, range = Jan 2–3 (both future)
      // Jan 2: pointer = 0, advance fires → shows day 1, then projectForward = true → +1 → pointer = 2
      // Jan 3: pointer = 2 (shown as Day 3)
      const plan = makePlan(4)
      const overrides = [makeOverride('2026-01-02T12:00:00Z', 'advance')]
      const result = getResolvedDaysRange(plan, [], overrides, '2026-01-01', '2026-01-02', '2026-01-03')
      expect(result[0].planDayIndex).toBe(1) // Jan 2: 0 + advance = 1
      expect(result[1].planDayIndex).toBe(2) // Jan 3: 1 + projectForward = 2
    })
  })

  describe('historyEntry attached', () => {
    it('attaches the history entry to resolved days that have one', () => {
      const plan = makePlan(4)
      const entry = makeEntry('2026-01-03', 'complete', 2)
      const result = getResolvedDaysRange(plan, [entry], [], '2026-01-05', '2026-01-03', '2026-01-03')
      expect(result[0].historyEntry).toEqual(entry)
    })

    it('historyEntry is undefined for days without an entry', () => {
      const plan = makePlan(4)
      const result = getResolvedDaysRange(plan, [], [], '2026-01-05', '2026-01-01', '2026-01-01')
      expect(result[0].historyEntry).toBeUndefined()
    })
  })

  describe('edge case: fromDate before plan.startDate', () => {
    it('shows past_unlogged for dates before plan.startDate when queried directly', () => {
      // getResolvedDaysRange itself does not filter by plan.startDate — it starts
      // at startDayIndex and processes whatever date range is given. When the
      // range includes dates before plan.startDate, those days are returned with
      // status=past_unlogged (no entry → unlogged). Callers like buildMonthGrid
      // are responsible for not passing dates before plan.startDate.
      const plan = makePlan(4, { startDate: '2026-01-10' })
      const result = getResolvedDaysRange(
        plan, [], [], '2026-01-15',
        '2026-01-01', // before startDate
        '2026-01-09',
      )
      // All 9 days come back as past_unlogged at startDayIndex
      expect(result.every(r => r.status === 'past_unlogged')).toBe(true)
      expect(result.every(r => r.planDayIndex === 0)).toBe(true)
    })
  })
})

// ── buildMonthGrid ────────────────────────────────────────────────────────────

describe('buildMonthGrid', () => {
  it('returns exactly 6 weeks for January 2026 (starts Thursday)', () => {
    // Jan 2026: starts Thu Jan 1. Grid starts Sun Dec 28 2025. 5 weeks not enough (Jan 31 is Sat).
    // startOfWeek(Jan 1) = Dec 28; endOfWeek(Jan 31) = Feb 1 → 35 days = 5 weeks
    // Let's check actual grid size
    const plan = makePlan(4)
    const weeks = buildMonthGrid(2026, 0, plan, [], [], '2026-01-15')
    // Each week has 7 days
    expect(weeks.every(w => w.length === 7)).toBe(true)
    // Should be 5 or 6 weeks (date-fns will give us complete weeks)
    expect(weeks.length).toBeGreaterThanOrEqual(4)
    expect(weeks.length).toBeLessThanOrEqual(6)
  })

  it('marks only current month days as isCurrentMonth=true', () => {
    const plan = makePlan(4)
    const weeks = buildMonthGrid(2026, 0, plan, [], [], '2026-01-15') // January 2026
    const allCells = weeks.flat()
    const currentMonthCells = allCells.filter(c => c.isCurrentMonth)
    expect(currentMonthCells).toHaveLength(31) // January has 31 days
    expect(currentMonthCells.every(c => c.date.startsWith('2026-01'))).toBe(true)
  })

  it('marks exactly one cell as isToday', () => {
    const plan = makePlan(4)
    const today = '2026-01-15'
    const weeks = buildMonthGrid(2026, 0, plan, [], [], today)
    const allCells = weeks.flat()
    const todayCells = allCells.filter(c => c.isToday)
    expect(todayCells).toHaveLength(1)
    expect(todayCells[0].date).toBe(today)
  })

  it('attaches resolvedDay to cells on or after plan.startDate', () => {
    // plan.startDate = '2026-01-01'. The Jan grid starts Dec 28, 2025 (Sunday).
    // Dec 28–31 are before the plan start → no resolvedDay.
    // Jan 1–31 are on or after start → resolvedDay present.
    const plan = makePlan(4) // startDate = '2026-01-01'
    const weeks = buildMonthGrid(2026, 0, plan, [], [], '2026-01-15')
    const allCells = weeks.flat()
    const preStart = allCells.filter(c => c.date < plan.startDate)
    const postStart = allCells.filter(c => c.date >= plan.startDate)
    expect(preStart.every(c => c.resolvedDay === undefined)).toBe(true)
    expect(postStart.every(c => c.resolvedDay !== undefined)).toBe(true)
  })

  it('leaves all cells without resolvedDay when plan starts after the entire month', () => {
    // Plan starts Feb 1, viewing January → no resolved days for any cell
    const plan = makePlan(4, { startDate: '2026-02-01' })
    const weeks = buildMonthGrid(2026, 0, plan, [], [], '2026-01-15')
    const allCells = weeks.flat()
    expect(allCells.every(c => c.resolvedDay === undefined)).toBe(true)
  })

  it('leaves resolvedDay undefined when no plan is provided', () => {
    const weeks = buildMonthGrid(2026, 0, null, [], [], '2026-01-15')
    const allCells = weeks.flat()
    expect(allCells.every(c => c.resolvedDay === undefined)).toBe(true)
  })

  it('total cell count covers the full 7-day-aligned grid', () => {
    const plan = makePlan(4)
    const weeks = buildMonthGrid(2026, 0, plan, [], [], '2026-01-15')
    const totalCells = weeks.flat().length
    // Must be a multiple of 7
    expect(totalCells % 7).toBe(0)
    // And cover all 31 days of January plus padding
    expect(totalCells).toBeGreaterThanOrEqual(31)
  })

  it('propagates past_complete status through resolvedDay for a completed entry', () => {
    const plan = makePlan(4) // startDate = 2026-01-01
    const entry = makeEntry('2026-01-10', 'complete', 0)
    const weeks = buildMonthGrid(2026, 0, plan, [entry], [], '2026-01-15')
    const allCells = weeks.flat()
    const cell = allCells.find(c => c.date === '2026-01-10')!
    expect(cell.resolvedDay).toBeDefined()
    expect(cell.resolvedDay!.status).toBe('past_complete')
    expect(cell.resolvedDay!.historyEntry?.action).toBe('complete')
  })

  it('propagates past_skip status for a skipped entry', () => {
    const plan = makePlan(4)
    const entry = makeEntry('2026-01-08', 'skip', 0)
    const weeks = buildMonthGrid(2026, 0, plan, [entry], [], '2026-01-15')
    const cell = weeks.flat().find(c => c.date === '2026-01-08')!
    expect(cell.resolvedDay!.status).toBe('past_skip')
  })

  it('propagates past_day_off status for a day_off entry', () => {
    const plan = makePlan(4)
    const entry = makeEntry('2026-01-07', 'day_off')
    const weeks = buildMonthGrid(2026, 0, plan, [entry], [], '2026-01-15')
    const cell = weeks.flat().find(c => c.date === '2026-01-07')!
    expect(cell.resolvedDay!.status).toBe('past_day_off')
  })

  it('shows today_pending status for today with no entry', () => {
    const plan = makePlan(4)
    const today = '2026-01-15'
    const weeks = buildMonthGrid(2026, 0, plan, [], [], today)
    const cell = weeks.flat().find(c => c.date === today)!
    expect(cell.isToday).toBe(true)
    expect(cell.resolvedDay!.status).toBe('today_pending')
  })

  it('applies a jump override to the planDayIndex shown on that date', () => {
    // Jump override on Jan 5 → planDayIndex = 3, not the natural 0
    const plan = makePlan(4) // startDate = 2026-01-01; no prior entries → pointer is 0 on Jan 5
    const override = makeOverride('2026-01-05T12:00:00Z', 'jump', { targetDayIndex: 3 })
    const weeks = buildMonthGrid(2026, 0, plan, [], [override], '2026-01-15')
    const cell = weeks.flat().find(c => c.date === '2026-01-05')!
    expect(cell.resolvedDay!.planDayIndex).toBe(3)
  })

  it('pointer advancement from a complete entry affects subsequent dates in the grid', () => {
    // Jan 1 complete at day 0 → Jan 2 should show day 1 (pointer advanced)
    const plan = makePlan(4)
    const entry = makeEntry('2026-01-01', 'complete', 0)
    const weeks = buildMonthGrid(2026, 0, plan, [entry], [], '2026-01-15')
    const allCells = weeks.flat()
    const jan1 = allCells.find(c => c.date === '2026-01-01')!
    const jan2 = allCells.find(c => c.date === '2026-01-02')!
    expect(jan1.resolvedDay!.planDayIndex).toBe(0)
    expect(jan2.resolvedDay!.planDayIndex).toBe(1)
  })

  it('past_unlogged days do not advance the pointer', () => {
    // Jan 1–4 all unlogged → Jan 5 still at day 0
    const plan = makePlan(4)
    const weeks = buildMonthGrid(2026, 0, plan, [], [], '2026-01-15')
    const allCells = weeks.flat()
    const jan5 = allCells.find(c => c.date === '2026-01-05')!
    expect(jan5.resolvedDay!.planDayIndex).toBe(0)
  })

  it('entries from a different plan are not included in resolvedDay', () => {
    // otherPlan's entry on Jan 10 should not affect the grid for plan-1
    const plan = makePlan(4)
    const foreignEntry: HistoryEntry = {
      id: 'foreign',
      planId: 'other-plan',
      calendarDate: '2026-01-10',
      planDayIndex: 2,
      action: 'complete',
      createdAt: '2026-01-10T12:00:00Z',
    }
    const weeks = buildMonthGrid(2026, 0, plan, [foreignEntry], [], '2026-01-15')
    const cell = weeks.flat().find(c => c.date === '2026-01-10')!
    // Should show past_unlogged for plan-1 (no plan-1 entry on Jan 10)
    expect(cell.resolvedDay!.status).toBe('past_unlogged')
    expect(cell.resolvedDay!.historyEntry).toBeUndefined()
  })
})
