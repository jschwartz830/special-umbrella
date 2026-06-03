import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Play,
  Pause,
  Copy,
  Archive,
  Trash2,
  ChevronRight,
  Dumbbell,
  FileCode,
} from 'lucide-react'
import { format } from 'date-fns'
import { useToday } from '../hooks/useToday'
import { usePlanStore } from '../store/planStore'
import { useHistoryStore } from '../store/historyStore'
import { useOutcomeStore } from '../store/outcomeStore'
import { useProgramStore } from '../store/programStore'
import { useExerciseHistoryStore } from '../store/exerciseHistoryStore'
import { isPlanExpired } from '../engine/rotationEngine'
import { computePlanProgress } from '../lib/historyStats'
import { Modal } from '../components/shared/Modal'
import { EmptyState } from '../components/shared/EmptyState'
import { CsvToolbar, type ImportResult } from '../components/shared/CsvToolbar'
import { downloadCsv, plansToCsv, plansFromCsv } from '../lib/csv'
import type { Plan } from '../types'

export function PlansPage() {
  const navigate = useNavigate()
  const plans = usePlanStore(s => s.plans)
  const setActivePlan = usePlanStore(s => s.setActivePlan)
  const deactivatePlan = usePlanStore(s => s.deactivatePlan)
  const duplicatePlan = usePlanStore(s => s.duplicatePlan)
  const archivePlan = usePlanStore(s => s.archivePlan)
  const deletePlan = usePlanStore(s => s.deletePlan)
  const importPlans = usePlanStore(s => s.importPlans)
  const clearHistory = useHistoryStore(s => s.clearPlanHistory)
  const clearOutcomes = useOutcomeStore(s => s.clearPlanOutcomes)
  const removeProgressionStates = useOutcomeStore(s => s.removeProgressionStates)
  const clearVars = useProgramStore(s => s.clearPlanVars)
  const clearExerciseHistory = useExerciseHistoryStore(s => s.clearByPlanId)
  const entries = useHistoryStore(s => s.entries)
  const today = useToday()

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [activatingPlan, setActivatingPlan] = useState<Plan | null>(null)
  const [startDate, setStartDate] = useState('')
  const [startDayIndex, setStartDayIndex] = useState(0)

  const allPlans = Object.values(plans)
  const active = allPlans.filter(p => p.status === 'active')
  const inactive = allPlans.filter(p => p.status === 'inactive')
  const archived = allPlans.filter(p => p.status === 'archived')

  function openActivateModal(plan: Plan) {
    setStartDate(format(new Date(), 'yyyy-MM-dd'))
    setStartDayIndex(0)
    setActivatingPlan(plan)
  }

  function confirmActivate() {
    if (!activatingPlan) return
    setActivePlan(activatingPlan.id, { startDate, startDayIndex })
    setActivatingPlan(null)
  }

  function handleExport() {
    const csv = plansToCsv(allPlans)
    const stamp = format(new Date(), 'yyyy-MM-dd')
    downloadCsv(`workout-plans-${stamp}.csv`, csv)
  }

  async function handleImport(file: File): Promise<ImportResult> {
    const text = await file.text()
    const { plans: newPlans, warnings } = plansFromCsv(text)
    importPlans(newPlans)
    return {
      summary: `Imported ${newPlans.length} plan${newPlans.length === 1 ? '' : 's'}.`,
      warnings,
    }
  }

  function PlanCard({ plan }: { plan: Plan }) {
    const isActive = plan.status === 'active'
    const isArchived = plan.status === 'archived'
    const planEntries = entries.filter(e => e.planId === plan.id)
    const expired = isActive && isPlanExpired(plan, planEntries, today)
    const progress = computePlanProgress(plan, planEntries, today)

    return (
      <div
        className={`rounded-xl border bg-slate-800/80 transition-colors ${
          isActive ? 'border-sky-500/50' : 'border-slate-700/50'
        }`}
      >
        <button
          onClick={() => navigate(`/plans/${plan.id}/edit`)}
          className="w-full text-left px-4 pt-4 pb-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-slate-200 truncate">{plan.name}</h3>
                {isActive && !expired && (
                  <span className="flex-shrink-0 text-xs bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full font-medium">
                    Active
                  </span>
                )}
                {expired && (
                  <span className="flex-shrink-0 text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-medium">
                    Complete
                  </span>
                )}
              </div>
              {plan.description && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{plan.description}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                {plan.days.length} days · {plan.duration.value} {plan.duration.type}
                {progress.total > 0 && progress.completed > 0 && (
                  <span className="ml-1.5 text-slate-400">
                    · {progress.completed}/{progress.total} done ({progress.percentComplete}%)
                  </span>
                )}
              </p>
              {progress.total > 0 && progress.percentComplete > 0 && (
                <div className="mt-2 h-1 w-full bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${expired ? 'bg-emerald-500' : 'bg-sky-500'}`}
                    style={{ width: `${progress.percentComplete}%` }}
                  />
                </div>
              )}
            </div>
            <ChevronRight size={16} className="text-slate-500 flex-shrink-0 mt-0.5" />
          </div>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1 px-3 pb-3 border-t border-slate-700/50 pt-2 mt-0">
          {!isArchived && (
            <>
              {isActive ? (
                <button
                  onClick={deactivatePlan}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white text-xs font-medium transition-colors"
                >
                  <Pause size={12} /> Deactivate
                </button>
              ) : (
                <button
                  onClick={() => openActivateModal(plan)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-medium transition-colors"
                >
                  <Play size={12} /> Activate
                </button>
              )}
            </>
          )}
          <button
            onClick={() => {
              const newId = duplicatePlan(plan.id)
              navigate(`/plans/${newId}/edit`)
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white text-xs font-medium transition-colors"
          >
            <Copy size={12} /> Copy
          </button>
          {!isActive && (
            <>
              {!isArchived && (
                <button
                  onClick={() => archivePlan(plan.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white text-xs font-medium transition-colors"
                >
                  <Archive size={12} /> Archive
                </button>
              )}
              <button
                onClick={() => setConfirmDelete(plan.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-medium transition-colors ml-auto"
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-safe">
      <div className="pt-6 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Plans</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/plans/import')}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-semibold transition-colors active:scale-95"
              title="Import program from YAML"
            >
              <FileCode size={16} />
              <span className="hidden sm:inline">Import YAML</span>
            </button>
            <button
              onClick={() => navigate('/plans/new')}
              className="flex items-center gap-1.5 px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-semibold transition-colors active:scale-95"
            >
              <Plus size={16} /> New Plan
            </button>
          </div>
        </div>
        <CsvToolbar
          canExport={allPlans.length > 0}
          onExport={handleExport}
          onImport={handleImport}
        />
      </div>

      {allPlans.length === 0 && (
        <EmptyState
          icon={<Dumbbell size={28} />}
          title="No plans yet"
          description="Create your first workout plan to get started."
          action={
            <button
              onClick={() => navigate('/plans/new')}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-semibold"
            >
              Create Plan
            </button>
          }
        />
      )}

      {active.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Active</h2>
          <div className="space-y-3">
            {active.map(p => <PlanCard key={p.id} plan={p} />)}
          </div>
        </section>
      )}

      {inactive.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Inactive</h2>
          <div className="space-y-3">
            {inactive.map(p => <PlanCard key={p.id} plan={p} />)}
          </div>
        </section>
      )}

      {archived.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Archived</h2>
          <div className="space-y-3">
            {archived.map(p => <PlanCard key={p.id} plan={p} />)}
          </div>
        </section>
      )}

      {/* Activate modal */}
      {activatingPlan && (
        <Modal
          title={`Activate "${activatingPlan.name}"`}
          onClose={() => setActivatingPlan(null)}
          footer={
            <button
              onClick={confirmActivate}
              className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold transition-colors"
            >
              Activate
            </button>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Set when you started (or are starting) this plan. Use a past date and a day offset to load an in-progress program.
            </p>

            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wide font-medium mb-1.5">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wide font-medium mb-1.5">
                Starting rotation day
              </label>
              <select
                value={startDayIndex}
                onChange={e => setStartDayIndex(Number(e.target.value))}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {activatingPlan.days.map((day, idx) => (
                  <option key={day.id} value={idx}>
                    Day {idx + 1} — {day.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1.5">
                Already mid-program? Pick the day you were on when your chosen start date began.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <Modal title="Delete plan?" onClose={() => setConfirmDelete(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              This will permanently delete the plan and all its history. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const planToDelete = plans[confirmDelete]
                  const progressionGroupIds = planToDelete
                    ? planToDelete.days
                        .flatMap(d => d.slots)
                        .flatMap(s => s.runConfig?.progressionGroupId ? [s.runConfig.progressionGroupId] : [])
                    : []
                  clearHistory(confirmDelete)
                  clearOutcomes(confirmDelete)
                  removeProgressionStates(progressionGroupIds)
                  clearVars(confirmDelete)
                  clearExerciseHistory(confirmDelete)
                  deletePlan(confirmDelete)
                  setConfirmDelete(null)
                }}
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
