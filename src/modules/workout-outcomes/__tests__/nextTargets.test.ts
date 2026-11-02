import { describe, it, expect } from 'vitest'
import { buildNextTargets, formatNextTarget, type NextTargetInput } from '../nextTargets'
import type { WorkoutSlot } from '../../../types'
import type { LoggedExerciseActual, LoggedSetActual } from '../types'

const ID = 'p_2026-11-02'
const done = (reps: number, load?: number): LoggedSetActual => ({ actualReps: reps, actualLoad: load ?? null, completed: true })

function input(slot: WorkoutSlot, logged: LoggedExerciseActual[], patch: Partial<NextTargetInput> = {}): NextTargetInput {
  return { planId: 'p', workoutInstanceId: ID, slot, logged, varsBefore: {}, varsAfter: {}, ladderStates: {}, ...patch }
}
const lifts = (exercises: WorkoutSlot['exercises'], isDeload = false): WorkoutSlot =>
  ({ id: 's', type: 'weights', name: 'Lift', exercises, ...(isDeload ? { isDeload } : {}) })

describe('buildNextTargets', () => {
  it('program loads: shows the progressed weight and the jump', () => {
    const slot = lifts([{ exercise: 'Squat', sets: 3, reps: 5, load: 'squat', progress: { if: 'all_reps', then: 'squat += 5' } }])
    const [t] = buildNextTargets(input(slot, [{ exercise: 'Squat', sets: [done(5, 150), done(5, 150), done(5, 150)] }],
      { varsBefore: { squat: 150 }, varsAfter: { squat: 155 } }))
    expect(t).toMatchObject({ load: 155, reps: '5', change: 'up', detail: '+5 lb' })
    expect(formatNextTarget(t)).toBe('Squat: 155 × 5')
  })

  it('program loads: a missed session holds', () => {
    const slot = lifts([{ exercise: 'Squat', sets: 2, reps: 5, load: 'squat', progress: { if: 'all_reps', then: 'squat += 5' } }])
    const [t] = buildNextTargets(input(slot, [{ exercise: 'Squat', sets: [done(5, 150), done(3, 150)] }],
      { varsBefore: { squat: 150 }, varsAfter: { squat: 150 } }))
    expect(t).toMatchObject({ load: 150, change: 'hold' })
  })

  it('double progression walks reps up the range: 155 × 7 next time', () => {
    const slot = lifts([{ exercise: 'Squat', sets: 3, reps: '6-8', load: 'squat', progressionType: 'double' }])
    const [t] = buildNextTargets(input(slot, [{ exercise: 'Squat', sets: [done(6, 155), done(6, 155), done(6, 155)] }],
      { varsBefore: { squat: 155 }, varsAfter: { squat: 155 } }))
    expect(formatNextTarget(t)).toBe('Squat: 155 × 7')
    expect(t).toMatchObject({ change: 'up', detail: '+1 rep' })
  })

  it('double progression with a fixed load: top of range suggests +5 lb and resets reps', () => {
    const slot = lifts([{ exercise: 'Curl', sets: 2, reps: '8-12', progressionType: 'double' }])
    const [t] = buildNextTargets(input(slot, [{ exercise: 'Curl', sets: [done(12, 30), done(12, 30)] }]))
    expect(t).toMatchObject({ load: 35, reps: '8', change: 'up', detail: '+5 lb, back to 8 reps' })
  })

  it('single progression with a fixed load: +5 lb after hitting every rep, repeat otherwise', () => {
    const slot = lifts([{ exercise: 'Bench', sets: 2, reps: 5, progressionType: 'single' }])
    expect(buildNextTargets(input(slot, [{ exercise: 'Bench', sets: [done(5, 135), done(5, 135)] }]))[0])
      .toMatchObject({ load: 140, reps: '5', detail: '+5 lb' })
    expect(buildNextTargets(input(slot, [{ exercise: 'Bench', sets: [done(5, 135), done(4, 135)] }]))[0])
      .toMatchObject({ load: 135, change: 'hold' })
  })

  it('rep schemes show the next step once this session counted', () => {
    const slot = lifts([{ exercise: 'Nordic curl', sets: 2, reps: '3-5', progressionType: 'rep_sets' }])
    const logged = [{ exercise: 'Nordic curl', sets: [done(3), done(3)] }]
    const hit = buildNextTargets(input(slot, logged, { ladderStates: { 'p::nordic curl': { max: 'scheme:3/3,4/4,5/5,3/3/3,4/4/4,5/5/5', hits: [ID] } } }))[0]
    expect(hit).toMatchObject({ reps: '2×4', change: 'up', detail: 'next step' })
    expect(formatNextTarget(hit)).toBe('Nordic curl: 2×4')
    const miss = buildNextTargets(input(slot, logged))[0]
    expect(miss).toMatchObject({ reps: '2×3', change: 'hold', detail: 'repeat this step' })
  })

  it('rep ladders add a rep to the next set', () => {
    const slot = lifts([{ exercise: 'Pull-ups', progressionType: 'rep_ladder', ladderMax: 5 }])
    const [t] = buildNextTargets(input(slot, [{ exercise: 'Pull-ups', sets: [5, 4, 3, 2, 1].map(r => done(r)) }],
      { ladderStates: { 'p::pull-ups': { max: 5, hits: [ID] } } }))
    expect(t).toMatchObject({ reps: '6/4/3/2/1', change: 'up', detail: '+1 rep' })
  })

  it('deload weeks never progress', () => {
    const slot = lifts([
      { exercise: 'Squat', sets: 2, reps: 5, load: 'squat' },
      { exercise: 'Bench', sets: 2, reps: 5, progressionType: 'single' },
      { exercise: 'Nordic curl', sets: 2, reps: '3-5', progressionType: 'rep_sets', deloadSets: 1 },
    ], true)
    const targets = buildNextTargets(input(slot, [
      { exercise: 'Squat', sets: [done(5, 155), done(5, 155)] },
      { exercise: 'Bench', sets: [done(5, 135), done(5, 135)] },
      { exercise: 'Nordic curl', sets: [done(3)] },
    ], { varsBefore: { squat: 155 }, varsAfter: { squat: 155 } }))
    expect(targets.map(t => t.change)).toEqual(['deload', 'deload', 'deload'])
    expect(targets.map(t => t.load)).toEqual([155, 135, null])
    expect(targets[2].reps).toBe('2×3')
  })

  it('skips untouched lifts and unconfigured lifts carry forward', () => {
    const slot = lifts([{ exercise: 'Row', sets: 2, reps: 10 }, { exercise: 'Dip', sets: 2, reps: 10 }])
    const targets = buildNextTargets(input(slot, [
      { exercise: 'Row', sets: [done(10, 95), done(10, 95)] },
      { exercise: 'Dip', sets: [{ completed: false }, { completed: false }] },
    ]))
    expect(targets).toEqual([{ exercise: 'Row', load: 95, reps: '10', change: 'none', detail: 'same as today' }])
  })
})
