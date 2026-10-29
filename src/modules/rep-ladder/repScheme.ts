import type { ExerciseSpec } from '../../types/program'

/**
 * Reps → sets progression, for bodyweight / fixed-load work (Nordic curls,
 * dead bugs, calf raises) where adding weight isn't the lever.
 *
 * The exercise walks a list of steps, one step per successful session (every
 * set at its target); a miss repeats the step. After the last step it starts
 * over at step 1 with a prompt to make the movement harder.
 *
 * Steps come from `repScheme` when set ("3x4, 3x5, 4x6, 10/10/10", "444"),
 * otherwise from the exercise itself: its rep range at its set count, then the
 * same range with one more set (2 × 3-5 → 2×3, 2×4, 2×5, 3×3, 3×4, 3×5).
 */

const MAX_STEPS = 50
const MAX_SETS = 10

export function isRepSchemeExercise(ex: ExerciseSpec): boolean {
  return ex.progressionType === 'rep_sets'
}

/** Parse one step: "3x8" / "3×8", "10/10/8", or repeated single digits "444". */
function parseStep(token: string): number[] | null {
  const t = token.trim().toLowerCase()
  const nx = t.match(/^(\d+)\s*[x×*]\s*(\d+)$/)
  if (nx) {
    const sets = Number(nx[1])
    const reps = Number(nx[2])
    return sets >= 1 && sets <= MAX_SETS && reps >= 1 ? Array(sets).fill(reps) : null
  }
  if (/^\d+(\s*\/\s*\d+)+$/.test(t)) {
    const reps = t.split('/').map(n => Number(n.trim()))
    return reps.length <= MAX_SETS && reps.every(r => r >= 1) ? reps : null
  }
  if (/^(\d)\1+$/.test(t)) {
    return t.length <= MAX_SETS && t[0] !== '0' ? t.split('').map(Number) : null
  }
  return null
}

/** Parse a custom scheme. Returns null when any step is unreadable. */
export function parseRepScheme(text: string): number[][] | null {
  const tokens = text.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
  if (tokens.length === 0 || tokens.length > MAX_STEPS) return null
  const steps = tokens.map(parseStep)
  return steps.every((s): s is number[] => s != null) ? steps : null
}

/** Default steps from the exercise's own rep range and set count. */
export function defaultRepScheme(ex: Pick<ExerciseSpec, 'sets' | 'reps'>): number[][] {
  const sets = typeof ex.sets === 'number' && ex.sets >= 1
    ? Math.min(MAX_SETS - 1, Math.floor(ex.sets))
    : Array.isArray(ex.sets) && ex.sets.length > 0 ? Math.min(MAX_SETS - 1, ex.sets.length) : 3
  const nums = String(ex.reps ?? '').match(/\d+/g)?.map(Number) ?? []
  const low = nums.length > 0 ? Math.max(1, Math.min(...nums)) : 8
  const high = nums.length > 0 ? Math.max(low, ...nums) : low
  const steps: number[][] = []
  for (const n of [sets, sets + 1]) {
    for (let r = low; r <= high && steps.length < MAX_STEPS; r++) steps.push(Array(n).fill(r))
  }
  return steps
}

/** The steps this exercise uses: a valid custom scheme, else the default. */
export function repSchemeSteps(ex: ExerciseSpec): number[][] {
  return (ex.repScheme && parseRepScheme(ex.repScheme)) || defaultRepScheme(ex)
}

/** "3×8" when every set matches, else "10/10/8". */
export function formatStep(reps: number[]): string {
  return reps.every(r => r === reps[0]) ? `${reps.length}×${reps[0]}` : reps.join('/')
}

/** Identifies a scheme; editing the steps changes it, which starts the exercise over. */
export function repSchemeSignature(steps: number[][]): string {
  return `scheme:${steps.map(s => s.join('/')).join(',')}`
}

/**
 * Concrete sets for the given count of successful sessions. In a deload week the
 * step's reps are kept but capped at the deloaded set count.
 */
export function applyRepScheme(ex: ExerciseSpec, hits: number, deloadSets?: number): ExerciseSpec {
  const steps = repSchemeSteps(ex)
  const n = steps.length
  const idx = Math.max(0, hits) % n
  const cycle = Math.floor(Math.max(0, hits) / n)
  let reps = steps[idx]
  if (deloadSets != null) reps = reps.slice(0, Math.max(1, Math.min(reps.length, deloadSets)))
  const next = idx + 1 < n ? ` · next ${formatStep(steps[idx + 1])}` : ''
  return {
    ...ex,
    sets: reps.map(r => ({ reps: r })),
    reps: undefined,
    ladderStatus: deloadSets != null
      ? `Step ${idx + 1}/${n} · deload, no progress this week`
      : cycle > 0 && idx === 0
        ? `New cycle — make it harder (less assistance, slower, or add load)`
        : `Step ${idx + 1}/${n}${next}`,
  }
}
