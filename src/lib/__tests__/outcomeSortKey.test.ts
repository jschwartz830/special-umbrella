import { describe, it, expect } from 'vitest'
import { outcomeSortKey } from '../outcomeSortKey'
import type { WorkoutOutcome } from '../../modules/workout-outcomes/types'

function makeOutcome(
  instanceId: string,
  completedAt?: string | null,
): WorkoutOutcome {
  return {
    workoutInstanceId: instanceId,
    completionState: 'completed',
    completedAt: completedAt ?? null,
  }
}

describe('outcomeSortKey', () => {
  it('primary key is completedAt when present, with instanceId tiebreaker', () => {
    const outcome = makeOutcome('plan-1_2026-01-01', '2026-01-01T14:30:00Z')
    expect(outcomeSortKey(outcome)).toBe('2026-01-01T14:30:00Z\x00plan-1_2026-01-01')
  })

  it('falls back to calendarDate when completedAt is null, with instanceId tiebreaker', () => {
    const outcome = makeOutcome('plan-1_2026-06-15', null)
    expect(outcomeSortKey(outcome)).toBe('2026-06-15\x00plan-1_2026-06-15')
  })

  it('falls back to calendarDate when completedAt is undefined', () => {
    const outcome: WorkoutOutcome = {
      workoutInstanceId: 'plan-abc_2026-03-22',
      completionState: 'completed',
    }
    expect(outcomeSortKey(outcome)).toBe('2026-03-22\x00plan-abc_2026-03-22')
  })

  it('sorts before all dated outcomes when instanceId contains no recognisable date', () => {
    const undated = makeOutcome('no-date-here', null)
    const dated = makeOutcome('plan-1_2026-01-01', null)
    // '\x00...' (no date prefix) sorts before any YYYY-MM-DD-bearing key
    expect(outcomeSortKey(undated) < outcomeSortKey(dated)).toBe(true)
  })

  it('completedAt sorts later than calendarDate for the same date', () => {
    const withTime = makeOutcome('plan-1_2026-01-01', '2026-01-01T18:00:00Z')
    const withDateOnly = makeOutcome('plan-1_2026-01-01', null)
    // ISO datetime string > date-only string lexicographically because 'T' > '' in the suffix
    expect(outcomeSortKey(withTime) > outcomeSortKey(withDateOnly)).toBe(true)
  })

  it('two outcomes with completedAt can be sorted chronologically', () => {
    const earlier = makeOutcome('plan-1_2026-01-01', '2026-01-01T08:00:00Z')
    const later = makeOutcome('plan-1_2026-01-01', '2026-01-01T20:00:00Z')
    expect(outcomeSortKey(earlier) < outcomeSortKey(later)).toBe(true)
  })

  it('two outcomes with only calendarDates can be sorted chronologically', () => {
    const older = makeOutcome('plan-1_2026-01-01', null)
    const newer = makeOutcome('plan-1_2026-06-15', null)
    expect(outcomeSortKey(older) < outcomeSortKey(newer)).toBe(true)
  })

  it('handles extra-workout instanceId (contains _extra_ segment)', () => {
    // makeExtraWorkoutInstanceId produces: "planId_calendarDate_extra_extraId"
    const outcome = makeOutcome('plan-1_2026-04-10_extra_abc123', null)
    expect(outcomeSortKey(outcome)).toBe('2026-04-10\x00plan-1_2026-04-10_extra_abc123')
  })

  it('handles planId with underscores without extracting wrong date', () => {
    // planId "my_plan_v2" — the date must still be identified correctly
    const outcome = makeOutcome('my_plan_v2_2026-07-04', null)
    expect(outcomeSortKey(outcome)).toBe('2026-07-04\x00my_plan_v2_2026-07-04')
  })

  it('two outcomes with the same completedAt second sort deterministically by instanceId', () => {
    const a = makeOutcome('plan-aaa_2026-01-01', '2026-01-01T14:30:00Z')
    const b = makeOutcome('plan-bbb_2026-01-01', '2026-01-01T14:30:00Z')
    const keyA = outcomeSortKey(a)
    const keyB = outcomeSortKey(b)
    // Keys must be different — no longer a tie
    expect(keyA).not.toBe(keyB)
    // And the function is pure — same inputs always produce the same key
    expect(outcomeSortKey(a)).toBe(keyA)
    expect(outcomeSortKey(b)).toBe(keyB)
  })

  it('two outcomes with no completedAt and the same date sort deterministically by instanceId', () => {
    const a = makeOutcome('plan-alpha_2026-05-01', null)
    const b = makeOutcome('plan-beta_2026-05-01', null)
    expect(outcomeSortKey(a)).not.toBe(outcomeSortKey(b))
    expect(outcomeSortKey(a)).toBe(outcomeSortKey(a))
  })
})
