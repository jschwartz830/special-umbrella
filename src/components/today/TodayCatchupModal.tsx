import { Coffee } from 'lucide-react'
import { Modal } from '../shared/Modal'

interface TodayCatchupModalProps {
  unloggedDates: string[]
  onConfirm: () => void
  onClose: () => void
}

export function TodayCatchupModal({ unloggedDates, onConfirm, onClose }: TodayCatchupModalProps) {
  return (
    <Modal title="Mark as Day Off?" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          The following {unloggedDates.length} day{unloggedDates.length === 1 ? '' : 's'} (past 2 weeks) will be marked as Day Off.
          The rotation will continue from today.
        </p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {unloggedDates.map(date => (
            <div key={date} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-sm text-slate-300">
              <Coffee size={13} className="text-amber-400 flex-shrink-0" />
              {new Date(date + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-sm rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-medium transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  )
}
