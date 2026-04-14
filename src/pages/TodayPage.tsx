import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  SkipForward,
  Coffee,
  ChevronRight,
  ChevronLeft,
  Shuffle,
  Pencil,
  ListPlus,
} from 'lucide-react'
import { useActivePlan } from '../hooks/useActivePlan'
import { usePlanActions } from '../hooks/usePlanActions'
import { useHistoryStore } from '../store/historyStore'
import { WorkoutDayCard } from '../components/workout/WorkoutDayCard'
import { Modal } from '../components/shared/Modal'
import { EmptyState } from '../components/shared/EmptyState'

export function TodayPage() {
  const navigate = useNavigate()
  const { plan, todayResolved, upcoming } = useActivePlan()
  const actions = usePlanActions(plan?.id ?? null)
  const updateNotes = useHistoryStore(s => s.updateEntryNotes)

  const [showNotes, setShowNotes] = useState(false)
  const [notesText, setNotesText] = useState('')
  const [showOverride, setShowOverride] = useState(false)
  const [showJump, setShowJump] = useState(false)
  const [pendingAction, setPendingAction] = useState<'complete' | 'skip' | 'day_off' | null>(null)

  if (!plan || !todayResolved) {
    return (
      <div className="px-4 pt-safe">
        <div className="pt-12">
          <EmptyState
            title="No active plan"
            description="Create or activate a plan to start tracking your workouts."
            action={
              <button
                onClick={() => navigate('/plans')}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-semibold"
              >
                Go to Plans
              </button>
            }
          />
        </div>
      </div>
    )
  }

  const isPending = todayResolved.status === 'today_pending'
  const isResolved = !isPending

  function handleAction(type: 'complete' | 'skip' | 'day_off') {
    if (type === 'day_off') {
      actions.dayOff()
      return
    }
    setPendingAction(type)
    setNotesText(todayResolved?.historyEntry?.notes ?? '')
    setShowNotes(true)
  }

  function confirmAction() {
    if (!todayResolved) return
    if (pendingAction === 'complete') {
      actions.complete(todayResolved.planDayIndex, notesText || undefined)
    } else if (pendingAction === 'skip') {
      actions.skip(todayResolved.planDayIndex)
    }
    setShowNotes(false)
    setPendingAction(null)
  }

  function handleEditNotes() {
    if (!todayResolved?.historyEntry) return
    setNotesText(todayResolved.historyEntry.notes ?? '')
    setPendingAction(null)
    setShowNotes(true)
  }

  function saveNotes() {
    if (!todayResolved?.historyEntry) return
    updateNotes(todayResolved.historyEntry.id, notesText)
    setShowNotes(false)
  }

  return (
    <div className="px-4 pt-safe space-y-4">
      {/* Header */}
      <div className="pt-6 pb-2">
        <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="text-2xl font-bold text-white mt-0.5">{plan.name}</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Day {todayResolved.planDayIndex + 1} of {plan.days.length} in rotation
        </p>
      </div>

      {/* Today's workout */}
      <WorkoutDayCard resolved={todayResolved} isToday />

      {/* Action buttons — only show if pending */}
      {isPending && (
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleAction('complete')}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 transition-colors active:scale-95"
          >
            <CheckCircle2 size={22} />
            <span className="text-xs font-semibold">Complete</span>
          </button>
          <button
            onClick={() => handleAction('skip')}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 transition-colors active:scale-95"
          >
            <SkipForward size={22} />
            <span className="text-xs font-semibold">Skip</span>
          </button>
          <button
            onClick={() => handleAction('day_off')}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 transition-colors active:scale-95"
          >
            <Coffee size={22} />
            <span className="text-xs font-semibold">Day Off</span>
          </button>
        </div>
      )}

      {/* Resolved actions */}
      {isResolved && (
        <div className="flex gap-2">
          <button
            onClick={handleEditNotes}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
          >
            <Pencil size={13} /> Edit notes
          </button>
        </div>
      )}

      {/* Override controls */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setShowOverride(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
        >
          <Shuffle size={13} /> Override
        </button>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Upcoming
          </h2>
          <div className="space-y-2">
            {upcoming.slice(0, 5).map(rd => (
              <div key={rd.calendarDate} className="flex items-center gap-3">
                <div className="w-10 text-center flex-shrink-0">
                  <p className="text-xs text-slate-500 font-medium">
                    {new Date(rd.calendarDate + 'T00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                </div>
                <WorkoutDayCard resolved={rd} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notes modal */}
      {showNotes && (
        <Modal
          title={pendingAction ? `${pendingAction === 'complete' ? 'Complete' : 'Skip'} workout` : 'Edit notes'}
          onClose={() => setShowNotes(false)}
          footer={
            <button
              onClick={pendingAction ? confirmAction : saveNotes}
              className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold transition-colors"
            >
              {pendingAction === 'complete' ? 'Mark Complete' : pendingAction === 'skip' ? 'Skip Workout' : 'Save Notes'}
            </button>
          }
        >
          <div className="space-y-3">
            {pendingAction && (
              <p className="text-sm text-slate-400">
                Add optional notes before logging.
              </p>
            )}
            <textarea
              autoFocus
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="How did it feel? Any notes..."
              rows={4}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>
        </Modal>
      )}

      {/* Override modal */}
      {showOverride && (
        <Modal title="Override rotation" onClose={() => setShowOverride(false)}>
          <div className="space-y-2">
            <button
              onClick={() => { actions.advance(); setShowOverride(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-left transition-colors"
            >
              <ChevronRight size={18} className="text-sky-400" />
              <div>
                <p className="text-sm font-medium text-white">Advance one day</p>
                <p className="text-xs text-slate-400">Move to the next workout in the rotation</p>
              </div>
            </button>
            <button
              onClick={() => { actions.goBack(); setShowOverride(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-left transition-colors"
            >
              <ChevronLeft size={18} className="text-sky-400" />
              <div>
                <p className="text-sm font-medium text-white">Go back one day</p>
                <p className="text-xs text-slate-400">Return to the previous workout in the rotation</p>
              </div>
            </button>
            <button
              onClick={() => { setShowOverride(false); setShowJump(true) }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-left transition-colors"
            >
              <ListPlus size={18} className="text-sky-400" />
              <div>
                <p className="text-sm font-medium text-white">Jump to specific day</p>
                <p className="text-xs text-slate-400">Pick any day from the rotation</p>
              </div>
            </button>
          </div>
        </Modal>
      )}

      {/* Jump modal */}
      {showJump && (
        <Modal title="Jump to day" onClose={() => setShowJump(false)}>
          <div className="space-y-2">
            {plan.days.map((day, idx) => (
              <button
                key={day.id}
                onClick={() => {
                  actions.jumpTo(idx)
                  setShowJump(false)
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                  idx === todayResolved.planDayIndex
                    ? 'bg-sky-500/20 border border-sky-500/50'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-300">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{day.label}</p>
                  <p className="text-xs text-slate-400">
                    {day.slots.map(s => s.name).join(' + ')}
                  </p>
                </div>
                {idx === todayResolved.planDayIndex && (
                  <span className="ml-auto text-xs text-sky-400 font-medium">Current</span>
                )}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
