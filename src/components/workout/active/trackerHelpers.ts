import type { ExerciseSpec, WarmupRampSpec } from '../../../types/program'
import type { LoggedSetActual } from '../../../modules/workout-outcomes/types'

export interface SetTrackState {
  setElapsedSeconds: number
  completed: boolean
  actualReps: number | null
  actualLoad: number | null
  targetReps: number | string | null
  targetLoad: string | null
  restSeconds: number | null
  actualRestSeconds: number | null
  resolvedLoadLbs: number | null
  isWarmup?: boolean
  /** True when the set is measured in seconds (duration-based) rather than reps. */
  isTimed?: boolean
}

export interface ExerciseTrackState {
  exercise: string
  isWarmup: boolean
  sets: SetTrackState[]
  previousSets?: LoggedSetActual[]
  addedDuringWorkout?: boolean
  progressionMode?: string
  supersetGroupId?: string
  /** Rep-ladder position, e.g. "Ladder session 3/24 · max 5". */
  ladderStatus?: string
}


export function parseWarmupPercentages(warmup: ExerciseSpec['warmup']): number[] {
  if (!warmup) return []
  if (typeof warmup === 'string') {
    return warmup
      .split(/[/;,]+/)
      .map(part => part.trim().match(/(\d+(?:\.\d+)?)\s*%?/)?.[1])
      .filter((part): part is string => Boolean(part))
      .map(Number)
      .filter(n => Number.isFinite(n) && n > 0)
  }
  return warmup.percentages.filter(n => Number.isFinite(n) && n > 0)
}

export function warmupRampObject(warmup: ExerciseSpec['warmup']): WarmupRampSpec | null {
  return warmup && typeof warmup === 'object' ? warmup : null
}

export function warmupRepsForIndex(warmup: ExerciseSpec['warmup'], index: number): number | string {
  const explicit = warmupRampObject(warmup)?.reps?.[index]
  if (explicit != null) return explicit
  return [8, 5, 3, 2, 1][index] ?? 1
}


function parseRepRange(reps: number | string | null | undefined): { low: number; high: number } | null {
  if (reps == null || typeof reps === 'number') return null
  const m = reps.match(/^\s*(\d+)\s*[-–]\s*(\d+)\s*$/)
  if (!m) return null
  return { low: parseInt(m[1]), high: parseInt(m[2]) }
}

export function resolveDoubleProgressionTarget(
  reps: number | string | null | undefined,
  prevReps: number | null | undefined,
): number | string | null {
  if (reps == null) return null
  const range = parseRepRange(reps)
  if (!range) return typeof reps === 'string' ? reps : reps
  const { low, high } = range
  if (prevReps == null) return low
  if (prevReps >= high) return low
  return Math.min(prevReps + 1, high)
}

export function resolveActualReps(actualReps: number | null, targetReps: number | string | null): number | null {
  if (typeof actualReps === 'number') return actualReps
  if (typeof targetReps === 'number') return targetReps
  if (typeof targetReps !== 'string') return null

  const range = targetReps.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/)
  if (range) {
    const low = Number(range[1])
    const high = Number(range[2])
    return Number.isFinite(high) ? Math.max(low, high) : null
  }

  const single = Number(targetReps.trim())
  return Number.isFinite(single) ? single : null
}
/**
 * True when a logged work set came in under its target reps. For a range
 * ("8-12") the bottom of the range is the bar. Warmups, timed sets, and sets
 * without a numeric target never count as missed.
 */
export function missedTargetReps(set: Pick<SetTrackState, 'actualReps' | 'targetReps' | 'isWarmup' | 'isTimed'>): boolean {
  if (set.isWarmup || set.isTimed || set.actualReps == null) return false
  const target = typeof set.targetReps === 'number'
    ? set.targetReps
    : parseRepRange(set.targetReps)?.low ?? Number(set.targetReps?.trim())
  return Number.isFinite(target) && set.actualReps < target
}

export function fmt(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

export function parseRestSecs(rest?: string | null): number | null {
  if (!rest) return null
  const s = rest.trim().toLowerCase()
  if (s.endsWith('m')) return Math.round(Number(s.slice(0, -1)) * 60)
  if (s.endsWith('s')) return Number(s.slice(0, -1))
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function parseNumericLoad(load?: string | null): number | null {
  if (!load) return null
  const m = load.match(/(\d+(\.\d+)?)/)
  return m ? Number(m[1]) : null
}

export function parseInputNumber(v: string): number | null {
  if (!v.trim()) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
