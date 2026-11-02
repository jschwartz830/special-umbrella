/**
 * Deload weeks (4/8/12) never progress anything: program-variable loads, rep
 * ladders and rep schemes all hold, and the recommendation says so. The weeks
 * either side still progress normally.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

import { addDays, format, parseISO } from 'date-fns'
import { useOutcomeStore, makeWorkoutInstanceId } from '../outcomeStore'
import { useProgramStore } from '../programStore'
import { planDayForDate, programWeekForDate } from '../../engine/programWeeks'
import { ladderKey, withLadderTargets } from '../../modules/rep-ladder/ladder'
import type { Plan, WorkoutSlot } from '../../types'
import type { LoggedExerciseActual } from '../../modules/workout-outcomes/types'

const START = '2026-11-02'
const plan: Plan = {
  id: 'p', name: '12-week', status: 'active', createdAt: '', updatedAt: '',
  startDate: START, startDayIndex: 0,
  duration: { type: 'weeks', value: 12 },
  programMeta: {
    version: 1,
    vars: { squat: 155 },
    weekly: true,
    deload: { weeks: [4, 8, 12] },
  },
  days: [{ id: 'a', label: 'Lift', slots: [{ id: 'a1', type: 'weights', name: 'Lift', exercises: [
    { exercise: 'Squat', sets: 3, reps: 5, load: 'squat', progressionType: 'single', progress: { if: 'all_reps', then: 'squat += 5' } },
    { exercise: 'Pull-ups', progressionType: 'rep_ladder', ladderMax: 5 },
    { exercise: 'Nordic curl', sets: 2, reps: '3-5', progressionType: 'rep_sets' },
  ] }] }],
}

const dateInWeek = (week: number) => format(addDays(parseISO(START), (week - 1) * 7), 'yyyy-MM-dd')

/** Log the week's session with every set completed at its target. */
function logWeek(week: number): WorkoutSlot {
  const date = dateInWeek(week)
  const id = makeWorkoutInstanceId('p', date)
  const slot = planDayForDate(plan, 0, date).slots[0]
  const shown = withLadderTargets(slot, 'p', useOutcomeStore.getState().ladderStates, id)
  const exercises: LoggedExerciseActual[] = shown.exercises!.map(ex => {
    const sets = Array.isArray(ex.sets) ? ex.sets : Array.from({ length: Number(ex.sets ?? 3) }, () => ({ reps: ex.reps }))
    return {
      exercise: ex.exercise,
      progressionMode: ex.progressionType === 'single' ? 'single' : 'volume',
      sets: sets.map(s => {
        const reps = Number(String(s.reps ?? ex.reps).match(/\d+$/)?.[0])
        return { targetReps: reps, actualReps: reps, actualLoad: 155, completed: true }
      }),
    }
  })
  useOutcomeStore.getState().logOutcomeWithProgression({
    workoutInstanceId: id,
    completionState: 'completed',
    perceivedEffort: 3,
    weightsActual: { exercises },
  }, slot)
  return slot
}

const squat = () => useProgramStore.getState().getVars('p').squat
const hits = (name: string) => useOutcomeStore.getState().ladderStates[ladderKey('p', name)]?.hits.length ?? 0
const recommendation = (week: number) =>
  useOutcomeStore.getState().outcomes[makeWorkoutInstanceId('p', dateInWeek(week))]?.progressionRecommendation

beforeEach(() => {
  useOutcomeStore.setState({ outcomes: {}, progressionStates: {}, ladderStates: {} })
  useProgramStore.setState({ vars: { p: { squat: 155 } } })
})

describe('deload weeks', () => {
  it('weeks 4, 8 and 12 are deloads', () => {
    expect([3, 4, 5, 8, 12].map(w => programWeekForDate(plan, dateInWeek(w))?.deload)).toEqual([false, true, false, true, true])
  })

  it('progress normally outside deload weeks', () => {
    logWeek(3)
    expect(squat()).toBe(160)
    expect(hits('Pull-ups')).toBe(1)
    expect(hits('Nordic curl')).toBe(1)
    expect(recommendation(3)?.action).toBe('progress')
  })

  it.each([4, 8, 12])('week %i: no load, ladder or rep-scheme progression', week => {
    const slot = logWeek(week)
    expect(slot.isDeload).toBe(true)
    expect(slot.exercises!.every(ex => ex.progress == null)).toBe(true)
    expect(squat()).toBe(155)
    expect(hits('Pull-ups')).toBe(0)
    expect(hits('Nordic curl')).toBe(0)
    expect(recommendation(week)).toMatchObject({ action: 'hold' })
    expect(recommendation(week)?.note).toMatch(/deload/i)
  })

  it('a deload week leaves earlier progress in place, and the next week carries on', () => {
    logWeek(3)
    logWeek(4)
    expect(squat()).toBe(160)
    expect(hits('Pull-ups')).toBe(1)
    logWeek(5)
    expect(squat()).toBe(165)
    expect(hits('Pull-ups')).toBe(2)
  })

  it('caps a rep ladder at the deloaded set count', () => {
    const date = dateInWeek(4)
    const slot = withLadderTargets(planDayForDate(plan, 0, date).slots[0], 'p', {})
    const ladder = slot.exercises!.find(ex => ex.exercise === 'Pull-ups')!
    expect(ladder.sets).toEqual([{ reps: 5 }, { reps: 4 }, { reps: 3 }])
    expect(ladder.ladderStatus).toMatch(/deload/)
  })

  it('the manual "Deload week" toggle also blocks progression', () => {
    const manual: WorkoutSlot = { ...plan.days[0].slots[0], isDeload: true }
    useOutcomeStore.getState().logOutcomeWithProgression({
      workoutInstanceId: makeWorkoutInstanceId('p', dateInWeek(2)),
      completionState: 'completed',
      weightsActual: { exercises: [
        { exercise: 'Squat', progressionMode: 'single', sets: [1, 2, 3].map(() => ({ targetReps: 5, actualReps: 5, completed: true })) },
        { exercise: 'Pull-ups', sets: [5, 4, 3, 2, 1].map(r => ({ actualReps: r, completed: true })) },
      ] },
    }, manual)
    expect(squat()).toBe(155)
    expect(hits('Pull-ups')).toBe(0)
  })
})

describe('multi-slot days', () => {
  it('progresses lifts that come after a run', () => {
    const run: WorkoutSlot = { id: 'r', type: 'run', name: 'Easy run' }
    const lifts = planDayForDate(plan, 0, dateInWeek(2)).slots[0]
    useOutcomeStore.getState().logOutcomeWithProgression({
      workoutInstanceId: makeWorkoutInstanceId('p', dateInWeek(2)),
      completionState: 'completed',
      runActual: { actualDurationMin: 30 },
      weightsActual: { exercises: [
        { exercise: 'Squat', progressionMode: 'single', sets: [1, 2, 3].map(() => ({ targetReps: 5, actualReps: 5, completed: true })) },
      ] },
    }, [run, lifts])
    expect(squat()).toBe(160)
  })
})
