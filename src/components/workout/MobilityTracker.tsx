import { useState, useEffect, useRef } from 'react'
import { X, Settings2, ChevronLeft, ChevronUp, Trash2, Check } from 'lucide-react'
import { useMobilityStore } from '../../store/mobilityStore'
import type { MobilitySessionCheckpoint } from '../../store/mobilityStore'

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

type Phase = 'idle' | 'exercising' | 'finished'

const SWIPE_MIN_DX = 50

interface Props {
  today: string
  minimized: boolean
  onMinimize: () => void
  onResume: () => void
  onClose: () => void
  onManageRoutine: () => void
}

export function MobilityTracker({ today, minimized, onMinimize, onResume, onClose, onManageRoutine }: Props) {
  const routine = useMobilityStore(s => s.routine)
  const logCompletion = useMobilityStore(s => s.logCompletion)
  const activeSession = useMobilityStore(s => s.activeSession)
  const startSession = useMobilityStore(s => s.startSession)
  const saveCheckpoint = useMobilityStore(s => s.saveCheckpoint)
  const clearSession = useMobilityStore(s => s.clearSession)

  // Validate checkpoint: must match today's date and the same routine order
  const routineKey = routine.map(e => e.id).join(',')
  const cp: MobilitySessionCheckpoint | null =
    activeSession?.date === today && activeSession.exerciseIds.join(',') === routineKey
      ? activeSession
      : null

  // Session state
  const [currentIdx, setCurrentIdx] = useState(cp?.currentIdx ?? 0)
  const [completedIds, setCompletedIds] = useState<string[]>(cp?.completedIds ?? [])
  const [phase, setPhase] = useState<Phase>('idle')
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [showJumpMenu, setShowJumpMenu] = useState(false)

  // Live display state (driven by 100ms tick)
  const [totalSec, setTotalSec] = useState(cp?.totalElapsedSec ?? 0)
  const [exSec, setExSec] = useState(cp?.exElapsedSec ?? 0)

  // Wall-clock refs — never go stale in closures
  const totalR = useRef({ acc: cp?.totalElapsedSec ?? 0, at: Date.now() as number | null })
  const exR = useRef({ acc: cp?.exElapsedSec ?? 0, at: null as number | null })

  // Stale-closure-safe mirrors of state for interval + cleanup
  const phaseR = useRef<Phase>('idle')
  const idxR = useRef(cp?.currentIdx ?? 0)
  const doneR = useRef<string[]>(cp?.completedIds ?? [])
  const autoFiredR = useRef(false) // prevent double-fire when exercise timer hits 0
  const finalizedR = useRef(false) // set once session is logged or discarded — skip resave on unmount
  const swipeStartR = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => { phaseR.current = phase }, [phase])
  useEffect(() => { idxR.current = currentIdx }, [currentIdx])
  useEffect(() => { doneR.current = completedIds }, [completedIds])

  // ── Mount: init store session + start total timer ───────────────────────
  useEffect(() => {
    if (!cp) startSession(today, routine.map(e => e.id))
    totalR.current.at = Date.now() // total timer always starts running on open

    return () => {
      // Unmount without finalizing → save checkpoint so user can resume
      if (phaseR.current === 'finished' || finalizedR.current) return
      const now = Date.now()
      const te = totalR.current.at != null
        ? totalR.current.acc + (now - totalR.current.at) / 1000
        : totalR.current.acc
      const ee = exR.current.at != null
        ? exR.current.acc + (now - exR.current.at) / 1000
        : exR.current.acc
      saveCheckpoint({
        date: today,
        exerciseIds: routine.map(e => e.id),
        currentIdx: idxR.current,
        completedIds: doneR.current,
        totalElapsedSec: Math.max(0, te),
        exElapsedSec: Math.max(0, ee),
      })
    }
  }, []) // intentionally empty — refs handle stale values

  // ── 100ms tick: update display + handle auto-advance ────────────────────
  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now()

      // Total timer (always running while tracker is open)
      const t = totalR.current.at != null
        ? totalR.current.acc + (now - totalR.current.at) / 1000
        : totalR.current.acc
      setTotalSec(t)

      // Exercise timer
      const e = exR.current.at != null
        ? exR.current.acc + (now - exR.current.at) / 1000
        : exR.current.acc
      setExSec(e)

      // Auto-complete when exercise countdown hits zero
      if (phaseR.current === 'exercising' && !autoFiredR.current) {
        const cur = routine[idxR.current]
        if (cur && e >= cur.durationSec) {
          autoFiredR.current = true
          _markDone()
        }
      }
    }, 100)
    return () => clearInterval(tick)
  }, [routine]) // routine is stable between renders

  // ── Timer helpers ────────────────────────────────────────────────────────

  function _snapshotEx() {
    if (exR.current.at != null) {
      exR.current = {
        acc: exR.current.acc + (Date.now() - exR.current.at) / 1000,
        at: null,
      }
    }
  }

  // Jump to any exercise by index — used by Previous, swipe, and the jump menu.
  // Navigation never touches completedIds; only Mark Done does.
  function goToIndex(newIdx: number) {
    if (newIdx < 0 || newIdx >= routine.length) return
    _snapshotEx()
    exR.current = { acc: 0, at: null }
    autoFiredR.current = false
    idxR.current = newIdx
    setCurrentIdx(newIdx)
    setExSec(0)
    phaseR.current = 'idle'
    setPhase('idle')
  }

  function _markDone() {
    _snapshotEx()
    const id = routine[idxR.current]?.id
    if (id && !doneR.current.includes(id)) {
      const next = [...doneR.current, id]
      doneR.current = next
      setCompletedIds(next)
    }
    if (idxR.current >= routine.length - 1) {
      phaseR.current = 'finished'
      setPhase('finished')
    } else {
      goToIndex(idxR.current + 1)
    }
  }

  // ── User actions ─────────────────────────────────────────────────────────

  function handleStart() {
    exR.current = { acc: exR.current.acc, at: Date.now() }
    autoFiredR.current = false
    phaseR.current = 'exercising'
    setPhase('exercising')
  }

  function handleMarkDone() {
    _markDone()
  }

  function handlePrevious() {
    goToIndex(idxR.current - 1)
  }

  function handleAdjustTotal(delta: number) {
    const now = Date.now()
    const cur = totalR.current.at != null
      ? totalR.current.acc + (now - totalR.current.at) / 1000
      : totalR.current.acc
    const newAcc = Math.max(0, cur + delta)
    totalR.current = { acc: newAcc, at: totalR.current.at != null ? now : null }
    setTotalSec(newAcc)
  }

  function handleLogSession() {
    const now = Date.now()
    const te = totalR.current.at != null
      ? totalR.current.acc + (now - totalR.current.at) / 1000
      : totalR.current.acc
    finalizedR.current = true
    logCompletion(today, {
      completedAt: new Date().toISOString(),
      durationMin: Math.max(1, Math.round(te / 60)),
      completedExerciseIds: doneR.current,
    })
    clearSession()
    onClose()
  }

  function handleDiscard() {
    finalizedR.current = true
    clearSession()
    setShowDiscardConfirm(false)
    onClose()
  }

  // ── Swipe navigation (out-of-order exercise browsing) ───────────────────

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    swipeStartR.current = { x: t.clientX, y: t.clientY }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = swipeStartR.current
    swipeStartR.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_DX || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx < 0) goToIndex(idxR.current + 1)
    else goToIndex(idxR.current - 1)
  }

  // ── Derived values ───────────────────────────────────────────────────────

  const currentExercise = routine[currentIdx]
  const exRemaining = currentExercise ? Math.max(0, currentExercise.durationSec - exSec) : 0

  // ── Render ───────────────────────────────────────────────────────────────

  if (minimized) {
    return (
      <div className="fixed bottom-[72px] inset-x-0 z-50 px-4 pb-2">
        <button
          onClick={onResume}
          className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl active:scale-[0.98] transition-transform"
        >
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-white truncate">Daily Mobility</p>
            <p className="text-xs text-slate-400">
              {completedIds.length}/{routine.length} done — tap to resume
            </p>
          </div>
          <span className="font-mono text-teal-300 text-sm flex-shrink-0">{fmtTime(totalSec)}</span>
          <ChevronUp size={16} className="text-slate-400 flex-shrink-0" />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">

      {/* ── Header ── */}
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
            onClick={() => setShowDiscardConfirm(true)}
            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            aria-label="Discard session"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={onMinimize}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            aria-label="Minimize"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Total timer row ── */}
      <div className="px-5 py-3 border-b border-slate-800/60">
        <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-1.5 font-medium">Total Time</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleAdjustTotal(-15)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 text-xs font-semibold hover:bg-slate-700 active:scale-95 transition-all"
          >
            −15
          </button>
          <p className="flex-1 text-center text-2xl font-mono font-bold text-white">
            {fmtTime(totalSec)}
          </p>
          <button
            onClick={() => handleAdjustTotal(15)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 text-xs font-semibold hover:bg-slate-700 active:scale-95 transition-all"
          >
            +15
          </button>
        </div>
      </div>

      {/* ── Main content (phase-driven, swipeable) ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 py-4"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        {routine.length === 0 ? (
          <div className="text-center">
            <p className="text-slate-500 text-sm">No exercises in your routine.</p>
            <button onClick={onManageRoutine} className="mt-3 text-xs text-sky-400 hover:text-sky-300">
              Add exercises →
            </button>
          </div>

        ) : phase === 'finished' ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-2xl">
              ✓
            </div>
            <div>
              <p className="text-lg font-bold text-white">Session complete</p>
              <p className="text-sm text-slate-400 mt-1">
                {completedIds.length} of {routine.length} exercise{routine.length === 1 ? '' : 's'} done
              </p>
            </div>
          </div>

        ) : (
          // idle or exercising
          <div className="text-center space-y-6 w-full">
            {/* Exercise counter */}
            <p className="text-xs text-slate-600 tabular-nums">
              {currentIdx + 1} / {routine.length}
            </p>

            {/* Exercise name */}
            <p className="text-xl font-bold text-white leading-snug px-2">
              {currentExercise?.name}
            </p>

            {/* Countdown display */}
            <div className="space-y-3">
              <p className={`text-7xl font-mono font-bold tabular-nums leading-none transition-colors ${
                phase === 'exercising'
                  ? exRemaining <= 10 ? 'text-amber-400' : 'text-sky-400'
                  : 'text-slate-500'
              }`}>
                {fmtTime(exRemaining)}
              </p>

              {/* Progress bar — only visible while exercising */}
              <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-100 ${
                    phase === 'exercising' ? 'bg-sky-500' : 'bg-transparent'
                  }`}
                  style={{
                    width: currentExercise
                      ? `${Math.min(100, (exSec / currentExercise.durationSec) * 100)}%`
                      : '0%',
                  }}
                />
              </div>
            </div>

            {/* Action button */}
            {phase === 'idle' ? (
              <button
                onClick={handleStart}
                className="px-10 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm transition-colors active:scale-[0.97]"
              >
                Start
              </button>
            ) : (
              <button
                onClick={handleMarkDone}
                className="px-10 py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-semibold text-sm transition-colors active:scale-[0.97]"
              >
                Mark Done
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom: progress dots + nav + log ── */}
      <div className="px-4 pt-3 pb-4 border-t border-slate-800 space-y-3">

        {/* Progress dots — tap to jump to any exercise */}
        {routine.length > 0 && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowJumpMenu(true)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowJumpMenu(true) }}
            aria-label="Jump to exercise"
            className="flex justify-center gap-1.5 flex-wrap py-1 cursor-pointer"
          >
            {routine.map((ex, i) => (
              <div
                key={ex.id}
                className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                  completedIds.includes(ex.id)
                    ? 'bg-emerald-500'
                    : i === currentIdx && phase !== 'finished'
                    ? 'bg-sky-400'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        )}

        {/* Navigation + log */}
        <div className="flex gap-2">
          <button
            onClick={handlePrevious}
            disabled={currentIdx === 0}
            className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-xs font-medium hover:bg-slate-800 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronLeft size={14} />
            Previous
          </button>
          <button
            onClick={handleLogSession}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98] ${
              phase === 'finished'
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : completedIds.length > 0
                ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                : 'bg-slate-800/60 text-slate-500'
            }`}
          >
            {phase === 'finished' ? 'Log Session' : completedIds.length > 0 ? 'Log Progress' : 'Log Session'}
          </button>
        </div>
      </div>

      {/* ── Jump-to-exercise menu ── */}
      {showJumpMenu && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70"
          onClick={() => setShowJumpMenu(false)}
        >
          <div
            className="w-full max-w-lg bg-slate-800 border-t border-slate-700 rounded-t-2xl max-h-[70vh] overflow-y-auto pb-safe"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 pt-4 pb-2 sticky top-0 bg-slate-800 border-b border-slate-700/60">
              <p className="text-sm font-semibold text-white">Jump to exercise</p>
            </div>
            <div className="px-2 py-2 space-y-1">
              {routine.map((ex, i) => (
                <button
                  key={ex.id}
                  onClick={() => { goToIndex(i); setShowJumpMenu(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors ${
                    i === currentIdx ? 'bg-sky-500/15 border border-sky-500/40' : 'hover:bg-slate-700/60 border border-transparent'
                  }`}
                >
                  <span className="text-xs text-slate-500 w-5 flex-shrink-0 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${i === currentIdx ? 'text-sky-300' : 'text-slate-200'}`}>
                      {ex.name}
                    </p>
                    <p className="text-xs text-slate-500">{fmtTime(ex.durationSec)}</p>
                  </div>
                  {completedIds.includes(ex.id) && <Check size={15} className="text-emerald-400 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Discard confirmation ── */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <Trash2 size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-semibold">Discard mobility session?</p>
                <p className="text-sm text-slate-400 mt-1">Your progress won't be saved.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm transition-colors"
              >
                Keep going
              </button>
              <button
                onClick={handleDiscard}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
