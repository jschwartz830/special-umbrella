import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkoutOutcome, LoggedExerciseActual } from '../modules/workout-outcomes/types'
import { buildProgressionRecommendation } from '../modules/workout-outcomes/progression'
import type { RunProgressionState } from '../modules/run-adaptation/types'
import {
  evaluateRunProgression,
  applyRunProgressionDecision,
} from '../modules/run-adaptation/engine'
import type { WorkoutSlot } from '../types'
import { useProgramStore } from './programStore'

// ── Rep-miss metrics ──────────────────────────────────────────────────────────

function parseTargetReps(raw: number | string | null | undefined): number | null {
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') {
    const m = raw.match(/\d+/)
    return m ? parseInt(m[0], 10) : null
  }
  return null
}

function computeRepMetrics(loggedEx: LoggedExerciseActual | undefined) {
  if (!loggedEx || loggedEx.sets.length === 0) {
    return { sets_hit: 0, sets_failed: 0, total_sets: 0, failed_ratio: 0, first_set_failed: 0 }
  }
  let hit = 0, failed = 0, total = 0
  for (const set of loggedEx.sets) {
    const actual = set.actualReps
    const target = parseTargetReps(set.targetReps)
    if (actual == null || target == null) continue
    total++
    if (actual >= target) hit++
    else failed++
  }
  const firstSet = loggedEx.sets[0]
  const firstActual = firstSet?.actualReps
  const firstTarget = parseTargetReps(firstSet?.targetReps)
  const first_set_failed =
    firstActual != null && firstTarget != null && firstActual < firstTarget ? 1 : 0
  return {
    sets_hit: hit,
    sets_failed: failed,
    total_sets: total,
    failed_ratio: total > 0 ? failed / total : 0,
    first_set_failed,
  }
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
        // 1. Attach an outcome-level progression recommendation and persist
        const recommendation = buildProgressionRecommendation(slot, outcome)
        get().setOutcome({
          ...outcome,
          progressionRecommendation: recommendation,
        })

        // 2. Evaluate legacy run progression (runConfig-based)
        const groupId = slot.runConfig?.progressionGroupId
        if (slot.runConfig?.progressionEligible && groupId) {
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
        }

        // 3. Evaluate program-level progression rules (YAML-imported plans)
        const planId = outcome.workoutInstanceId.split('_')[0]
        if (!planId) return

        const programStore = useProgramStore.getState()
        const currentVars = programStore.getVars(planId)
        if (Object.keys(currentVars).length === 0) return // not a program plan

        const ctxBase = {
          effort: outcome.perceivedEffort ?? null,
          all_reps: outcome.completionState === 'completed',
          session_complete:
            outcome.completionState !== 'skipped' && outcome.completionState !== 'planned',
        }

        // 3a. Slot-level progression (run slots)
        if (slot.slotProgress) {
          programStore.applyProgressionRule(planId, slot.slotProgress, ctxBase)
        }

        // 3b. Per-exercise progression (weights slots)
        if (slot.exercises) {
          const loggedExercises = outcome.weightsActual?.exercises ?? []
          for (const ex of slot.exercises) {
            if (!ex.progress) continue
            const loggedEx = loggedExercises.find(le => le.exercise === ex.exercise)
            const repMetrics = computeRepMetrics(loggedEx)
            programStore.applyProgressionRule(planId, ex.progress, { ...ctxBase, ...repMetrics })
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
      },

      clearPlanOutcomes(planId) {
        const prefix = planId + '_'
        set(s => ({
          outcomes: Object.fromEntries(
            Object.entries(s.outcomes).filter(([k]) => !k.startsWith(prefix)),
          ),
        }))
      },

      importOutcomes(incoming) {
        if (incoming.length === 0) return
        set(s => {
          const next = { ...s.outcomes }
          for (const o of incoming) next[o.workoutInstanceId] = o
          return { outcomes: next }
        })
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
      },
    }),
    { name: 'wpt_outcomes' },
  ),
)

/** Build the workoutInstanceId from plan + date */
export function makeWorkoutInstanceId(planId: string, calendarDate: string): string {
  return `${planId}_${calendarDate}`
}

/** Build the workoutInstanceId for an extra (ad-hoc) workout entry */
export function makeExtraWorkoutInstanceId(planId: string, calendarDate: string, extraId: string): string {
  return `${planId}_${calendarDate}_extra_${extraId}`
}
