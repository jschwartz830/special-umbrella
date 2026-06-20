import { describe, it, expect } from 'vitest'
import { formatWorkoutForClipboard } from '../shareWorkout'
import type { PlanDay } from '../../types'

function makeRestDay(): PlanDay {
  return { id: 'd0', label: 'Rest', slots: [{ id: 's0', type: 'rest', name: 'Rest Day' }] }
}

function makeWeightsDay(): PlanDay {
  return {
    id: 'd1',
    label: 'Push Day',
    slots: [{
      id: 's1',
      type: 'weights',
      name: 'Chest & Shoulders',
      exercises: [
        { exercise: 'Bench Press', sets: 5, reps: 5, load: '185lb' },
        { exercise: 'Overhead Press', sets: 4, reps: 8, load: '115lb' },
        { exercise: 'Push-up', sets: 3, reps: 'max' },
      ],
    }],
  }
}

function makeRunDay(): PlanDay {
  return {
    id: 'd2',
    label: 'Long Run',
    slots: [{
      id: 's2',
      type: 'long_run',
      name: 'Easy Long Run',
      targetDistance: 8,
    }],
  }
}

function makeStructuredRunDay(): PlanDay {
  return {
    id: 'd3',
    label: 'Speed Work',
    slots: [{
      id: 's3',
      type: 'run',
      name: 'Intervals',
      segments: [
        { type: 'warmup', name: 'Warmup', distance: '1mi', pace: 'easy' },
        { type: 'interval', name: 'Fast 800s', reps: 6, distance: '800m', pace: '5K' },
        { type: 'cooldown', name: 'Cooldown', distance: '0.5mi', pace: 'easy' },
      ],
    }],
  }
}

describe('formatWorkoutForClipboard', () => {
  it('includes the day label and date label on the first line', () => {
    const result = formatWorkoutForClipboard(makeRestDay(), 'My Plan', 'Mon, Jun 19')
    expect(result.startsWith('Rest — Mon, Jun 19')).toBe(true)
  })

  it('includes the plan name on the second line', () => {
    const result = formatWorkoutForClipboard(makeRestDay(), 'Marathon Block', 'Jun 19')
    const lines = result.split('\n')
    expect(lines[1]).toBe('Plan: Marathon Block')
  })

  it('includes slot name and type for a rest-day slot', () => {
    const result = formatWorkoutForClipboard(makeRestDay(), 'Plan', 'Jun 19')
    expect(result).toContain('Rest Day (rest)')
  })

  it('formats weight exercises with sets, reps, and load', () => {
    const result = formatWorkoutForClipboard(makeWeightsDay(), 'PPL', 'Jun 19')
    expect(result).toContain('• Bench Press: 5x5 @ 185lb')
    expect(result).toContain('• Overhead Press: 4x8 @ 115lb')
  })

  it('formats weight exercises without load when load is omitted', () => {
    const result = formatWorkoutForClipboard(makeWeightsDay(), 'PPL', 'Jun 19')
    expect(result).toContain('• Push-up: 3xmax')
    expect(result).not.toContain('• Push-up: 3xmax @')
  })

  it('formats a run slot using targetDistance when no segments', () => {
    const result = formatWorkoutForClipboard(makeRunDay(), 'Training', 'Jun 19')
    expect(result).toContain('Easy Long Run (long run)')
    expect(result).toContain('8 mi')
  })

  it('formats structured run segments with name, reps, distance, and pace', () => {
    const result = formatWorkoutForClipboard(makeStructuredRunDay(), 'Training', 'Jun 19')
    expect(result).toContain('• Fast 800s x6 800m @ 5K')
    expect(result).toContain('• Warmup 1mi @ easy')
    expect(result).toContain('• Cooldown 0.5mi @ easy')
  })

  it('handles exercises with SetSpec array (uses array length as set count)', () => {
    const planDay: PlanDay = {
      id: 'd', label: 'Legs', slots: [{
        id: 's', type: 'weights', name: 'Squat',
        exercises: [{
          exercise: 'Back Squat',
          sets: [{ reps: 5, load: '225lb' }, { reps: 3, load: '245lb' }],
          reps: 5,
        }],
      }],
    }
    const result = formatWorkoutForClipboard(planDay, 'Strength', 'Jun 19')
    expect(result).toContain('• Back Squat: 2x5')
  })

  it('includes structureDescription when present on a slot', () => {
    const planDay: PlanDay = {
      id: 'd', label: 'Cardio', slots: [{
        id: 's', type: 'other', name: 'HIIT',
        structureDescription: '4 rounds: 20s on / 10s off',
      }],
    }
    const result = formatWorkoutForClipboard(planDay, 'Cardio Plan', 'Jun 19')
    expect(result).toContain('4 rounds: 20s on / 10s off')
  })

  it('handles a slot with durationMin and no distance', () => {
    const planDay: PlanDay = {
      id: 'd', label: 'Yoga', slots: [{
        id: 's', type: 'yoga', name: 'Flow', durationMin: 45,
      }],
    }
    const result = formatWorkoutForClipboard(planDay, 'Wellness', 'Jun 19')
    expect(result).toContain('45 min')
  })

  it('handles a slot with notes and no other targets', () => {
    const planDay: PlanDay = {
      id: 'd', label: 'Other', slots: [{
        id: 's', type: 'other', name: 'Mobility', notes: 'Focus on hips and ankles',
      }],
    }
    const result = formatWorkoutForClipboard(planDay, 'Plan', 'Jun 19')
    expect(result).toContain('Focus on hips and ankles')
  })

  it('produces stable output — no trailing whitespace on segment lines', () => {
    const result = formatWorkoutForClipboard(makeStructuredRunDay(), 'Plan', 'Jun 19')
    for (const line of result.split('\n')) {
      expect(line).toBe(line.trimEnd())
    }
  })

  it('renders multiple slots in one day', () => {
    const planDay: PlanDay = {
      id: 'd', label: 'AM/PM', slots: [
        { id: 's1', type: 'run', name: 'Morning Run', targetDistance: 5 },
        { id: 's2', type: 'weights', name: 'Evening Lift', exercises: [{ exercise: 'Deadlift', sets: 3, reps: 5 }] },
      ],
    }
    const result = formatWorkoutForClipboard(planDay, 'Double', 'Jun 19')
    expect(result).toContain('Morning Run (run)')
    expect(result).toContain('Evening Lift (weights)')
    expect(result).toContain('• Deadlift: 3x5')
  })
})
