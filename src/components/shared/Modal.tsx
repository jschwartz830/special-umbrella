import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ title, onClose, children, footer }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock background scroll while open (targets the <main> scroll container)
  useEffect(() => {
    const el = document.querySelector('main') as HTMLElement | null
    if (!el) return
    const prev = el.style.overflow
    el.style.overflow = 'hidden'
    return () => { el.style.overflow = prev }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet — capped so it never slides behind the Dynamic Island / status bar */}
      <div
        className="relative z-10 w-full max-w-lg bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-700 flex flex-col"
        style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top) - 8px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>

        {/* Footer — extra bottom padding for home indicator */}
        {footer && (
          <div
            className="px-5 pt-4 border-t border-slate-700 flex-shrink-0"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
