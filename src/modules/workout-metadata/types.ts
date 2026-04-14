// ── Workout Metadata Types ────────────────────────────────────────────────────

export type WorkoutTag =
  | 'easy'
  | 'moderate'
  | 'hard'
  | 'recovery'
  | 'long'
  | 'short'
  | 'upper'
  | 'lower'
  | 'full_body'
  | 'run'
  | 'lift'
  | 'yoga'
  | 'swim'
  | 'rest'
  | 'indoor'
  | 'outdoor'
  | 'home'
  | 'gym'

export type WorkoutDifficulty = 'easy' | 'moderate' | 'hard'

export type RunWorkoutSubtype =
  | 'easy_run'
  | 'recovery_run'
  | 'long_run'
  | 'tempo'
  | 'intervals'
  | 'race_pace'
  | 'walk_run'
  | 'other'

export interface PaceRange {
  minSecondsPerMile?: number | null
  maxSecondsPerMile?: number | null
}

export interface RunWorkoutConfig {
  subtype: RunWorkoutSubtype
  targetDistanceMiles?: number | null
  targetDurationMin?: number | null
  targetPaceRange?: PaceRange | null
  targetStructureText?: string | null
  progressionEligible?: boolean
  progressionGroupId?: string | null
  /** Miles per progression step — defaults to 0.5 */
  defaultStepMiles?: number | null
  minStepMiles?: number | null
  maxStepMiles?: number | null
}

/** Display metadata for each tag */
export const TAG_LABELS: Record<WorkoutTag, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  recovery: 'Recovery',
  long: 'Long',
  short: 'Short',
  upper: 'Upper',
  lower: 'Lower',
  full_body: 'Full Body',
  run: 'Run',
  lift: 'Lift',
  yoga: 'Yoga',
  swim: 'Swim',
  rest: 'Rest',
  indoor: 'Indoor',
  outdoor: 'Outdoor',
  home: 'Home',
  gym: 'Gym',
}

export const ALL_WORKOUT_TAGS: WorkoutTag[] = [
  'easy', 'moderate', 'hard', 'recovery', 'long', 'short',
  'upper', 'lower', 'full_body',
  'run', 'lift', 'yoga', 'swim', 'rest',
  'indoor', 'outdoor', 'home', 'gym',
]

export const RUN_SUBTYPE_LABELS: Record<RunWorkoutSubtype, string> = {
  easy_run: 'Easy Run',
  recovery_run: 'Recovery Run',
  long_run: 'Long Run',
  tempo: 'Tempo',
  intervals: 'Intervals',
  race_pace: 'Race Pace',
  walk_run: 'Walk/Run',
  other: 'Other',
}

/** Derive a default subtype from the slot's WorkoutType string */
export function defaultRunSubtype(workoutType: string): RunWorkoutSubtype {
  if (workoutType === 'long_run') return 'long_run'
  if (workoutType === 'recovery_run') return 'recovery_run'
  return 'easy_run'
}

/** Returns true if a slot's WorkoutType is a run variant */
export function isRunType(workoutType: string): boolean {
  return workoutType === 'long_run' || workoutType === 'recovery_run'
}
