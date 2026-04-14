import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Plan, PlanDay, WorkoutSlot, WorkoutType } from '../types'
import { nanoid } from '../engine/rotationEngine'
import { format } from 'date-fns'

interface PlanState {
  plans: Record<string, Plan>
  activePlanId: string | null

  createPlan: (draft: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>) => string
  updatePlan: (id: string, patch: Partial<Omit<Plan, 'id' | 'createdAt'>>) => void
  duplicatePlan: (id: string) => string
  archivePlan: (id: string) => void
  deletePlan: (id: string) => void
  setActivePlan: (id: string) => void
  deactivatePlan: () => void
}

function deepCloneWorkoutSlot(slot: WorkoutSlot): WorkoutSlot {
  return { ...slot, id: nanoid() }
}

function deepClonePlanDay(day: PlanDay): PlanDay {
  return {
    ...day,
    id: nanoid(),
    slots: day.slots.map(deepCloneWorkoutSlot),
  }
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      plans: {},
      activePlanId: null,

      createPlan(draft) {
        const id = nanoid()
        const now = new Date().toISOString()
        const plan: Plan = {
          ...draft,
          id,
          createdAt: now,
          updatedAt: now,
        }
        set(s => ({ plans: { ...s.plans, [id]: plan } }))
        return id
      },

      updatePlan(id, patch) {
        set(s => {
          const existing = s.plans[id]
          if (!existing) return s
          return {
            plans: {
              ...s.plans,
              [id]: {
                ...existing,
                ...patch,
                updatedAt: new Date().toISOString(),
              },
            },
          }
        })
      },

      duplicatePlan(id) {
        const source = get().plans[id]
        if (!source) return ''
        const newId = nanoid()
        const now = new Date().toISOString()
        const copy: Plan = {
          ...source,
          id: newId,
          name: `${source.name} (copy)`,
          status: 'inactive',
          startDate: format(new Date(), 'yyyy-MM-dd'),
          startDayIndex: 0,
          days: source.days.map(deepClonePlanDay),
          createdAt: now,
          updatedAt: now,
        }
        set(s => ({ plans: { ...s.plans, [newId]: copy } }))
        return newId
      },

      archivePlan(id) {
        set(s => {
          const plan = s.plans[id]
          if (!plan) return s
          return {
            plans: {
              ...s.plans,
              [id]: { ...plan, status: 'archived', updatedAt: new Date().toISOString() },
            },
            activePlanId: s.activePlanId === id ? null : s.activePlanId,
          }
        })
      },

      deletePlan(id) {
        set(s => {
          const { [id]: _removed, ...rest } = s.plans
          return {
            plans: rest,
            activePlanId: s.activePlanId === id ? null : s.activePlanId,
          }
        })
      },

      setActivePlan(id) {
        set(s => {
          // Deactivate any currently active plan
          const updated = { ...s.plans }
          for (const pid of Object.keys(updated)) {
            if (updated[pid].status === 'active') {
              updated[pid] = {
                ...updated[pid],
                status: 'inactive',
                updatedAt: new Date().toISOString(),
              }
            }
          }
          updated[id] = {
            ...updated[id],
            status: 'active',
            startDate: format(new Date(), 'yyyy-MM-dd'),
            startDayIndex: 0,
            updatedAt: new Date().toISOString(),
          }
          return { plans: updated, activePlanId: id }
        })
      },

      deactivatePlan() {
        set(s => {
          if (!s.activePlanId) return s
          const plan = s.plans[s.activePlanId]
          if (!plan) return s
          return {
            plans: {
              ...s.plans,
              [s.activePlanId]: {
                ...plan,
                status: 'inactive',
                updatedAt: new Date().toISOString(),
              },
            },
            activePlanId: null,
          }
        })
      },
    }),
    { name: 'wpt_plans' },
  ),
)

// ── Slot/Day helpers used by PlanBuilder ─────────────────────────────────────

export function makeSlot(type: WorkoutType = 'weightlifting'): WorkoutSlot {
  const defaults: Partial<WorkoutSlot> = {}
  if (type === 'weightlifting') defaults.name = 'Weightlifting'
  else if (type === 'long_run') { defaults.name = 'Long Run'; defaults.targetDistance = 8 }
  else if (type === 'recovery_run') { defaults.name = 'Recovery Run'; defaults.targetDistance = 3 }
  else if (type === 'swim') { defaults.name = 'Swim'; defaults.targetDuration = 45 }
  else if (type === 'yoga') { defaults.name = 'Yoga'; defaults.targetDuration = 30 }
  else defaults.name = 'Rest'
  return { id: nanoid(), type, ...defaults } as WorkoutSlot
}

export function makeDay(label?: string): PlanDay {
  return {
    id: nanoid(),
    label: label ?? 'Workout Day',
    slots: [makeSlot('weightlifting')],
  }
}
