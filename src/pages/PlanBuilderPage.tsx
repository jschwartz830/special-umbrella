import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react'
import { usePlanStore, makeDay, makeSlot } from '../store/planStore'
import { WORKOUT_META, WORKOUT_TYPES } from '../lib/constants'
import { Modal } from '../components/shared/Modal'
import { nanoid } from '../engine/rotationEngine'
import type { Plan, PlanDay, WorkoutSlot } from '../types'
import { format } from 'date-fns'

// ── Slot editor ──────────────────────────────────────────────────────────────

function SlotEditor({
  slot,
  onChange,
  onRemove,
  canRemove,
}: {
  slot: WorkoutSlot
  onChange: (s: WorkoutSlot) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const meta = WORKOUT_META[slot.type]

  function set<K extends keyof WorkoutSlot>(key: K, val: WorkoutSlot[K]) {
    onChange({ ...slot, [key]: val })
  }

  return (
    <div className="bg-slate-700/50 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        {/* Type picker button */}
        <button
          type="button"
          onClick={() => setShowTypePicker(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white text-xs font-medium ${meta.bgColor} flex-shrink-0`}
        >
          {<meta.icon size={12} />}
          {meta.label}
          <ChevronDown size={11} />
        </button>

        {/* Name */}
        <input
          type="text"
          value={slot.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Workout name"
          className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 min-w-0"
        />

        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="space-y-2 pt-1">
          {/* Type-specific fields */}
          {(slot.type === 'long_run' || slot.type === 'recovery_run') && (
            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Distance (mi)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={slot.targetDistance ?? ''}
                  onChange={e => set('targetDistance', parseFloat(e.target.value) || undefined)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Pace (min/mi)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={slot.targetPace ?? ''}
                  onChange={e => set('targetPace', parseFloat(e.target.value) || undefined)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Time (min)</span>
                <input
                  type="number"
                  min="0"
                  value={slot.targetTime ?? ''}
                  onChange={e => set('targetTime', parseInt(e.target.value) || undefined)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
            </div>
          )}

          {slot.type === 'weightlifting' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Target time (min)</span>
                <input
                  type="number"
                  min="0"
                  value={slot.targetTime ?? ''}
                  onChange={e => set('targetTime', parseInt(e.target.value) || undefined)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
              <label className="flex items-center gap-2 mt-5">
                <input
                  type="checkbox"
                  checked={slot.isDeload ?? false}
                  onChange={e => set('isDeload', e.target.checked)}
                  className="w-4 h-4 rounded accent-sky-500"
                />
                <span className="text-sm text-slate-300">Deload week</span>
              </label>
            </div>
          )}

          {(slot.type === 'swim' || slot.type === 'yoga') && (
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Duration (min)</span>
                <input
                  type="number"
                  min="0"
                  value={slot.targetDuration ?? ''}
                  onChange={e => set('targetDuration', parseInt(e.target.value) || undefined)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
              {slot.type === 'swim' && (
                <label className="space-y-1">
                  <span className="text-xs text-slate-400">Distance (mi)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={slot.targetDistance ?? ''}
                    onChange={e => set('targetDistance', parseFloat(e.target.value) || undefined)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </label>
              )}
            </div>
          )}

          {/* Notes */}
          {slot.type !== 'rest' && (
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Notes</span>
              <textarea
                rows={2}
                value={slot.notes ?? ''}
                onChange={e => set('notes', e.target.value || undefined)}
                placeholder="Coach notes, details..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
              />
            </label>
          )}
        </div>
      )}

      {/* Type picker modal */}
      {showTypePicker && (
        <Modal title="Choose workout type" onClose={() => setShowTypePicker(false)}>
          <div className="space-y-1.5">
            {WORKOUT_TYPES.map(wt => {
              const m = WORKOUT_META[wt]
              return (
                <button
                  key={wt}
                  onClick={() => { onChange({ ...slot, type: wt, name: m.label }); setShowTypePicker(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    slot.type === wt ? 'bg-slate-600' : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg ${m.bgColor} flex items-center justify-center`}>
                    <m.icon size={16} className="text-white" />
                  </span>
                  <span className="text-sm font-medium text-white">{m.label}</span>
                  {slot.type === wt && <Check size={16} className="text-sky-400 ml-auto" />}
                </button>
              )
            })}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Day editor ───────────────────────────────────────────────────────────────

function DayEditor({
  day,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDuplicate,
}: {
  day: PlanDay
  index: number
  total: number
  onChange: (d: PlanDay) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDuplicate: () => void
}) {
  const [expanded, setExpanded] = useState(true)

  function updateSlot(i: number, s: WorkoutSlot) {
    const slots = [...day.slots]
    slots[i] = s
    onChange({ ...day, slots })
  }

  function removeSlot(i: number) {
    const slots = day.slots.filter((_, idx) => idx !== i)
    onChange({ ...day, slots })
  }

  function addSlot() {
    if (day.slots.length >= 2) return
    onChange({ ...day, slots: [...day.slots, makeSlot()] })
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Day header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-800">
        <GripVertical size={16} className="text-slate-600 flex-shrink-0" />
        <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">
          {index + 1}
        </span>
        <input
          type="text"
          value={day.label}
          onChange={e => onChange({ ...day, label: e.target.value })}
          placeholder="Day name (e.g. Upper A)"
          className="flex-1 bg-transparent text-sm font-semibold text-white placeholder-slate-500 focus:outline-none min-w-0"
        />
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="p-1 rounded text-slate-500 hover:text-white"
          >
            <Copy size={13} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="p-1 rounded text-slate-500 hover:text-white"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={total <= 1}
            className="p-1 rounded text-red-400/60 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Slots */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {day.slots.map((slot, i) => (
            <SlotEditor
              key={slot.id}
              slot={slot}
              onChange={s => updateSlot(i, s)}
              onRemove={() => removeSlot(i)}
              canRemove={day.slots.length > 1}
            />
          ))}
          {day.slots.length < 2 && (
            <button
              type="button"
              onClick={addSlot}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-slate-600 hover:border-slate-500 text-slate-500 hover:text-slate-300 text-xs font-medium transition-colors"
            >
              <Plus size={13} /> Add second workout
            </button>
          )}
        </div>
      )}
    </div>
  )
}

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
  const [durationValue, setDurationValue] = useState(
    existing?.duration.value ?? 4,
  )
  const [days, setDays] = useState<PlanDay[]>(
    existing?.days ?? [makeDay('Day 1')],
  )
  const [saved, setSaved] = useState(false)

  function updateDay(i: number, d: PlanDay) {
    const next = [...days]
    next[i] = d
    setDays(next)
  }

  function removeDay(i: number) {
    setDays(days.filter((_, idx) => idx !== i))
  }

  function moveDay(i: number, dir: -1 | 1) {
    const next = [...days]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setDays(next)
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
  }

  function handleSave() {
    if (!name.trim()) return
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
      setTimeout(() => navigate(`/plans/${newId}/edit`), 600)
    } else if (id) {
      updatePlan(id, payload)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="px-4 pt-safe pb-8">
      {/* Header */}
      <div className="pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/plans')}
          className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-white flex-1">
          {isNew ? 'New Plan' : 'Edit Plan'}
        </h1>
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
            saved
              ? 'bg-emerald-500 text-white'
              : 'bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-40'
          }`}
        >
          {saved ? <><Check size={14} /> Saved</> : 'Save'}
        </button>
      </div>

      <div className="space-y-5">
        {/* Plan meta */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Plan name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. 5-Day Upper/Lower"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Duration</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="52"
                value={durationValue}
                onChange={e => setDurationValue(parseInt(e.target.value) || 1)}
                className="w-20 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <div className="flex rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
                {(['rotations', 'weeks'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDurationType(t)}
                    className={`px-3 py-2.5 text-sm font-medium transition-colors capitalize ${
                      durationType === t
                        ? 'bg-sky-500 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Days */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Workout Days ({days.length})
            </h2>
            <button
              type="button"
              onClick={() => setDays(d => [...d, makeDay(`Day ${d.length + 1}`)])}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
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
                onMoveUp={() => moveDay(i, -1)}
                onMoveDown={() => moveDay(i, 1)}
                onDuplicate={() => duplicateDay(i)}
              />
            ))}
          </div>
        </div>

        {/* Save button (bottom) */}
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className={`w-full py-3 rounded-xl text-base font-semibold transition-all active:scale-[0.98] ${
            saved
              ? 'bg-emerald-500 text-white'
              : 'bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-40'
          }`}
        >
          {saved ? '✓ Saved' : isNew ? 'Create Plan' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
