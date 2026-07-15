/**
 * workoutInstanceId format: `${planId}_${calendarDate}[_extra_${extraId}]`
 * where calendarDate is always YYYY-MM-DD.
 *
 * The custom nanoid in lib/utils generates hex (0-9, a-f), 32 chars, so
 * current IDs never include '_'. All helpers here are written defensively
 * so the format remains correct even if the ID alphabet changes in the future.
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

/**
 * Extract the extraId from an extra-workout instanceId
 * (`planId_YYYY-MM-DD_extra_<extraId>`).
 *
 * Anchors on the date pattern to stay correct even if planId or extraId
 * contain the substring "_extra_".
 */
export function extractExtraId(instanceId: string): string | null {
  const match = instanceId.match(/_\d{4}-\d{2}-\d{2}_extra_(.+)$/)
  return match?.[1] ?? null
}
