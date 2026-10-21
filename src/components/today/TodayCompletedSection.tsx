import { CheckCircle2, ChevronRight, Play } from 'lucide-react'
import type { DayStatus, ExtraWorkoutEntry, PlanDay } from '../../types'
import type { SegmentKind, WorkoutSegment } from '../../lib/workoutSegments'
import { SwipeToDelete } from '../shared/SwipeToDelete'

interface TodayCompletedSectionProps {
  /** Omitted when there is no active plan — only logged extras are shown then. */
  status?: DayStatus
  primaryPlanDay?: PlanDay
  todayExtras: ExtraWorkoutEntry[]
  onEditOutcome: () => void
  onEditExtra: (extra: ExtraWorkoutEntry) => void
  onDeleteExtra: (extra: ExtraWorkoutEntry) => void
  /** Parts of today's logged workout not done yet (e.g. mobility after a run). */
  remainingSegments?: WorkoutSegment[]
  onStartSegment?: (kind: SegmentKind) => void
}

export function TodayCompletedSection({
  status,
  primaryPlanDay,
  todayExtras,
  onEditOutcome,
  onEditExtra,
  onDeleteExtra,
  remainingSegments = [],
  onStartSegment,
}: TodayCompletedSectionProps) {
  if (status !== 'today_complete' && todayExtras.length === 0) return null

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Completed today</h2>
      {status === 'today_complete' && primaryPlanDay && (
        <button
          onClick={onEditOutcome}
          className="w-full text-left flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/12 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors active:scale-[0.99]"
        >
          <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-emerald-200 font-medium truncate">{primaryPlanDay.label}</p>
            {primaryPlanDay.slots.length > 0 && (
              <p className="text-xs text-emerald-300/70 mt-0.5 truncate">
                {primaryPlanDay.slots.map(s => s.name).join(' + ')}
              </p>
            )}
          </div>
          <ChevronRight size={14} className="text-emerald-400/60 flex-shrink-0 mt-1" />
        </button>
      )}
      {status === 'today_complete' && remainingSegments.map(seg => (
        <button
          key={seg.kind}
          onClick={() => onStartSegment?.(seg.kind)}
          className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700/70 transition-colors active:scale-[0.99]"
        >
          <Play size={14} className="text-sky-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 font-medium truncate">{seg.slot.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">Not done yet · tap to start</p>
          </div>
          <ChevronRight size={14} className="text-slate-500 flex-shrink-0" />
        </button>
      ))}
      {todayExtras.map(extra => (
        <SwipeToDelete
          key={extra.id}
          onDelete={() => onDeleteExtra(extra)}
        >
          <button
            onClick={() => onEditExtra(extra)}
            className="w-full text-left flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/12 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors active:scale-[0.99]"
          >
            <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-emerald-200 font-medium truncate">{extra.workoutName}</p>
              <p className="text-xs text-emerald-300/70 mt-0.5 truncate capitalize">
                {extra.workoutType.replace(/_/g, ' ')}
              </p>
            </div>
            <ChevronRight size={14} className="text-emerald-400/60 flex-shrink-0 mt-1" />
          </button>
        </SwipeToDelete>
      ))}
    </section>
  )
}
