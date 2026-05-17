import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { X, Pause, Play, RotateCcw, ChevronDown, ChevronUp, Check, Trash2, Plus, ArrowLeftRight } from 'lucide-react'
import type { WorkoutSlot, PlanDay } from '../../types'
import type { ExerciseSpec, WarmupRampSpec } from '../../types/program'
import type { LoggedExerciseActual, LoggedSetActual, WorkoutOutcome } from '../../modules/workout-outcomes/types'
import { resolveLoad, type EvalContext } from '../../lib/expressionEval'
import { EXERCISE_LIBRARY } from '../../lib/exerciseLibrary'
import { usePlanStore } from '../../store/planStore'

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
  isWarmup?: boolean
}

interface ExerciseTrackState {
  exercise: string
  isWarmup: boolean
  sets: SetTrackState[]
  previousSets?: LoggedSetActual[]
  addedDuringWorkout?: boolean
}


function parseWarmupPercentages(warmup: ExerciseSpec['warmup']): number[] {
  if (!warmup) return []
  if (typeof warmup === 'string') {
    return warmup
      .split(/[\/;,]+/)
      .map(part => part.trim().match(/(\d+(?:\.\d+)?)\s*%?/)?.[1])
      .filter((part): part is string => Boolean(part))
      .map(Number)
      .filter(n => Number.isFinite(n) && n > 0)
  }
  return warmup.percentages.filter(n => Number.isFinite(n) && n > 0)
}

function warmupRampObject(warmup: ExerciseSpec['warmup']): WarmupRampSpec | null {
  return warmup && typeof warmup === 'object' ? warmup : null
}

function warmupRepsForIndex(warmup: ExerciseSpec['warmup'], index: number): number | string {
  const explicit = warmupRampObject(warmup)?.reps?.[index]
  if (explicit != null) return explicit
  return [8, 5, 3, 2, 1][index] ?? 1
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

type ExercisePickerMode = { mode: 'add' } | { mode: 'replace'; exIdx: number }

function ExercisePicker({
  mode,
  exerciseNames,
  canSaveToTemplate,
  onSelect,
  onClose,
}: {
  mode: 'add' | 'replace'
  exerciseNames: string[]
  canSaveToTemplate: boolean
  onSelect: (name: string, insertAt: number, saveToTemplate: boolean) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [customName, setCustomName] = useState('')
  const [insertAt, setInsertAt] = useState(exerciseNames.length)
  const [showCustom, setShowCustom] = useState(false)
  const [saveToTemplate, setSaveToTemplate] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return EXERCISE_LIBRARY.slice(0, 25)
    return EXERCISE_LIBRARY.filter(ex => ex.name.toLowerCase().includes(q)).slice(0, 40)
  }, [query])

  function handleSelect(name: string) {
    onSelect(name, insertAt, saveToTemplate)
  }

  function handleCustomSubmit() {
    const name = customName.trim()
    if (!name) return
    handleSelect(name)
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-900">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>
        <h2 className="text-sm font-bold text-white flex-1">
          {mode === 'add' ? 'Add Exercise' : 'Replace Exercise'}
        </h2>
        {canSaveToTemplate && (
          <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
            <span className="text-[10px] text-slate-400 leading-none">Save to plan</span>
            <div
              onClick={() => setSaveToTemplate(v => !v)}
              className={`w-8 h-5 rounded-full relative transition-colors cursor-pointer ${saveToTemplate ? 'bg-sky-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${saveToTemplate ? 'left-[18px]' : 'left-0.5'}`} />
            </div>
          </label>
        )}
      </div>

      {mode === 'add' && exerciseNames.length > 0 && (
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Insert position</p>
          <div className="flex flex-wrap gap-1.5">
            {exerciseNames.map((name, i) => (
              <button
                key={i}
                onClick={() => setInsertAt(i)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  insertAt === i
                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                Before {name.split(',')[0]}
              </button>
            ))}
            <button
              onClick={() => setInsertAt(exerciseNames.length)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                insertAt === exerciseNames.length
                  ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              At end
            </button>
          </div>
        </div>
      )}

      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-800">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search exercises..."
          autoFocus={!showCustom}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {!showCustom ? (
          <button
            onClick={() => setShowCustom(true)}
            className="w-full text-left px-3 py-2.5 rounded-lg border border-dashed border-slate-600 text-slate-400 text-sm hover:border-sky-500/50 hover:text-sky-300 transition-colors"
          >
            + Enter custom exercise name
          </button>
        ) : (
          <div className="flex gap-2 mb-1">
            <input
              type="text"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="Custom exercise name"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleCustomSubmit() }}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customName.trim()}
              className="px-3 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => setShowCustom(false)}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {filtered.map(ex => (
          <button
            key={ex.name}
            onClick={() => handleSelect(ex.name)}
            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <p className="text-sm text-white leading-tight">{ex.name}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{ex.target.join(', ')}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

export function ActiveWorkoutTracker({
  planId,
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
  const [exercisePicker, setExercisePicker] = useState<ExercisePickerMode | null>(null)
  const workoutStartRef = useRef(new Date().toISOString())
  const pausePeriodsRef = useRef<{ start: string; end?: string }[]>([])
  const pausedSetRef = useRef<{ exIdx: number; setIdx: number } | null>(null)

  const workoutRunRef = useRef(true)
  const activeSetRef = useRef<{ exIdx: number; setIdx: number } | null>(null)
  const restRunRef = useRef(false)
  const restElapsedRef = useRef<number | null>(null)
  const restTargetRef = useRef<number | null>(null)
  const restWarningAlertedRef = useRef(false)
  const restAlertedRef = useRef(false)
  const restOwnerRef = useRef<{ exIdx: number; setIdx: number } | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const scheduledRestNodesRef = useRef<OscillatorNode[]>([])
  const workoutWallBaseRef = useRef<{ elapsed: number; time: number }>({ elapsed: 0, time: Date.now() })
  const restWallBaseRef = useRef<{ elapsed: number; time: number } | null>(null)

  const [workoutElapsed, setWorkoutElapsed] = useState(0)
  const [workoutRunning, setWorkoutRunning] = useState(true)
  const [activeSetTimer, setActiveSetTimer] = useState<{ exIdx: number; setIdx: number } | null>(null)
  const [restElapsed, setRestElapsed] = useState<number | null>(null)
  const [restTarget, setRestTarget] = useState<number | null>(null)
  const [restRunning, setRestRunning] = useState(false)
  const [timersExpanded, setTimersExpanded] = useState(false)
  const [focusedField, setFocusedField] = useState<{ exIdx: number; setIdx: number; type: 'reps' | 'weight' } | null>(null)
  const [keyboardBottom, setKeyboardBottom] = useState(0)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasVars = Object.keys(programVars).length > 0
  const evalCtx: EvalContext = { vars: programVars }

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const bottom = window.innerHeight - (vv.height + vv.offsetTop)
      setKeyboardBottom(Math.max(0, bottom))
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  const handleFieldFocus = useCallback((exIdx: number, setIdx: number, type: 'reps' | 'weight') => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    setFocusedField({ exIdx, setIdx, type })
  }, [])

  const handleFieldBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => setFocusedField(null), 200)
  }, [])

  function adjustFocusedField(delta: number) {
    if (!focusedField) return
    const { exIdx, setIdx, type } = focusedField
    const s = exercises[exIdx]?.sets[setIdx]
    if (!s) return
    if (type === 'weight') {
      const next = Math.max(0, (s.actualLoad ?? 0) + delta)
      updateSet(exIdx, setIdx, { actualLoad: next })
    } else {
      const next = Math.max(0, (s.actualReps ?? 0) + delta)
      updateSet(exIdx, setIdx, { actualReps: next })
    }
  }

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

      const warmupSets: SetTrackState[] = !ex.__isWarmup && ex.load
        ? parseWarmupPercentages(ex.warmup).map((pct, i) => buildSet(
            `${pct / 100} * (${ex.load})`,
            warmupRepsForIndex(ex.warmup, i),
            warmupRampObject(ex.warmup)?.rest ?? ex.rest,
          )).map(set => ({ ...set, isWarmup: true }))
        : []

      let sets: SetTrackState[]
      if (Array.isArray(ex.sets) && ex.sets.length > 0) {
        const workSets = ex.sets.map((s, i) => {
          const base = buildSet(s.load ?? ex.load, s.reps ?? ex.reps, s.rest ?? ex.rest)
          const prev = prevEx?.[i + warmupSets.length]
          return {
            ...base,
            actualReps: prev?.actualReps ?? base.actualReps,
            actualLoad: prev?.actualLoad ?? base.actualLoad,
          }
        })
        sets = [...warmupSets, ...workSets]
      } else {
        const n = typeof ex.sets === 'number' ? ex.sets : 3
        const workSets = Array.from({ length: n }, (_, i) => {
          const base = buildSet(ex.load, ex.reps, ex.rest)
          const prev = prevEx?.[i + warmupSets.length]
          return {
            ...base,
            actualReps: prev?.actualReps ?? base.actualReps,
            actualLoad: prev?.actualLoad ?? base.actualLoad,
          }
        })
        sets = [...warmupSets, ...workSets]
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
        restWarningAlerted?: boolean
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
      if (draft.restOwner) restOwnerRef.current = draft.restOwner
      if (draft.activeSetTimer) {
        setActiveSetTimer(draft.activeSetTimer)
        activeSetRef.current = draft.activeSetTimer
      }
      if (draft.exercises?.length) setExercises(draft.exercises)
      // Re-schedule rest audio if rest was still running when draft was saved
      if (restRunRef.current && restoredRestElapsed != null && restoredRestTarget != null) {
        restWallBaseRef.current = { elapsed: restoredRestElapsed, time: Date.now() }
        const ctx = getAudioContext()
        if (ctx) scheduleRestAudio(ctx, restoredRestTarget, restoredRestElapsed)
      }
      if (typeof draft.workoutElapsed === 'number') {
        workoutWallBaseRef.current = { elapsed: draft.workoutElapsed, time: Date.now() }
      }
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
      restWarningAlerted: restWarningAlertedRef.current,
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
  ): OscillatorNode {
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
    return oscillator
  }

  function cancelScheduledRestAudio() {
    for (const node of scheduledRestNodesRef.current) {
      try { node.stop(0) } catch { /* already stopped */ }
    }
    scheduledRestNodesRef.current = []
  }

  // Pre-schedule rest audio via AudioContext hardware clock so it fires even when backgrounded.
  // Sets the warning/alerted ref flags immediately to prevent interval double-play.
  function scheduleRestAudio(ctx: AudioContext, targetSeconds: number, fromElapsed: number) {
    cancelScheduledRestAudio()
    const nodes: OscillatorNode[] = []
    const base = ctx.currentTime + 0.05
    const remainingToWoodBlock = (targetSeconds - 15) - fromElapsed
    const remainingToEnd = targetSeconds - fromElapsed

    if (targetSeconds > 15 && remainingToWoodBlock > 0) {
      // wood block: short percussive double-tap
      nodes.push(scheduleTone(ctx, 880, base + remainingToWoodBlock, 0.045, 0.28, 'triangle'))
      nodes.push(scheduleTone(ctx, 440, base + remainingToWoodBlock + 0.025, 0.04, 0.14, 'triangle'))
    }
    if (remainingToEnd > 0) {
      nodes.push(scheduleTone(ctx, 920, base + remainingToEnd, 0.2, 0.22, 'square'))
      nodes.push(scheduleTone(ctx, 1380, base + remainingToEnd, 0.05, 0.08, 'triangle'))
      nodes.push(scheduleTone(ctx, 1046.5, base + remainingToEnd + 0.24, 0.28, 0.16))
      nodes.push(scheduleTone(ctx, 1568, base + remainingToEnd + 0.40, 0.38, 0.14))
    }
    scheduledRestNodesRef.current = nodes

    // Mark flags so interval never double-plays
    restWarningAlertedRef.current = targetSeconds <= 15 || remainingToWoodBlock <= 0
    restAlertedRef.current = remainingToEnd <= 0
  }

  // Fallback (fires only when AudioContext unavailable or pre-scheduling wasn't done)
  function maybeAlertForRest(elapsedSeconds: number) {
    const targetSeconds = restTargetRef.current
    if (targetSeconds == null) return
    if (targetSeconds > 15 && elapsedSeconds >= targetSeconds - 15 && !restWarningAlertedRef.current) {
      restWarningAlertedRef.current = true
      // wood block fallback
      const ctx = getAudioContext()
      if (ctx) {
        const now = ctx.currentTime + 0.02
        scheduleTone(ctx, 880, now, 0.045, 0.28, 'triangle')
        scheduleTone(ctx, 440, now + 0.025, 0.04, 0.14, 'triangle')
      }
    }
    if (elapsedSeconds >= targetSeconds && !restAlertedRef.current) {
      restAlertedRef.current = true
      const ctx = getAudioContext()
      if (ctx) {
        const now = ctx.currentTime + 0.02
        scheduleTone(ctx, 920, now, 0.2, 0.22, 'square')
        scheduleTone(ctx, 1380, now, 0.05, 0.08, 'triangle')
        scheduleTone(ctx, 1046.5, now + 0.24, 0.28, 0.16)
        scheduleTone(ctx, 1568, now + 0.40, 0.38, 0.14)
      }
    }
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
    cancelScheduledRestAudio()
    if (recordElapsed) recordRestElapsed()
    restRunRef.current = false
    setRestRunning(false)
    restElapsedRef.current = null
    restTargetRef.current = null
    restWarningAlertedRef.current = false
    restAlertedRef.current = false
    restOwnerRef.current = null
    restWallBaseRef.current = null
    setRestElapsed(null)
    setRestTarget(null)
  }

  useEffect(() => {
    const id = setInterval(() => {
      if (workoutRunRef.current) {
        setWorkoutElapsed(s => {
          const next = s + 1
          workoutWallBaseRef.current = { elapsed: next, time: Date.now() }
          return next
        })
      }

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
          restWallBaseRef.current = { elapsed: next, time: Date.now() }
          setRestElapsed(next)
          maybeAlertForRest(next)
        }
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // On resume from background/lock, reconcile timers against system clock rather than
  // relying on throttled setInterval ticks.
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return
      if (workoutRunRef.current) {
        const { elapsed, time } = workoutWallBaseRef.current
        const actual = elapsed + Math.floor((Date.now() - time) / 1000)
        setWorkoutElapsed(actual)
        workoutWallBaseRef.current = { elapsed: actual, time: Date.now() }
      }
      if (restRunRef.current && restWallBaseRef.current) {
        const { elapsed, time } = restWallBaseRef.current
        const actual = elapsed + Math.floor((Date.now() - time) / 1000)
        restElapsedRef.current = actual
        restWallBaseRef.current = { elapsed: actual, time: Date.now() }
        setRestElapsed(actual)
        maybeAlertForRest(actual)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  function startRest(seconds: number, owner: { exIdx: number; setIdx: number }) {
    stopRest()
    const ctx = getAudioContext()
    restElapsedRef.current = 0
    restTargetRef.current = seconds
    restOwnerRef.current = owner
    setRestElapsed(0)
    setRestTarget(seconds)
    restRunRef.current = true
    setRestRunning(true)
    activeSetRef.current = null
    setActiveSetTimer(null)
    restWallBaseRef.current = { elapsed: 0, time: Date.now() }
    if (ctx) scheduleRestAudio(ctx, seconds, 0)
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
      cancelScheduledRestAudio()
      return
    }

    const periods = pausePeriodsRef.current
    const last = periods[periods.length - 1]
    if (last && !last.end) last.end = new Date().toISOString()
    workoutRunRef.current = true
    setWorkoutRunning(true)
    workoutWallBaseRef.current = { elapsed: workoutElapsed, time: Date.now() }

    if (restElapsedRef.current != null) {
      restRunRef.current = true
      setRestRunning(true)
      restWallBaseRef.current = { elapsed: restElapsedRef.current, time: Date.now() }
      const ctx = getAudioContext()
      if (ctx && restTargetRef.current != null) scheduleRestAudio(ctx, restTargetRef.current, restElapsedRef.current)
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
      cancelScheduledRestAudio()
      restRunRef.current = false
      setRestRunning(false)
      restWallBaseRef.current = null
      recordRestElapsed()
      return
    }
    const ctx = getAudioContext()
    restRunRef.current = true
    setRestRunning(true)
    restWallBaseRef.current = { elapsed: restElapsedRef.current, time: Date.now() }
    if (ctx && restTargetRef.current != null) scheduleRestAudio(ctx, restTargetRef.current, restElapsedRef.current)
  }

  function resetRest(e: React.MouseEvent) {
    e.stopPropagation()
    stopRest()
  }

  function adjust(timer: 'workout' | 'rest', delta: number, e: React.MouseEvent) {
    e.stopPropagation()
    if (timer === 'workout') {
      setWorkoutElapsed(s => {
        const next = Math.max(0, s + delta)
        workoutWallBaseRef.current = { elapsed: next, time: Date.now() }
        return next
      })
      return
    }

    if (restElapsedRef.current == null) return

    const cur = restElapsedRef.current
    const next = Math.max(0, cur + delta)
    restElapsedRef.current = next
    setRestElapsed(next)
    maybeAlertForRest(next)
    recordRestElapsed()
    if (restRunRef.current && restTargetRef.current != null) {
      restWallBaseRef.current = { elapsed: next, time: Date.now() }
      const ctx = getAudioContext()
      if (ctx) scheduleRestAudio(ctx, restTargetRef.current, next)
    }
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

  function addSet(exIdx: number) {
    setExercises(prev => prev.map((ex, ei) => {
      if (ei !== exIdx) return ex
      const lastSet = ex.sets[ex.sets.length - 1]
      const newSet: SetTrackState = {
        setElapsedSeconds: 0,
        completed: false,
        actualReps: lastSet?.actualReps ?? null,
        actualLoad: lastSet?.actualLoad ?? null,
        targetReps: lastSet?.targetReps ?? null,
        targetLoad: lastSet?.targetLoad ?? null,
        restSeconds: lastSet?.restSeconds ?? null,
        actualRestSeconds: null,
        resolvedLoadLbs: lastSet?.resolvedLoadLbs ?? null,
      }
      return { ...ex, sets: [...ex.sets, newSet] }
    }))
  }

  function addExercise(name: string, insertAt: number) {
    const newEx: ExerciseTrackState = {
      exercise: name,
      isWarmup: false,
      addedDuringWorkout: true,
      sets: Array.from({ length: 3 }, () => ({
        setElapsedSeconds: 0,
        completed: false,
        actualReps: null,
        actualLoad: null,
        targetReps: null,
        targetLoad: null,
        restSeconds: 90,
        actualRestSeconds: null,
        resolvedLoadLbs: null,
      })),
    }
    setExercises(prev => [
      ...prev.slice(0, insertAt),
      newEx,
      ...prev.slice(insertAt),
    ])
    setExercisePicker(null)
  }

  function saveExerciseToTemplate(name: string, insertAt: number) {
    const plan = usePlanStore.getState().plans[planId]
    if (!plan) return
    const dayIdx = plan.days.findIndex(d => d.id === planDay.id)
    if (dayIdx === -1) return
    const slotIdx = plan.days[dayIdx].slots.findIndex(s => s.id === slot.id)
    if (slotIdx === -1) return
    const targetSlot = plan.days[dayIdx].slots[slotIdx]
    // Compute insertion position among work exercises only (exclude warmups)
    const warmupsBefore = exercises.slice(0, insertAt).filter(ex => ex.isWarmup).length
    const workExInsertAt = insertAt - warmupsBefore
    const currentExercises = targetSlot.exercises ?? []
    const newEx: ExerciseSpec = { exercise: name, sets: 3 }
    const newExercises = [
      ...currentExercises.slice(0, workExInsertAt),
      newEx,
      ...currentExercises.slice(workExInsertAt),
    ]
    const newDays = plan.days.map((d, di) =>
      di !== dayIdx ? d : {
        ...d,
        slots: d.slots.map((s, si) =>
          si !== slotIdx ? s : { ...s, exercises: newExercises }
        ),
      }
    )
    usePlanStore.getState().updatePlan(planId, { days: newDays })
  }

  function replaceExerciseInTemplate(exIdx: number, name: string) {
    const plan = usePlanStore.getState().plans[planId]
    if (!plan) return
    const dayIdx = plan.days.findIndex(d => d.id === planDay.id)
    if (dayIdx === -1) return
    const slotIdx = plan.days[dayIdx].slots.findIndex(s => s.id === slot.id)
    if (slotIdx === -1) return
    const targetSlot = plan.days[dayIdx].slots[slotIdx]
    const exToReplace = exercises[exIdx]
    if (!exToReplace) return
    let newSlot = { ...targetSlot }
    if (exToReplace.isWarmup) {
      const warmupIdx = exercises.slice(0, exIdx + 1).filter(ex => ex.isWarmup).length - 1
      const newWarmup = (targetSlot.warmup ?? []).map((ex, i) =>
        i === warmupIdx ? { ...ex, exercise: name } : ex
      )
      newSlot = { ...newSlot, warmup: newWarmup }
    } else {
      const workExIdx = exercises.slice(0, exIdx + 1).filter(ex => !ex.isWarmup).length - 1
      const newExercises = (targetSlot.exercises ?? []).map((ex, i) =>
        i === workExIdx ? { ...ex, exercise: name } : ex
      )
      newSlot = { ...newSlot, exercises: newExercises }
    }
    const newDays = plan.days.map((d, di) =>
      di !== dayIdx ? d : {
        ...d,
        slots: d.slots.map((s, si) =>
          si !== slotIdx ? s : newSlot
        ),
      }
    )
    usePlanStore.getState().updatePlan(planId, { days: newDays })
  }

  function replaceExercise(exIdx: number, name: string) {
    setExercises(prev => prev.map((ex, ei) =>
      ei !== exIdx ? ex : { ...ex, exercise: name, previousSets: undefined }
    ))
    setExercisePicker(null)
  }

  function handlePickerSelect(name: string, insertAt: number, saveToTemplate: boolean) {
    if (!exercisePicker) return
    if (exercisePicker.mode === 'add') {
      addExercise(name, insertAt)
      if (saveToTemplate) saveExerciseToTemplate(name, insertAt)
    } else {
      replaceExercise(exercisePicker.exIdx, name)
      if (saveToTemplate) replaceExerciseInTemplate(exercisePicker.exIdx, name)
    }
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
        <div className="grid grid-cols-3 divide-x divide-slate-700/60 py-2.5">
          {/* Active Set — display-only counter, equal width with Workout and Rest */}
          <div className="flex flex-col items-center gap-1.5 px-2">
            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Active Set</p>
            <p className="text-lg font-mono font-bold leading-none text-amber-200">{activeSetValue}</p>
            {/* spacer matches the h-6 button row in TimerCol so all three columns are equal height */}
            <div className="h-6" />
            {timersExpanded && <div className="h-[22px]" />}
          </div>
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
              <div className="flex items-center justify-between min-w-0">
                <p className="text-sm font-semibold text-white leading-tight truncate flex-1">{ex.exercise}</p>
                <button
                  onClick={() => setExercisePicker({ mode: 'replace', exIdx })}
                  className="ml-2 p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors flex-shrink-0"
                  title="Replace exercise"
                >
                  <ArrowLeftRight size={13} />
                </button>
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
                      {ex.isWarmup || s.isWarmup ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-500/20 text-orange-300 font-bold">W</span>
                      ) : (
                        setIdx + 1
                      )}
                    </span>
                    <span className="col-span-3 text-center text-slate-500 text-[10px]">
                      {previousSetDisplay(ex, setIdx)}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={s.actualReps ?? ''}
                      onChange={e => updateSet(exIdx, setIdx, {
                        actualReps: e.target.value ? Number(e.target.value) : null,
                      })}
                      onFocus={e => { handleFieldFocus(exIdx, setIdx, 'reps'); e.target.select() }}
                      onBlur={handleFieldBlur}
                      placeholder={String(s.targetReps ?? 'reps')}
                      className="col-span-3 bg-slate-700 border border-slate-600 rounded px-1.5 py-1 text-xs text-slate-100 text-center"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={s.actualLoad ?? ''}
                      onChange={e => updateSet(exIdx, setIdx, {
                        actualLoad: e.target.value ? Number(e.target.value) : null,
                      })}
                      onFocus={e => { handleFieldFocus(exIdx, setIdx, 'weight'); e.target.select() }}
                      onBlur={handleFieldBlur}
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

              <button
                onClick={() => addSet(exIdx)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-slate-700 text-slate-600 text-xs hover:text-slate-300 hover:border-slate-500 transition-colors"
              >
                <Plus size={11} />
                Add set
              </button>
            </div>
          ))
        )}

        <button
          onClick={() => setExercisePicker({ mode: 'add' })}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-700 text-slate-500 text-sm hover:text-slate-200 hover:border-slate-500 transition-colors"
        >
          <Plus size={14} />
          Add exercise
        </button>
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

    {focusedField && (
      <div
        className="fixed left-0 right-0 z-[55] flex gap-3 px-4 py-2 bg-slate-800/95 border-t border-slate-700 backdrop-blur-sm"
        style={{ bottom: keyboardBottom }}
      >
        {focusedField.type === 'weight' ? (
          <>
            <button
              onPointerDown={e => e.preventDefault()}
              onClick={() => adjustFocusedField(-5)}
              className="flex-1 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-slate-200 text-sm font-semibold active:bg-slate-500 transition-colors"
            >
              −5 lbs
            </button>
            <button
              onPointerDown={e => e.preventDefault()}
              onClick={() => adjustFocusedField(5)}
              className="flex-1 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-slate-200 text-sm font-semibold active:bg-slate-500 transition-colors"
            >
              +5 lbs
            </button>
          </>
        ) : (
          <>
            <button
              onPointerDown={e => e.preventDefault()}
              onClick={() => adjustFocusedField(-1)}
              className="flex-1 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-slate-200 text-xl font-semibold active:bg-slate-500 transition-colors"
            >
              −
            </button>
            <button
              onPointerDown={e => e.preventDefault()}
              onClick={() => adjustFocusedField(1)}
              className="flex-1 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-slate-200 text-xl font-semibold active:bg-slate-500 transition-colors"
            >
              +
            </button>
          </>
        )}
      </div>
    )}

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

    {exercisePicker && (
      <ExercisePicker
        mode={exercisePicker.mode}
        exerciseNames={exercises.map(ex => ex.exercise)}
        canSaveToTemplate={
          exercisePicker.mode !== 'replace' ||
          !exercises[exercisePicker.exIdx]?.addedDuringWorkout
        }
        onSelect={handlePickerSelect}
        onClose={() => setExercisePicker(null)}
      />
    )}
    </>
  )
}
