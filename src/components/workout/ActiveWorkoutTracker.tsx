import { useState, useEffect, useRef } from 'react'
import { X, Pause, Play, RotateCcw, ChevronDown, ChevronUp, Check, Trash2 } from 'lucide-react'
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
  actualRestSeconds: number | null
  resolvedLoadLbs: number | null
}

interface ExerciseTrackState {
  exercise: string
  isWarmup: boolean
  sets: SetTrackState[]
  previousSets?: LoggedSetActual[]
}

function resolveActualReps(actualReps: number | null, targetReps: number | string | null): number | null {
  if (typeof actualReps === 'number') return actualReps
  if (typeof targetReps === 'number') return targetReps
  if (typeof targetReps !== 'string') return null

  const range = targetReps.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/)
  if (range) {
    const low = Number(range[1])
    const high = Number(range[2])
    return Number.isFinite(high) ? Math.max(low, high) : null
  }

  const single = Number(targetReps.trim())
  return Number.isFinite(single) ? single : null
}

export interface WorkoutSessionMeta {
  startTime: string
  endTime: string
  pausePeriods: { start: string; end: string }[]
  totalElapsedSeconds: number
}

interface Props {
  planId: string
  workoutInstanceId: string
  planDay: PlanDay
  slot: WorkoutSlot
  programVars: Record<string, number>
  previousOutcome: WorkoutOutcome | null
  resumeOutcome?: WorkoutOutcome | null
  previousSetsByExercise?: Record<string, LoggedSetActual[]>
  minimized: boolean
  onMinimize: () => void
  onResume: () => void
  onCancel: () => void
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
  targetValue?: string
  running: boolean
  disabled?: boolean
  colorClass: string
  expanded: boolean
  onToggle: (e: React.MouseEvent) => void
  onReset: (e: React.MouseEvent) => void
  onAdjust: (delta: number, e: React.MouseEvent) => void
}

function TimerCol({
  label, value, targetValue, running, disabled, colorClass, expanded,
  onToggle, onReset, onAdjust,
}: TimerColProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-2">
      <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
      {targetValue && (
        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-medium leading-none">Target {targetValue}</p>
      )}
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
  workoutInstanceId,
  planDay,
  slot,
  programVars,
  previousOutcome,
  resumeOutcome,
  previousSetsByExercise,
  minimized,
  onMinimize,
  onResume,
  onCancel,
  onComplete,
}: Props) {
  const draftStorageKey = `wpt_active_draft_${workoutInstanceId}`
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const workoutStartRef = useRef(new Date().toISOString())
  const pausePeriodsRef = useRef<{ start: string; end?: string }[]>([])
  const pausedSetRef = useRef<{ exIdx: number; setIdx: number } | null>(null)

  const workoutRunRef = useRef(true)
  const activeSetRef = useRef<{ exIdx: number; setIdx: number } | null>(null)
  const restRunRef = useRef(false)
  const restElapsedRef = useRef<number | null>(null)
  const restTargetRef = useRef<number | null>(null)
  const restAlertedRef = useRef(false)
  const restOwnerRef = useRef<{ exIdx: number; setIdx: number } | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const [workoutElapsed, setWorkoutElapsed] = useState(0)
  const [workoutRunning, setWorkoutRunning] = useState(true)
  const [activeSetTimer, setActiveSetTimer] = useState<{ exIdx: number; setIdx: number } | null>(null)
  const [restElapsed, setRestElapsed] = useState<number | null>(null)
  const [restTarget, setRestTarget] = useState<number | null>(null)
  const [restRunning, setRestRunning] = useState(false)
  const [timersExpanded, setTimersExpanded] = useState(false)

  const hasVars = Object.keys(programVars).length > 0
  const evalCtx: EvalContext = { vars: programVars }

  const [exercises, setExercises] = useState<ExerciseTrackState[]>(() => {
    const allExercises = [
      ...(slot.warmup ?? []).map(ex => ({ ...ex, __isWarmup: true as const })),
      ...(slot.exercises ?? []).map(ex => ({ ...ex, __isWarmup: false as const })),
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
          actualRestSeconds: null,
          resolvedLoadLbs: validLoad,
        }
      }

      let sets: SetTrackState[]
      if (Array.isArray(ex.sets) && ex.sets.length > 0) {
        sets = ex.sets.map((s, i) => {
          const base = buildSet(s.load ?? ex.load, s.reps ?? ex.reps, s.rest ?? ex.rest)
          const prev = prevEx?.[i]
          return {
            ...base,
            actualReps: prev?.actualReps ?? base.actualReps,
            actualLoad: prev?.actualLoad ?? base.actualLoad,
          }
        })
      } else {
        const n = typeof ex.sets === 'number' ? ex.sets : 3
        sets = Array.from({ length: n }, (_, i) => {
          const base = buildSet(ex.load, ex.reps, ex.rest)
          const prev = prevEx?.[i]
          return {
            ...base,
            actualReps: prev?.actualReps ?? base.actualReps,
            actualLoad: prev?.actualLoad ?? base.actualLoad,
          }
        })
      }

      return {
        exercise: ex.exercise,
        isWarmup: ex.__isWarmup,
        sets,
        previousSets: prevEx,
      }
    })
  })

  useEffect(() => {
    const raw = window.localStorage.getItem(draftStorageKey)
    if (!raw) {
      if (resumeOutcome?.weightsActual?.exercises?.length) {
        setExercises(prev => prev.map(ex => {
          const fromOutcome = resumeOutcome.weightsActual?.exercises?.find(e => e.exercise === ex.exercise)
          if (!fromOutcome) return ex
          return {
            ...ex,
            sets: ex.sets.map((set, i) => ({
              ...set,
              actualReps: fromOutcome.sets[i]?.actualReps ?? set.actualReps,
              actualLoad: fromOutcome.sets[i]?.actualLoad ?? set.actualLoad,
              completed: fromOutcome.sets[i]?.completed ?? set.completed,
              actualRestSeconds: fromOutcome.sets[i]?.actualRestSeconds ?? set.actualRestSeconds,
            })),
          }
        }))
      }
      if (resumeOutcome?.durationActualMin && resumeOutcome.durationActualMin > 0) {
        const secs = Math.round(resumeOutcome.durationActualMin * 60)
        setWorkoutElapsed(secs)
      }
      return
    }
    try {
      const draft = JSON.parse(raw) as {
        workoutStart?: string
        pausePeriods?: { start: string; end?: string }[]
        workoutElapsed?: number
        workoutRunning?: boolean
        restRemaining?: number | null
        restElapsed?: number | null
        restTarget?: number | null
        restRunning?: boolean
        restAlerted?: boolean
        restOwner?: { exIdx: number; setIdx: number } | null
        activeSetTimer?: { exIdx: number; setIdx: number } | null
        exercises?: ExerciseTrackState[]
      }
      if (draft.workoutStart) workoutStartRef.current = draft.workoutStart
      if (draft.pausePeriods) pausePeriodsRef.current = draft.pausePeriods
      if (typeof draft.workoutElapsed === 'number') setWorkoutElapsed(draft.workoutElapsed)
      if (typeof draft.workoutRunning === 'boolean') {
        setWorkoutRunning(draft.workoutRunning)
        workoutRunRef.current = draft.workoutRunning
      }
      if (typeof draft.restRunning === 'boolean') {
        setRestRunning(draft.restRunning)
        restRunRef.current = draft.restRunning
      }
      const restoredRestTarget = draft.restTarget ?? (
        draft.restRemaining != null ? draft.restRemaining : null
      )
      const restoredRestElapsed = draft.restElapsed ?? (
        draft.restRemaining != null && restoredRestTarget != null
          ? Math.max(0, restoredRestTarget - draft.restRemaining)
          : null
      )
      if (restoredRestElapsed != null) {
        setRestElapsed(restoredRestElapsed)
        restElapsedRef.current = restoredRestElapsed
      }
      if (restoredRestTarget != null) {
        setRestTarget(restoredRestTarget)
        restTargetRef.current = restoredRestTarget
      }
      if (draft.restAlerted != null) restAlertedRef.current = draft.restAlerted
      if (draft.restOwner) restOwnerRef.current = draft.restOwner
      if (draft.activeSetTimer) {
        setActiveSetTimer(draft.activeSetTimer)
        activeSetRef.current = draft.activeSetTimer
      }
      if (draft.exercises?.length) setExercises(draft.exercises)
    } catch {
      window.localStorage.removeItem(draftStorageKey)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStorageKey])

  useEffect(() => {
    const draft = {
      workoutStart: workoutStartRef.current,
      pausePeriods: pausePeriodsRef.current,
      workoutElapsed,
      workoutRunning,
      restElapsed,
      restTarget,
      restRunning,
      restAlerted: restAlertedRef.current,
      restOwner: restOwnerRef.current,
      activeSetTimer,
      exercises,
    }
    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft))
  }, [draftStorageKey, workoutElapsed, workoutRunning, restElapsed, restTarget, restRunning, activeSetTimer, exercises])

  function getAudioContext(): AudioContext | null {
    const AudioContextCtor = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return null
    if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor()
    if (audioContextRef.current.state === 'suspended') void audioContextRef.current.resume()
    return audioContextRef.current
  }

  function scheduleTone(
    ctx: AudioContext,
    frequency: number,
    startAt: number,
    duration: number,
    peakGain: number,
    type: OscillatorType = 'sine',
  ) {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, startAt)
    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(startAt)
    oscillator.stop(startAt + duration + 0.03)
  }

  function playRestTargetAlert() {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime + 0.02

    scheduleTone(ctx, 920, now, 0.2, 0.22, 'square')
    scheduleTone(ctx, 1380, now, 0.05, 0.08, 'triangle')

    const chimeStart = now + 0.24
    scheduleTone(ctx, 1046.5, chimeStart, 0.28, 0.16)
    scheduleTone(ctx, 1568, chimeStart + 0.16, 0.38, 0.14)
  }

  function markRestAlerted() {
    if (restAlertedRef.current) return
    restAlertedRef.current = true
    playRestTargetAlert()
  }

  function maybeAlertForRest(elapsedSeconds: number) {
    const targetSeconds = restTargetRef.current
    if (targetSeconds != null && elapsedSeconds >= targetSeconds) markRestAlerted()
  }

  function recordRestElapsed() {
    const owner = restOwnerRef.current
    const elapsed = restElapsedRef.current
    if (!owner || elapsed == null) return
    setExercises(prev => prev.map((ex, ei) => (
      ei !== owner.exIdx ? ex : {
        ...ex,
        sets: ex.sets.map((set, si) => (
          si !== owner.setIdx ? set : { ...set, actualRestSeconds: elapsed }
        )),
      }
    )))
  }

  function stopRest(recordElapsed = true) {
    if (recordElapsed) recordRestElapsed()
    restRunRef.current = false
    setRestRunning(false)
    restElapsedRef.current = null
    restTargetRef.current = null
    restAlertedRef.current = false
    restOwnerRef.current = null
    setRestElapsed(null)
    setRestTarget(null)
  }

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

      if (workoutRunRef.current && restRunRef.current) {
        const cur = restElapsedRef.current
        if (cur != null) {
          const next = cur + 1
          restElapsedRef.current = next
          setRestElapsed(next)
          maybeAlertForRest(next)
        }
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  function startRest(seconds: number, owner: { exIdx: number; setIdx: number }) {
    stopRest()
    void getAudioContext()
    restElapsedRef.current = 0
    restTargetRef.current = seconds
    restAlertedRef.current = seconds <= 0
    restOwnerRef.current = owner
    setRestElapsed(0)
    setRestTarget(seconds)
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

    if (restElapsedRef.current != null) {
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
    if (restElapsedRef.current == null) return
    if (restRunning) {
      restRunRef.current = false
      setRestRunning(false)
      recordRestElapsed()
      return
    }
    void getAudioContext()
    restRunRef.current = true
    setRestRunning(true)
  }

  function resetRest(e: React.MouseEvent) {
    e.stopPropagation()
    stopRest()
  }

  function adjust(timer: 'workout' | 'rest', delta: number, e: React.MouseEvent) {
    e.stopPropagation()
    if (timer === 'workout') {
      setWorkoutElapsed(s => Math.max(0, s + delta))
      return
    }

    if (restElapsedRef.current == null) return

    const cur = restElapsedRef.current
    const next = Math.max(0, cur + delta)
    restElapsedRef.current = next
    setRestElapsed(next)
    maybeAlertForRest(next)
    recordRestElapsed()
  }

  function handleSetTimerToggle(exIdx: number, setIdx: number) {
    if (!workoutRunning || !isActiveSet(exIdx, setIdx)) return
    const set = exercises[exIdx]?.sets[setIdx]
    if (!set || set.completed) return

    if (restRunRef.current || restElapsedRef.current != null || restRunning) {
      stopRest()
    }

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
            actualRestSeconds: completing ? s.actualRestSeconds : null,
            actualReps: completing
              ? resolveActualReps(s.actualReps, s.targetReps)
              : s.actualReps,
          }
        )),
      }
    )))

    if (activeSetRef.current?.exIdx === exIdx && activeSetRef.current?.setIdx === setIdx) {
      activeSetRef.current = null
      setActiveSetTimer(null)
    }

    if (!completing && restOwnerRef.current?.exIdx === exIdx && restOwnerRef.current?.setIdx === setIdx) {
      stopRest(false)
    }

    if (completing) {
      startRest(setToToggle.restSeconds ?? 90, { exIdx, setIdx })
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

    const activeRestOwner = restOwnerRef.current
    const activeRestElapsed = restElapsedRef.current
    const finalExercises = exercises.map((ex, exIdx) => ({
      ...ex,
      sets: ex.sets.map((s, setIdx) => ({
        ...s,
        actualRestSeconds: activeRestOwner?.exIdx === exIdx
          && activeRestOwner.setIdx === setIdx
          && activeRestElapsed != null
          ? activeRestElapsed
          : s.actualRestSeconds,
      })),
    }))

    const result: LoggedExerciseActual[] = finalExercises.map(ex => ({
      exercise: ex.exercise,
      progressionMode: 'single',
      sets: ex.sets.map(s => ({
        targetReps: s.targetReps,
        targetLoad: s.targetLoad,
        actualReps: resolveActualReps(s.actualReps, s.targetReps),
        actualLoad: s.actualLoad,
        completed: s.completed,
        restSeconds: s.restSeconds,
        actualRestSeconds: s.actualRestSeconds,
      })),
    }))

    onComplete(result, {
      startTime: workoutStartRef.current,
      endTime,
      pausePeriods: pausePeriodsRef.current.filter(p => p.end) as { start: string; end: string }[],
      totalElapsedSeconds: workoutElapsed,
    })
    window.localStorage.removeItem(draftStorageKey)
  }

  if (minimized) {
    return (
      <div className="fixed bottom-[72px] inset-x-0 z-50 px-4 pb-2">
        <button
          onClick={onResume}
          className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl active:scale-[0.98] transition-transform"
        >
          <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-white truncate">{slot.name}</p>
            <p className="text-xs text-slate-400">Workout in progress — tap to resume</p>
          </div>
          <span className="font-mono text-sky-300 text-sm flex-shrink-0">{fmt(workoutElapsed)}</span>
          <ChevronUp size={16} className="text-slate-400 flex-shrink-0" />
        </button>
      </div>
    )
  }

  return (
    <>
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pb-3 border-b border-slate-800" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button
          onClick={onMinimize}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Minimize workout"
        >
          <X size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white truncate">{planDay.label}</h1>
          <p className="text-xs text-slate-500 truncate">{slot.name}</p>
        </div>
        <button
          onClick={() => setShowCancelConfirm(true)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Cancel workout"
        >
          <Trash2 size={16} />
        </button>
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
            value={restElapsed != null ? fmt(restElapsed) : '—'}
            targetValue={restTarget != null ? fmt(restTarget) : undefined}
            running={restRunning}
            disabled={restElapsed == null}
            colorClass={restElapsed != null
              ? (restTarget != null && restElapsed >= restTarget ? 'text-red-400' : 'text-emerald-300')
              : 'text-slate-600'}
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
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white leading-tight">{ex.exercise}</p>
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
                      {ex.isWarmup ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-500/20 text-orange-300 font-bold">W</span>
                      ) : (
                        setIdx + 1
                      )}
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
                      disabled={!active || s.completed || !workoutRunning}
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

    {showCancelConfirm && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <Trash2 size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-semibold">Cancel workout?</p>
              <p className="text-sm text-slate-400 mt-1">Your in-progress session won't be saved.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm transition-colors"
            >
              Keep going
            </button>
            <button
              onClick={() => {
                window.localStorage.removeItem(draftStorageKey)
                onCancel()
              }}
              className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors"
            >
              Cancel workout
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
