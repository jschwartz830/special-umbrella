import { CheckCircle2, Play, Plus, RotateCcw, Zap } from 'lucide-react'
import type { MobilityCompletion, MobilityExercise, MobilitySessionCheckpoint } from '../../store/mobilityStore'

interface TodayMobilitySectionProps {
  mobilityRoutine: MobilityExercise[]
  mobilityCompletion: MobilityCompletion | null
  mobilityInProgress: boolean
  mobilityActiveSession: MobilitySessionCheckpoint | null
  onUndoCompletion: () => void
  onOpenTracker: () => void
  onNavigate: () => void
}

export function TodayMobilitySection({
  mobilityRoutine,
  mobilityCompletion,
  mobilityInProgress,
  mobilityActiveSession,
  onUndoCompletion,
  onOpenTracker,
  onNavigate,
}: TodayMobilitySectionProps) {
  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Zap size={11} /> Mobility
      </h2>
      {mobilityRoutine.length === 0 ? (
        <button
          onClick={onNavigate}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-slate-700/60 text-slate-600 hover:text-slate-400 hover:border-slate-600 transition-colors text-xs"
        >
          <Plus size={13} />
          Set up daily mobility routine
        </button>
      ) : mobilityCompletion ? (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-teal-500/12 border border-teal-500/30">
          <CheckCircle2 size={14} className="text-teal-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-teal-200 font-medium">Mobility done</p>
            <p className="text-xs text-teal-300/60 mt-0.5">
              {mobilityCompletion.durationMin} min ·{' '}
              {mobilityCompletion.completedExerciseIds.length}/{mobilityRoutine.length} exercises
            </p>
          </div>
          <button
            onClick={onUndoCompletion}
            className="text-teal-400/50 hover:text-teal-200 transition-colors"
            aria-label="Undo mobility log"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      ) : mobilityInProgress ? (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-sky-500/12 border border-sky-500/30">
          <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-sky-200 font-medium">Mobility in progress</p>
            <p className="text-xs text-sky-300/60 mt-0.5">
              {mobilityActiveSession!.completedIds.length}/{mobilityRoutine.length} exercises done — pick up anytime
            </p>
          </div>
          <button
            onClick={onOpenTracker}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs transition-colors active:scale-[0.98] flex-shrink-0"
          >
            <Play size={13} /> Continue
          </button>
        </div>
      ) : (
        <button
          onClick={onOpenTracker}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 transition-colors active:scale-[0.99]"
        >
          <Zap size={14} className="text-teal-400 flex-shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm text-slate-300 font-medium">Daily Mobility</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {mobilityRoutine.length} exercise{mobilityRoutine.length === 1 ? '' : 's'} · ~{Math.ceil(mobilityRoutine.reduce((s, e) => s + e.durationSec, 0) / 60)} min
            </p>
          </div>
          <Play size={14} className="text-slate-500 flex-shrink-0" />
        </button>
      )}
    </section>
  )
}
