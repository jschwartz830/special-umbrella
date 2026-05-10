import { useState, useEffect, useRef } from 'react'

interface NumericInputFieldProps {
  value: number | null
  onChange: (value: number | null) => void
  placeholder?: string
  integerOnly?: boolean
  className?: string
}

export function NumericInputField({
  value,
  onChange,
  placeholder,
  integerOnly = false,
  className = '',
}: NumericInputFieldProps) {
  const [str, setStr] = useState(value != null ? String(value) : '')
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current) {
      setStr(value != null ? String(value) : '')
    }
  }, [value])

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = true
    const target = e.target
    setTimeout(() => target.select(), 0)
  }

  const handleBlur = () => {
    focusedRef.current = false
    setStr(value != null ? String(value) : '')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = e.target.value
    setStr(s)
    if (s === '') {
      onChange(null)
    } else {
      const n = parseFloat(s)
      if (!isNaN(n)) onChange(n)
    }
  }

  const adjust = (delta: number) => {
    const next = Math.max(0, (value ?? 0) + delta)
    onChange(next)
    setStr(String(next))
  }

  return (
    <div className={`flex items-stretch gap-0.5 ${className}`}>
      <input
        type="text"
        inputMode={integerOnly ? 'numeric' : 'decimal'}
        value={str}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-slate-700 border border-slate-600 rounded px-1 py-1 text-slate-100 text-center text-xs"
      />
      <div className="flex flex-col gap-px">
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => adjust(5)}
          className="flex-1 px-1 bg-slate-600 border border-slate-500 rounded-t text-slate-300 text-[9px] font-medium hover:bg-slate-500 active:bg-slate-400 leading-none"
        >
          +5
        </button>
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => adjust(-5)}
          className="flex-1 px-1 bg-slate-600 border border-slate-500 rounded-b text-slate-300 text-[9px] font-medium hover:bg-slate-500 active:bg-slate-400 leading-none"
        >
          -5
        </button>
      </div>
    </div>
  )
}
