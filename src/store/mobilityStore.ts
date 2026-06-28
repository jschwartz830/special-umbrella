import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from '../lib/utils'

export interface MobilityExercise {
  id: string
  name: string
  durationSec: number
}

export interface MobilityCompletion {
  completedAt: string
  durationMin: number
  completedExerciseIds: string[]
}

const DEFAULT_ROUTINE: MobilityExercise[] = [
  { id: 'hip-90-90', name: 'Hip 90/90', durationSec: 60 },
  { id: 'worlds-greatest', name: "World's Greatest Stretch", durationSec: 60 },
  { id: 'cat-cow', name: 'Cat-Cow', durationSec: 60 },
  { id: 'thread-needle', name: 'Thread the Needle', durationSec: 45 },
  { id: 'pigeon-pose', name: 'Pigeon Pose', durationSec: 60 },
  { id: 'shoulder-cars', name: 'Shoulder CARs', durationSec: 30 },
  { id: 'ankle-circles', name: 'Ankle Circles', durationSec: 30 },
]

interface MobilityState {
  routine: MobilityExercise[]
  completions: Record<string, MobilityCompletion>

  setRoutine: (exercises: MobilityExercise[]) => void
  addExercise: (name: string, durationSec: number) => void
  removeExercise: (id: string) => void
  reorderExercise: (fromIdx: number, toIdx: number) => void
  logCompletion: (date: string, completion: MobilityCompletion) => void
  removeCompletion: (date: string) => void
}

export const useMobilityStore = create<MobilityState>()(
  persist(
    (set) => ({
      routine: DEFAULT_ROUTINE,
      completions: {},

      setRoutine(exercises) {
        set({ routine: exercises })
      },

      addExercise(name, durationSec) {
        set(s => ({
          routine: [...s.routine, { id: nanoid(), name, durationSec }],
        }))
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
    }),
    { name: 'wpt_mobility', version: 1 },
  ),
)
