import { describe, it, expect } from 'vitest'
import { computeHistoryStats, computePlanProgress, computeWorkoutTypeBreakdown, countPastUnloggedDays } from '../historyStats'
import type { HistoryEntry, ExtraWorkoutEntry, Plan, WorkoutOutcome } from '../../types'

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

// ── computeWorkoutTypeBreakdown ───────────────────────────────────────────────

function makeEntry(
  date: string,
  action: HistoryEntry['action'],
  planDayIndex: number | undefined = 0,
  planId = 'plan-1',
): HistoryEntry {
  return {
    id: `${planId}_${date}`,
    planId,
    calendarDate: date,
    planDayIndex: action === 'day_off' ? undefined : planDayIndex,
    action,
    createdAt: `${date}T12:00:00Z`,
  }
}

function makeExtra(
  date: string,
  type: 'yoga' | 'swim' | 'recovery_run' = 'yoga',
  id = `extra_${date}`,
  planId = 'plan-1',
): ExtraWorkoutEntry {
  return {
    id,
    planId,
    calendarDate: date,
    workoutType: type,
    workoutName: type,
    createdAt: `${date}T12:30:00Z`,
  }
}

function makeOutcome(
  instanceId: string,
  effort: number | null = null,
): WorkoutOutcome {
  return {
    workoutInstanceId: instanceId,
    completionState: 'completed',
    perceivedEffort: effort as WorkoutOutcome['perceivedEffort'],
  }
}

// planDaysById maps planDayIndex → { slots: [{ type }] }
function daysMap(
  entries: Array<{ index: number; type: 'weightlifting' | 'long_run' | 'yoga' | 'rest' }>,
): Map<number, { slots: Array<{ type: 'weightlifting' | 'long_run' | 'yoga' | 'rest' }> }> {
  const m = new Map<number, { slots: Array<{ type: 'weightlifting' | 'long_run' | 'yoga' | 'rest' }> }>()
  for (const { index, type } of entries) {
    m.set(index, { slots: [{ type }] })
  }
  return m
}

describe('computeWorkoutTypeBreakdown', () => {
  it('returns empty object for empty inputs', () => {
    const result = computeWorkoutTypeBreakdown([], [], {}, null)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('counts completed rotation entries by type', () => {
    const entries = [
      makeEntry('2026-04-01', 'complete', 0),
      makeEntry('2026-04-02', 'complete', 0),
      makeEntry('2026-04-03', 'complete', 1),
    ]
    const days = daysMap([{ index: 0, type: 'weightlifting' }, { index: 1, type: 'yoga' }])
    const result = computeWorkoutTypeBreakdown(entries, [], {}, days)
    expect(result.weightlifting?.completed).toBe(2)
    expect(result.yoga?.completed).toBe(1)
  })

  it('counts skipped rotation entries separately from completed', () => {
    const entries = [
      makeEntry('2026-04-01', 'complete', 0),
      makeEntry('2026-04-02', 'skip', 0),
    ]
    const days = daysMap([{ index: 0, type: 'weightlifting' }])
    const result = computeWorkoutTypeBreakdown(entries, [], {}, days)
    expect(result.weightlifting?.completed).toBe(1)
    expect(result.weightlifting?.skipped).toBe(1)
  })

  it('excludes day_off entries (no specific workout type)', () => {
    const entries = [makeEntry('2026-04-01', 'day_off', undefined)]
    const days = daysMap([{ index: 0, type: 'weightlifting' }])
    const result = computeWorkoutTypeBreakdown(entries, [], {}, days)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('skips rotation entries when planDaysById is null', () => {
    const entries = [makeEntry('2026-04-01', 'complete', 0)]
    const result = computeWorkoutTypeBreakdown(entries, [], {}, null)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('skips rotation entries whose planDayIndex is not in the map', () => {
    const entries = [makeEntry('2026-04-01', 'complete', 5)]
    const days = daysMap([{ index: 0, type: 'weightlifting' }]) // index 5 not present
    const result = computeWorkoutTypeBreakdown(entries, [], {}, days)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('counts all extras as completed using their workoutType', () => {
    const extras = [makeExtra('2026-04-01', 'yoga'), makeExtra('2026-04-02', 'swim')]
    const result = computeWorkoutTypeBreakdown([], extras, {}, null)
    expect(result.yoga?.completed).toBe(1)
    expect(result.swim?.completed).toBe(1)
  })

  it('accumulates extras and rotation entries for the same type', () => {
    const entries = [makeEntry('2026-04-01', 'complete', 0)]
    const extras = [makeExtra('2026-04-02', 'yoga')]
    const days = daysMap([{ index: 0, type: 'yoga' }])
    const result = computeWorkoutTypeBreakdown(entries, extras, {}, days)
    expect(result.yoga?.completed).toBe(2)
  })

  it('computes avgEffort from outcomes (rotation entries)', () => {
    const entries = [
      makeEntry('2026-04-01', 'complete', 0),
      makeEntry('2026-04-02', 'complete', 0),
    ]
    const days = daysMap([{ index: 0, type: 'weightlifting' }])
    const outcomes: Record<string, WorkoutOutcome> = {
      'plan-1_2026-04-01': makeOutcome('plan-1_2026-04-01', 3),
      'plan-1_2026-04-02': makeOutcome('plan-1_2026-04-02', 5),
    }
    const result = computeWorkoutTypeBreakdown(entries, [], outcomes, days)
    // avgEffort = (3 + 5) / 2 = 4
    expect(result.weightlifting?.avgEffort).toBe(4)
  })

  it('computes avgEffort from outcomes (extras)', () => {
    const extras = [makeExtra('2026-04-01', 'yoga', 'x1')]
    const outcomes: Record<string, WorkoutOutcome> = {
      'plan-1_2026-04-01_extra_x1': makeOutcome('plan-1_2026-04-01_extra_x1', 2),
    }
    const result = computeWorkoutTypeBreakdown([], extras, outcomes, null)
    expect(result.yoga?.avgEffort).toBe(2)
  })

  it('returns avgEffort=null when no outcomes have effort data', () => {
    const entries = [makeEntry('2026-04-01', 'complete', 0)]
    const days = daysMap([{ index: 0, type: 'weightlifting' }])
    const result = computeWorkoutTypeBreakdown(entries, [], {}, days)
    expect(result.weightlifting?.avgEffort).toBeNull()
  })

  it('rounds avgEffort to 1 decimal place', () => {
    const entries = [
      makeEntry('2026-04-01', 'complete', 0),
      makeEntry('2026-04-02', 'complete', 0),
      makeEntry('2026-04-03', 'complete', 0),
    ]
    const days = daysMap([{ index: 0, type: 'long_run' }])
    const outcomes: Record<string, WorkoutOutcome> = {
      'plan-1_2026-04-01': makeOutcome('plan-1_2026-04-01', 2),
      'plan-1_2026-04-02': makeOutcome('plan-1_2026-04-02', 3),
      'plan-1_2026-04-03': makeOutcome('plan-1_2026-04-03', 4),
    }
    const result = computeWorkoutTypeBreakdown(entries, [], outcomes, days)
    // (2 + 3 + 4) / 3 = 3.0
    expect(result.long_run?.avgEffort).toBe(3)
  })

  it('filters by dateRange (inclusive)', () => {
    const entries = [
      makeEntry('2026-04-01', 'complete', 0), // outside
      makeEntry('2026-04-05', 'complete', 0), // inside
      makeEntry('2026-04-10', 'complete', 0), // inside
      makeEntry('2026-04-15', 'complete', 0), // outside
    ]
    const days = daysMap([{ index: 0, type: 'weightlifting' }])
    const result = computeWorkoutTypeBreakdown(
      entries, [], {}, days, { from: '2026-04-05', to: '2026-04-10' },
    )
    expect(result.weightlifting?.completed).toBe(2)
  })

  it('filters extras by dateRange', () => {
    const extras = [
      makeExtra('2026-04-01', 'yoga', 'x1'),
      makeExtra('2026-04-06', 'yoga', 'x2'),
    ]
    const result = computeWorkoutTypeBreakdown(
      [], extras, {}, null, { from: '2026-04-05', to: '2026-04-10' },
    )
    expect(result.yoga?.completed).toBe(1)
  })
})

// ── countPastUnloggedDays ─────────────────────────────────────────────────────

describe('countPastUnloggedDays', () => {
  const TODAY = '2026-04-28'
  const START = '2026-04-01'

  it('returns 0 when there are no past days (plan just started today)', () => {
    expect(countPastUnloggedDays('p1', [], TODAY, TODAY)).toBe(0)
  })

  it('returns 0 when all days in window are logged', () => {
    const entries = [
      entry('2026-04-27', 'complete'),
      entry('2026-04-26', 'skip'),
      entry('2026-04-25', 'day_off'),
      entry('2026-04-24', 'complete'),
      entry('2026-04-23', 'complete'),
      entry('2026-04-22', 'complete'),
      entry('2026-04-21', 'complete'),
    ]
    expect(countPastUnloggedDays('plan-1', entries, START, TODAY)).toBe(0)
  })

  it('returns full window count when nothing is logged', () => {
    expect(countPastUnloggedDays('plan-1', [], START, TODAY)).toBe(7)
  })

  it('returns count of gaps within the window', () => {
    const entries = [
      entry('2026-04-27', 'complete'),
      // 26 missing
      entry('2026-04-25', 'complete'),
      // 24 missing
      entry('2026-04-23', 'complete'),
      entry('2026-04-22', 'complete'),
      entry('2026-04-21', 'complete'),
    ]
    expect(countPastUnloggedDays('plan-1', entries, START, TODAY)).toBe(2)
  })

  it('clamps to plan start date and does not count pre-plan days', () => {
    // Plan started 3 days ago — only 3 days in range, 2 unlogged
    const planStart = '2026-04-25'
    const entries = [entry('2026-04-27', 'complete')]
    expect(countPastUnloggedDays('plan-1', entries, planStart, TODAY)).toBe(2)
  })

  it('returns 0 when lookbackDays is 0', () => {
    expect(countPastUnloggedDays('plan-1', [], START, TODAY, 0)).toBe(0)
  })

  it('respects a custom lookback window (3 days)', () => {
    // Only checks 27, 26, 25; 27 is logged, 26 and 25 are not
    const entries = [entry('2026-04-27', 'complete')]
    expect(countPastUnloggedDays('plan-1', entries, START, TODAY, 3)).toBe(2)
  })

  it('ignores entries for a different plan', () => {
    const entries = [
      entry('2026-04-27', 'complete', 'other-plan'),
      entry('2026-04-26', 'complete', 'other-plan'),
    ]
    // All 7 days unlogged for plan-1
    expect(countPastUnloggedDays('plan-1', entries, START, TODAY)).toBe(7)
  })

  it('treats day_off and skip as logged (not unlogged)', () => {
    const entries = [
      entry('2026-04-27', 'day_off'),
      entry('2026-04-26', 'skip'),
    ]
    expect(countPastUnloggedDays('plan-1', entries, START, TODAY)).toBe(5)
  })
})
