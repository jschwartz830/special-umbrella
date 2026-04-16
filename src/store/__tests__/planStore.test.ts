/**
 * Tests for planStore business logic.
 *
 * The persist middleware is mocked as a pass-through so the store works
 * in a Node test environment without localStorage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

// eslint-disable-next-line import/first
import { usePlanStore } from '../planStore'
import type { Plan } from '../../types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDraft(overrides: Partial<Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>> = {}): Omit<Plan, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Test Plan',
    status: 'inactive',
    days: [
      {
        id: 'day-1',
        label: 'Day 1',
        slots: [{ id: 'slot-1', type: 'weightlifting', name: 'Workout' }],
      },
    ],
    duration: { type: 'rotations', value: 4 },
    startDate: '2026-01-01',
    startDayIndex: 0,
    ...overrides,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getState() {
  return usePlanStore.getState()
}

// ── Reset between tests ───────────────────────────────────────────────────────

beforeEach(() => {
  usePlanStore.setState({ plans: {}, activePlanId: null })
})

// ── createPlan ────────────────────────────────────────────────────────────────

describe('createPlan', () => {
  it('creates a plan and returns its id', () => {
    const id = getState().createPlan(makeDraft())
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(getState().plans[id]).toBeDefined()
  })

  it('stores the plan with an auto-assigned id, createdAt, and updatedAt', () => {
    const id = getState().createPlan(makeDraft())
    const plan = getState().plans[id]
    expect(plan.id).toBe(id)
    expect(typeof plan.createdAt).toBe('string')
    expect(typeof plan.updatedAt).toBe('string')
  })

  it('stores the draft fields verbatim', () => {
    const draft = makeDraft({ name: 'My Program', status: 'inactive' })
    const id = getState().createPlan(draft)
    const plan = getState().plans[id]
    expect(plan.name).toBe('My Program')
    expect(plan.status).toBe('inactive')
  })
})

// ── updatePlan ────────────────────────────────────────────────────────────────

describe('updatePlan', () => {
  it('patches the named field', () => {
    const id = getState().createPlan(makeDraft())
    getState().updatePlan(id, { name: 'Renamed' })
    expect(getState().plans[id].name).toBe('Renamed')
  })

  it('updates updatedAt', () => {
    const id = getState().createPlan(makeDraft())
    const before = getState().plans[id].updatedAt
    getState().updatePlan(id, { name: 'Changed' })
    const after = getState().plans[id].updatedAt
    // updatedAt should be a new timestamp (or equal, same ms)
    expect(after >= before).toBe(true)
  })

  it('is a no-op for an unknown id', () => {
    const id = getState().createPlan(makeDraft())
    getState().updatePlan('nonexistent', { name: 'X' })
    // Original plan unchanged
    expect(getState().plans[id].name).toBe('Test Plan')
  })
})

// ── setActivePlan ─────────────────────────────────────────────────────────────

describe('setActivePlan', () => {
  it('sets the plan status to active', () => {
    const id = getState().createPlan(makeDraft({ status: 'inactive' }))
    getState().setActivePlan(id, { startDate: '2026-01-01', startDayIndex: 0 })
    expect(getState().plans[id].status).toBe('active')
    expect(getState().activePlanId).toBe(id)
  })

  it('deactivates the previously active plan when a new one is set', () => {
    const a = getState().createPlan(makeDraft({ name: 'Plan A' }))
    const b = getState().createPlan(makeDraft({ name: 'Plan B' }))
    getState().setActivePlan(a, { startDate: '2026-01-01', startDayIndex: 0 })
    expect(getState().plans[a].status).toBe('active')

    getState().setActivePlan(b, { startDate: '2026-02-01', startDayIndex: 0 })
    expect(getState().plans[b].status).toBe('active')
    expect(getState().plans[a].status).toBe('inactive')  // deactivated
    expect(getState().activePlanId).toBe(b)
  })

  it('applies the provided startDate', () => {
    const id = getState().createPlan(makeDraft())
    getState().setActivePlan(id, { startDate: '2026-06-01' })
    expect(getState().plans[id].startDate).toBe('2026-06-01')
  })

  it('applies the provided startDayIndex', () => {
    const id = getState().createPlan(makeDraft())
    getState().setActivePlan(id, { startDayIndex: 3 })
    expect(getState().plans[id].startDayIndex).toBe(3)
  })

  it('uses today and index 0 when opts are omitted', () => {
    const id = getState().createPlan(makeDraft())
    getState().setActivePlan(id)
    const plan = getState().plans[id]
    expect(plan.status).toBe('active')
    expect(plan.startDayIndex).toBe(0)
    // startDate should be a date string (the actual value depends on today's date)
    expect(/^\d{4}-\d{2}-\d{2}$/.test(plan.startDate)).toBe(true)
  })
})

// ── deactivatePlan ────────────────────────────────────────────────────────────

describe('deactivatePlan', () => {
  it('sets the active plan to inactive and clears activePlanId', () => {
    const id = getState().createPlan(makeDraft())
    getState().setActivePlan(id, { startDate: '2026-01-01' })
    expect(getState().activePlanId).toBe(id)

    getState().deactivatePlan()
    expect(getState().plans[id].status).toBe('inactive')
    expect(getState().activePlanId).toBeNull()
  })

  it('is a no-op when no plan is active', () => {
    expect(() => getState().deactivatePlan()).not.toThrow()
    expect(getState().activePlanId).toBeNull()
  })
})

// ── duplicatePlan ─────────────────────────────────────────────────────────────

describe('duplicatePlan', () => {
  it('creates a new plan with a different id', () => {
    const orig = getState().createPlan(makeDraft({ name: 'Alpha' }))
    const copy = getState().duplicatePlan(orig)
    expect(copy).not.toBe(orig)
    expect(getState().plans[copy]).toBeDefined()
  })

  it('appends "(copy)" to the plan name', () => {
    const orig = getState().createPlan(makeDraft({ name: 'Alpha' }))
    const copy = getState().duplicatePlan(orig)
    expect(getState().plans[copy].name).toBe('Alpha (copy)')
  })

  it('sets the copy status to inactive regardless of source status', () => {
    const orig = getState().createPlan(makeDraft())
    getState().setActivePlan(orig, { startDate: '2026-01-01' })
    expect(getState().plans[orig].status).toBe('active')

    const copy = getState().duplicatePlan(orig)
    expect(getState().plans[copy].status).toBe('inactive')
  })

  it('resets startDayIndex to 0 in the copy', () => {
    const orig = getState().createPlan(makeDraft({ startDayIndex: 3 }))
    const copy = getState().duplicatePlan(orig)
    expect(getState().plans[copy].startDayIndex).toBe(0)
  })

  it('copies all plan days with fresh ids', () => {
    const orig = getState().createPlan(makeDraft())
    const copy = getState().duplicatePlan(orig)
    const origDays = getState().plans[orig].days
    const copyDays = getState().plans[copy].days
    expect(copyDays).toHaveLength(origDays.length)
    // Ids must be different (cloned)
    expect(copyDays[0].id).not.toBe(origDays[0].id)
    // Slot ids must also differ
    expect(copyDays[0].slots[0].id).not.toBe(origDays[0].slots[0].id)
  })

  it('returns empty string for an unknown source id', () => {
    const result = getState().duplicatePlan('does-not-exist')
    expect(result).toBe('')
  })

  it('leaves the original plan unchanged', () => {
    const orig = getState().createPlan(makeDraft({ name: 'Original' }))
    getState().duplicatePlan(orig)
    expect(getState().plans[orig].name).toBe('Original')
    expect(getState().plans[orig].status).toBe('inactive')
  })
})

// ── archivePlan ───────────────────────────────────────────────────────────────

describe('archivePlan', () => {
  it('sets plan status to archived', () => {
    const id = getState().createPlan(makeDraft())
    getState().archivePlan(id)
    expect(getState().plans[id].status).toBe('archived')
  })

  it('clears activePlanId when archiving the active plan', () => {
    const id = getState().createPlan(makeDraft())
    getState().setActivePlan(id, { startDate: '2026-01-01' })
    expect(getState().activePlanId).toBe(id)

    getState().archivePlan(id)
    expect(getState().activePlanId).toBeNull()
  })

  it('does not change activePlanId when archiving a non-active plan', () => {
    const a = getState().createPlan(makeDraft())
    const b = getState().createPlan(makeDraft())
    getState().setActivePlan(a, { startDate: '2026-01-01' })
    getState().archivePlan(b)
    expect(getState().activePlanId).toBe(a)
  })
})

// ── deletePlan ────────────────────────────────────────────────────────────────

describe('deletePlan', () => {
  it('removes the plan from the store', () => {
    const id = getState().createPlan(makeDraft())
    getState().deletePlan(id)
    expect(getState().plans[id]).toBeUndefined()
  })

  it('clears activePlanId when deleting the active plan', () => {
    const id = getState().createPlan(makeDraft())
    getState().setActivePlan(id, { startDate: '2026-01-01' })
    getState().deletePlan(id)
    expect(getState().activePlanId).toBeNull()
  })

  it('leaves other plans intact', () => {
    const a = getState().createPlan(makeDraft({ name: 'A' }))
    const b = getState().createPlan(makeDraft({ name: 'B' }))
    getState().deletePlan(a)
    expect(getState().plans[b]).toBeDefined()
  })
})
