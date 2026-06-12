import type { HistoryEntry, ExtraWorkoutEntry, Plan, WorkoutType, WorkoutOutcome } from '../types'
import type { ExerciseSessionRecord } from '../store/exerciseHistoryStore'
import { makeWorkoutInstanceId, makeExtraWorkoutInstanceId } from './workoutInstanceId'

export interface HistoryStats {
  totalLogged: number
  totalCompleted: number
  last7Completed: number
  last30Completed: number
  currentStreak: number
  longestStreak: number
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
  // Exclude future-dated entries from all-time counts — a bad CSV import can
  // create entries with calendarDate > today, which would otherwise inflate
  // the stats shown on the History page (same guard applied to longestStreak
  // in pass 42 and to last7/last30 via the inWindow predicate below).
  const totalLogged =
    entries.filter(e => e.calendarDate <= today).length +
    extras.filter(e => e.calendarDate <= today).length
  const totalCompleted =
    entries.filter(e => e.action === 'complete' && e.calendarDate <= today).length +
    extras.filter(e => e.calendarDate <= today).length

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

  // Only dates on or before today count toward longest streak — future-dated
  // entries (e.g. from a bad CSV import) would otherwise inflate the stat.
  const sortedDates = [...streakable].filter(d => d <= today).sort()
  let longestStreak = 0
  let runLen = 0
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0 || dateDiffDays(sortedDates[i - 1], sortedDates[i]) === 1) {
      runLen++
    } else {
      runLen = 1
    }
    if (runLen > longestStreak) longestStreak = runLen
  }

  return { totalLogged, totalCompleted, last7Completed, last30Completed, currentStreak, longestStreak }
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
      e => e.planId === plan.id && e.calendarDate <= today && (e.action === 'complete' || e.action === 'skip'),
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
  today?: string,
): RotationCycleProgress | null {
  if (plan.duration.type !== 'rotations' || plan.days.length === 0) return null

  const planEntries = entries.filter(
    e => e.planId === plan.id &&
      (today === undefined || e.calendarDate <= today) &&
      (e.action === 'complete' || e.action === 'skip'),
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

// ── Plan workouts remaining ───────────────────────────────────────────────────

/**
 * Total complete/skip entries still needed to finish a rotations-based plan.
 *
 * Returns `null` for weeks plans, plans with no days, or a `value <= 0`
 * duration — the same guard conditions used by `isPlanExpired` and
 * `computeRotationCycleProgress`. Returns 0 when the plan is already done.
 *
 * Counts only entries belonging to `plan.id`; day_off entries do not count
 * toward rotation completion and are excluded (mirrors `isPlanExpired`).
 */
export function computeRotationPlanRemaining(
  plan: Plan,
  entries: HistoryEntry[],
  today?: string,
): number | null {
  if (
    plan.duration.type !== 'rotations' ||
    plan.days.length === 0 ||
    plan.duration.value <= 0
  ) return null

  const totalNeeded = plan.duration.value * plan.days.length
  const done = entries.filter(
    e => e.planId === plan.id &&
      (today === undefined || e.calendarDate <= today) &&
      (e.action === 'complete' || e.action === 'skip'),
  ).length
  return Math.max(0, totalNeeded - done)
}

// ── Logged rate ───────────────────────────────────────────────────────────────

/**
 * Compute the percentage of past plan days (since `planStartDate` up to, but
 * not including, `today`) that have at least one history entry logged.
 *
 * "Logged" counts any action — complete, skip, or day_off. The goal is to
 * measure how consistently the user is recording their activity, regardless
 * of the outcome.
 *
 * Returns `null` when the plan started today or in the future (no past days
 * to measure against). Returns 0–100 (integer, capped at 100).
 *
 * Multiple entries for the same date count as one logged day.
 */
export function computeLoggedRate(
  planId: string,
  entries: HistoryEntry[],
  planStartDate: string,
  today: string,
): number | null {
  const activeDays = dateDiffDays(planStartDate, today)
  if (activeDays <= 0) return null

  const loggedDates = new Set(
    entries
      .filter(e => e.planId === planId && e.calendarDate >= planStartDate && e.calendarDate < today)
      .map(e => e.calendarDate),
  )

  return Math.min(Math.round((loggedDates.size / activeDays) * 100), 100)
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
  return getUnloggedPastDates(planId, entries, planStartDate, today, lookbackDays).length
}

/**
 * Return the YYYY-MM-DD dates (newest-first) in the lookback window that have
 * no history entry for the given plan. Mirrors `countPastUnloggedDays` but
 * surfaces the actual dates so callers can act on each one (e.g. batch mark
 * as Day Off).
 */
export function getUnloggedPastDates(
  planId: string,
  entries: import('../types').HistoryEntry[],
  planStartDate: string,
  today: string,
  lookbackDays = 7,
): string[] {
  if (lookbackDays <= 0) return []

  const entryDates = new Set(
    entries.filter(e => e.planId === planId).map(e => e.calendarDate),
  )

  const dates: string[] = []
  for (let i = 1; i <= lookbackDays; i++) {
    const date = shiftDay(today, -i)
    if (date < planStartDate) break
    if (!entryDates.has(date)) dates.push(date)
  }
  return dates
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
  /**
   * Average actual session duration in minutes across completed workouts that
   * have an outcome with durationActualMin set. null when no duration data is
   * available. Rounded to the nearest whole minute.
   */
  avgDurationMin: number | null
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
  const durationSums = new Map<WorkoutType, { sum: number; count: number }>()

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

  function addDuration(type: WorkoutType, durationMin: number | null | undefined) {
    if (durationMin == null) return
    const cur = durationSums.get(type) ?? { sum: 0, count: 0 }
    cur.sum += durationMin
    cur.count += 1
    durationSums.set(type, cur)
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
      const outcome = outcomes[makeWorkoutInstanceId(e.planId, e.calendarDate)]
      addEffort(type, outcome?.perceivedEffort)
      addDuration(type, outcome?.durationActualMin)
    } else if (e.action === 'skip') {
      counts.get(type)!.skipped++
    }
  }

  // ── Extra entries (all treated as completed) ──────────────────────────────
  for (const x of extras) {
    if (!inRange(x.calendarDate)) continue
    ensureType(x.workoutType)
    counts.get(x.workoutType)!.completed++
    const extraKey = makeExtraWorkoutInstanceId(x.planId, x.calendarDate, x.id)
    const extraOutcome = outcomes[extraKey]
    addEffort(x.workoutType, extraOutcome?.perceivedEffort)
    addDuration(x.workoutType, extraOutcome?.durationActualMin)
  }

  // ── Assemble result ───────────────────────────────────────────────────────
  const result: WorkoutTypeBreakdown = {}
  for (const [type, { completed, skipped }] of counts) {
    const effort = effortSums.get(type)
    const duration = durationSums.get(type)
    result[type] = {
      completed,
      skipped,
      avgEffort: effort && effort.count > 0
        ? Math.round((effort.sum / effort.count) * 10) / 10
        : null,
      avgDurationMin: duration && duration.count > 0
        ? Math.round(duration.sum / duration.count)
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

  // Sort ascending by date so later sessions overwrite with `>=`, giving the
  // most-recent date where a PR was matched (not the first date it was set).
  const sorted = [...scoped].sort((a, b) => a.calendarDate.localeCompare(b.calendarDate))

  const byExercise = new Map<string, PersonalRecord>()

  for (const r of sorted) {
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

    if (r.maxLoad !== null && (existing.maxLoad === null || r.maxLoad >= existing.maxLoad)) {
      existing.maxLoad = r.maxLoad
      existing.maxLoadDate = r.calendarDate
    }
    if (r.maxReps !== null && (existing.maxReps === null || r.maxReps >= existing.maxReps)) {
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

// ── Consecutive-skip counter ─────────────────────────────────────────────────

/**
 * Count consecutive calendar days (going backwards from yesterday) where the
 * only logged action for `planId` was `skip`.
 *
 * The streak breaks immediately when any of the following is encountered:
 *   - a `complete` or `day_off` entry on that day
 *   - any extra workout entry on that day
 *   - a day with no entry at all
 *
 * Today is excluded: if the user just completed today's workout the skip streak
 * should not be invalidated mid-day; callers typically display this before the
 * user acts for the day.
 *
 * Returns 0 when yesterday has no skip entry, or when `entries` is empty.
 */
export function computeConsecutiveSkips(
  planId: string,
  entries: HistoryEntry[],
  extras: ExtraWorkoutEntry[],
  today: string,
): number {
  // Build a set of dates that break or satisfy the skip streak.
  const skipDates = new Set<string>()
  const breakDates = new Set<string>()

  for (const e of entries) {
    if (e.planId !== planId) continue
    if (e.action === 'skip') {
      skipDates.add(e.calendarDate)
    } else {
      // complete or day_off — breaks the consecutive skip streak
      breakDates.add(e.calendarDate)
    }
  }
  for (const e of extras) {
    if (e.planId === planId) breakDates.add(e.calendarDate)
  }

  let count = 0
  let cursor = shiftDay(today, -1)

  while (true) {
    if (breakDates.has(cursor)) break   // non-skip activity stops the streak
    if (!skipDates.has(cursor)) break   // no entry or day not in skip set stops the streak
    count++
    cursor = shiftDay(cursor, -1)
  }

  return count
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

// ── Weekly breakdown ──────────────────────────────────────────────────────────

export interface WeeklyBreakdown {
  /** YYYY-MM-DD of the Monday that starts this ISO week */
  weekStart: string
  /** YYYY-MM-DD of the Sunday that ends this ISO week */
  weekEnd: string
  completed: number
  skipped: number
  dayOffs: number
  extras: number
  /** completed + skipped + dayOffs + extras */
  totalLogged: number
  /** True when this row was synthesised by `padWeekGaps` to fill a gap; all counts are 0. */
  isEmpty?: boolean
}

/**
 * Aggregate per-ISO-week stats for a plan over a date range.
 *
 * Weeks begin on Monday (ISO convention). Only entries/extras whose
 * `calendarDate` falls in `[fromDate, toDate]` are included; the range
 * edges may be mid-week, so the first and last returned weeks can be partial.
 *
 * Only entries for `planId` are counted — pass unfiltered store arrays safely.
 *
 * @returns Array of WeeklyBreakdown objects sorted by weekStart ascending.
 *          Weeks with no activity are not included.
 */
export function computeWeeklyBreakdown(
  planId: string,
  entries: HistoryEntry[],
  extras: ExtraWorkoutEntry[],
  fromDate: string,
  toDate: string,
): WeeklyBreakdown[] {
  const weekMap = new Map<string, WeeklyBreakdown>()

  function getOrCreate(weekStart: string): WeeklyBreakdown {
    if (!weekMap.has(weekStart)) {
      weekMap.set(weekStart, {
        weekStart,
        weekEnd: shiftDay(weekStart, 6),
        completed: 0,
        skipped: 0,
        dayOffs: 0,
        extras: 0,
        totalLogged: 0,
      })
    }
    return weekMap.get(weekStart)!
  }

  for (const e of entries) {
    if (e.planId !== planId) continue
    if (e.calendarDate < fromDate || e.calendarDate > toDate) continue
    const week = getOrCreate(isoWeekStart(e.calendarDate))
    if (e.action === 'complete') week.completed++
    else if (e.action === 'skip') week.skipped++
    else if (e.action === 'day_off') week.dayOffs++
    week.totalLogged++
  }

  for (const e of extras) {
    if (e.planId !== planId) continue
    if (e.calendarDate < fromDate || e.calendarDate > toDate) continue
    const week = getOrCreate(isoWeekStart(e.calendarDate))
    week.extras++
    week.totalLogged++
  }

  return [...weekMap.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

/** Return the Monday of the ISO week containing `date` (YYYY-MM-DD). */
export function isoWeekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const day = dt.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const mondayOffset = day === 0 ? -6 : 1 - day
  return shiftDay(date, mondayOffset)
}

/**
 * Fill any ISO-week gaps in a `computeWeeklyBreakdown` result array with
 * zero-count placeholder rows. Gaps are filled only between the first and
 * last week of the provided `weeks` array (not beyond); each missing week
 * in that span is inserted in chronological order.
 *
 * Placeholder rows have all numeric fields set to 0 and an `isEmpty: true`
 * flag so callers can style them differently. Weeks that already exist in the
 * input are kept unchanged. The returned array is always sorted ascending by
 * `weekStart`.
 *
 * No-op when `weeks` has fewer than 2 entries.
 */
export function padWeekGaps(weeks: WeeklyBreakdown[]): WeeklyBreakdown[] {
  if (weeks.length < 2) return weeks

  const sorted = [...weeks].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  const byStart = new Map(sorted.map(w => [w.weekStart, w]))

  const result: WeeklyBreakdown[] = []
  let cursor = sorted[0].weekStart
  const last = sorted[sorted.length - 1].weekStart

  while (cursor <= last) {
    result.push(byStart.get(cursor) ?? {
      weekStart: cursor,
      weekEnd: shiftDay(cursor, 6),
      completed: 0,
      skipped: 0,
      dayOffs: 0,
      extras: 0,
      totalLogged: 0,
      isEmpty: true,
    })
    cursor = shiftDay(cursor, 7)
  }

  return result
}
