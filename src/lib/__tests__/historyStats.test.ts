import { describe, it, expect } from 'vitest'
import { computeHistoryStats, computePlanProgress, computeWorkoutTypeBreakdown, countPastUnloggedDays, computeRotationCycleProgress, countPlanDayCompletions, computePersonalRecords, computePlanStreak } from '../historyStats'
import type { HistoryEntry, ExtraWorkoutEntry, Plan, WorkoutOutcome } from '../../types'
import type { ExerciseSessionRecord } from '../../store/exerciseHistoryStore'

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
      longestStreak: 0,
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

  // ── longestStreak ──────────────────────────────────────────────────────────

  it('longestStreak equals currentStreak when there is no prior run', () => {
    const entries = [
      entry('2026-04-15', 'complete'),
      entry('2026-04-16', 'complete'),
      entry('2026-04-17', 'complete'),
    ]
    const s = computeHistoryStats(entries, [], '2026-04-17')
    expect(s.longestStreak).toBe(3)
    expect(s.currentStreak).toBe(3)
  })

  it('longestStreak captures an older run longer than the current one', () => {
    const entries = [
      // old 5-day run
      entry('2026-03-10', 'complete'),
      entry('2026-03-11', 'complete'),
      entry('2026-03-12', 'complete'),
      entry('2026-03-13', 'complete'),
      entry('2026-03-14', 'complete'),
      // gap on 2026-03-15
      // current 2-day run
      entry('2026-04-16', 'complete'),
      entry('2026-04-17', 'complete'),
    ]
    const s = computeHistoryStats(entries, [], '2026-04-17')
    expect(s.currentStreak).toBe(2)
    expect(s.longestStreak).toBe(5)
  })

  it('longestStreak is 0 when streakable set is empty', () => {
    const entries = [entry('2026-04-15', 'skip')]
    const s = computeHistoryStats(entries, [], '2026-04-17')
    expect(s.longestStreak).toBe(0)
  })

  it('longestStreak works across a mix of entries and extras', () => {
    const entries = [
      entry('2026-04-10', 'complete'),
      entry('2026-04-11', 'complete'),
    ]
    const extras = [
      extra('2026-04-12'), // extends the run via extra
    ]
    const s = computeHistoryStats(entries, extras, '2026-04-15')
    // 3-day run: 4/10, 4/11, 4/12 — currentStreak is 0 (no activity on 4/15)
    expect(s.longestStreak).toBe(3)
    expect(s.currentStreak).toBe(0)
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

    // ── Week-indicator helpers (TodayPage uses completed+1 as currentWeek) ──

    it('completed+1 === 1 (week 1) on plan start date and through day 6', () => {
      const plan = makePlan({ duration: { type: 'weeks', value: 12 }, startDate: '2026-01-01' })
      // Day 0 (start)
      expect(computePlanProgress(plan, [], '2026-01-01').completed).toBe(0)
      // Day 6 (still in week 1)
      expect(computePlanProgress(plan, [], '2026-01-07').completed).toBe(0)
    })

    it('completed+1 === 2 (week 2) from day 7 through day 13', () => {
      const plan = makePlan({ duration: { type: 'weeks', value: 12 }, startDate: '2026-01-01' })
      // Day 7 — first day of week 2
      expect(computePlanProgress(plan, [], '2026-01-08').completed).toBe(1)
      // Day 13 — last day of week 2
      expect(computePlanProgress(plan, [], '2026-01-14').completed).toBe(1)
    })

    it('identifies last week: completed === total-1 when one full week remains', () => {
      // 4-week plan: last week is week 4 (completed=3)
      const plan = makePlan({ duration: { type: 'weeks', value: 4 }, startDate: '2026-01-01' })
      // 21 days elapsed = 3 full weeks completed → in last (4th) week
      const result = computePlanProgress(plan, [], '2026-01-22')
      expect(result.completed).toBe(3)
      expect(result.total).toBe(4)
      // TodayPage condition: completed + 1 === total → show "last week!"
      expect(result.completed + 1).toBe(result.total)
    })

    it('completed >= total when plan is expired (week indicator should be hidden)', () => {
      const plan = makePlan({ duration: { type: 'weeks', value: 4 }, startDate: '2026-01-01' })
      // 28 days exactly = 4 weeks elapsed = expired
      const result = computePlanProgress(plan, [], '2026-01-29')
      expect(result.completed).toBe(4)
      // TodayPage condition: completed < total → false → no week indicator shown
      expect(result.completed < result.total).toBe(false)
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

// ── computeRotationCycleProgress ──────────────────────────────────────────────

describe('computeRotationCycleProgress', () => {
  const THREE_DAY_PLAN = makePlan({ duration: { type: 'rotations', value: 4 } })
  const WEEKS_PLAN = makePlan({ duration: { type: 'weeks', value: 12 } })

  it('returns null for a weeks-duration plan', () => {
    expect(computeRotationCycleProgress(WEEKS_PLAN, [])).toBeNull()
  })

  it('returns null for a plan with no days', () => {
    const emptyPlan = makePlan({ days: [] })
    expect(computeRotationCycleProgress(emptyPlan, [])).toBeNull()
  })

  it('returns doneInCycle=0, remaining=rotationLength for no history', () => {
    const result = computeRotationCycleProgress(THREE_DAY_PLAN, [])
    expect(result).not.toBeNull()
    expect(result!.doneInCycle).toBe(0)
    expect(result!.rotationLength).toBe(3)
    expect(result!.remaining).toBe(3)
    expect(result!.justCompletedRotation).toBe(false)
  })

  it('counts complete and skip entries within current cycle', () => {
    const entries = [
      entry('2026-01-01', 'complete'),
      entry('2026-01-02', 'skip'),
    ]
    const result = computeRotationCycleProgress(THREE_DAY_PLAN, entries)
    expect(result!.doneInCycle).toBe(2)
    expect(result!.remaining).toBe(1)
    expect(result!.justCompletedRotation).toBe(false)
  })

  it('day_off entries do not count toward cycle progress', () => {
    const entries = [
      entry('2026-01-01', 'complete'),
      entry('2026-01-02', 'day_off'),
    ]
    const result = computeRotationCycleProgress(THREE_DAY_PLAN, entries)
    expect(result!.doneInCycle).toBe(1)
    expect(result!.remaining).toBe(2)
  })

  it('resets doneInCycle to 0 after a full rotation, setting justCompletedRotation=true', () => {
    const entries = [
      entry('2026-01-01', 'complete'),
      entry('2026-01-02', 'complete'),
      entry('2026-01-03', 'complete'),
    ]
    const result = computeRotationCycleProgress(THREE_DAY_PLAN, entries)
    expect(result!.doneInCycle).toBe(0)
    expect(result!.remaining).toBe(3)
    expect(result!.justCompletedRotation).toBe(true)
  })

  it('counts into second cycle correctly (4 done in 3-day plan = 1 into second)', () => {
    const entries = [
      entry('2026-01-01', 'complete'),
      entry('2026-01-02', 'complete'),
      entry('2026-01-03', 'complete'),
      entry('2026-01-04', 'complete'),
    ]
    const result = computeRotationCycleProgress(THREE_DAY_PLAN, entries)
    expect(result!.doneInCycle).toBe(1)
    expect(result!.remaining).toBe(2)
    expect(result!.justCompletedRotation).toBe(false)
  })

  it('ignores entries for a different plan', () => {
    const entries = [
      entry('2026-01-01', 'complete', 'other-plan'),
      entry('2026-01-02', 'complete', 'other-plan'),
    ]
    const result = computeRotationCycleProgress(THREE_DAY_PLAN, entries)
    expect(result!.doneInCycle).toBe(0)
    expect(result!.justCompletedRotation).toBe(false)
  })
})

// ── countPlanDayCompletions ───────────────────────────────────────────────────

describe('countPlanDayCompletions', () => {
  it('returns 0 when no entries exist', () => {
    expect(countPlanDayCompletions('plan-1', 0, [])).toBe(0)
  })

  it('counts only complete entries for the given planDayIndex', () => {
    const entries: HistoryEntry[] = [
      entry('2026-01-01', 'complete'),
      entry('2026-01-03', 'complete'),
      entry('2026-01-05', 'skip'),
      entry('2026-01-07', 'day_off'),
    ]
    // Only 2 complete entries with planDayIndex=0 (default in entry helper)
    expect(countPlanDayCompletions('plan-1', 0, entries)).toBe(2)
  })

  it('excludes the given date when excludeDate is provided', () => {
    const entries: HistoryEntry[] = [
      entry('2026-01-01', 'complete'),
      entry('2026-01-03', 'complete'),
    ]
    // Exclude Jan 3 — only Jan 1 counts
    expect(countPlanDayCompletions('plan-1', 0, entries, '2026-01-03')).toBe(1)
  })

  it('ignores entries for a different plan', () => {
    const entries: HistoryEntry[] = [
      entry('2026-01-01', 'complete', 'plan-1'),
      entry('2026-01-02', 'complete', 'plan-2'),
    ]
    expect(countPlanDayCompletions('plan-1', 0, entries)).toBe(1)
  })

  it('ignores entries for a different planDayIndex', () => {
    const entries: HistoryEntry[] = [
      { id: 'a', planId: 'plan-1', calendarDate: '2026-01-01', planDayIndex: 0, action: 'complete', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'b', planId: 'plan-1', calendarDate: '2026-01-02', planDayIndex: 1, action: 'complete', createdAt: '2026-01-02T00:00:00Z' },
    ]
    expect(countPlanDayCompletions('plan-1', 0, entries)).toBe(1)
    expect(countPlanDayCompletions('plan-1', 1, entries)).toBe(1)
  })
})

// ── computePersonalRecords ────────────────────────────────────────────────────

function rec(
  exerciseName: string,
  maxLoad: number | null,
  maxReps: number | null,
  calendarDate = '2026-01-01',
  planId = 'plan-1',
): ExerciseSessionRecord {
  return {
    id: `${planId}_${calendarDate}_${exerciseName}`,
    exerciseName,
    maxLoad,
    maxReps,
    calendarDate,
    planId,
    planName: null,
    workoutName: null,
    workoutInstanceId: `${planId}_${calendarDate}`,
    sets: [],
    totalVolume: null,
    createdAt: `${calendarDate}T12:00:00Z`,
  }
}

describe('computePersonalRecords', () => {
  it('returns empty array for no records', () => {
    expect(computePersonalRecords([], null)).toEqual([])
  })

  it('creates one row per exercise with correct values', () => {
    const records = [
      rec('Squat', 225, 5, '2026-01-01'),
      rec('Bench Press', 185, 8, '2026-01-02'),
    ]
    const result = computePersonalRecords(records, null)
    expect(result).toHaveLength(2)
    // sorted alphabetically
    expect(result[0].exerciseName).toBe('Bench Press')
    expect(result[1].exerciseName).toBe('Squat')
  })

  it('tracks max load across sessions for the same exercise', () => {
    const records = [
      rec('Squat', 185, 5, '2026-01-01'),
      rec('Squat', 225, 3, '2026-01-08'),
      rec('Squat', 205, 4, '2026-01-15'),
    ]
    const result = computePersonalRecords(records, null)
    expect(result).toHaveLength(1)
    expect(result[0].maxLoad).toBe(225)
    expect(result[0].maxLoadDate).toBe('2026-01-08')
    expect(result[0].sessionCount).toBe(3)
  })

  it('tracks max reps independently of max load', () => {
    const records = [
      rec('Pull-up', null, 8, '2026-01-01'),
      rec('Pull-up', null, 12, '2026-01-08'),
    ]
    const result = computePersonalRecords(records, null)
    expect(result[0].maxReps).toBe(12)
    expect(result[0].maxRepsDate).toBe('2026-01-08')
    expect(result[0].maxLoad).toBeNull()
  })

  it('filters by planId when provided', () => {
    const records = [
      rec('Squat', 225, 5, '2026-01-01', 'plan-1'),
      rec('Squat', 275, 3, '2026-01-08', 'plan-2'),
    ]
    const result = computePersonalRecords(records, 'plan-1')
    expect(result).toHaveLength(1)
    expect(result[0].maxLoad).toBe(225)
  })

  it('returns all-time records when planId is null', () => {
    const records = [
      rec('Deadlift', 315, 1, '2026-01-01', 'plan-1'),
      rec('Deadlift', 365, 1, '2026-01-08', 'plan-2'),
    ]
    const result = computePersonalRecords(records, null)
    expect(result[0].maxLoad).toBe(365)
  })

  it('sets maxLoadDate only when maxLoad is non-null', () => {
    const records = [rec('Push-up', null, 20, '2026-01-01')]
    const result = computePersonalRecords(records, null)
    expect(result[0].maxLoad).toBeNull()
    expect(result[0].maxLoadDate).toBeNull()
    expect(result[0].maxReps).toBe(20)
    expect(result[0].maxRepsDate).toBe('2026-01-01')
  })
})

// ── computePlanStreak ──────────────────────────────────────────────────────────

describe('computePlanStreak', () => {
  const TODAY = '2026-05-12'

  function planEntry(
    date: string,
    action: HistoryEntry['action'],
    planId = 'plan-1',
  ): HistoryEntry {
    return {
      id: `pe-${planId}-${date}`,
      planId,
      calendarDate: date,
      planDayIndex: action === 'day_off' ? undefined : 0,
      action,
      createdAt: `${date}T12:00:00Z`,
    }
  }

  function planExtra(date: string, planId = 'plan-1'): ExtraWorkoutEntry {
    return {
      id: `ex-${planId}-${date}`,
      planId,
      calendarDate: date,
      workoutType: 'yoga',
      workoutName: 'Yoga',
      createdAt: `${date}T13:00:00Z`,
    }
  }

  it('returns 0 with no entries at all', () => {
    expect(computePlanStreak('plan-1', [], [], TODAY)).toBe(0)
  })

  it('returns 0 when today has no qualifying entry for this plan', () => {
    const entries = [planEntry('2026-05-11', 'complete')]
    expect(computePlanStreak('plan-1', entries, [], TODAY)).toBe(0)
  })

  it('returns 1 when only today is complete', () => {
    const entries = [planEntry(TODAY, 'complete')]
    expect(computePlanStreak('plan-1', entries, [], TODAY)).toBe(1)
  })

  it('counts consecutive complete days ending today', () => {
    const entries = [
      planEntry('2026-05-10', 'complete'),
      planEntry('2026-05-11', 'complete'),
      planEntry(TODAY, 'complete'),
    ]
    expect(computePlanStreak('plan-1', entries, [], TODAY)).toBe(3)
  })

  it('day_off entries count toward streak', () => {
    const entries = [
      planEntry('2026-05-11', 'day_off'),
      planEntry(TODAY, 'complete'),
    ]
    expect(computePlanStreak('plan-1', entries, [], TODAY)).toBe(2)
  })

  it('skip entries alone do NOT count (break the streak)', () => {
    const entries = [
      planEntry('2026-05-10', 'complete'),
      planEntry('2026-05-11', 'skip'),
      planEntry(TODAY, 'complete'),
    ]
    // May 11 is skip only → streak resets; only today counts
    expect(computePlanStreak('plan-1', entries, [], TODAY)).toBe(1)
  })

  it('a gap day breaks the streak', () => {
    const entries = [
      planEntry('2026-05-09', 'complete'),
      // May 10 missing
      planEntry('2026-05-11', 'complete'),
      planEntry(TODAY, 'complete'),
    ]
    expect(computePlanStreak('plan-1', entries, [], TODAY)).toBe(2)
  })

  it('extras for the same plan count toward streak', () => {
    const extras = [planExtra('2026-05-11'), planExtra(TODAY)]
    expect(computePlanStreak('plan-1', [], extras, TODAY)).toBe(2)
  })

  it('a skip is rescued by an extra on the same day', () => {
    const entries = [planEntry('2026-05-11', 'skip'), planEntry(TODAY, 'complete')]
    const extras = [planExtra('2026-05-11')]
    // May 11: skip + extra → extra makes it streakable
    expect(computePlanStreak('plan-1', entries, extras, TODAY)).toBe(2)
  })

  it('ignores entries and extras for different plans', () => {
    const entries = [
      planEntry('2026-05-11', 'complete', 'plan-2'),
      planEntry(TODAY, 'complete', 'plan-1'),
    ]
    const extras = [planExtra('2026-05-11', 'plan-2')]
    // Only today belongs to plan-1
    expect(computePlanStreak('plan-1', entries, extras, TODAY)).toBe(1)
  })

  it('duplicate-date entries do not double-count (Set deduplication)', () => {
    const entries = [
      planEntry(TODAY, 'complete'),
      { ...planEntry(TODAY, 'day_off'), id: 'pe-dup' },
    ]
    expect(computePlanStreak('plan-1', entries, [], TODAY)).toBe(1)
  })

  it('streak is independent of the global streak (different plan history)', () => {
    // Plan-1 has entries for today only; plan-2 has a long streak.
    // Plan-1 streak should be 1 regardless of plan-2.
    const entries = [
      planEntry(TODAY, 'complete', 'plan-1'),
      planEntry('2026-05-10', 'complete', 'plan-2'),
      planEntry('2026-05-11', 'complete', 'plan-2'),
      planEntry(TODAY, 'complete', 'plan-2'),
    ]
    expect(computePlanStreak('plan-1', entries, [], TODAY)).toBe(1)
    expect(computePlanStreak('plan-2', entries, [], TODAY)).toBe(3)
  })
})
