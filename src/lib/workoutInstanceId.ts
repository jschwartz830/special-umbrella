/**
 * workoutInstanceId format: `${planId}_${calendarDate}[_extra_${extraId}]`
 * where calendarDate is always YYYY-MM-DD.
 *
 * The custom nanoid in lib/utils uses base-36 (0-9, a-z) so current IDs
 * never include '_', but all helpers here are written defensively so the
 * format remains correct even if the ID alphabet changes in the future.
 */

/** Build the workoutInstanceId for a rotation-day workout */
export function makeWorkoutInstanceId(planId: string, calendarDate: string): string {
  return `${planId}_${calendarDate}`
}

/** Build the workoutInstanceId for an extra (ad-hoc) workout entry */
export function makeExtraWorkoutInstanceId(
  planId: string,
  calendarDate: string,
  extraId: string,
): string {
  return `${planId}_${calendarDate}_extra_${extraId}`
}

/**
 * Parse planId and calendarDate from a workoutInstanceId string.
 *
 * Splitting naively on '_' is fragile when planIds contain underscores.
 * This helper locates the date by regex and derives planId from the
 * separator position so the parser remains correct even if the ID
 * alphabet changes in the future.
 */
export function parseWorkoutInstanceId(
  instanceId: string,
): { planId: string; calendarDate: string } | null {
  const dateMatch = instanceId.match(/(\d{4}-\d{2}-\d{2})/)
  if (!dateMatch) return null
  const calendarDate = dateMatch[1]
  const sep = instanceId.indexOf(`_${calendarDate}`)
  if (sep === -1) return null
  return { planId: instanceId.slice(0, sep), calendarDate }
}
