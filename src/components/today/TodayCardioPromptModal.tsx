import { Play } from 'lucide-react'
import { Modal } from '../shared/Modal'
import { estimateRunDurationMin } from '../../lib/estimateRunDuration'
import type { WorkoutSlot } from '../../types'

interface TodayCardioPromptModalProps {
  runSlot: WorkoutSlot
  programVars: Record<string, number>
  activeTrackedDurationMin: number | null
  onStart: () => void
  onCancel: () => void
}

export function TodayCardioPromptModal({
  runSlot,
  programVars,
  activeTrackedDurationMin,
  onStart,
  onCancel,
}: TodayCardioPromptModalProps) {
  const runEst = estimateRunDurationMin(runSlot, programVars)
  return (
    <Modal title="Nice work on the lifts!" onClose={onCancel}>
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-4 space-y-1">
          <p className="text-sm font-semibold text-slate-200">{runSlot.name}</p>
          <p className="text-xs text-slate-400">~{runEst} min · scheduled cardio for today</p>
          {runSlot.runConfig?.targetDistanceMiles && (
            <p className="text-xs text-slate-500">{runSlot.runConfig.targetDistanceMiles} mi target</p>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Your session is already at {activeTrackedDurationMin ?? '?'} min.
          Start the run now, or skip it and log the lifts.
        </p>
        <div className="space-y-2">
          <button
            onClick={onStart}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm transition-colors"
          >
            <Play size={16} /> Start {runSlot.name}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium transition-colors"
          >
            Skip run — log lifts only
          </button>
        </div>
      </div>
    </Modal>
  )
}
