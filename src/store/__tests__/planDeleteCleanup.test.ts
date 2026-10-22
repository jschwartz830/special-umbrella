/**
 * Integration-style test: deleting a plan removes only plan-internal state
 * (rotation overrides, program vars, run progression states). Workout logs —
 * history entries, extras, outcomes, exercise history — are standalone records
 * and are kept, with a snapshot so they still describe themselves. Mirrors the
 * PlansPage delete handler: detachPlan, removeProgressionStates, clearPlanVars,
 * deletePlan.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

import { useHistoryStore } from '../historyStore'
import { useOutcomeStore, makeWorkoutInstanceId, makeExtraWorkoutInstanceId } from '../outcomeStore'
import { usePlanStore } from '../planStore'
import { useProgramStore } from '../programStore'
import { useExerciseHistoryStore } from '../exerciseHistoryStore'
import type { Plan } from '../../types'
import { parseWorkoutInstanceId } from '../../lib/workoutInstanceId'
import type { WorkoutOutcome } from '../../modules/workout-outcomes/types'

function makePlan(id: string, name: string): Plan {
  const now = '2026-04-17T00:00:00.000Z'
  return {
    id,
    name,
    status: 'inactive',
    days: [{ id: 'd1', label: 'Day 1', slots: [{ id: 's1', type: 'weightlifting', name: 'Lift' }] }],
    duration: { type: 'rotations', value: 1 },
    startDate: '2026-04-01',
    startDayIndex: 0,
    createdAt: now,
    updatedAt: now,
  }
}

function makeOutcome(planId: string, date: string): WorkoutOutcome {
  return {
    workoutInstanceId: makeWorkoutInstanceId(planId, date),
    completionState: 'completed',
    completedAt: `${date}T12:00:00Z`,
    perceivedEffort: 3,
    durationActualMin: 45,
    notes: null,
    runActual: null,
  }
}

beforeEach(() => {
  usePlanStore.setState({ plans: {}, activePlanId: null })
  useHistoryStore.setState({ entries: [], overrides: [], extraEntries: [] })
  useOutcomeStore.setState({ outcomes: {}, progressionStates: {} })
  useProgramStore.setState({ vars: {} })
  useExerciseHistoryStore.setState({ records: [] })
})

describe('plan delete cleanup (integration)', () => {
  it('removes the plan but keeps its logged workouts, snapshotted', () => {
    const planA = makePlan('plan-A', 'Alpha')
    const planB = makePlan('plan-B', 'Bravo')
    usePlanStore.setState({ plans: { [planA.id]: planA, [planB.id]: planB } })

    useHistoryStore.getState().addEntry({
      planId: 'plan-A', calendarDate: '2026-04-01', planDayIndex: 0, action: 'complete',
    })
    useHistoryStore.getState().addEntry({
      planId: 'plan-B', calendarDate: '2026-04-01', planDayIndex: 0, action: 'complete',
    })
    useHistoryStore.getState().logOverride('plan-A', 'advance')
    useOutcomeStore.getState().setOutcome(makeOutcome('plan-A', '2026-04-01'))
    useOutcomeStore.getState().setOutcome(makeOutcome('plan-B', '2026-04-01'))

    // Simulate the PlansPage delete handler
    useHistoryStore.getState().detachPlan(planA)
    usePlanStore.getState().deletePlan('plan-A')

    expect(usePlanStore.getState().plans['plan-A']).toBeUndefined()
    expect(usePlanStore.getState().plans['plan-B']).toBeDefined()

    // Logs survive and describe themselves without the plan
    const entryA = useHistoryStore.getState().entries.find(e => e.planId === 'plan-A')
    expect(entryA?.workout).toEqual({ planName: 'Alpha', dayLabel: 'Day 1', slots: [{ type: 'weightlifting', name: 'Lift' }] })
    expect(useHistoryStore.getState().entries).toHaveLength(2)
    expect(Object.keys(useOutcomeStore.getState().outcomes)).toHaveLength(2)

    // Rotation overrides are plan-internal and go
    expect(useHistoryStore.getState().overrides.filter(o => o.planId === 'plan-A')).toHaveLength(0)
  })

  it('backfills snapshots for entries logged before snapshots existed', () => {
    const planA = makePlan('plan-A', 'Alpha')
    useHistoryStore.setState({
      entries: [{ id: 'e1', planId: 'plan-A', calendarDate: '2026-04-01', planDayIndex: 0, action: 'complete', createdAt: '2026-04-01T00:00:00Z' }],
      overrides: [],
      extraEntries: [],
    })
    useHistoryStore.getState().detachPlan(planA)
    expect(useHistoryStore.getState().entries[0].workout?.slots[0].name).toBe('Lift')
  })

  it('clears activePlanId when the deleted plan was active', () => {
    const plan = makePlan('plan-A', 'Alpha')
    usePlanStore.setState({ plans: { [plan.id]: plan }, activePlanId: plan.id })
    usePlanStore.getState().deletePlan('plan-A')
    expect(usePlanStore.getState().activePlanId).toBeNull()
  })

  it('keeps ad-hoc extra workouts and records the plan name on them', () => {
    const planA = makePlan('plan-A', 'Alpha')
    usePlanStore.setState({ plans: { [planA.id]: planA } })
    const extraId = useHistoryStore.getState().addExtraEntry({
      planId: 'plan-A', calendarDate: '2026-04-01', workoutType: 'yoga', workoutName: 'Evening yoga',
    })
    useOutcomeStore.getState().setOutcome({
      workoutInstanceId: makeExtraWorkoutInstanceId('plan-A', '2026-04-01', extraId),
      completionState: 'completed',
    })

    useHistoryStore.getState().detachPlan(planA)
    usePlanStore.getState().deletePlan('plan-A')

    const extras = useHistoryStore.getState().extraEntries
    expect(extras).toHaveLength(1)
    expect(extras[0].planName).toBe('Alpha')
    expect(Object.keys(useOutcomeStore.getState().outcomes)).toHaveLength(1)
  })

  it('allows workouts logged with no plan at all', () => {
    const id = useHistoryStore.getState().addExtraEntry({
      planId: '', calendarDate: '2026-04-01', workoutType: 'swim', workoutName: 'Pool',
    })
    const extra = useHistoryStore.getState().extraEntries.find(e => e.id === id)
    expect(extra?.planName).toBeUndefined()
    expect(parseWorkoutInstanceId(makeExtraWorkoutInstanceId('', '2026-04-01', id))).toEqual({ planId: '', calendarDate: '2026-04-01' })
  })

  it('clears program variables for the deleted plan, leaving other plans intact', () => {
    // Simulate two YAML-imported plans that each have program vars seeded
    const planA = makePlan('plan-A', 'Alpha')
    const planB = makePlan('plan-B', 'Bravo')
    usePlanStore.setState({ plans: { [planA.id]: planA, [planB.id]: planB } })

    // Seed program vars for both plans
    useProgramStore.getState().initVars('plan-A', { squat: 135, bench: 95 })
    useProgramStore.getState().initVars('plan-B', { easy_miles: 3.5 })

    expect(useProgramStore.getState().getVars('plan-A')).toMatchObject({ squat: 135, bench: 95 })
    expect(useProgramStore.getState().getVars('plan-B')).toMatchObject({ easy_miles: 3.5 })

    // Simulate the PlansPage delete handler
    useHistoryStore.getState().detachPlan(planA)
    useProgramStore.getState().clearPlanVars('plan-A')
    usePlanStore.getState().deletePlan('plan-A')

    // Plan A vars removed; plan B vars untouched
    expect(useProgramStore.getState().getVars('plan-A')).toEqual({})
    expect(useProgramStore.getState().getVars('plan-B')).toMatchObject({ easy_miles: 3.5 })
  })

  it('clearPlanVars is a no-op for plans that had no program vars (non-YAML plans)', () => {
    const plan = makePlan('plan-A', 'Alpha')
    usePlanStore.setState({ plans: { [plan.id]: plan } })
    // No initVars — plain plan with no YAML program
    expect(() => {
      useProgramStore.getState().clearPlanVars('plan-A')
    }).not.toThrow()
    expect(useProgramStore.getState().getVars('plan-A')).toEqual({})
  })

  it('removes progressionStates for the deleted plan, leaving other plans intact', () => {
    const planA: Plan = {
      ...makePlan('plan-A', 'Alpha'),
      days: [{
        id: 'd1',
        label: 'Day 1',
        slots: [{
          id: 's1',
          type: 'run',
          name: 'Easy Run',
          runConfig: { subtype: 'easy', progressionGroupId: 'plan-A_easy', progressionEligible: true },
        }],
      }],
    }
    const planB: Plan = {
      ...makePlan('plan-B', 'Bravo'),
      days: [{
        id: 'd1',
        label: 'Day 1',
        slots: [{
          id: 's2',
          type: 'run',
          name: 'Long Run',
          runConfig: { subtype: 'long', progressionGroupId: 'plan-B_long', progressionEligible: true },
        }],
      }],
    }
    usePlanStore.setState({ plans: { [planA.id]: planA, [planB.id]: planB } })

    // Seed progression states for both plans
    useOutcomeStore.setState({
      outcomes: {},
      progressionStates: {
        'plan-A_easy': { progressionGroupId: 'plan-A_easy', currentTargetDistanceMiles: 3, lastResult: 'progress', updatedAt: '2026-04-01T12:00:00Z' },
        'plan-B_long': { progressionGroupId: 'plan-B_long', currentTargetDistanceMiles: 8, lastResult: 'hold', updatedAt: '2026-04-01T12:00:00Z' },
      },
    })

    // Collect group IDs and simulate the PlansPage delete handler
    const groupIds = planA.days
      .flatMap(d => d.slots)
      .flatMap(s => s.runConfig?.progressionGroupId ? [s.runConfig.progressionGroupId] : [])
    useOutcomeStore.getState().removeProgressionStates(groupIds)
    usePlanStore.getState().deletePlan('plan-A')

    const remaining = useOutcomeStore.getState().progressionStates
    expect(Object.keys(remaining)).toHaveLength(1)
    expect(remaining['plan-A_easy']).toBeUndefined()
    expect(remaining['plan-B_long']).toBeDefined()
  })

  it('removeProgressionStates is a no-op when groupIds is empty', () => {
    useOutcomeStore.setState({
      outcomes: {},
      progressionStates: {
        'grp-1': { progressionGroupId: 'grp-1', currentTargetDistanceMiles: 3, lastResult: 'hold', updatedAt: '2026-01-01T12:00:00Z' },
      },
    })
    useOutcomeStore.getState().removeProgressionStates([])
    expect(Object.keys(useOutcomeStore.getState().progressionStates)).toHaveLength(1)
  })

  it('keeps exercise history records when a plan is deleted', () => {
    const planA = makePlan('plan-A', 'Alpha')
    const planB = makePlan('plan-B', 'Bravo')
    usePlanStore.setState({ plans: { [planA.id]: planA, [planB.id]: planB } })

    // Seed exercise records for both plans
    useExerciseHistoryStore.setState({
      records: [
        {
          id: 'rec-a1',
          exerciseName: 'Squat',
          calendarDate: '2026-04-01',
          planId: 'plan-A',
          planName: 'Alpha',
          workoutName: 'Day 1',
          workoutInstanceId: 'plan-A_2026-04-01',
          sets: [{ reps: 5, load: 135, volume: 675, completed: true }],
          totalVolume: 675,
          maxLoad: 135,
          maxReps: 5,
          createdAt: '2026-04-01T12:00:00Z',
        },
        {
          id: 'rec-b1',
          exerciseName: 'Deadlift',
          calendarDate: '2026-04-01',
          planId: 'plan-B',
          planName: 'Bravo',
          workoutName: 'Day 1',
          workoutInstanceId: 'plan-B_2026-04-01',
          sets: [{ reps: 5, load: 185, volume: 925, completed: true }],
          totalVolume: 925,
          maxLoad: 185,
          maxReps: 5,
          createdAt: '2026-04-01T12:00:00Z',
        },
      ],
    })

    // Simulate the full PlansPage delete handler
    useHistoryStore.getState().detachPlan(usePlanStore.getState().plans['plan-A'])
    useProgramStore.getState().clearPlanVars('plan-A')
    usePlanStore.getState().deletePlan('plan-A')

    // Exercise history is standalone (dated, with plan/workout names snapshotted) — all kept
    const remaining = useExerciseHistoryStore.getState().records
    expect(remaining.map(r => r.planName)).toEqual(['Alpha', 'Bravo'])
  })
})
