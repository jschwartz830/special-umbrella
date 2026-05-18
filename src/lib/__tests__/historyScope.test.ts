import { describe, expect, it } from 'vitest'
import { getPlansWithHistory, hasPlanHistory } from '../historyScope'
import type { Plan, HistoryEntry, ExtraWorkoutEntry } from '../../types'

function plan(id: string): Plan {
  return {
    id,
    name: `Plan ${id}`,
    status: 'inactive',
    startDate: '2026-01-01',
    startDayIndex: 0,
    duration: { type: 'rotations', value: 1 },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    days: [],
  }
}

function entry(planId: string): HistoryEntry {
  return {
    id: `entry-${planId}`,
    planId,
    calendarDate: '2026-04-10',
    action: 'complete',
    planDayIndex: 0,
    createdAt: '2026-04-10T12:00:00Z',
  }
}

function extra(planId: string): ExtraWorkoutEntry {
  return {
    id: `extra-${planId}`,
    planId,
    calendarDate: '2026-04-10',
    workoutType: 'yoga',
    workoutName: 'Yoga',
    createdAt: '2026-04-10T13:00:00Z',
  }
}

// ── getPlansWithHistory ───────────────────────────────────────────────────────

describe('getPlansWithHistory', () => {
  it('includes plans that have only rotation entries', () => {
    const plans = { p1: plan('p1'), p2: plan('p2') }
    const results = getPlansWithHistory(plans, [entry('p2')], [])
    expect(results.map(p => p.id)).toEqual(['p2'])
  })

  it('includes plans that have only extra entries', () => {
    const plans = { p1: plan('p1'), p2: plan('p2') }
    const results = getPlansWithHistory(plans, [], [extra('p1')])
    expect(results.map(p => p.id)).toEqual(['p1'])
  })

  it('includes a plan that has both entries and extras', () => {
    const plans = { p1: plan('p1') }
    const results = getPlansWithHistory(plans, [entry('p1')], [extra('p1')])
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('p1')
  })

  it('returns empty array when plans dict is empty', () => {
    const results = getPlansWithHistory({}, [entry('p1')], [extra('p1')])
    expect(results).toEqual([])
  })

  it('does not include plans in the dict that have no history', () => {
    const plans = { p1: plan('p1'), p2: plan('p2') }
    const results = getPlansWithHistory(plans, [entry('p1')], [])
    expect(results.map(p => p.id)).not.toContain('p2')
  })

  it('does not include plans referenced only in overrides (not entries or extras)', () => {
    // Overrides are not considered — only entries and extraEntries signal history.
    const plans = { p1: plan('p1') }
    const results = getPlansWithHistory(plans, [], [])
    expect(results).toHaveLength(0)
  })

  it('ignores entries/extras whose planId is not in the plans dict', () => {
    // Orphaned entries (plan deleted but history remains) should not surface phantom plans.
    const plans = { p1: plan('p1') }
    const results = getPlansWithHistory(plans, [entry('deleted-plan')], [])
    expect(results).toHaveLength(0)
  })

  it('includes multiple plans when each has at least one entry', () => {
    const plans = { p1: plan('p1'), p2: plan('p2'), p3: plan('p3') }
    const results = getPlansWithHistory(plans, [entry('p1'), entry('p2')], [])
    expect(results.map(p => p.id).sort()).toEqual(['p1', 'p2'])
  })
})

// ── hasPlanHistory ────────────────────────────────────────────────────────────

describe('hasPlanHistory', () => {
  it('returns true when plan has a rotation entry', () => {
    expect(hasPlanHistory('p1', [entry('p1')], [])).toBe(true)
  })

  it('returns true for extras-only plans', () => {
    expect(hasPlanHistory('p1', [], [extra('p1')])).toBe(true)
  })

  it('returns true when plan has both entries and extras', () => {
    expect(hasPlanHistory('p1', [entry('p1')], [extra('p1')])).toBe(true)
  })

  it('returns false for null planId', () => {
    expect(hasPlanHistory(null, [entry('p1')], [extra('p1')])).toBe(false)
  })

  it('returns false for unknown planId', () => {
    expect(hasPlanHistory('p3', [entry('p1')], [extra('p2')])).toBe(false)
  })

  it('returns false when only entries for other plans exist', () => {
    expect(hasPlanHistory('p2', [entry('p1')], [])).toBe(false)
  })

  it('returns false when only extras for other plans exist', () => {
    expect(hasPlanHistory('p2', [], [extra('p1')])).toBe(false)
  })

  it('returns false with empty entries and extras', () => {
    expect(hasPlanHistory('p1', [], [])).toBe(false)
  })
})
