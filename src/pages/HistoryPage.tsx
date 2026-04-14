import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CheckCircle2, SkipForward, Coffee, Pencil } from 'lucide-react'
import { useHistoryStore } from '../store/historyStore'
import { usePlanStore } from '../store/planStore'
import { Modal } from '../components/shared/Modal'
import { EmptyState } from '../components/shared/EmptyState'

export function HistoryPage() {
  const plans = usePlanStore(s => s.plans)
  const entries = useHistoryStore(s => s.entries)
  const updateNotes = useHistoryStore(s => s.updateEntryNotes)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [notesText, setNotesText] = useState('')

  // Sort entries newest first
  const sorted = [...entries].sort((a, b) => b.calendarDate.localeCompare(a.calendarDate))

  if (sorted.length === 0) {
    return (
      <div className="px-4 pt-safe">
        <div className="pt-6 pb-4">
          <h1 className="text-2xl font-bold text-white">History</h1>
        </div>
        <EmptyState
          title="No history yet"
          description="Complete or skip workouts to build your history."
        />
      </div>
    )
  }

  const editingEntry = editingId ? entries.find(e => e.id === editingId) : null

  function openEdit(id: string) {
    const entry = entries.find(e => e.id === id)
    if (!entry) return
    setNotesText(entry.notes ?? '')
    setEditingId(id)
  }

  function saveNotes() {
    if (!editingId) return
    updateNotes(editingId, notesText)
    setEditingId(null)
  }

  return (
    <div className="px-4 pt-safe">
      <div className="pt-6 pb-4">
        <h1 className="text-2xl font-bold text-white">History</h1>
        <p className="text-sm text-slate-400 mt-0.5">{sorted.length} logged days</p>
      </div>

      <div className="space-y-2 pb-4">
        {sorted.map(entry => {
          const plan = plans[entry.planId]
          const planDay = plan?.days.find((_, idx) => idx === entry.planDayIndex)

          const actionIcon =
            entry.action === 'complete' ? (
              <CheckCircle2 size={18} className="text-emerald-400" />
            ) : entry.action === 'skip' ? (
              <SkipForward size={18} className="text-slate-500" />
            ) : (
              <Coffee size={18} className="text-amber-400" />
            )

          const actionColor =
            entry.action === 'complete'
              ? 'text-emerald-400'
              : entry.action === 'skip'
                ? 'text-slate-400'
                : 'text-amber-400'

          return (
            <div
              key={entry.id}
              className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {actionIcon}
                    <div>
                      <p className="text-xs text-slate-500 font-medium">
                        {format(parseISO(entry.calendarDate), 'EEE, MMM d, yyyy')}
                      </p>
                      <p className="text-sm font-semibold text-slate-200">
                        {planDay?.label ?? (entry.action === 'day_off' ? 'Day Off' : 'Unknown day')}
                      </p>
                    </div>
                  </div>

                  {planDay && (
                    <p className="text-xs text-slate-500 mt-1 ml-6">
                      {planDay.slots.map(s => s.name).join(' + ')} · {plan?.name}
                    </p>
                  )}

                  {entry.notes && (
                    <p className="text-sm text-slate-400 italic mt-2 ml-6">"{entry.notes}"</p>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className={`text-xs font-medium capitalize ${actionColor}`}>
                    {entry.action.replace('_', ' ')}
                  </span>
                  <button
                    onClick={() => openEdit(entry.id)}
                    className="ml-1 p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit notes modal */}
      {editingId && editingEntry && (
        <Modal
          title="Edit notes"
          onClose={() => setEditingId(null)}
          footer={
            <button
              onClick={saveNotes}
              className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold transition-colors"
            >
              Save
            </button>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              {format(parseISO(editingEntry.calendarDate), 'EEE, MMM d')} ·{' '}
              <span className="capitalize">{editingEntry.action.replace('_', ' ')}</span>
            </p>
            <textarea
              autoFocus
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="Add notes..."
              rows={4}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
