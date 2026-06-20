import type { PlanDay } from '../types'
import type { ExerciseSpec } from '../types/program'

function formatExerciseSpec(ex: ExerciseSpec): string {
  const sets = typeof ex.sets === 'number' ? ex.sets : (Array.isArray(ex.sets) ? ex.sets.length : '?')
  const reps = ex.reps != null ? ex.reps : '?'
  const load = ex.load ? ` @ ${ex.load}` : ''
  return `  • ${ex.exercise}: ${sets}x${reps}${load}`
}

/**
 * Format a plan day as plain text suitable for clipboard / messaging apps.
 * Returns a compact multi-line string with the day label, plan name, and
 * slot-level detail (exercises, segments, or distance/duration targets).
 */
export function formatWorkoutForClipboard(
  planDay: PlanDay,
  planName: string,
  dateLabel: string,
): string {
  const lines: string[] = [
    `${planDay.label} — ${dateLabel}`,
    `Plan: ${planName}`,
  ]

  for (const slot of planDay.slots) {
    lines.push('')
    const typeLabel = slot.type.replace(/_/g, ' ')
    lines.push(`${slot.name} (${typeLabel})`)

    if (slot.exercises && slot.exercises.length > 0) {
      for (const ex of slot.exercises) {
        lines.push(formatExerciseSpec(ex))
      }
    } else if (slot.segments && slot.segments.length > 0) {
      for (const seg of slot.segments) {
        const label = seg.name ?? seg.type
        const dist = seg.distance ? ` ${seg.distance}` : ''
        const dur = seg.duration ? ` ${seg.duration}` : ''
        const pace = seg.pace ? ` @ ${seg.pace}` : ''
        const reps = seg.reps ? ` x${seg.reps}` : ''
        lines.push(`  • ${label}${reps}${dist}${dur}${pace}`)
      }
    } else {
      const parts: string[] = []
      if (slot.targetDistance) parts.push(`${slot.targetDistance} mi`)
      if (slot.durationMin) parts.push(`${slot.durationMin} min`)
      if (slot.notes) parts.push(slot.notes)
      if (parts.length > 0) lines.push(`  ${parts.join(' · ')}`)
    }

    if (slot.structureDescription) {
      lines.push(`  ${slot.structureDescription}`)
    }
  }

  return lines.join('\n')
}
