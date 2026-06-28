import { useState, useEffect, useRef } from 'react'
import { X, Check, Play, Pause, RotateCcw, Settings2 } from 'lucide-react'
import { useMobilityStore, type MobilityExercise } from '../../store/mobilityStore'

interface Props {
  today: string
  onClose: () => void
  onManageRoutine: () => void
}

function fmt(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

export function MobilityTracker({ today, onClose, onManageRoutine }: Props) {
  const routine = useMobilityStore(s => s.routine)
  const logCompletion = useMobilityStore(s => s.logCompletion)

  const [checked, setChecked] = useState<Set<string>>(() => new Set())
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(true)
  const wallBaseRef = useRef<{ elapsed: number; time: number }>({ elapsed: 0, time: Date.now() })
  const runningRef = useRef(true)

  useEffect(() => {
    const id = setInterval(() => {
      if (runningRef.current) {
        const { elapsed: base, time } = wallBaseRef.current
        setElapsed(base + Math.floor((Date.now() - time) / 1000))
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  function toggleRunning() {
    if (runningRef.current) {
      const { elapsed: base, time } = wallBaseRef.current
      const now = base + Math.floor((Date.now() - time) / 1000)
      wallBaseRef.current = { elapsed: now, time: Date.now() }
      runningRef.current = false
      setRunning(false)
    } else {
      wallBaseRef.current = { elapsed, time: Date.now() }
      runningRef.current = true
      setRunning(true)
    }
  }

  function toggleExercise(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleDone() {
    const durationMin = Math.max(1, Math.round(elapsed / 60))
    logCompletion(today, {
      completedAt: new Date().toISOString(),
      durationMin,
      completedExerciseIds: [...checked],
    })
    onClose()
  }

  const totalEstSec = routine.reduce((sum, e) => sum + e.durationSec, 0)
  const allDone = routine.length > 0 && checked.size === routine.length

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe pb-3 border-b border-slate-800">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Mobility</p>
          <h2 className="text-lg font-bold text-white leading-tight">Daily Routine</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onManageRoutine}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            aria-label="Manage routine"
          >
            <Settings2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Timer bar */}
      <div className="px-4 py-3 border-b border-slate-800/60 flex items-center gap-4">
        <p className="text-2xl font-mono font-bold text-white">{fmt(elapsed)}</p>
        <p className="text-xs text-slate-500 flex-1">Est. {fmt(totalEstSec)}</p>
        <button
          onClick={toggleRunning}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
        >
          {running ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          onClick={() => {
            wallBaseRef.current = { elapsed: 0, time: Date.now() }
            setElapsed(0)
          }}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {routine.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 text-sm">No exercises in your routine.</p>
            <button
              onClick={onManageRoutine}
              className="mt-3 text-xs text-sky-400 hover:text-sky-300 font-medium"
            >
              Add exercises →
            </button>
          </div>
        ) : (
          routine.map((ex: MobilityExercise) => {
            const done = checked.has(ex.id)
            return (
              <button
                key={ex.id}
                onClick={() => toggleExercise(ex.id)}
                className={`w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors active:scale-[0.99] ${
                  done
                    ? 'bg-emerald-500/15 border-emerald-500/40'
                    : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                }`}>
                  {done && <Check size={11} className="text-white" strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? 'text-emerald-300 line-through decoration-emerald-500/50' : 'text-slate-200'}`}>
                    {ex.name}
                  </p>
                </div>
                <p className="text-xs text-slate-500 flex-shrink-0 font-mono">{fmt(ex.durationSec)}</p>
              </button>
            )
          })
        )}
      </div>

      {/* Progress + Done */}
      <div className="px-4 py-4 border-t border-slate-800 space-y-3">
        {routine.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${routine.length > 0 ? (checked.size / routine.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 flex-shrink-0 tabular-nums">
              {checked.size}/{routine.length}
            </span>
          </div>
        )}
        <button
          onClick={handleDone}
          className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98] ${
            allDone
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
          }`}
        >
          {allDone ? 'Done — Log Session' : 'Log Session'}
        </button>
      </div>
    </div>
  )
}
