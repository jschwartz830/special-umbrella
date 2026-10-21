import { describe, it, expect } from 'vitest'
import { workoutSegments, nextSegment, remainingSegments, isSegmentLogged } from '../workoutSegments'
import type { PlanDay, WorkoutSlot } from '../../types'
import type { WorkoutOutcome } from '../../modules/workout-outcomes/types'

const run: WorkoutSlot = { id: 'r', type: 'run', name: 'Easy Run' }
const mobility: WorkoutSlot = {
  id: 'm',
  type: 'mobility',
  name: 'Hip Mobility',
  mobilityExercises: [{ id: 'e1', name: 'Hip flexor stretch', sets: [{ durationSec: 30 }] }],
}
const lifts: WorkoutSlot = {
  id: 'w',
  type: 'weights',
  name: 'Lower',
  exercises: [{ exercise: 'Squat', sets: 3, reps: 5 }],
}
const swim: WorkoutSlot = { id: 's', type: 'swim', name: 'Swim' }

function day(...slots: WorkoutSlot[]): PlanDay {
  return { id: 'd', label: 'Day', slots }
}

function outcome(patch: Partial<WorkoutOutcome> = {}): WorkoutOutcome {
  return { workoutInstanceId: 'p_2026-10-20', completionState: 'completed', ...patch }
}

describe('workoutSegments', () => {
  it('lists trackable segments in slot order', () => {
    expect(workoutSegments(day(run, mobility)).map(s => s.kind)).toEqual(['cardio', 'mobility'])
    expect(workoutSegments(day(lifts, run)).map(s => s.kind)).toEqual(['weights', 'cardio'])
  })

  it('skips slots without a live tracker', () => {
    expect(workoutSegments(day(swim, mobility)).map(s => s.kind)).toEqual(['mobility'])
  })
})

describe('nextSegment', () => {
  it('returns the first segment not yet done', () => {
    expect(nextSegment(day(run, mobility), ['cardio'])?.slot).toBe(mobility)
    expect(nextSegment(day(run, mobility), ['cardio', 'mobility'])).toBeNull()
  })
})

describe('isSegmentLogged', () => {
  it('treats an empty run actual as not logged', () => {
    expect(isSegmentLogged('cardio', outcome({ runActual: { actualDurationMin: null } }))).toBe(false)
    expect(isSegmentLogged('cardio', outcome({ runActual: { actualDurationMin: 30 } }))).toBe(true)
  })

  it('needs a completed mobility set', () => {
    const exercises = [{ exercise: 'x', sets: [{ completed: false }] }]
    expect(isSegmentLogged('mobility', outcome({ mobilityActual: { exercises } }))).toBe(false)
    expect(isSegmentLogged('mobility', outcome({
      mobilityActual: { exercises: [{ exercise: 'x', sets: [{ completed: true }] }] },
    }))).toBe(true)
  })
})

describe('remainingSegments', () => {
  it('returns the mobility segment when only the run was logged', () => {
    const logged = outcome({ runActual: { actualDurationMin: 32 } })
    expect(remainingSegments(day(run, mobility), logged).map(s => s.kind)).toEqual(['mobility'])
  })

  it('is empty for single-segment days and when nothing was logged', () => {
    expect(remainingSegments(day(run), outcome())).toEqual([])
    expect(remainingSegments(day(run, mobility), null)).toEqual([])
  })
})
