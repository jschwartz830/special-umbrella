import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Check } from 'lucide-react'
import { usePlanStore, makeDay } from '../store/planStore'
import { Modal } from '../components/shared/Modal'
import { nanoid } from '../lib/utils'
import type { Plan, PlanDay } from '../types'
import { format } from 'date-fns'
import { dump as yamlDump } from 'js-yaml'
import { parseYamlProgram } from '../engine/programParser'
import { DayEditor } from '../components/plan-builder/DayEditor'

// ── Main page ────────────────────────────────────────────────────────────────

export function PlanBuilderPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const plans = usePlanStore(s => s.plans)
  const createPlan = usePlanStore(s => s.createPlan)
  const updatePlan = usePlanStore(s => s.updatePlan)

  const isNew = !id || id === 'new'
  const existing = id && id !== 'new' ? plans[id] : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [durationType, setDurationType] = useState<'rotations' | 'weeks'>(
    existing?.duration.type ?? 'rotations',
  )
  const [durationValue, setDurationValue] = useState(existing?.duration.value ?? 4)
  const [days, setDays] = useState<PlanDay[]>(existing?.days ?? [makeDay('Day 1')])
  const [saved, setSaved] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [pendingNav, setPendingNav] = useState<string | null>(null)
  const [dragDayIdx, setDragDayIdx] = useState<number | null>(null)
  const [showYamlEditor, setShowYamlEditor] = useState(false)
  const [yamlText, setYamlText] = useState('')
  const [yamlError, setYamlError] = useState<string | null>(null)

  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (navigateTimerRef.current !== null) clearTimeout(navigateTimerRef.current)
  }, [])

  function markDirty() {
    if (!isDirty) setIsDirty(true)
    if (saved) setSaved(false)
  }

  function safeNavigate(to: string) {
    if (isDirty && !saved) {
      setPendingNav(to)
      setShowLeaveConfirm(true)
    } else {
      navigate(to)
    }
  }

  function updateDay(i: number, d: PlanDay) {
    const next = [...days]
    next[i] = d
    setDays(next)
    markDirty()
  }

  function moveDay(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= days.length || to >= days.length) return
    const next = [...days]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setDays(next)
    markDirty()
  }

  function removeDay(i: number) {
    setDays(days.filter((_, idx) => idx !== i))
    markDirty()
  }

  function moveDayByDirection(i: number, dir: -1 | 1) {
    const next = [...days]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setDays(next)
    markDirty()
  }

  function duplicateDay(i: number) {
    const copy: PlanDay = {
      ...days[i],
      id: nanoid(),
      label: `${days[i].label} (copy)`,
      slots: days[i].slots.map(s => ({ ...s, id: nanoid() })),
    }
    const next = [...days]
    next.splice(i + 1, 0, copy)
    setDays(next)
    markDirty()
  }

  function handleSave() {
    if (!name.trim()) return
    if (durationValue < 1) return
    const payload: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'> = {
      name: name.trim(),
      description: description.trim() || undefined,
      status: existing?.status ?? 'inactive',
      days,
      duration: { type: durationType, value: durationValue },
      startDate: existing?.startDate ?? format(new Date(), 'yyyy-MM-dd'),
      startDayIndex: existing?.startDayIndex ?? 0,
    }

    if (isNew) {
      const newId = createPlan(payload)
      setSaved(true)
      setIsDirty(false)
      navigateTimerRef.current = setTimeout(() => navigate(`/plans/${newId}/edit`), 600)
    } else if (id) {
      updatePlan(id, payload)
      setSaved(true)
      setIsDirty(false)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  function openYamlEditor() {
    const yamlDoc = {
      name: name.trim() || 'Untitled Plan',
      description: description.trim() || undefined,
      duration: { type: durationType, value: durationValue },
      vars: existing?.programMeta?.vars ?? undefined,
      days: days.map(d => ({
        label: d.label,
        slots: d.slots.map(s => ({
          type: s.type,
          name: s.name,
          focus: s.weightsFocusArea,
          intent: s.weightsIntent,
          subtype: s.subtype,
          location: s.location,
          durationMin: s.durationMin ?? s.targetTime ?? s.targetDuration,
          warmup: s.warmup,
          exercises: s.exercises,
          segments: s.segments,
          progress: s.slotProgress,
          notes: s.notes,
        })),
      })),
    }
    setYamlText(yamlDump(yamlDoc, { lineWidth: 110 }))
    setYamlError(null)
    setShowYamlEditor(true)
  }

  function applyYamlChanges() {
    const result = parseYamlProgram(yamlText)
    if (result.errors.length > 0) {
      setYamlError(result.errors[0])
      return
    }
    setName(result.plan.name)
    setDescription(result.plan.description ?? '')
    setDurationType(result.plan.duration.type)
    setDurationValue(result.plan.duration.value)
    setDays(result.plan.days)
    setYamlError(null)
    setShowYamlEditor(false)
    markDirty()
  }

  return (
    <div className="px-4 pt-safe pb-8">
      {/* Header */}
      <div className="pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => safeNavigate('/plans')}
          className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-white flex-1">
          {isNew ? 'New Plan' : 'Edit Plan'}
        </h1>
        <button
          type="button"
          onClick={openYamlEditor}
          className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200"
        >
          Edit YAML
        </button>
        <button onClick={handleSave} disabled={!name.trim() || durationValue < 1}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
            saved ? 'bg-emerald-500 text-white' : 'bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-40'
          }`}>
          {saved ? <><Check size={14} /> Saved</> : 'Save'}
        </button>
      </div>

      {showYamlEditor && (
        <Modal
          title="Advanced YAML Editor"
          onClose={() => setShowYamlEditor(false)}
          footer={
            <div className="space-y-2 w-full">
              <button
                onClick={applyYamlChanges}
                className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-semibold"
              >
                Apply YAML to Plan
              </button>
              <p className="text-[11px] text-slate-400 text-center">
                Warmups, set-level details, and progression rules are best edited here.
              </p>
            </div>
          }
        >
          <div className="space-y-2">
            <textarea
              value={yamlText}
              onChange={e => setYamlText(e.target.value)}
              rows={18}
              className="w-full font-mono text-xs bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            {yamlError && <p className="text-xs text-red-400">{yamlError}</p>}
          </div>
        </Modal>
      )}

      <div className="space-y-5">
        {/* Plan meta */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Plan name *</label>
            <input type="text" value={name} onChange={e => { setName(e.target.value); markDirty() }}
              placeholder="e.g. 5-Day Upper/Lower"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Description</label>
            <input type="text" value={description} onChange={e => { setDescription(e.target.value); markDirty() }}
              placeholder="Optional description"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Duration</label>
            <div className="flex gap-2">
              <input type="number" min="1" max="52" value={durationValue}
                onChange={e => { setDurationValue(parseInt(e.target.value) || 1); markDirty() }}
                className={`w-20 bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 ${durationValue < 1 ? 'border-red-500' : 'border-slate-700'}`} />
              <div className="flex rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
                {(['rotations', 'weeks'] as const).map(t => (
                  <button key={t} type="button" onClick={() => { setDurationType(t); markDirty() }}
                    className={`px-3 py-2.5 text-sm font-medium transition-colors capitalize ${
                      durationType === t ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {durationValue < 1 && (
              <p className="mt-1.5 text-xs text-red-400">Duration must be at least 1.</p>
            )}
          </div>
        </div>

        {/* Days */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Workout Days ({days.length})
            </h2>
            <button type="button" onClick={() => { setDays(d => [...d, makeDay(`Day ${d.length + 1}`)]); markDirty() }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors">
              <Plus size={12} /> Add Day
            </button>
          </div>
          <div className="space-y-2">
            {days.map((day, i) => (
              <DayEditor
                key={day.id}
                day={day}
                index={i}
                total={days.length}
                onChange={d => updateDay(i, d)}
                onRemove={() => removeDay(i)}
                onMoveUp={() => moveDayByDirection(i, -1)}
                onMoveDown={() => moveDayByDirection(i, 1)}
                onDuplicate={() => duplicateDay(i)}
                onDragStart={() => setDragDayIdx(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (dragDayIdx !== null) moveDay(dragDayIdx, i); setDragDayIdx(null) }}
              />
            ))}
          </div>
        </div>

        {/* Save button (bottom) */}
        <button onClick={handleSave} disabled={!name.trim() || durationValue < 1}
          className={`w-full py-3 rounded-xl text-base font-semibold transition-all active:scale-[0.98] ${
            saved ? 'bg-emerald-500 text-white' : 'bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-40'
          }`}>
          {saved ? '✓ Saved' : isNew ? 'Create Plan' : 'Save Changes'}
        </button>
      </div>

      {/* Leave without saving confirmation */}
      {showLeaveConfirm && (
        <Modal title="Unsaved changes" onClose={() => setShowLeaveConfirm(false)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              You have unsaved changes. Leave without saving?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold transition-colors"
              >
                Keep editing
              </button>
              <button
                onClick={() => { setShowLeaveConfirm(false); navigate(pendingNav ?? '/plans') }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
