import { describe, it, expect } from 'vitest'
import { computeHistoryStats } from '../historyStats'
import type { HistoryEntry, ExtraWorkoutEntry } from '../../types'

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
