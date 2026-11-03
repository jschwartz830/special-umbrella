import type { ExerciseTrackState, SetTrackState } from './trackerHelpers'

/**
 * Superset alignment: members of a superset alternate set by set, so they work
 * best with the same number of warmups and the same number of working sets.
 * These helpers spot a mismatch and offer ways to conform the group.
 */

type Exercises = Pick<ExerciseTrackState, 'exercise' | 'sets' | 'supersetGroupId'>[]

export interface ConformOption {
  part: 'warmups' | 'working'
  /** Every member ends up with this many sets of `part`. */
  target: number
  label: string
}

export interface SupersetMisalignment {
  groupId: string
  /** Exercise indices in the group, plan order. */
  members: number[]
  warmups: number[]
  working: number[]
  /** Human summary, e.g. "Squat has 3 warmups, Pull-ups has 0". */
  summary: string[]
  options: ConformOption[]
}

const countOf = (sets: SetTrackState[], warmup: boolean) => sets.filter(s => !!s.isWarmup === warmup).length
const doneOf = (sets: SetTrackState[], warmup: boolean) => sets.filter(s => !!s.isWarmup === warmup && s.completed).length
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Mismatches in each superset group with 2+ members, in group order. Empty when all aligned. */
export function findSupersetMisalignments(exercises: Exercises): SupersetMisalignment[] {
  const groups = new Map<string, number[]>()
  exercises.forEach((ex, ei) => {
    if (!ex.supersetGroupId) return
    groups.set(ex.supersetGroupId, [...(groups.get(ex.supersetGroupId) ?? []), ei])
  })

  const out: SupersetMisalignment[] = []
  for (const [groupId, members] of groups) {
    if (members.length < 2) continue
    const warmups = members.map(ei => countOf(exercises[ei].sets, true))
    const working = members.map(ei => countOf(exercises[ei].sets, false))
    const summary: string[] = []
    const options: ConformOption[] = []

    const describe = (counts: number[], word: string) =>
      members.map((ei, i) => `${exercises[ei].exercise}: ${plural(counts[i], word)}`).join(' · ')

    for (const [part, counts, word] of [['warmups', warmups, 'warmup'], ['working', working, 'working set']] as const) {
      const lo = Math.min(...counts)
      const hi = Math.max(...counts)
      if (lo === hi) continue
      summary.push(describe(counts, word))
      const warm = part === 'warmups'
      // Raising always works. Lowering can't remove sets already done.
      options.push({ part, target: hi, label: warm ? `Add warmups so each has ${hi}` : `Match ${hi} working sets` })
      const lowerable = members.every(ei => doneOf(exercises[ei].sets, warm) <= lo)
      if (lowerable && (lo > 0 || warm)) {
        options.push({
          part,
          target: lo,
          label: warm ? (lo === 0 ? 'Skip warmups for all' : `Trim warmups to ${lo} each`) : `Trim to ${lo} working sets`,
        })
      }
    }
    if (summary.length > 0) out.push({ groupId, members, warmups, working, summary, options })
  }
  return out
}

function blankSet(from: SetTrackState | undefined, patch: Partial<SetTrackState>): SetTrackState {
  return {
    setElapsedSeconds: 0,
    completed: false,
    actualReps: from?.actualReps ?? null,
    actualLoad: from?.actualLoad ?? null,
    targetReps: from?.targetReps ?? null,
    targetLoad: from?.targetLoad ?? null,
    restSeconds: from?.restSeconds ?? null,
    actualRestSeconds: null,
    resolvedLoadLbs: from?.resolvedLoadLbs ?? null,
    isTimed: from?.isTimed,
    ...patch,
  }
}

const WARMUP_REPS = [8, 5, 3, 2, 1]

/**
 * Warmup loads for `count` sets ramping up to `workingLoad`: evenly spread from
 * 40% to 85% (60% for a single set), snapped to loadable weights.
 */
export function rampLoads(workingLoad: number | null, count: number, snap: (lbs: number) => number): Array<number | null> {
  return Array.from({ length: count }, (_, i) => {
    if (workingLoad == null || workingLoad <= 0) return null
    const pct = count === 1 ? 0.6 : 0.4 + (0.85 - 0.4) * (i / (count - 1))
    return snap(workingLoad * pct)
  })
}

function setWarmups(sets: SetTrackState[], target: number, snap: (lbs: number) => number): SetTrackState[] {
  const warm = sets.filter(s => s.isWarmup)
  const work = sets.filter(s => !s.isWarmup)
  if (warm.length === target) return sets
  const firstWork = work[0]
  const workingLoad = firstWork?.actualLoad ?? firstWork?.resolvedLoadLbs ?? null
  const workReps = typeof firstWork?.targetReps === 'number' ? firstWork.targetReps : null
  const warmupSet = (load: number | null, i: number, n: number) => {
    // Reps taper toward the working set; bodyweight warmups use about half the working reps.
    const reps = load == null && workReps != null
      ? Math.max(1, Math.round(workReps / 2))
      : WARMUP_REPS[Math.min(WARMUP_REPS.length - 1, Math.max(0, i - (n - Math.min(n, WARMUP_REPS.length))))]
    return blankSet(firstWork, {
      isWarmup: true, isTimed: false,
      actualLoad: load, resolvedLoadLbs: load, targetLoad: null,
      actualReps: reps, targetReps: reps, restSeconds: 60,
    })
  }

  if (warm.length > target) {
    // Drop the lightest unfinished warmups first; the heavier ones are the useful ramp.
    let drop = warm.length - target
    const kept = warm.filter(s => {
      if (drop > 0 && !s.completed) { drop--; return false }
      return true
    })
    return [...kept, ...work]
  }

  if (warm.every(s => !s.completed)) {
    // Nothing done yet: build a fresh, evenly spaced ramp.
    const loads = rampLoads(workingLoad, target, snap)
    return [...loads.map((l, i) => warmupSet(l, i, target)), ...work]
  }

  // Some warmups done: add the missing ones between the last warmup and the working weight.
  const extra = target - warm.length
  const from = warm[warm.length - 1]?.actualLoad ?? null
  const added = Array.from({ length: extra }, (_, i) => {
    const load = from != null && workingLoad != null
      ? snap(from + (workingLoad - from) * ((i + 1) / (extra + 1)))
      : null
    return warmupSet(load, warm.length + i, target)
  })
  return [...warm, ...added, ...work]
}

function setWorking(sets: SetTrackState[], target: number): SetTrackState[] {
  const warm = sets.filter(s => s.isWarmup)
  const work = sets.filter(s => !s.isWarmup)
  if (work.length === target) return sets
  if (work.length > target) {
    // Remove trailing unfinished sets only.
    const next = [...work]
    while (next.length > target && !next[next.length - 1].completed) next.pop()
    return [...warm, ...next]
  }
  const last = work[work.length - 1]
  const added = Array.from({ length: target - work.length }, () => blankSet(last, {}))
  return [...warm, ...work, ...added]
}

/** Apply a conform option to every member of the group. */
export function conformSuperset<T extends Exercises[number]>(
  exercises: T[],
  groupId: string,
  option: Pick<ConformOption, 'part' | 'target'>,
  snapFor: (exercise: string) => (lbs: number) => number,
): T[] {
  return exercises.map(ex => {
    if (ex.supersetGroupId !== groupId) return ex
    const sets = option.part === 'warmups'
      ? setWarmups(ex.sets, option.target, snapFor(ex.exercise))
      : setWorking(ex.sets, option.target)
    return sets === ex.sets ? ex : { ...ex, sets }
  })
}
