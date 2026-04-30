import { Clock, Ruler, TrendingUp, Zap } from 'lucide-react'
import { WorkoutBadge } from './WorkoutBadge'
import { DifficultyBadge } from './DifficultyBadge'
import type { WorkoutSlot } from '../../types'
import { isRunType } from '../../modules/workout-metadata/types'
import { resolveWorkoutDisplayTarget } from '../../modules/run-adaptation/selectors'
import { useOutcomeStore } from '../../store/outcomeStore'
import { useProgramStore } from '../../store/programStore'
import { resolveLoad } from '../../lib/expressionEval'

interface Props {
  slot: WorkoutSlot
  planId?: string
  className?: string
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

function resolveDisplayLoad(
  loadExpr: string | undefined,
  vars: Record<string, number>,
): string | null {
  if (!loadExpr) return null
  const trimmed = loadExpr.trim()
  const lower = trimmed.toLowerCase()

  if (lower === 'bodyweight' || lower === 'bw') return 'BW'

  // Plain numeric literal with optional lb/kg unit — no vars needed
  const plainNum = trimmed.match(/^(\d+(?:\.\d+)?)\s*(lb|kg)?$/i)
  if (plainNum) {
    const unit = (plainNum[2] ?? 'lb').toLowerCase()
    return `${plainNum[1]}${unit}`
  }

  // Expression with variable references — resolve using current vars
  const resolved = resolveLoad(loadExpr, { vars })
  if (resolved !== null && resolved > 0) {
    const display = resolved % 1 === 0 ? String(resolved) : resolved.toFixed(1)
    return `${display}lb`
  }

  // Can't resolve (vars not available or result is 0) — hide rather than show variable name
  return null
}

function formatExercisePrescription(
  slot: WorkoutSlot,
  vars: Record<string, number>,
): string[] {
  const lines: string[] = []
  for (const ex of slot.exercises ?? []) {
    if (Array.isArray(ex.sets) && ex.sets.length > 0) {
      const setText = ex.sets
        .map((set, idx) => {
          const repOrDur = set.reps ?? set.duration ?? ex.reps ?? ex.duration
          const rawLoad = set.load ?? ex.load
          const load = resolveDisplayLoad(rawLoad, vars)
          const rest = set.rest ?? ex.rest
          const parts = [repOrDur, load && `@ ${load}`, rest && `rest ${rest}`].filter(Boolean)
          return `S${idx + 1} ${parts.join(' • ')}`
        })
        .join(' · ')
      lines.push(`${ex.exercise}: ${setText}`)
      continue
    }

    const setCount = typeof ex.sets === 'number' ? ex.sets : null
    const repOrDur = ex.reps ?? ex.duration
    const load = resolveDisplayLoad(ex.load, vars)
    const base = [
      setCount != null ? `${setCount} sets` : null,
      repOrDur != null ? `${repOrDur}` : null,
      load ? `@ ${load}` : null,
      ex.rest ? `rest ${ex.rest}` : null,
    ].filter(Boolean).join(' • ')
    lines.push(base ? `${ex.exercise}: ${base}` : ex.exercise)
  }
  return lines
}

export function WorkoutSlotDetails({ slot, planId, className }: Props) {
  const getProgressionState = useOutcomeStore(s => s.getProgressionState)
  const vars = useProgramStore(s => planId ? (s.vars[planId] ?? {}) : {})

  const isRun = isRunType(slot.type)
  const progressionState = isRun && slot.runConfig?.progressionGroupId
    ? getProgressionState(slot.runConfig.progressionGroupId)
    : null

  const resolved = resolveWorkoutDisplayTarget(slot, progressionState)
  const exerciseLines = formatExercisePrescription(slot, vars)

  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <WorkoutBadge type={slot.type} size="sm" />
        {slot.difficulty && <DifficultyBadge difficulty={slot.difficulty} />}
        {slot.isDeload && (
          <span className="text-xs text-yellow-400 font-medium">Deload</span>
        )}
      </div>

      <p className="text-sm font-medium text-slate-200 mt-1">{slot.name}</p>

      {isRun && slot.runConfig?.subtype && (
        <p className="text-[10px] text-slate-500 capitalize mt-0.5">
          {slot.runConfig.subtype.replace(/_/g, ' ')}
        </p>
      )}

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
        {resolved.targetPaceRange?.minSecondsPerMile != null && (
          <span className="flex items-center gap-0.5 text-xs text-slate-400">
            <Zap size={11} />
            {formatPaceRange(
              resolved.targetPaceRange.minSecondsPerMile,
              resolved.targetPaceRange.maxSecondsPerMile,
            )}
          </span>
        )}
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
        {!isRun && slot.targetTime != null && resolved.targetDurationMin == null && (
          <span className="flex items-center gap-0.5 text-xs text-slate-400">
            <Clock size={11} /> {slot.targetTime} min
          </span>
        )}
      </div>

      {resolved.structureText && (
        <p className="text-xs text-slate-500 mt-1 italic">{resolved.structureText}</p>
      )}

      {slot.subtype && (
        <p className="text-[10px] text-slate-500 capitalize mt-1">{slot.subtype.replace(/_/g, ' ')}</p>
      )}

      {exerciseLines.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {exerciseLines.map(line => (
            <p key={line} className="text-[11px] text-slate-400 leading-snug">{line}</p>
          ))}
        </div>
      )}

      {slot.notes && (
        <p className="text-xs text-slate-500 mt-1 italic">{slot.notes}</p>
      )}
    </div>
  )
}
