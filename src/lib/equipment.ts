// ── Equipment profiles, achievable loads, and auto-generated warmups ─────────
// Pure helpers (no React/store imports) so they are easy to unit test.

import { findExerciseByName, exerciseEquipment } from './exerciseLibrary'

export type EquipmentLocation = 'home' | 'gym'

/** How an exercise is loaded; decides which achievable-weight rules apply. */
export type EquipmentKind = 'barbell' | 'ezbar' | 'dumbbell' | 'stack' | 'none'

export interface PlateSpec {
  /** Plate weight in lbs. */
  weight: number
  /** Number of PAIRS owned (one per side of the bar). */
  pairs: number
}

export interface EquipmentProfile {
  /** Unloaded barbell weight (lbs). */
  barWeight: number
  /** Unloaded EZ-curl bar weight (lbs). */
  ezBarWeight: number
  plates: PlateSpec[]
  /** Dumbbell range, per dumbbell. */
  dumbbellMin: number
  dumbbellMax: number
  dumbbellStep: number
  /** Cable / machine weight stack. */
  stackMin: number
  stackMax: number
  stackStep: number
}

const STANDARD_PLATES = (counts: Record<number, number>): PlateSpec[] =>
  [55, 45, 35, 25, 10, 5, 2.5, 1.25].map(weight => ({ weight, pairs: counts[weight] ?? 0 }))

export const DEFAULT_EQUIPMENT: Record<EquipmentLocation, EquipmentProfile> = {
  home: {
    barWeight: 45,
    ezBarWeight: 25,
    plates: STANDARD_PLATES({ 45: 2, 35: 1, 25: 1, 10: 2, 5: 1, 2.5: 1 }),
    dumbbellMin: 5,
    dumbbellMax: 50,
    dumbbellStep: 5,
    stackMin: 10,
    stackMax: 150,
    stackStep: 10,
  },
  gym: {
    barWeight: 45,
    ezBarWeight: 25,
    plates: STANDARD_PLATES({ 45: 6, 35: 2, 25: 2, 10: 2, 5: 2, 2.5: 2, 1.25: 1 }),
    dumbbellMin: 5,
    dumbbellMax: 120,
    dumbbellStep: 5,
    stackMin: 10,
    stackMax: 300,
    stackStep: 5,
  },
}

/** Never enumerate more than this many pairs of one plate (keeps the subset-sum tiny). */
const MAX_PAIRS_PER_PLATE = 12

const round2 = (n: number) => Math.round(n * 100) / 100

// ── Exercise → equipment kind ────────────────────────────────────────────────

const LIBRARY_KIND: Record<string, EquipmentKind> = {
  barbell: 'barbell',
  'smith machine': 'barbell',
  'trap bar': 'barbell',
  'ez bar': 'ezbar',
  dumbbell: 'dumbbell',
  cable: 'stack',
  'leverage machine': 'stack',
}

/**
 * Work out how an exercise is loaded. Uses the exercise library's "Name, Equipment"
 * convention when it matches, then falls back to keywords for free-form names such as
 * "Barbell Squat" or "Lat Pulldown". Unknown/bodyweight/band/kettlebell → 'none',
 * meaning no weight snapping is applied.
 */
export function equipmentKindFor(exerciseName: string): EquipmentKind {
  const name = exerciseName.trim()
  if (findExerciseByName(name)) {
    return LIBRARY_KIND[exerciseEquipment(name).toLowerCase()] ?? 'none'
  }
  const n = name.toLowerCase()
  if (/\b(bodyweight|band|bands|kettlebell|kb)\b/.test(n)) return 'none'
  if (/\bez[- ]?bar\b/.test(n)) return 'ezbar'
  if (/\b(dumbbell|db)\b/.test(n)) return 'dumbbell'
  if (/\b(cable|pulldown|pushdown|face pull|leg press|leg curl|leg extension|pec deck|machine|seated row)\b/.test(n)) return 'stack'
  if (/\b(single[- ]leg|split squat|goblet|pistol)\b/.test(n)) return 'none'
  if (/\b(barbell|deadlift|bench press|overhead press|squat|hip thrust|rdl)\b/.test(n)) return 'barbell'
  return 'none'
}

// ── Achievable loads ─────────────────────────────────────────────────────────

function rangeLoads(min: number, max: number, step: number): number[] {
  if (!(step > 0) || !(max >= min)) return [round2(Math.max(min, 0))]
  const out: number[] = []
  for (let v = min; v <= max + 1e-9; v += step) out.push(round2(v))
  return out
}

function barbellLoads(bar: number, plates: PlateSpec[]): number[] {
  let perSide = new Set<number>([0])
  for (const p of plates) {
    if (!(p.weight > 0) || !(p.pairs > 0)) continue
    const next = new Set<number>(perSide)
    const pairs = Math.min(Math.floor(p.pairs), MAX_PAIRS_PER_PLATE)
    for (const base of perSide) {
      for (let k = 1; k <= pairs; k++) next.add(round2(base + p.weight * k))
    }
    perSide = next
  }
  return [...perSide].map(s => round2(bar + 2 * s)).sort((a, b) => a - b)
}

/** Sorted list of every weight the profile can load for this kind, or null if unconstrained. */
export function achievableLoads(kind: EquipmentKind, profile: EquipmentProfile): number[] | null {
  switch (kind) {
    case 'barbell': return barbellLoads(profile.barWeight, profile.plates)
    case 'ezbar': return barbellLoads(profile.ezBarWeight, profile.plates)
    case 'dumbbell': return rangeLoads(profile.dumbbellMin, profile.dumbbellMax, profile.dumbbellStep)
    case 'stack': return rangeLoads(profile.stackMin, profile.stackMax, profile.stackStep)
    default: return null
  }
}

/**
 * Snap a requested weight to the nearest weight the equipment can actually load.
 * Ties go to the lighter weight. Below the lightest option (e.g. 35 on a 45 lb bar)
 * returns the lightest; above the heaviest returns the heaviest.
 */
export function snapToAchievable(load: number, kind: EquipmentKind, profile: EquipmentProfile): number {
  const loads = achievableLoads(kind, profile)
  if (!loads || loads.length === 0 || !Number.isFinite(load)) return load
  let best = loads[0]
  for (const l of loads) {
    if (Math.abs(l - load) < Math.abs(best - load) - 1e-9) best = l
    if (l > load) break
  }
  return best
}

/**
 * Next achievable weight above (dir=1) or below (dir=-1) `current`. For unconstrained kinds
 * returns current ± fallbackStep. Never goes below 0 and stays put at either end of the range.
 */
export function stepAchievable(
  current: number,
  dir: 1 | -1,
  kind: EquipmentKind,
  profile: EquipmentProfile,
  fallbackStep = 5,
): number {
  const loads = achievableLoads(kind, profile)
  if (!loads || loads.length === 0) return Math.max(0, round2(current + dir * fallbackStep))
  if (dir === 1) return loads.find(l => l > current + 1e-9) ?? loads[loads.length - 1]
  for (let i = loads.length - 1; i >= 0; i--) {
    if (loads[i] < current - 1e-9) return loads[i]
  }
  return current <= loads[0] ? Math.max(0, current) : loads[0]
}

// ── 1RM estimation ───────────────────────────────────────────────────────────

/** Epley estimate; reps beyond 12 are too noisy to trust, so they return null. */
export function estimateOneRepMax(weight: number, reps: number): number | null {
  if (!(weight > 0) || !(reps >= 1) || reps > 12) return null
  return reps === 1 ? weight : weight * (1 + reps / 30)
}

export interface OneRepMaxSet {
  reps: number | null
  load: number | null
  completed: boolean
  isWarmup?: boolean
}

/** Best estimated 1RM across completed, non-warmup sets. */
export function bestOneRepMax(sets: OneRepMaxSet[]): number | null {
  let best: number | null = null
  for (const s of sets) {
    if (!s.completed || s.isWarmup || s.reps == null || s.load == null) continue
    const e = estimateOneRepMax(s.load, s.reps)
    if (e != null && (best == null || e > best)) best = e
  }
  return best
}

// ── Warmup generation ────────────────────────────────────────────────────────

export interface GeneratedWarmup {
  load: number
  reps: number
}

/** [% of 1RM, reps] ramps. Bar lifts get a full ramp; other equipment a single feeler set. */
const BAR_RAMP: Array<[number, number]> = [[40, 8], [60, 5], [75, 3]]
const SINGLE_RAMP: Array<[number, number]> = [[60, 6]]

/**
 * Warmup sets as a % of estimated 1RM, snapped to weights the equipment can load.
 * Sets that would land at/near the working weight, or collapse onto the previous
 * warmup weight (e.g. 40% and 60% both rounding up to the empty bar), are dropped.
 */
export function generateWarmups(
  kind: EquipmentKind,
  profile: EquipmentProfile,
  oneRepMax: number,
  workingLoad: number,
): GeneratedWarmup[] {
  if (kind === 'none' || !(oneRepMax > 0) || !(workingLoad > 0)) return []
  const ramp = kind === 'barbell' || kind === 'ezbar' ? BAR_RAMP : SINGLE_RAMP
  const out: GeneratedWarmup[] = []
  for (const [pct, reps] of ramp) {
    const load = snapToAchievable(oneRepMax * pct / 100, kind, profile)
    if (load > workingLoad * 0.9) continue
    if (out.length && load <= out[out.length - 1].load) continue
    out.push({ load, reps })
  }
  return out
}

export interface OneRepMaxRecord {
  exerciseName: string
  calendarDate: string // YYYY-MM-DD
  sets: OneRepMaxSet[]
}

/**
 * Best estimated 1RM for an exercise from logged sessions in the last `windowDays`
 * (recent numbers reflect current strength better than an old PR). Null if none.
 */
export function recentOneRepMax(
  records: OneRepMaxRecord[],
  exerciseName: string,
  today: string,
  windowDays = 84,
): number | null {
  const cutoff = new Date(`${today}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const target = exerciseName.trim().toLowerCase()
  let best: number | null = null
  for (const r of records) {
    if (r.exerciseName.trim().toLowerCase() !== target || r.calendarDate < cutoffStr) continue
    const e = bestOneRepMax(r.sets)
    if (e != null && (best == null || e > best)) best = e
  }
  return best
}
