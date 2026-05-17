import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface NumericInputFieldProps {
  value: number | null
  onChange: (value: number | null) => void
  placeholder?: string
  integerOnly?: boolean
  className?: string
}

function NumericKeypad({
  display,
  integerOnly,
  onKey,
  onAdjust,
  onDone,
}: {
  display: string
  integerOnly: boolean
  onKey: (key: string) => void
  onAdjust: (delta: number) => void
  onDone: () => void
}) {
  const delta = integerOnly ? 1 : 5

  const keyBtn =
    'flex items-center justify-center bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-xl text-white text-xl font-medium h-14 select-none touch-manipulation'
  const adjBtn =
    'flex-1 py-3 rounded-xl border border-slate-600 bg-slate-700/80 text-slate-200 text-sm font-bold select-none touch-manipulation hover:bg-slate-600 active:bg-slate-500'

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end" onPointerDown={onDone}>
      <div
        className="w-full bg-slate-900 border-t border-slate-700"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Value display */}
        <div className="px-4 pt-3 pb-2">
          <div className="font-mono text-2xl text-center text-white bg-slate-800 border border-sky-500 ring-2 ring-sky-500/30 rounded-xl py-2.5 min-h-[3rem] flex items-center justify-center">
            {display !== '' ? display : <span className="text-slate-500">—</span>}
          </div>
        </div>

        {/* ±delta row */}
        <div className="flex gap-3 px-4 pb-2">
          <button
            className={adjBtn}
            onPointerDown={e => {
              e.preventDefault()
              onAdjust(-delta)
            }}
          >
            -{delta}
          </button>
          <button
            className={adjBtn}
            onPointerDown={e => {
              e.preventDefault()
              onAdjust(delta)
            }}
          >
            +{delta}
          </button>
        </div>

        {/* Digit grid */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-2">
          {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(n => (
            <button
              key={n}
              className={keyBtn}
              onPointerDown={e => {
                e.preventDefault()
                onKey(String(n))
              }}
            >
              {n}
            </button>
          ))}
          {/* Bottom row */}
          {!integerOnly ? (
            <button
              className={keyBtn}
              onPointerDown={e => {
                e.preventDefault()
                onKey('.')
              }}
            >
              .
            </button>
          ) : (
            <div />
          )}
          <button
            className={keyBtn}
            onPointerDown={e => {
              e.preventDefault()
              onKey('0')
            }}
          >
            0
          </button>
          <button
            className={keyBtn}
            onPointerDown={e => {
              e.preventDefault()
              onKey('backspace')
            }}
          >
            ⌫
          </button>
        </div>

        {/* Done */}
        <div className="px-4 pb-1">
          <button
            className="w-full py-3 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold rounded-xl touch-manipulation"
            onPointerDown={e => {
              e.preventDefault()
              onDone()
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function NumericInputField({
  value,
  onChange,
  placeholder,
  integerOnly = false,
  className = '',
}: NumericInputFieldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [display, setDisplay] = useState('')
  const isReplacingRef = useRef(true)
  const displayRef = useRef('')

  const openKeypad = () => {
    const d = value != null ? String(value) : ''
    setDisplay(d)
    displayRef.current = d
    isReplacingRef.current = true
    setIsOpen(true)
  }

  const closeKeypad = () => {
    setIsOpen(false)
  }

  const handleKey = useCallback(
    (key: string) => {
      const prev = displayRef.current
      let next: string

      if (key === 'backspace') {
        next = isReplacingRef.current ? '' : prev.slice(0, -1)
      } else if (key === '.') {
        if (integerOnly) return
        if (isReplacingRef.current) {
          next = '0.'
        } else {
          if (prev.includes('.')) return
          next = prev + '.'
        }
      } else {
        next = isReplacingRef.current ? key : prev + key
      }

      isReplacingRef.current = false
      displayRef.current = next
      setDisplay(next)

      if (next === '' || next === '.' || next === '0.') {
        if (next === '') onChange(null)
        return
      }
      const n = parseFloat(next)
      if (!isNaN(n)) {
        onChange(integerOnly ? Math.round(n) : n)
      }
    },
    [integerOnly, onChange]
  )

  const handleAdjust = useCallback(
    (delta: number) => {
      const next = Math.max(0, (value ?? 0) + delta)
      onChange(next)
      const s = String(next)
      setDisplay(s)
      displayRef.current = s
      isReplacingRef.current = false
    },
    [value, onChange]
  )

  const displayText = value != null ? String(value) : ''

  return (
    <div className={className}>
      <button
        type="button"
        onClick={openKeypad}
        className={`w-full bg-slate-700 border rounded px-1 py-1 text-center text-xs transition-colors ${
          isOpen
            ? 'border-sky-500 ring-2 ring-sky-500/40 text-slate-100'
            : 'border-slate-600 text-slate-100'
        }`}
      >
        {displayText !== '' ? displayText : <span className="text-slate-500">{placeholder ?? ''}</span>}
      </button>

      {isOpen && (
        <NumericKeypad
          display={display}
          integerOnly={integerOnly}
          onKey={handleKey}
          onAdjust={handleAdjust}
          onDone={closeKeypad}
        />
      )}
    </div>
  )
}
