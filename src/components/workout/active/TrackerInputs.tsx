import { useState, useEffect, useRef } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { parseInputNumber } from './trackerHelpers'

/**
 * Numeric text input that buffers what the user is typing separately from the
 * parsed number. A plain controlled `<input value={n ?? ''}>` reformats on every
 * keystroke, which strips a trailing "." (or "0") the instant it's typed and makes
 * it impossible to enter decimals like "12.5" character by character.
 */
export function NumberTextField({
  value,
  onChange,
  onFocusField,
  onBlurField,
  inputMode,
  placeholder,
  className,
}: {
  value: number | null
  onChange: (v: number | null) => void
  onFocusField?: () => void
  onBlurField?: () => void
  inputMode: 'numeric' | 'decimal'
  placeholder?: string
  className?: string
}) {
  const [text, setText] = useState(value != null ? String(value) : '')
  const editingRef = useRef(false)

  useEffect(() => {
    if (!editingRef.current) setText(value != null ? String(value) : '')
  }, [value])

  return (
    <input
      type="text"
      inputMode={inputMode}
      value={text}
      onChange={e => {
        setText(e.target.value)
        onChange(parseInputNumber(e.target.value))
      }}
      onFocus={e => {
        editingRef.current = true
        onFocusField?.()
        e.target.select()
      }}
      onBlur={() => {
        editingRef.current = false
        setText(value != null ? String(value) : '')
        onBlurField?.()
      }}
      placeholder={placeholder}
      className={className}
    />
  )
}

interface TimerColProps {
  label: string
  value: string
  targetValue?: string
  running: boolean
  disabled?: boolean
  colorClass: string
  expanded: boolean
  onToggle: (e: React.MouseEvent) => void
  onReset: (e: React.MouseEvent) => void
  onAdjust: (delta: number, e: React.MouseEvent) => void
}

export function TimerCol({
  label, value, targetValue, running, disabled, colorClass, expanded,
  onToggle, onReset, onAdjust,
}: TimerColProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-2">
      <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
      {targetValue && (
        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-medium leading-none">Target {targetValue}</p>
      )}
      <p className={`text-lg font-mono font-bold leading-none ${colorClass}`}>{value}</p>
      <div className="flex gap-1">
        <button
          onClick={onToggle}
          disabled={disabled}
          className="w-7 h-6 flex items-center justify-center rounded border border-slate-600 bg-slate-700 text-slate-300 disabled:opacity-30 transition-colors hover:bg-slate-600"
        >
          {running ? <Pause size={10} /> : <Play size={10} />}
        </button>
        <button
          onClick={onReset}
          className="w-7 h-6 flex items-center justify-center rounded border border-slate-600 bg-slate-700 text-slate-300 transition-colors hover:bg-slate-600"
        >
          <RotateCcw size={10} />
        </button>
      </div>
      {expanded && (
        <div className="flex gap-1">
          <button
            onClick={e => onAdjust(-15, e)}
            className="px-2 py-0.5 rounded border border-slate-600 bg-slate-700 text-slate-300 text-[10px] hover:bg-slate-600 transition-colors"
          >
            −15
          </button>
          <button
            onClick={e => onAdjust(15, e)}
            className="px-2 py-0.5 rounded border border-slate-600 bg-slate-700 text-slate-300 text-[10px] hover:bg-slate-600 transition-colors"
          >
            +15
          </button>
        </div>
      )}
    </div>
  )
}
