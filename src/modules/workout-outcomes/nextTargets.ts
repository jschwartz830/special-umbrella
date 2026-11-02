import type { WorkoutSlot } from '../../types'
import type { ExerciseSpec, SetSpec } from '../../types/program'
import type { LoggedExerciseActual } from './types'
import { resolveLoad } from '../../lib/expressionEval'
import { deriveProgressionMode } from './progressionMode'
import { evaluateExerciseProgress } from './exerciseProgress'
import { isLadderExercise, ladderKey, withAutoProgression, type LadderState } from '../rep-ladder/ladder'
import { isRepSchemeExercise, formatStep } from '../rep-ladder/repScheme'

/**
 * Next-session targets for each lift, shown right after a weights workout is logged.
 * Mirrors what the tracker will prefill next time: program-variable loads after this
 * session's rules ran, rep ladders / rep schemes after this session was recorded, and
 * double-progression rep targets from today's reps. Fixed loads only get a suggestion.
 */

export type NextTargetChange = 'up' | 'down' | 'hold' | 'deload' | 'none'

export interface NextTarget {
  exercise: string
  /** Load (lb) next session; null for bodyweight / unloaded work. */
  load: number | null
  /** Rep target(s): "7", "8/8/6", "3×6", "45s". Null when there's no target. */
  reps: string | null
  change: NextTargetChange
  /** Short reason: "+5 lb", "+1 rep", "next step", "repeat", "deload week — no progression". */
  detail: string
}

export interface NextTargetInput {
  planId: string
  workoutInstanceId: string
  /** This session's weights slot as it was shown (week values filled in, deload applied). */
  slot: WorkoutSlot
  logged: LoggedExerciseActual[]
  varsBefore: Record<string, number>
  varsAfter: Record<string, number>
  /** Rep-ladder / rep-scheme progress after this session was recorded. */
  ladderStates: Record<string, LadderState>
  effort?: number | null
}

/** Fixed-load lifts: the suggested jump after a session where every set hit its target. */
export const FIXED_LOAD_INCREMENT_LB = 5

const DELOAD_DETAIL = 'deload week — no progression'

function setSpecs(ex: ExerciseSpec): Array<{ reps?: number | string; load?: string; duration?: string }> {
  if (Array.isArray(ex.sets) && ex.sets.length > 0) {
    return ex.sets.filter((s: SetSpec) => !s.isWarmup).map(s => ({
      reps: s.reps ?? ex.reps,
      load: s.load ?? ex.load,
      duration: s.duration ?? ex.duration,
    }))
  }
  const n = typeof ex.sets === 'number' && ex.sets >= 1 ? ex.sets : 3
  return Array.from({ length: n }, () => ({ reps: ex.reps, load: ex.load, duration: ex.duration }))
}

function resolveReps(reps: number | string | undefined, vars: Record<string, number>): number | string | undefined {
  if (typeof reps !== 'string') return reps
  const t = reps.trim()
  return /^[a-zA-Z_]\w*$/.test(t) && t in vars ? vars[t] : reps
}

function usesVars(load: string | undefined, vars: Record<string, number>): boolean {
  if (!load) return false
  const ids = load.replace(/\s*(lbs?|kg)\s*$/i, '').match(/[a-zA-Z_]\w*/g) ?? []
  return ids.some(id => id in vars)
}

function topLoad(ex: ExerciseSpec, vars: Record<string, number>): number | null {
  const loads = setSpecs(ex)
    .map(s => s.load ? resolveLoad(s.load, { vars }) : null)
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
  return loads.length > 0 ? Math.max(...loads) : null
}

function parseRange(reps: number | string | undefined): { low: number; high: number } | null {
  if (typeof reps !== 'string') return null
  const m = reps.match(/^\s*(\d+)\s*[-–]\s*(\d+)\s*$/)
  return m ? { low: Number(m[1]), high: Number(m[2]) } : null
}

/** "7" when every set matches, else "8/8/6". */
function joinReps(reps: Array<number | string | undefined>): string | null {
  const shown = reps.filter((r): r is number | string => r != null && r !== '').map(String)
  if (shown.length === 0) return null
  return shown.every(r => r === shown[0]) ? shown[0] : shown.join('/')
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** Typical per-set rep increase between two rep-target lists (0 when none rose). */
function repsGain(before: Array<number | string | undefined>, after: Array<number | string | undefined>): number {
  const ups = after.map((a, i) => {
    const b = before[i]
    return typeof a === 'number' && typeof b === 'number' ? a - b : 0
  }).filter(d => d > 0)
  return ups.length > 0 ? Math.max(...ups) : 0
}

function fmtLb(n: number): string {
  return `${Math.round(n * 10) / 10} lb`
}

function nextForLadder(spec: ExerciseSpec, logged: LoggedExerciseActual, input: NextTargetInput, load: number | null, deload: boolean): NextTarget {
  const { deloadSets: _deload, ...full } = spec
  const next = withAutoProgression(full, input.planId, input.ladderStates)
  const reps = Array.isArray(next.sets) ? next.sets.map(s => Number(s.reps)).filter(Number.isFinite) : []
  const base = { exercise: logged.exercise, load, reps: reps.length > 0 ? formatStep(reps) : null }
  if (deload) return { ...base, change: 'deload', detail: 'deload week — same step next time' }

  const hit = input.ladderStates[ladderKey(input.planId, spec.exercise)]?.hits.includes(input.workoutInstanceId) ?? false
  if (!hit) return { ...base, change: 'hold', detail: 'repeat this step' }
  const status = next.ladderStatus ?? ''
  if (status.startsWith('Ladder cycle complete')) return { ...base, change: 'hold', detail: 'cycle complete — retest your max' }
  if (status.startsWith('New cycle')) return { ...base, change: 'up', detail: 'new cycle — make it harder' }
  return { ...base, change: 'up', detail: isLadderExercise(spec) ? '+1 rep' : 'next step' }
}

function nextForExercise(spec: ExerciseSpec | undefined, logged: LoggedExerciseActual, input: NextTargetInput): NextTarget {
  const deload = input.slot.isDeload === true
  const work = logged.sets.filter(s => !s.isWarmup)
  const done = work.filter(s => s.completed)
  const loads = done.map(s => s.actualLoad ?? 0).filter(n => n > 0)
  const lastLoad = loads.length > 0 ? Math.max(...loads) : null

  if (!spec) {
    return { exercise: logged.exercise, load: lastLoad, reps: joinReps(done.map(s => s.actualReps ?? undefined)), change: 'none', detail: 'same as today' }
  }

  if (isLadderExercise(spec) || isRepSchemeExercise(spec)) {
    return nextForLadder(spec, logged, input, lastLoad, deload)
  }

  const specs = setSpecs(spec)
  const result = evaluateExerciseProgress(spec, logged)
  const mode = deriveProgressionMode(spec.progressionType, spec.progress != null) ?? logged.progressionMode
  const isDouble = mode === 'double'
  const actualAt = (i: number) => work[Math.min(i, work.length - 1)]?.actualReps ?? null

  // Rep targets for next time (double progression walks up the range from today's reps).
  const repsFor = (vars: Record<string, number>) => specs.map((s, i) => {
    const r = resolveReps(s.reps, vars)
    if (r == null) return s.duration
    const range = parseRange(r)
    if (isDouble && range && !deload) {
      const prev = actualAt(i)
      if (prev == null) return range.low
      return prev >= range.high ? range.low : Math.min(prev + 1, range.high)
    }
    return r
  })

  // Program-variable loads (`squat`, `0.8 * bench`) — the rules already ran.
  if (usesVars(spec.load, input.varsAfter) || specs.some(s => usesVars(s.load, input.varsAfter))) {
    const before = topLoad(spec, input.varsBefore)
    const after = topLoad(spec, input.varsAfter)
    const repsAfter = repsFor(input.varsAfter)
    const target = { exercise: logged.exercise, load: after, reps: joinReps(repsAfter) }
    if (deload) return { ...target, change: 'deload', detail: DELOAD_DETAIL }
    if (before != null && after != null && after !== before) {
      return after > before
        ? { ...target, change: 'up', detail: `+${fmtLb(after - before)}` }
        : { ...target, change: 'down', detail: `−${fmtLb(before - after)}` }
    }
    // Rep targets moved: a reps variable changed, or double progression's next step.
    const repsBefore = isDouble
      ? specs.map((_, i) => actualAt(i) ?? undefined)
      : specs.map(s => resolveReps(s.reps, input.varsBefore))
    const gained = repsGain(repsBefore, repsAfter)
    if (gained > 0) return { ...target, change: 'up', detail: `+${plural(gained, 'rep')}` }
    return { ...target, change: 'hold', detail: result === 'hit' ? 'hold' : 'repeat — hit every rep first' }
  }

  // Fixed or last-session loads.
  const repsNext = repsFor({})
  const base = { exercise: logged.exercise, load: lastLoad, reps: joinReps(repsNext) }
  if (deload) return { ...base, reps: joinReps(specs.map(s => s.reps ?? s.duration)), change: 'deload', detail: DELOAD_DETAIL }
  if (!mode || mode === 'maintenance') return { ...base, change: 'none', detail: 'same as today' }
  if (result === 'incomplete') return { ...base, change: 'hold', detail: 'repeat — finish every set first' }
  if ((input.effort ?? 0) >= 5) return { ...base, change: 'hold', detail: 'max effort — consider dropping 5–10%' }

  if (isDouble) {
    const range = parseRange(specs[0]?.reps)
    if (result === 'hit' && range) {
      return {
        ...base,
        load: lastLoad != null ? lastLoad + FIXED_LOAD_INCREMENT_LB : null,
        reps: String(range.low),
        change: 'up',
        detail: lastLoad != null ? `+${FIXED_LOAD_INCREMENT_LB} lb, back to ${range.low} reps` : `top of range — add load, back to ${range.low} reps`,
      }
    }
    const gained = repsGain(specs.map((_, i) => actualAt(i) ?? undefined), repsNext)
    return gained > 0
      ? { ...base, change: 'up', detail: `+${plural(gained, 'rep')}` }
      : { ...base, change: 'hold', detail: 'repeat' }
  }

  if (result !== 'hit') return { ...base, change: 'hold', detail: 'repeat — hit every rep first' }
  if (mode === 'volume') return { ...base, change: 'up', detail: 'add a set or a rep' }
  return lastLoad != null
    ? { ...base, load: lastLoad + FIXED_LOAD_INCREMENT_LB, change: 'up', detail: `+${FIXED_LOAD_INCREMENT_LB} lb` }
    : { ...base, change: 'up', detail: 'make it harder' }
}

/** One entry per logged lift with at least one completed working set, in logged order. */
export function buildNextTargets(input: NextTargetInput): NextTarget[] {
  const specs = input.slot.exercises ?? []
  const warmupOnly = new Set((input.slot.warmup ?? []).map(ex => ex.exercise))
  const specFor = (name: string) => specs.find(ex => ex.exercise === name)
  return input.logged
    .filter(ex => ex.sets.some(s => s.completed && !s.isWarmup))
    .filter(ex => specFor(ex.exercise) != null || !warmupOnly.has(ex.exercise))
    .map(ex => nextForExercise(specFor(ex.exercise), ex, input))
}

/** "Squat: 155 × 7" / "Pull-up: 6/5/3/2/1". */
export function formatNextTarget(t: NextTarget): string {
  const what = t.load != null && t.reps ? `${Math.round(t.load * 10) / 10} × ${t.reps}`
    : t.load != null ? fmtLb(t.load)
    : t.reps ?? ''
  return what ? `${t.exercise}: ${what}` : t.exercise
}
