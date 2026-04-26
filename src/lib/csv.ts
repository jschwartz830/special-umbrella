// ── CSV Utilities ─────────────────────────────────────────────────────────────
// Generic CSV encode/decode plus app-specific serializers for plans and
// history entries (with outcomes).

import type {
  Plan,
  PlanDay,
  WorkoutSlot,
  WorkoutType,
  HistoryEntry,
  ExtraWorkoutEntry,
  PlanStatus,
  ActionType,
  WorkoutTag,
  WorkoutDifficulty,
  RunWorkoutConfig,
  RunWorkoutSubtype,
  WorkoutOutcome,
  WorkoutCompletionState,
  PerceivedEffort,
} from '../types'
import { nanoid } from '../engine/rotationEngine'
import { makeWorkoutInstanceId, makeExtraWorkoutInstanceId } from '../store/outcomeStore'

// ── Core encode/decode ────────────────────────────────────────────────────────

/** Escape a single value for CSV (RFC 4180 style, always quote to be safe). */
function encodeCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s === '') return ''
  return `"${s.replace(/"/g, '""')}"`
}

export function encodeCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  return rows.map(r => r.map(encodeCell).join(',')).join('\r\n')
}

/** Parse CSV text into rows of string cells. Handles quoted fields and embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) i = 1

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (ch === '\r') {
      // Handle CRLF or lone CR
      if (text[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
      continue
    }
    if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
      continue
    }
    field += ch
    i += 1
  }
  // Flush last field/row (ignore trailing empty row)
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** Parse a CSV file into a list of row objects keyed by header. */
export function parseCsvToRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text).filter(r => r.length > 0 && !(r.length === 1 && r[0] === ''))
  if (rows.length === 0) return []
  const headers = rows[0].map(h => h.trim())
  return rows.slice(1).map(r => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim()
    })
    return obj
  })
}

// ── Download / file helpers ───────────────────────────────────────────────────

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Typed cell helpers ────────────────────────────────────────────────────────

function toNum(v: string): number | undefined {
  if (v === '' || v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function toBool(v: string): boolean | undefined {
  if (v === '' || v == null) return undefined
  const s = v.toLowerCase()
  if (s === 'true' || s === '1' || s === 'yes') return true
  if (s === 'false' || s === '0' || s === 'no') return false
  return undefined
}

// ── Plans CSV ─────────────────────────────────────────────────────────────────
// One row per slot. Plan-level fields repeat on each row for that plan.

const PLAN_HEADERS = [
  'planId',
  'planName',
  'planDescription',
  'planStatus',
  'planStartDate',
  'planStartDayIndex',
  'durationType',
  'durationValue',
  'dayIndex',
  'dayLabel',
  'slotIndex',
  'slotType',
  'slotName',
  'slotNotes',
  'targetTime',
  'isDeload',
  'targetDistance',
  'targetPace',
  'targetDuration',
  'difficulty',
  'tags',
  'runSubtype',
  'runTargetDistance',
  'runTargetDuration',
  'runTargetPaceMin',
  'runTargetPaceMax',
  'runStructureText',
  'runProgressionEligible',
  'runProgressionGroupId',
  'runDefaultStepMiles',
  'runMinStepMiles',
  'runMaxStepMiles',
] as const

export function plansToCsv(plans: Plan[]): string {
  const rows: (string | number | boolean | null | undefined)[][] = [[...PLAN_HEADERS]]
  for (const plan of plans) {
    if (plan.days.length === 0) {
      rows.push(planHeaderCells(plan, 0, '', 0, {} as WorkoutSlot, true))
      continue
    }
    plan.days.forEach((day, dayIdx) => {
      if (day.slots.length === 0) {
        rows.push(planHeaderCells(plan, dayIdx, day.label, 0, {} as WorkoutSlot, true))
        return
      }
      day.slots.forEach((slot, slotIdx) => {
        rows.push(planHeaderCells(plan, dayIdx, day.label, slotIdx, slot, false))
      })
    })
  }
  return encodeCsv(rows)
}

function planHeaderCells(
  plan: Plan,
  dayIdx: number,
  dayLabel: string,
  slotIdx: number,
  slot: WorkoutSlot,
  empty: boolean,
): (string | number | boolean | null | undefined)[] {
  const run = slot.runConfig ?? null
  return [
    plan.id,
    plan.name,
    plan.description ?? '',
    plan.status,
    plan.startDate,
    plan.startDayIndex,
    plan.duration.type,
    plan.duration.value,
    dayIdx,
    dayLabel,
    slotIdx,
    empty ? '' : slot.type,
    empty ? '' : slot.name ?? '',
    empty ? '' : slot.notes ?? '',
    empty ? '' : slot.targetTime ?? '',
    empty ? '' : slot.isDeload ?? '',
    empty ? '' : slot.targetDistance ?? '',
    empty ? '' : slot.targetPace ?? '',
    empty ? '' : slot.targetDuration ?? '',
    empty ? '' : slot.difficulty ?? '',
    empty ? '' : (slot.tags ?? []).join('|'),
    empty ? '' : run?.subtype ?? '',
    empty ? '' : run?.targetDistanceMiles ?? '',
    empty ? '' : run?.targetDurationMin ?? '',
    empty ? '' : run?.targetPaceRange?.minSecondsPerMile ?? '',
    empty ? '' : run?.targetPaceRange?.maxSecondsPerMile ?? '',
    empty ? '' : run?.targetStructureText ?? '',
    empty ? '' : run?.progressionEligible ?? '',
    empty ? '' : run?.progressionGroupId ?? '',
    empty ? '' : run?.defaultStepMiles ?? '',
    empty ? '' : run?.minStepMiles ?? '',
    empty ? '' : run?.maxStepMiles ?? '',
  ]
}

const VALID_WORKOUT_TYPES: WorkoutType[] = [
  'weightlifting', 'long_run', 'recovery_run', 'swim', 'yoga', 'rest',
]
const VALID_STATUSES: PlanStatus[] = ['active', 'inactive', 'archived']
const VALID_DIFFICULTIES: WorkoutDifficulty[] = ['easy', 'moderate', 'hard']
const VALID_RUN_SUBTYPES: RunWorkoutSubtype[] = [
  'easy_run', 'recovery_run', 'long_run', 'tempo', 'intervals',
  'race_pace', 'walk_run', 'other',
]

export interface PlansImportResult {
  plans: Plan[]
  warnings: string[]
}

/**
 * Parse CSV text into Plan[] objects. Generates new IDs for all entities.
 * Plans without slots are skipped. Malformed rows are collected in `warnings`.
 */
export function plansFromCsv(text: string): PlansImportResult {
  const records = parseCsvToRecords(text)
  const warnings: string[] = []
  if (records.length === 0) return { plans: [], warnings: ['CSV is empty.'] }

  // Group rows by original planId to preserve grouping.
  const byPlan = new Map<string, Record<string, string>[]>()
  records.forEach((row, i) => {
    const pid = row.planId?.trim()
    if (!pid) {
      warnings.push(`Row ${i + 2}: missing planId — skipped.`)
      return
    }
    if (!byPlan.has(pid)) byPlan.set(pid, [])
    byPlan.get(pid)!.push(row)
  })

  const now = new Date().toISOString()
  const plans: Plan[] = []

  for (const [pid, rows] of byPlan) {
    if (rows.length === 0) continue
    const first = rows[0]
    // Preserve the original planId so exported history CSVs continue to match.
    const newPlanId = pid

    const status = VALID_STATUSES.includes(first.planStatus as PlanStatus)
      ? (first.planStatus as PlanStatus)
      : 'inactive'

    const durationType = first.durationType === 'weeks' ? 'weeks' : 'rotations'
    const durationValue = toNum(first.durationValue) ?? 1

    // Group rows by dayIndex
    const byDay = new Map<number, Record<string, string>[]>()
    rows.forEach(r => {
      const di = toNum(r.dayIndex) ?? 0
      if (!byDay.has(di)) byDay.set(di, [])
      byDay.get(di)!.push(r)
    })

    const days: PlanDay[] = []
    const sortedDayIndexes = Array.from(byDay.keys()).sort((a, b) => a - b)
    for (const di of sortedDayIndexes) {
      const dayRows = byDay.get(di)!
      const dayLabel = dayRows[0].dayLabel || `Day ${di + 1}`
      const slots: WorkoutSlot[] = []
      const sortedSlotRows = [...dayRows].sort(
        (a, b) => (toNum(a.slotIndex) ?? 0) - (toNum(b.slotIndex) ?? 0),
      )
      for (const row of sortedSlotRows) {
        const type = row.slotType?.trim() as WorkoutType
        if (!type) continue // empty/placeholder day row
        if (!VALID_WORKOUT_TYPES.includes(type)) {
          warnings.push(`Plan "${first.planName}" day ${di}: unknown slotType "${row.slotType}" — skipped.`)
          continue
        }
        slots.push(rowToSlot(row, type))
      }
      days.push({
        id: nanoid(),
        label: dayLabel,
        slots,
      })
    }

    // If no days survived, skip the plan.
    const hasAnySlot = days.some(d => d.slots.length > 0)
    if (!hasAnySlot) {
      warnings.push(`Plan "${first.planName || first.planId}" had no valid slots — skipped.`)
      continue
    }

    plans.push({
      id: newPlanId,
      name: first.planName || 'Imported Plan',
      description: first.planDescription || undefined,
      // Never import as active — user can activate manually after review.
      status: status === 'active' ? 'inactive' : status,
      days,
      duration: { type: durationType, value: durationValue },
      startDate: first.planStartDate || new Date().toISOString().slice(0, 10),
      startDayIndex: toNum(first.planStartDayIndex) ?? 0,
      createdAt: now,
      updatedAt: now,
    })
  }

  return { plans, warnings }
}

function rowToSlot(row: Record<string, string>, type: WorkoutType): WorkoutSlot {
  const slot: WorkoutSlot = {
    id: nanoid(),
    type,
    name: row.slotName || defaultNameForType(type),
  }
  if (row.slotNotes) slot.notes = row.slotNotes
  const targetTime = toNum(row.targetTime)
  if (targetTime !== undefined) slot.targetTime = targetTime
  const isDeload = toBool(row.isDeload)
  if (isDeload !== undefined) slot.isDeload = isDeload
  const targetDistance = toNum(row.targetDistance)
  if (targetDistance !== undefined) slot.targetDistance = targetDistance
  const targetPace = toNum(row.targetPace)
  if (targetPace !== undefined) slot.targetPace = targetPace
  const targetDuration = toNum(row.targetDuration)
  if (targetDuration !== undefined) slot.targetDuration = targetDuration

  if (row.difficulty && VALID_DIFFICULTIES.includes(row.difficulty as WorkoutDifficulty)) {
    slot.difficulty = row.difficulty as WorkoutDifficulty
  }
  if (row.tags) {
    const tags = row.tags.split('|').map(t => t.trim()).filter(Boolean) as WorkoutTag[]
    if (tags.length > 0) slot.tags = tags
  }

  // Run config
  if (row.runSubtype) {
    const subtype: RunWorkoutSubtype = VALID_RUN_SUBTYPES.includes(row.runSubtype as RunWorkoutSubtype)
      ? (row.runSubtype as RunWorkoutSubtype)
      : 'other'
    const runTargetDistance = toNum(row.runTargetDistance)
    const runTargetDuration = toNum(row.runTargetDuration)
    const paceMin = toNum(row.runTargetPaceMin)
    const paceMax = toNum(row.runTargetPaceMax)
    const config: RunWorkoutConfig = { subtype }
    if (runTargetDistance !== undefined) config.targetDistanceMiles = runTargetDistance
    if (runTargetDuration !== undefined) config.targetDurationMin = runTargetDuration
    if (paceMin !== undefined || paceMax !== undefined) {
      config.targetPaceRange = {
        minSecondsPerMile: paceMin,
        maxSecondsPerMile: paceMax,
      }
    }
    if (row.runStructureText) config.targetStructureText = row.runStructureText
    const progEligible = toBool(row.runProgressionEligible)
    if (progEligible !== undefined) config.progressionEligible = progEligible
    if (row.runProgressionGroupId) config.progressionGroupId = row.runProgressionGroupId
    const defaultStep = toNum(row.runDefaultStepMiles)
    if (defaultStep !== undefined) config.defaultStepMiles = defaultStep
    const minStep = toNum(row.runMinStepMiles)
    if (minStep !== undefined) config.minStepMiles = minStep
    const maxStep = toNum(row.runMaxStepMiles)
    if (maxStep !== undefined) config.maxStepMiles = maxStep
    slot.runConfig = config
  }

  return slot
}

function defaultNameForType(type: WorkoutType): string {
  switch (type) {
    case 'weightlifting': return 'Weightlifting'
    case 'long_run': return 'Long Run'
    case 'recovery_run': return 'Recovery Run'
    case 'swim': return 'Swim'
    case 'yoga': return 'Yoga'
    case 'rest': return 'Rest'
  }
}

// ── History CSV ───────────────────────────────────────────────────────────────

const HISTORY_HEADERS = [
  'entryKind',       // 'rotation' | 'extra' — new in 2026-04-21 schema. Older
                     // exports predate this column; parseRecordsToHistory
                     // defaults missing values to 'rotation'.
  'extraId',         // extras only — stable ID for re-import deduplication.
                     // Absent in pre-2026-04-26 exports; missing value treated
                     // as blank (new ID generated on import, same as before).
  'planId',
  'planName',
  'calendarDate',
  'planDayIndex',
  'planDayLabel',
  'action',
  'slotNames',
  'workoutType',     // extras only — otherwise blank
  'workoutName',     // extras only — otherwise blank
  'completionState',
  'perceivedEffort',
  'durationActualMin',
  'actualDistanceMiles',
  'actualDurationMin',
  'averagePaceSecondsPerMile',
  'averageHeartRate',
  'completedAsPlanned',
  'completedAt',
  'notes',
  'createdAt',
] as const

export function historyToCsv(
  entries: HistoryEntry[],
  extras: ExtraWorkoutEntry[],
  plans: Record<string, Plan>,
  outcomes: Record<string, WorkoutOutcome>,
): string {
  const rows: (string | number | boolean | null | undefined)[][] = [[...HISTORY_HEADERS]]

  type Row =
    | { kind: 'rotation'; date: string; createdAt: string; entry: HistoryEntry }
    | { kind: 'extra'; date: string; createdAt: string; extra: ExtraWorkoutEntry }

  const unified: Row[] = [
    ...entries.map<Row>(e => ({ kind: 'rotation', date: e.calendarDate, createdAt: e.createdAt, entry: e })),
    ...extras.map<Row>(e => ({ kind: 'extra', date: e.calendarDate, createdAt: e.createdAt, extra: e })),
  ]
  // Sort oldest first for stable output; rotation before extras on the same date+time.
  unified.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt)
    if (a.kind !== b.kind) return a.kind === 'rotation' ? -1 : 1
    return 0
  })

  for (const row of unified) {
    if (row.kind === 'rotation') {
      const e = row.entry
      const plan = plans[e.planId]
      const planDay =
        e.planDayIndex !== undefined ? plan?.days[e.planDayIndex] : undefined
      const outcome = outcomes[makeWorkoutInstanceId(e.planId, e.calendarDate)]
      const runActual = outcome?.runActual ?? null
      rows.push([
        'rotation',
        '',  // extraId — rotation rows don't have one
        e.planId,
        plan?.name ?? '',
        e.calendarDate,
        e.planDayIndex ?? '',
        planDay?.label ?? '',
        e.action,
        planDay ? planDay.slots.map(s => s.name).join(' + ') : '',
        '',  // workoutType — extras only
        '',  // workoutName — extras only
        outcome?.completionState ?? '',
        outcome?.perceivedEffort ?? '',
        outcome?.durationActualMin ?? '',
        runActual?.actualDistanceMiles ?? '',
        runActual?.actualDurationMin ?? '',
        runActual?.averagePaceSecondsPerMile ?? '',
        runActual?.averageHeartRate ?? '',
        runActual?.completedAsPlanned ?? '',
        outcome?.completedAt ?? '',
        e.notes ?? outcome?.notes ?? '',
        e.createdAt,
      ])
    } else {
      const x = row.extra
      const plan = plans[x.planId]
      const outcome = outcomes[makeExtraWorkoutInstanceId(x.planId, x.calendarDate, x.id)]
      const runActual = outcome?.runActual ?? null
      rows.push([
        'extra',
        x.id,  // extraId — used for idempotent re-import
        x.planId,
        plan?.name ?? '',
        x.calendarDate,
        '',  // planDayIndex — n/a
        '',  // planDayLabel — n/a
        '',  // action — n/a
        '',  // slotNames — n/a
        x.workoutType,
        x.workoutName,
        outcome?.completionState ?? '',
        outcome?.perceivedEffort ?? '',
        outcome?.durationActualMin ?? '',
        runActual?.actualDistanceMiles ?? '',
        runActual?.actualDurationMin ?? '',
        runActual?.averagePaceSecondsPerMile ?? '',
        runActual?.averageHeartRate ?? '',
        runActual?.completedAsPlanned ?? '',
        outcome?.completedAt ?? '',
        x.notes ?? outcome?.notes ?? '',
        x.createdAt,
      ])
    }
  }
  return encodeCsv(rows)
}

export interface HistoryImportResult {
  entries: HistoryEntry[]
  extras: ExtraWorkoutEntry[]
  outcomes: WorkoutOutcome[]
  warnings: string[]
}

const VALID_ACTIONS: ActionType[] = ['complete', 'skip', 'day_off']
const VALID_COMPLETION_STATES: WorkoutCompletionState[] = [
  'planned', 'completed', 'partially_completed', 'skipped', 'deferred', 'swapped',
]

/**
 * Parse CSV text into HistoryEntry + ExtraWorkoutEntry + optional
 * WorkoutOutcome records. Requires rows to reference an existing planId
 * (passed in `existingPlanIds`). Rows with unknown planIds are skipped with
 * a warning.
 *
 * Rows with `entryKind = 'extra'` become `ExtraWorkoutEntry` records. When
 * an `extraId` column is present (exports from 2026-04-26 onward) its value
 * is reused as the entry ID so that re-importing the same CSV is idempotent.
 * Older exports without `extraId` fall back to generating a fresh ID (matching
 * previous behavior). Missing `entryKind` (pre-2026-04-21 exports) defaults
 * to 'rotation'.
 */
export function historyFromCsv(
  text: string,
  existingPlanIds: Set<string>,
): HistoryImportResult {
  const records = parseCsvToRecords(text)
  const warnings: string[] = []
  const entries: HistoryEntry[] = []
  const extras: ExtraWorkoutEntry[] = []
  const outcomes: WorkoutOutcome[] = []
  const now = new Date().toISOString()

  records.forEach((row, i) => {
    const lineNum = i + 2
    const planId = row.planId?.trim()
    if (!planId) {
      warnings.push(`Row ${lineNum}: missing planId — skipped.`)
      return
    }
    if (!existingPlanIds.has(planId)) {
      warnings.push(`Row ${lineNum}: planId "${planId}" not found — skipped. Import the plan first.`)
      return
    }
    const calendarDate = row.calendarDate?.trim()
    if (!calendarDate || !/^\d{4}-\d{2}-\d{2}$/.test(calendarDate)) {
      warnings.push(`Row ${lineNum}: invalid calendarDate "${row.calendarDate}" — skipped.`)
      return
    }

    const kind = (row.entryKind?.trim() || 'rotation').toLowerCase()

    if (kind === 'extra') {
      const workoutType = row.workoutType?.trim() as WorkoutType
      if (!VALID_WORKOUT_TYPES.includes(workoutType)) {
        warnings.push(`Row ${lineNum}: invalid workoutType "${row.workoutType}" for extra — skipped.`)
        return
      }
      // Prefer the stable extraId from the CSV when present (2026-04-26+ exports)
      // so that re-importing the same file is idempotent. Fall back to a fresh
      // nanoid() for older exports that don't include this column.
      const extraId = row.extraId?.trim() || nanoid()
      extras.push({
        id: extraId,
        planId,
        calendarDate,
        workoutType,
        workoutName: row.workoutName?.trim() || defaultNameForType(workoutType),
        notes: row.notes || undefined,
        createdAt: row.createdAt || now,
      })

      const outcome = buildOutcomeFromRow(
        row,
        makeExtraWorkoutInstanceId(planId, calendarDate, extraId),
      )
      if (outcome) outcomes.push(outcome)
      return
    }

    if (kind !== 'rotation') {
      warnings.push(`Row ${lineNum}: unknown entryKind "${row.entryKind}" — skipped.`)
      return
    }

    const action = row.action?.trim() as ActionType
    if (!VALID_ACTIONS.includes(action)) {
      warnings.push(`Row ${lineNum}: invalid action "${row.action}" — skipped.`)
      return
    }
    const planDayIndex =
      action === 'day_off' ? undefined : toNum(row.planDayIndex)

    entries.push({
      id: nanoid(),
      planId,
      calendarDate,
      planDayIndex,
      action,
      notes: row.notes || undefined,
      createdAt: row.createdAt || now,
    })

    const outcome = buildOutcomeFromRow(
      row,
      makeWorkoutInstanceId(planId, calendarDate),
    )
    if (outcome) outcomes.push(outcome)
  })

  return { entries, extras, outcomes, warnings }
}

function buildOutcomeFromRow(
  row: Record<string, string>,
  workoutInstanceId: string,
): WorkoutOutcome | null {
  const completionState = row.completionState?.trim() as WorkoutCompletionState
  if (!completionState || !VALID_COMPLETION_STATES.includes(completionState)) return null

  const outcome: WorkoutOutcome = { workoutInstanceId, completionState }

  const effort = toNum(row.perceivedEffort)
  if (effort !== undefined && effort >= 1 && effort <= 5) {
    outcome.perceivedEffort = effort as PerceivedEffort
  }
  const dur = toNum(row.durationActualMin)
  if (dur !== undefined) outcome.durationActualMin = dur
  if (row.completedAt) outcome.completedAt = row.completedAt
  if (row.notes) outcome.notes = row.notes

  const actualDistance = toNum(row.actualDistanceMiles)
  const actualDuration = toNum(row.actualDurationMin)
  const avgPace = toNum(row.averagePaceSecondsPerMile)
  const avgHr = toNum(row.averageHeartRate)
  const completedAsPlanned = toBool(row.completedAsPlanned)
  if (
    actualDistance !== undefined ||
    actualDuration !== undefined ||
    avgPace !== undefined ||
    avgHr !== undefined ||
    completedAsPlanned !== undefined
  ) {
    outcome.runActual = {
      actualDistanceMiles: actualDistance,
      actualDurationMin: actualDuration,
      averagePaceSecondsPerMile: avgPace,
      averageHeartRate: avgHr,
      completedAsPlanned,
    }
  }
  return outcome
}
