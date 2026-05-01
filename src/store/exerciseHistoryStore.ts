import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from '../engine/rotationEngine'
import type { WorkoutOutcome } from '../modules/workout-outcomes/types'

// ── Per-set record ────────────────────────────────────────────────────────────

export interface ExerciseSetRecord {
  reps: number | null
  load: number | null   // lbs
  volume: number | null // reps * load (null if either is missing)
  completed: boolean
}

// ── Per-exercise-per-workout record ──────────────────────────────────────────

export interface ExerciseSessionRecord {
  id: string
  exerciseName: string
  calendarDate: string        // YYYY-MM-DD
  planId: string | null
  planName: string | null     // snapshot at log time; survives plan deletion
  workoutName: string | null  // snapshot at log time
  workoutInstanceId: string   // cross-reference key for outcomeStore
  sets: ExerciseSetRecord[]
  // Pre-computed summaries for fast charting / PR detection
  totalVolume: number | null  // sum of (reps × load) across completed sets
  maxLoad: number | null      // heaviest completed set
  maxReps: number | null      // highest rep count in a completed set
  createdAt: string
}

// ── Context passed at log time ────────────────────────────────────────────────

export interface ExerciseLogContext {
  planName?: string | null
  workoutName?: string | null
}

// ── Store interface ───────────────────────────────────────────────────────────

interface ExerciseHistoryState {
  records: ExerciseSessionRecord[]

  /**
   * Write (or replace) all exercise records for a given workout outcome.
   * Idempotent: re-logging the same workoutInstanceId replaces prior records.
   */
  upsertFromOutcome: (outcome: WorkoutOutcome, ctx?: ExerciseLogContext) => void

  /** Remove all records tied to a workout instance (called when outcome is deleted). */
  removeByWorkoutInstance: (workoutInstanceId: string) => void

  /** Re-key records from one instance id to another (called when outcome is moved). */
  moveByWorkoutInstance: (oldId: string, newId: string) => void

  /** Delete all records for a plan (called when the plan is deleted). */
  clearByPlanId: (planId: string) => void

  /** Return all records for a given exercise, sorted oldest-first. */
  getByExerciseName: (exerciseName: string) => ExerciseSessionRecord[]

  /** Return all unique exercise names that have been logged, sorted. */
  getAllExerciseNames: () => string[]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type RawSet = NonNullable<NonNullable<WorkoutOutcome['weightsActual']>['exercises']>[0]['sets'][0]

function toSetRecord(s: RawSet): ExerciseSetRecord {
  const reps = s.actualReps ?? null
  const load = s.actualLoad ?? null
  return {
    reps,
    load,
    volume: reps !== null && load !== null ? reps * load : null,
    completed: s.completed ?? false,
  }
}

function summarize(sets: ExerciseSetRecord[]): Pick<ExerciseSessionRecord, 'totalVolume' | 'maxLoad' | 'maxReps'> {
  const done = sets.filter(s => s.completed)
  const vols = done.flatMap(s => (s.volume !== null ? [s.volume] : []))
  const loads = done.flatMap(s => (s.load !== null ? [s.load] : []))
  const reps = done.flatMap(s => (s.reps !== null ? [s.reps] : []))
  return {
    totalVolume: vols.length ? vols.reduce((a, b) => a + b, 0) : null,
    maxLoad: loads.length ? Math.max(...loads) : null,
    maxReps: reps.length ? Math.max(...reps) : null,
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useExerciseHistoryStore = create<ExerciseHistoryState>()(
  persist(
    (set, get) => ({
      records: [],

      upsertFromOutcome(outcome, ctx = {}) {
        const exercises = outcome.weightsActual?.exercises
        if (!exercises || exercises.length === 0) return

        // workoutInstanceId is `${planId}_${calendarDate}[_extra_${extraId}]`
        // planIds are base36 (no underscores), calendarDate is YYYY-MM-DD
        const parts = outcome.workoutInstanceId.split('_')
        const planId = parts[0] || null
        const calendarDate = parts[1] || null
        if (!calendarDate) return

        const now = new Date().toISOString()
        const newRecords: ExerciseSessionRecord[] = exercises.map(ex => {
          const sets = (ex.sets ?? []).map(toSetRecord)
          return {
            id: nanoid(),
            exerciseName: ex.exercise,
            calendarDate,
            planId,
            planName: ctx.planName ?? null,
            workoutName: ctx.workoutName ?? null,
            workoutInstanceId: outcome.workoutInstanceId,
            sets,
            ...summarize(sets),
            createdAt: now,
          }
        })

        set(s => ({
          records: [
            ...s.records.filter(r => r.workoutInstanceId !== outcome.workoutInstanceId),
            ...newRecords,
          ],
        }))
      },

      removeByWorkoutInstance(workoutInstanceId) {
        set(s => ({ records: s.records.filter(r => r.workoutInstanceId !== workoutInstanceId) }))
      },

      moveByWorkoutInstance(oldId, newId) {
        set(s => ({
          records: s.records.map(r =>
            r.workoutInstanceId === oldId
              ? { ...r, workoutInstanceId: newId }
              : r,
          ),
        }))
      },

      clearByPlanId(planId) {
        set(s => ({ records: s.records.filter(r => r.planId !== planId) }))
      },

      getByExerciseName(exerciseName) {
        return get().records
          .filter(r => r.exerciseName === exerciseName)
          .sort((a, b) => a.calendarDate.localeCompare(b.calendarDate))
      },

      getAllExerciseNames() {
        return [...new Set(get().records.map(r => r.exerciseName))].sort()
      },
    }),
    { name: 'wpt_exercise_history' },
  ),
)
