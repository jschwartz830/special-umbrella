import { CheckCircle2, SkipForward, Coffee, Ruler, Zap, Clock, TrendingUp } from 'lucide-react'
import { WorkoutBadge } from './WorkoutBadge'
import { DifficultyBadge } from './DifficultyBadge'
import type { ResolvedDay } from '../../types'
import { WORKOUT_META } from '../../lib/constants'
import { isRunType } from '../../modules/workout-metadata/types'
import { resolveWorkoutDisplayTarget } from '../../modules/run-adaptation/selectors'
import { useOutcomeStore } from '../../store/outcomeStore'

interface Props {
  resolved: ResolvedDay
  isToday?: boolean
  onClick?: () => void
}

function SlotDetails({ slot }: { slot: ResolvedDay['planDay']['slots'][number] }) {
  const getProgressionState = useOutcomeStore(s => s.getProgressionState)

  const isRun = isRunType(slot.type)
  const progressionState = isRun && slot.runConfig?.progressionGroupId
    ? getProgressionState(slot.runConfig.progressionGroupId)
    : null

  const resolved = resolveWorkoutDisplayTarget(slot, progressionState)

  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <WorkoutBadge type={slot.type} size="sm" />
        {slot.difficulty && <DifficultyBadge difficulty={slot.difficulty} />}
        {slot.isDeload && (
          <span className="text-xs text-yellow-400 font-medium">Deload</span>
        )}
      </div>

      <p className="text-sm font-medium text-slate-200 mt-1">{slot.name}</p>

      {/* Run config subtype */}
      {isRun && slot.runConfig?.subtype && (
        <p className="text-[10px] text-slate-500 capitalize mt-0.5">
          {slot.runConfig.subtype.replace(/_/g, ' ')}
        </p>
      )}

      {/* Target metrics — prefer resolved (progression-aware) values */}
      <div className="flex flex-wrap gap-2 mt-1">
        {resolved.targetDistanceMiles != null && (
          <span className="flex items-center gap-0.5 text-xs text-slate-400">
            <Ruler size={11} />
            {resolved.targetDistanceMiles} mi
            {resolved.isFromProgression && (
              <TrendingUp size={9} className="text-sky-400 ml-0.5" />
            )}
          </span>
        )}
        {/* Pace range from runConfig */}
        {resolved.targetPaceRange?.minSecondsPerMile != null && (
          <span className="flex items-center gap-0.5 text-xs text-slate-400">
            <Zap size={11} />
            {formatPaceRange(
              resolved.targetPaceRange.minSecondsPerMile,
              resolved.targetPaceRange.maxSecondsPerMile,
            )}
          </span>
        )}
        {/* Legacy pace (min/mile float) */}
        {!resolved.targetPaceRange && slot.targetPace != null && (
          <span className="flex items-center gap-0.5 text-xs text-slate-400">
            <Zap size={11} /> {slot.targetPace} min/mi
          </span>
        )}
        {resolved.targetDurationMin != null && (
          <span className="flex items-center gap-0.5 text-xs text-slate-400">
            <Clock size={11} /> {resolved.targetDurationMin} min
          </span>
        )}
        {/* Fallback for non-run slots using legacy targetTime */}
        {!isRun && slot.targetTime != null && resolved.targetDurationMin == null && (
          <span className="flex items-center gap-0.5 text-xs text-slate-400">
            <Clock size={11} /> {slot.targetTime} min
          </span>
        )}
      </div>

      {/* Structure text */}
      {resolved.structureText && (
        <p className="text-xs text-slate-500 mt-1 italic">{resolved.structureText}</p>
      )}

      {/* Tags */}
      {slot.tags && slot.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {slot.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-500 border border-slate-600 capitalize"
            >
              {tag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {slot.notes && (
        <p className="text-xs text-slate-500 mt-1 italic">{slot.notes}</p>
      )}
    </div>
  )
}

function formatPaceRange(minSpm: number, maxSpm?: number | null): string {
  const fmt = (spm: number) => {
    const m = Math.floor(spm / 60)
    const s = Math.round(spm % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }
  if (maxSpm != null) return `${fmt(minSpm)}–${fmt(maxSpm)} /mi`
  return `${fmt(minSpm)} /mi`
}

export function WorkoutDayCard({ resolved, isToday, onClick }: Props) {
  const { planDay, status, historyEntry } = resolved
  const meta = WORKOUT_META[planDay.slots[0].type]

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
          ? `border-l-4 border-${meta.bgColor.replace('bg-', '')}`
          : 'border-slate-700/50'

  const opacity = isSkipped || isDayOff ? 'opacity-50' : ''

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
          </div>

          {/* Slots */}
          <div className={`space-y-2 mt-1 ${planDay.slots.length > 1 ? 'divide-y divide-slate-700/50' : ''}`}>
            {planDay.slots.map((slot, i) => (
              <div key={slot.id} className={i > 0 ? 'pt-2' : ''}>
                <SlotDetails slot={slot} />
              </div>
            ))}
          </div>
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
