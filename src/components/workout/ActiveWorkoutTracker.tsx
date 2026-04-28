import { useState, useEffect, useRef } from 'react'
import { X, Pause, Play, RotateCcw, ChevronDown, ChevronUp, Check } from 'lucide-react'
import type { WorkoutSlot, PlanDay } from '../../types'
import type { LoggedExerciseActual, LoggedSetActual, WorkoutOutcome } from '../../modules/workout-outcomes/types'
import { resolveLoad, type EvalContext } from '../../lib/expressionEval'

interface SetTrackState {
  setElapsedSeconds: number
  completed: boolean
  actualReps: number | null
  actualLoad: number | null
  targetReps: number | string | null
  targetLoad: string | null
  restSeconds: number | null
  resolvedLoadLbs: number | null
}

interface ExerciseTrackState {
  exercise: string
  progressionMode: 'single' | 'double' | 'volume' | 'maintenance'
  sets: SetTrackState[]
  previousSets?: LoggedSetActual[]
}

export interface WorkoutSessionMeta {
  startTime: string
  endTime: string
  pausePeriods: { start: string; end: string }[]
  totalElapsedSeconds: number
}

interface Props {
  planId: string
  planDay: PlanDay
  slot: WorkoutSlot
  programVars: Record<string, number>
  previousOutcome: WorkoutOutcome | null
  previousSetsByExercise?: Record<string, LoggedSetActual[]>
  onClose: () => void
  onComplete: (exercises: LoggedExerciseActual[], meta: WorkoutSessionMeta) => void
}

function fmt(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

function parseRestSecs(rest?: string | null): number | null {
  if (!rest) return null
  const s = rest.trim().toLowerCase()
  if (s.endsWith('m')) return Math.round(Number(s.slice(0, -1)) * 60)
  if (s.endsWith('s')) return Number(s.slice(0, -1))
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseNumericLoad(load?: string | null): number | null {
  if (!load) return null
  const m = load.match(/(\d+(\.\d+)?)/)
  return m ? Number(m[1]) : null
}

interface TimerColProps {
  label: string
  value: string
  running: boolean
  disabled?: boolean
  colorClass: string
  expanded: boolean
  onToggle: (e: React.MouseEvent) => void
  onReset: (e: React.MouseEvent) => void
  onAdjust: (delta: number, e: React.MouseEvent) => void
}

function TimerCol({
  label, value, running, disabled, colorClass, expanded,
  onToggle, onReset, onAdjust,
}: TimerColProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-2">
      <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
      <p className={`text-lg font-mono font-bold leading-none ${colorClass}`}>{value}</p>
      <div className="flex gap-1">
        <button
          onClick={onToggle}
          disabled={disabled}
          className="w-7 h-6 flex items-center justify-center rounded border border-slate-600 bg-slate-700 text-slate-300 disabled:opacity-30 transition-colors hover:bg-slate-600"
        >
          {running ? <Pause size={10} /> : <Play size={10} />}
        </button>
        <button
          onClick={onReset}
          className="w-7 h-6 flex items-center justify-center rounded border border-slate-600 bg-slate-700 text-slate-300 transition-colors hover:bg-slate-600"
        >
          <RotateCcw size={10} />
        </button>
      </div>
      {expanded && (
        <div className="flex gap-1">
          <button
            onClick={e => onAdjust(15, e)}
            className="px-2 py-0.5 rounded border border-slate-600 bg-slate-700 text-slate-300 text-[10px] hover:bg-slate-600 transition-colors"
          >
            +15
          </button>
          <button
            onClick={e => onAdjust(-15, e)}
            className="px-2 py-0.5 rounded border border-slate-600 bg-slate-700 text-slate-300 text-[10px] hover:bg-slate-600 transition-colors"
          >
            −15
          </button>
        </div>
      )}
    </div>
  )
}

export function ActiveWorkoutTracker({
  planId: _planId,
  planDay,
  slot,
  programVars,
  previousOutcome,
  previousSetsByExercise,
  onClose,
  onComplete,
}: Props) {
  const workoutStartRef = useRef(new Date().toISOString())
  const pausePeriodsRef = useRef<{ start: string; end?: string }[]>([])
  const pausedSetRef = useRef<{ exIdx: number; setIdx: number } | null>(null)

  const workoutRunRef = useRef(true)
  const activeSetRef = useRef<{ exIdx: number; setIdx: number } | null>(null)
  const restRunRef = useRef(false)
  const restRemRef = useRef<number | null>(null)

  const [workoutElapsed, setWorkoutElapsed] = useState(0)
  const [workoutRunning, setWorkoutRunning] = useState(true)
  const [activeSetTimer, setActiveSetTimer] = useState<{ exIdx: number; setIdx: number } | null>(null)
  const [restRemaining, setRestRemaining] = useState<number | null>(null)
  const [restRunning, setRestRunning] = useState(false)
  const [timersExpanded, setTimersExpanded] = useState(false)

  const hasVars = Object.keys(programVars).length > 0
  const evalCtx: EvalContext = { vars: programVars }

  const [exercises, setExercises] = useState<ExerciseTrackState[]>(() => {
    const allExercises = [
      ...(slot.warmup ?? []),
      ...(slot.exercises ?? []),
    ]
    if (!allExercises.length) return []

    return allExercises.map(ex => {
      const prevEx = previousSetsByExercise?.[ex.exercise]
        ?? previousOutcome?.weightsActual?.exercises?.find(e => e.exercise === ex.exercise)?.sets

      function buildSet(load?: string | null, reps?: number | string | null, rest?: string | null): SetTrackState {
        const resolvedLoadLbs = hasVars
          ? (resolveLoad(load ?? undefined, evalCtx) ?? parseNumericLoad(load))
          : parseNumericLoad(load)
        const validLoad = resolvedLoadLbs != null && resolvedLoadLbs > 0 ? resolvedLoadLbs : null
        return {
          setElapsedSeconds: 0,
          completed: false,
          actualReps: typeof reps === 'number' ? reps : null,
          actualLoad: validLoad,
          targetReps: reps ?? null,
          targetLoad: load ?? null,
          restSeconds: parseRestSecs(rest),
          resolvedLoadLbs: validLoad,
        }
      }

      let sets: SetTrackState[]
      if (Array.isArray(ex.sets) && ex.sets.length > 0) {
        sets = ex.sets.map(s => buildSet(s.load ?? ex.load, s.reps ?? ex.reps, s.rest ?? ex.rest))
      } else {
        const n = typeof ex.sets === 'number' ? ex.sets : 3
        sets = Array.from({ length: n }, () => buildSet(ex.load, ex.reps, ex.rest))
      }

      return {
        exercise: ex.exercise,
        progressionMode: 'single' as const,
        sets,
        previousSets: prevEx,
      }
    })
  })

  useEffect(() => {
    const id = setInterval(() => {
      if (workoutRunRef.current) setWorkoutElapsed(s => s + 1)

      const activeSet = activeSetRef.current
      if (workoutRunRef.current && !restRunRef.current && activeSet) {
        setExercises(prev => prev.map((ex, ei) => (
          ei !== activeSet.exIdx ? ex : {
            ...ex,
            sets: ex.sets.map((set, si) => (
              si !== activeSet.setIdx ? set : { ...set, setElapsedSeconds: set.setElapsedSeconds + 1 }
            )),
          }
        )))
      }

      if (restRunRef.current) {
        const cur = restRemRef.current
        if (cur == null || cur <= 1) {
          restRunRef.current = false
          restRemRef.current = null
          setRestRemaining(null)
          setRestRunning(false)
        } else {
          restRemRef.current = cur - 1
          setRestRemaining(cur - 1)
        }
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  function startRest(seconds: number) {
    restRemRef.current = seconds
    setRestRemaining(seconds)
    restRunRef.current = true
    setRestRunning(true)
    activeSetRef.current = null
    setActiveSetTimer(null)
  }

  function toggleWorkout(e?: React.MouseEvent) {
    e?.stopPropagation()
    if (workoutRunning) {
      pausePeriodsRef.current.push({ start: new Date().toISOString() })
      workoutRunRef.current = false
      setWorkoutRunning(false)
      pausedSetRef.current = activeSetRef.current
      activeSetRef.current = null
      setActiveSetTimer(null)
      restRunRef.current = false
      setRestRunning(false)
      return
    }

    const periods = pausePeriodsRef.current
    const last = periods[periods.length - 1]
    if (last && !last.end) last.end = new Date().toISOString()
    workoutRunRef.current = true
    setWorkoutRunning(true)

    if (restRemRef.current != null) {
      restRunRef.current = true
      setRestRunning(true)
      return
    }

    if (pausedSetRef.current) {
      activeSetRef.current = pausedSetRef.current
      setActiveSetTimer(pausedSetRef.current)
      pausedSetRef.current = null
    }
  }

  function toggleRest(e: React.MouseEvent) {
    e.stopPropagation()
    if (restRemRef.current == null) return
    if (restRunning) {
      restRunRef.current = false
      setRestRunning(false)
      return
    }
    restRunRef.current = true
    setRestRunning(true)
  }

  function resetRest(e: React.MouseEvent) {
    e.stopPropagation()
    restRemRef.current = null
    setRestRemaining(null)
    restRunRef.current = false
    setRestRunning(false)
  }

  function adjust(timer: 'workout' | 'rest', delta: number, e: React.MouseEvent) {
    e.stopPropagation()
    if (timer === 'workout') {
      setWorkoutElapsed(s => Math.max(0, s + delta))
      return
    }

    const cur = restRemRef.current ?? 0
    const next = Math.max(0, cur + delta)
    restRemRef.current = next
    setRestRemaining(next || null)
    if (next > 0 && !restRunning && workoutRunning) {
      restRunRef.current = true
      setRestRunning(true)
      pausedSetRef.current = activeSetRef.current
      activeSetRef.current = null
      setActiveSetTimer(null)
    }
  }

  function handleSetTimerToggle(exIdx: number, setIdx: number) {
    if (!workoutRunning || restRunning || !isActiveSet(exIdx, setIdx)) return
    const set = exercises[exIdx]?.sets[setIdx]
    if (!set || set.completed) return

    const current = activeSetRef.current
    if (current && current.exIdx === exIdx && current.setIdx === setIdx) {
      activeSetRef.current = null
      setActiveSetTimer(null)
      return
    }

    activeSetRef.current = { exIdx, setIdx }
    setActiveSetTimer({ exIdx, setIdx })
  }

  function handleSetComplete(exIdx: number, setIdx: number) {
    const setToToggle = exercises[exIdx].sets[setIdx]
    const completing = !setToToggle.completed

    setExercises(prev => prev.map((ex, ei) => (
      ei !== exIdx ? ex : {
        ...ex,
        sets: ex.sets.map((s, si) => (
          si !== setIdx ? s : {
            ...s,
            completed: completing,
            setElapsedSeconds: completing ? s.setElapsedSeconds : 0,
          }
        )),
      }
    )))

    if (activeSetRef.current?.exIdx === exIdx && activeSetRef.current?.setIdx === setIdx) {
      activeSetRef.current = null
      setActiveSetTimer(null)
    }

    if (completing) {
      startRest(setToToggle.restSeconds ?? 90)
    }
  }

  function updateSet(exIdx: number, setIdx: number, patch: Partial<SetTrackState>) {
    setExercises(prev => prev.map((ex, ei) => (
      ei !== exIdx ? ex : {
        ...ex,
        sets: ex.sets.map((s, si) => si !== setIdx ? s : { ...s, ...patch }),
      }
    )))
  }

  function setTimerDisplay(exIdx: number, setIdx: number): string {
    const s = exercises[exIdx].sets[setIdx]
    return fmt(s.setElapsedSeconds)
  }

  function isActiveSet(exIdx: number, setIdx: number): boolean {
    return exercises[exIdx].sets.slice(0, setIdx).every(p => p.completed)
      && !exercises[exIdx].sets[setIdx].completed
  }

  const activeSetValue = activeSetTimer
    ? fmt(exercises[activeSetTimer.exIdx]?.sets[activeSetTimer.setIdx]?.setElapsedSeconds ?? 0)
    : '—'

  function previousSetDisplay(ex: ExerciseTrackState, setIdx: number): string {
    const previous = ex.previousSets?.[setIdx]
    if (!previous || previous.actualReps == null || previous.actualLoad == null) return '-'
    return `${previous.actualReps} x ${previous.actualLoad}lb`
  }

  function handleDone() {
    const endTime = new Date().toISOString()
    const periods = pausePeriodsRef.current
    const last = periods[periods.length - 1]
    if (last && !last.end) last.end = endTime

    const result: LoggedExerciseActual[] = exercises.map(ex => ({
      exercise: ex.exercise,
      progressionMode: ex.progressionMode,
      sets: ex.sets.map(s => ({
        targetReps: s.targetReps,
        targetLoad: s.targetLoad,
        actualReps: s.actualReps,
        actualLoad: s.actualLoad,
        completed: s.completed,
        restSeconds: s.restSeconds,
      })),
    }))

    onComplete(result, {
      startTime: workoutStartRef.current,
      endTime,
      pausePeriods: pausePeriodsRef.current.filter(p => p.end) as { start: string; end: string }[],
      totalElapsedSeconds: workoutElapsed,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white truncate">{planDay.label}</h1>
          <p className="text-xs text-slate-500 truncate">{slot.name}</p>
        </div>
        <button
          onClick={() => toggleWorkout()}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
            workoutRunning
              ? 'border-sky-500/50 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20'
              : 'border-orange-500/50 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20'
          }`}
        >
          {workoutRunning ? <Pause size={12} /> : <Play size={12} />}
          <span className="font-mono">{fmt(workoutElapsed)}</span>
        </button>
      </div>

      <div
        className="flex-shrink-0 mx-4 mt-3 border border-slate-700 rounded-xl bg-slate-800/60 cursor-pointer select-none"
        onClick={() => setTimersExpanded(v => !v)}
      >
        <div className="px-3 pt-2.5">
          <div className="flex items-center justify-between rounded-lg border border-slate-700/70 bg-slate-900/40 px-2.5 py-1.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Active Set</p>
            <p className="text-sm font-mono font-bold text-amber-200">{activeSetValue}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-700/60 py-2.5">
          <TimerCol
            label="Workout"
            value={fmt(workoutElapsed)}
            running={workoutRunning}
            colorClass="text-sky-300"
            expanded={timersExpanded}
            onToggle={e => { e.stopPropagation(); toggleWorkout(e) }}
            onReset={e => { e.stopPropagation(); setWorkoutElapsed(0) }}
            onAdjust={(d, e) => adjust('workout', d, e)}
          />
          <TimerCol
            label="Rest"
            value={restRemaining != null ? fmt(restRemaining) : '—'}
            running={restRunning}
            disabled={restRemaining == null}
            colorClass={restRemaining != null ? 'text-emerald-300' : 'text-slate-600'}
            expanded={timersExpanded}
            onToggle={toggleRest}
            onReset={resetRest}
            onAdjust={(d, e) => adjust('rest', d, e)}
          />
        </div>
        <div className="pb-1 flex justify-center text-slate-600">
          {timersExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-28 space-y-3">
        {exercises.length === 0 ? (
          <div className="text-center py-10 space-y-1">
            <p className="text-sm text-slate-400">Timer is running.</p>
            <p className="text-xs text-slate-600">No tracked exercises for this workout type.</p>
            <p className="text-xs text-slate-600 mt-2">Tap "Done — Log Workout" when finished.</p>
          </div>
        ) : (
          exercises.map((ex, exIdx) => (
            <div key={ex.exercise + exIdx} className="bg-slate-800/60 rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white leading-tight">{ex.exercise}</p>
                </div>
                <select
                  value={ex.progressionMode}
                  onChange={e => setExercises(prev => prev.map((it, i) => (
                    i !== exIdx ? it : {
                      ...it,
                      progressionMode: e.target.value as ExerciseTrackState['progressionMode'],
                    }
                  )))}
                  className="flex-shrink-0 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-[10px] text-slate-300"
                >
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                  <option value="volume">Volume</option>
                  <option value="maintenance">Maint.</option>
                </select>
              </div>

              <div className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-1 text-[9px] text-slate-600 uppercase tracking-wide px-0.5">
                <span className="col-span-1 text-center">#</span>
                <span className="col-span-3 text-center">Prev</span>
                <span className="col-span-3 text-center">Reps</span>
                <span className="col-span-3 text-center">Lbs</span>
                <span className="col-span-2 text-center">Time</span>
                <span className="col-span-1 text-center">✓</span>
              </div>

              {ex.sets.map((s, setIdx) => {
                const active = isActiveSet(exIdx, setIdx)
                const timerRunning = activeSetTimer?.exIdx === exIdx && activeSetTimer?.setIdx === setIdx
                return (
                  <div
                    key={setIdx}
                    className={`grid grid-cols-[repeat(13,minmax(0,1fr))] gap-1 items-center transition-opacity ${s.completed ? 'opacity-60' : ''}`}
                  >
                    <span className="col-span-1 text-center text-slate-400 text-xs font-medium">
                      {setIdx + 1}
                    </span>
                    <span className="col-span-3 text-center text-slate-500 text-[10px]">
                      {previousSetDisplay(ex, setIdx)}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={s.actualReps ?? ''}
                      onChange={e => updateSet(exIdx, setIdx, {
                        actualReps: e.target.value ? Number(e.target.value) : null,
                      })}
                      placeholder={String(s.targetReps ?? 'reps')}
                      className="col-span-3 bg-slate-700 border border-slate-600 rounded px-1.5 py-1 text-xs text-slate-100 text-center"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={s.actualLoad ?? ''}
                      onChange={e => updateSet(exIdx, setIdx, {
                        actualLoad: e.target.value ? Number(e.target.value) : null,
                      })}
                      placeholder={
                        s.resolvedLoadLbs != null && s.resolvedLoadLbs > 0
                          ? String(s.resolvedLoadLbs)
                          : (s.targetLoad ?? 'lbs')
                      }
                      className="col-span-3 bg-slate-700 border border-slate-600 rounded px-1.5 py-1 text-xs text-slate-100 text-center"
                    />
                    <button
                      onClick={() => handleSetTimerToggle(exIdx, setIdx)}
                      disabled={!active || s.completed || !workoutRunning || restRunning}
                      className={`col-span-2 h-7 flex items-center justify-center gap-1 rounded border font-mono text-[10px] transition-colors ${
                        timerRunning
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                          : 'bg-slate-700 border-slate-600 text-slate-300'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {timerRunning ? <Pause size={10} /> : <Play size={10} />}
                      <span>{setTimerDisplay(exIdx, setIdx)}</span>
                    </button>
                    <button
                      onClick={() => handleSetComplete(exIdx, setIdx)}
                      className={`col-span-1 h-7 flex items-center justify-center rounded border transition-colors ${
                        s.completed
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Check size={11} />
                    </button>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      <div className="flex-shrink-0 px-4 pt-3 pb-6 border-t border-slate-800 bg-slate-900">
        <button
          onClick={handleDone}
          className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold text-sm transition-colors active:scale-[0.98]"
        >
          Done — Log Workout
        </button>
      </div>
    </div>
  )
}
