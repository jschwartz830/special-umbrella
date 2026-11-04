import { describe, it, expect } from 'vitest'
import { applyPlatePlan, plateNoteFor, plateLineFor } from '../platePlan'
import { DEFAULT_EQUIPMENT } from '../../../../lib/equipment'
import type { SetTrackState } from '../trackerHelpers'

const set = (load: number, isWarmup = false): SetTrackState => ({
  setElapsedSeconds: 0, completed: false, actualReps: 5, actualLoad: load, targetReps: 5, targetLoad: null,
  restSeconds: 60, actualRestSeconds: null, resolvedLoadLbs: load, ...(isWarmup ? { isWarmup } : {}),
})

describe('applyPlatePlan', () => {
  it('re-picks warmups and notes each loading step, then the working set', () => {
    // Plain snapping gave 70 (12.5/side) and 110 (32.5/side) for a 135 working weight.
    const out = applyPlatePlan([set(70, true), set(110, true), set(135), set(135)], 'barbell', DEFAULT_EQUIPMENT.home)
    expect(out.map(s => s.actualLoad)).toEqual([65, 115, 135, 135])
    expect(out.map(plateNoteFor)).toEqual(['Load: +10s each side', 'Load: +25s each side', 'Load: +10s each side', null])
  })

  it('hides a note once the weight is edited', () => {
    const [w] = applyPlatePlan([set(95, true), set(185)], 'barbell', DEFAULT_EQUIPMENT.gym)
    expect(plateNoteFor(w)).toBe('Load: +25s each side')
    expect(plateNoteFor({ ...w, actualLoad: 100 })).toBeNull()
  })

  it('leaves dumbbells, machines and lifts without warmups alone', () => {
    const sets = [set(20, true), set(40)]
    expect(applyPlatePlan(sets, 'dumbbell', DEFAULT_EQUIPMENT.gym)).toBe(sets)
    const noWarm = [set(185)]
    expect(applyPlatePlan(noWarm, 'barbell', DEFAULT_EQUIPMENT.gym)).toBe(noWarm)
  })
})

describe('plateLineFor', () => {
  const gym = DEFAULT_EQUIPMENT.gym
  it('lists plates per side, heaviest first', () => {
    expect(plateLineFor(set(225), 'barbell', gym)).toBe('Plates: 45/45 per side')
    expect(plateLineFor(set(140), 'barbell', gym)).toBe('Plates: 45/2.5 per side')
    expect(plateLineFor(set(45), 'barbell', gym)).toBe('Plates: empty bar')
    expect(plateLineFor(set(55), 'ezbar', gym)).toBe('Plates: 10/5 per side')
  })
  it('flags weights the plates cannot make', () => {
    expect(plateLineFor(set(136), 'barbell', gym)).toBe("Plates: can't load with your plates")
    expect(plateLineFor(set(30), 'barbell', gym)).toBe('Plates: below the 45 lb bar')
  })
  it('matches the warmup plan stack, and ignores non-bar equipment', () => {
    const out = applyPlatePlan([set(70, true), set(110, true), set(135)], 'barbell', DEFAULT_EQUIPMENT.home)
    expect(out.map(s => plateLineFor(s, 'barbell', DEFAULT_EQUIPMENT.home))).toEqual([
      'Plates: 10 per side', 'Plates: 10/25 per side', 'Plates: 10/25/10 per side',
    ])
    expect(plateLineFor(set(40), 'dumbbell', gym)).toBeNull()
  })
})
