import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  X, ChevronDown, Play, Pause, ChevronRight, ChevronLeft,
  CheckCircle2, Timer, Gauge, Wind,
} from 'lucide-react'
import type { WorkoutSlot } from '../../types'
import type { RunSegment, RunSegmentType } from '../../types/program'

// ── Pace helpers ──────────────────────────────────────────────────────────────

interface PaceInfo {
  label: string
  mphRange?: [number, number]
}

function parsePaceInfo(pace: string | undefined): PaceInfo {
  if (!pace) return { label: 'Comfortable effort' }

  const NAMED: Record<string, PaceInfo> = {
    easy:       { label: 'Easy',                mphRange: [5.0, 6.5] },
    'walk/jog': { label: 'Walk / Jog',          mphRange: [2.5, 4.5] },
    walk:       { label: 'Walk',                mphRange: [2.0, 3.5] },
    tempo:      { label: 'Tempo',               mphRange: [7.0, 8.5] },
    '5K':       { label: '5K Pace',             mphRange: [7.5, 10.0] },
    '10K':      { label: '10K Pace',            mphRange: [7.0, 9.0] },
    race_pace:  { label: 'Race Pace' },
    marathon:   { label: 'Marathon Pace',        mphRange: [6.0, 7.5] },
    half:       { label: 'Half Marathon Pace',   mphRange: [6.5, 8.0] },
  }
  if (NAMED[pace]) return NAMED[pace]

  // Range "MM:SS-MM:SS/mi"
  const rangeMatch = pace.match(/(\d+):(\d{2})\s*-\s*(\d+):(\d{2})\/mi/)
  if (rangeMatch) {
    const slowMin = parseInt(rangeMatch[1]) + parseInt(rangeMatch[2]) / 60
    const fastMin = parseInt(rangeMatch[3]) + parseInt(rangeMatch[4]) / 60
    const fastMph = +(60 / Math.min(slowMin, fastMin)).toFixed(1)
    const slowMph = +(60 / Math.max(slowMin, fastMin)).toFixed(1)
    return { label: pace, mphRange: [slowMph, fastMph] }
  }

  // Single "MM:SS/mi"
  const singleMatch = pace.match(/(\d+):(\d{2})\/mi/)
  if (singleMatch) {
    const minPerMile = parseInt(singleMatch[1]) + parseInt(singleMatch[2]) / 60
    const mph = +(60 / minPerMile).toFixed(1)
    return { label: pace, mphRange: [Math.max(0.1, +(mph - 0.3).toFixed(1)), +(mph + 0.3).toFixed(1)] }
  }

  return { label: pace }
}

// ── Duration helpers ──────────────────────────────────────────────────────────

function parseDurationToSeconds(dur: string | undefined): number | null {
  if (!dur) return null
  const mMatch = dur.match(/^(\d+(?:\.\d+)?)\s*m(?:in)?$/)
  if (mMatch) return Math.round(parseFloat(mMatch[1]) * 60)
  const sMatch = dur.match(/^(\d+(?:\.\d+)?)\s*s(?:ec)?$/)
  if (sMatch) return Math.round(parseFloat(sMatch[1]))
  return null
}

function resolveDistanceExpr(expr: string | undefined, vars: Record<string, number>): string | null {
  if (!expr) return null
  const resolved = expr.replace(/\b([a-zA-Z_]\w*)\b/g, (match) =>
    vars[match] !== undefined ? vars[match].toString() : match,
  )
  return resolved
}

function formatSeconds(s: number): string {
  const total = Math.max(0, Math.floor(s))
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return `${mins}:${String(secs).padStart(2, '0')}`
}

// ── Segment type display ──────────────────────────────────────────────────────

const SEGMENT_CONFIG: Record<RunSegmentType, { label: string; color: string; barColor: string; dotColor: string }> = {
  warmup:    { label: 'Warm-Up',   color: 'text-amber-400',  barColor: 'bg-amber-400',  dotColor: 'bg-amber-400' },
  easy:      { label: 'Easy',      color: 'text-green-400',  barColor: 'bg-green-400',  dotColor: 'bg-green-400' },
  tempo:     { label: 'Tempo',     color: 'text-orange-400', barColor: 'bg-orange-400', dotColor: 'bg-orange-400' },
  interval:  { label: 'Interval',  color: 'text-red-400',    barColor: 'bg-red-400',    dotColor: 'bg-red-400' },
  race_pace: { label: 'Race Pace', color: 'text-purple-400', barColor: 'bg-purple-400', dotColor: 'bg-purple-400' },
  cooldown:  { label: 'Cool-Down', color: 'text-sky-400',    barColor: 'bg-sky-400',    dotColor: 'bg-sky-400' },
  drills:    { label: 'Drills',    color: 'text-cyan-400',   barColor: 'bg-cyan-400',   dotColor: 'bg-cyan-400' },
  rest:      { label: 'Rest',      color: 'text-slate-400',  barColor: 'bg-slate-500',  dotColor: 'bg-slate-500' },
}

function segmentCfg(type: RunSegmentType | undefined) {
  return SEGMENT_CONFIG[type ?? 'easy'] ?? SEGMENT_CONFIG.easy
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CardioWorkoutTrackerProps {
  slot: WorkoutSlot
  programVars?: Record<string, number>
  minimized: boolean
  onMinimize: () => void
  onResume: () => void
  onComplete: (durationMin: number) => void
  onCancel: () => void
}

export function CardioWorkoutTracker({
  slot,
  programVars = {},
  minimized,
  onMinimize,
  onResume,
  onComplete,
  onCancel,
}: CardioWorkoutTrackerProps) {
  const effectiveSegments: RunSegment[] = useMemo(() => {
    if (slot.segments && slot.segments.length > 0) return slot.segments
    const dur = slot.durationMin ?? slot.runConfig?.targetDurationMin
    const dist = slot.runConfig?.targetDistanceMiles
    return [{
      type: 'easy' as RunSegmentType,
      name: slot.name,
      duration: dur ? `${dur}m` : undefined,
      distance: dist ? `${dist} mi` : undefined,
    }]
  }, [slot])

  const [segmentIdx, setSegmentIdx] = useState(0)
  const [segmentElapsed, setSegmentElapsed] = useState(0)
  const [totalElapsed, setTotalElapsed] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setTotalElapsed(s => s + 1)
      setSegmentElapsed(s => s + 1)
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isPaused])

  const seg = effectiveSegments[segmentIdx]
  const cfg = segmentCfg(seg?.type)
  const segDurSec = parseDurationToSeconds(seg?.duration)
  const segRemaining = segDurSec !== null ? Math.max(0, segDurSec - segmentElapsed) : null
  const resolvedDist = resolveDistanceExpr(seg?.distance, programVars)
  const paceInfo = parsePaceInfo(seg?.pace)
  const isLast = segmentIdx === effectiveSegments.length - 1

  const goNext = useCallback(() => {
    if (!isLast) {
      setSegmentIdx(i => i + 1)
      setSegmentElapsed(0)
    } else {
      onComplete(Math.round(totalElapsed / 60))
    }
  }, [isLast, totalElapsed, onComplete])

  const goPrev = useCallback(() => {
    if (segmentIdx > 0) {
      setSegmentIdx(i => i - 1)
      setSegmentElapsed(0)
    }
  }, [segmentIdx])

  const finish = useCallback(() => {
    onComplete(Math.round(totalElapsed / 60))
  }, [totalElapsed, onComplete])

  // ── Minimized banner ────────────────────────────────────────────────────────
  if (minimized) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <button
          onClick={onResume}
          className="w-full flex items-center gap-3 px-4 py-3 bg-slate-900 border-t border-slate-700"
        >
          <span className={`w-2 h-2 rounded-full ${cfg.dotColor} flex-shrink-0 animate-pulse`} />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-slate-200 truncate">{slot.name}</p>
            <p className={`text-xs ${cfg.color} truncate`}>{cfg.label}</p>
          </div>
          <span className="text-sm font-mono text-slate-400 tabular-nums flex-shrink-0">{formatSeconds(totalElapsed)}</span>
          <ChevronDown size={16} className="text-slate-500 flex-shrink-0 -rotate-180" />
        </button>
      </div>
    )
  }

  // ── Full screen ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 overflow-y-auto">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pb-3 border-b border-slate-800 flex-shrink-0"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}
      >
        <button
          onClick={onMinimize}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ChevronDown size={18} />
          <span className="text-sm">Minimize</span>
        </button>
        <p className="text-sm font-semibold text-slate-200 truncate mx-4 flex-1 text-center">{slot.name}</p>
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-red-400 transition-colors p-1"
          aria-label="End cardio"
        >
          <X size={20} />
        </button>
      </div>

      {/* Segment progress pills */}
      {effectiveSegments.length > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 flex-shrink-0">
          {effectiveSegments.map((s, i) => {
            const c = segmentCfg(s.type)
            return (
              <button
                key={i}
                onClick={() => { setSegmentIdx(i); setSegmentElapsed(0) }}
                className={`transition-all rounded-full ${
                  i === segmentIdx
                    ? `h-2.5 w-6 ${c.dotColor}`
                    : i < segmentIdx
                    ? `h-2.5 w-2.5 ${c.dotColor} opacity-50`
                    : 'h-2.5 w-2.5 bg-slate-700'
                }`}
                title={segmentCfg(s.type).label}
              />
            )
          })}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col gap-5 px-4 py-4">
        {/* Total elapsed clock */}
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total time</p>
          <p className="text-5xl font-mono font-bold text-slate-100 tabular-nums">{formatSeconds(totalElapsed)}</p>
        </div>

        {/* Current segment card */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          {/* Segment label */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
            {seg?.name && seg.name !== slot.name && (
              <span className="text-xs text-slate-500">· {seg.name}</span>
            )}
            <span className="ml-auto text-xs text-slate-600">
              {segmentIdx + 1} / {effectiveSegments.length}
            </span>
          </div>

          {/* Target: distance or duration */}
          {(resolvedDist || segDurSec !== null) && (
            <div className="flex items-center gap-2">
              {resolvedDist
                ? <Wind size={15} className="text-slate-500 flex-shrink-0" />
                : <Timer size={15} className="text-slate-500 flex-shrink-0" />
              }
              <span className="text-2xl font-semibold text-slate-100">
                {resolvedDist ?? formatSeconds(segDurSec!)}
              </span>
            </div>
          )}

          {/* Pace + treadmill speed */}
          {paceInfo.label !== 'Comfortable effort' && (
            <div className="flex items-start gap-2 pt-2 border-t border-slate-800">
              <Gauge size={14} className="text-slate-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-slate-400">{paceInfo.label}</p>
                {paceInfo.mphRange && (
                  <p className="text-xl font-semibold text-sky-400 tabular-nums">
                    {paceInfo.mphRange[0]}–{paceInfo.mphRange[1]} mph
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Drills list */}
          {seg?.type === 'drills' && seg.drills && seg.drills.length > 0 && (
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              {seg.drills.map((drill, di) => (
                <div key={di} className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                  <span>{drill.name}</span>
                  {drill.sets && <span className="text-slate-500 text-xs">× {drill.sets}</span>}
                  {drill.duration && <span className="text-slate-500 text-xs">{drill.duration}</span>}
                  {drill.reps && <span className="text-slate-500 text-xs">{drill.reps} reps</span>}
                </div>
              ))}
            </div>
          )}

          {/* Segment timer / progress bar */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            {segDurSec !== null ? (
              <>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Elapsed</span>
                  <span>Remaining</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-mono text-slate-300 tabular-nums">{formatSeconds(segmentElapsed)}</span>
                  <span className={`text-xl font-mono tabular-nums ${segRemaining === 0 ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
                    {formatSeconds(segRemaining ?? 0)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${cfg.barColor}`}
                    style={{ width: `${Math.min(100, (segmentElapsed / segDurSec) * 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Segment elapsed</span>
                <span className="text-xl font-mono text-slate-300 tabular-nums">{formatSeconds(segmentElapsed)}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {seg?.notes && (
            <p className="text-xs text-slate-500 italic pt-1 border-t border-slate-800">{seg.notes}</p>
          )}
        </div>

        {/* Slot notes */}
        {(slot as { notes?: string }).notes && (
          <p className="text-xs text-slate-600 italic px-1">{(slot as { notes?: string }).notes}</p>
        )}

        {/* Segment nav + pause */}
        <div className="flex items-center gap-3">
          <button
            onClick={goPrev}
            disabled={segmentIdx === 0}
            className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            <ChevronLeft size={15} /> Prev
          </button>

          <button
            onClick={() => setIsPaused(p => !p)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 text-sm font-medium transition-colors"
          >
            {isPaused ? <><Play size={15} /> Resume</> : <><Pause size={15} /> Pause</>}
          </button>

          <button
            onClick={goNext}
            className={`flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isLast
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isLast ? <><CheckCircle2 size={15} /> Done</> : <>Next <ChevronRight size={15} /></>}
          </button>
        </div>

        {/* Finish early */}
        <button
          onClick={finish}
          className="w-full py-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 text-emerald-400 font-semibold text-sm transition-colors"
        >
          Finish Workout · {formatSeconds(totalElapsed)}
        </button>
      </div>
    </div>
  )
}
