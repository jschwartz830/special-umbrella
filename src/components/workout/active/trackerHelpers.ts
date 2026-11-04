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
  /** Barbell loading step from the previous set, per side ("+25s", "−10s, +35s"). */
  plateNote?: string
  /** The weight the note was planned for; the note hides once the weight is edited. */
  plateNoteLoad?: number | null
  /** The planned per-side stack for plateNoteLoad, so the Plates line matches the loading note. */
  platePerSide?: number[]
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

/**
 * The set to do next: the first unfinished set, or the first unfinished set of
 * `focusExIdx` when one is focused. Supersets alternate — warmups first, then
 * working sets. Within a group, while any member has warmups left, the member
 * with the fewest finished warmups goes next (A-w1 → B-w1 → A-w2 → B-w2); after
 * that, the member with the fewest finished working sets (A1 → B1 → A2 → B2).
 * Ties go to plan order.
 */
export function findNextSet(
  exercises: Pick<ExerciseTrackState, 'sets' | 'supersetGroupId'>[],
  focusExIdx: number | null = null,
): { exIdx: number; setIdx: number } | null {
  const nextIn = (ei: number) => exercises[ei].sets.findIndex(s => !s.completed)
  const nextWarmupIn = (ei: number) => exercises[ei].sets.findIndex(s => !s.completed && s.isWarmup)
  const done = (ei: number, warmup: boolean) =>
    exercises[ei].sets.filter(s => s.completed && !!s.isWarmup === warmup).length

  let start = focusExIdx != null && exercises[focusExIdx] && nextIn(focusExIdx) !== -1 ? focusExIdx : -1
  if (start === -1) start = exercises.findIndex((_, ei) => nextIn(ei) !== -1)
  if (start === -1) return null

  const groupId = exercises[start].supersetGroupId
  if (!groupId) return { exIdx: start, setIdx: nextIn(start) }

  const members = exercises.map((_, ei) => ei).filter(ei => exercises[ei].supersetGroupId === groupId)
  const pick = (candidates: number[], warmup: boolean) => candidates.reduce((best, ei) =>
    done(ei, warmup) < done(best, warmup) || (done(ei, warmup) === done(best, warmup) && ei < best) ? ei : best)

  // Warmups for every member come before anyone's working sets.
  const warming = members.filter(ei => nextWarmupIn(ei) !== -1)
  if (warming.length > 0) {
    const ei = pick(warming, true)
    return { exIdx: ei, setIdx: nextWarmupIn(ei) }
  }
  const working = members.filter(ei => nextIn(ei) !== -1)
  const ei = pick(working, false)
  return { exIdx: ei, setIdx: nextIn(ei) }
}
