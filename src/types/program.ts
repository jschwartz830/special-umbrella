// ── Program / DSL Types ───────────────────────────────────────────────────────
// These types represent the structured workout data that lives inside a
// WorkoutSlot when a plan is imported from the YAML program format.

// ── Progression type ─────────────────────────────────────────────────────────

/**
 * Labelled progression strategy for an exercise.
 * Controls how load/reps advance over time; pairs with the `progress` rule field.
 *
 * single          – add a fixed load increment each session (linear)
 * double          – increase reps to max rep target, then bump weight and reset reps
 * dynamic_double  – auto-regulates load based on effort alongside rep range
 * triple          – progress reps, then sets, then weight in sequence
 * step_loading    – pre-set load blocks across a training cycle (block periodization)
 */
export type ProgressionType =
  | 'single'
  | 'double'
  | 'dynamic_double'
  | 'triple'
  | 'step_loading'

// ── Set & exercise specs (weightlifting) ─────────────────────────────────────

/**
 * One set within an exercise.
 * `load` is an expression string: "135lb", "0.75 * squat", "bodyweight", etc.
 * `reps` may be a number or "5+" (AMRAP).
 * `duration` is used instead of reps for timed sets ("45s", "1m").
 */
export interface SetSpec {
  reps?: number | string
  load?: string
  duration?: string
  rest?: string
  isWarmup?: boolean
  notes?: string
}

/**
 * One exercise within a weights slot.
 * When `sets` is a number, `reps` and `load` act as defaults for all sets.
 * When `sets` is an array of SetSpec, each set is fully specified.
 *
 * Progression config fields (used alongside `progressionType` and `progress`):
 *   minReps        – lower bound of the rep range (e.g. 8)
 *   maxReps        – upper bound of the rep range (e.g. 12); used by double progression
 *   weightIncrement – lbs to add when progressing (e.g. 2.5 or 5)
 *   deloadFactor   – multiplier applied on a significant miss (e.g. 0.9 = 10% drop)
 */
export interface ExerciseSpec {
  exercise: string
  sets?: number | SetSpec[]
  reps?: number | string
  load?: string
  duration?: string
  rest?: string
  tempo?: string
  notes?: string
  type?: string[]
  target?: string[]
  synergist?: string[]
  progress?: ProgressionRule
  progressionType?: ProgressionType
  minReps?: number
  maxReps?: number
  weightIncrement?: number
  deloadFactor?: number
}

// ── Run segments ─────────────────────────────────────────────────────────────

export type RunSegmentType =
  | 'warmup'
  | 'cooldown'
  | 'easy'
  | 'tempo'
  | 'interval'
  | 'race_pace'
  | 'drills'
  | 'rest'

/**
 * Pace zone string.
 * Named zones: "easy", "tempo", "5K", "10K", "half", "marathon"
 * Explicit pace: "7:30" (interpreted as min/mile)
 */
export type PaceZone = string

/**
 * A single drill within a drills segment (e.g. high knees, A-skips).
 */
export interface DrillSpec {
  name: string
  sets?: number
  reps?: number | string
  duration?: string
  rest?: string
  perSide?: boolean
  notes?: string
}

/**
 * One segment of a structured run slot.
 * `distance` and `duration` are expression strings that may reference vars:
 *   "easy_miles mi", "800m", "10m", "interval_reps" (for reps field).
 */
export interface RunSegment {
  type: RunSegmentType
  name?: string
  distance?: string
  duration?: string
  pace?: PaceZone
  reps?: number | string
  rest?: string
  drills?: DrillSpec[]
  notes?: string
}

// ── Progression rules ─────────────────────────────────────────────────────────

/**
 * A progression rule evaluated after a workout is logged.
 *
 * `if`   – condition expression or keyword ("all_reps", "session_complete",
 *           "effort <= 3", "all_reps and effort <= 4")
 * `then` – update expression(s), comma-separated:
 *           "squat += 5", "easy_miles = min(easy_miles + 0.5, 8)"
 * `else` – optional failure expression: "squat = round5(squat * 0.85)"
 *
 * Condition keywords injected into eval context:
 *   all_reps        – 1 if completionState === 'completed'
 *   session_complete – 1 if completionState is not 'skipped' or 'planned'
 *   effort          – perceivedEffort value (1–5), 0 if missing
 *
 * Expression functions: min, max, round, floor, ceil, round5, round2_5, abs
 */
export interface ProgressionRule {
  if?: string
  then: string
  else?: string
}

// ── Program metadata attached to a Plan ──────────────────────────────────────

/**
 * Initial variable definitions for a program.
 * Keys are variable names; values are the starting numeric values.
 * Lives at Plan.programMeta.vars — initialised into programStore on first use.
 */
export interface ProgramVarDefs {
  [name: string]: number
}

export interface ProgramMeta {
  version: 1
  vars: ProgramVarDefs
}

// ── YAML source document shape (what the parser reads) ────────────────────────

export interface YamlSetSpec {
  reps?: number | string
  load?: string
  duration?: string
  rest?: string
  isWarmup?: boolean
  notes?: string
}

export interface YamlExerciseSpec {
  exercise: string
  sets?: number | YamlSetSpec[]
  reps?: number | string
  load?: string
  duration?: string
  rest?: string
  tempo?: string
  notes?: string
  type?: string[]
  target?: string[]
  synergist?: string[]
  progress?: { if?: string; then: string; else?: string }
  progressionType?: ProgressionType
  minReps?: number
  maxReps?: number
  weightIncrement?: number
  deloadFactor?: number
}

export interface YamlDrillSpec {
  name: string
  sets?: number
  reps?: number | string
  duration?: string
  rest?: string
  perSide?: boolean
  notes?: string
}

export interface YamlRunSegment {
  type?: RunSegmentType
  name?: string
  distance?: string | number
  duration?: string | number
  pace?: string
  reps?: number | string
  rest?: string | number
  drills?: YamlDrillSpec[]
  notes?: string
}

export interface YamlSlot {
  type: string
  name?: string
  focus?: string
  intent?: string
  difficulty?: string
  subtype?: string
  location?: string
  durationMin?: number
  warmup?: YamlExerciseSpec[]
  exercises?: YamlExerciseSpec[]
  segments?: YamlRunSegment[]
  progress?: { if?: string; then: string; else?: string }
  notes?: string
}

export interface YamlDay {
  label: string
  slots: YamlSlot[]
}

export interface YamlProgram {
  schemaVersion?: 1
  name: string
  description?: string
  duration: { type: 'rotations' | 'weeks'; value: number }
  vars?: Record<string, number>
  days: YamlDay[]
}
