import { describe, it, expect } from 'vitest'
import {
  DEFAULT_EQUIPMENT, achievableLoads, bestOneRepMax, equipmentKindFor, estimateOneRepMax,
  generateWarmups, recentOneRepMax, snapToAchievable, stepAchievable, type EquipmentProfile,
} from '../equipment'

const home = DEFAULT_EQUIPMENT.home
const barOnlyPlates: EquipmentProfile = { ...home, plates: home.plates.map(p => ({ ...p, pairs: p.weight === 10 ? 1 : 0 })) }

describe('equipmentKindFor', () => {
  it('uses the library equipment suffix', () => {
    expect(equipmentKindFor('Bench Press, Barbell')).toBe('barbell')
    expect(equipmentKindFor('Curl, EZ Bar')).toBe('ezbar')
    expect(equipmentKindFor('Squat, Bodyweight')).toBe('none')
  })
  it('falls back to keywords for free-form names', () => {
    expect(equipmentKindFor('Barbell Squat')).toBe('barbell')
    expect(equipmentKindFor('Deadlift')).toBe('barbell')
    expect(equipmentKindFor('Dumbbell Row')).toBe('dumbbell')
    expect(equipmentKindFor('Lat Pulldown')).toBe('stack')
    expect(equipmentKindFor('Bulgarian Split Squat')).toBe('none')
    expect(equipmentKindFor('Chin-Ups')).toBe('none')
  })
})

describe('achievable loads', () => {
  it('barbell can never go below the empty bar', () => {
    expect(achievableLoads('barbell', home)![0]).toBe(45)
    expect(snapToAchievable(35, 'barbell', home)).toBe(45)
  })
  it('only uses plates the user owns', () => {
    // bar 45 + one pair of 10s only
    expect(achievableLoads('barbell', barOnlyPlates)).toEqual([45, 65])
    expect(snapToAchievable(55, 'barbell', barOnlyPlates)).toBe(45) // tie → lighter
    expect(snapToAchievable(200, 'barbell', barOnlyPlates)).toBe(65)
  })
  it('respects plate counts', () => {
    const loads = achievableLoads('barbell', home)!
    expect(loads).toContain(135)
    expect(loads).not.toContain(46) // no 0.5 lb plates
    expect(loads).not.toContain(47.5) // 1.25s aren't owned at home
  })
  it('dumbbells and stacks follow range + step', () => {
    expect(snapToAchievable(12, 'dumbbell', home)).toBe(10)
    expect(snapToAchievable(2, 'dumbbell', home)).toBe(5)
    expect(snapToAchievable(500, 'dumbbell', home)).toBe(50)
    expect(snapToAchievable(33, 'stack', home)).toBe(30)
  })
  it('leaves unconstrained kinds alone', () => {
    expect(snapToAchievable(37.3, 'none', home)).toBe(37.3)
  })
  it('steps to adjacent achievable weights', () => {
    expect(stepAchievable(45, 1, 'barbell', home)).toBe(50)
    expect(stepAchievable(45, -1, 'barbell', home)).toBe(45)
    expect(stepAchievable(47, 1, 'barbell', barOnlyPlates)).toBe(65)
    expect(stepAchievable(20, 1, 'none', home)).toBe(25)
    expect(stepAchievable(2, -1, 'none', home)).toBe(0)
  })
})

describe('1RM', () => {
  it('Epley estimate', () => {
    expect(estimateOneRepMax(200, 1)).toBe(200)
    expect(estimateOneRepMax(200, 5)).toBeCloseTo(233.33, 1)
    expect(estimateOneRepMax(100, 20)).toBeNull()
  })
  it('ignores warmup and incomplete sets', () => {
    expect(bestOneRepMax([
      { reps: 5, load: 100, completed: true, isWarmup: true },
      { reps: 5, load: 300, completed: false },
      { reps: 5, load: 150, completed: true },
    ])).toBeCloseTo(175, 5)
  })
  it('only looks at recent matching sessions', () => {
    const recs = [
      { exerciseName: 'Deadlift', calendarDate: '2026-10-01', sets: [{ reps: 5, load: 200, completed: true }] },
      { exerciseName: 'Deadlift', calendarDate: '2025-01-01', sets: [{ reps: 1, load: 500, completed: true }] },
      { exerciseName: 'Squat', calendarDate: '2026-10-01', sets: [{ reps: 1, load: 400, completed: true }] },
    ]
    expect(recentOneRepMax(recs, 'deadlift', '2026-10-19')).toBeCloseTo(233.33, 1)
    expect(recentOneRepMax(recs, 'Press', '2026-10-19')).toBeNull()
  })
})

describe('generateWarmups', () => {
  it('ramps below the working weight using only loadable weights', () => {
    const w = generateWarmups('barbell', home, 300, 255)
    expect(w.length).toBeGreaterThan(0)
    const loads = achievableLoads('barbell', home)!
    for (const s of w) {
      expect(loads).toContain(s.load)
      expect(s.load).toBeLessThan(255)
    }
    expect(w.map(s => s.load)).toEqual([...w.map(s => s.load)].sort((a, b) => a - b))
  })
  it('never produces a warmup under the empty bar and drops duplicates', () => {
    // 40%/60% of 80 are 32/48 → both snap to the 45 bar; only one 45 set survives
    const w = generateWarmups('barbell', home, 80, 65)
    expect(w.every(s => s.load >= 45)).toBe(true)
    expect(new Set(w.map(s => s.load)).size).toBe(w.length)
  })
  it('returns nothing when the working weight is the empty bar or unknown', () => {
    expect(generateWarmups('barbell', home, 60, 45)).toEqual([])
    expect(generateWarmups('none', home, 300, 255)).toEqual([])
    expect(generateWarmups('barbell', home, 0, 255)).toEqual([])
  })
})
