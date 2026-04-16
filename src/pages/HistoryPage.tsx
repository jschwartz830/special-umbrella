import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  CheckCircle2,
  MinusCircle,
  SkipForward,
  Coffee,
  Pause,
  Shuffle,
  Pencil,
  Trash2,
  X,
  Ruler,
  Zap,
  Timer,
  Clock3,
} from 'lucide-react'
import { useHistoryStore } from '../store/historyStore'
import { usePlanStore } from '../store/planStore'
import { useOutcomeStore, makeWorkoutInstanceId } from '../store/outcomeStore'
import { isRunType } from '../modules/workout-metadata/types'
import { Modal } from '../components/shared/Modal'
import { DifficultyBadge } from '../components/workout/DifficultyBadge'
import { EmptyState } from '../components/shared/EmptyState'
import type { HistoryEntry } from '../types'
import type { WorkoutOutcome, WorkoutCompletionState, PerceivedEffort } from '../modules/workout-outcomes/types'
import {
  COMPLETION_STATE_LABELS,
  formatPace,
  derivePaceSecondsPerMile,
} from '../modules/workout-outcomes/types'

export function HistoryPage() {
  const plans = usePlanStore(s => s.plans)
  const entries = useHistoryStore(s => s.entries)
  const updateNotes = useHistoryStore(s => s.updateEntryNotes)
  const updateAction = useHistoryStore(s => s.updateEntryAction)
  const removeEntry = useHistoryStore(s => s.removeEntry)
  const outcomes = useOutcomeStore(s => s.outcomes)
  const updateOutcome = useOutcomeStore(s => s.updateOutcome)

  const [editingEntry, setEditingEntry] = useState<HistoryEntry | null>(null)
  const [notesText, setNotesText] = useState('')
  const [editCompletionState, setEditCompletionState] = useState<WorkoutCompletionState>('completed')
  const [editEffort, setEditEffort] = useState<PerceivedEffort | null>(null)
  const [editDurationMin, setEditDurationMin] = useState('')
  const [editDistanceMiles, setEditDistanceMiles] = useState('')
  const [editRunDurationMin, setEditRunDurationMin] = useState('')
  const [editCompletedAsPlanned, setEditCompletedAsPlanned] = useState<boolean | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [filterPlanId, setFilterPlanId] = useState<string | 'all'>('all')

  const EFFORT_LABELS: Record<PerceivedEffort, string> = {
    1: 'Very Easy', 2: 'Easy', 3: 'Moderate', 4: 'Hard', 5: 'Max Effort',
  }

  // Plans that actually have history entries (for the filter dropdown)
  const plansWithHistory = Object.values(plans).filter(p =>
    entries.some(e => e.planId === p.id),
  )
  const showPlanFilter = plansWithHistory.length > 1

  // Sort entries newest first, then apply plan filter
  const sorted = [...entries]
    .sort((a, b) => b.calendarDate.localeCompare(a.calendarDate))
    .filter(e => filterPlanId === 'all' || e.planId === filterPlanId)

  function getOutcome(entry: HistoryEntry): WorkoutOutcome | null {
    const id = makeWorkoutInstanceId(entry.planId, entry.calendarDate)
    return outcomes[id] ?? null
  }

  function openEdit(entry: HistoryEntry) {
    const instanceId = makeWorkoutInstanceId(entry.planId, entry.calendarDate)
    const existing = outcomes[instanceId] ?? null
    setNotesText(entry.notes ?? '')
    setEditCompletionState(
      existing?.completionState === 'partially_completed' ? 'partially_completed' : 'completed',
    )
    setEditEffort(existing?.perceivedEffort ?? null)
    setEditDurationMin(existing?.durationActualMin?.toString() ?? '')
    setEditDistanceMiles(existing?.runActual?.actualDistanceMiles?.toString() ?? '')
    setEditRunDurationMin(existing?.runActual?.actualDurationMin?.toString() ?? '')
    setEditCompletedAsPlanned(existing?.runActual?.completedAsPlanned ?? null)
    setEditingEntry(entry)
  }

  function saveAndClose() {
    if (!editingEntry) return

    // Sync notes and ensure action is 'complete'
    updateNotes(editingEntry.id, notesText)
    updateAction(editingEntry.planId, editingEntry.calendarDate, 'complete')

    const instanceId = makeWorkoutInstanceId(editingEntry.planId, editingEntry.calendarDate)
    const planDay = plans[editingEntry.planId]?.days[editingEntry.planDayIndex ?? -1] ?? null
    const hasRun = planDay?.slots.some(s => isRunType(s.type)) ?? false

    const dist = parseFloat(editDistanceMiles)
    const runDur = parseFloat(editRunDurationMin)
    const derivedPace =
      isFinite(dist) && dist > 0 && isFinite(runDur) && runDur > 0
        ? derivePaceSecondsPerMile(dist, runDur)
        : null

    updateOutcome(instanceId, {
      completionState: editCompletionState,
      completedAt: outcomes[instanceId]?.completedAt ?? new Date().toISOString(),
      perceivedEffort: editEffort,
      durationActualMin: parseFloat(editDurationMin) || null,
      notes: notesText.trim() || null,
      runActual: hasRun
        ? {
            actualDistanceMiles: isFinite(dist) && dist > 0 ? dist : null,
            actualDurationMin: isFinite(runDur) && runDur > 0 ? runDur : null,
            averagePaceSecondsPerMile: derivedPace,
            completedAsPlanned: editCompletedAsPlanned,
          }
        : null,
    })

    setEditingEntry(null)
  }

  function deleteEntry(entry: HistoryEntry) {
    removeEntry(entry.planId, entry.calendarDate)
    setConfirmDeleteId(null)
    setEditingEntry(null)
  }

  if (entries.length === 0) {
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

  // Derived values used in the edit modal
  const editingPlanDay = editingEntry
    ? (plans[editingEntry.planId]?.days[editingEntry.planDayIndex ?? -1] ?? null)
    : null
  const editingHasRun = editingPlanDay?.slots.some(s => isRunType(s.type)) ?? false
  const editDist = parseFloat(editDistanceMiles)
  const editRunDur = parseFloat(editRunDurationMin)
  const editDerivedPace =
    isFinite(editDist) && editDist > 0 && isFinite(editRunDur) && editRunDur > 0
      ? derivePaceSecondsPerMile(editDist, editRunDur)
      : null

  return (
    <div className="px-4 pt-safe">
      <div className="pt-6 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-white">History</h1>
            <p className="text-sm text-slate-400 mt-0.5">{sorted.length} logged days</p>
          </div>
          {showPlanFilter && (
            <select
              value={filterPlanId}
              onChange={e => setFilterPlanId(e.target.value)}
              className="mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500 max-w-[140px] truncate"
            >
              <option value="all">All plans</option>
              {plansWithHistory.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {sorted.length === 0 && filterPlanId !== 'all' && (
        <p className="text-sm text-slate-500 text-center py-8">
          No entries for this plan.
        </p>
      )}

      <div className="space-y-2 pb-4">
        {sorted.map(entry => {
          const plan = plans[entry.planId]
          const planDay = plan?.days.find((_, idx) => idx === entry.planDayIndex)
          const outcome = getOutcome(entry)
          const completionState = outcome?.completionState ?? null

          // Icon and colour based on richer completion state if available
          const actionIcon = completionState === 'partially_completed'
            ? <MinusCircle size={18} className="text-yellow-400" />
            : completionState === 'deferred'
              ? <Pause size={18} className="text-purple-400" />
              : completionState === 'swapped'
                ? <Shuffle size={18} className="text-sky-400" />
                : entry.action === 'complete'
                  ? <CheckCircle2 size={18} className="text-emerald-400" />
                  : entry.action === 'skip'
                    ? <SkipForward size={18} className="text-slate-500" />
                    : <Coffee size={18} className="text-amber-400" />

          const actionColor = completionState === 'partially_completed'
            ? 'text-yellow-400'
            : completionState === 'deferred'
              ? 'text-purple-400'
              : completionState === 'swapped'
                ? 'text-sky-400'
                : entry.action === 'complete'
                  ? 'text-emerald-400'
                  : entry.action === 'skip'
                    ? 'text-slate-400'
                    : 'text-amber-400'

          const stateLabel =
            completionState === 'partially_completed' ? 'Partially Completed'
            : completionState === 'deferred' ? 'Deferred'
            : completionState === 'swapped' ? 'Swapped'
            : entry.action === 'complete' ? 'Completed'
            : entry.action === 'skip' ? 'Skipped'
            : 'Day Off'

          return (
            <div
              key={entry.id}
              className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {actionIcon}
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 font-medium">
                        {format(parseISO(entry.calendarDate), 'EEE, MMM d, yyyy')}
                      </p>
                      <p className="text-sm font-semibold text-slate-200">
                        {planDay?.label ?? (entry.action === 'day_off' ? 'Day Off' : 'Unknown day')}
                      </p>
                    </div>
                  </div>

                  {/* Slot name + plan name + difficulty badges */}
                  {planDay && (
                    <div className="mt-1 ml-6">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-xs text-slate-500">
                          {planDay.slots.map(s => s.name).join(' + ')} · {plan?.name}
                        </p>
                        {planDay.slots.map(s => s.difficulty && (
                          <DifficultyBadge key={s.id} difficulty={s.difficulty} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Outcome actuals */}
                  {outcome && (
                    <div className="mt-2 ml-6 space-y-1">
                      {/* Effort */}
                      {outcome.perceivedEffort != null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">Effort:</span>
                          <div className="flex gap-0.5">
                            {([1,2,3,4,5] as const).map(e => (
                              <span
                                key={e}
                                className={`w-3 h-3 rounded-full ${
                                  e <= outcome.perceivedEffort!
                                    ? e <= 2
                                      ? 'bg-emerald-400'
                                      : e === 3
                                        ? 'bg-yellow-400'
                                        : e === 4
                                          ? 'bg-orange-400'
                                          : 'bg-red-400'
                                    : 'bg-slate-600'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-slate-500">{outcome.perceivedEffort}/5</span>
                        </div>
                      )}

                      {/* Run actuals */}
                      {outcome.runActual && (
                        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                          {outcome.runActual.actualDistanceMiles != null && (
                            <span className="flex items-center gap-0.5">
                              <Ruler size={10} /> {outcome.runActual.actualDistanceMiles} mi
                            </span>
                          )}
                          {outcome.runActual.actualDurationMin != null && (
                            <span className="flex items-center gap-0.5">
                              <Timer size={10} /> {outcome.runActual.actualDurationMin} min
                            </span>
                          )}
                          {outcome.runActual.averagePaceSecondsPerMile != null && (
                            <span className="flex items-center gap-0.5">
                              <Zap size={10} /> {formatPace(outcome.runActual.averagePaceSecondsPerMile)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Duration actual (non-run) */}
                      {!outcome.runActual && outcome.durationActualMin != null && (
                        <p className="text-xs text-slate-500">
                          {outcome.durationActualMin} min
                        </p>
                      )}
                    </div>
                  )}

                  {entry.notes && (
                    <p className="text-sm text-slate-400 italic mt-2 ml-6">"{entry.notes}"</p>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className={`text-xs font-medium capitalize ${actionColor}`}>
                    {stateLabel}
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
            {/* Completion state */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Status</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setEditCompletionState('completed')}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                    editCompletionState === 'completed'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                  }`}
                >
                  <CheckCircle2 size={16} />
                  Completed
                </button>
                <button
                  onClick={() => setEditCompletionState('partially_completed')}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                    editCompletionState === 'partially_completed'
                      ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                  }`}
                >
                  <MinusCircle size={16} />
                  Partial
                </button>
              </div>
            </div>

            {/* Perceived effort */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Perceived Effort</p>
              <div className="flex gap-1.5">
                {([1, 2, 3, 4, 5] as PerceivedEffort[]).map(e => (
                  <button
                    key={e}
                    onClick={() => setEditEffort(prev => prev === e ? null : e)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-colors ${
                      editEffort === e
                        ? e <= 2
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : e === 3
                            ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                            : e === 4
                              ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                              : 'bg-red-500/20 border-red-500/50 text-red-400'
                        : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              {editEffort && (
                <p className="text-xs text-slate-500 mt-1 text-center">{EFFORT_LABELS[editEffort]}</p>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wide font-medium block mb-2">
                <Clock3 size={11} className="inline mr-1" />Duration (min)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={editDurationMin}
                onChange={e => setEditDurationMin(e.target.value)}
                placeholder="Optional"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Run actuals */}
            {editingHasRun && (
              <div className="space-y-3 border border-slate-700 rounded-xl p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Run Actuals</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Ruler size={11} /> Distance (mi)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editDistanceMiles}
                      onChange={e => setEditDistanceMiles(e.target.value)}
                      placeholder="0.0"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Timer size={11} /> Time (min)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={editRunDurationMin}
                      onChange={e => setEditRunDurationMin(e.target.value)}
                      placeholder="0"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </label>
                </div>
                {editDerivedPace != null && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-700/50 rounded-lg px-3 py-2">
                    <Zap size={11} className="text-sky-400" />
                    <span>Avg pace: <strong className="text-sky-300">{formatPace(editDerivedPace)}</strong></span>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Completed as planned?</p>
                  <div className="flex gap-2">
                    {([true, false] as const).map(val => (
                      <button
                        key={String(val)}
                        onClick={() => setEditCompletedAsPlanned(prev => prev === val ? null : val)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          editCompletedAsPlanned === val
                            ? val
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                              : 'bg-red-500/20 border-red-500/50 text-red-400'
                            : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                        }`}
                      >
                        {val ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Notes</p>
              <textarea
                value={notesText}
                onChange={e => setNotesText(e.target.value)}
                placeholder="How did it feel? Any notes..."
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
