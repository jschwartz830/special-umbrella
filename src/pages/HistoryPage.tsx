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
  ClipboardList,
  Plus,
} from 'lucide-react'
import { useHistoryStore } from '../store/historyStore'
import { usePlanStore } from '../store/planStore'
import { useOutcomeStore, makeWorkoutInstanceId, makeExtraWorkoutInstanceId } from '../store/outcomeStore'
import { Modal } from '../components/shared/Modal'
import { DifficultyBadge } from '../components/workout/DifficultyBadge'
import { WorkoutBadge } from '../components/workout/WorkoutBadge'
import { OutcomeModal } from '../components/workout/OutcomeModal'
import { EmptyState } from '../components/shared/EmptyState'
import { CsvToolbar, type ImportResult } from '../components/shared/CsvToolbar'
import { downloadCsv, historyToCsv, historyFromCsv } from '../lib/csv'
import { computeHistoryStats } from '../lib/historyStats'
import { completionStateToAction } from '../modules/workout-outcomes/types'
import type { ActionType, HistoryEntry, ExtraWorkoutEntry, WorkoutType, PlanDay } from '../types'
import type { WorkoutOutcome } from '../modules/workout-outcomes/types'
import {
  COMPLETION_STATE_LABELS,
  formatPace,
} from '../modules/workout-outcomes/types'

const WORKOUT_TYPES: { type: WorkoutType; label: string }[] = [
  { type: 'weightlifting', label: 'Weightlifting' },
  { type: 'long_run', label: 'Long Run' },
  { type: 'recovery_run', label: 'Recovery Run' },
  { type: 'swim', label: 'Swim' },
  { type: 'yoga', label: 'Yoga' },
  { type: 'rest', label: 'Rest' },
]

function extraToPlanDay(extra: ExtraWorkoutEntry): PlanDay {
  return {
    id: extra.id,
    label: extra.workoutName,
    slots: [{ id: extra.id, type: extra.workoutType, name: extra.workoutName }],
  }
}

export function HistoryPage() {
  const plans = usePlanStore(s => s.plans)
  const activePlanId = usePlanStore(s => s.activePlanId)
  const entries = useHistoryStore(s => s.entries)
  const extraEntries = useHistoryStore(s => s.extraEntries)
  const updateNotes = useHistoryStore(s => s.updateEntryNotes)
  const updateAction = useHistoryStore(s => s.updateEntryAction)
  const removeEntry = useHistoryStore(s => s.removeEntry)
  const importEntries = useHistoryStore(s => s.importEntries)
  const addExtraEntry = useHistoryStore(s => s.addExtraEntry)
  const removeExtraEntry = useHistoryStore(s => s.removeExtraEntry)
  const outcomes = useOutcomeStore(s => s.outcomes)
  const updateOutcomeNotes = useOutcomeStore(s => s.updateOutcomeNotes)
  const removeOutcome = useOutcomeStore(s => s.removeOutcome)
  const importOutcomes = useOutcomeStore(s => s.importOutcomes)
  const logOutcomeWithProgression = useOutcomeStore(s => s.logOutcomeWithProgression)

  const [editingEntry, setEditingEntry] = useState<HistoryEntry | null>(null)
  const [notesText, setNotesText] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Outcome modal state
  const [outcomeTarget, setOutcomeTarget] = useState<{
    planId: string
    calendarDate: string
    planDay: PlanDay
    instanceId: string
  } | null>(null)

  // Extra workout add form (keyed by calendarDate, shown inline)
  const [addingExtraDate, setAddingExtraDate] = useState<string | null>(null)
  const [extraType, setExtraType] = useState<WorkoutType>('yoga')
  const [extraName, setExtraName] = useState('')

  // Plans that actually have history entries (for the filter dropdown)
  const plansWithHistory = Object.values(plans).filter(p =>
    entries.some(e => e.planId === p.id),
  )
  const showPlanFilter = plansWithHistory.length > 1

  const activePlanHasEntries = !!activePlanId && plansWithHistory.some(p => p.id === activePlanId)
  const [filterPlanId, setFilterPlanId] = useState<string | 'all'>(
    activePlanHasEntries ? activePlanId! : 'all',
  )

  const sorted = [...entries]
    .sort((a, b) => b.calendarDate.localeCompare(a.calendarDate))
    .filter(e => filterPlanId === 'all' || e.planId === filterPlanId)

  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const stats = computeHistoryStats(sorted, todayKey)

  function getOutcome(entry: HistoryEntry): WorkoutOutcome | null {
    const id = makeWorkoutInstanceId(entry.planId, entry.calendarDate)
    return outcomes[id] ?? null
  }

  function getExtrasForEntry(entry: HistoryEntry): ExtraWorkoutEntry[] {
    return extraEntries.filter(e => e.planId === entry.planId && e.calendarDate === entry.calendarDate)
  }

  function openEdit(entry: HistoryEntry) {
    setNotesText(entry.notes ?? '')
    setEditingEntry(entry)
  }

  function saveAndClose() {
    if (!editingEntry) return
    updateNotes(editingEntry.id, notesText)
    const instanceId = makeWorkoutInstanceId(editingEntry.planId, editingEntry.calendarDate)
    updateOutcomeNotes(instanceId, notesText)
    setEditingEntry(null)
  }

  function changeAction(action: ActionType) {
    if (!editingEntry) return
    updateAction(editingEntry.planId, editingEntry.calendarDate, action)
    setEditingEntry(prev => prev ? { ...prev, action } : null)
  }

  function deleteEntry(entry: HistoryEntry) {
    removeEntry(entry.planId, entry.calendarDate)
    removeOutcome(makeWorkoutInstanceId(entry.planId, entry.calendarDate))
    setConfirmDeleteId(null)
    setEditingEntry(null)
  }

  function openOutcomeForEntry(entry: HistoryEntry) {
    const plan = plans[entry.planId]
    if (!plan || entry.planDayIndex === undefined) return
    const planDay = plan.days[entry.planDayIndex]
    if (!planDay) return
    setEditingEntry(null)
    setOutcomeTarget({
      planId: entry.planId,
      calendarDate: entry.calendarDate,
      planDay,
      instanceId: makeWorkoutInstanceId(entry.planId, entry.calendarDate),
    })
  }

  function openOutcomeForExtra(extra: ExtraWorkoutEntry) {
    setOutcomeTarget({
      planId: extra.planId,
      calendarDate: extra.calendarDate,
      planDay: extraToPlanDay(extra),
      instanceId: makeExtraWorkoutInstanceId(extra.planId, extra.calendarDate, extra.id),
    })
  }

  function handleOutcomeConfirm(outcome: WorkoutOutcome) {
    if (!outcomeTarget) return
    const slot = outcomeTarget.planDay.slots[0] ?? { id: '', type: 'rest' as WorkoutType, name: '' }
    logOutcomeWithProgression(outcome, slot)

    // Sync history entry action if this is a main workout outcome
    const entry = entries.find(
      e => e.planId === outcomeTarget.planId && e.calendarDate === outcomeTarget.calendarDate,
    )
    if (entry && !outcomeTarget.instanceId.includes('_extra_')) {
      const action = completionStateToAction(outcome.completionState)
      if (entry.action !== action) {
        updateAction(entry.planId, entry.calendarDate, action)
      }
    }
    setOutcomeTarget(null)
  }

  function submitAddExtra(entry: HistoryEntry) {
    const name = extraName.trim() || WORKOUT_TYPES.find(w => w.type === extraType)?.label || extraType
    addExtraEntry({ planId: entry.planId, calendarDate: entry.calendarDate, workoutType: extraType, workoutName: name })
    setAddingExtraDate(null)
    setExtraName('')
    setExtraType('yoga')
  }

  function handleExport() {
    const csv = historyToCsv(entries, plans, outcomes)
    const stamp = format(new Date(), 'yyyy-MM-dd')
    downloadCsv(`workout-history-${stamp}.csv`, csv)
  }

  async function handleImport(file: File): Promise<ImportResult> {
    const text = await file.text()
    const existingPlanIds = new Set(Object.keys(plans))
    const { entries: newEntries, outcomes: newOutcomes, warnings } = historyFromCsv(
      text,
      existingPlanIds,
    )
    importEntries(newEntries)
    importOutcomes(newOutcomes)
    return {
      summary: `Imported ${newEntries.length} history ${newEntries.length === 1 ? 'entry' : 'entries'}${newOutcomes.length ? ` and ${newOutcomes.length} outcome record${newOutcomes.length === 1 ? '' : 's'}` : ''}.`,
      warnings,
    }
  }

  if (entries.length === 0) {
    return (
      <div className="px-4 pt-safe">
        <div className="pt-6 pb-4 flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold text-white">History</h1>
          <CsvToolbar
            canExport={false}
            onExport={handleExport}
            onImport={handleImport}
          />
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
      <div className="pt-6 pb-4 space-y-3">
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
        <CsvToolbar
          canExport={entries.length > 0}
          onExport={handleExport}
          onImport={handleImport}
        />

        {sorted.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            <StatTile label="Streak" value={stats.currentStreak} suffix={stats.currentStreak === 1 ? 'day' : 'days'} />
            <StatTile label="7-day" value={stats.last7Completed} />
            <StatTile label="30-day" value={stats.last30Completed} />
            <StatTile label="Total" value={stats.totalCompleted} />
          </div>
        )}
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
          const extras = getExtrasForEntry(entry)
          const isAddingExtra = addingExtraDate === entry.calendarDate

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

          const stateLabel = completionState
            ? COMPLETION_STATE_LABELS[completionState]
            : entry.action.replace('_', ' ')

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
                  {entry.action === 'complete' && (
                    <button
                      onClick={() => openOutcomeForEntry(entry)}
                      className="ml-1 p-1.5 rounded-lg bg-slate-700 hover:bg-sky-500/20 text-slate-400 hover:text-sky-400 transition-colors"
                      title="Edit workout details"
                    >
                      <ClipboardList size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(entry)}
                    className="ml-1 p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              </div>

              {/* Extra workouts for this date */}
              {(extras.length > 0 || isAddingExtra) && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1.5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Additional Workouts</p>
                  {extras.map(extra => {
                    const instanceId = makeExtraWorkoutInstanceId(extra.planId, extra.calendarDate, extra.id)
                    const extraOutcome = outcomes[instanceId]
                    return (
                      <div key={extra.id} className="flex items-center gap-2 bg-slate-700/30 rounded-lg px-2.5 py-1.5">
                        <WorkoutBadge type={extra.workoutType} size="sm" />
                        <span className="text-xs text-slate-300 flex-1 truncate">{extra.workoutName}</span>
                        {extraOutcome?.perceivedEffort != null && (
                          <span className="text-[10px] text-slate-500">{extraOutcome.perceivedEffort}/5</span>
                        )}
                        {extraOutcome?.runActual?.actualDistanceMiles != null && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-0.5"><Ruler size={9} /> {extraOutcome.runActual.actualDistanceMiles} mi</span>
                        )}
                        {extraOutcome?.durationActualMin != null && !extraOutcome.runActual && (
                          <span className="text-[10px] text-slate-500">{extraOutcome.durationActualMin} min</span>
                        )}
                        <button
                          onClick={() => openOutcomeForExtra(extra)}
                          className="p-1 rounded text-sky-400 hover:text-sky-300 transition-colors"
                          title="Log/edit details"
                        >
                          <ClipboardList size={11} />
                        </button>
                        <button
                          onClick={() => {
                            removeExtraEntry(extra.id)
                            removeOutcome(instanceId)
                          }}
                          className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )
                  })}

                  {/* Inline add form */}
                  {isAddingExtra && (
                    <div className="bg-slate-700/40 rounded-lg p-2.5 space-y-2">
                      <select
                        value={extraType}
                        onChange={e => setExtraType(e.target.value as WorkoutType)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      >
                        {WORKOUT_TYPES.map(w => (
                          <option key={w.type} value={w.type}>{w.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={extraName}
                        onChange={e => setExtraName(e.target.value)}
                        placeholder="Name (optional)"
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => submitAddExtra(entry)} className="flex-1 py-1.5 text-xs rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium transition-colors">Add</button>
                        <button onClick={() => { setAddingExtraDate(null); setExtraName(''); }} className="flex-1 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Add extra workout button */}
              {!isAddingExtra && (
                <div className="mt-2 pt-2 border-t border-slate-700/30">
                  <button
                    onClick={() => {
                      setAddingExtraDate(entry.calendarDate)
                      setExtraType('yoga')
                      setExtraName('')
                    }}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-sky-400 transition-colors"
                  >
                    <Plus size={11} /> Add workout
                  </button>
                </div>
              )}
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

            {/* Edit workout details */}
            {editingEntry.action === 'complete' && editingEntry.planDayIndex !== undefined && (
              <button
                onClick={() => openOutcomeForEntry(editingEntry)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 text-sm font-medium transition-colors"
              >
                <ClipboardList size={15} /> Edit Workout Details
              </button>
            )}

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

      {/* Outcome modal */}
      {outcomeTarget && (
        <OutcomeModal
          planId={outcomeTarget.planId}
          calendarDate={outcomeTarget.calendarDate}
          planDay={outcomeTarget.planDay}
          existingOutcome={outcomes[outcomeTarget.instanceId] ?? null}
          onConfirm={handleOutcomeConfirm}
          onClose={() => setOutcomeTarget(null)}
        />
      )}
    </div>
  )
}

function StatTile({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl px-2 py-2 text-center">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{label}</p>
      <p className="text-lg font-bold text-slate-100 leading-tight mt-0.5">{value}</p>
      {suffix && <p className="text-[10px] text-slate-500 leading-tight">{suffix}</p>}
    </div>
  )
}
