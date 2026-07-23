import { useState, useEffect, useRef } from 'react'
import { X, Settings2, ChevronLeft, Trash2, Check, Volume2, VolumeX, ArrowLeftRight } from 'lucide-react'
import { useMobilityStore } from '../../store/mobilityStore'
import type { MobilitySessionCheckpoint } from '../../store/mobilityStore'
import { MOBILITY_LIBRARY, isBilateralExercise } from '../../lib/mobilityLibrary'
import { primeAudio, playExerciseEndSound, playSwitchSidesSound, playSessionCompleteSound } from '../../lib/timerSounds'

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

type Phase = 'idle' | 'exercising' | 'finished'

const SWIPE_MIN_DX = 50

// Reconciles a resumed checkpoint against the live routine so exercises can be
// added/removed/reordered mid-session without losing progress. Completed ids
// for exercises that no longer exist are dropped; the "current" exercise is
// tracked by id and re-mapped to its new index, or advanced to the next
// not-yet-completed exercise if it was removed.
export function reconcileCheckpoint(
  cp: MobilitySessionCheckpoint,
  liveRoutine: { id: string }[],
): { currentIdx: number; completedIds: string[]; totalElapsedSec: number; exElapsedSec: number } {
  const liveIds = liveRoutine.map(e => e.id)
  const completedIds = cp.completedIds.filter(id => liveIds.includes(id))
  const priorCurrentId = cp.exerciseIds[cp.currentIdx]
  const stillCurrent = priorCurrentId != null && liveIds.includes(priorCurrentId)

  let currentIdx: number
  if (stillCurrent) {
    currentIdx = liveIds.indexOf(priorCurrentId)
  } else {
    const nextIdx = liveIds.findIndex(id => !completedIds.includes(id))
    currentIdx = nextIdx === -1 ? Math.max(0, liveIds.length - 1) : nextIdx
  }

  return {
    currentIdx,
    completedIds,
    totalElapsedSec: cp.totalElapsedSec,
    exElapsedSec: stillCurrent ? cp.exElapsedSec : 0,
  }
}

interface Props {
  today: string
  onClose: () => void
  onManageRoutine: () => void
}

export function MobilityTracker({ today, onClose, onManageRoutine }: Props) {
  const routine = useMobilityStore(s => s.routine)
  const logCompletion = useMobilityStore(s => s.logCompletion)
  const activeSession = useMobilityStore(s => s.activeSession)
  const startSession = useMobilityStore(s => s.startSession)
  const saveCheckpoint = useMobilityStore(s => s.saveCheckpoint)
  const clearSession = useMobilityStore(s => s.clearSession)
  const soundEnabled = useMobilityStore(s => s.soundEnabled)
  const setSoundEnabled = useMobilityStore(s => s.setSoundEnabled)

  // Validate checkpoint: must match today's date. The routine's exercises may
  // have been added/removed/reordered since the session started (e.g. via
  // "Manage routine") — reconcile() below re-maps progress onto the live
  // routine instead of discarding it.
  const cp: MobilitySessionCheckpoint | null =
    activeSession?.date === today ? activeSession : null
  const reconciled = cp ? reconcileCheckpoint(cp, routine) : null

  // Session state
  const [currentIdx, setCurrentIdx] = useState(reconciled?.currentIdx ?? 0)
  const [completedIds, setCompletedIds] = useState<string[]>(reconciled?.completedIds ?? [])
  const [phase, setPhase] = useState<Phase>('idle')
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [showJumpMenu, setShowJumpMenu] = useState(false)
  const [showSwitchCue, setShowSwitchCue] = useState(false)

  // Live display state (driven by 100ms tick)
  const [totalSec, setTotalSec] = useState(reconciled?.totalElapsedSec ?? 0)
  const [exSec, setExSec] = useState(reconciled?.exElapsedSec ?? 0)

  // Per-exercise duration adjustments (seconds added/removed), keyed by exercise id.
  // Lets the user scroll/drag the countdown to run an exercise longer or shorter.
  const [durationOverrides, setDurationOverrides] = useState<Record<string, number>>({})
  const overridesR = useRef<Record<string, number>>({})
  useEffect(() => { overridesR.current = durationOverrides }, [durationOverrides])

  // Wall-clock refs — never go stale in closures
  const totalR = useRef({ acc: reconciled?.totalElapsedSec ?? 0, at: Date.now() as number | null })
  const exR = useRef({ acc: reconciled?.exElapsedSec ?? 0, at: null as number | null })

  // Stale-closure-safe mirrors of state for interval + cleanup
  const phaseR = useRef<Phase>('idle')
  const idxR = useRef(reconciled?.currentIdx ?? 0)
  const doneR = useRef<string[]>(reconciled?.completedIds ?? [])
  const autoFiredR = useRef(false) // prevent double-fire when exercise timer hits 0
  const switchFiredR = useRef(false) // prevent double-fire of the bilateral switch cue
  const switchCueTimerR = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalizedR = useRef(false) // set once session is logged or discarded — skip resave on unmount
  const swipeStartR = useRef<{ x: number; y: number } | null>(null)
  const soundOnR = useRef(soundEnabled) // stale-closure-safe mirror for the interval

  useEffect(() => { phaseR.current = phase }, [phase])
  useEffect(() => { idxR.current = currentIdx }, [currentIdx])
  useEffect(() => { doneR.current = completedIds }, [completedIds])
  useEffect(() => { soundOnR.current = soundEnabled }, [soundEnabled])

  // Lock background scroll while the full-screen session view is open — prevents
  // the page behind it from scrolling/rubber-banding during timer drag gestures.
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [])

  // Snapshot the current wall-clock timers + progress into a resumable checkpoint.
  // Shared by the unmount cleanup and the explicit "close" action so a user can
  // step away mid-routine — even mid-exercise — and pick up later without losing
  // completed exercises or accumulated time.
  function _computeCheckpoint(): MobilitySessionCheckpoint {
    const now = Date.now()
    const te = totalR.current.at != null
      ? totalR.current.acc + (now - totalR.current.at) / 1000
      : totalR.current.acc
    const ee = exR.current.at != null
      ? exR.current.acc + (now - exR.current.at) / 1000
      : exR.current.acc
    return {
      date: today,
      exerciseIds: routine.map(e => e.id),
      currentIdx: idxR.current,
      completedIds: doneR.current,
      totalElapsedSec: Math.max(0, te),
      exElapsedSec: Math.max(0, ee),
    }
  }

  // ── Mount: init store session + start total timer ───────────────────────
  useEffect(() => {
    if (!cp) startSession(today, routine.map(e => e.id))
    totalR.current.at = Date.now() // total timer always starts running on open

    return () => {
      if (switchCueTimerR.current) clearTimeout(switchCueTimerR.current)
      // Unmount without an explicit close/log/discard → save a checkpoint so
      // the user can resume later, whether or not the last exercise finished.
      if (finalizedR.current) return
      saveCheckpoint(_computeCheckpoint())
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

      if (phaseR.current === 'exercising') {
        const cur = routine[idxR.current]
        if (cur) {
          const effDur = Math.max(5, cur.durationSec + (overridesR.current[cur.id] ?? 0))
          // Halfway cue for bilateral exercises — time to switch sides.
          if (
            !switchFiredR.current &&
            isBilateralExercise(cur) &&
            e >= effDur / 2 &&
            e < effDur
          ) {
            switchFiredR.current = true
            if (soundOnR.current) playSwitchSidesSound()
            flashSwitchCue()
          }
          // Auto-complete when exercise countdown hits zero.
          if (!autoFiredR.current && e >= effDur) {
            autoFiredR.current = true
            _markDone({ fromTimer: true })
          }
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

  // Briefly surface a "Switch sides" banner alongside the audio cue.
  function flashSwitchCue() {
    setShowSwitchCue(true)
    if (switchCueTimerR.current) clearTimeout(switchCueTimerR.current)
    switchCueTimerR.current = setTimeout(() => setShowSwitchCue(false), 2200)
  }

  // Jump to any exercise by index — used by Previous, swipe, and the jump menu.
  // Navigation never touches completedIds; only Mark Done does.
  function goToIndex(newIdx: number) {
    if (newIdx < 0 || newIdx >= routine.length) return
    _snapshotEx()
    exR.current = { acc: 0, at: null }
    autoFiredR.current = false
    switchFiredR.current = false
    setShowSwitchCue(false)
    idxR.current = newIdx
    setCurrentIdx(newIdx)
    setExSec(0)
    phaseR.current = 'idle'
    setPhase('idle')
  }

  function _markDone(opts?: { fromTimer?: boolean }) {
    _snapshotEx()
    const id = routine[idxR.current]?.id
    if (id && !doneR.current.includes(id)) {
      const next = [...doneR.current, id]
      doneR.current = next
      setCompletedIds(next)
    }
    if (idxR.current >= routine.length - 1) {
      if (soundOnR.current) playSessionCompleteSound()
      phaseR.current = 'finished'
      setPhase('finished')
    } else {
      // Chime only when the timer ran out on its own; a manual Mark Done is silent.
      if (opts?.fromTimer && soundOnR.current) playExerciseEndSound()
      goToIndex(idxR.current + 1)
    }
  }

  // ── User actions ─────────────────────────────────────────────────────────

  function handleStart() {
    // Warm the audio context from this user gesture so later cues can fire on iOS.
    if (soundEnabled) primeAudio()
    exR.current = { acc: exR.current.acc, at: Date.now() }
    autoFiredR.current = false
    // If resuming past the halfway point, don't fire a late switch cue.
    const cur = routine[idxR.current]
    const curEffDur = cur ? Math.max(5, cur.durationSec + (overridesR.current[cur.id] ?? 0)) : 0
    switchFiredR.current = !!cur && (!isBilateralExercise(cur) || exR.current.acc >= curEffDur / 2)
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

  // Close without finishing or discarding — saves a checkpoint so exercises
  // already done (and time already spent) aren't lost. Lets the user knock
  // out the routine bit by bit throughout the day instead of all at once.
  function handleClose() {
    finalizedR.current = true
    saveCheckpoint(_computeCheckpoint())
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
  const currentEffDuration = currentExercise
    ? Math.max(5, currentExercise.durationSec + (durationOverrides[currentExercise.id] ?? 0))
    : 0
  const exRemaining = currentExercise ? Math.max(0, currentEffDuration - exSec) : 0
  const currentLibInfo = currentExercise
    ? MOBILITY_LIBRARY.find(e => e.id === currentExercise.id)
    : undefined
  const currentBilateral = currentExercise ? isBilateralExercise(currentExercise) : false

  // ── Timer scroll/drag adjustment ────────────────────────────────────────
  const TIMER_ADJUST_STEP_SEC = 5
  const TIMER_MIN_SEC = 5
  const TIMER_MAX_SEC = 1800
  const timerDragR = useRef<{ startY: number; startOverride: number } | null>(null)

  function adjustCurrentDuration(deltaSec: number) {
    const cur = routine[idxR.current]
    if (!cur) return
    setDurationOverrides(prev => {
      const base = cur.durationSec + (prev[cur.id] ?? 0)
      const newTotal = Math.max(TIMER_MIN_SEC, Math.min(TIMER_MAX_SEC, base + deltaSec))
      return { ...prev, [cur.id]: newTotal - cur.durationSec }
    })
  }

  function handleTimerWheel(e: React.WheelEvent) {
    if (!currentExercise) return
    e.preventDefault()
    e.stopPropagation()
    const dir = e.deltaY < 0 ? 1 : -1 // scroll up → add time, scroll down → subtract time
    adjustCurrentDuration(dir * TIMER_ADJUST_STEP_SEC)
  }

  function handleTimerTouchStart(e: React.TouchEvent) {
    if (!currentExercise) return
    e.stopPropagation()
    timerDragR.current = { startY: e.touches[0].clientY, startOverride: overridesR.current[currentExercise.id] ?? 0 }
  }

  function handleTimerTouchMove(e: React.TouchEvent) {
    const drag = timerDragR.current
    const cur = routine[idxR.current]
    if (!drag || !cur) return
    e.stopPropagation()
    e.preventDefault()
    const PX_PER_SEC = 6
    const dy = drag.startY - e.touches[0].clientY // drag finger up → add time
    const deltaSec = Math.round(dy / PX_PER_SEC)
    const newTotal = Math.max(TIMER_MIN_SEC, Math.min(TIMER_MAX_SEC, cur.durationSec + drag.startOverride + deltaSec))
    setDurationOverrides(prev => ({ ...prev, [cur.id]: newTotal - cur.durationSec }))
  }

  function handleTimerTouchEnd(e: React.TouchEvent) {
    e.stopPropagation()
    timerDragR.current = null
  }

  // ── Render ───────────────────────────────────────────────────────────────

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
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            aria-label={soundEnabled ? 'Mute timer sounds' : 'Unmute timer sounds'}
            aria-pressed={soundEnabled}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
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
            onClick={handleClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            aria-label="Close — progress is saved, resume anytime"
            title="Close (progress saved)"
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

            {/* Exercise name + description */}
            <div className="space-y-1.5">
              <p className="text-xl font-bold text-white leading-snug px-2">
                {currentExercise?.name}
              </p>
              {currentBilateral && (
                <div className="flex items-center justify-center gap-1.5 pt-0.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-300 text-[11px] font-semibold">
                    <ArrowLeftRight size={12} />
                    Both sides — switch at halfway
                  </span>
                </div>
              )}
              {currentLibInfo?.description && (
                <p className="text-xs text-slate-500 leading-relaxed px-4">
                  {currentLibInfo.description}
                </p>
              )}
              {currentLibInfo?.note && (
                <div className="flex items-start justify-center gap-1.5 px-4 pt-1">
                  <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide mt-0.5 flex-shrink-0">
                    Note
                  </span>
                  <p className="text-xs text-amber-300/80 leading-relaxed text-left">
                    {currentLibInfo.note}
                  </p>
                </div>
              )}
            </div>

            {/* Countdown display */}
            <div className="space-y-3">
              {showSwitchCue && (
                <div className="flex items-center justify-center gap-2 text-fuchsia-300 animate-pulse">
                  <ArrowLeftRight size={18} />
                  <span className="text-lg font-bold uppercase tracking-wide">Switch sides!</span>
                </div>
              )}
              <p
                onWheel={handleTimerWheel}
                onTouchStart={handleTimerTouchStart}
                onTouchMove={handleTimerTouchMove}
                onTouchEnd={handleTimerTouchEnd}
                style={{ touchAction: 'none' }}
                className={`text-7xl font-mono font-bold tabular-nums leading-none transition-colors select-none cursor-ns-resize ${
                  phase === 'exercising'
                    ? showSwitchCue ? 'text-fuchsia-400' : exRemaining <= 10 ? 'text-amber-400' : 'text-sky-400'
                    : 'text-slate-500'
                }`}
              >
                {fmtTime(exRemaining)}
              </p>
              {currentExercise && (
                <p className="text-[10px] text-slate-600">Scroll to adjust time</p>
              )}

              {/* Progress bar — only visible while exercising */}
              <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-100 ${
                    phase === 'exercising' ? 'bg-sky-500' : 'bg-transparent'
                  }`}
                  style={{
                    width: currentExercise
                      ? `${Math.min(100, (exSec / currentEffDuration) * 100)}%`
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
