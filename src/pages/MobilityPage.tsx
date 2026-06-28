import { useState } from 'react'
import { ArrowLeft, Plus, Trash2, GripVertical } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMobilityStore, type MobilityExercise } from '../store/mobilityStore'

export function MobilityPage() {
  const navigate = useNavigate()
  const routine = useMobilityStore(s => s.routine)
  const addExercise = useMobilityStore(s => s.addExercise)
  const removeExercise = useMobilityStore(s => s.removeExercise)
  const reorderExercise = useMobilityStore(s => s.reorderExercise)

  const [newName, setNewName] = useState('')
  const [newDuration, setNewDuration] = useState('60')
  const [adding, setAdding] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  function handleAdd() {
    const name = newName.trim()
    const sec = parseInt(newDuration)
    if (!name || !Number.isFinite(sec) || sec <= 0) return
    addExercise(name, sec)
    setNewName('')
    setNewDuration('60')
    setAdding(false)
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx)
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    reorderExercise(dragIdx, idx)
    setDragIdx(idx)
  }

  function handleDragEnd() {
    setDragIdx(null)
  }

  function fmt(s: number): string {
    const m = Math.floor(s / 60)
    const r = s % 60
    if (m === 0) return `${r}s`
    if (r === 0) return `${m}m`
    return `${m}m ${r}s`
  }

  const totalSec = routine.reduce((sum, e) => sum + e.durationSec, 0)

  return (
    <div className="px-4 pt-safe pb-32">
      <div className="pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Mobility Routine</h1>
          {routine.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {routine.length} exercise{routine.length === 1 ? '' : 's'} · ~{fmt(totalSec)}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {routine.length === 0 && !adding && (
          <div className="text-center py-10">
            <p className="text-slate-500 text-sm mb-1">No exercises yet.</p>
            <p className="text-slate-600 text-xs">Add movements to build your daily mobility routine.</p>
          </div>
        )}

        {routine.map((ex: MobilityExercise, idx) => (
          <div
            key={ex.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl border bg-slate-800/80 transition-colors ${
              dragIdx === idx ? 'border-sky-500/50 opacity-60' : 'border-slate-700/60'
            }`}
          >
            <GripVertical size={16} className="text-slate-600 flex-shrink-0 cursor-grab active:cursor-grabbing" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{ex.name}</p>
              <p className="text-xs text-slate-500">{fmt(ex.durationSec)}</p>
            </div>
            <button
              onClick={() => removeExercise(ex.id)}
              className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="rounded-xl border border-sky-500/40 bg-slate-800/80 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">New exercise</p>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Exercise name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              autoFocus
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 flex-shrink-0">Duration (sec)</label>
              <input
                type="number"
                min="5"
                max="600"
                value={newDuration}
                onChange={e => setNewDuration(e.target.value)}
                className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="flex-1 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-400 hover:text-slate-200 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-600 text-slate-500 hover:text-slate-300 hover:border-slate-500 text-sm transition-colors"
        >
          <Plus size={16} />
          Add exercise
        </button>
      )}
    </div>
  )
}
