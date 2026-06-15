import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkoutOutcome } from '../modules/workout-outcomes/types'
import { buildProgressionRecommendation } from '../modules/workout-outcomes/progression'
import type { RunProgressionState } from '../modules/run-adaptation/types'
import {
  evaluateRunProgression,
  applyRunProgressionDecision,
} from '../modules/run-adaptation/engine'
import type { WorkoutSlot } from '../types'
import { useProgramStore } from './programStore'
import { usePlanStore } from './planStore'
import { useHistoryStore } from './historyStore'
import { useExerciseHistoryStore } from './exerciseHistoryStore'
import { parseWorkoutInstanceId } from '../lib/workoutInstanceId'

/** Resolve plan/workout name context and sync a weights outcome to exerciseHistoryStore. */
function syncExerciseHistory(outcome: WorkoutOutcome): void {
  if (!outcome.weightsActual?.exercises?.length) return
  const parsed = parseWorkoutInstanceId(outcome.workoutInstanceId)
  if (!parsed) return
  const { planId, calendarDate } = parsed

  const plan = usePlanStore.getState().plans[planId]
  const planName = plan?.name ?? null

  let workoutName: string | null = null
  if (plan) {
    const histEntry = useHistoryStore.getState().entries.find(
      e => e.planId === planId && e.calendarDate === calendarDate,
    )
    if (histEntry?.planDayIndex !== undefined) {
      workoutName = plan.days[histEntry.planDayIndex]?.label ?? null
    }
  }

  useExerciseHistoryStore.getState().upsertFromOutcome(outcome, { planName, workoutName })
}

interface OutcomeState {
  /** Keyed by workoutInstanceId = `${planId}_${calendarDate}` */
  outcomes: Record<string, WorkoutOutcome>
  /** Keyed by progressionGroupId */
  progressionStates: Record<string, RunProgressionState>

  setOutcome: (outcome: WorkoutOutcome) => void
  getOutcome: (workoutInstanceId: string) => WorkoutOutcome | null

  setProgressionState: (state: RunProgressionState) => void
  getProgressionState: (progressionGroupId: string) => RunProgressionState | null

  /**
   * Log an outcome and, if the slot is a progression-eligible run,
   * evaluate and persist the next progression state.
   */
  logOutcomeWithProgression: (outcome: WorkoutOutcome, slot: WorkoutSlot) => void

  /**
   * Patch the notes field on an existing outcome record.
   * Called by the history editor so outcome.notes stays in sync with HistoryEntry.notes.
   * No-op when no outcome exists for the given instanceId.
   */
  updateOutcomeNotes: (workoutInstanceId: string, notes: string) => void

  /** Remove a single outcome by instanceId — used when a history entry is undone/deleted. */
  removeOutcome: (workoutInstanceId: string) => void

  /** Remove all outcomes associated with a plan (called when plan is cleared) */
  clearPlanOutcomes: (planId: string) => void

  /** Bulk import — replaces any existing outcome for a given workoutInstanceId. */
  importOutcomes: (incoming: WorkoutOutcome[]) => void

  /** Move an outcome record to a new instanceId key (for date changes). */
  moveOutcome: (oldInstanceId: string, newInstanceId: string) => void

  /** Remove progression states for the given group IDs (called on plan delete). */
  removeProgressionStates: (groupIds: string[]) => void
}

export const useOutcomeStore = create<OutcomeState>()(
  persist(
    (set, get) => ({
      outcomes: {},
      progressionStates: {},

      setOutcome(outcome) {
        set(s => ({
          outcomes: { ...s.outcomes, [outcome.workoutInstanceId]: outcome },
        }))
        syncExerciseHistory(outcome)
      },

      getOutcome(workoutInstanceId) {
        return get().outcomes[workoutInstanceId] ?? null
      },

      setProgressionState(state) {
        set(s => ({
          progressionStates: {
            ...s.progressionStates,
            [state.progressionGroupId]: state,
          },
        }))
      },

      getProgressionState(progressionGroupId) {
        return get().progressionStates[progressionGroupId] ?? null
      },

      logOutcomeWithProgression(outcome, slot) {
        // 1. Attach an outcome-level progression recommendation and persist
        const recommendation = buildProgressionRecommendation(slot, outcome)
        get().setOutcome({
          ...outcome,
          progressionRecommendation: recommendation,
        })

        // 2. Evaluate legacy run progression (runConfig-based).
        // Wrapped in try/catch: a bug in the progression engine must never
        // prevent the outcome from being persisted or the modal from closing.
        const groupId = slot.runConfig?.progressionGroupId
        if (slot.runConfig?.progressionEligible && groupId) {
          try {
            const prevState = get().progressionStates[groupId] ?? null
            const decision = evaluateRunProgression(slot, outcome, prevState)
            if (decision.action !== 'none') {
              const nextState = applyRunProgressionDecision(
                outcome.workoutInstanceId,
                groupId,
                decision,
                prevState,
              )
              get().setProgressionState(nextState)
            }
          } catch (err) {
            console.error('[outcomeStore] run-progression evaluation failed (outcome already saved):', err)
          }
        }

        // 3. Evaluate program-level progression rules (YAML-imported plans)
        const planId = parseWorkoutInstanceId(outcome.workoutInstanceId)?.planId
        if (!planId) return

        const programStore = useProgramStore.getState()
        const currentVars = programStore.getVars(planId)
        if (Object.keys(currentVars).length === 0) return // not a program plan

        const ctxBase = {
          effort: outcome.perceivedEffort ?? null,
          all_reps: outcome.completionState === 'completed',
          // deferred maps to day_off (no workout performed) — exclude alongside skipped/planned
          session_complete:
            outcome.completionState !== 'skipped' &&
            outcome.completionState !== 'planned' &&
            outcome.completionState !== 'deferred',
        }

        // 3a. Slot-level progression (run slots)
        if (slot.slotProgress) {
          programStore.applyProgressionRule(planId, slot.slotProgress, ctxBase)
        }

        // 3b. Per-exercise progression (weights slots)
        if (slot.exercises) {
          for (const ex of slot.exercises) {
            if (ex.progress) {
              programStore.applyProgressionRule(planId, ex.progress, ctxBase)
            }
          }
        }
      },

      updateOutcomeNotes(workoutInstanceId, notes) {
        set(s => {
          const existing = s.outcomes[workoutInstanceId]
          if (!existing) return s
          return {
            outcomes: {
              ...s.outcomes,
              [workoutInstanceId]: { ...existing, notes: notes || null },
            },
          }
        })
      },

      removeOutcome(workoutInstanceId) {
        set(s => {
          if (!(workoutInstanceId in s.outcomes)) return s
          const { [workoutInstanceId]: _removed, ...rest } = s.outcomes
          return { outcomes: rest }
        })
        useExerciseHistoryStore.getState().removeByWorkoutInstance(workoutInstanceId)
      },

      clearPlanOutcomes(planId) {
        const prefix = planId + '_'
        set(s => ({
          outcomes: Object.fromEntries(
            Object.entries(s.outcomes).filter(([k]) => !k.startsWith(prefix)),
          ),
        }))
        useExerciseHistoryStore.getState().clearByPlanId(planId)
      },

      importOutcomes(incoming) {
        if (incoming.length === 0) return
        set(s => {
          const next = { ...s.outcomes }
          for (const o of incoming) next[o.workoutInstanceId] = o
          return { outcomes: next }
        })
        // Use syncExerciseHistory so imported outcomes carry the same
        // planName/workoutName context that live-logged outcomes do.
        for (const o of incoming) syncExerciseHistory(o)
      },

      moveOutcome(oldInstanceId, newInstanceId) {
        set(s => {
          const existing = s.outcomes[oldInstanceId]
          if (!existing) return s
          const { [oldInstanceId]: _removed, ...rest } = s.outcomes
          return {
            outcomes: {
              ...rest,
              [newInstanceId]: { ...existing, workoutInstanceId: newInstanceId },
            },
          }
        })
        useExerciseHistoryStore.getState().moveByWorkoutInstance(oldInstanceId, newInstanceId)
      },

      removeProgressionStates(groupIds) {
        if (groupIds.length === 0) return
        set(s => {
          const ids = new Set(groupIds)
          return {
            progressionStates: Object.fromEntries(
              Object.entries(s.progressionStates).filter(([k]) => !ids.has(k)),
            ),
          }
        })
      },
    }),
    {
      name: 'wpt_outcomes',
      version: 1,
      migrate: (persisted: unknown) => persisted as OutcomeState,
    },
  ),
)

// Re-export ID constructors from their canonical location so callers that
// import from outcomeStore continue to work without changes.
export { makeWorkoutInstanceId, makeExtraWorkoutInstanceId } from '../lib/workoutInstanceId'
