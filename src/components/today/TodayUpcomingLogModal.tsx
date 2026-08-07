import { SkipForward, Coffee, CheckCircle2, Info } from 'lucide-react'
import { Modal } from '../shared/Modal'
import type { ResolvedDay } from '../../types'

interface TodayUpcomingLogModalProps {
  resolvedDay: ResolvedDay
  error: string | null
  onLog: (action: 'complete' | 'skip' | 'day_off') => void
  onClose: () => void
}

export function TodayUpcomingLogModal({
  resolvedDay,
  error,
  onLog,
  onClose,
}: TodayUpcomingLogModalProps) {
  const title = new Date(resolvedDay.calendarDate + 'T00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          {resolvedDay.planDay.slots.map(slot => (
            <div key={slot.id} className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-200">{slot.name}</span>
              {slot.targetDistance && (
                <span className="text-xs text-slate-500 ml-auto">{slot.targetDistance} mi</span>
              )}
              {slot.targetTime && !slot.targetDistance && (
                <span className="text-xs text-slate-500 ml-auto">{slot.targetTime} min</span>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <Info size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onLog('complete')}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium transition-colors active:scale-95"
            >
              <CheckCircle2 size={16} /> Complete
            </button>
            <button
              onClick={() => onLog('skip')}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 text-sm font-medium transition-colors active:scale-95"
            >
              <SkipForward size={16} /> Skip
            </button>
          </div>
          <button
            onClick={() => onLog('day_off')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium transition-colors active:scale-95"
          >
            <Coffee size={16} /> Day Off
          </button>
        </div>
      </div>
    </Modal>
  )
}
