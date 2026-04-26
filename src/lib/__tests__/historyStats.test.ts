import { describe, it, expect } from 'vitest'
import { computeHistoryStats, computePlanProgress } from '../historyStats'
import type { HistoryEntry, ExtraWorkoutEntry, Plan } from '../../types'

function entry(
  date: string,
  action: HistoryEntry['action'],
  planId = 'plan-1',
): HistoryEntry {
  return {
    id: `${planId}_${date}`,
    planId,
    calendarDate: date,
    planDayIndex: action === 'day_off' ? undefined : 0,
    action,
    createdAt: `${date}T12:00:00Z`,
  }
}

function extra(
  date: string,
  planId = 'plan-1',
): ExtraWorkoutEntry {
  return {
    id: `extra_${planId}_${date}`,
    planId,
    calendarDate: date,
    workoutType: 'yoga',
    workoutName: 'Yoga',
    createdAt: `${date}T12:30:00Z`,
  }
}

describe('computeHistoryStats', () => {
  it('returns zeros for empty inputs', () => {
    const s = computeHistoryStats([], [], '2026-04-17')
    expect(s).toEqual({
      totalLogged: 0,
      totalCompleted: 0,
      last7Completed: 0,
      last30Completed: 0,
      currentStreak: 0,
    })
  })

  it('counts totals and completed separately (rotation only)', () => {
    const entries = [
      entry('2026-04-10', 'complete'),
      entry('2026-04-11', 'skip'),
      entry('2026-04-12', 'day_off'),
      entry('2026-04-13', 'complete'),
    ]
    const s = computeHistoryStats(entries, [], '2026-04-17')
    expect(s.totalLogged).toBe(4)
    expect(s.totalCompleted).toBe(2)
  })

  it('applies the 7-day window inclusive of today', () => {
    const entries = [
      entry('2026-04-11', 'complete'), // day -6 — inside window
      entry('2026-04-10', 'complete'), // day -7 — outside 7-day window
      entry('2026-04-17', 'complete'), // today
    ]
    const s = computeHistoryStats(entries, [], '2026-04-17')
    expect(s.last7Completed).toBe(2)
  })

  it('applies the 30-day window inclusive of today', () => {
    const entries = [
      entry('2026-03-19', 'complete'), // day -29 — inside
      entry('2026-03-18', 'complete'), // day -30 — outside
      entry('2026-04-17', 'complete'),
    ]
    const s = computeHistoryStats(entries, [], '2026-04-17')
    expect(s.last30Completed).toBe(2)
  })

  it('excludes skip entries from the window counts', () => {
    const entries = [
      entry('2026-04-15', 'skip'),
      entry('2026-04-16', 'day_off'),
      entry('2026-04-17', 'complete'),
    ]
    const s = computeHistoryStats(entries, [], '2026-04-17')
    expect(s.last7Completed).toBe(1)
  })

  it('counts the current streak of consecutive complete/day_off days ending today', () => {
    const entries = [
      entry('2026-04-14', 'complete'),
      entry('2026-04-15', 'day_off'),
      entry('2026-04-16', 'complete'),
      entry('2026-04-17', 'complete'),
    ]
    const s = computeHistoryStats(entries, [], '2026-04-17')
    expect(s.currentStreak).toBe(4)
  })

  it('streak is 0 when today has no qualifying entry', () => {
    const entries = [
      entry('2026-04-15', 'complete'),
      entry('2026-04-16', 'complete'),
    ]
    const s = computeHistoryStats(entries, [], '2026-04-17')
    expect(s.currentStreak).toBe(0)
  })

  it('skip breaks the streak', () => {
    const entries = [
      entry('2026-04-14', 'complete'),
      entry('2026-04-15', 'skip'),
      entry('2026-04-16', 'complete'),
      entry('2026-04-17', 'complete'),
    ]
    const s = computeHistoryStats(entries, [], '2026-04-17')
    expect(s.currentStreak).toBe(2)
  })

  it('a gap day breaks the streak', () => {
    const entries = [
      entry('2026-04-14', 'complete'),
      // 2026-04-15 missing
      entry('2026-04-16', 'complete'),
      entry('2026-04-17', 'complete'),
    ]
    const s = computeHistoryStats(entries, [], '2026-04-17')
    expect(s.currentStreak).toBe(2)
  })

  // ── Extras ──────────────────────────────────────────────────────────────

  it('includes extras in totals and completed counts', () => {
    const entries = [entry('2026-04-17', 'complete')]
    const extras = [
      extra('2026-04-15'),
      extra('2026-04-16'),
    ]
    const s = computeHistoryStats(entries, extras, '2026-04-17')
    expect(s.totalLogged).toBe(3)
    expect(s.totalCompleted).toBe(3)
  })

  it('includes extras in the 7-day and 30-day windows', () => {
    const entries: HistoryEntry[] = []
    const extras = [
      extra('2026-04-10'), // day -7 — outside 7-day, inside 30-day
      extra('2026-04-11'), // day -6 — inside 7-day
      extra('2026-04-17'), // today
    ]
    const s = computeHistoryStats(entries, extras, '2026-04-17')
    expect(s.last7Completed).toBe(2)
    expect(s.last30Completed).toBe(3)
  })

  it('counts an extras-only streak that ends today', () => {
    const extras = [
      extra('2026-04-15'),
      extra('2026-04-16'),
      extra('2026-04-17'),
    ]
    const s = computeHistoryStats([], extras, '2026-04-17')
    expect(s.currentStreak).toBe(3)
  })

  it('extras fill gaps in a mixed streak', () => {
    // 4/15: skip (streak-breaker), 4/16: extra (streak-builder), 4/17: complete
    const entries = [
      entry('2026-04-14', 'complete'),
      entry('2026-04-15', 'skip'),
      entry('2026-04-17', 'complete'),
    ]
    const extras = [
      extra('2026-04-15'), // an extra workout on the same day as the skip
      extra('2026-04-16'),
    ]
    const s = computeHistoryStats(entries, extras, '2026-04-17')
    // 4/17 complete → 4/16 extra → 4/15 extra (overrides skip) → 4/14 complete
    expect(s.currentStreak).toBe(4)
  })

  it('duplicate-date extras do not double-count within the streak', () => {
    const extras = [
      extra('2026-04-17'),
      { ...extra('2026-04-17'), id: 'second_same_day' },
    ]
    const s = computeHistoryStats([], extras, '2026-04-17')
    expect(s.currentStreak).toBe(1)
  })
})

// ── computePlanProgress ───────────────────────────────────────────────────────

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    name: 'Test Plan',
    status: 'active',
    days: [
      { id: 'd0', label: 'Day 1', slots: [{ id: 's0', type: 'weightlifting', name: 'Lift' }] },
      { id: 'd1', label: 'Day 2', slots: [{ id: 's1', type: 'yoga', name: 'Yoga' }] },
      { id: 'd2', label: 'Day 3', slots: [{ id: 's2', type: 'rest', name: 'Rest' }] },
    ],
    duration: { type: 'rotations', value: 4 },
    startDate: '2026-01-01',
    startDayIndex: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function completeEntry(date: string, planId = 'plan-1'): HistoryEntry {
  return {
    id: `e-${planId}-${date}`,
    planId,
    calendarDate: date,
    planDayIndex: 0,
    action: 'complete',
    createdAt: `${date}T12:00:00Z`,
  }
}

describe('computePlanProgress', () => {
  describe('rotations-based plans', () => {
    it('returns 0 completed when no entries', () => {
      const plan = makePlan({ duration: { type: 'rotations', value: 4 } })
      const result = computePlanProgress(plan, [], '2026-01-10')
      expect(result).toEqual({ completed: 0, total: 4, percentComplete: 0 })
    })

    it('returns 1 rotation completed after 3 complete entries (3-day plan)', () => {
      const plan = makePlan({ duration: { type: 'rotations', value: 4 } })
      const entries = [
        completeEntry('2026-01-01'),
        completeEntry('2026-01-02'),
        completeEntry('2026-01-03'),
      ]
      const result = computePlanProgress(plan, entries, '2026-01-05')
      expect(result.completed).toBe(1)
      expect(result.total).toBe(4)
      expect(result.percentComplete).toBe(25)
    })

    it('counts 2 rotations after 6 entries', () => {
      const plan = makePlan({ duration: { type: 'rotations', value: 4 } })
      const entries = Array.from({ length: 6 }, (_, i) =>
        completeEntry(`2026-01-0${i + 1}`),
      )
      const result = computePlanProgress(plan, entries, '2026-01-10')
      expect(result.completed).toBe(2)
      expect(result.percentComplete).toBe(50)
    })

    it('counts 4 rotations (100%) after 12 complete entries', () => {
      const plan = makePlan({ duration: { type: 'rotations', value: 4 } })
      const entries = Array.from({ length: 12 }, (_, i) =>
        completeEntry(`2026-01-${String(i + 1).padStart(2, '0')}`),
      )
      const result = computePlanProgress(plan, entries, '2026-01-20')
      expect(result.completed).toBe(4)
      expect(result.percentComplete).toBe(100)
    })

    it('counts skip entries toward rotation completion', () => {
      const plan = makePlan({ duration: { type: 'rotations', value: 2 } })
      const entries: HistoryEntry[] = [
        { ...completeEntry('2026-01-01'), action: 'skip' },
        completeEntry('2026-01-02'),
        completeEntry('2026-01-03'),
      ]
      const result = computePlanProgress(plan, entries, '2026-01-05')
      expect(result.completed).toBe(1)
    })

    it('does NOT count day_off entries toward rotation completion', () => {
      const plan = makePlan({ duration: { type: 'rotations', value: 2 } })
      const entries: HistoryEntry[] = [
        { id: 'e-d', planId: 'plan-1', calendarDate: '2026-01-01', action: 'day_off', createdAt: '2026-01-01T12:00:00Z' },
        completeEntry('2026-01-02'),
        completeEntry('2026-01-03'),
      ]
      // 2 complete/skip out of 3 needed → 0 full rotations
      const result = computePlanProgress(plan, entries, '2026-01-05')
      expect(result.completed).toBe(0)
    })

    it('caps completed at total when more entries exist than plan requires', () => {
      const plan = makePlan({ duration: { type: 'rotations', value: 2 } })
      const entries = Array.from({ length: 12 }, (_, i) =>
        completeEntry(`2026-01-${String(i + 1).padStart(2, '0')}`),
      )
      const result = computePlanProgress(plan, entries, '2026-01-20')
      expect(result.completed).toBe(2) // capped at total
      expect(result.percentComplete).toBe(100)
    })

    it('only counts entries for this plan (ignores other plans)', () => {
      const plan = makePlan({ duration: { type: 'rotations', value: 4 } })
      const entries = [
        completeEntry('2026-01-01', 'plan-1'),
        completeEntry('2026-01-02', 'plan-1'),
        completeEntry('2026-01-03', 'plan-1'),
        completeEntry('2026-01-01', 'plan-2'), // different plan — should not count
      ]
      const result = computePlanProgress(plan, entries, '2026-01-10')
      expect(result.completed).toBe(1)
    })

    it('returns zeros for a plan with 0 days', () => {
      const plan = makePlan({ days: [], duration: { type: 'rotations', value: 4 } })
      const result = computePlanProgress(plan, [], '2026-01-10')
      expect(result).toEqual({ completed: 0, total: 4, percentComplete: 0 })
    })

    it('returns zeros when duration.value is 0 (guard: total <= 0)', () => {
      const plan = makePlan({ duration: { type: 'rotations', value: 0 } })
      const result = computePlanProgress(plan, [], '2026-01-10')
      expect(result).toEqual({ completed: 0, total: 0, percentComplete: 0 })
    })
  })

  describe('weeks-based plans', () => {
    it('returns 0 completed on the start date (0 weeks elapsed)', () => {
      const plan = makePlan({ duration: { type: 'weeks', value: 8 }, startDate: '2026-01-01' })
      const result = computePlanProgress(plan, [], '2026-01-01')
      expect(result.completed).toBe(0)
      expect(result.total).toBe(8)
      expect(result.percentComplete).toBe(0)
    })

    it('returns 1 week completed after 7 days', () => {
      const plan = makePlan({ duration: { type: 'weeks', value: 8 }, startDate: '2026-01-01' })
      const result = computePlanProgress(plan, [], '2026-01-08')
      expect(result.completed).toBe(1)
      expect(result.percentComplete).toBe(13) // round(1/8*100) = 13
    })

    it('returns 4 weeks completed after 28 days (exactly half of 8-week plan)', () => {
      const plan = makePlan({ duration: { type: 'weeks', value: 8 }, startDate: '2026-01-01' })
      const result = computePlanProgress(plan, [], '2026-01-29')
      expect(result.completed).toBe(4)
      expect(result.percentComplete).toBe(50)
    })

    it('caps at 100% after plan duration is exceeded', () => {
      const plan = makePlan({ duration: { type: 'weeks', value: 4 }, startDate: '2026-01-01' })
      // 40 days past start >> 4 weeks
      const result = computePlanProgress(plan, [], '2026-02-10')
      expect(result.completed).toBe(4)
      expect(result.percentComplete).toBe(100)
    })

    it('ignores history entries (weeks progress is calendar-only)', () => {
      const plan = makePlan({ duration: { type: 'weeks', value: 8 }, startDate: '2026-01-01' })
      // Entries should not affect weeks-based progress
      const entries = Array.from({ length: 20 }, (_, i) =>
        completeEntry(`2026-01-${String(i + 1).padStart(2, '0')}`),
      )
      const result = computePlanProgress(plan, entries, '2026-01-08')
      expect(result.completed).toBe(1) // only 1 week has elapsed
    })

    it('handles a date before startDate gracefully (returns 0)', () => {
      const plan = makePlan({ duration: { type: 'weeks', value: 8 }, startDate: '2026-06-01' })
      const result = computePlanProgress(plan, [], '2026-01-01')
      expect(result.completed).toBe(0)
      expect(result.percentComplete).toBe(0)
    })
  })
})
