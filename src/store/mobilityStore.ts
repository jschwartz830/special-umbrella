import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from '../lib/utils'
import {
  MOBILITY_LIBRARY,
  singleTimedSet,
  type MobilityPreset,
  type MobilityRoutineExercise,
  type MobilitySet,
} from '../lib/mobilityLibrary'

export type MobilityExercise = MobilityRoutineExercise

export interface MobilityCompletion {
  completedAt: string
  durationMin: number
  completedExerciseIds: string[]
}

export interface MobilitySessionCheckpoint {
  date: string
  exerciseIds: string[]   // routine snapshot at session start
  currentIdx: number
  currentSetIdx: number   // which set within the current exercise
  completedIds: string[]  // exercises with every set completed
  completedSets: Record<string, number[]>  // exerciseId -> completed set indices
  totalElapsedSec: number
  exElapsedSec: number    // accumulated time on the current timed set before pause
}

const DEFAULT_ROUTINE: MobilityExercise[] = [
  { id: 'hip-90-90', name: 'Hip 90/90', sets: singleTimedSet(60) },
  { id: 'worlds-greatest', name: "World's Greatest Stretch", sets: singleTimedSet(60) },
  { id: 'cat-cow', name: 'Cat-Cow', sets: singleTimedSet(60) },
  { id: 'thread-needle', name: 'Thread the Needle', sets: singleTimedSet(45) },
  { id: 'pigeon-pose', name: 'Pigeon Pose', sets: singleTimedSet(60) },
  { id: 'shoulder-cars', name: 'Shoulder CARs', sets: singleTimedSet(30) },
  { id: 'ankle-circles', name: 'Ankle Circles', sets: singleTimedSet(30) },
]

interface MobilityState {
  routine: MobilityExercise[]
  completions: Record<string, MobilityCompletion>
  activeSession: MobilitySessionCheckpoint | null
  soundEnabled: boolean

  setSoundEnabled: (enabled: boolean) => void
  setRoutine: (exercises: MobilityExercise[]) => void
  addExercise: (name: string, sets?: MobilitySet[]) => void
  addExerciseFromLibrary: (libraryId: string) => void
  removeExercise: (id: string) => void
  reorderExercise: (fromIdx: number, toIdx: number) => void
  updateExercise: (id: string, patch: Partial<Pick<MobilityExercise, 'name' | 'restSec' | 'notes'>>) => void
  addSet: (exerciseId: string, set?: MobilitySet) => void
  updateSet: (exerciseId: string, setIdx: number, patch: MobilitySet) => void
  removeSet: (exerciseId: string, setIdx: number) => void
  loadPreset: (preset: MobilityPreset, mode: 'replace' | 'append') => void
  logCompletion: (date: string, completion: MobilityCompletion) => void
  removeCompletion: (date: string) => void
  startSession: (date: string, exerciseIds: string[]) => void
  saveCheckpoint: (cp: MobilitySessionCheckpoint) => void
  clearSession: () => void
}

export const useMobilityStore = create<MobilityState>()(
  persist(
    (set) => ({
      routine: DEFAULT_ROUTINE,
      completions: {},
      activeSession: null,
      soundEnabled: true,

      setSoundEnabled(enabled) {
        set({ soundEnabled: enabled })
      },

      setRoutine(exercises) {
        set({ routine: exercises })
      },

      addExercise(name, sets) {
        set(s => ({
          routine: [...s.routine, { id: nanoid(), name, sets: sets && sets.length > 0 ? sets : singleTimedSet(30) }],
        }))
      },

      addExerciseFromLibrary(libraryId) {
        const libEx = MOBILITY_LIBRARY.find(e => e.id === libraryId)
        if (!libEx) return
        set(s => {
          if (s.routine.some(e => e.id === libraryId)) return s
          return { routine: [...s.routine, { id: libraryId, name: libEx.name, sets: singleTimedSet(libEx.durationSec) }] }
        })
      },

      removeExercise(id) {
        set(s => ({ routine: s.routine.filter(e => e.id !== id) }))
      },

      reorderExercise(fromIdx, toIdx) {
        set(s => {
          const next = [...s.routine]
          const [moved] = next.splice(fromIdx, 1)
          next.splice(toIdx, 0, moved)
          return { routine: next }
        })
      },

      updateExercise(id, patch) {
        set(s => ({
          routine: s.routine.map(e => e.id === id ? { ...e, ...patch } : e),
        }))
      },

      addSet(exerciseId, newSet) {
        set(s => ({
          routine: s.routine.map(e => {
            if (e.id !== exerciseId) return e
            const last = e.sets[e.sets.length - 1]
            return { ...e, sets: [...e.sets, newSet ?? last ?? { durationSec: 30 }] }
          }),
        }))
      },

      updateSet(exerciseId, setIdx, patch) {
        set(s => ({
          routine: s.routine.map(e => {
            if (e.id !== exerciseId) return e
            return { ...e, sets: e.sets.map((st, i) => i === setIdx ? { ...patch } : st) }
          }),
        }))
      },

      removeSet(exerciseId, setIdx) {
        set(s => ({
          routine: s.routine.map(e => {
            if (e.id !== exerciseId || e.sets.length <= 1) return e
            return { ...e, sets: e.sets.filter((_, i) => i !== setIdx) }
          }),
        }))
      },

      loadPreset(preset, mode) {
        const incoming: MobilityExercise[] = preset.exercises.map(pe => {
          const libEx = MOBILITY_LIBRARY.find(e => e.id === pe.exerciseId)
          return { id: pe.exerciseId, name: libEx?.name ?? pe.exerciseId, sets: singleTimedSet(pe.durationSec) }
        })
        set(s => {
          if (mode === 'replace') return { routine: incoming }
          const existing = new Set(s.routine.map(e => e.id))
          const toAdd = incoming.filter(e => !existing.has(e.id))
          return { routine: [...s.routine, ...toAdd] }
        })
      },

      logCompletion(date, completion) {
        set(s => ({ completions: { ...s.completions, [date]: completion } }))
      },

      removeCompletion(date) {
        set(s => {
          const next = { ...s.completions }
          delete next[date]
          return { completions: next }
        })
      },

      startSession(date, exerciseIds) {
        set({
          activeSession: {
            date,
            exerciseIds,
            currentIdx: 0,
            currentSetIdx: 0,
            completedIds: [],
            completedSets: {},
            totalElapsedSec: 0,
            exElapsedSec: 0,
          },
        })
      },

      saveCheckpoint(cp) {
        set({ activeSession: cp })
      },

      clearSession() {
        set({ activeSession: null })
      },
    }),
    {
      name: 'wpt_mobility',
      version: 3,
      migrate: migrateMobilityState,
    },
  ),
)

/** @internal Exported for testing — see src/store/__tests__/mobilityStore.test.ts */
export function migrateMobilityState(state: unknown, fromVersion: number): unknown {
  if (fromVersion <= 1) {
    state = { ...(state as object), activeSession: null }
  }
  if (fromVersion <= 2) {
    const s = state as { routine?: Array<{ id: string; name: string; durationSec?: number; sets?: MobilitySet[] }> }
    const routine = (s.routine ?? []).map(e => ({
      id: e.id,
      name: e.name,
      sets: e.sets ?? singleTimedSet(e.durationSec ?? 30),
    }))
    state = { ...(state as object), routine, activeSession: null }
  }
  return state
}
