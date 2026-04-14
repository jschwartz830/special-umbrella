import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CheckCircle2, SkipForward, Coffee, Pencil, Trash2, X } from 'lucide-react'
import { useHistoryStore } from '../store/historyStore'
import { usePlanStore } from '../store/planStore'
import { Modal } from '../components/shared/Modal'
import { EmptyState } from '../components/shared/EmptyState'
import type { ActionType, HistoryEntry } from '../types'

export function HistoryPage() {
  const plans = usePlanStore(s => s.plans)
  const entries = useHistoryStore(s => s.entries)
  const updateNotes = useHistoryStore(s => s.updateEntryNotes)
  const updateAction = useHistoryStore(s => s.updateEntryAction)
  const removeEntry = useHistoryStore(s => s.removeEntry)

  const [editingEntry, setEditingEntry] = useState<HistoryEntry | null>(null)
  const [notesText, setNotesText] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Sort entries newest first
  const sorted = [...entries].sort((a, b) => b.calendarDate.localeCompare(a.calendarDate))

  function openEdit(entry: HistoryEntry) {
    setNotesText(entry.notes ?? '')
    setEditingEntry(entry)
  }

  function saveAndClose() {
    if (!editingEntry) return
    updateNotes(editingEntry.id, notesText)
    setEditingEntry(null)
  }

  function changeAction(action: ActionType) {
    if (!editingEntry) return
    updateAction(editingEntry.planId, editingEntry.calendarDate, action)
    setEditingEntry(prev => prev ? { ...prev, action } : null)
  }

  function deleteEntry(entry: HistoryEntry) {
    removeEntry(entry.planId, entry.calendarDate)
    setConfirmDeleteId(null)
    setEditingEntry(null)
  }

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
                    onClick={() => openEdit(entry)}
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

      {/* Edit modal */}
      {editingEntry && (
        <Modal
          title={format(parseISO(editingEntry.calendarDate), 'EEE, MMM d, yyyy')}
          onClose={saveAndClose}
          footer={
            <button
              onClick={saveAndClose}
              className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold transition-colors"
            >
              Save
            </button>
          }
        >
          <div className="space-y-4">
            {/* Change action */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Status</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => changeAction('complete')}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                    editingEntry.action === 'complete'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                  }`}
                >
                  <CheckCircle2 size={16} />
                  Complete
                </button>
                <button
                  onClick={() => changeAction('skip')}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                    editingEntry.action === 'skip'
                      ? 'bg-slate-600 border-slate-500 text-slate-200'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                  }`}
                >
                  <SkipForward size={16} />
                  Skip
                </button>
                <button
                  onClick={() => changeAction('day_off')}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                    editingEntry.action === 'day_off'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                  }`}
                >
                  <Coffee size={16} />
                  Day Off
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Notes</p>
              <textarea
                value={notesText}
                onChange={e => setNotesText(e.target.value)}
                placeholder="Add notes..."
                rows={3}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              />
            </div>

            {/* Delete */}
            <button
              onClick={() => setConfirmDeleteId(editingEntry.id)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-colors"
            >
              <Trash2 size={15} /> Delete entry
            </button>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {confirmDeleteId && editingEntry && (
        <Modal title="Delete entry?" onClose={() => setConfirmDeleteId(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              This will permanently remove this logged day. The rotation will treat that day as if nothing was recorded.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold transition-colors"
              >
                <X size={14} className="inline mr-1" />Cancel
              </button>
              <button
                onClick={() => deleteEntry(editingEntry)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
