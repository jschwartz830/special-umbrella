import { Trophy, X } from 'lucide-react'

interface TodayPRBannerProps {
  newPRs: string[]
  onDismiss: () => void
}

export function TodayPRBanner({ newPRs, onDismiss }: TodayPRBannerProps) {
  if (newPRs.length === 0) return null
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
      <Trophy size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-300">
          New personal record{newPRs.length > 1 ? 's' : ''}!
        </p>
        <p className="text-xs text-amber-400/70 mt-0.5 truncate">
          {newPRs.slice(0, 3).join(', ')}{newPRs.length > 3 ? ` +${newPRs.length - 3} more` : ''}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-amber-400/50 hover:text-amber-200 flex-shrink-0 transition-colors"
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  )
}
