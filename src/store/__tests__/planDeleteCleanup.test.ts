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
import { useOutcomeStore, makeWorkoutInstanceId } from '../outcomeStore'
// eslint-disable-next-line import/first
import { usePlanStore } from '../planStore'
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
  useHistoryStore.setState({ entries: [], overrides: [] })
  useOutcomeStore.setState({ outcomes: {}, progressionStates: {} })
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
})
