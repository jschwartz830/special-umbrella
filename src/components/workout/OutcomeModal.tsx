import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  MinusCircle,
  Clock3,
  Ruler,
  Timer,
  Zap,
  Dumbbell,
  Waves,
  Play,
  Pause,
} from 'lucide-react'
import { Modal } from '../shared/Modal'
import type { PlanDay, WorkoutSlot } from '../../types'
import type {
  WorkoutCompletionState,
  PerceivedEffort,
  WorkoutOutcome,
  RunWorkoutActual,
  LoggedExerciseActual,
  LoggedSetActual,
  SwimWorkoutActual,
} from '../../modules/workout-outcomes/types'
import {
  derivePaceSecondsPerMile,
  deriveSwimPaceSecondsPer100m,
  formatPace,
  formatSwimPace,
} from '../../modules/workout-outcomes/types'
import { isRunType } from '../../modules/workout-metadata/types'
import { makeWorkoutInstanceId } from '../../store/outcomeStore'

interface Props {
  planId: string
  calendarDate: string
  planDay: PlanDay
  existingOutcome?: WorkoutOutcome | null
  workoutInstanceId?: string
  onConfirm: (outcome: WorkoutOutcome) => void
  onClose: () => void
}

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

function getWeightsSlot(planDay: PlanDay): WorkoutSlot | null {
  return planDay.slots.find(s => s.type === 'weights' || s.type === 'weightlifting') ?? null
}

function getSwimSlot(planDay: PlanDay): WorkoutSlot | null {
  return planDay.slots.find(s => s.type === 'swim') ?? null
}

function parseNumericLoad(load?: string): number | null {
  if (!load) return null
  const match = load.match(/(\d+(\.\d+)?)/)
  return match ? Number(match[1]) : null
}

function parseRestToSeconds(rest?: string): number | null {
  if (!rest) return null
  const s = rest.trim().toLowerCase()
  if (s.endsWith('m')) return Number(s.replace('m', '')) * 60
  if (s.endsWith('s')) return Number(s.replace('s', ''))
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function buildInitialWeightActuals(planDay: PlanDay, existing?: WorkoutOutcome | null): LoggedExerciseActual[] {
  if (existing?.weightsActual?.exercises?.length) return existing.weightsActual.exercises
  const weightsSlot = getWeightsSlot(planDay)
  if (!weightsSlot?.exercises?.length) return []

  return weightsSlot.exercises.map(ex => {
    const sets: LoggedSetActual[] = []
    if (Array.isArray(ex.sets) && ex.sets.length > 0) {
      for (const s of ex.sets) {
        sets.push({
          targetReps: s.reps ?? ex.reps ?? null,
          targetLoad: s.load ?? ex.load ?? null,
          actualReps: typeof s.reps === 'number' ? s.reps : null,
          actualLoad: parseNumericLoad(s.load ?? ex.load),
          completed: false,
          restSeconds: parseRestToSeconds(s.rest ?? ex.rest),
        })
      }
    } else {
      const setCount = typeof ex.sets === 'number' ? ex.sets : 3
      for (let i = 0; i < setCount; i += 1) {
        sets.push({
          targetReps: ex.reps ?? null,
          targetLoad: ex.load ?? null,
          actualReps: typeof ex.reps === 'number' ? ex.reps : null,
          actualLoad: parseNumericLoad(ex.load),
          completed: false,
          restSeconds: parseRestToSeconds(ex.rest),
        })
      }
    }
    return { exercise: ex.exercise, progressionMode: 'single', sets }
  })
}

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function OutcomeModal({
  planId,
  calendarDate,
  planDay,
  existingOutcome,
  workoutInstanceId,
  onConfirm,
  onClose,
}: Props) {
  const runSlot = getRunSlot(planDay)
  const weightsSlot = getWeightsSlot(planDay)
  const swimSlot = getSwimSlot(planDay)

  const hasRun = runSlot != null
  const hasWeights = weightsSlot != null
  const hasSwim = swimSlot != null

  const existingState = existingOutcome?.completionState
  const [completionState, setCompletionState] = useState<WorkoutCompletionState>(
    existingState === 'completed' || existingState === 'partially_completed'
      ? existingState
      : 'completed',
  )
  const [effort, setEffort] = useState<PerceivedEffort | null>(existingOutcome?.perceivedEffort ?? null)
  const [durationMin, setDurationMin] = useState<string>(existingOutcome?.durationActualMin?.toString() ?? '')
  const [notes, setNotes] = useState<string>(existingOutcome?.notes ?? '')

  const [distanceMiles, setDistanceMiles] = useState<string>(existingOutcome?.runActual?.actualDistanceMiles?.toString() ?? '')
  const [runDurationMin, setRunDurationMin] = useState<string>(existingOutcome?.runActual?.actualDurationMin?.toString() ?? '')
  const [completedAsPlanned, setCompletedAsPlanned] = useState<boolean | null>(existingOutcome?.runActual?.completedAsPlanned ?? null)

  const [weightExercises, setWeightExercises] = useState<LoggedExerciseActual[]>(
    buildInitialWeightActuals(planDay, existingOutcome),
  )

  const [swimDistanceMeters, setSwimDistanceMeters] = useState<string>(
    existingOutcome?.swimActual?.actualDistanceMeters?.toString() ?? '',
  )
  const [swimDurationMin, setSwimDurationMin] = useState<string>(
    existingOutcome?.swimActual?.actualDurationMin?.toString() ?? '',
  )
  const [swimCompletedAsPlanned, setSwimCompletedAsPlanned] = useState<boolean | null>(
    existingOutcome?.swimActual?.completedAsPlanned ?? null,
  )

  const [restTimerSeconds, setRestTimerSeconds] = useState<number | null>(null)
  const [exerciseTimerSeconds, setExerciseTimerSeconds] = useState<number>(0)
  const [exerciseTimerRunning, setExerciseTimerRunning] = useState(false)

  useEffect(() => {
    if (restTimerSeconds == null || restTimerSeconds <= 0) return
    const id = window.setInterval(() => {
      setRestTimerSeconds(prev => {
        if (prev == null) return null
        if (prev <= 1) return null
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [restTimerSeconds])

  useEffect(() => {
    if (!exerciseTimerRunning) return
    const id = window.setInterval(() => setExerciseTimerSeconds(s => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [exerciseTimerRunning])

  const dist = parseFloat(distanceMiles)
  const dur = parseFloat(runDurationMin)
  const derivedPace = isFinite(dist) && dist > 0 && isFinite(dur) && dur > 0
    ? derivePaceSecondsPerMile(dist, dur)
    : null

  const swimDist = parseFloat(swimDistanceMeters)
  const swimDur = parseFloat(swimDurationMin)
  const derivedSwimPace = isFinite(swimDist) && swimDist > 0 && isFinite(swimDur) && swimDur > 0
    ? deriveSwimPaceSecondsPer100m(swimDist, swimDur)
    : null

  const completedWeightSets = useMemo(
    () => weightExercises.flatMap(ex => ex.sets).filter(s => s.completed).length,
    [weightExercises],
  )

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<LoggedSetActual>) {
    setWeightExercises(prev => prev.map((ex, ei) => {
      if (ei !== exerciseIndex) return ex
      return {
        ...ex,
        sets: ex.sets.map((set, si) => si === setIndex ? { ...set, ...patch } : set),
      }
    }))
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

    const swimActual: SwimWorkoutActual | null = hasSwim
      ? {
          actualDistanceMeters: isFinite(swimDist) && swimDist > 0 ? swimDist : null,
          actualDurationMin: isFinite(swimDur) && swimDur > 0 ? swimDur : null,
          averagePaceSecondsPer100m: derivedSwimPace,
          completedAsPlanned: swimCompletedAsPlanned,
        }
      : null

    const parsedDuration = parseFloat(durationMin)
    const outcome: WorkoutOutcome = {
      workoutInstanceId: workoutInstanceId ?? makeWorkoutInstanceId(planId, calendarDate),
      completionState,
      completedAt: new Date().toISOString(),
      durationActualMin: isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : null,
      perceivedEffort: effort,
      notes: notes.trim() || null,
      runActual,
      swimActual,
      weightsActual: hasWeights ? { exercises: weightExercises } : null,
    }

    onConfirm(outcome)
  }

  const stateLabel = completionState === 'partially_completed' ? 'Log Partial' : 'Mark Complete'

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
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Status</p>
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

        <div className="border border-slate-700 rounded-xl p-3 space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Timers</p>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <button
              onClick={() => setExerciseTimerRunning(v => !v)}
              className="px-2 py-1 rounded-md border border-slate-600 bg-slate-700/80 flex items-center gap-1"
            >
              {exerciseTimerRunning ? <Pause size={12} /> : <Play size={12} />} Exercise timer
            </button>
            <button
              onClick={() => { setExerciseTimerSeconds(0); setExerciseTimerRunning(false) }}
              className="px-2 py-1 rounded-md border border-slate-600 bg-slate-700/80"
            >
              Reset
            </button>
            <span className="ml-auto font-semibold text-sky-300">{formatClock(exerciseTimerSeconds)}</span>
          </div>
          {restTimerSeconds != null && (
            <p className="text-xs text-emerald-300">Rest timer: {formatClock(restTimerSeconds)}</p>
          )}
        </div>

        {hasWeights && (
          <div className="space-y-3 border border-slate-700 rounded-xl p-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium flex items-center gap-1">
              <Dumbbell size={11} /> Weights Set Tracking
            </p>
            <p className="text-xs text-slate-400">Completed sets: {completedWeightSets}</p>

            {weightExercises.map((exercise, exIndex) => (
              <div key={exercise.exercise + exIndex} className="space-y-2 bg-slate-800/40 rounded-lg p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-slate-200 font-medium">{exercise.exercise}</p>
                  <select
                    value={exercise.progressionMode ?? 'single'}
                    onChange={e => setWeightExercises(prev => prev.map((it, i) => i === exIndex ? {
                      ...it,
                      progressionMode: e.target.value as LoggedExerciseActual['progressionMode'],
                    } : it))}
                    className="bg-slate-700 border border-slate-600 rounded px-1.5 py-1 text-[11px] text-slate-200"
                  >
                    <option value="single">Single prog</option>
                    <option value="double">Double prog</option>
                    <option value="volume">Volume</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>

                {exercise.sets.map((set, setIndex) => (
                  <div key={setIndex} className="grid grid-cols-12 gap-1.5 items-center text-xs">
                    <span className="col-span-2 text-slate-400">Set {setIndex + 1}</span>
                    <input
                      type="number"
                      min="0"
                      value={set.actualReps ?? ''}
                      onChange={e => updateSet(exIndex, setIndex, {
                        actualReps: e.target.value ? Number(e.target.value) : null,
                      })}
                      placeholder={String(set.targetReps ?? 'reps')}
                      className="col-span-3 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-100"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={set.actualLoad ?? ''}
                      onChange={e => updateSet(exIndex, setIndex, {
                        actualLoad: e.target.value ? Number(e.target.value) : null,
                      })}
                      placeholder={set.targetLoad ?? 'load'}
                      className="col-span-3 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-100"
                    />
                    <button
                      onClick={() => updateSet(exIndex, setIndex, { completed: !set.completed })}
                      className={`col-span-2 px-1.5 py-1 rounded border ${set.completed ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setRestTimerSeconds(set.restSeconds ?? 90)}
                      className="col-span-2 px-1.5 py-1 rounded border border-slate-600 bg-slate-700 text-slate-300"
                    >
                      Rest
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Perceived Effort</p>
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
          {effort && <p className="text-xs text-slate-500 mt-1 text-center">{EFFORT_LABELS[effort]}</p>}
        </div>

        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wide font-medium block mb-2">
            <Clock3 size={11} className="inline mr-1" />Duration (min)
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

        {hasRun && (
          <div className="space-y-3 border border-slate-700 rounded-xl p-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Run Actuals</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="flex items-center gap-1 text-xs text-slate-400"><Ruler size={11} /> Distance (mi)</span>
                <input type="number" min="0" step="0.01" value={distanceMiles} onChange={e => setDistanceMiles(e.target.value)} placeholder="0.0" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 text-sm text-white" />
              </label>
              <label className="space-y-1">
                <span className="flex items-center gap-1 text-xs text-slate-400"><Timer size={11} /> Time (min)</span>
                <input type="number" min="0" step="1" value={runDurationMin} onChange={e => setRunDurationMin(e.target.value)} placeholder="0" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 text-sm text-white" />
              </label>
            </div>
            {derivedPace != null && <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-700/50 rounded-lg px-3 py-2"><Zap size={11} className="text-sky-400" /><span>Avg pace: <strong className="text-sky-300">{formatPace(derivedPace)}</strong></span></div>}
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Completed as planned?</p>
              <div className="flex gap-2">
                {([true, false] as const).map(val => (
                  <button key={String(val)} onClick={() => setCompletedAsPlanned(prev => prev === val ? null : val)} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${completedAsPlanned === val ? (val ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-red-500/20 border-red-500/50 text-red-400') : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'}`}>{val ? 'Yes' : 'No'}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {hasSwim && (
          <div className="space-y-3 border border-slate-700 rounded-xl p-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium flex items-center gap-1"><Waves size={11} /> Swim Actuals</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" step="25" value={swimDistanceMeters} onChange={e => setSwimDistanceMeters(e.target.value)} placeholder="Distance (m)" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 text-sm text-white" />
              <input type="number" min="0" step="1" value={swimDurationMin} onChange={e => setSwimDurationMin(e.target.value)} placeholder="Time (min)" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 text-sm text-white" />
            </div>
            {derivedSwimPace != null && <p className="text-xs text-sky-300">Avg pace: {formatSwimPace(derivedSwimPace)}</p>}
            <div className="flex gap-2">
              {([true, false] as const).map(val => (
                <button key={`swim-${String(val)}`} onClick={() => setSwimCompletedAsPlanned(prev => prev === val ? null : val)} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${swimCompletedAsPlanned === val ? (val ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-red-500/20 border-red-500/50 text-red-400') : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'}`}>{val ? 'As Planned' : 'Adjusted'}</button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wide font-medium block mb-2">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="How did it feel? Any notes..." rows={3} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none" />
        </div>
      </div>
    </Modal>
  )
}
