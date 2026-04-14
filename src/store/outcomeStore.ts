import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkoutOutcome } from '../modules/workout-outcomes/types'
import type { RunProgressionState } from '../modules/run-adaptation/types'
import {
  evaluateRunProgression,
  applyRunProgressionDecision,
} from '../modules/run-adaptation/engine'
import type { WorkoutSlot } from '../types'

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

  /** Remove all outcomes associated with a plan (called when plan is cleared) */
  clearPlanOutcomes: (planId: string) => void
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
        // 1. Persist the outcome
        get().setOutcome(outcome)

        // 2. Evaluate run progression if applicable
        const groupId = slot.runConfig?.progressionGroupId
        if (!slot.runConfig?.progressionEligible || !groupId) return

        const prevState = get().progressionStates[groupId] ?? null
        const decision = evaluateRunProgression(slot, outcome, prevState)
        if (decision.action === 'none') return

        const nextState = applyRunProgressionDecision(
          outcome.workoutInstanceId,
          groupId,
          decision,
          prevState,
        )
        get().setProgressionState(nextState)
      },

      clearPlanOutcomes(planId) {
        const prefix = planId + '_'
        set(s => ({
          outcomes: Object.fromEntries(
            Object.entries(s.outcomes).filter(([k]) => !k.startsWith(prefix)),
          ),
        }))
      },
    }),
    { name: 'wpt_outcomes' },
  ),
)

/** Build the workoutInstanceId from plan + date */
export function makeWorkoutInstanceId(planId: string, calendarDate: string): string {
  return `${planId}_${calendarDate}`
}
