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
  it('returns completedAt when present', () => {
    const outcome = makeOutcome('plan-1_2026-01-01', '2026-01-01T14:30:00Z')
    expect(outcomeSortKey(outcome)).toBe('2026-01-01T14:30:00Z')
  })

  it('falls back to calendarDate extracted from workoutInstanceId when completedAt is null', () => {
    const outcome = makeOutcome('plan-1_2026-06-15', null)
    expect(outcomeSortKey(outcome)).toBe('2026-06-15')
  })

  it('falls back to calendarDate when completedAt is undefined', () => {
    const outcome: WorkoutOutcome = {
      workoutInstanceId: 'plan-abc_2026-03-22',
      completionState: 'completed',
    }
    expect(outcomeSortKey(outcome)).toBe('2026-03-22')
  })

  it('returns empty string when instanceId does not contain a recognisable date', () => {
    const outcome = makeOutcome('no-date-here', null)
    expect(outcomeSortKey(outcome)).toBe('')
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
    expect(outcomeSortKey(outcome)).toBe('2026-04-10')
  })

  it('handles planId with underscores without extracting wrong date', () => {
    // planId "my_plan_v2" — the date must still be identified correctly
    const outcome = makeOutcome('my_plan_v2_2026-07-04', null)
    expect(outcomeSortKey(outcome)).toBe('2026-07-04')
  })
})
