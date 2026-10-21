import { Play } from 'lucide-react'
import { Modal } from '../shared/Modal'
import { estimateRunDurationMin } from '../../lib/estimateRunDuration'
import type { SegmentKind, WorkoutSegment } from '../../lib/workoutSegments'

interface TodayNextSegmentModalProps {
  /** Segment just finished — drives the heading. */
  doneKind: SegmentKind
  next: WorkoutSegment
  programVars: Record<string, number>
  sessionDurationMin: number | null
  onStart: () => void
  onLater: () => void
}

const DONE_HEADING: Record<SegmentKind, string> = {
  weights: 'Nice work on the lifts!',
  cardio: 'Nice run!',
  mobility: 'Mobility done!',
}

function segmentDetail(next: WorkoutSegment, programVars: Record<string, number>): string {
  const { kind, slot } = next
  if (kind === 'cardio') {
    const miles = slot.runConfig?.targetDistanceMiles
    return `~${estimateRunDurationMin(slot, programVars)} min${miles ? ` · ${miles} mi target` : ''}`
  }
  const count = kind === 'mobility' ? slot.mobilityExercises?.length ?? 0 : slot.exercises?.length ?? 0
  return `${count} exercise${count === 1 ? '' : 's'}`
}

export function TodayNextSegmentModal({
  doneKind,
  next,
  programVars,
  sessionDurationMin,
  onStart,
  onLater,
}: TodayNextSegmentModalProps) {
  const name = next.slot.name
  return (
    <Modal title={DONE_HEADING[doneKind]} onClose={onLater}>
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-4 space-y-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Up next</p>
          <p className="text-sm font-semibold text-slate-200">{name}</p>
          <p className="text-xs text-slate-400">{segmentDetail(next, programVars)}</p>
        </div>
        <p className="text-xs text-slate-500">
          {sessionDurationMin ? `Your session is at ${sessionDurationMin} min. ` : ''}
          Start it now, or log what you've done and do it later from Today's card.
        </p>
        <div className="space-y-2">
          <button
            onClick={onStart}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm transition-colors"
          >
            <Play size={16} /> Start {name}
          </button>
          <button
            onClick={onLater}
            className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium transition-colors"
          >
            Log now — do it later
          </button>
        </div>
      </div>
    </Modal>
  )
}
