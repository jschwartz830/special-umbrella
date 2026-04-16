import {
  Dumbbell,
  Footprints,
  Wind,
  Waves,
  Flower2,
  Moon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { WorkoutType } from '../types'
import type { WorkoutDifficulty } from '../modules/workout-metadata/types'

export interface WorkoutMeta {
  label: string
  bgColor: string
  borderColor: string
  textColor: string
  ringColor: string
  icon: LucideIcon
}

export const WORKOUT_META: Record<WorkoutType, WorkoutMeta> = {
  weightlifting: {
    label: 'Weights',
    bgColor: 'bg-orange-500',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-600',
    ringColor: 'ring-orange-400',
    icon: Dumbbell,
  },
  long_run: {
    label: 'Long Run',
    bgColor: 'bg-emerald-500',
    borderColor: 'border-emerald-500',
    textColor: 'text-emerald-600',
    ringColor: 'ring-emerald-400',
    icon: Footprints,
  },
  recovery_run: {
    label: 'Recovery Run',
    bgColor: 'bg-teal-500',
    borderColor: 'border-teal-500',
    textColor: 'text-teal-600',
    ringColor: 'ring-teal-400',
    icon: Wind,
  },
  swim: {
    label: 'Swim',
    bgColor: 'bg-sky-500',
    borderColor: 'border-sky-500',
    textColor: 'text-sky-600',
    ringColor: 'ring-sky-400',
    icon: Waves,
  },
  yoga: {
    label: 'Yoga',
    bgColor: 'bg-purple-500',
    borderColor: 'border-purple-500',
    textColor: 'text-purple-600',
    ringColor: 'ring-purple-400',
    icon: Flower2,
  },
  rest: {
    label: 'Rest',
    bgColor: 'bg-slate-400',
    borderColor: 'border-slate-400',
    textColor: 'text-slate-500',
    ringColor: 'ring-slate-300',
    icon: Moon,
  },
}

export const WORKOUT_TYPES: WorkoutType[] = [
  'weightlifting',
  'long_run',
  'recovery_run',
  'swim',
  'yoga',
  'rest',
]

// ── Difficulty display metadata ───────────────────────────────────────────────

export interface DifficultyMeta {
  label: string
  bgColor: string
  textColor: string
  borderColor: string
}

export const DIFFICULTY_META: Record<WorkoutDifficulty, DifficultyMeta> = {
  easy: {
    label: 'Easy',
    bgColor: 'bg-emerald-500/15',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
  },
  moderate: {
    label: 'Moderate',
    bgColor: 'bg-yellow-500/15',
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/30',
  },
  hard: {
    label: 'Hard',
    bgColor: 'bg-red-500/15',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
  },
}
