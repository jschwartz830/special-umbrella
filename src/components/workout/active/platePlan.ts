import type { SetTrackState } from './trackerHelpers'
import type { EquipmentKind, EquipmentProfile } from '../../../lib/equipment'
import { planPlateLoading, describePlateChange, platesForLoad } from '../../../lib/plateLoading'

/**
 * Re-pick a barbell lift's warmup weights for quick loading (fewest plate changes,
 * each within ±8% of the working weight of its ramp target) and attach a loading
 * note to each warmup and the first working set ("+25s", "−10s, +35s").
 * Leaves the sets alone for other equipment or when no plan fits.
 */
export function applyPlatePlan(sets: SetTrackState[], kind: EquipmentKind, profile: EquipmentProfile): SetTrackState[] {
  if (kind !== 'barbell' && kind !== 'ezbar') return sets
  const warmIdx = sets.map((s, i) => (s.isWarmup ? i : -1)).filter(i => i >= 0)
  const firstWork = sets.findIndex(s => !s.isWarmup)
  const workingLoad = firstWork >= 0 ? sets[firstWork].actualLoad : null
  if (warmIdx.length === 0 || workingLoad == null || workingLoad <= 0) return sets
  const ideals = warmIdx.map(i => sets[i].actualLoad ?? sets[i].resolvedLoadLbs ?? 0)
  if (ideals.some(l => !(l > 0))) return sets

  const bar = kind === 'ezbar' ? profile.ezBarWeight : profile.barWeight
  const plan = planPlateLoading(bar, profile.plates, ideals, workingLoad)
  if (!plan) return sets

  const out = [...sets]
  warmIdx.forEach((i, k) => {
    const w = plan.warmups[k]
    out[i] = {
      ...out[i],
      actualLoad: w.load,
      resolvedLoadLbs: w.load,
      plateNote: describePlateChange(w.change, w.perSide),
      plateNoteLoad: w.load,
      platePerSide: w.perSide,
    }
  })
  out[firstWork] = {
    ...out[firstWork],
    plateNote: describePlateChange(plan.working.change, plan.working.perSide),
    plateNoteLoad: workingLoad,
    platePerSide: plan.working.perSide,
  }
  return out
}

/** "Load: +25s each side", unless the set's weight has since been changed by hand. */
export function plateNoteFor(s: Pick<SetTrackState, 'plateNote' | 'plateNoteLoad' | 'actualLoad'>): string | null {
  if (!s.plateNote || s.plateNoteLoad !== s.actualLoad) return null
  return /^[+−]/.test(s.plateNote) ? `Load: ${s.plateNote} each side` : `Load: ${s.plateNote}`
}

/**
 * "Plates: 45/25/10 per side" for a barbell / EZ-bar set's weight, "Plates: empty bar", or
 * "Plates: can't load with your plates". Null for other equipment or no weight yet.
 * Uses the warmup plan's stack while the weight is unchanged so it matches the loading note.
 */
export function plateLineFor(
  s: Pick<SetTrackState, 'actualLoad' | 'resolvedLoadLbs' | 'plateNoteLoad' | 'platePerSide'>,
  kind: EquipmentKind,
  profile: EquipmentProfile,
): string | null {
  if (kind !== 'barbell' && kind !== 'ezbar') return null
  const load = s.actualLoad ?? s.resolvedLoadLbs
  if (load == null || !(load > 0)) return null
  const bar = kind === 'ezbar' ? profile.ezBarWeight : profile.barWeight
  const stack = s.platePerSide && s.plateNoteLoad === load
    ? s.platePerSide
    : platesForLoad(bar, profile.plates, load)
  if (stack == null) return load < bar ? `Plates: below the ${bar} lb bar` : "Plates: can't load with your plates"
  return stack.length === 0 ? 'Plates: empty bar' : `Plates: ${stack.join('/')} per side`
}
