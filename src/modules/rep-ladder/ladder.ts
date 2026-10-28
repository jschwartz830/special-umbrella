import type { ExerciseSpec } from '../../types/program'
import type { WorkoutSlot } from '../../types'

/**
 * Rep ladder (Russian Fighter Pull-up style) progression.
 *
 * Start from a tested max: day one is a descending ladder (max 5 → 5-4-3-2-1).
 * Each successful session adds one rep to the next set in turn
 * (6-4-3-2-1, 6-5-3-2-1, …). Progress is counted in sessions, not calendar
 * days, so the cycle stretches to fit however often the exercise is trained.
 * A missed session repeats the same step. After `sessions` steps the ladder
 * holds until a new max is entered, which starts a fresh cycle.
 */

export const DEFAULT_LADDER_SESSIONS = 24
const MAX_LADDER_SETS = 5

/** Progress for one plan + exercise. `hits` are the workout instances that completed their step. */
export interface LadderState {
  max: number
  hits: string[]
}

export function ladderKey(planId: string, exercise: string): string {
  return `${planId}::${exercise.trim().toLowerCase()}`
}

export function isLadderExercise(ex: ExerciseSpec): ex is ExerciseSpec & { ladderMax: number } {
  return ex.progressionType === 'rep_ladder' && typeof ex.ladderMax === 'number' && ex.ladderMax >= 1
}

export function ladderSessions(ex: ExerciseSpec): number {
  return ex.ladderSessions != null && ex.ladderSessions >= 1 ? Math.floor(ex.ladderSessions) : DEFAULT_LADDER_SESSIONS
}

/** Target reps per set for a given max at a given step (0 = first session). */
export function ladderReps(max: number, step: number): number[] {
  const m = Math.max(1, Math.floor(max))
  const n = Math.min(MAX_LADDER_SETS, m)
  const s = Math.max(0, Math.floor(step))
  const rounds = Math.floor(s / n)
  const extra = s % n
  return Array.from({ length: n }, (_, i) => m - i + rounds + (i < extra ? 1 : 0))
}

/**
 * Sessions completed in the current cycle. Hits recorded against a different max
 * belong to an old cycle; `excludeInstanceId` keeps a re-logged session from
 * counting toward its own target.
 */
export function ladderStep(state: LadderState | undefined, max: number, excludeInstanceId?: string): number {
  if (!state || state.max !== max) return 0
  return state.hits.filter(id => id !== excludeInstanceId).length
}

/** Concrete sets for today's ladder step, plus a status line showing where the cycle is. */
export function applyLadder(ex: ExerciseSpec & { ladderMax: number }, step: number): ExerciseSpec {
  const total = ladderSessions(ex)
  const reps = ladderReps(ex.ladderMax, Math.min(step, total - 1))
  return {
    ...ex,
    sets: reps.map(r => ({ reps: r })),
    reps: undefined,
    ladderStatus: step >= total
      ? 'Ladder cycle complete — test your max and update it in the plan'
      : `Ladder session ${step + 1}/${total} · max ${ex.ladderMax}`,
  }
}

/** Replace ladder exercises in a slot with today's concrete sets. Returns the same slot when nothing changes. */
export function withLadderTargets(
  slot: WorkoutSlot,
  planId: string | undefined,
  states: Record<string, LadderState>,
  excludeInstanceId?: string,
): WorkoutSlot {
  if (!planId || !slot.exercises?.some(isLadderExercise)) return slot
  return {
    ...slot,
    exercises: slot.exercises.map(ex => {
      if (!isLadderExercise(ex)) return ex
      const step = ladderStep(states[ladderKey(planId, ex.exercise)], ex.ladderMax, excludeInstanceId)
      return applyLadder(ex, step)
    }),
  }
}

/** Record one session's result. A hit advances the ladder; a miss un-counts the session if it had been a hit. */
export function recordLadderResult(
  state: LadderState | undefined,
  max: number,
  instanceId: string,
  hit: boolean,
): LadderState {
  const base = state && state.max === max ? state : { max, hits: [] }
  const others = base.hits.filter(id => id !== instanceId)
  return { max, hits: hit ? [...others, instanceId] : others }
}
