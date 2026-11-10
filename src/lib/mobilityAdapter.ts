// Bridges mobility routines (mobilityStore / a plan day's `mobility` slot) and
// the shared ActiveWorkoutTracker, so mobility runs on the same tracker as
// strength work: timed holds become timed sets, rep sets stay rep sets, and
// there's no load.
//
// Mobility storage is untouched — routines go in as ExerciseSpecs and the
// tracker's logged result comes back out as the mobility shapes the rest of
// the app already reads (MobilityWorkoutActual / MobilityCompletion).

import type { WorkoutSlot } from '../types'
import type { ExerciseSpec, SetSpec } from '../types/program'
import type { LoggedExerciseActual, MobilityWorkoutActual, WorkoutCompletionState, WorkoutOutcome } from '../modules/workout-outcomes/types'
import { MOBILITY_LIBRARY, normalizeMobilityRoutine, singleTimedSet, type MobilityRoutineExercise, type MobilitySet } from './mobilityLibrary'
import { nanoid } from './utils'

/** Default hold for a custom exercise added mid-session that isn't in the library. */
export const DEFAULT_MOBILITY_HOLD_SEC = 30

function toSetSpec(s: MobilitySet): SetSpec {
  if (s.reps != null) return { reps: s.reps }
  return { duration: `${s.durationSec ?? DEFAULT_MOBILITY_HOLD_SEC}s` }
}

/** One mobility routine exercise → a tracker ExerciseSpec (no load, no warmup ramp). */
export function mobilityExerciseToSpec(ex: MobilityRoutineExercise): ExerciseSpec {
  return {
    exercise: ex.name,
    sets: ex.sets.map(toSetSpec),
    ...(ex.restSec && ex.restSec > 0 ? { rest: `${ex.restSec}s` } : {}),
    ...(ex.notes ? { notes: ex.notes } : {}),
    warmup: 'none',
  }
}

export function mobilityRoutineToExercises(
  routine: MobilityRoutineExercise[] | undefined | null,
): ExerciseSpec[] {
  return normalizeMobilityRoutine(routine).map(mobilityExerciseToSpec)
}

/** A mobility routine wrapped as a `mobility` WorkoutSlot the tracker can run. */
export function mobilityRoutineToSlot(
  routine: MobilityRoutineExercise[] | undefined | null,
  slot: { id: string; name: string },
): WorkoutSlot {
  return {
    id: slot.id,
    type: 'mobility',
    name: slot.name,
    exercises: mobilityRoutineToExercises(routine),
  }
}

/** Default dosing for an exercise added from the mobility library mid-session. */
export function mobilityLibraryHoldSec(name: string): number {
  const lib = MOBILITY_LIBRARY.find(e => e.name.toLowerCase() === name.trim().toLowerCase())
  return lib?.durationSec ?? DEFAULT_MOBILITY_HOLD_SEC
}

/**
 * The tracker's logged exercises → the mobility outcome shape. Timed sets carry
 * their seconds in `actualReps`/`targetReps` (flagged `isTimed`), so they're
 * split back out into duration fields here.
 */
export function trackedToMobilityActual(logged: LoggedExerciseActual[]): MobilityWorkoutActual {
  return {
    exercises: logged.map(ex => ({
      exercise: ex.exercise,
      sets: ex.sets.map(s => {
        const target = typeof s.targetReps === 'number' ? s.targetReps : null
        const actual = s.completed ? (s.actualReps ?? null) : null
        return s.isTimed
          ? { targetDurationSec: target, targetReps: null, actualDurationSec: actual, actualReps: null, completed: !!s.completed }
          : { targetDurationSec: null, targetReps: target, actualDurationSec: null, actualReps: actual, completed: !!s.completed }
      }),
    })),
  }
}

/**
 * Progress keyed by routine exercise id, as mobilityStore's completions record
 * it. Tracker results only carry names, so each is matched to the first unused
 * routine exercise with that name; exercises added mid-session (no match) get
 * a stable synthetic id from their name.
 */
export function trackedToMobilityProgress(
  logged: LoggedExerciseActual[],
  routine: MobilityRoutineExercise[] | undefined | null,
): { completedExerciseIds: string[]; completedSets: Record<string, number[]> } {
  const pool = normalizeMobilityRoutine(routine).map(ex => ({ id: ex.id, name: ex.name.trim().toLowerCase(), used: false }))
  const completedExerciseIds: string[] = []
  const completedSets: Record<string, number[]> = {}
  logged.forEach(ex => {
    const key = ex.exercise.trim().toLowerCase()
    const match = pool.find(p => !p.used && p.name === key)
    if (match) match.used = true
    let id = match?.id ?? `added-${key.replace(/[^a-z0-9]+/g, '-')}`
    for (let n = 2; !match && id in completedSets; n++) id = `added-${key.replace(/[^a-z0-9]+/g, '-')}-${n}`
    const done = ex.sets.flatMap((s, i) => (s.completed ? [i] : []))
    completedSets[id] = done
    if (ex.sets.length > 0 && done.length === ex.sets.length) completedExerciseIds.push(id)
  })
  return { completedExerciseIds, completedSets }
}

// ── Saving picker changes back to a routine ────────────────────────────────

/** A new routine entry for `name`: the library id + default hold when it's a library exercise. */
export function routineExerciseFromName(name: string, existing: MobilityRoutineExercise[]): MobilityRoutineExercise {
  const lib = MOBILITY_LIBRARY.find(e => e.name.toLowerCase() === name.trim().toLowerCase())
  const id = lib && !existing.some(e => e.id === lib.id) ? lib.id : nanoid()
  return { id, name: lib?.name ?? name.trim(), sets: singleTimedSet(lib?.durationSec ?? DEFAULT_MOBILITY_HOLD_SEC) }
}

export function insertRoutineExercise(
  routine: MobilityRoutineExercise[],
  name: string,
  index: number,
): MobilityRoutineExercise[] {
  const at = Math.max(0, Math.min(index, routine.length))
  return [...routine.slice(0, at), routineExerciseFromName(name, routine), ...routine.slice(at)]
}

/** Swap the exercise at `index` for `name`, keeping its dosing, rest, and notes. */
export function replaceRoutineExercise(
  routine: MobilityRoutineExercise[],
  index: number,
  name: string,
): MobilityRoutineExercise[] {
  if (!routine[index]) return routine
  const others = routine.filter((_, i) => i !== index)
  const { id, name: newName } = routineExerciseFromName(name, others)
  return routine.map((ex, i) => (i === index ? { ...ex, id, name: newName } : ex))
}

// ── Reopening a logged routine ──────────────────────────────────────────────

/**
 * A logged daily-routine completion as a tracker resume outcome, so "finish
 * the rest" reopens with the done sets already checked off and the time so far.
 */
export function mobilityCompletionToResumeOutcome(
  completion: { completedAt: string; durationMin: number; completedExerciseIds: string[]; completedSets?: Record<string, number[]> },
  routine: MobilityRoutineExercise[] | undefined | null,
  workoutInstanceId: string,
): WorkoutOutcome {
  return {
    workoutInstanceId,
    completionState: 'partially_completed',
    completedAt: completion.completedAt,
    durationActualMin: completion.durationMin,
    weightsActual: {
      exercises: normalizeMobilityRoutine(routine).map(ex => {
        const done = completion.completedSets?.[ex.id]
          ?? (completion.completedExerciseIds.includes(ex.id) ? ex.sets.map((_, i) => i) : [])
        return { exercise: ex.name, sets: ex.sets.map((_, i) => ({ completed: done.includes(i) })) }
      }),
    },
  }
}

/** Completed when every routine exercise is done (or there are none), partial when some are. */
export function mobilityCompletionState(
  routine: MobilityRoutineExercise[] | undefined | null,
  completedExerciseIds: string[],
): WorkoutCompletionState {
  const exercises = normalizeMobilityRoutine(routine)
  if (exercises.length === 0 || exercises.every(ex => completedExerciseIds.includes(ex.id))) return 'completed'
  // Any finished exercise counts, including ones added mid-session.
  return completedExerciseIds.length > 0 ? 'partially_completed' : 'skipped'
}
