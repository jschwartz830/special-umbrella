import { describe, it, expect } from 'vitest'
import { computeHistoryStats, computePlanProgress, computeWorkoutTypeBreakdown, countPastUnloggedDays, getUnloggedPastDates, computeRotationCycleProgress, countPlanDayCompletions, computePersonalRecords, computePlanStreak, computeRotationPlanRemaining, computeWeeklyBreakdown, padWeekGaps, isoWeekStart, computeConsecutiveSkips, computeLoggedRate, getStreakDatesSet, computeCurrentStreakDates, findBestWeek } from '../historyStats'
import type { HistoryEntry, ExtraWorkoutEntry, Plan, WorkoutOutcome, WorkoutType } from '../../types'
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

  it('longestStreak excludes future-dated entries (e.g. from a bad CSV import)', () => {
    // A past run of 3 days plus a future-dated entry that would extend the
    // apparent streak if not filtered. longestStreak must remain 3.
    const entries = [
      entry('2026-04-10', 'complete'),
      entry('2026-04-11', 'complete'),
      entry('2026-04-12', 'complete'),
      entry('2026-04-13', 'complete'), // future relative to today=2026-04-12
    ]
    const s = computeHistoryStats(entries, [], '2026-04-12')
    expect(s.longestStreak).toBe(3)
    expect(s.currentStreak).toBe(3)
  })

  // ── totalLogged / totalCompleted future-date filtering ─────────────────────

  it('totalLogged excludes future-dated rotation entries', () => {
    const entries = [
      entry('2026-04-15', 'complete'), // past
      entry('2026-04-17', 'complete'), // today
      entry('2026-04-18', 'complete'), // future
    ]
    const s = computeHistoryStats(entries, [], '2026-04-17')
    expect(s.totalLogged).toBe(2)
    expect(s.totalCompleted).toBe(2)
  })

  it('totalLogged excludes future-dated extra entries', () => {
    const entries: HistoryEntry[] = []
    const extras = [
      extra('2026-04-17'), // today
      extra('2026-04-18'), // future
      extra('2026-04-19'), // future
    ]
    const s = computeHistoryStats(entries, extras, '2026-04-17')
    expect(s.totalLogged).toBe(1)
    expect(s.totalCompleted).toBe(1)
  })

  it('totalCompleted excludes future-dated complete entries', () => {
    const entries = [
      entry('2026-04-16', 'complete'), // past
      entry('2026-04-17', 'skip'),     // today — skip doesn't count as complete
      entry('2026-04-18', 'complete'), // future — must be excluded
    ]
    const s = computeHistoryStats(entries, [], '2026-04-17')
    expect(s.totalLogged).toBe(2)
    expect(s.totalCompleted).toBe(1)
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

    it('excludes future-dated entries (consistent with isPlanExpired)', () => {
      // Only 2 of 3 needed entries fall on or before today; future entry must not count.
      const plan = makePlan({ duration: { type: 'rotations', value: 1 } })
      const entries = [
        completeEntry('2026-01-01'),
        completeEntry('2026-01-02'),
        completeEntry('2099-12-31'), // future — must be excluded
      ]
      const result = computePlanProgress(plan, entries, '2026-01-05')
      expect(result.completed).toBe(0) // 2 of 3 needed — still 0 full rotations
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

    it('deduplicates same-date entries (consistent with isPlanExpired)', () => {
      // Two entries with the same calendarDate should count as ONE completed day,
      // not two. This mirrors the one-advancement-per-date rule in the rotation
      // engine and isPlanExpired's Set-based deduplication.
      const twoDayPlan = makePlan({
        days: [
          { id: 'd0', label: 'Day 1', slots: [{ id: 's0', type: 'weightlifting', name: 'Lift' }] },
          { id: 'd1', label: 'Day 2', slots: [{ id: 's1', type: 'yoga', name: 'Yoga' }] },
        ],
        duration: { type: 'rotations', value: 2 },
      })
      // 4 raw entries, but only 3 unique dates → floor(3 / 2) = 1 rotation, not floor(4 / 2) = 2
      const entries: HistoryEntry[] = [
        { ...completeEntry('2026-01-01'), id: 'e1', createdAt: '2026-01-01T10:00:00Z' },
        { ...completeEntry('2026-01-01'), id: 'e2', createdAt: '2026-01-01T18:00:00Z' }, // duplicate
        completeEntry('2026-01-02'),
        completeEntry('2026-01-03'),
      ]
      const result = computePlanProgress(twoDayPlan, entries, '2026-01-05')
      expect(result.completed).toBe(1)
      expect(result.percentComplete).toBe(50)
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
  type: WorkoutType = 'yoga',
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
  durationMin: number | null = null,
): WorkoutOutcome {
  return {
    workoutInstanceId: instanceId,
    completionState: 'completed',
    perceivedEffort: effort as WorkoutOutcome['perceivedEffort'],
    durationActualMin: durationMin,
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

  it('works with the production "weights" slot type (not just "weightlifting")', () => {
    // HistoryPage builds planDaysById from plan.days which use 'weights' in the UI.
    // Verify the function attributes entries correctly for that real-world type.
    const entries = [
      makeEntry('2026-05-01', 'complete', 0),
      makeEntry('2026-05-02', 'complete', 0),
      makeEntry('2026-05-03', 'skip', 0),
    ]
    const days = new Map<number, { slots: Array<{ type: import('../../types').WorkoutType }> }>([
      [0, { slots: [{ type: 'weights' }] }],
    ])
    const result = computeWorkoutTypeBreakdown(entries, [], {}, days)
    expect(result.weights?.completed).toBe(2)
    expect(result.weights?.skipped).toBe(1)
    expect(result.weights?.avgEffort).toBeNull()
  })

  it('avgEffort is null for skipped-only entries (no outcome data)', () => {
    // Skipped entries are counted but produce no outcome/effort data.
    const entries = [
      makeEntry('2026-05-01', 'skip', 0),
      makeEntry('2026-05-02', 'skip', 0),
    ]
    const days = new Map<number, { slots: Array<{ type: import('../../types').WorkoutType }> }>([
      [0, { slots: [{ type: 'run' }] }],
    ])
    const result = computeWorkoutTypeBreakdown(entries, [], {}, days)
    expect(result.run?.skipped).toBe(2)
    expect(result.run?.completed).toBe(0)
    expect(result.run?.avgEffort).toBeNull()
  })

  it('averages effort across mixed completed rotation entries and extras', () => {
    // Rotation: effort 4; Extra: effort 2. Combined avg = (4+2)/2 = 3.
    const entries = [makeEntry('2026-05-01', 'complete', 0)]
    const extras = [makeExtra('2026-05-02', 'run', 'x1')]
    const outcomes: Record<string, WorkoutOutcome> = {
      'plan-1_2026-05-01': makeOutcome('plan-1_2026-05-01', 4),
      'plan-1_2026-05-02_extra_x1': makeOutcome('plan-1_2026-05-02_extra_x1', 2),
    }
    const days = new Map<number, { slots: Array<{ type: import('../../types').WorkoutType }> }>([
      [0, { slots: [{ type: 'run' }] }],
    ])
    const result = computeWorkoutTypeBreakdown(entries, extras, outcomes, days)
    expect(result.run?.completed).toBe(2) // 1 rotation + 1 extra
    expect(result.run?.avgEffort).toBe(3) // (4+2)/2
  })

  // ── avgDurationMin ──────────────────────────────────────────────────────────

  it('avgDurationMin is null when no outcomes have duration data', () => {
    const entries = [makeEntry('2026-05-01', 'complete', 0)]
    const days = daysMap([{ index: 0, type: 'weightlifting' }])
    const result = computeWorkoutTypeBreakdown(entries, [], {}, days)
    expect(result.weightlifting?.avgDurationMin).toBeNull()
  })

  it('avgDurationMin averages duration from rotation entry outcomes', () => {
    // 40 min + 50 min = average 45 min (rounded)
    const entries = [
      makeEntry('2026-05-01', 'complete', 0),
      makeEntry('2026-05-02', 'complete', 0),
    ]
    const days = daysMap([{ index: 0, type: 'weightlifting' }])
    const outcomes: Record<string, WorkoutOutcome> = {
      'plan-1_2026-05-01': makeOutcome('plan-1_2026-05-01', null, 40),
      'plan-1_2026-05-02': makeOutcome('plan-1_2026-05-02', null, 50),
    }
    const result = computeWorkoutTypeBreakdown(entries, [], outcomes, days)
    expect(result.weightlifting?.avgDurationMin).toBe(45)
  })

  it('avgDurationMin rounds to nearest whole minute', () => {
    // 30 + 35 + 40 = 105 / 3 = 35.0 exactly
    const entries = [
      makeEntry('2026-05-01', 'complete', 0),
      makeEntry('2026-05-02', 'complete', 0),
      makeEntry('2026-05-03', 'complete', 0),
    ]
    const days = daysMap([{ index: 0, type: 'long_run' }])
    const outcomes: Record<string, WorkoutOutcome> = {
      'plan-1_2026-05-01': makeOutcome('plan-1_2026-05-01', null, 30),
      'plan-1_2026-05-02': makeOutcome('plan-1_2026-05-02', null, 35),
      'plan-1_2026-05-03': makeOutcome('plan-1_2026-05-03', null, 40),
    }
    const result = computeWorkoutTypeBreakdown(entries, [], outcomes, days)
    expect(result.long_run?.avgDurationMin).toBe(35)
  })

  it('avgDurationMin includes duration from extra entry outcomes', () => {
    const extras = [makeExtra('2026-05-01', 'yoga', 'x1')]
    const outcomes: Record<string, WorkoutOutcome> = {
      'plan-1_2026-05-01_extra_x1': makeOutcome('plan-1_2026-05-01_extra_x1', null, 60),
    }
    const result = computeWorkoutTypeBreakdown([], extras, outcomes, null)
    expect(result.yoga?.avgDurationMin).toBe(60)
  })

  it('avgDurationMin averages across rotation entries and extras for the same type', () => {
    // Rotation entry: 45 min; Extra: 30 min → avg = 37.5 → rounds to 38
    const entries = [makeEntry('2026-05-01', 'complete', 0)]
    const extras = [makeExtra('2026-05-02', 'run', 'x1')]
    const outcomes: Record<string, WorkoutOutcome> = {
      'plan-1_2026-05-01': makeOutcome('plan-1_2026-05-01', null, 45),
      'plan-1_2026-05-02_extra_x1': makeOutcome('plan-1_2026-05-02_extra_x1', null, 30),
    }
    const days = new Map<number, { slots: Array<{ type: import('../../types').WorkoutType }> }>([
      [0, { slots: [{ type: 'run' }] }],
    ])
    const result = computeWorkoutTypeBreakdown(entries, extras, outcomes, days)
    expect(result.run?.avgDurationMin).toBe(38) // Math.round(37.5)
  })

  it('avgDurationMin ignores entries that have no duration in their outcome', () => {
    // Only one of two outcomes has a duration; avg should reflect just that one.
    const entries = [
      makeEntry('2026-05-01', 'complete', 0),
      makeEntry('2026-05-02', 'complete', 0),
    ]
    const days = daysMap([{ index: 0, type: 'weightlifting' }])
    const outcomes: Record<string, WorkoutOutcome> = {
      'plan-1_2026-05-01': makeOutcome('plan-1_2026-05-01', null, 50),
      'plan-1_2026-05-02': makeOutcome('plan-1_2026-05-02', null, null), // no duration
    }
    const result = computeWorkoutTypeBreakdown(entries, [], outcomes, days)
    expect(result.weightlifting?.avgDurationMin).toBe(50)
  })

  it('avgDurationMin is null for skipped-only entries', () => {
    const entries = [makeEntry('2026-05-01', 'skip', 0)]
    const days = daysMap([{ index: 0, type: 'weightlifting' }])
    const result = computeWorkoutTypeBreakdown(entries, [], {}, days)
    expect(result.weightlifting?.avgDurationMin).toBeNull()
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

  it('excludes future-dated entries when today is provided', () => {
    const entries = [
      entry('2026-01-01', 'complete'),
      entry('2099-06-01', 'complete'), // future — must not count
    ]
    const result = computeRotationCycleProgress(THREE_DAY_PLAN, entries, '2026-01-05')
    expect(result!.doneInCycle).toBe(1)
    expect(result!.remaining).toBe(2)
  })

  it('includes all entries when today is omitted (backward-compatible)', () => {
    const entries = [
      entry('2026-01-01', 'complete'),
      entry('2099-06-01', 'complete'),
    ]
    const result = computeRotationCycleProgress(THREE_DAY_PLAN, entries)
    expect(result!.doneInCycle).toBe(2)
  })

  it('does not double-count duplicate entries for the same calendarDate', () => {
    // Two complete entries on the same date (e.g. from a CSV re-import) must be
    // treated as a single rotation advancement — matching isPlanExpired behaviour.
    const dupEntries: HistoryEntry[] = [
      { id: 'e1', planId: 'plan-1', calendarDate: '2026-01-01', planDayIndex: 0, action: 'complete', createdAt: '2026-01-01T08:00:00Z' },
      { id: 'e2', planId: 'plan-1', calendarDate: '2026-01-01', planDayIndex: 0, action: 'complete', createdAt: '2026-01-01T18:00:00Z' },
      { id: 'e3', planId: 'plan-1', calendarDate: '2026-01-02', planDayIndex: 1, action: 'complete', createdAt: '2026-01-02T12:00:00Z' },
    ]
    // 2 unique dates → doneInCycle = 2 % 3 = 2 (not 3 from three raw entries)
    const result = computeRotationCycleProgress(THREE_DAY_PLAN, dupEntries)
    expect(result!.doneInCycle).toBe(2)
    expect(result!.remaining).toBe(1)
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

  it('shows most-recent date when same max load is matched on a later session', () => {
    // 225 lb is hit on Jan 8, then matched again on Jan 22.
    // maxLoadDate should reflect Jan 22 (most recent match), not Jan 8 (first occurrence).
    const records = [
      rec('Squat', 185, 5, '2026-01-01'),
      rec('Squat', 225, 3, '2026-01-08'),
      rec('Squat', 225, 4, '2026-01-22'),
    ]
    const result = computePersonalRecords(records, null)
    expect(result[0].maxLoad).toBe(225)
    expect(result[0].maxLoadDate).toBe('2026-01-22')
  })

  it('shows most-recent date when same max reps matched on a later session', () => {
    const records = [
      rec('Pull-up', null, 12, '2026-01-01'),
      rec('Pull-up', null, 12, '2026-02-01'),
    ]
    const result = computePersonalRecords(records, null)
    expect(result[0].maxReps).toBe(12)
    expect(result[0].maxRepsDate).toBe('2026-02-01')
  })

  it('result is stable regardless of input record order', () => {
    // Records given in reverse-chronological order — after internal ascending-date sort,
    // the correct PR values and dates should be returned regardless of input order.
    const records = [
      rec('Deadlift', 315, 3, '2026-03-01'),  // middle load, latest date, middle reps
      rec('Deadlift', 365, 1, '2026-01-15'),  // highest load, middle date, lowest reps
      rec('Deadlift', 205, 5, '2026-01-01'),  // lowest load, earliest date, highest reps
    ]
    const result = computePersonalRecords(records, null)
    expect(result[0].maxLoad).toBe(365)
    expect(result[0].maxLoadDate).toBe('2026-01-15')
    expect(result[0].maxReps).toBe(5)
    expect(result[0].maxRepsDate).toBe('2026-01-01')
    expect(result[0].sessionCount).toBe(3)
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

  it('future-dated extras do not extend the streak backward past today', () => {
    // The backward walk starts from today and cannot reach future dates.
    // A future extra should never appear in the streak count.
    const entries = [planEntry(TODAY, 'complete')]
    const extras = [planExtra('2099-01-01')] // far-future extra
    expect(computePlanStreak('plan-1', entries, extras, TODAY)).toBe(1)
  })
})

// ── computeRotationPlanRemaining ──────────────────────────────────────────────

describe('computeRotationPlanRemaining', () => {
  const FOUR_ROTATION_PLAN = makePlan({ duration: { type: 'rotations', value: 4 } })
  // 4 rotations × 3 days = 12 total workouts needed

  it('returns null for a weeks-duration plan', () => {
    const weeksPlan = makePlan({ duration: { type: 'weeks', value: 8 } })
    expect(computeRotationPlanRemaining(weeksPlan, [])).toBeNull()
  })

  it('returns null for a plan with no days', () => {
    const emptyPlan = makePlan({ days: [], duration: { type: 'rotations', value: 4 } })
    expect(computeRotationPlanRemaining(emptyPlan, [])).toBeNull()
  })

  it('returns null when duration.value is 0', () => {
    const zeroPlan = makePlan({ duration: { type: 'rotations', value: 0 } })
    expect(computeRotationPlanRemaining(zeroPlan, [])).toBeNull()
  })

  it('returns totalNeeded when no entries exist', () => {
    // 4 rotations × 3 days = 12
    expect(computeRotationPlanRemaining(FOUR_ROTATION_PLAN, [])).toBe(12)
  })

  it('decrements by each complete entry', () => {
    const entries = [
      completeEntry('2026-01-01'),
      completeEntry('2026-01-02'),
      completeEntry('2026-01-03'),
    ]
    // 12 - 3 = 9
    expect(computeRotationPlanRemaining(FOUR_ROTATION_PLAN, entries)).toBe(9)
  })

  it('counts skip entries the same as complete entries', () => {
    const entries: HistoryEntry[] = [
      completeEntry('2026-01-01'),
      { ...completeEntry('2026-01-02'), action: 'skip' },
    ]
    // 12 - 2 = 10
    expect(computeRotationPlanRemaining(FOUR_ROTATION_PLAN, entries)).toBe(10)
  })

  it('does NOT count day_off entries', () => {
    const entries: HistoryEntry[] = [
      completeEntry('2026-01-01'),
      { id: 'e-d', planId: 'plan-1', calendarDate: '2026-01-02', action: 'day_off', createdAt: '2026-01-02T12:00:00Z' },
    ]
    // 12 - 1 = 11 (day_off excluded)
    expect(computeRotationPlanRemaining(FOUR_ROTATION_PLAN, entries)).toBe(11)
  })

  it('returns 0 once plan is complete (totalDone >= totalNeeded)', () => {
    const entries = Array.from({ length: 12 }, (_, i) =>
      completeEntry(`2026-01-${String(i + 1).padStart(2, '0')}`),
    )
    expect(computeRotationPlanRemaining(FOUR_ROTATION_PLAN, entries)).toBe(0)
  })

  it('returns 0 and does not go negative when over-completed (clamped by Math.max)', () => {
    const entries = Array.from({ length: 15 }, (_, i) =>
      completeEntry(`2026-01-${String(i + 1).padStart(2, '0')}`),
    )
    expect(computeRotationPlanRemaining(FOUR_ROTATION_PLAN, entries)).toBe(0)
  })

  it('ignores entries for a different plan', () => {
    const entries = [
      completeEntry('2026-01-01', 'plan-1'),
      completeEntry('2026-01-02', 'plan-2'), // different plan
    ]
    // Only 1 entry for plan-1; 12 - 1 = 11
    expect(computeRotationPlanRemaining(FOUR_ROTATION_PLAN, entries)).toBe(11)
  })

  it('returns 1 when exactly one workout remains in the final rotation', () => {
    const entries = Array.from({ length: 11 }, (_, i) =>
      completeEntry(`2026-01-${String(i + 1).padStart(2, '0')}`),
    )
    expect(computeRotationPlanRemaining(FOUR_ROTATION_PLAN, entries)).toBe(1)
  })

  it('excludes future-dated entries when today is provided', () => {
    const entries = [
      completeEntry('2026-01-01'),
      completeEntry('2026-01-02'),
      completeEntry('2099-12-31'), // future — must not count
    ]
    // 12 needed - 2 valid = 10
    expect(computeRotationPlanRemaining(FOUR_ROTATION_PLAN, entries, '2026-01-05')).toBe(10)
  })

  it('includes all entries when today is omitted (backward-compatible)', () => {
    const entries = [
      completeEntry('2026-01-01'),
      completeEntry('2099-12-31'),
    ]
    // All 2 entries counted → 12 - 2 = 10
    expect(computeRotationPlanRemaining(FOUR_ROTATION_PLAN, entries)).toBe(10)
  })

  it('does not double-count duplicate entries for the same calendarDate', () => {
    // Two complete entries on the same date (e.g. from a CSV re-import) must be
    // treated as one completed slot — matching isPlanExpired behaviour.
    const entries: HistoryEntry[] = [
      { id: 'e1', planId: 'plan-1', calendarDate: '2026-01-01', planDayIndex: 0, action: 'complete', createdAt: '2026-01-01T08:00:00Z' },
      { id: 'e2', planId: 'plan-1', calendarDate: '2026-01-01', planDayIndex: 0, action: 'complete', createdAt: '2026-01-01T18:00:00Z' },
    ]
    // Only 1 unique date completed out of 12 needed → 11 remaining (not 10)
    expect(computeRotationPlanRemaining(FOUR_ROTATION_PLAN, entries)).toBe(11)
  })
})

// ── computeWeeklyBreakdown ────────────────────────────────────────────────────

function weekEntry(
  date: string,
  action: HistoryEntry['action'],
  planId = 'plan-1',
): HistoryEntry {
  return {
    id: `we-${planId}-${date}`,
    planId,
    calendarDate: date,
    planDayIndex: action === 'day_off' ? undefined : 0,
    action,
    createdAt: `${date}T12:00:00Z`,
  }
}

function weekExtra(date: string, planId = 'plan-1'): ExtraWorkoutEntry {
  return {
    id: `wx-${planId}-${date}`,
    planId,
    calendarDate: date,
    workoutType: 'yoga',
    workoutName: 'Yoga',
    createdAt: `${date}T13:00:00Z`,
  }
}

describe('computeWeeklyBreakdown', () => {
  it('returns empty array when no entries or extras exist', () => {
    const result = computeWeeklyBreakdown('plan-1', [], [], '2026-01-01', '2026-01-31')
    expect(result).toEqual([])
  })

  it('returns empty array when entries exist for a different plan', () => {
    const entries = [weekEntry('2026-01-05', 'complete', 'other-plan')]
    const result = computeWeeklyBreakdown('plan-1', entries, [], '2026-01-01', '2026-01-31')
    expect(result).toEqual([])
  })

  it('groups entries into the correct ISO week (Mon–Sun)', () => {
    // 2026-01-05 is a Monday; 2026-01-11 is a Sunday — same ISO week
    const entries = [
      weekEntry('2026-01-05', 'complete'), // Mon
      weekEntry('2026-01-11', 'complete'), // Sun — same week as Jan 5
    ]
    const result = computeWeeklyBreakdown('plan-1', entries, [], '2026-01-01', '2026-01-31')
    expect(result).toHaveLength(1)
    expect(result[0].weekStart).toBe('2026-01-05')
    expect(result[0].weekEnd).toBe('2026-01-11')
    expect(result[0].completed).toBe(2)
  })

  it('separates entries in adjacent weeks', () => {
    // Jan 5 (Mon) and Jan 12 (Mon) are in different weeks
    const entries = [
      weekEntry('2026-01-05', 'complete'),
      weekEntry('2026-01-12', 'complete'),
    ]
    const result = computeWeeklyBreakdown('plan-1', entries, [], '2026-01-01', '2026-01-31')
    expect(result).toHaveLength(2)
    expect(result[0].weekStart).toBe('2026-01-05')
    expect(result[1].weekStart).toBe('2026-01-12')
  })

  it('counts completed, skipped, and day_off entries separately', () => {
    const entries = [
      weekEntry('2026-01-05', 'complete'),
      weekEntry('2026-01-06', 'skip'),
      weekEntry('2026-01-07', 'day_off'),
    ]
    const result = computeWeeklyBreakdown('plan-1', entries, [], '2026-01-01', '2026-01-31')
    expect(result).toHaveLength(1)
    const week = result[0]
    expect(week.completed).toBe(1)
    expect(week.skipped).toBe(1)
    expect(week.dayOffs).toBe(1)
    expect(week.extras).toBe(0)
    expect(week.totalLogged).toBe(3)
  })

  it('counts extras separately from rotation entries', () => {
    const entries = [weekEntry('2026-01-05', 'complete')]
    const extras = [weekExtra('2026-01-06')]
    const result = computeWeeklyBreakdown('plan-1', entries, extras, '2026-01-01', '2026-01-31')
    expect(result).toHaveLength(1)
    const week = result[0]
    expect(week.completed).toBe(1)
    expect(week.extras).toBe(1)
    expect(week.totalLogged).toBe(2)
  })

  it('assigns a Sunday entry to the Monday-anchored ISO week containing it', () => {
    // 2026-01-04 is a Sunday → its ISO week starts 2025-12-29 (Monday)
    const entries = [weekEntry('2026-01-04', 'complete')]
    const result = computeWeeklyBreakdown('plan-1', entries, [], '2026-01-01', '2026-01-31')
    expect(result).toHaveLength(1)
    expect(result[0].weekStart).toBe('2025-12-29')
    expect(result[0].weekEnd).toBe('2026-01-04')
  })

  it('excludes entries outside the fromDate/toDate range', () => {
    const entries = [
      weekEntry('2026-01-01', 'complete'), // before range
      weekEntry('2026-01-05', 'complete'), // inside range
      weekEntry('2026-01-31', 'complete'), // after range
    ]
    const result = computeWeeklyBreakdown('plan-1', entries, [], '2026-01-04', '2026-01-10')
    expect(result).toHaveLength(1)
    expect(result[0].completed).toBe(1)
  })

  it('excludes extras outside the date range', () => {
    const extras = [
      weekExtra('2026-01-01'), // before
      weekExtra('2026-01-07'), // inside
    ]
    const result = computeWeeklyBreakdown('plan-1', [], extras, '2026-01-05', '2026-01-11')
    expect(result).toHaveLength(1)
    expect(result[0].extras).toBe(1)
  })

  it('returns weeks sorted by weekStart ascending', () => {
    const entries = [
      weekEntry('2026-01-19', 'complete'), // later week first in array
      weekEntry('2026-01-05', 'complete'),
    ]
    const result = computeWeeklyBreakdown('plan-1', entries, [], '2026-01-01', '2026-01-31')
    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result[0].weekStart).toBe('2026-01-05')
    expect(result[result.length - 1].weekStart).toBe('2026-01-19')
  })

  it('does not include weeks with no activity (no empty-week placeholders)', () => {
    // Only week of Jan 5 has activity; weeks of Jan 12 and Jan 19 are silent
    const entries = [weekEntry('2026-01-05', 'complete')]
    const result = computeWeeklyBreakdown('plan-1', entries, [], '2026-01-01', '2026-01-31')
    expect(result).toHaveLength(1)
  })

  it('correctly totals a multi-week plan with mixed action types', () => {
    const entries = [
      weekEntry('2026-01-05', 'complete'),  // week of Jan 5
      weekEntry('2026-01-06', 'skip'),
      weekEntry('2026-01-07', 'day_off'),
      weekEntry('2026-01-12', 'complete'),  // week of Jan 12
      weekEntry('2026-01-14', 'complete'),
    ]
    const extras = [weekExtra('2026-01-13')] // week of Jan 12
    const result = computeWeeklyBreakdown('plan-1', entries, extras, '2026-01-01', '2026-01-31')
    expect(result).toHaveLength(2)

    const w1 = result[0]
    expect(w1.weekStart).toBe('2026-01-05')
    expect(w1.completed).toBe(1)
    expect(w1.skipped).toBe(1)
    expect(w1.dayOffs).toBe(1)
    expect(w1.totalLogged).toBe(3)

    const w2 = result[1]
    expect(w2.weekStart).toBe('2026-01-12')
    expect(w2.completed).toBe(2)
    expect(w2.extras).toBe(1)
    expect(w2.totalLogged).toBe(3)
  })

  it('fromDate and toDate are both inclusive', () => {
    // Range = Jan 5 to Jan 5 (single day)
    const entries = [weekEntry('2026-01-05', 'complete')]
    const result = computeWeeklyBreakdown('plan-1', entries, [], '2026-01-05', '2026-01-05')
    expect(result).toHaveLength(1)
    expect(result[0].completed).toBe(1)
  })

  it('avgEffort is null when no outcomes are passed', () => {
    const entries = [weekEntry('2026-01-05', 'complete')]
    const result = computeWeeklyBreakdown('plan-1', entries, [], '2026-01-01', '2026-01-31')
    expect(result[0].avgEffort).toBeNull()
  })

  it('avgEffort is null when outcomes are passed but none have perceivedEffort', () => {
    const entries = [weekEntry('2026-01-05', 'complete')]
    const outcomes: Record<string, WorkoutOutcome> = {}
    const result = computeWeeklyBreakdown('plan-1', entries, [], '2026-01-01', '2026-01-31', outcomes)
    expect(result[0].avgEffort).toBeNull()
  })

  it('computes avgEffort from completed rotation entries with outcomes', () => {
    const entries = [
      weekEntry('2026-01-05', 'complete'),
      weekEntry('2026-01-06', 'complete'),
    ]
    const outcomes: Record<string, WorkoutOutcome> = {
      'plan-1_2026-01-05': {
        workoutInstanceId: 'plan-1_2026-01-05',
        completionState: 'completed',
        perceivedEffort: 3,
        completedAt: '2026-01-05T12:00:00Z',
        notes: null,
      } as WorkoutOutcome,
      'plan-1_2026-01-06': {
        workoutInstanceId: 'plan-1_2026-01-06',
        completionState: 'completed',
        perceivedEffort: 5,
        completedAt: '2026-01-06T12:00:00Z',
        notes: null,
      } as WorkoutOutcome,
    }
    const result = computeWeeklyBreakdown('plan-1', entries, [], '2026-01-01', '2026-01-31', outcomes)
    expect(result[0].avgEffort).toBe(4) // (3 + 5) / 2
  })

  it('includes extras effort in avgEffort calculation', () => {
    const extras = [weekExtra('2026-01-05')]
    const extraId = extras[0].id
    const outcomes: Record<string, WorkoutOutcome> = {
      [`plan-1_2026-01-05_extra_${extraId}`]: {
        workoutInstanceId: `plan-1_2026-01-05_extra_${extraId}`,
        completionState: 'completed',
        perceivedEffort: 2,
        completedAt: '2026-01-05T12:00:00Z',
        notes: null,
      } as WorkoutOutcome,
    }
    const result = computeWeeklyBreakdown('plan-1', [], extras, '2026-01-01', '2026-01-31', outcomes)
    expect(result[0].avgEffort).toBe(2)
  })

  it('skip entries do not contribute to avgEffort', () => {
    const entries = [
      weekEntry('2026-01-05', 'complete'),
      weekEntry('2026-01-06', 'skip'),
    ]
    const outcomes: Record<string, WorkoutOutcome> = {
      'plan-1_2026-01-05': {
        workoutInstanceId: 'plan-1_2026-01-05',
        completionState: 'completed',
        perceivedEffort: 4,
        completedAt: '2026-01-05T12:00:00Z',
        notes: null,
      } as WorkoutOutcome,
    }
    const result = computeWeeklyBreakdown('plan-1', entries, [], '2026-01-01', '2026-01-31', outcomes)
    // Only the complete entry's effort should count
    expect(result[0].avgEffort).toBe(4)
  })

  it('rounds avgEffort to one decimal place', () => {
    const entries = [
      weekEntry('2026-01-05', 'complete'),
      weekEntry('2026-01-06', 'complete'),
      weekEntry('2026-01-07', 'complete'),
    ]
    const outcomes: Record<string, WorkoutOutcome> = {
      'plan-1_2026-01-05': { workoutInstanceId: 'plan-1_2026-01-05', completionState: 'completed', perceivedEffort: 1, completedAt: '2026-01-05T12:00:00Z', notes: null } as WorkoutOutcome,
      'plan-1_2026-01-06': { workoutInstanceId: 'plan-1_2026-01-06', completionState: 'completed', perceivedEffort: 2, completedAt: '2026-01-06T12:00:00Z', notes: null } as WorkoutOutcome,
      'plan-1_2026-01-07': { workoutInstanceId: 'plan-1_2026-01-07', completionState: 'completed', perceivedEffort: 2, completedAt: '2026-01-07T12:00:00Z', notes: null } as WorkoutOutcome,
    }
    const result = computeWeeklyBreakdown('plan-1', entries, [], '2026-01-01', '2026-01-31', outcomes)
    // (1 + 2 + 2) / 3 = 1.666... → rounds to 1.7
    expect(result[0].avgEffort).toBe(1.7)
  })
})

// ── getUnloggedPastDates ──────────────────────────────────────────────────────

describe('getUnloggedPastDates', () => {
  const planStart = '2026-01-01'

  it('returns newest-first dates that have no entry', () => {
    const entries: HistoryEntry[] = [entry('2026-05-18', 'complete')]
    // today = 2026-05-19, lookback = 3 → checks 18, 17, 16
    // 18 has an entry, 17 and 16 do not
    const result = getUnloggedPastDates('plan-1', entries, planStart, '2026-05-19', 3)
    expect(result).toEqual(['2026-05-17', '2026-05-16'])
  })

  it('returns empty array when all days in window have entries', () => {
    const entries: HistoryEntry[] = [
      entry('2026-05-18', 'complete'),
      entry('2026-05-17', 'skip'),
    ]
    const result = getUnloggedPastDates('plan-1', entries, planStart, '2026-05-19', 2)
    expect(result).toEqual([])
  })

  it('stops at plan start date', () => {
    const entries: HistoryEntry[] = []
    // planStart = 2026-05-18, today = 2026-05-19, lookback = 7
    // Only 2026-05-18 is ≥ planStart
    const result = getUnloggedPastDates('plan-1', entries, '2026-05-18', '2026-05-19', 7)
    expect(result).toEqual(['2026-05-18'])
  })

  it('returns empty when lookbackDays is 0', () => {
    const result = getUnloggedPastDates('plan-1', [], planStart, '2026-05-19', 0)
    expect(result).toEqual([])
  })

  it('does not count entries from a different plan', () => {
    const entries: HistoryEntry[] = [entry('2026-05-18', 'complete', 'other-plan')]
    const result = getUnloggedPastDates('plan-1', entries, planStart, '2026-05-19', 1)
    expect(result).toEqual(['2026-05-18'])
  })

  it('countPastUnloggedDays delegates correctly to getUnloggedPastDates', () => {
    const entries: HistoryEntry[] = [entry('2026-05-18', 'complete')]
    const count = countPastUnloggedDays('plan-1', entries, planStart, '2026-05-19', 3)
    const dates = getUnloggedPastDates('plan-1', entries, planStart, '2026-05-19', 3)
    expect(count).toBe(dates.length)
  })
})

// ── padWeekGaps ───────────────────────────────────────────────────────────────

function makeWeek(weekStart: string, completed = 0): import('../historyStats').WeeklyBreakdown {
  return {
    weekStart,
    weekEnd: (() => {
      const [y, m, d] = weekStart.split('-').map(Number)
      const dt = new Date(Date.UTC(y, m - 1, d + 6))
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
    })(),
    completed,
    skipped: 0,
    dayOffs: 0,
    extras: 0,
    totalLogged: completed,
  }
}

describe('padWeekGaps', () => {
  it('returns input unchanged when fewer than 2 weeks provided', () => {
    expect(padWeekGaps([])).toEqual([])
    const one = [makeWeek('2026-01-05', 3)]
    expect(padWeekGaps(one)).toEqual(one)
  })

  it('returns unchanged array when no gaps exist between consecutive weeks', () => {
    const weeks = [
      makeWeek('2026-01-05', 3),
      makeWeek('2026-01-12', 4),
      makeWeek('2026-01-19', 2),
    ]
    const result = padWeekGaps(weeks)
    expect(result).toHaveLength(3)
    expect(result.every(w => !w.isEmpty)).toBe(true)
  })

  it('inserts empty placeholder rows for missing weeks', () => {
    const weeks = [
      makeWeek('2026-01-05', 3),
      // gap: Jan 12 and Jan 19 missing
      makeWeek('2026-01-26', 2),
    ]
    const result = padWeekGaps(weeks)
    expect(result).toHaveLength(4)
    expect(result[0].weekStart).toBe('2026-01-05')
    expect(result[1].weekStart).toBe('2026-01-12')
    expect(result[1].isEmpty).toBe(true)
    expect(result[1].completed).toBe(0)
    expect(result[2].weekStart).toBe('2026-01-19')
    expect(result[2].isEmpty).toBe(true)
    expect(result[3].weekStart).toBe('2026-01-26')
    expect(result[3].isEmpty).toBeUndefined()
  })

  it('returns rows sorted ascending by weekStart regardless of input order', () => {
    const weeks = [makeWeek('2026-01-26', 2), makeWeek('2026-01-05', 3)]
    const result = padWeekGaps(weeks)
    expect(result[0].weekStart).toBe('2026-01-05')
    expect(result[result.length - 1].weekStart).toBe('2026-01-26')
  })

  it('empty placeholder row has all counts at zero', () => {
    const weeks = [makeWeek('2026-01-05', 3), makeWeek('2026-01-19', 1)]
    const result = padWeekGaps(weeks)
    const gap = result.find(w => w.weekStart === '2026-01-12')!
    expect(gap.completed).toBe(0)
    expect(gap.skipped).toBe(0)
    expect(gap.dayOffs).toBe(0)
    expect(gap.extras).toBe(0)
    expect(gap.totalLogged).toBe(0)
    expect(gap.isEmpty).toBe(true)
  })
})

// ── isoWeekStart ──────────────────────────────────────────────────────────────

describe('isoWeekStart', () => {
  it('returns the date itself for a Monday (identity case)', () => {
    // 2026-01-05 is a Monday
    expect(isoWeekStart('2026-01-05')).toBe('2026-01-05')
  })

  it('returns the preceding Monday for a Wednesday', () => {
    // 2026-01-07 is a Wednesday → Monday is 2026-01-05
    expect(isoWeekStart('2026-01-07')).toBe('2026-01-05')
  })

  it('returns the preceding Monday for a Saturday', () => {
    // 2026-01-10 is a Saturday → Monday is 2026-01-05
    expect(isoWeekStart('2026-01-10')).toBe('2026-01-05')
  })

  it('returns the preceding Monday for a Sunday (ISO: Sunday is end of week)', () => {
    // 2026-01-11 is a Sunday → ISO Monday is 2026-01-05 (same week)
    expect(isoWeekStart('2026-01-11')).toBe('2026-01-05')
  })

  it('crosses a month boundary correctly (Sunday at month end)', () => {
    // 2026-02-01 is a Sunday → the ISO Monday of that week is 2026-01-26
    expect(isoWeekStart('2026-02-01')).toBe('2026-01-26')
  })

  it('crosses a year boundary correctly', () => {
    // 2026-01-01 is a Thursday → Monday is 2025-12-29
    expect(isoWeekStart('2026-01-01')).toBe('2025-12-29')
  })
})

// ── computeConsecutiveSkips ───────────────────────────────────────────────────

function skipEntry(date: string, planId = 'plan-1'): HistoryEntry {
  return {
    id: `skip-${planId}-${date}`,
    planId,
    calendarDate: date,
    planDayIndex: 0,
    action: 'skip',
    createdAt: `${date}T12:00:00Z`,
  }
}

function completeEntryCs(date: string, planId = 'plan-1'): HistoryEntry {
  return {
    id: `cs-${planId}-${date}`,
    planId,
    calendarDate: date,
    planDayIndex: 0,
    action: 'complete',
    createdAt: `${date}T12:00:00Z`,
  }
}

function dayOffEntryCs(date: string, planId = 'plan-1'): HistoryEntry {
  return {
    id: `cs-${planId}-${date}`,
    planId,
    calendarDate: date,
    planDayIndex: undefined,
    action: 'day_off',
    createdAt: `${date}T12:00:00Z`,
  }
}

function csExtra(date: string, planId = 'plan-1'): ExtraWorkoutEntry {
  return {
    id: `csx-${planId}-${date}`,
    planId,
    calendarDate: date,
    workoutType: 'yoga',
    workoutName: 'Yoga',
    createdAt: `${date}T13:00:00Z`,
  }
}

describe('computeConsecutiveSkips', () => {
  const TODAY = '2026-05-10'

  it('returns 0 when there are no entries', () => {
    expect(computeConsecutiveSkips('plan-1', [], [], TODAY)).toBe(0)
  })

  it('returns 0 when yesterday has no entry (gap in history)', () => {
    // 2026-05-08 skip, but 2026-05-09 (yesterday) has no entry — streak is broken
    const entries = [skipEntry('2026-05-08')]
    expect(computeConsecutiveSkips('plan-1', entries, [], TODAY)).toBe(0)
  })

  it('returns 0 when yesterday was completed', () => {
    const entries = [completeEntryCs('2026-05-09')]
    expect(computeConsecutiveSkips('plan-1', entries, [], TODAY)).toBe(0)
  })

  it('returns 0 when yesterday was day_off', () => {
    const entries = [dayOffEntryCs('2026-05-09')]
    expect(computeConsecutiveSkips('plan-1', entries, [], TODAY)).toBe(0)
  })

  it('returns 0 when yesterday has an extra (no rotation entry needed)', () => {
    const extras = [csExtra('2026-05-09')]
    expect(computeConsecutiveSkips('plan-1', [], extras, TODAY)).toBe(0)
  })

  it('returns 1 when only yesterday was skipped', () => {
    const entries = [skipEntry('2026-05-09')]
    expect(computeConsecutiveSkips('plan-1', entries, [], TODAY)).toBe(1)
  })

  it('returns N for N consecutive skips ending yesterday', () => {
    const entries = [
      skipEntry('2026-05-09'),
      skipEntry('2026-05-08'),
      skipEntry('2026-05-07'),
    ]
    expect(computeConsecutiveSkips('plan-1', entries, [], TODAY)).toBe(3)
  })

  it('stops at the first non-skip (complete breaks the streak)', () => {
    const entries = [
      skipEntry('2026-05-09'),
      skipEntry('2026-05-08'),
      completeEntryCs('2026-05-07'), // streak stops here
      skipEntry('2026-05-06'),
    ]
    expect(computeConsecutiveSkips('plan-1', entries, [], TODAY)).toBe(2)
  })

  it('stops at the first non-skip (day_off breaks the streak)', () => {
    const entries = [
      skipEntry('2026-05-09'),
      dayOffEntryCs('2026-05-08'),
    ]
    expect(computeConsecutiveSkips('plan-1', entries, [], TODAY)).toBe(1)
  })

  it('stops when a day has an extra even if it also has a skip entry', () => {
    const entries = [skipEntry('2026-05-09'), skipEntry('2026-05-08')]
    const extras = [csExtra('2026-05-08')] // extra on 2026-05-08 breaks streak
    expect(computeConsecutiveSkips('plan-1', entries, extras, TODAY)).toBe(1)
  })

  it('stops at a gap (day with no entry at all)', () => {
    const entries = [
      skipEntry('2026-05-09'),
      // 2026-05-08 has no entry — streak breaks here
      skipEntry('2026-05-07'),
    ]
    expect(computeConsecutiveSkips('plan-1', entries, [], TODAY)).toBe(1)
  })

  it('does not count entries for a different plan', () => {
    const entries = [
      skipEntry('2026-05-09', 'plan-1'),
      skipEntry('2026-05-08', 'plan-2'), // wrong plan — treated as a gap
    ]
    expect(computeConsecutiveSkips('plan-1', entries, [], TODAY)).toBe(1)
  })

  it('does not include today in the count', () => {
    // Skipping today does not affect the backward scan (starts at yesterday)
    const entries = [
      skipEntry(TODAY, 'plan-1'),   // today — excluded from scan
      skipEntry('2026-05-09'),
      skipEntry('2026-05-08'),
    ]
    expect(computeConsecutiveSkips('plan-1', entries, [], TODAY)).toBe(2)
  })

  it('extras for a different plan do not break the streak', () => {
    const entries = [skipEntry('2026-05-09'), skipEntry('2026-05-08')]
    const extras = [csExtra('2026-05-08', 'plan-2')] // different plan — irrelevant
    expect(computeConsecutiveSkips('plan-1', entries, extras, TODAY)).toBe(2)
  })
})

// ── computeLoggedRate ─────────────────────────────────────────────────────────

describe('computeLoggedRate', () => {
  it('returns null when the plan starts today (no past days)', () => {
    expect(computeLoggedRate('plan-1', [], '2026-06-11', '2026-06-11')).toBeNull()
  })

  it('returns null when the plan starts in the future', () => {
    expect(computeLoggedRate('plan-1', [], '2026-12-01', '2026-06-11')).toBeNull()
  })

  it('returns 0 when the plan started yesterday and nothing was logged', () => {
    expect(computeLoggedRate('plan-1', [], '2026-06-10', '2026-06-11')).toBe(0)
  })

  it('returns 100 when all past days have entries', () => {
    const entries: HistoryEntry[] = [
      entry('2026-06-08', 'complete'),
      entry('2026-06-09', 'complete'),
      entry('2026-06-10', 'complete'),
    ]
    // today = 2026-06-11, startDate = 2026-06-08, activeDays = 3
    expect(computeLoggedRate('plan-1', entries, '2026-06-08', '2026-06-11')).toBe(100)
  })

  it('returns correct percentage for partially-logged plan', () => {
    const entries: HistoryEntry[] = [
      entry('2026-06-08', 'complete'),
      entry('2026-06-10', 'skip'),
    ]
    // 2026-06-08 to 2026-06-10 = 3 active days, 2 logged → 67%
    expect(computeLoggedRate('plan-1', entries, '2026-06-08', '2026-06-11')).toBe(67)
  })

  it('counts any action as logged (skip, day_off, complete)', () => {
    const entries: HistoryEntry[] = [
      entry('2026-06-08', 'skip'),
      entry('2026-06-09', 'day_off'),
    ]
    expect(computeLoggedRate('plan-1', entries, '2026-06-08', '2026-06-11')).toBe(67)
  })

  it('does not count today in the denominator or numerator', () => {
    const entries: HistoryEntry[] = [
      entry('2026-06-10', 'complete'),
      entry('2026-06-11', 'complete'), // today — must be excluded
    ]
    // Only 2026-06-10 counts (1 logged / 1 active day = 100%)
    expect(computeLoggedRate('plan-1', entries, '2026-06-10', '2026-06-11')).toBe(100)
  })

  it('counts duplicate entries for the same date as one logged day', () => {
    const entries: HistoryEntry[] = [
      { ...entry('2026-06-08', 'complete'), id: 'e1', createdAt: '2026-06-08T10:00:00Z' },
      { ...entry('2026-06-08', 'skip'), id: 'e2', createdAt: '2026-06-08T18:00:00Z' },
    ]
    // 1 unique logged day out of 3 active days → 33%
    expect(computeLoggedRate('plan-1', entries, '2026-06-08', '2026-06-11')).toBe(33)
  })

  it('ignores entries for other plans', () => {
    const entries: HistoryEntry[] = [
      entry('2026-06-08', 'complete', 'plan-2'),
    ]
    expect(computeLoggedRate('plan-1', entries, '2026-06-08', '2026-06-11')).toBe(0)
  })

  it('ignores entries before the plan start date', () => {
    const entries: HistoryEntry[] = [
      entry('2026-06-07', 'complete'), // before start
      entry('2026-06-08', 'complete'), // on start date
    ]
    // activeDays = 3 (Jun 8-10), loggedDates = {Jun 8} → 33%
    expect(computeLoggedRate('plan-1', entries, '2026-06-08', '2026-06-11')).toBe(33)
  })

  it('caps at 100 when logged > active days (should not happen in practice)', () => {
    // Defensive: result never exceeds 100
    const entries: HistoryEntry[] = [
      entry('2026-06-08', 'complete'),
      entry('2026-06-09', 'complete'),
      entry('2026-06-10', 'complete'),
    ]
    const result = computeLoggedRate('plan-1', entries, '2026-06-08', '2026-06-11')
    expect(result).not.toBeGreaterThan(100)
  })
})

// ── getStreakDatesSet ─────────────────────────────────────────────────────────

describe('getStreakDatesSet', () => {
  function se(date: string, action: HistoryEntry['action'], planId = 'plan-1'): HistoryEntry {
    return {
      id: `se-${planId}-${date}`,
      planId,
      calendarDate: date,
      planDayIndex: action === 'day_off' ? undefined : 0,
      action,
      createdAt: `${date}T12:00:00Z`,
    }
  }

  function sx(date: string, planId = 'plan-1'): ExtraWorkoutEntry {
    return {
      id: `sx-${planId}-${date}`,
      planId,
      calendarDate: date,
      workoutType: 'yoga',
      workoutName: 'Yoga',
      createdAt: `${date}T13:00:00Z`,
    }
  }

  it('returns empty set for empty inputs', () => {
    expect(getStreakDatesSet([], []).size).toBe(0)
  })

  it('includes dates with complete entries', () => {
    const s = getStreakDatesSet([se('2026-06-10', 'complete')], [])
    expect(s.has('2026-06-10')).toBe(true)
  })

  it('includes dates with day_off entries', () => {
    const s = getStreakDatesSet([se('2026-06-10', 'day_off')], [])
    expect(s.has('2026-06-10')).toBe(true)
  })

  it('does NOT include dates with skip-only entries', () => {
    const s = getStreakDatesSet([se('2026-06-10', 'skip')], [])
    expect(s.has('2026-06-10')).toBe(false)
  })

  it('includes dates with extra entries', () => {
    const s = getStreakDatesSet([], [sx('2026-06-10')])
    expect(s.has('2026-06-10')).toBe(true)
  })

  it('a date with only a skip entry becomes streakable when an extra exists for the same date', () => {
    const s = getStreakDatesSet([se('2026-06-10', 'skip')], [sx('2026-06-10')])
    expect(s.has('2026-06-10')).toBe(true)
  })

  it('without planId filter, includes entries from all plans', () => {
    const entries = [se('2026-06-10', 'complete', 'plan-1'), se('2026-06-11', 'complete', 'plan-2')]
    const s = getStreakDatesSet(entries, [])
    expect(s.has('2026-06-10')).toBe(true)
    expect(s.has('2026-06-11')).toBe(true)
  })

  it('with planId filter, only includes entries for that plan', () => {
    const entries = [se('2026-06-10', 'complete', 'plan-1'), se('2026-06-11', 'complete', 'plan-2')]
    const s = getStreakDatesSet(entries, [], 'plan-1')
    expect(s.has('2026-06-10')).toBe(true)
    expect(s.has('2026-06-11')).toBe(false)
  })

  it('with planId filter, only includes extras for that plan', () => {
    const extras = [sx('2026-06-10', 'plan-1'), sx('2026-06-11', 'plan-2')]
    const s = getStreakDatesSet([], extras, 'plan-2')
    expect(s.has('2026-06-10')).toBe(false)
    expect(s.has('2026-06-11')).toBe(true)
  })

  it('deduplicates same date from multiple entries (Set semantics)', () => {
    const entries = [
      { ...se('2026-06-10', 'complete'), id: 'a' },
      { ...se('2026-06-10', 'day_off'), id: 'b' },
    ]
    const s = getStreakDatesSet(entries, [])
    // Only one entry in the Set for the same date
    expect(s.has('2026-06-10')).toBe(true)
    expect(s.size).toBe(1)
  })

  it('null planId behaves the same as omitting planId (includes all plans)', () => {
    const entries = [se('2026-06-10', 'complete', 'plan-1'), se('2026-06-11', 'complete', 'plan-2')]
    const sNull = getStreakDatesSet(entries, [], null)
    const sOmit = getStreakDatesSet(entries, [])
    expect(sNull.size).toBe(sOmit.size)
    expect([...sNull].sort()).toEqual([...sOmit].sort())
  })

  it('result is consistent with computePlanStreak behavior (same dates included)', () => {
    // Verify the extraction did not change computePlanStreak semantics.
    const TODAY = '2026-06-15'
    const entries = [
      se('2026-06-13', 'complete'),
      se('2026-06-14', 'day_off'),
      se(TODAY, 'complete'),
    ]
    const streakDates = getStreakDatesSet(entries, [], 'plan-1')
    // All three dates should be in the set
    expect(streakDates.has('2026-06-13')).toBe(true)
    expect(streakDates.has('2026-06-14')).toBe(true)
    expect(streakDates.has(TODAY)).toBe(true)
    // And computePlanStreak should walk them correctly → streak of 3
    const streak = computePlanStreak('plan-1', entries, [], TODAY)
    expect(streak).toBe(3)
  })
})

// ── computeCurrentStreakDates ─────────────────────────────────────────────────

describe('computeCurrentStreakDates', () => {
  const TODAY = '2026-06-15'

  function cse(date: string, action: HistoryEntry['action'], planId = 'plan-1'): HistoryEntry {
    return {
      id: `cse-${planId}-${date}`,
      planId,
      calendarDate: date,
      planDayIndex: action === 'day_off' ? undefined : 0,
      action,
      createdAt: `${date}T12:00:00Z`,
    }
  }

  function csx(date: string, planId = 'plan-1'): ExtraWorkoutEntry {
    return {
      id: `csx-${planId}-${date}`,
      planId,
      calendarDate: date,
      workoutType: 'run',
      workoutName: 'Run',
      createdAt: `${date}T13:00:00Z`,
    }
  }

  it('returns empty set when today has no qualifying activity', () => {
    const result = computeCurrentStreakDates([], [], TODAY)
    expect(result.size).toBe(0)
  })

  it('returns a set containing only today when streak is 1', () => {
    const result = computeCurrentStreakDates([cse(TODAY, 'complete')], [], TODAY)
    expect(result.size).toBe(1)
    expect(result.has(TODAY)).toBe(true)
  })

  it('returns all consecutive streak dates back from today', () => {
    const entries = [
      cse('2026-06-13', 'complete'),
      cse('2026-06-14', 'day_off'),
      cse(TODAY, 'complete'),
    ]
    const result = computeCurrentStreakDates(entries, [], TODAY)
    expect(result.size).toBe(3)
    expect(result.has('2026-06-13')).toBe(true)
    expect(result.has('2026-06-14')).toBe(true)
    expect(result.has(TODAY)).toBe(true)
  })

  it('stops at a gap (day with no qualifying entry)', () => {
    // Jun 12 has no entry → gap → streak starts Jun 13
    const entries = [
      cse('2026-06-11', 'complete'),
      // Jun 12: gap
      cse('2026-06-13', 'complete'),
      cse('2026-06-14', 'complete'),
      cse(TODAY, 'complete'),
    ]
    const result = computeCurrentStreakDates(entries, [], TODAY)
    expect(result.size).toBe(3)
    expect(result.has('2026-06-13')).toBe(true)
    expect(result.has('2026-06-14')).toBe(true)
    expect(result.has(TODAY)).toBe(true)
    // Jun 11 is before the gap — not in the current streak
    expect(result.has('2026-06-11')).toBe(false)
  })

  it('streak count equals size of returned set', () => {
    const entries = [
      cse('2026-06-13', 'complete'),
      cse('2026-06-14', 'complete'),
      cse(TODAY, 'complete'),
    ]
    const streakCount = computePlanStreak('plan-1', entries, [], TODAY)
    const streakDates = computeCurrentStreakDates(entries, [], TODAY, 'plan-1')
    expect(streakDates.size).toBe(streakCount)
  })

  it('extras extend the streak into the returned set', () => {
    const extras = [csx('2026-06-14'), csx(TODAY)]
    const result = computeCurrentStreakDates([], extras, TODAY)
    expect(result.has('2026-06-14')).toBe(true)
    expect(result.has(TODAY)).toBe(true)
    expect(result.size).toBe(2)
  })

  it('respects planId scope when provided', () => {
    const entries = [
      cse('2026-06-14', 'complete', 'plan-1'),
      cse(TODAY, 'complete', 'plan-1'),
      cse('2026-06-13', 'complete', 'plan-2'),
      cse('2026-06-14', 'complete', 'plan-2'),
      cse(TODAY, 'complete', 'plan-2'),
    ]
    const plan1Dates = computeCurrentStreakDates(entries, [], TODAY, 'plan-1')
    expect(plan1Dates.size).toBe(2)
    expect(plan1Dates.has('2026-06-13')).toBe(false)

    const plan2Dates = computeCurrentStreakDates(entries, [], TODAY, 'plan-2')
    expect(plan2Dates.size).toBe(3)
    expect(plan2Dates.has('2026-06-13')).toBe(true)
  })

  it('without planId, includes all plans in the streak', () => {
    const entries = [
      cse(TODAY, 'complete', 'plan-1'),
      cse(TODAY, 'complete', 'plan-2'), // same date, different plan — deduped to one date
    ]
    const result = computeCurrentStreakDates(entries, [], TODAY)
    expect(result.size).toBe(1)
    expect(result.has(TODAY)).toBe(true)
  })
})

// ── computeWorkoutTypeBreakdown — multi-slot day (documented limitation) ──────

describe('computeWorkoutTypeBreakdown — multi-slot plan days', () => {
  it('attributes only the first slot type when a plan day has 2 slots', () => {
    // Plan day 0 has a weights slot first and a run slot second.
    // The breakdown should only count the weights type; the run is invisible.
    const entries: HistoryEntry[] = [{
      id: 'e1',
      planId: 'plan-1',
      calendarDate: '2026-05-01',
      planDayIndex: 0,
      action: 'complete',
      createdAt: '2026-05-01T12:00:00Z',
    }]
    const multiSlotDay = new Map<number, { slots: Array<{ type: 'weights' | 'run' }> }>()
    multiSlotDay.set(0, { slots: [{ type: 'weights' }, { type: 'run' }] })

    const result = computeWorkoutTypeBreakdown(entries, [], {}, multiSlotDay as Map<number, { slots: Array<{ type: import('../../types').WorkoutType }> }>)

    // Only weights is credited — this is the documented behavior
    expect(result.weights?.completed).toBe(1)
    // run is not attributed because slots[0] is weights
    expect(result.run).toBeUndefined()
  })
})

// ── findBestWeek ──────────────────────────────────────────────────────────────

function bwEntry(date: string, action: HistoryEntry['action'], planId = 'plan-1'): HistoryEntry {
  return {
    id: `bw-${planId}-${date}-${action}`,
    planId,
    calendarDate: date,
    planDayIndex: action === 'day_off' ? undefined : 0,
    action,
    createdAt: `${date}T12:00:00Z`,
  }
}

function bwExtra(date: string, planId = 'plan-1'): ExtraWorkoutEntry {
  return {
    id: `bwx-${planId}-${date}`,
    planId,
    calendarDate: date,
    workoutType: 'yoga',
    workoutName: 'Yoga',
    createdAt: `${date}T13:00:00Z`,
  }
}

describe('findBestWeek', () => {
  it('returns null when there are no entries or extras', () => {
    expect(findBestWeek('plan-1', [], [])).toBeNull()
  })

  it('returns null when only other plans have entries', () => {
    const entries = [bwEntry('2026-01-05', 'complete', 'plan-2')]
    expect(findBestWeek('plan-1', entries, [])).toBeNull()
  })

  it('returns null when only other plans have extras', () => {
    const extras = [bwExtra('2026-01-05', 'plan-2')]
    expect(findBestWeek('plan-1', [], extras)).toBeNull()
  })

  it('returns the single week when there is only one', () => {
    const entries = [
      bwEntry('2026-01-05', 'complete'),
      bwEntry('2026-01-06', 'complete'),
    ]
    const result = findBestWeek('plan-1', entries, [])
    expect(result).not.toBeNull()
    expect(result!.weekStart).toBe('2026-01-05')
    expect(result!.completed).toBe(2)
  })

  it('returns the week with the most completed rotation entries', () => {
    const entries = [
      bwEntry('2026-01-05', 'complete'), // week of Jan 5: 1 completed
      bwEntry('2026-01-12', 'complete'), // week of Jan 12: 3 completed
      bwEntry('2026-01-13', 'complete'),
      bwEntry('2026-01-14', 'complete'),
    ]
    const result = findBestWeek('plan-1', entries, [])
    expect(result!.weekStart).toBe('2026-01-12')
    expect(result!.completed).toBe(3)
  })

  it('includes extras in the best-week score', () => {
    const entries = [
      bwEntry('2026-01-05', 'complete'),  // week 1: 1 completed
      bwEntry('2026-01-12', 'complete'),  // week 2: 1 completed + 2 extras = 3 active
    ]
    const extras = [bwExtra('2026-01-13'), bwExtra('2026-01-14')]
    const result = findBestWeek('plan-1', entries, extras)
    expect(result!.weekStart).toBe('2026-01-12')
    expect(result!.extras).toBe(2)
    expect(result!.completed).toBe(1)
  })

  it('breaks ties by returning the earliest week', () => {
    // Two weeks tied at 1 active — earlier week wins (reduce keeps first on equality)
    const entries = [
      bwEntry('2026-01-05', 'complete'),
      bwEntry('2026-01-12', 'complete'),
    ]
    const result = findBestWeek('plan-1', entries, [])
    expect(result!.weekStart).toBe('2026-01-05')
  })

  it('ignores skips and day-offs when scoring (only active workouts count)', () => {
    // Week 1 has 2 logged (skip + day_off) but 0 active; week 2 has 1 active
    const entries = [
      bwEntry('2026-01-05', 'skip'),
      bwEntry('2026-01-06', 'day_off'),
      bwEntry('2026-01-12', 'complete'),
    ]
    const result = findBestWeek('plan-1', entries, [])
    expect(result!.weekStart).toBe('2026-01-12')
    expect(result!.completed).toBe(1)
  })

  it('ignores entries for other plans', () => {
    // plan-2 has a big week; plan-1 only has one entry
    const entries = [
      bwEntry('2026-01-05', 'complete', 'plan-1'),
      bwEntry('2026-01-12', 'complete', 'plan-2'),
      bwEntry('2026-01-13', 'complete', 'plan-2'),
      bwEntry('2026-01-14', 'complete', 'plan-2'),
    ]
    const result = findBestWeek('plan-1', entries, [])
    expect(result!.completed).toBe(1) // only plan-1's entry counts
  })

  it('works when the plan only has extras (no rotation entries)', () => {
    const extras = [bwExtra('2026-01-12'), bwExtra('2026-01-13'), bwExtra('2026-01-14')]
    const result = findBestWeek('plan-1', [], extras)
    expect(result).not.toBeNull()
    expect(result!.extras).toBe(3)
    expect(result!.completed).toBe(0)
  })

  it('spans multiple weeks and picks the correct one across year/month boundaries', () => {
    // Cross-month range: Dec and Jan
    const entries = [
      bwEntry('2025-12-29', 'complete'), // week of 2025-12-29 (Mon): 1
      bwEntry('2025-12-30', 'complete'),
      bwEntry('2026-01-05', 'complete'), // week of 2026-01-05 (Mon): 3
      bwEntry('2026-01-06', 'complete'),
      bwEntry('2026-01-07', 'complete'),
    ]
    const result = findBestWeek('plan-1', entries, [])
    expect(result!.weekStart).toBe('2026-01-05')
    expect(result!.completed).toBe(3)
  })
})
