/**
 * Tests for CSV encode/decode + app-specific serializers.
 */
import { describe, it, expect } from 'vitest'
import {
  encodeCsv,
  parseCsv,
  parseCsvToRecords,
  plansToCsv,
  plansFromCsv,
  historyToCsv,
  historyFromCsv,
} from '../csv'
import type { Plan, HistoryEntry, ExtraWorkoutEntry, WorkoutOutcome } from '../../types'

// ── Core parser ───────────────────────────────────────────────────────────────

describe('encodeCsv + parseCsv', () => {
  it('round-trips simple values', () => {
    const csv = encodeCsv([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
    const rows = parseCsv(csv)
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('escapes quotes, commas, and newlines', () => {
    const csv = encodeCsv([
      ['title', 'value'],
      ['he said "hi"', 'a, b\nc'],
    ])
    const rows = parseCsv(csv)
    expect(rows).toEqual([
      ['title', 'value'],
      ['he said "hi"', 'a, b\nc'],
    ])
  })

  it('handles empty cells', () => {
    const rows = parseCsv('a,b,c\r\n1,,3')
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ])
  })

  it('strips a BOM', () => {
    const rows = parseCsv('\ufeffa,b\n1,2')
    expect(rows[0]).toEqual(['a', 'b'])
  })
})

describe('parseCsvToRecords', () => {
  it('builds objects keyed by header', () => {
    const records = parseCsvToRecords('name,age\nAlice,30\nBob,25')
    expect(records).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ])
  })

  it('returns empty list for no data rows', () => {
    expect(parseCsvToRecords('')).toEqual([])
  })
})

// ── Plans round-trip ──────────────────────────────────────────────────────────

function makePlan(): Plan {
  return {
    id: 'plan-1',
    name: 'Upper/Lower',
    description: 'Split routine',
    status: 'inactive',
    startDate: '2026-01-01',
    startDayIndex: 0,
    duration: { type: 'weeks', value: 8 },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    days: [
      {
        id: 'd1',
        label: 'Upper',
        slots: [
          {
            id: 's1',
            type: 'weightlifting',
            name: 'Push',
            targetTime: 45,
            isDeload: false,
            notes: 'Keep RPE moderate',
            difficulty: 'moderate',
            tags: ['upper', 'lift'],
          },
          {
            id: 's2',
            type: 'long_run',
            name: 'Morning Run',
            targetDistance: 6,
            runConfig: {
              subtype: 'long_run',
              targetDistanceMiles: 6,
              targetDurationMin: 60,
              targetPaceRange: {
                minSecondsPerMile: 540,
                maxSecondsPerMile: 600,
              },
              targetStructureText: '2 mi warmup, 2 mi tempo, 2 mi cooldown',
              progressionEligible: true,
              progressionGroupId: 'long_run_group',
              defaultStepMiles: 0.5,
            },
          },
        ],
      },
      {
        id: 'd2',
        label: 'Rest',
        slots: [{ id: 's3', type: 'rest', name: 'Rest' }],
      },
    ],
  }
}

describe('plansToCsv + plansFromCsv', () => {
  it('round-trips plan structure', () => {
    const csv = plansToCsv([makePlan()])
    const { plans, warnings } = plansFromCsv(csv)
    expect(warnings).toEqual([])
    expect(plans).toHaveLength(1)

    const p = plans[0]
    expect(p.name).toBe('Upper/Lower')
    expect(p.description).toBe('Split routine')
    expect(p.status).toBe('inactive')
    expect(p.duration).toEqual({ type: 'weeks', value: 8 })
    expect(p.days).toHaveLength(2)
    expect(p.days[0].label).toBe('Upper')
    expect(p.days[0].slots).toHaveLength(2)

    const push = p.days[0].slots[0]
    expect(push.type).toBe('weightlifting')
    expect(push.name).toBe('Push')
    expect(push.targetTime).toBe(45)
    expect(push.isDeload).toBe(false)
    expect(push.notes).toBe('Keep RPE moderate')
    expect(push.difficulty).toBe('moderate')
    expect(push.tags).toEqual(['upper', 'lift'])

    const run = p.days[0].slots[1]
    expect(run.type).toBe('long_run')
    expect(run.runConfig?.subtype).toBe('long_run')
    expect(run.runConfig?.targetDistanceMiles).toBe(6)
    expect(run.runConfig?.targetPaceRange?.minSecondsPerMile).toBe(540)
    expect(run.runConfig?.targetPaceRange?.maxSecondsPerMile).toBe(600)
    expect(run.runConfig?.progressionEligible).toBe(true)
    expect(run.runConfig?.progressionGroupId).toBe('long_run_group')
    expect(run.runConfig?.defaultStepMiles).toBe(0.5)

    expect(p.days[1].slots[0].type).toBe('rest')
  })

  it('downgrades active status on import so users must re-activate', () => {
    const source = { ...makePlan(), status: 'active' as const }
    const csv = plansToCsv([source])
    const { plans } = plansFromCsv(csv)
    expect(plans[0].status).toBe('inactive')
  })

  it('preserves planId but generates fresh day/slot IDs on import', () => {
    // planId is preserved so that previously-exported history CSVs (which
    // reference planId) stay linkable after a plan re-import. Day and slot
    // IDs are regenerated since they're internal and not referenced by
    // other exports.
    const csv = plansToCsv([makePlan()])
    const { plans } = plansFromCsv(csv)
    expect(plans[0].id).toBe('plan-1')
    expect(plans[0].days[0].id).not.toBe('d1')
    expect(plans[0].days[0].slots[0].id).not.toBe('s1')
  })

  it('reports warnings for unknown slot types', () => {
    const csv =
      'planId,planName,planStatus,planStartDate,planStartDayIndex,durationType,durationValue,dayIndex,dayLabel,slotIndex,slotType,slotName\n' +
      '"p1","Test","inactive","2026-01-01",0,"weeks",4,0,"Day 1",0,"teleport","Weird"'
    const { plans, warnings } = plansFromCsv(csv)
    expect(plans).toHaveLength(0)
    expect(warnings.some(w => w.includes('unknown slotType'))).toBe(true)
  })

  it('skips rows with no planId', () => {
    const csv =
      'planId,planName,planStatus,planStartDate,planStartDayIndex,durationType,durationValue,dayIndex,dayLabel,slotIndex,slotType,slotName\n' +
      ',,,,,,,,,,,\n' +
      '"p1","Keep","inactive","2026-01-01",0,"rotations",4,0,"Day 1",0,"weightlifting","Lift"'
    const { plans, warnings } = plansFromCsv(csv)
    expect(plans).toHaveLength(1)
    expect(warnings.some(w => w.includes('missing planId'))).toBe(true)
  })
})

// ── History round-trip ────────────────────────────────────────────────────────

describe('historyToCsv + historyFromCsv', () => {
  const plan = makePlan()
  const planIds = new Set([plan.id])
  const plans = { [plan.id]: plan }

  const entries: HistoryEntry[] = [
    {
      id: 'e1',
      planId: plan.id,
      calendarDate: '2026-04-10',
      planDayIndex: 0,
      action: 'complete',
      notes: 'Felt great',
      createdAt: '2026-04-10T17:00:00Z',
    },
    {
      id: 'e2',
      planId: plan.id,
      calendarDate: '2026-04-12',
      action: 'day_off',
      createdAt: '2026-04-12T09:00:00Z',
    },
  ]

  const outcomes: Record<string, WorkoutOutcome> = {
    [`${plan.id}_2026-04-10`]: {
      workoutInstanceId: `${plan.id}_2026-04-10`,
      completionState: 'completed',
      perceivedEffort: 4,
      durationActualMin: 50,
      completedAt: '2026-04-10T18:00:00Z',
      notes: 'Felt great',
      runActual: {
        actualDistanceMiles: 6.1,
        actualDurationMin: 60,
        averagePaceSecondsPerMile: 590,
        averageHeartRate: 148,
        completedAsPlanned: true,
      },
    },
  }

  it('round-trips entries and outcomes', () => {
    const csv = historyToCsv(entries, [], plans, outcomes)
    const { entries: parsed, outcomes: parsedOutcomes, warnings } = historyFromCsv(csv, planIds)

    expect(warnings).toEqual([])
    expect(parsed).toHaveLength(2)

    const complete = parsed.find(e => e.calendarDate === '2026-04-10')!
    expect(complete.action).toBe('complete')
    expect(complete.planDayIndex).toBe(0)
    expect(complete.notes).toBe('Felt great')

    const dayOff = parsed.find(e => e.calendarDate === '2026-04-12')!
    expect(dayOff.action).toBe('day_off')
    expect(dayOff.planDayIndex).toBeUndefined()

    expect(parsedOutcomes).toHaveLength(1)
    const o = parsedOutcomes[0]
    expect(o.completionState).toBe('completed')
    expect(o.perceivedEffort).toBe(4)
    expect(o.durationActualMin).toBe(50)
    expect(o.runActual?.actualDistanceMiles).toBe(6.1)
    expect(o.runActual?.averageHeartRate).toBe(148)
    expect(o.runActual?.completedAsPlanned).toBe(true)
  })

  it('skips rows referencing unknown plan ids', () => {
    const csv = historyToCsv(entries, [], plans, outcomes)
    const { entries: parsed, warnings } = historyFromCsv(csv, new Set(['nope']))
    expect(parsed).toEqual([])
    expect(warnings.some(w => w.includes('not found'))).toBe(true)
  })

  it('rejects invalid action values', () => {
    const csv =
      'entryKind,planId,calendarDate,planDayIndex,action,createdAt\n' +
      `rotation,${plan.id},2026-04-10,0,fly,2026-04-10T00:00:00Z`
    const { entries: parsed, warnings } = historyFromCsv(csv, planIds)
    expect(parsed).toEqual([])
    expect(warnings.some(w => w.includes('invalid action'))).toBe(true)
  })

  it('rejects malformed dates', () => {
    const csv =
      'entryKind,planId,calendarDate,planDayIndex,action,createdAt\n' +
      `rotation,${plan.id},notadate,0,complete,2026-04-10T00:00:00Z`
    const { entries: parsed, warnings } = historyFromCsv(csv, planIds)
    expect(parsed).toEqual([])
    expect(warnings.some(w => w.includes('invalid calendarDate'))).toBe(true)
  })

  // ── Extras round-trip ──────────────────────────────────────────────────────

  it('round-trips extraEntries and their outcomes', () => {
    const extras: ExtraWorkoutEntry[] = [
      {
        id: 'x1',
        planId: plan.id,
        calendarDate: '2026-04-11',
        workoutType: 'yoga',
        workoutName: 'Morning Yoga',
        notes: 'Hip mobility focus',
        createdAt: '2026-04-11T08:00:00Z',
        source: 'history',
      },
      {
        id: 'x2',
        planId: plan.id,
        calendarDate: '2026-04-11',
        workoutType: 'swim',
        workoutName: 'Lunch Swim',
        createdAt: '2026-04-11T12:30:00Z',
        source: 'double_day',
      },
    ]
    const extraOutcomes: Record<string, WorkoutOutcome> = {
      [`${plan.id}_2026-04-11_extra_x1`]: {
        workoutInstanceId: `${plan.id}_2026-04-11_extra_x1`,
        completionState: 'completed',
        perceivedEffort: 2,
        durationActualMin: 30,
      },
    }

    const csv = historyToCsv(entries, extras, plans, { ...outcomes, ...extraOutcomes })
    const {
      entries: parsedEntries,
      extras: parsedExtras,
      outcomes: parsedOutcomes,
      warnings,
    } = historyFromCsv(csv, planIds)

    expect(warnings).toEqual([])
    expect(parsedEntries).toHaveLength(2)
    expect(parsedExtras).toHaveLength(2)

    const yoga = parsedExtras.find(e => e.workoutType === 'yoga')!
    expect(yoga.workoutName).toBe('Morning Yoga')
    expect(yoga.notes).toBe('Hip mobility focus')
    expect(yoga.calendarDate).toBe('2026-04-11')
    expect(yoga.planId).toBe(plan.id)

    const swim = parsedExtras.find(e => e.workoutType === 'swim')!
    expect(swim.workoutName).toBe('Lunch Swim')

    // Outcome for the yoga extra must be rekeyed to the new generated id.
    const yogaOutcome = parsedOutcomes.find(
      o => o.workoutInstanceId === `${plan.id}_2026-04-11_extra_${yoga.id}`,
    )
    expect(yogaOutcome).toBeDefined()
    expect(yogaOutcome!.completionState).toBe('completed')
    expect(yogaOutcome!.perceivedEffort).toBe(2)
    expect(yogaOutcome!.durationActualMin).toBe(30)
  })

  it('generates fresh extra IDs on import (old and new IDs do not collide)', () => {
    const extras: ExtraWorkoutEntry[] = [
      {
        id: 'original-id',
        planId: plan.id,
        calendarDate: '2026-04-11',
        workoutType: 'yoga',
        workoutName: 'Yoga',
        createdAt: '2026-04-11T08:00:00Z',
      },
    ]
    const csv = historyToCsv([], extras, plans, {})
    const { extras: parsed } = historyFromCsv(csv, planIds)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).not.toBe('original-id')
  })

  it('rejects extra rows with invalid workoutType', () => {
    const csv =
      'entryKind,planId,calendarDate,workoutType,workoutName,createdAt\n' +
      `extra,${plan.id},2026-04-11,moonwalk,Weird,2026-04-11T08:00:00Z`
    const { extras, warnings } = historyFromCsv(csv, planIds)
    expect(extras).toEqual([])
    expect(warnings.some(w => w.includes('invalid workoutType'))).toBe(true)
  })

  // ── Backward compatibility ─────────────────────────────────────────────────

  it('treats pre-2026-04-21 CSVs (no entryKind column) as all-rotation', () => {
    // Legacy header layout — no entryKind, workoutType, or workoutName columns.
    const legacyCsv =
      'planId,planName,calendarDate,planDayIndex,planDayLabel,action,slotNames,completionState,perceivedEffort,durationActualMin,actualDistanceMiles,actualDurationMin,averagePaceSecondsPerMile,averageHeartRate,completedAsPlanned,completedAt,notes,createdAt\n' +
      `${plan.id},${plan.name},2026-04-10,0,Upper,complete,Push,completed,4,50,,,,,,,Felt great,2026-04-10T17:00:00Z\n` +
      `${plan.id},${plan.name},2026-04-12,,,day_off,,,,,,,,,,,,2026-04-12T09:00:00Z`
    const { entries: parsed, extras, warnings } = historyFromCsv(legacyCsv, planIds)
    expect(warnings).toEqual([])
    expect(parsed).toHaveLength(2)
    expect(extras).toEqual([])
    expect(parsed.find(e => e.calendarDate === '2026-04-10')!.action).toBe('complete')
    expect(parsed.find(e => e.calendarDate === '2026-04-12')!.action).toBe('day_off')
  })
})
