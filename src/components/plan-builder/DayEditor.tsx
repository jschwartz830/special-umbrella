import { useState } from 'react'
import type { DragEvent } from 'react'
import { Plus, GripVertical, Trash2, ChevronDown, ChevronUp, Copy } from 'lucide-react'
import { makeSlot } from '../../store/planStore'
import type { PlanDay, WorkoutSlot } from '../../types'
import { SlotEditor } from './SlotEditor'

// ── Day editor ───────────────────────────────────────────────────────────────

export function DayEditor({
  day,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  day: PlanDay
  index: number
  total: number
  onChange: (d: PlanDay) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDuplicate: () => void
  onDragStart: () => void
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  onDrop: () => void
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
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
    >
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
          <button type="button" onClick={onMoveUp} disabled={index === 0}
            className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronUp size={14} />
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1}
            className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronDown size={14} />
          </button>
          <button type="button" onClick={onDuplicate} className="p-1 rounded text-slate-500 hover:text-white">
            <Copy size={13} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          aria-label={expanded ? 'Collapse day' : 'Expand day'}
          aria-expanded={expanded}
          className="ml-1 w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 active:bg-sky-500/30 transition-colors"
        >
          <ChevronDown size={18} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
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
          {total > 1 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onRemove}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-red-400/80 hover:text-red-300 hover:bg-red-500/10 text-xs font-medium transition-colors"
              >
                <Trash2 size={13} /> Delete day
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
