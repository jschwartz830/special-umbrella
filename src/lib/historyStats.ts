import type { HistoryEntry, ExtraWorkoutEntry, Plan, WorkoutType, WorkoutOutcome } from '../types'
import type { ExerciseSessionRecord } from '../store/exerciseHistoryStore'

export interface HistoryStats {
  totalLogged: number
  totalCompleted: number
  last7Completed: number
  last30Completed: number
  currentStreak: number
}

/**
 * Compute read-only stats over a set of history entries and ad-hoc extras.
 *
 * - `totalLogged` counts rotation entries (any action) plus every extra.
 * - `totalCompleted` counts `complete` rotation entries plus every extra
 *   (extras represent workouts the user actually did).
 * - `last7Completed` / `last30Completed` count `complete` rotation entries
 *   and extras within the N-day window ending on `today` (inclusive).
 * - `currentStreak` counts consecutive calendar days ending at `today`
 *   (inclusive) that have a `complete` or `day_off` rotation entry, or
 *   any extra. `skip` (without a qualifying counterpart on the same day)
 *   or an empty day breaks the streak.
 *
 * All date math uses string comparison on YYYY-MM-DD inputs.
 */
export function computeHistoryStats(
  entries: HistoryEntry[],
  extras: ExtraWorkoutEntry[],
  today: string,
): HistoryStats {
  const totalLogged = entries.length + extras.length
  const totalCompleted =
    entries.filter(e => e.action === 'complete').length + extras.length

  const d7 = shiftDay(today, -6)   // window of 7 days inclusive of today
  const d30 = shiftDay(today, -29) // window of 30 days inclusive of today

  const inWindow = (date: string, from: string) =>
    date >= from && date <= today

  const last7Completed =
    entries.filter(e => e.action === 'complete' && inWindow(e.calendarDate, d7)).length +
    extras.filter(e => inWindow(e.calendarDate, d7)).length
  const last30Completed =
    entries.filter(e => e.action === 'complete' && inWindow(e.calendarDate, d30)).length +
    extras.filter(e => inWindow(e.calendarDate, d30)).length

  const streakable = new Set<string>()
  for (const e of entries) {
    if (e.action === 'complete' || e.action === 'day_off') streakable.add(e.calendarDate)
  }
  for (const e of extras) streakable.add(e.calendarDate)

  let currentStreak = 0
  let cursor = today
  while (streakable.has(cursor)) {
    currentStreak++
    cursor = shiftDay(cursor, -1)
  }

  return { totalLogged, totalCompleted, last7Completed, last30Completed, currentStreak }
}

// ── Plan progress ─────────────────────────────────────────────────────────────

export interface PlanProgress {
  /** Number of completed units (rotations or full weeks elapsed). */
  completed: number
  /** Total units defined by the plan's duration. */
  total: number
  /** 0–100, capped at 100. */
  percentComplete: number
}

/**
 * Compute how far through its defined duration a plan has progressed.
 *
 * - `weeks` plans: completed = full 7-day weeks elapsed since startDate
 *   (floor), capped at the plan's week count.
 * - `rotations` plans: completed = full rotations finished, where one
 *   rotation = plan.days.length complete/skip entries. `day_off` entries
 *   do not count toward rotation completion (mirrors `isPlanExpired`).
 *
 * Returns zeros for an empty-day plan or a plan that hasn't started yet.
 */
export function computePlanProgress(
  plan: Plan,
  entries: HistoryEntry[],
  today: string,
): PlanProgress {
  const total = plan.duration.value

  if (plan.days.length === 0 || total <= 0) {
    return { completed: 0, total, percentComplete: 0 }
  }

  let completed: number

  if (plan.duration.type === 'weeks') {
    const daysElapsed = dateDiffDays(plan.startDate, today)
    const weeksElapsed = Math.max(0, Math.floor(daysElapsed / 7))
    completed = Math.min(weeksElapsed, total)
  } else {
    const planEntries = entries.filter(
      e => e.planId === plan.id && (e.action === 'complete' || e.action === 'skip'),
    )
    const rotationsFinished = Math.floor(planEntries.length / plan.days.length)
    completed = Math.min(rotationsFinished, total)
  }

  const percentComplete = Math.min(Math.round((completed / total) * 100), 100)
  return { completed, total, percentComplete }
}

// ── Rotation cycle progress ───────────────────────────────────────────────────

export interface RotationCycleProgress {
  /** How many complete/skip actions have been logged in the current cycle (0-based). */
  doneInCycle: number
  /** Total days per rotation (plan.days.length). */
  rotationLength: number
  /** How many more complete/skip actions are needed to finish this cycle. */
  remaining: number
  /** True when doneInCycle === 0 and at least one full rotation was already completed. */
  justCompletedRotation: boolean
}

/**
 * Returns cycle progress for `rotations`-duration plans only.
 * Returns `null` for `weeks`-duration plans or plans with no days.
 *
 * A "cycle" is one full pass through all plan.days. Progress is measured by
 * `complete` and `skip` entries — `day_off` entries do not advance the rotation
 * and are excluded (mirrors `isPlanExpired`).
 */
export function computeRotationCycleProgress(
  plan: Plan,
  entries: HistoryEntry[],
): RotationCycleProgress | null {
  if (plan.duration.type !== 'rotations' || plan.days.length === 0) return null

  const planEntries = entries.filter(
    e => e.planId === plan.id && (e.action === 'complete' || e.action === 'skip'),
  )
  const totalDone = planEntries.length
  const rotationLength = plan.days.length
  const doneInCycle = totalDone % rotationLength
  const remaining = rotationLength - doneInCycle

  return {
    doneInCycle,
    rotationLength,
    remaining,
    justCompletedRotation: doneInCycle === 0 && totalDone > 0,
  }
}

/** Difference in calendar days between two YYYY-MM-DD strings (b − a). */
function dateDiffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const dtA = Date.UTC(ay, am - 1, ad)
  const dtB = Date.UTC(by, bm - 1, bd)
  return Math.floor((dtB - dtA) / 86_400_000)
}

/** Shift a YYYY-MM-DD string by `delta` days (positive or negative). */
function shiftDay(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + delta)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// ── Past-unlogged-days counter ────────────────────────────────────────────────

/**
 * Count days in the recent past (up to `lookbackDays` before today) that have
 * no history entry for the given plan.
 *
 * A missing entry means the rotation pointer is stalled on that day; this count
 * helps TodayPage surface a nudge when the user has not been logging workouts.
 *
 * Only days on or after `planStartDate` are considered.
 * `day_off`, `skip`, and `complete` entries all count as "logged".
 *
 * @param planId        Plan to query.
 * @param entries       All history entries (unfiltered; function filters by plan).
 * @param planStartDate YYYY-MM-DD start date of the plan.
 * @param today         YYYY-MM-DD reference date (exclusive upper bound).
 * @param lookbackDays  How many days before today to inspect (default 7).
 * @returns Number of unlogged days in [max(planStartDate, today−lookbackDays), yesterday].
 */
export function countPastUnloggedDays(
  planId: string,
  entries: import('../types').HistoryEntry[],
  planStartDate: string,
  today: string,
  lookbackDays = 7,
): number {
  if (lookbackDays <= 0) return 0

  const entryDates = new Set(
    entries.filter(e => e.planId === planId).map(e => e.calendarDate),
  )

  let count = 0
  for (let i = 1; i <= lookbackDays; i++) {
    const date = shiftDay(today, -i)
    if (date < planStartDate) break
    if (!entryDates.has(date)) count++
  }
  return count
}

// ── Workout type breakdown ────────────────────────────────────────────────────

export interface WorkoutTypeStat {
  /** Number of completed rotation entries + all extras for this type. */
  completed: number
  /** Number of skipped rotation entries for this type. */
  skipped: number
  /**
   * Average perceived effort (1–5) across completed workouts that have an
   * outcome with perceivedEffort set. null when no effort data is available.
   */
  avgEffort: number | null
}

export type WorkoutTypeBreakdown = Partial<Record<WorkoutType, WorkoutTypeStat>>

/**
 * Aggregate per-workout-type completion stats from rotation history entries,
 * ad-hoc extras, and outcomes.
 *
 * - Rotation entry type comes from the plan day's first slot via `planDaysById`
 *   (a Map from planDayIndex → { slots: [{ type }] }). Entries whose index is
 *   not found in the map are skipped for type attribution. Pass `null` to skip
 *   all rotation entries (e.g., if plan data is unavailable).
 * - Extra entries use their `workoutType` field directly.
 * - `day_off` entries have no specific workout type and are excluded.
 * - Optional `dateRange` restricts to a `{ from, to }` window (inclusive,
 *   YYYY-MM-DD strings). Omit for all-time results.
 *
 * Only types that appear in the data are present in the returned object.
 */
export function computeWorkoutTypeBreakdown(
  entries: HistoryEntry[],
  extras: ExtraWorkoutEntry[],
  outcomes: Record<string, WorkoutOutcome>,
  planDaysById: Map<number, { slots: Array<{ type: WorkoutType }> }> | null,
  dateRange?: { from: string; to: string },
): WorkoutTypeBreakdown {
  const counts = new Map<WorkoutType, { completed: number; skipped: number }>()
  const effortSums = new Map<WorkoutType, { sum: number; count: number }>()

  const inRange = (date: string) =>
    !dateRange || (date >= dateRange.from && date <= dateRange.to)

  function ensureType(type: WorkoutType) {
    if (!counts.has(type)) counts.set(type, { completed: 0, skipped: 0 })
  }

  function addEffort(type: WorkoutType, effort: number | null | undefined) {
    if (effort == null) return
    const cur = effortSums.get(type) ?? { sum: 0, count: 0 }
    cur.sum += effort
    cur.count += 1
    effortSums.set(type, cur)
  }

  // ── Rotation entries ──────────────────────────────────────────────────────
  for (const e of entries) {
    if (!inRange(e.calendarDate)) continue
    if (e.action === 'day_off') continue
    if (e.planDayIndex === undefined || !planDaysById) continue

    const type = planDaysById.get(e.planDayIndex)?.slots[0]?.type ?? null
    if (!type) continue

    ensureType(type)
    if (e.action === 'complete') {
      counts.get(type)!.completed++
      const outcome = outcomes[`${e.planId}_${e.calendarDate}`]
      addEffort(type, outcome?.perceivedEffort)
    } else if (e.action === 'skip') {
      counts.get(type)!.skipped++
    }
  }

  // ── Extra entries (all treated as completed) ──────────────────────────────
  for (const x of extras) {
    if (!inRange(x.calendarDate)) continue
    ensureType(x.workoutType)
    counts.get(x.workoutType)!.completed++
    const extraKey = `${x.planId}_${x.calendarDate}_extra_${x.id}`
    addEffort(x.workoutType, outcomes[extraKey]?.perceivedEffort)
  }

  // ── Assemble result ───────────────────────────────────────────────────────
  const result: WorkoutTypeBreakdown = {}
  for (const [type, { completed, skipped }] of counts) {
    const effort = effortSums.get(type)
    result[type] = {
      completed,
      skipped,
      avgEffort: effort && effort.count > 0
        ? Math.round((effort.sum / effort.count) * 10) / 10
        : null,
    }
  }
  return result
}

// ── Personal Records ──────────────────────────────────────────────────────────

export interface PersonalRecord {
  exerciseName: string
  maxLoad: number | null
  maxLoadDate: string | null
  maxReps: number | null
  maxRepsDate: string | null
  sessionCount: number
}

/**
 * Derive one PR row per exercise from a flat list of exercise session records.
 * Optionally scoped to a single plan via `planId` (pass `null` for all-time).
 */
export function computePersonalRecords(
  records: ExerciseSessionRecord[],
  planId: string | null,
): PersonalRecord[] {
  const scoped = planId ? records.filter(r => r.planId === planId) : records

  const byExercise = new Map<string, PersonalRecord>()

  for (const r of scoped) {
    const existing = byExercise.get(r.exerciseName)
    if (!existing) {
      byExercise.set(r.exerciseName, {
        exerciseName: r.exerciseName,
        maxLoad: r.maxLoad,
        maxLoadDate: r.maxLoad !== null ? r.calendarDate : null,
        maxReps: r.maxReps,
        maxRepsDate: r.maxReps !== null ? r.calendarDate : null,
        sessionCount: 1,
      })
      continue
    }

    existing.sessionCount++

    if (r.maxLoad !== null && (existing.maxLoad === null || r.maxLoad > existing.maxLoad)) {
      existing.maxLoad = r.maxLoad
      existing.maxLoadDate = r.calendarDate
    }
    if (r.maxReps !== null && (existing.maxReps === null || r.maxReps > existing.maxReps)) {
      existing.maxReps = r.maxReps
      existing.maxRepsDate = r.calendarDate
    }
  }

  return [...byExercise.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName))
}

// ── Plan-scoped streak ────────────────────────────────────────────────────────

/**
 * Compute the current consecutive-day streak for a single plan.
 *
 * Counts backward from `today` (inclusive) while each day has at least one
 * of the following for `planId`:
 *   - a `complete` or `day_off` rotation entry, OR
 *   - any extra workout entry.
 *
 * A `skip` entry alone does NOT count — the same deliberate rule as the
 * global streak in `computeHistoryStats`.
 *
 * Returns 0 if today has no qualifying activity for this plan.
 */
export function computePlanStreak(
  planId: string,
  entries: HistoryEntry[],
  extras: ExtraWorkoutEntry[],
  today: string,
): number {
  const streakable = new Set<string>()
  for (const e of entries) {
    if (e.planId !== planId) continue
    if (e.action === 'complete' || e.action === 'day_off') streakable.add(e.calendarDate)
  }
  for (const e of extras) {
    if (e.planId === planId) streakable.add(e.calendarDate)
  }

  let streak = 0
  let cursor = today
  while (streakable.has(cursor)) {
    streak++
    cursor = shiftDay(cursor, -1)
  }
  return streak
}

// ── Per-plan-day completion counter ──────────────────────────────────────────

/**
 * Count how many times a specific plan day (by index) has been completed
 * for a given plan. Useful for surfacing "Session N" context on today's card.
 *
 * @param planId        Plan to query.
 * @param planDayIndex  The rotation day index to count.
 * @param entries       All history entries for this plan (pre-filtered or not).
 * @param excludeDate   Optional YYYY-MM-DD date to exclude (e.g. today, to get prior count).
 */
export function countPlanDayCompletions(
  planId: string,
  planDayIndex: number,
  entries: HistoryEntry[],
  excludeDate?: string,
): number {
  return entries.filter(
    e =>
      e.planId === planId &&
      e.planDayIndex === planDayIndex &&
      e.action === 'complete' &&
      e.calendarDate !== excludeDate,
  ).length
}
