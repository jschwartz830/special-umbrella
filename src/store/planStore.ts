import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Plan, PlanDay, WorkoutSlot, WorkoutType } from '../types'
import { nanoid } from '../lib/utils'
import { format } from 'date-fns'
import type { WorkoutTag } from '../modules/workout-metadata/types'

interface PlanState {
  plans: Record<string, Plan>
  activePlanId: string | null

  createPlan: (draft: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>) => string
  updatePlan: (id: string, patch: Partial<Omit<Plan, 'id' | 'createdAt'>>) => void
  duplicatePlan: (id: string) => string
  archivePlan: (id: string) => void
  deletePlan: (id: string) => void
  setActivePlan: (id: string, opts?: { startDate?: string; startDayIndex?: number }) => void
  deactivatePlan: () => void

  /** Bulk import fully-formed plans (with new IDs already assigned). */
  importPlans: (plans: Plan[]) => void
}

function deepCloneExerciseSpec(ex: import('../types/program').ExerciseSpec): import('../types/program').ExerciseSpec {
  return {
    ...ex,
    // sets may be a SetSpec[] — clone each element so edits to one plan's sets
    // don't mutate the other after duplication.
    ...(Array.isArray(ex.sets) ? { sets: ex.sets.map(s => ({ ...s })) } : {}),
  }
}

function deepCloneWorkoutSlot(slot: WorkoutSlot): WorkoutSlot {
  return {
    ...slot,
    id: nanoid(),
    // Deep-clone nested arrays so duplicated plans don't share exercise/segment references.
    // These fields are only present on YAML-imported slots; the spread above copies them by
    // reference without this guard, which would make both plans mutate the same objects.
    ...(slot.warmup    ? { warmup:    slot.warmup.map(deepCloneExerciseSpec) }    : {}),
    ...(slot.exercises ? { exercises: slot.exercises.map(deepCloneExerciseSpec) } : {}),
    ...(slot.segments  ? { segments:  slot.segments.map(s => ({ ...s })) }        : {}),
  }
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

      setActivePlan(id, opts = {}) {
        set(s => {
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
            startDate: opts.startDate ?? format(new Date(), 'yyyy-MM-dd'),
            startDayIndex: opts.startDayIndex ?? 0,
            updatedAt: new Date().toISOString(),
          }
          return { plans: updated, activePlanId: id }
        })
      },

      importPlans(incoming) {
        if (incoming.length === 0) return
        set(s => {
          const next = { ...s.plans }
          for (const p of incoming) next[p.id] = p
          return { plans: next }
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
    {
      name: 'wpt_plans',
      version: 2,
      migrate: (persisted: unknown) => migratePlanState(persisted),
    },
  ),
)

// ── Slot/Day helpers used by PlanBuilder ─────────────────────────────────────

export function makeSlot(type: WorkoutType = 'weights'): WorkoutSlot {
  const defaults: Partial<WorkoutSlot> = {}
  if (type === 'weights' || type === 'weightlifting') defaults.name = 'Weights'
  else if (type === 'run' || type === 'long_run') { defaults.name = 'Run'; defaults.targetDistance = 8; defaults.subtype = 'long' }
  else if (type === 'recovery_run') { defaults.name = 'Run'; defaults.targetDistance = 3; defaults.subtype = 'recovery' }
  else if (type === 'swim') { defaults.name = 'Swim'; defaults.targetDuration = 45 }
  else if (type === 'yoga') { defaults.name = 'Yoga'; defaults.targetDuration = 30 }
  else { defaults.name = 'Other'; defaults.subtype = 'rest' }
  return { id: nanoid(), type, ...defaults } as WorkoutSlot
}

export function makeDay(label?: string): PlanDay {
  return {
    id: nanoid(),
    label: label ?? 'Workout Day',
    slots: [makeSlot('weights')],
  }
}

function migratePlanState(persisted: unknown): PlanState {
  const state = persisted as PlanState
  if (!state || !state.plans) return { plans: {}, activePlanId: null } as PlanState
  const plans = Object.fromEntries(
    Object.entries(state.plans).map(([id, plan]) => [
      id,
      {
        ...plan,
        days: plan.days.map(day => ({
          ...day,
          slots: day.slots.map(slot => migrateSlot(slot)),
        })),
      },
    ]),
  )
  return { ...state, plans }
}

function migrateSlot(slot: WorkoutSlot): WorkoutSlot {
  const tags = slot.tags ?? []
  const location = deriveLocation(tags) ?? slot.location
  if (slot.type === 'weightlifting') {
    return {
      ...slot,
      type: 'weights',
      name: slot.name === 'Weightlifting' ? 'Weights' : slot.name,
      weightsFocusArea: slot.weightsFocusArea ?? deriveFocus(tags),
      location,
      tags: undefined,
    }
  }
  if (slot.type === 'long_run') {
    return { ...slot, type: 'run', subtype: 'long', name: 'Run', location, tags: undefined }
  }
  if (slot.type === 'recovery_run') {
    return { ...slot, type: 'run', subtype: 'recovery', name: 'Run', location, tags: undefined }
  }
  if (slot.type === 'rest') {
    return { ...slot, type: 'other', subtype: 'rest', name: 'Other', tags: undefined }
  }
  return { ...slot, location, tags: undefined }
}

function deriveLocation(tags: WorkoutTag[]): string | undefined {
  if (tags.includes('home')) return 'home'
  if (tags.includes('gym')) return 'gym'
  if (tags.includes('indoor')) return 'indoor'
  if (tags.includes('outdoor')) return 'outdoor'
  return undefined
}

function deriveFocus(tags: WorkoutTag[]): WorkoutSlot['weightsFocusArea'] {
  if (tags.includes('upper')) return 'upper'
  if (tags.includes('lower')) return 'lower'
  if (tags.includes('full_body')) return 'full_body'
  return undefined
}
