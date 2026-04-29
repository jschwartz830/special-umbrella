import { load as yamlLoad } from 'js-yaml'
import { format } from 'date-fns'
import { nanoid } from './rotationEngine'
import type { Plan, WorkoutSlot, PlanDay, WorkoutType } from '../types'
import type {
  ExerciseSpec,
  SetSpec,
  RunSegment,
  DrillSpec,
  ProgressionRule,
  ProgramMeta,
  YamlProgram,
  YamlSlot,
  YamlExerciseSpec,
  YamlSetSpec,
  YamlRunSegment,
  YamlDrillSpec,
} from '../types/program'
import type {
  WeightsFocusArea,
  WeightsTrainingIntent,
  WorkoutDifficulty,
} from '../modules/workout-metadata/types'

// ── Type coercions ────────────────────────────────────────────────────────────

const VALID_WORKOUT_TYPES: WorkoutType[] = [
  'weights', 'run', 'swim', 'yoga', 'other',
  // legacy kept for compat
  'weightlifting', 'long_run', 'recovery_run', 'rest',
]

function coerceWorkoutType(raw: string): WorkoutType {
  if (raw === 'rest') return 'other'
  if (VALID_WORKOUT_TYPES.includes(raw as WorkoutType)) return raw as WorkoutType
  return 'other'
}

const FOCUS_AREAS: WeightsFocusArea[] = ['upper', 'lower', 'full_body', 'push', 'pull', 'legs', 'core']
const INTENTS: WeightsTrainingIntent[] = [
  'strength', 'hypertrophy', 'power', 'conditioning', 'technique', 'deload', 'recovery_mobility',
]
const DIFFICULTIES: WorkoutDifficulty[] = ['easy', 'moderate', 'hard']

function coerceFocus(v: string | undefined): WeightsFocusArea | undefined {
  return FOCUS_AREAS.includes(v as WeightsFocusArea) ? (v as WeightsFocusArea) : undefined
}
function coerceIntent(v: string | undefined): WeightsTrainingIntent | undefined {
  return INTENTS.includes(v as WeightsTrainingIntent) ? (v as WeightsTrainingIntent) : undefined
}
function coerceDifficulty(v: string | undefined): WorkoutDifficulty | undefined {
  return DIFFICULTIES.includes(v as WorkoutDifficulty) ? (v as WorkoutDifficulty) : undefined
}

// ── Normalise duration/distance strings ──────────────────────────────────────

function normStr(v: string | number | undefined): string | undefined {
  if (v == null) return undefined
  return String(v).trim() || undefined
}

// ── Set / exercise parsing ────────────────────────────────────────────────────

function parseSetSpec(raw: YamlSetSpec): SetSpec {
  return {
    reps: raw.reps,
    load: normStr(raw.load),
    duration: normStr(raw.duration),
    rest: normStr(raw.rest),
    isWarmup: raw.isWarmup,
    notes: normStr(raw.notes),
  }
}

function parseExerciseSpec(raw: YamlExerciseSpec): ExerciseSpec {
  const sets: number | SetSpec[] | undefined =
    typeof raw.sets === 'number'
      ? raw.sets
      : Array.isArray(raw.sets)
        ? raw.sets.map(parseSetSpec)
        : undefined

  const progress: ProgressionRule | undefined = raw.progress
    ? { if: raw.progress.if, then: raw.progress.then, else: raw.progress.else }
    : undefined

  return {
    exercise: raw.exercise,
    sets,
    reps: raw.reps,
    load: normStr(raw.load),
    duration: normStr(raw.duration),
    rest: normStr(raw.rest),
    tempo: normStr(raw.tempo),
    notes: normStr(raw.notes),
    type: Array.isArray(raw.type) ? raw.type : undefined,
    target: Array.isArray(raw.target) ? raw.target : undefined,
    synergist: Array.isArray(raw.synergist) ? raw.synergist : undefined,
    progress,
  }
}

// ── Drill parsing ─────────────────────────────────────────────────────────────

function parseDrill(raw: YamlDrillSpec): DrillSpec {
  return {
    name: raw.name,
    sets: raw.sets,
    reps: raw.reps,
    duration: normStr(raw.duration),
    rest: normStr(raw.rest),
    perSide: raw.perSide,
    notes: normStr(raw.notes),
  }
}

// ── Run segment parsing ───────────────────────────────────────────────────────

const VALID_SEGMENT_TYPES = ['warmup', 'cooldown', 'easy', 'tempo', 'interval', 'race_pace', 'drills', 'rest']

function parseRunSegment(raw: YamlRunSegment): RunSegment {
  const type = (raw.type && VALID_SEGMENT_TYPES.includes(raw.type))
    ? raw.type
    : 'easy'

  return {
    type,
    name: normStr(raw.name),
    distance: normStr(raw.distance),
    duration: normStr(raw.duration),
    pace: normStr(raw.pace),
    reps: raw.reps,
    rest: normStr(raw.rest),
    drills: Array.isArray(raw.drills) ? raw.drills.map(parseDrill) : undefined,
    notes: normStr(raw.notes),
  }
}

// ── Slot parsing ──────────────────────────────────────────────────────────────

function parseSlot(raw: YamlSlot): WorkoutSlot {
  const type = coerceWorkoutType(raw.type ?? 'other')
  const isRun = type === 'run' || type === 'long_run' || type === 'recovery_run'
  const isWeights = type === 'weights' || type === 'weightlifting'

  const slotProgress: ProgressionRule | undefined = raw.progress
    ? { if: raw.progress.if, then: raw.progress.then, else: raw.progress.else }
    : undefined

  const warmup = isWeights && Array.isArray(raw.warmup)
    ? raw.warmup.map(parseExerciseSpec)
    : undefined

  const exercises = isWeights && Array.isArray(raw.exercises)
    ? raw.exercises.map(parseExerciseSpec)
    : undefined

  const segments = isRun && Array.isArray(raw.segments)
    ? raw.segments.map(parseRunSegment)
    : undefined

  // Build a structureDescription summary for display in the existing UI
  const structureDescription = buildStructureDescription(raw, isWeights, isRun)

  return {
    id: nanoid(),
    type,
    name: raw.name ?? (isWeights ? 'Weights' : isRun ? 'Run' : 'Workout'),
    subtype: raw.subtype,
    durationMin: raw.durationMin,
    difficulty: coerceDifficulty(raw.difficulty),
    weightsFocusArea: coerceFocus(raw.focus),
    weightsIntent: coerceIntent(raw.intent),
    location: raw.location,
    notes: raw.notes,
    structureDescription,
    warmup,
    exercises,
    segments,
    slotProgress,
  }
}

function buildStructureDescription(
  raw: YamlSlot,
  isWeights: boolean,
  isRun: boolean,
): string | undefined {
  if (isWeights) {
    const exList = raw.exercises?.map(e => {
      const setsStr =
        typeof e.sets === 'number'
          ? `${e.sets}×${e.reps ?? '?'}`
          : Array.isArray(e.sets)
            ? `${e.sets.length} sets`
            : e.reps
              ? `×${e.reps}`
              : ''
      return `${e.exercise}${setsStr ? ' ' + setsStr : ''}`
    })
    return exList?.length ? exList.join(' · ') : undefined
  }
  if (isRun) {
    const segList = raw.segments?.map(s => {
      const label = s.type ? s.type.charAt(0).toUpperCase() + s.type.slice(1) : 'Segment'
      const dist = s.distance ? ` ${s.distance}` : ''
      const dur = s.duration ? ` ${s.duration}` : ''
      const reps = s.reps ? ` ×${s.reps}` : ''
      return `${label}${dist}${dur}${reps}`
    })
    return segList?.length ? segList.join(' → ') : undefined
  }
  return undefined
}

// ── Day parsing ───────────────────────────────────────────────────────────────

function parseDay(raw: { label: string; slots: YamlSlot[] }): PlanDay {
  return {
    id: nanoid(),
    label: raw.label ?? 'Workout Day',
    slots: (raw.slots ?? []).map(parseSlot),
  }
}

// ── Top-level parse ───────────────────────────────────────────────────────────

export interface ParseResult {
  plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>
  errors: string[]
}

export function parseYamlProgram(yamlText: string): ParseResult {
  const errors: string[] = []
  let doc: unknown

  try {
    doc = yamlLoad(yamlText)
  } catch (e) {
    return {
      plan: makeFallbackPlan(),
      errors: [`YAML parse error: ${(e as Error).message}`],
    }
  }

  if (!doc || typeof doc !== 'object') {
    return { plan: makeFallbackPlan(), errors: ['Document must be a YAML mapping'] }
  }

  const raw = doc as YamlProgram

  if (!raw.name) errors.push('Missing required field: name')
  if (!raw.duration?.type || !raw.duration?.value) errors.push('Missing required field: duration')
  if (!Array.isArray(raw.days) || raw.days.length === 0) errors.push('days array is empty or missing')

  const vars: Record<string, number> = {}
  if (raw.vars && typeof raw.vars === 'object') {
    for (const [k, v] of Object.entries(raw.vars)) {
      if (typeof v === 'number') vars[k] = v
      else errors.push(`vars.${k} must be a number, got ${typeof v}`)
    }
  }

  const programMeta: ProgramMeta | undefined =
    Object.keys(vars).length > 0 ? { version: 1, vars } : undefined

  const days = Array.isArray(raw.days) ? raw.days.map(parseDay) : []

  const plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'> = {
    name: raw.name ?? 'Imported Program',
    description: raw.description,
    status: 'inactive',
    days,
    duration: {
      type: raw.duration?.type ?? 'weeks',
      value: raw.duration?.value ?? 8,
    },
    startDate: format(new Date(), 'yyyy-MM-dd'),
    startDayIndex: 0,
    programMeta,
  }

  return { plan, errors }
}

function makeFallbackPlan(): Omit<Plan, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Imported Program',
    status: 'inactive',
    days: [],
    duration: { type: 'weeks', value: 8 },
    startDate: format(new Date(), 'yyyy-MM-dd'),
    startDayIndex: 0,
  }
}

// ── Validation helper (used in UI) ────────────────────────────────────────────

export function validateYamlProgram(yamlText: string): string[] {
  const { errors } = parseYamlProgram(yamlText)
  return errors
}
