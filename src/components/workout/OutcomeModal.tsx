import { useState } from 'react'
import {
  CheckCircle2,
  MinusCircle,
  Clock3,
  Ruler,
  Timer,
  Zap,
} from 'lucide-react'
import { Modal } from '../shared/Modal'
import type { PlanDay, WorkoutSlot } from '../../types'
import type {
  WorkoutCompletionState,
  PerceivedEffort,
  WorkoutOutcome,
  RunWorkoutActual,
} from '../../modules/workout-outcomes/types'
import { derivePaceSecondsPerMile, formatPace } from '../../modules/workout-outcomes/types'
import { isRunType } from '../../modules/workout-metadata/types'

interface Props {
  planId: string
  calendarDate: string
  planDay: PlanDay
  existingOutcome?: WorkoutOutcome | null
  onConfirm: (outcome: WorkoutOutcome) => void
  onClose: () => void
}

// State picker options — only completion states reachable via the Complete button
const STATE_OPTIONS: {
  state: WorkoutCompletionState
  label: string
  icon: React.ReactNode
  activeClass: string
}[] = [
  {
    state: 'completed',
    label: 'Completed',
    icon: <CheckCircle2 size={16} />,
    activeClass: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
  },
  {
    state: 'partially_completed',
    label: 'Partial',
    icon: <MinusCircle size={16} />,
    activeClass: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
  },
]

const EFFORT_LABELS: Record<PerceivedEffort, string> = {
  1: 'Very Easy',
  2: 'Easy',
  3: 'Moderate',
  4: 'Hard',
  5: 'Max Effort',
}

function getRunSlot(planDay: PlanDay): WorkoutSlot | null {
  return planDay.slots.find(s => isRunType(s.type)) ?? null
}

export function OutcomeModal({
  planId,
  calendarDate,
  planDay,
  existingOutcome,
  onConfirm,
  onClose,
}: Props) {
  const runSlot = getRunSlot(planDay)
  const hasRun = runSlot != null

  const existingState = existingOutcome?.completionState
  const [completionState, setCompletionState] = useState<WorkoutCompletionState>(
    existingState === 'completed' || existingState === 'partially_completed'
      ? existingState
      : 'completed',
  )
  const [effort, setEffort] = useState<PerceivedEffort | null>(
    existingOutcome?.perceivedEffort ?? null,
  )
  const [durationMin, setDurationMin] = useState<string>(
    existingOutcome?.durationActualMin?.toString() ?? '',
  )
  const [notes, setNotes] = useState<string>(existingOutcome?.notes ?? '')

  // Run-specific
  const [distanceMiles, setDistanceMiles] = useState<string>(
    existingOutcome?.runActual?.actualDistanceMiles?.toString() ?? '',
  )
  const [runDurationMin, setRunDurationMin] = useState<string>(
    existingOutcome?.runActual?.actualDurationMin?.toString() ?? '',
  )
  const [completedAsPlanned, setCompletedAsPlanned] = useState<boolean | null>(
    existingOutcome?.runActual?.completedAsPlanned ?? null,
  )

  // Derived average pace
  const dist = parseFloat(distanceMiles)
  const dur = parseFloat(runDurationMin)
  const derivedPace =
    isFinite(dist) && dist > 0 && isFinite(dur) && dur > 0
      ? derivePaceSecondsPerMile(dist, dur)
      : null

  function buildWorkoutInstanceId() {
    return `${planId}_${calendarDate}`
  }

  function handleConfirm() {
    const runActual: RunWorkoutActual | null = hasRun
      ? {
          actualDistanceMiles: isFinite(dist) && dist > 0 ? dist : null,
          actualDurationMin: isFinite(dur) && dur > 0 ? dur : null,
          averagePaceSecondsPerMile: derivedPace,
          completedAsPlanned,
        }
      : null

    const outcome: WorkoutOutcome = {
      workoutInstanceId: buildWorkoutInstanceId(),
      completionState,
      completedAt: new Date().toISOString(),
      durationActualMin: parseFloat(durationMin) || null,
      perceivedEffort: effort,
      notes: notes.trim() || null,
      runActual,
    }

    onConfirm(outcome)
  }

  const stateLabel =
    completionState === 'partially_completed' ? 'Log Partial' : 'Mark Complete'

  return (
    <Modal
      title="Log Workout"
      onClose={onClose}
      footer={
        <button
          onClick={handleConfirm}
          className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold transition-colors"
        >
          {stateLabel}
        </button>
      }
    >
      <div className="space-y-5">
        {/* Completion state selector */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">
            Status
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {STATE_OPTIONS.map(opt => (
              <button
                key={opt.state}
                onClick={() => setCompletionState(opt.state)}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] font-semibold transition-colors ${
                  completionState === opt.state
                    ? opt.activeClass
                    : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Effort picker */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">
            Perceived Effort
          </p>
          <div className="flex gap-1.5">
            {([1, 2, 3, 4, 5] as PerceivedEffort[]).map(e => (
              <button
                key={e}
                onClick={() => setEffort(prev => (prev === e ? null : e))}
                className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-colors ${
                  effort === e
                    ? e <= 2
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : e === 3
                        ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                        : e === 4
                          ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                          : 'bg-red-500/20 border-red-500/50 text-red-400'
                    : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          {effort && (
            <p className="text-xs text-slate-500 mt-1 text-center">
              {EFFORT_LABELS[effort]}
            </p>
          )}
        </div>

        {/* Duration */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wide font-medium block mb-2">
            <Clock3 size={11} className="inline mr-1" />
            Duration (min)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={durationMin}
            onChange={e => setDurationMin(e.target.value)}
            placeholder="Optional"
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Run-specific actuals */}
        {hasRun && (
          <div className="space-y-3 border border-slate-700 rounded-xl p-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
              Run Actuals
            </p>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Ruler size={11} /> Distance (mi)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={distanceMiles}
                  onChange={e => setDistanceMiles(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>

              <label className="space-y-1">
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Timer size={11} /> Time (min)
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={runDurationMin}
                  onChange={e => setRunDurationMin(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
            </div>

            {/* Derived pace */}
            {derivedPace != null && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-700/50 rounded-lg px-3 py-2">
                <Zap size={11} className="text-sky-400" />
                <span>Avg pace: <strong className="text-sky-300">{formatPace(derivedPace)}</strong></span>
              </div>
            )}

            {/* Completed as planned */}
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Completed as planned?</p>
              <div className="flex gap-2">
                {([true, false] as const).map(val => (
                  <button
                    key={String(val)}
                    onClick={() => setCompletedAsPlanned(prev => prev === val ? null : val)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      completedAsPlanned === val
                        ? val
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'bg-red-500/20 border-red-500/50 text-red-400'
                        : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                    }`}
                  >
                    {val ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wide font-medium block mb-2">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How did it feel? Any notes..."
            rows={3}
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
          />
        </div>
      </div>
    </Modal>
  )
}
