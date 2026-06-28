import { useState } from 'react'
import { CheckCircle2, SkipForward, Coffee, ChevronDown, ChevronUp } from 'lucide-react'
import type { ResolvedDay } from '../../types'
import { WORKOUT_META } from '../../lib/constants'
import { WorkoutSlotDetails } from './WorkoutSlotDetails'

interface Props {
  resolved: ResolvedDay
  planId?: string
  isToday?: boolean
  /** How many times this plan day has been completed before (excluding today). */
  sessionCount?: number
  onClick?: () => void
  /** When true, exercise details start collapsed with a toggle to expand. */
  collapsible?: boolean
}

export function WorkoutDayCard({ resolved, planId, isToday, sessionCount, onClick, collapsible }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { planDay, status, historyEntry } = resolved
  const meta = WORKOUT_META[planDay.slots[0]?.type ?? 'rest']

  const isComplete = status === 'past_complete' || status === 'today_complete'
  const isSkipped = status === 'past_skip' || status === 'today_skip'
  const isDayOff = status === 'past_day_off' || status === 'today_day_off'
  const isPending = status === 'today_pending'

  const borderColor = isComplete
    ? 'border-emerald-500/50'
    : isSkipped
      ? 'border-slate-600'
      : isDayOff
        ? 'border-slate-600'
        : isPending
          ? `border-l-4 ${meta.borderColor}`
          : 'border-slate-700/50'

  const opacity = isSkipped || isDayOff ? 'opacity-50' : ''

  const hasExercises = planDay.slots.some(s => (s.exercises?.length ?? 0) > 0)

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border bg-slate-800/80 p-4 transition-all active:scale-[0.98] ${borderColor} ${opacity} ${onClick ? 'hover:bg-slate-700/80' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-200 truncate">
              {planDay.label}
            </span>
            {isToday && isPending && (
              <span className="flex-shrink-0 text-xs bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full font-medium">
                Today
              </span>
            )}
            {sessionCount !== undefined && sessionCount > 0 && (
              <span className="flex-shrink-0 text-xs text-slate-500 font-medium">
                ×{sessionCount} done
              </span>
            )}
          </div>

          {/* Slots */}
          <div className={`space-y-2 mt-1 ${planDay.slots.length > 1 ? 'divide-y divide-slate-700/50' : ''}`}>
            {planDay.slots.map((slot, i) => (
              <div key={slot.id} className={i > 0 ? 'pt-2' : ''}>
                <WorkoutSlotDetails
                  slot={slot}
                  planId={planId}
                  collapsed={collapsible && !expanded}
                />
              </div>
            ))}
          </div>

          {/* Expand/collapse toggle for upcoming cards */}
          {collapsible && hasExercises && (
            <div
              onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
              className="mt-1.5 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer select-none"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? 'Hide exercises' : 'Preview exercises'}
            </div>
          )}
        </div>

        {/* Status icon */}
        <div className="flex-shrink-0 mt-0.5">
          {isComplete && <CheckCircle2 size={20} className="text-emerald-400" />}
          {isSkipped && <SkipForward size={20} className="text-slate-500" />}
          {isDayOff && <Coffee size={20} className="text-slate-500" />}
        </div>
      </div>

      {/* Notes from history entry */}
      {historyEntry?.notes && (
        <p className="mt-2 text-xs text-slate-400 italic border-t border-slate-700/50 pt-2">
          "{historyEntry.notes}"
        </p>
      )}
    </button>
  )
}
