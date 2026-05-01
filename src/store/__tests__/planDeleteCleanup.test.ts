/**
 * Integration-style test: deleting a plan should cascade to history and
 * outcomes, leaving no orphaned records. Mirrors the wiring in PlansPage
 * where the delete confirm handler calls clearPlanHistory, clearPlanOutcomes
 * and deletePlan together.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

// eslint-disable-next-line import/first
import { useHistoryStore } from '../historyStore'
// eslint-disable-next-line import/first
import { useOutcomeStore, makeWorkoutInstanceId, makeExtraWorkoutInstanceId } from '../outcomeStore'
// eslint-disable-next-line import/first
import { usePlanStore } from '../planStore'
// eslint-disable-next-line import/first
import { useProgramStore } from '../programStore'
// eslint-disable-next-line import/first
import type { Plan } from '../../types'
// eslint-disable-next-line import/first
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
})

describe('plan delete cleanup (integration)', () => {
  it('removes the plan, its history entries, and its outcomes', () => {
    // Seed plan A and plan B in each store
    const planA = makePlan('plan-A', 'Alpha')
    const planB = makePlan('plan-B', 'Bravo')
    usePlanStore.setState({ plans: { [planA.id]: planA, [planB.id]: planB } })

    useHistoryStore.getState().addEntry({
      planId: 'plan-A', calendarDate: '2026-04-01', planDayIndex: 0, action: 'complete',
    })
    useHistoryStore.getState().addEntry({
      planId: 'plan-A', calendarDate: '2026-04-02', planDayIndex: 0, action: 'skip',
    })
    useHistoryStore.getState().addEntry({
      planId: 'plan-B', calendarDate: '2026-04-01', planDayIndex: 0, action: 'complete',
    })

    useOutcomeStore.getState().setOutcome(makeOutcome('plan-A', '2026-04-01'))
    useOutcomeStore.getState().setOutcome(makeOutcome('plan-A', '2026-04-02'))
    useOutcomeStore.getState().setOutcome(makeOutcome('plan-B', '2026-04-01'))

    // Simulate the PlansPage delete handler
    useHistoryStore.getState().clearPlanHistory('plan-A')
    useOutcomeStore.getState().clearPlanOutcomes('plan-A')
    usePlanStore.getState().deletePlan('plan-A')

    // Plan A is gone; plan B untouched
    expect(usePlanStore.getState().plans['plan-A']).toBeUndefined()
    expect(usePlanStore.getState().plans['plan-B']).toBeDefined()

    const remainingEntries = useHistoryStore.getState().entries
    expect(remainingEntries).toHaveLength(1)
    expect(remainingEntries[0].planId).toBe('plan-B')

    const remainingOutcomes = Object.keys(useOutcomeStore.getState().outcomes)
    expect(remainingOutcomes).toHaveLength(1)
    expect(remainingOutcomes[0]).toBe(makeWorkoutInstanceId('plan-B', '2026-04-01'))
  })

  it('clears activePlanId when the deleted plan was active', () => {
    const plan = makePlan('plan-A', 'Alpha')
    usePlanStore.setState({ plans: { [plan.id]: plan }, activePlanId: plan.id })
    usePlanStore.getState().deletePlan('plan-A')
    expect(usePlanStore.getState().activePlanId).toBeNull()
  })

  it('removes ad-hoc extra workouts and their outcomes for the deleted plan only', () => {
    const planA = makePlan('plan-A', 'Alpha')
    const planB = makePlan('plan-B', 'Bravo')
    usePlanStore.setState({ plans: { [planA.id]: planA, [planB.id]: planB } })

    // Two extras on plan A, one on plan B
    const extraAId = useHistoryStore.getState().addExtraEntry({
      planId: 'plan-A', calendarDate: '2026-04-01', workoutType: 'yoga', workoutName: 'Evening yoga',
    })
    const extraA2Id = useHistoryStore.getState().addExtraEntry({
      planId: 'plan-A', calendarDate: '2026-04-03', workoutType: 'swim', workoutName: 'Pool',
    })
    const extraBId = useHistoryStore.getState().addExtraEntry({
      planId: 'plan-B', calendarDate: '2026-04-01', workoutType: 'yoga', workoutName: 'Morning yoga',
    })

    // Seed outcomes for each extra
    useOutcomeStore.getState().setOutcome({
      workoutInstanceId: makeExtraWorkoutInstanceId('plan-A', '2026-04-01', extraAId),
      completionState: 'completed',
    })
    useOutcomeStore.getState().setOutcome({
      workoutInstanceId: makeExtraWorkoutInstanceId('plan-A', '2026-04-03', extraA2Id),
      completionState: 'completed',
    })
    useOutcomeStore.getState().setOutcome({
      workoutInstanceId: makeExtraWorkoutInstanceId('plan-B', '2026-04-01', extraBId),
      completionState: 'completed',
    })

    // Simulate the PlansPage delete handler for plan A
    useHistoryStore.getState().clearPlanHistory('plan-A')
    useOutcomeStore.getState().clearPlanOutcomes('plan-A')
    usePlanStore.getState().deletePlan('plan-A')

    // Plan A extras gone; plan B extra intact
    const remainingExtras = useHistoryStore.getState().extraEntries
    expect(remainingExtras).toHaveLength(1)
    expect(remainingExtras[0].planId).toBe('plan-B')

    // Plan A extra outcomes gone; plan B extra outcome intact
    const remainingOutcomeKeys = Object.keys(useOutcomeStore.getState().outcomes)
    expect(remainingOutcomeKeys).toHaveLength(1)
    expect(remainingOutcomeKeys[0]).toBe(
      makeExtraWorkoutInstanceId('plan-B', '2026-04-01', extraBId),
    )
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

    // Simulate the PlansPage delete handler (including the fix: clearPlanVars)
    useHistoryStore.getState().clearPlanHistory('plan-A')
    useOutcomeStore.getState().clearPlanOutcomes('plan-A')
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
})
